import { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Loader2, RotateCw, Mic, Wand2, Film } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';
import { useToast } from '@/hooks/use-toast';
import { useAITwins } from '@/hooks/useAITwins';
import { buildVoicePayload } from '@/lib/voiceUtils';

type Mode = 'lipsync' | 'styleref';

interface Props {
  videoUrl: string | null | undefined;
  defaultScript: string;
  aspectRatio?: '9:16' | '16:9' | '1:1';
  defaultTwinId?: string | null;
  source?: string;
  trigger?: React.ReactNode;
  onComplete?: (newVideoUrl: string) => void;
}

function estimateDurationSec(text: string): number {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(3, Math.min(60, Math.round(words / 2.5) + 1));
}

function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function RegenerateVideoDialog({
  videoUrl,
  defaultScript,
  aspectRatio = '9:16',
  defaultTwinId,
  source = 'reels',
  trigger,
  onComplete,
}: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const { twins } = useAITwins();

  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>('lipsync');
  const [script, setScript] = useState(defaultScript || '');
  const [twinId, setTwinId] = useState<string | null>(defaultTwinId || null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<string>('');

  const eligibleTwins = useMemo(
    () => twins.filter(t => !!t.voice_cloning_key && (t.reference_images?.[0])),
    [twins],
  );

  useEffect(() => {
    if (open) {
      setScript(defaultScript || '');
      if (!twinId) {
        setTwinId(defaultTwinId || eligibleTwins[0]?.id || null);
      }
    }
  }, [open, defaultScript, defaultTwinId, eligibleTwins, twinId]);

  const selectedTwin = useMemo(() => eligibleTwins.find(t => t.id === twinId) || null, [eligibleTwins, twinId]);

  const canRun =
    !!videoUrl &&
    !!user &&
    !!selectedTwin &&
    script.trim().length > 4 &&
    !busy;

  const run = async () => {
    if (!videoUrl || !selectedTwin || !user) return;
    setBusy(true);
    setProgress(5);
    setStatus('Generating voice from script…');

    try {
      // 1. TTS with cloned voice (same engine as Movie Scene Creator)
      const ttsBody = buildVoicePayload(script.trim(), selectedTwin);
      const { data: ttsData, error: ttsErr } = await supabase.functions.invoke('text-to-speech', { body: ttsBody });
      if (ttsErr || !ttsData?.audioContent) {
        throw new Error(ttsErr?.message || 'Voice generation failed');
      }
      setProgress(20);
      setStatus('Uploading audio…');

      const bytes = b64ToBytes(ttsData.audioContent);
      const audioPath = `${user.id}/regen/${Date.now()}.mp3`;
      const { error: upErr } = await supabase.storage.from('reels').upload(audioPath, bytes, {
        contentType: 'audio/mpeg',
        upsert: true,
      });
      if (upErr) throw new Error(`Audio upload failed: ${upErr.message}`);
      const { data: pub } = supabase.storage.from('reels').getPublicUrl(audioPath);
      const audioUrl = pub.publicUrl;
      const durationSec = estimateDurationSec(script);

      // 2. Kick off the appropriate WaveSpeed task
      setProgress(35);
      let taskId: string | null = null;

      if (mode === 'lipsync') {
        setStatus('Re-lip-syncing to new script (infinitetalk-hd)…');
        const portrait = selectedTwin.reference_images?.[0];
        if (!portrait) throw new Error('Selected AI Twin has no portrait image');
        const { data: thData, error: thErr } = await supabase.functions.invoke('generate-talking-head-from-audio', {
          body: {
            audioUrl,
            portraitUrl: portrait,
            durationSec,
            aspectRatio,
            source,
          },
        });
        if (thErr || !thData?.taskId) throw new Error(thErr?.message || 'Lip-sync task failed to start');
        taskId = thData.taskId;
      } else {
        setStatus('Regenerating video with style reference (Wan 2.7 video-edit)…');
        const { data: wsData, error: wsErr } = await supabase.functions.invoke('wavespeed-video', {
          body: {
            action: 'create',
            model: 'alibaba/wan-2.7/video-edit',
            videoUrl,
            prompt: script.trim().slice(0, 600),
            aspectRatio,
            duration: Math.min(10, durationSec),
            source,
          },
        });
        if (wsErr || !wsData?.taskId) throw new Error(wsErr?.message || 'Video-edit task failed to start');
        taskId = wsData.taskId;
      }

      // 3. Poll status
      setProgress(45);
      let resultUrl: string | null = null;
      const started = Date.now();
      const TIMEOUT_MS = 8 * 60 * 1000;
      while (Date.now() - started < TIMEOUT_MS) {
        await new Promise(r => setTimeout(r, 4000));
        const { data: st } = await supabase.functions.invoke('wavespeed-video', {
          body: { action: 'status', taskId },
        });
        const elapsed = (Date.now() - started) / TIMEOUT_MS;
        setProgress(45 + Math.min(40, elapsed * 40));
        if (st?.status === 'completed' && st?.videoUrl) { resultUrl = st.videoUrl; break; }
        if (st?.status === 'failed') throw new Error(st?.error || 'Video generation failed');
      }
      if (!resultUrl) throw new Error('Video generation timed out');

      // 4. For styleref, mux the new TTS audio on top of the regenerated visual
      let finalUrl = resultUrl;
      if (mode === 'styleref') {
        setProgress(88);
        setStatus('Adding voice track to regenerated video…');
        const sizeMap: Record<string, [number, number]> = {
          '9:16': [1080, 1920], '1:1': [1080, 1080], '16:9': [1920, 1080],
        };
        const [w, h] = sizeMap[aspectRatio] || [1080, 1920];
        const { data: stitchData, error: stitchErr } = await supabase.functions.invoke('creatomate-stitch', {
          body: {
            clips: [{ url: resultUrl, duration: durationSec, audioDuration: durationSec }],
            width: w,
            height: h,
            audioUrl,
          },
        });
        if (!stitchErr && stitchData?.success && stitchData?.renderId) {
          for (let i = 0; i < 60; i++) {
            await new Promise(r => setTimeout(r, 3000));
            const { data: rs } = await supabase.functions.invoke('creatomate-status', {
              body: { renderId: stitchData.renderId },
            });
            if (rs?.status === 'succeeded' && rs?.url) { finalUrl = rs.url; break; }
            if (rs?.status === 'failed') break;
          }
        }
      }

      setProgress(100);
      setStatus('Done!');
      toast({ title: 'Regenerated', description: 'Your video has been regenerated with the new voiceover.' });
      onComplete?.(finalUrl);
      setOpen(false);
    } catch (err: any) {
      console.error('[RegenerateVideoDialog]', err);
      toast({ title: 'Regeneration failed', description: err?.message || 'Unknown error', variant: 'destructive' });
    } finally {
      setBusy(false);
      setProgress(0);
      setStatus('');
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!busy) setOpen(v); }}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm" disabled={!videoUrl}>
            <RotateCw className="w-4 h-4 mr-2" />
            Regenerate (V2V)
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Regenerate video from script</DialogTitle>
          <DialogDescription>
            Generates a fresh voiceover from the script using your AI Twin's cloned voice (same engine as Movie Scene Creator), then re-renders the video.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)}>
          <TabsList className="grid grid-cols-2 w-full">
            <TabsTrigger value="lipsync">
              <Mic className="w-3.5 h-3.5 mr-1.5" />
              Re-lip-sync
            </TabsTrigger>
            <TabsTrigger value="styleref">
              <Film className="w-3.5 h-3.5 mr-1.5" />
              Style reference
            </TabsTrigger>
          </TabsList>
          <TabsContent value="lipsync" className="text-xs text-muted-foreground pt-2">
            Uses your AI Twin portrait + new voiceover via <Badge variant="outline" className="text-[10px]">infinitetalk-hd</Badge> for precise lip-sync.
          </TabsContent>
          <TabsContent value="styleref" className="text-xs text-muted-foreground pt-2">
            Feeds the existing video into <Badge variant="outline" className="text-[10px]">Wan 2.7 video-edit</Badge> and overlays the new voiceover. Best for cinematic shots.
          </TabsContent>
        </Tabs>

        <div className="space-y-2">
          <Label className="text-xs">AI Twin voice</Label>
          <Select value={twinId || ''} onValueChange={setTwinId} disabled={busy}>
            <SelectTrigger>
              <SelectValue placeholder="Pick a twin with a cloned voice" />
            </SelectTrigger>
            <SelectContent>
              {eligibleTwins.length === 0 && (
                <SelectItem value="__none__" disabled>No twins with cloned voices</SelectItem>
              )}
              {eligibleTwins.map(t => (
                <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label className="text-xs">Script (the new voiceover)</Label>
          <Textarea
            value={script}
            onChange={(e) => setScript(e.target.value)}
            rows={6}
            placeholder="The script your video will speak…"
            disabled={busy}
          />
          <p className="text-[10px] text-muted-foreground">
            ~{estimateDurationSec(script)}s estimated · {script.trim().split(/\s+/).filter(Boolean).length} words
          </p>
        </div>

        {busy && (
          <div className="space-y-1.5">
            <Progress value={progress} className="h-2" />
            <p className="text-[11px] text-muted-foreground">{status}</p>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={() => setOpen(false)} disabled={busy}>Cancel</Button>
          <Button onClick={run} disabled={!canRun}>
            {busy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Wand2 className="w-4 h-4 mr-2" />}
            {busy ? 'Regenerating…' : 'Regenerate video'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
