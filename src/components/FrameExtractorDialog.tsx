import React, { useRef, useState, useCallback, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Film, Loader2, Pause, Play, Scissors, SkipBack, SkipForward } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { useToast } from '@/hooks/use-toast';
import { extractBrollFrames } from '@/lib/extractBrollFrames';

interface FrameExtractorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  videoUrl: string;
  projectId?: string | null;
  projectLabel?: string;
}

const CLIP_DURATION = 3;

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

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isExtracting, setIsExtracting] = useState(false);

  useEffect(() => {
    if (!open) {
      setCurrentTime(0);
      setIsPlaying(false);
      setIsExtracting(false);
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
    setIsPlaying(!isPlaying);
  }, [isPlaying]);

  const clipStart = useMemo(() => {
    const maxStart = Math.max(0, duration - CLIP_DURATION);
    return Math.min(maxStart, Math.max(0, currentTime - CLIP_DURATION / 2));
  }, [currentTime, duration]);

  const clipEnd = useMemo(() => Math.min(duration, clipStart + CLIP_DURATION), [clipStart, duration]);

  const saveClips = useCallback(async ({ times, count, closeOnSuccess }: { times?: number[]; count?: number; closeOnSuccess?: boolean }) => {
    if (!user) return;
    setIsExtracting(true);
    videoRef.current?.pause();
    setIsPlaying(false);

    try {
      const saved = await extractBrollFrames({
        videoUrl,
        userId: user.id,
        projectId: projectId || null,
        label: projectLabel || 'B-Roll',
        count: count ?? 6,
        clipDuration: CLIP_DURATION,
        times,
      });

      if (!saved.length) {
        throw new Error('No playable clips were saved from this video');
      }

      toast({
        title: `Saved ${saved.length} B-Roll clip${saved.length !== 1 ? 's' : ''}`,
        description: 'Open Chatcut → Source Clips to preview and add them without regenerating.',
      });

      if (closeOnSuccess) onOpenChange(false);
    } catch (e: any) {
      toast({
        title: 'Clip extraction failed',
        description: e?.message || 'Could not save playable B-Roll clips',
        variant: 'destructive',
      });
    } finally {
      setIsExtracting(false);
    }
  }, [onOpenChange, projectId, projectLabel, toast, user, videoUrl]);

  const formatTime = (t: number) => {
    const m = Math.floor(t / 60);
    const s = Math.floor(t % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Extract B-Roll Clips</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-lg border border-border bg-muted/20 p-3 text-sm text-muted-foreground">
            <div className="flex items-start gap-2">
              <Film className="mt-0.5 h-4 w-4 text-primary" />
              <div>
                <p className="font-medium text-foreground">This saves playable video clips — not static images.</p>
                <p>Each extract creates a {CLIP_DURATION}s source clip that shows up in Chatcut under <span className="font-medium text-foreground">Source Clips</span> so you can preview it and place it directly on the timeline.</p>
              </div>
            </div>
          </div>

          <div className="relative rounded-lg overflow-hidden bg-muted">
            <video
              ref={videoRef}
              src={videoUrl}
              crossOrigin="anonymous"
              className="w-full h-full max-h-[45vh] object-contain"
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

          <div className="flex items-center justify-center gap-2 flex-wrap">
            <Button variant="outline" size="icon" onClick={() => seekTo(currentTime - 1)}>
              <SkipBack className="w-4 h-4" />
            </Button>
            <Button variant="default" size="icon" onClick={togglePlay} className="w-12 h-12">
              {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
            </Button>
            <Button variant="outline" size="icon" onClick={() => seekTo(currentTime + 1)}>
              <SkipForward className="w-4 h-4" />
            </Button>
            <div className="w-px h-8 bg-border mx-1" />
            <Button
              onClick={() => saveClips({ times: [clipStart], count: 1, closeOnSuccess: false })}
              disabled={isExtracting || !duration || !user}
              className="gap-2"
            >
              {isExtracting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Scissors className="w-4 h-4" />}
              Extract Clip at Playhead
            </Button>
            <Button
              variant="secondary"
              onClick={() => saveClips({ count: 6, closeOnSuccess: true })}
              disabled={isExtracting || !duration || !user}
              className="gap-2"
            >
              {isExtracting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Film className="w-4 h-4" />}
              Auto-extract 6 Clips
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
