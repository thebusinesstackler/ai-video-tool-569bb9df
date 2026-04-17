import React, { useRef, useState, useCallback, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Checkbox } from '@/components/ui/checkbox';
import { Film, Loader2, Pause, Play, Plus, Save, Scissors, SkipBack, SkipForward, Sparkles, X } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { useToast } from '@/hooks/use-toast';
import { planBrollClips, saveBrollClips, type PlannedClip } from '@/lib/extractBrollFrames';

interface FrameExtractorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  videoUrl: string;
  projectId?: string | null;
  projectLabel?: string;
}

const CLIP_DURATION = 3;

interface PendingClip extends PlannedClip {
  id: string;
  selected: boolean;
}

const formatTime = (t: number) => {
  if (!isFinite(t)) return '0:00';
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
};

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

  const [mode, setMode] = useState<'manual' | 'auto'>('manual');
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [pending, setPending] = useState<PendingClip[]>([]);
  const [extractProgress, setExtractProgress] = useState<{ done: number; total: number } | null>(null);
  const [isAutoExtracting, setIsAutoExtracting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!open) {
      setCurrentTime(0);
      setIsPlaying(false);
      setPending([]);
      setExtractProgress(null);
      setIsAutoExtracting(false);
      setIsSaving(false);
      setMode('manual');
    }
  }, [open]);

  const seekTo = useCallback((time: number) => {
    if (!videoRef.current) return;
    const nextTime = Math.max(0, Math.min(duration || 0, time));
    videoRef.current.currentTime = nextTime;
    setCurrentTime(nextTime);
  }, [duration]);

  const togglePlay = useCallback(() => {
    if (!videoRef.current) return;
    if (isPlaying) videoRef.current.pause();
    else videoRef.current.play();
  }, [isPlaying]);

  const clipStart = useMemo(() => {
    const maxStart = Math.max(0, duration - CLIP_DURATION);
    return Math.min(maxStart, Math.max(0, currentTime - CLIP_DURATION / 2));
  }, [currentTime, duration]);

  const clipEnd = useMemo(() => Math.min(duration, clipStart + CLIP_DURATION), [clipStart, duration]);

  const addManualClip = useCallback(async () => {
    if (!duration) return;
    try {
      const [planned] = await planBrollClips({
        videoUrl,
        label: projectLabel || 'B-Roll',
        clipDuration: CLIP_DURATION,
        times: [clipStart],
      });
      if (!planned) return;
      setPending((prev) => [
        ...prev,
        { ...planned, id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, selected: true },
      ]);
      toast({ title: 'Clip added', description: `${formatTime(planned.startT)} → ${formatTime(planned.endT)} ready to save.` });
    } catch (e: any) {
      toast({ title: 'Could not add clip', description: e?.message || 'Failed to plan clip', variant: 'destructive' });
    }
  }, [clipStart, duration, projectLabel, toast, videoUrl]);

  const runAutoExtract = useCallback(async () => {
    setIsAutoExtracting(true);
    setExtractProgress({ done: 0, total: 6 });
    videoRef.current?.pause();
    try {
      const planned = await planBrollClips({
        videoUrl,
        label: projectLabel || 'B-Roll',
        clipDuration: CLIP_DURATION,
        count: 6,
      });
      // Animate progress so user sees it filling — planning is fast, so simulate per-clip steps.
      for (let i = 0; i < planned.length; i++) {
        await new Promise((r) => setTimeout(r, 120));
        setExtractProgress({ done: i + 1, total: planned.length });
      }
      const newClips: PendingClip[] = planned.map((p, i) => ({
        ...p,
        id: `${Date.now()}-${i}`,
        selected: true,
      }));
      setPending((prev) => [...prev, ...newClips]);
      toast({
        title: `Found ${newClips.length} clips`,
        description: 'Preview them below and pick the ones you want to save.',
      });
    } catch (e: any) {
      toast({ title: 'Auto-extract failed', description: e?.message || 'Could not plan clips', variant: 'destructive' });
    } finally {
      setIsAutoExtracting(false);
      setExtractProgress(null);
    }
  }, [projectLabel, toast, videoUrl]);

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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Extract B-Roll Clips</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-lg border border-border bg-muted/20 p-3 text-sm text-muted-foreground">
            <div className="flex items-start gap-2">
              <Film className="mt-0.5 h-4 w-4 text-primary" />
              <div>
                <p className="font-medium text-foreground">These are playable video clips, not still frames.</p>
                <p>Each clip is a {CLIP_DURATION}s window of the source video. Saved clips show up in Chatcut → <span className="font-medium text-foreground">Source Clips</span>.</p>
              </div>
            </div>
          </div>

          <div className="relative rounded-lg overflow-hidden bg-muted">
            <video
              ref={videoRef}
              src={videoUrl}
              crossOrigin="anonymous"
              className="w-full h-full max-h-[40vh] object-contain"
              onTimeUpdate={() => videoRef.current && setCurrentTime(videoRef.current.currentTime)}
              onLoadedMetadata={() => videoRef.current && setDuration(videoRef.current.duration)}
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
              playsInline
            />
            <div className="absolute top-2 right-2 rounded bg-background/90 px-2 py-1 text-xs font-mono text-foreground shadow-sm">
              {formatTime(currentTime)} / {formatTime(duration)}
            </div>
            <div className="absolute bottom-2 left-2 rounded bg-background/90 px-2 py-1 text-xs text-foreground shadow-sm">
              Clip window: {formatTime(clipStart)} → {formatTime(clipEnd)}
            </div>
          </div>

          <div className="px-2">
            <Slider
              value={[currentTime]}
              min={0}
              max={duration || 1}
              step={0.01}
              onValueChange={(v) => seekTo(v[0])}
            />
          </div>

          <div className="flex items-center justify-center gap-2">
            <Button variant="outline" size="icon" onClick={() => seekTo(currentTime - 1)}>
              <SkipBack className="w-4 h-4" />
            </Button>
            <Button variant="default" size="icon" onClick={togglePlay} className="w-12 h-12">
              {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
            </Button>
            <Button variant="outline" size="icon" onClick={() => seekTo(currentTime + 1)}>
              <SkipForward className="w-4 h-4" />
            </Button>
          </div>

          <Tabs value={mode} onValueChange={(v) => setMode(v as 'manual' | 'auto')}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="manual" className="gap-2"><Scissors className="w-4 h-4" /> Manual: Pick Moments</TabsTrigger>
              <TabsTrigger value="auto" className="gap-2"><Sparkles className="w-4 h-4" /> Auto: Smart Pick</TabsTrigger>
            </TabsList>

            <TabsContent value="manual" className="mt-3 space-y-3">
              <p className="text-sm text-muted-foreground">
                Scrub the video to a moment you like, then add it. Each click captures a {CLIP_DURATION}-second window centered on the playhead.
              </p>
              <Button onClick={addManualClip} disabled={!duration || !user} className="gap-2">
                <Plus className="w-4 h-4" />
                Add Clip at {formatTime(clipStart)}
              </Button>
            </TabsContent>

            <TabsContent value="auto" className="mt-3 space-y-3">
              <p className="text-sm text-muted-foreground">
                We'll grab 6 evenly-spaced {CLIP_DURATION}-second clips across the whole video so you can quickly pick favorites.
              </p>
              <Button onClick={runAutoExtract} disabled={!duration || !user || isAutoExtracting} className="gap-2">
                {isAutoExtracting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                Auto-extract 6 Clips
              </Button>
              {extractProgress && (
                <div className="space-y-1.5">
                  <Progress value={(extractProgress.done / extractProgress.total) * 100} />
                  <p className="text-xs text-muted-foreground">
                    Extracting clip {extractProgress.done} of {extractProgress.total}…
                  </p>
                </div>
              )}
            </TabsContent>
          </Tabs>

          {pending.length > 0 && (
            <div className="rounded-lg border border-border p-3 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-foreground">
                  Extracted clips ({pending.length}) — {selectedCount} selected
                </h3>
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
                      onMouseLeave={(e) => { const v = e.currentTarget as HTMLVideoElement; v.pause(); v.currentTime = 0.1; }}
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
                        {formatTime(clip.startT)} → {formatTime(clip.endT)}
                      </label>
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">Hover a clip to preview. Uncheck the ones you don't want, then save.</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
