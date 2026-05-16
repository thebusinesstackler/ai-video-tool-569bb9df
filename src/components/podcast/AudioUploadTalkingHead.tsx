import React, { useState, useRef, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';
import { useAITwins } from '@/hooks/useAITwins';
import { PodcastAspectRatioPicker, type PodcastAspectRatio } from '@/components/PodcastAspectRatioPicker';
import { Upload, Mic, Loader2, User, Image as ImageIcon, X, Sparkles, Zap, Download } from 'lucide-react';
import { cn } from '@/lib/utils';

const MAX_AUDIO_MB = 25;
const MAX_AUDIO_SECONDS = 300;
const MAX_IMAGE_MB = 8;
const HD_MAX_SECONDS = 120;

interface Props {
  source: 'podcast' | 'spokesperson';
}

export const AudioUploadTalkingHead: React.FC<Props> = ({ source }) => {
  const { toast } = useToast();
  const { user } = useAuth();
  const { twins, loading: loadingTwins } = useAITwins();

  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [audioDuration, setAudioDuration] = useState<number>(0);
  const [audioPreviewUrl, setAudioPreviewUrl] = useState<string | null>(null);

  const [portraitMode, setPortraitMode] = useState<'twin' | 'upload'>('twin');
  const [selectedTwinId, setSelectedTwinId] = useState<string | null>(null);
  const [portraitFile, setPortraitFile] = useState<File | null>(null);
  const [portraitPreview, setPortraitPreview] = useState<string | null>(null);

  const [aspectRatio, setAspectRatio] = useState<PodcastAspectRatio>('9:16');

  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressStatus, setProgressStatus] = useState('');
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [usedModel, setUsedModel] = useState<string | null>(null);

  const audioInputRef = useRef<HTMLInputElement>(null);
  const portraitInputRef = useRef<HTMLInputElement>(null);

  // Auto-select first twin
  useEffect(() => {
    if (!selectedTwinId && twins.length > 0) setSelectedTwinId(twins[0].id);
  }, [twins, selectedTwinId]);

  const onAudioPick = async (file: File) => {
    if (!file.type.startsWith('audio/')) {
      toast({ title: 'Invalid file', description: 'Please upload an audio file (MP3, WAV, M4A).', variant: 'destructive' });
      return;
    }
    if (file.size > MAX_AUDIO_MB * 1024 * 1024) {
      toast({ title: 'File too large', description: `Max ${MAX_AUDIO_MB}MB.`, variant: 'destructive' });
      return;
    }
    const url = URL.createObjectURL(file);
    const audio = new Audio(url);
    await new Promise<void>((resolve) => {
      audio.addEventListener('loadedmetadata', () => resolve(), { once: true });
      audio.addEventListener('error', () => resolve(), { once: true });
    });
    const dur = isFinite(audio.duration) ? audio.duration : 0;
    if (dur < 1 || dur > MAX_AUDIO_SECONDS) {
      URL.revokeObjectURL(url);
      toast({ title: 'Audio too long', description: `Max ${MAX_AUDIO_SECONDS}s (5 min). Yours is ${Math.round(dur)}s.`, variant: 'destructive' });
      return;
    }
    setAudioFile(file);
    setAudioDuration(dur);
    setAudioPreviewUrl(url);
  };

  const onPortraitPick = (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast({ title: 'Invalid file', description: 'Please upload a JPG or PNG.', variant: 'destructive' });
      return;
    }
    if (file.size > MAX_IMAGE_MB * 1024 * 1024) {
      toast({ title: 'Image too large', description: `Max ${MAX_IMAGE_MB}MB.`, variant: 'destructive' });
      return;
    }
    setPortraitFile(file);
    setPortraitPreview(URL.createObjectURL(file));
  };

  const uploadToStorage = async (file: File, folder: string): Promise<string> => {
    if (!user) throw new Error('Not signed in');
    const ext = file.name.split('.').pop() || 'bin';
    const path = `${user.id}/${folder}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from('reels').upload(path, file, {
      contentType: file.type,
      upsert: true,
    });
    if (error) throw new Error(`Upload failed: ${error.message}`);
    const { data: pub } = supabase.storage.from('reels').getPublicUrl(path);
    return pub.publicUrl;
  };

  const resolvedPortraitUrl = async (): Promise<string> => {
    if (portraitMode === 'twin') {
      const twin = twins.find(t => t.id === selectedTwinId);
      const url = twin?.reference_images?.[0] || (twin as any)?.first_image;
      if (!url) throw new Error('Selected twin has no portrait');
      return url;
    }
    if (!portraitFile) throw new Error('Please upload a portrait photo');
    return await uploadToStorage(portraitFile, 'portrait-uploads');
  };

  const handleGenerate = async () => {
    if (!audioFile) {
      toast({ title: 'Add audio first', description: 'Upload an MP3 of your narration.', variant: 'destructive' });
      return;
    }
    setIsGenerating(true);
    setProgress(5);
    setProgressStatus('Uploading audio...');
    setVideoUrl(null);
    setUsedModel(null);

    try {
      const audioUrl = await uploadToStorage(audioFile, 'podcast-audio');
      setProgress(15);
      setProgressStatus('Resolving portrait...');
      const portraitUrl = await resolvedPortraitUrl();
      setProgress(25);

      setProgressStatus('Starting lip-sync render...');
      const { data, error } = await supabase.functions.invoke('generate-talking-head-from-audio', {
        body: {
          audioUrl,
          portraitUrl,
          durationSec: Math.ceil(audioDuration),
          aspectRatio,
          source,
        },
      });
      if (error) throw error;
      if (!data?.taskId) throw new Error(data?.error || 'No task created');
      setUsedModel(data.model);
      setProgress(35);
      setProgressStatus(`Rendering with ${data.model === 'infinitetalk-hd' ? 'HD' : 'Standard'} model...`);

      const taskId = data.taskId;
      let attempts = 0;
      const maxAttempts = 200;
      while (attempts < maxAttempts) {
        attempts++;
        await new Promise(r => setTimeout(r, 3000));
        const { data: status } = await supabase.functions.invoke('wavespeed-video', {
          body: { action: 'status', taskId },
        });
        if (status?.status === 'completed' && status?.videoUrl) {
          setVideoUrl(status.videoUrl);
          setProgress(100);
          setProgressStatus('Done!');
          toast({ title: 'Video ready', description: `Generated with ${data.model}.` });
          break;
        }
        if (status?.status === 'failed') {
          throw new Error(status?.error || 'Render failed');
        }
        setProgress(35 + (attempts / maxAttempts) * 60);
      }
      if (attempts >= maxAttempts && !videoUrl) {
        throw new Error('Render timed out');
      }
    } catch (e: any) {
      console.error('[AudioUploadTalkingHead] generate error', e);
      toast({ title: 'Generation failed', description: e?.message || 'Unknown error', variant: 'destructive' });
    } finally {
      setIsGenerating(false);
    }
  };

  const tier = audioDuration <= HD_MAX_SECONDS ? 'HD' : 'Standard';

  return (
    <div className="space-y-5">
      <Card>
        <CardContent className="pt-6 space-y-5">
          <div className="space-y-2">
            <Label className="text-sm font-semibold flex items-center gap-2">
              <Mic className="w-4 h-4 text-primary" /> 1. Upload your narration
            </Label>
            <p className="text-xs text-muted-foreground">MP3, WAV, or M4A · max {MAX_AUDIO_MB}MB · up to {MAX_AUDIO_SECONDS}s.</p>
            <input
              ref={audioInputRef}
              type="file"
              accept="audio/*"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) onAudioPick(f); }}
            />
            {!audioFile ? (
              <button
                type="button"
                onClick={() => audioInputRef.current?.click()}
                className="w-full border-2 border-dashed border-border rounded-lg p-6 hover:border-primary/50 hover:bg-primary/5 transition-colors flex flex-col items-center gap-2"
              >
                <Upload className="w-6 h-6 text-muted-foreground" />
                <span className="text-sm font-medium">Click to upload audio</span>
              </button>
            ) : (
              <div className="border border-border rounded-lg p-3 space-y-2 bg-muted/30">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <Mic className="w-4 h-4 text-primary shrink-0" />
                    <span className="text-sm truncate">{audioFile.name}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge variant="secondary" className="gap-1">
                      {Math.round(audioDuration)}s
                    </Badge>
                    <Badge variant={tier === 'HD' ? 'default' : 'outline'} className="gap-1">
                      {tier === 'HD' ? <Sparkles className="w-3 h-3" /> : <Zap className="w-3 h-3" />} {tier}
                    </Badge>
                    <Button size="icon" variant="ghost" onClick={() => { setAudioFile(null); setAudioPreviewUrl(null); setAudioDuration(0); }}>
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
                {audioPreviewUrl && <audio src={audioPreviewUrl} controls className="w-full h-8" />}
                <p className="text-[11px] text-muted-foreground">
                  {tier === 'HD'
                    ? 'Will render with infinitetalk-HD (highest fidelity).'
                    : 'Will render with infinitetalk standard (lower cost, longer clips).'}
                </p>
              </div>
            )}
          </div>

          {/* Portrait */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold flex items-center gap-2">
              <User className="w-4 h-4 text-primary" /> 2. Choose who appears on camera
            </Label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setPortraitMode('twin')}
                className={cn(
                  'rounded-lg border p-2.5 text-left transition-colors',
                  portraitMode === 'twin' ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/40'
                )}
              >
                <div className="text-xs font-semibold">My AI Twin</div>
                <div className="text-[11px] text-muted-foreground">Use saved character</div>
              </button>
              <button
                type="button"
                onClick={() => setPortraitMode('upload')}
                className={cn(
                  'rounded-lg border p-2.5 text-left transition-colors',
                  portraitMode === 'upload' ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/40'
                )}
              >
                <div className="text-xs font-semibold">Upload photo</div>
                <div className="text-[11px] text-muted-foreground">One-off portrait</div>
              </button>
            </div>

            {portraitMode === 'twin' ? (
              <div>
                {loadingTwins ? (
                  <div className="text-xs text-muted-foreground py-3">Loading twins...</div>
                ) : twins.length === 0 ? (
                  <div className="text-xs text-muted-foreground py-3">No AI Twins yet. Create one in the AI Twin page, or upload a photo instead.</div>
                ) : (
                  <div className="grid grid-cols-4 gap-2 max-h-48 overflow-y-auto p-1">
                    {twins.map((t: any) => {
                      const img = t.reference_images?.[0] || t.first_image;
                      const active = selectedTwinId === t.id;
                      return (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => setSelectedTwinId(t.id)}
                          className={cn(
                            'aspect-square rounded-lg overflow-hidden border-2 transition-all relative',
                            active ? 'border-primary ring-2 ring-primary/30' : 'border-transparent hover:border-border'
                          )}
                        >
                          {img ? (
                            <img src={img} alt={t.name} className="w-full h-full object-cover" loading="lazy" />
                          ) : (
                            <div className="w-full h-full bg-muted flex items-center justify-center"><User className="w-5 h-5 text-muted-foreground" /></div>
                          )}
                          <div className="absolute bottom-0 inset-x-0 bg-black/60 text-white text-[10px] py-0.5 px-1 truncate">{t.name}</div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : (
              <div>
                <input
                  ref={portraitInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) onPortraitPick(f); }}
                />
                {!portraitPreview ? (
                  <button
                    type="button"
                    onClick={() => portraitInputRef.current?.click()}
                    className="w-full border-2 border-dashed border-border rounded-lg p-6 hover:border-primary/50 hover:bg-primary/5 transition-colors flex flex-col items-center gap-2"
                  >
                    <ImageIcon className="w-6 h-6 text-muted-foreground" />
                    <span className="text-sm font-medium">Upload portrait (JPG/PNG)</span>
                  </button>
                ) : (
                  <div className="flex items-center gap-3 border border-border rounded-lg p-2 bg-muted/30">
                    <img src={portraitPreview} alt="portrait" className="w-16 h-16 rounded-md object-cover" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm truncate">{portraitFile?.name}</div>
                      <div className="text-[11px] text-muted-foreground">{((portraitFile?.size || 0) / 1024 / 1024).toFixed(2)} MB</div>
                    </div>
                    <Button size="icon" variant="ghost" onClick={() => { setPortraitFile(null); setPortraitPreview(null); }}>
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Aspect ratio */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold">3. Format</Label>
            <PodcastAspectRatioPicker value={aspectRatio} onChange={setAspectRatio} />
          </div>

          {/* Generate */}
          <Button
            onClick={handleGenerate}
            disabled={isGenerating || !audioFile || (portraitMode === 'twin' ? !selectedTwinId : !portraitFile)}
            className="w-full"
            size="lg"
          >
            {isGenerating ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Generating...</>
            ) : (
              <><Sparkles className="w-4 h-4 mr-2" /> Generate talking video</>
            )}
          </Button>

          {isGenerating && (
            <div className="space-y-2">
              <Progress value={progress} className="h-2" />
              <p className="text-xs text-muted-foreground">{progressStatus}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {videoUrl && (
        <Card className="border-primary/30">
          <CardContent className="pt-6 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Badge variant="default" className="gap-1">
                  {usedModel === 'infinitetalk-hd' ? <Sparkles className="w-3 h-3" /> : <Zap className="w-3 h-3" />}
                  Quality: {usedModel === 'infinitetalk-hd' ? 'HD' : 'Standard'}
                </Badge>
                <Badge variant="outline">{Math.round(audioDuration)}s</Badge>
              </div>
              <a href={videoUrl} download target="_blank" rel="noreferrer">
                <Button size="sm" variant="outline"><Download className="w-4 h-4 mr-1" /> Download</Button>
              </a>
            </div>
            <video src={videoUrl} controls className="w-full rounded-lg bg-black" />
          </CardContent>
        </Card>
      )}
    </div>
  );
};
