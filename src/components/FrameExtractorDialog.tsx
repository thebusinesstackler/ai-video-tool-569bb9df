import React, { useRef, useState, useCallback, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Checkbox } from '@/components/ui/checkbox';
import { Film, Loader2, Save, Sparkles, X } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { saveBrollClips, type PlannedClip } from '@/lib/extractBrollFrames';

interface FrameExtractorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  videoUrl: string;
  projectId?: string | null;
  projectLabel?: string;
}

const MIN_CLIP = 1.2;
const MAX_CLIP = 6;
const FALLBACK_CLIP = 3;

interface PendingClip extends PlannedClip {
  id: string;
  selected: boolean;
  reason?: string;
}

const formatTime = (t: number) => {
  if (!isFinite(t)) return '0:00';
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
};

function probeDuration(url: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const v = document.createElement('video');
    v.preload = 'metadata';
    v.muted = true;
    v.crossOrigin = 'anonymous';
    const t = setTimeout(() => reject(new Error('Timed out reading video')), 15000);
    v.onloadedmetadata = () => {
      clearTimeout(t);
      const d = v.duration;
      v.src = '';
      if (!d || !isFinite(d)) reject(new Error('Video has no duration'));
      else resolve(d);
    };
    v.onerror = () => { clearTimeout(t); reject(new Error('Could not load video')); };
    v.src = url;
  });
}

