import React, { useState, useEffect, useRef } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Loader2, Wand2, Film, Mic, ImageIcon } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface ContinueVideoPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reelId: string;
  videoUrl: string;
  audioUrl?: string | null;
  scenes: any[];
  twinVoiceKey?: string | null;
  onComplete: (newVideoUrl: string) => void;
}

export const ContinueVideoPanel: React.FC<ContinueVideoPanelProps> = ({
  open,
  onOpenChange,
  reelId,
  videoUrl,
  audioUrl,
  scenes,
  twinVoiceKey,
  onComplete,
}) => {
  const { toast } = useToast();
  const [lastFrame, setLastFrame] = useState<string | null>(null);
  const [continuationScript, setContinuationScript] = useState('');
  const [isGeneratingScript, setIsGeneratingScript] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressStatus, setProgressStatus] = useState('');
  const [voiceStatus, setVoiceStatus] = useState<'idle' | 'cloning' | 'ready' | 'twin'>('idle');
  const [clonedVoiceId, setClonedVoiceId] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const lastScene = scenes?.[scenes.length - 1];
  const lastNarration = lastScene?.text || lastScene?.narration || '';

  // Extract last frame when panel opens
  useEffect(() => {
    if (!open || !videoUrl) return;
    extractLastFrame();
    generateContinuationScript();
    prepareVoice();
  }, [open, videoUrl]);

  const extractLastFrame = () => {
    const video = document.createElement('video');
    video.crossOrigin = 'anonymous';
    video.src = videoUrl;
    video.muted = true;
    video.addEventListener('loadedmetadata', () => {
      video.currentTime = Math.max(0, video.duration - 0.5);
    });
    video.addEventListener('seeked', () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(video, 0, 0);
          setLastFrame(canvas.toDataURL('image/jpeg', 0.85));
        }
      } catch (e) {
        console.warn('Could not extract last frame (CORS):', e);
      }
    });
    video.load();
  };

  const generateContinuationScript = async () => {
    setIsGeneratingScript(true);
    try {
      const { data, error } = await supabase.functions.invoke('ai', {
        body: {
          prompt: `You are a video script continuation expert. The following video script was cut off at the end. Write a natural 5-10 second closing narration that wraps up the thought smoothly. Only output the continuation text, nothing else.

Last narration from the video:
"${lastNarration}"

Write the continuation:`,
        },
      });
      if (error) throw error;
      const text = data?.text || data?.response || '';
      setContinuationScript(text.replace(/^["']|["']$/g, '').trim());
    } catch (e: any) {
      console.error('Failed to generate continuation script:', e);
      toast({ title: 'Script generation failed', description: e.message, variant: 'destructive' });
    } finally {
      setIsGeneratingScript(false);
    }
  };

  const prepareVoice = async () => {
    if (twinVoiceKey) {
      setVoiceStatus('twin');
      setClonedVoiceId(twinVoiceKey);
      return;
    }
    // Clone voice from reel audio
    const sourceAudio = audioUrl || scenes?.find((s: any) => s.audioUrl)?.audioUrl;
    if (!sourceAudio) {
      setVoiceStatus('ready');
      return;
    }
    setVoiceStatus('cloning');
    try {
      const { data, error } = await supabase.functions.invoke('clone-voice-speechify', {
        body: {
          audioUrl: sourceAudio,
          name: 'Reel Continuation',
          email: 'auto@continuation.local',
          gender: 'male',
        },
      });
      if (error) throw error;
      if (data?.speechifyVoiceId) {
        setClonedVoiceId(data.speechifyVoiceId);
        setVoiceStatus('ready');
      } else {
        setVoiceStatus('ready');
      }
    } catch (e: any) {
      console.warn('Voice cloning failed, will use default:', e);
      setVoiceStatus('ready');
    }
  };

  const handleGenerate = async () => {
    if (!continuationScript.trim()) return;
    setIsGenerating(true);
    setProgress(10);
    setProgressStatus('Generating voiceover…');

    try {
      // Step 1: Generate TTS for continuation
      const voiceId = clonedVoiceId || 'alloy';
      const { data: ttsData, error: ttsError } = await supabase.functions.invoke('text-to-speech', {
        body: { text: continuationScript, voice: voiceId },
      });
      if (ttsError) throw ttsError;
      const contAudioUrl = ttsData?.audioUrl || ttsData?.url;
      if (!contAudioUrl) throw new Error('No audio URL returned');

      setProgress(40);
      setProgressStatus('Generating continuation video…');

      // Step 2: Generate video clip using the last frame as reference
      const { data: vidData, error: vidError } = await supabase.functions.invoke('wavespeed-video', {
        body: {
          prompt: `Continue this scene naturally: ${continuationScript}`,
          image: lastFrame || undefined,
          model: 'wan-2.1',
          duration: 5,
        },
      });
      if (vidError) throw vidError;
      const contVideoUrl = vidData?.videoUrl || vidData?.url;

      setProgress(70);
      setProgressStatus('Stitching videos…');

      // Step 3: Stitch original + continuation
      const { data: stitchData, error: stitchError } = await supabase.functions.invoke('creatomate-stitch', {
        body: {
          clips: [
            { url: videoUrl, duration: scenes.reduce((sum: number, s: any) => sum + (s.duration || 5), 0) },
            { url: contVideoUrl, duration: 5, caption: continuationScript },
          ],
          audioUrl: contAudioUrl,
          transition: 'crossfade',
        },
      });
      if (stitchError) throw stitchError;

      setProgress(90);
      setProgressStatus('Polling for render…');

      // Step 4: Poll for completed render
      const renderId = stitchData?.renderId;
      if (renderId) {
        let attempts = 0;
        while (attempts < 60) {
          await new Promise(r => setTimeout(r, 3000));
          const { data: statusData } = await supabase.functions.invoke('creatomate-status', {
            body: { renderId },
          });
          if (statusData?.status === 'succeeded' && statusData?.url) {
            setProgress(100);
            setProgressStatus('Done!');
            onComplete(statusData.url);
            onOpenChange(false);
            toast({ title: 'Video extended!', description: 'Your continuation has been stitched.' });
            return;
          }
          if (statusData?.status === 'failed') throw new Error('Render failed');
          attempts++;
        }
        throw new Error('Render timed out');
      }
    } catch (e: any) {
      console.error('Continue video failed:', e);
      toast({ title: 'Failed to continue video', description: e.message, variant: 'destructive' });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Film className="w-5 h-5 text-primary" />
            Continue Video
          </SheetTitle>
        </SheetHeader>

        <div className="space-y-6 mt-6">
          {/* Last Frame */}
          <div>
            <p className="text-sm font-medium mb-2 flex items-center gap-2">
              <ImageIcon className="w-4 h-4" /> Last Frame
            </p>
            {lastFrame ? (
              <img src={lastFrame} alt="Last frame" className="w-full aspect-[9/16] object-contain bg-black rounded-lg" />
            ) : (
              <div className="w-full aspect-[9/16] bg-muted rounded-lg flex items-center justify-center">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            )}
          </div>

          {/* Last sentence context */}
          <div>
            <p className="text-sm font-medium mb-1">Last narration</p>
            <p className="text-xs text-muted-foreground bg-muted p-3 rounded-lg italic">
              "{lastNarration}"
            </p>
          </div>

          {/* Voice status */}
          <div className="flex items-center gap-2">
            <Mic className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm">Voice:</span>
            {voiceStatus === 'cloning' && (
              <Badge variant="secondary" className="animate-pulse">
                <Loader2 className="w-3 h-3 mr-1 animate-spin" /> Cloning…
              </Badge>
            )}
            {voiceStatus === 'twin' && <Badge className="bg-primary/20 text-primary">AI Twin Voice</Badge>}
            {voiceStatus === 'ready' && <Badge variant="secondary">✓ Ready</Badge>}
            {voiceStatus === 'idle' && <Badge variant="outline">Preparing…</Badge>}
          </div>

          {/* Continuation script */}
          <div>
            <p className="text-sm font-medium mb-2 flex items-center gap-2">
              <Wand2 className="w-4 h-4" /> Continuation Script
            </p>
            {isGeneratingScript ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
                <Loader2 className="w-4 h-4 animate-spin" /> AI is writing a closing script…
              </div>
            ) : (
              <Textarea
                value={continuationScript}
                onChange={(e) => setContinuationScript(e.target.value)}
                placeholder="AI-generated closing script…"
                rows={4}
                className="text-sm"
              />
            )}
          </div>

          {/* Progress */}
          {isGenerating && (
            <div className="space-y-2">
              <Progress value={progress} />
              <p className="text-xs text-muted-foreground text-center">{progressStatus}</p>
            </div>
          )}

          {/* Generate button */}
          <Button
            className="w-full"
            onClick={handleGenerate}
            disabled={isGenerating || isGeneratingScript || !continuationScript.trim() || voiceStatus === 'cloning'}
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Generating & Stitching…
              </>
            ) : (
              <>
                <Film className="w-4 h-4 mr-2" />
                Generate & Stitch
              </>
            )}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
};