export const FrameExtractorDialog: React.FC<FrameExtractorDialogProps> = ({
  open,
  onOpenChange,
  videoUrl,
  projectId,
  projectLabel,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const { user } = useAuth();
  const { toast } = useToast();

  const [pending, setPending] = useState<PendingClip[]>([]);
  const [stage, setStage] = useState<'idle' | 'analyzing' | 'building' | 'done'>('idle');
  const [progressMsg, setProgressMsg] = useState('');
  const [progressPct, setProgressPct] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const startedRef = useRef(false);

  useEffect(() => {
    if (!open) {
      setPending([]);
      setStage('idle');
      setProgressMsg('');
      setProgressPct(0);
      setIsSaving(false);
      startedRef.current = false;
    }
  }, [open]);

  const buildClipsFromBreaks = useCallback((duration: number, breaks: number[]): PlannedClip[] => {
    // Build scene boundaries: 0, ...breaks, duration
    const boundaries = Array.from(new Set([0, ...breaks.filter((b) => b > 0 && b < duration), duration])).sort((a, b) => a - b);
    const label = projectLabel || 'B-Roll';
    const out: PlannedClip[] = [];
    for (let i = 0; i < boundaries.length - 1; i++) {
      const sceneStart = boundaries[i];
      const sceneEnd = boundaries[i + 1];
      const sceneLen = sceneEnd - sceneStart;
      if (sceneLen < MIN_CLIP) continue;
      const startT = +sceneStart.toFixed(2);
      // Cap each clip at MAX_CLIP seconds, centered slightly forward in the scene
      const endT = +Math.min(sceneEnd, sceneStart + MAX_CLIP).toFixed(2);
      const dur = +(endT - startT).toFixed(2);
      out.push({
        startT,
        endT,
        duration: dur,
        sourceUrl: videoUrl,
        label: `${label} scene @ ${startT.toFixed(1)}s`,
        trimmedUrl: `${videoUrl}#t=${startT},${endT}`,
      });
    }
    return out;
  }, [projectLabel, videoUrl]);

  const buildEvenFallback = useCallback((duration: number): PlannedClip[] => {
    // For very short videos, just take the whole thing as one clip
    if (duration <= MAX_CLIP + 0.5) {
      const startT = 0;
      const endT = +duration.toFixed(2);
      return [{
        startT,
        endT,
        duration: +endT.toFixed(2),
        sourceUrl: videoUrl,
        label: `${projectLabel || 'B-Roll'} full clip`,
        trimmedUrl: `${videoUrl}#t=${startT},${endT}`,
      }];
    }
    // Otherwise carve into ~MAX_CLIP-second non-overlapping chunks
    const out: PlannedClip[] = [];
    const chunkLen = MAX_CLIP;
    let t = 0;
    while (t < duration - MIN_CLIP) {
      const startT = +t.toFixed(2);
      const endT = +Math.min(duration, t + chunkLen).toFixed(2);
      out.push({
        startT,
        endT,
        duration: +(endT - startT).toFixed(2),
        sourceUrl: videoUrl,
        label: `${projectLabel || 'B-Roll'} chunk @ ${startT.toFixed(1)}s`,
        trimmedUrl: `${videoUrl}#t=${startT},${endT}`,
      });
      t += chunkLen;
    }
    return out;
  }, [projectLabel, videoUrl]);

  const runSmartExtract = useCallback(async () => {
    if (startedRef.current) return;
    startedRef.current = true;
    setStage('analyzing');
    setProgressMsg('Reading the video…');
    setProgressPct(10);

    try {
      const duration = await probeDuration(videoUrl);
      setProgressMsg('AI is finding scene cuts…');
      setProgressPct(35);

      let breaks: number[] = [];
      try {
        const { data, error } = await supabase.functions.invoke('detect-scenes', {
          body: { videoUrl, duration },
        });
        if (error) throw error;
        if (data?.success && Array.isArray(data.sceneBreaks)) {
          breaks = data.sceneBreaks
            .map((b: any) => Number(b.timestamp))
            .filter((n: number) => Number.isFinite(n) && n > 0 && n < duration);
        }
      } catch (e) {
        console.warn('[FrameExtractor] scene detection failed, falling back', e);
      }

      setStage('building');
      setProgressMsg('Building clips…');
      setProgressPct(75);

      let planned = breaks.length > 0
        ? buildClipsFromBreaks(duration, breaks)
        : buildEvenFallback(duration);

      // Dedupe overlapping clips defensively
      planned = planned.filter((c, i, arr) => {
        if (i === 0) return true;
        return c.startT - arr[i - 1].startT >= MIN_CLIP;
      });

      if (planned.length === 0) {
        planned = buildEvenFallback(duration);
      }

      const items: PendingClip[] = planned.map((p, i) => ({
        ...p,
        id: `${Date.now()}-${i}`,
        selected: true,
      }));

      setPending(items);
      setStage('done');
      setProgressPct(100);
      setProgressMsg(`Found ${items.length} scene${items.length !== 1 ? 's' : ''}.`);
      toast({
        title: `Detected ${items.length} scene${items.length !== 1 ? 's' : ''}`,
        description: breaks.length > 0
          ? 'Picked one clip per scene. Uncheck any you don\'t want.'
          : 'AI scene detection unavailable — split the video into evenly chunked clips instead.',
      });
    } catch (e: any) {
      setStage('idle');
      startedRef.current = false;
      toast({
        title: 'Smart extract failed',
        description: e?.message || 'Could not analyze video',
        variant: 'destructive',
      });
    }
  }, [buildClipsFromBreaks, buildEvenFallback, toast, videoUrl]);

  // Auto-run when dialog opens
  useEffect(() => {
    if (open && stage === 'idle' && !startedRef.current && videoUrl) {
      runSmartExtract();
    }
  }, [open, stage, videoUrl, runSmartExtract]);

  const togglePending = useCallback((id: string) => {
    setPending((prev) => prev.map((c) => (c.id === id ? { ...c, selected: !c.selected } : c)));
  }, []);

  const removePending = useCallback((id: string) => {
    setPending((prev) => prev.filter((c) => c.id !== id));
  }, []);

  const selectedCount = pending.filter((c) => c.selected).length;

  const saveSelected = useCallback(async () => {
    if (!user) return;
    const toSave = pending.filter((c) => c.selected);
    if (toSave.length === 0) {
      toast({ title: 'Nothing selected', description: 'Tick the clips you want to save first.' });
      return;
    }
    setIsSaving(true);
    try {
      const saved = await saveBrollClips(user.id, projectId || null, toSave);
      if (!saved.length) throw new Error('No clips were saved');
      toast({
        title: `Saved ${saved.length} B-Roll clip${saved.length !== 1 ? 's' : ''}`,
        description: 'Open Chatcut → Source Clips to drop them on the timeline.',
      });
      onOpenChange(false);
    } catch (e: any) {
      toast({ title: 'Save failed', description: e?.message || 'Could not save clips', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  }, [onOpenChange, pending, projectId, toast, user]);

  const isWorking = stage === 'analyzing' || stage === 'building';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            Smart B-Roll Extract
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-lg border border-border bg-muted/20 p-3 text-sm text-muted-foreground">
            <div className="flex items-start gap-2">
              <Film className="mt-0.5 h-4 w-4 text-primary" />
              <div>
                <p className="font-medium text-foreground">AI splits the video into scene-based clips.</p>
                <p>Each scene becomes one playable B-Roll clip (up to {MAX_CLIP}s). Saved clips appear in Chatcut → <span className="font-medium text-foreground">Source Clips</span>.</p>
              </div>
            </div>
          </div>

          <video
            ref={videoRef}
            src={videoUrl}
            crossOrigin="anonymous"
            controls
            className="w-full max-h-[40vh] rounded-lg bg-muted object-contain"
            playsInline
          />

          {isWorking && (
            <div className="space-y-2 rounded-lg border border-border bg-muted/30 p-4">
              <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                <Loader2 className="w-4 h-4 animate-spin text-primary" />
                {progressMsg}
              </div>
              <Progress value={progressPct} />
            </div>
          )}

          {stage === 'done' && pending.length === 0 && (
            <div className="rounded-lg border border-border bg-muted/30 p-4 text-sm text-muted-foreground">
              No scenes were detected in this video.
              <Button size="sm" variant="outline" className="ml-3" onClick={() => { startedRef.current = false; setStage('idle'); }}>
                Try again
              </Button>
            </div>
          )}

          {pending.length > 0 && (
            <div className="rounded-lg border border-border p-3 space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <h3 className="text-sm font-semibold text-foreground">
                    Scenes ({pending.length}) — {selectedCount} selected
                  </h3>
                  <p className="text-xs text-muted-foreground">Hover to preview. Uncheck any you don't want.</p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => { setPending([]); startedRef.current = false; setStage('idle'); }}
                    disabled={isSaving}
                  >
                    Re-analyze
                  </Button>
                  <Button
                    size="sm"
                    onClick={saveSelected}
                    disabled={isSaving || selectedCount === 0}
                    className="gap-2"
                  >
                    {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    Save {selectedCount} to Library
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {pending.map((clip) => (
                  <div
                    key={clip.id}
                    className={`relative rounded-md overflow-hidden border-2 transition-colors ${
                      clip.selected ? 'border-primary' : 'border-border'
                    }`}
                  >
                    <video
                      src={clip.trimmedUrl}
                      className="w-full aspect-video object-cover bg-muted"
                      muted
                      loop
                      playsInline
                      preload="metadata"
                      onMouseEnter={(e) => { (e.currentTarget as HTMLVideoElement).play().catch(() => {}); }}
                      onMouseLeave={(e) => { const v = e.currentTarget as HTMLVideoElement; v.pause(); v.currentTime = clip.startT + 0.05; }}
                    />
                    <button
                      type="button"
                      onClick={() => removePending(clip.id)}
                      className="absolute top-1 right-1 h-6 w-6 rounded-full bg-background/90 hover:bg-destructive hover:text-destructive-foreground flex items-center justify-center transition-colors"
                      aria-label="Remove clip"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-background/95 to-background/0 p-2 flex items-center gap-2">
                      <Checkbox
                        checked={clip.selected}
                        onCheckedChange={() => togglePending(clip.id)}
                        id={`pick-${clip.id}`}
                      />
                      <label htmlFor={`pick-${clip.id}`} className="text-xs font-medium text-foreground cursor-pointer flex-1 truncate">
                        {formatTime(clip.startT)} → {formatTime(clip.endT)} · {clip.duration.toFixed(1)}s
                      </label>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
