import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Play, Pause, SkipBack, SkipForward, Scissors, ZoomIn, ZoomOut, Download } from 'lucide-react';
import { cn } from '@/lib/utils';

interface VideoRepoTimelineProps {
  videoUrl: string;
  onClose: () => void;
}

const SEGMENT_COLORS = ['#7c3aed', '#f59e0b'];

export const VideoRepoTimeline = ({ videoUrl, onClose }: VideoRepoTimelineProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd] = useState(0);
  const [isDragging, setIsDragging] = useState<'playhead' | 'trimStart' | 'trimEnd' | null>(null);

  // Assume two equal segments for the stitched video
  const segmentMidpoint = duration / 2;

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const onLoaded = () => {
      setDuration(video.duration);
      setTrimEnd(video.duration);
    };
    const onTimeUpdate = () => setCurrentTime(video.currentTime);
    const onEnded = () => setIsPlaying(false);
    video.addEventListener('loadedmetadata', onLoaded);
    video.addEventListener('timeupdate', onTimeUpdate);
    video.addEventListener('ended', onEnded);
    return () => {
      video.removeEventListener('loadedmetadata', onLoaded);
      video.removeEventListener('timeupdate', onTimeUpdate);
      video.removeEventListener('ended', onEnded);
    };
  }, []);

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    if (isPlaying) {
      video.pause();
    } else {
      if (video.currentTime < trimStart || video.currentTime >= trimEnd) {
        video.currentTime = trimStart;
      }
      video.play();
    }
    setIsPlaying(!isPlaying);
  };

  // Pause when reaching trim end
  useEffect(() => {
    if (isPlaying && currentTime >= trimEnd) {
      videoRef.current?.pause();
      setIsPlaying(false);
    }
  }, [currentTime, trimEnd, isPlaying]);

  const seekTo = (time: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

  const formatTime = (t: number) => {
    const m = Math.floor(t / 60);
    const s = Math.floor(t % 60);
    const ms = Math.floor((t % 1) * 10);
    return `${m}:${s.toString().padStart(2, '0')}.${ms}`;
  };

  const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!timelineRef.current || !duration) return;
    const rect = timelineRef.current.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    seekTo(pct * duration);
  };

  const handleTimelineMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging || !timelineRef.current || !duration) return;
    const rect = timelineRef.current.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const time = pct * duration;
    if (isDragging === 'playhead') seekTo(time);
    else if (isDragging === 'trimStart') setTrimStart(Math.min(time, trimEnd - 0.5));
    else if (isDragging === 'trimEnd') setTrimEnd(Math.max(time, trimStart + 0.5));
  }, [isDragging, duration, trimEnd, trimStart]);

  const handleMouseUp = useCallback(() => setIsDragging(null), []);

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleTimelineMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleTimelineMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, handleTimelineMouseMove, handleMouseUp]);

  const playheadPct = duration ? (currentTime / duration) * 100 : 0;
  const trimStartPct = duration ? (trimStart / duration) * 100 : 0;
  const trimEndPct = duration ? (trimEnd / duration) * 100 : 100;
  const segmentMidPct = duration ? (segmentMidpoint / duration) * 100 : 50;

  return (
    <Card className="glass border-primary/20">
      <CardContent className="p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Scissors className="w-4 h-4 text-primary" />
            <span className="text-sm font-semibold text-foreground">Timeline Editor</span>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-[10px]">
              {formatTime(currentTime)} / {formatTime(duration)}
            </Badge>
            <Button size="sm" variant="ghost" onClick={onClose}>Close</Button>
          </div>
        </div>

        {/* Video preview */}
        <div className="flex justify-center">
          <video
            ref={videoRef}
            src={videoUrl}
            className="rounded-lg max-h-[300px] w-auto bg-black"
            onClick={togglePlay}
          />
        </div>

        {/* Transport controls */}
        <div className="flex items-center justify-center gap-2">
          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => seekTo(trimStart)}>
            <SkipBack className="w-4 h-4" />
          </Button>
          <Button size="icon" variant="default" className="h-10 w-10 rounded-full" onClick={togglePlay}>
            {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
          </Button>
          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => seekTo(trimEnd)}>
            <SkipForward className="w-4 h-4" />
          </Button>
          <div className="mx-2 h-4 w-px bg-border" />
          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setZoom(z => Math.max(0.5, z - 0.25))}>
            <ZoomOut className="w-4 h-4" />
          </Button>
          <span className="text-xs text-muted-foreground w-8 text-center">{Math.round(zoom * 100)}%</span>
          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setZoom(z => Math.min(4, z + 0.25))}>
            <ZoomIn className="w-4 h-4" />
          </Button>
        </div>

        {/* Timeline */}
        <div className="relative" style={{ overflowX: 'auto' }}>
          <div
            ref={timelineRef}
            className="relative h-20 rounded-lg cursor-pointer select-none"
            style={{ width: `${100 * zoom}%`, minWidth: '100%' }}
            onClick={handleTimelineClick}
          >
            {/* Segment backgrounds */}
            <div className="absolute inset-0 flex rounded-lg overflow-hidden">
              <div
                className="h-full relative"
                style={{ width: `${segmentMidPct}%`, backgroundColor: `${SEGMENT_COLORS[0]}22` }}
              >
                <div className="absolute inset-x-0 top-0 h-5 flex items-center justify-center">
                  <span className="text-[10px] font-medium" style={{ color: SEGMENT_COLORS[0] }}>Segment 1</span>
                </div>
              </div>
              <div className="w-px bg-border" />
              <div
                className="h-full relative flex-1"
                style={{ backgroundColor: `${SEGMENT_COLORS[1]}22` }}
              >
                <div className="absolute inset-x-0 top-0 h-5 flex items-center justify-center">
                  <span className="text-[10px] font-medium" style={{ color: SEGMENT_COLORS[1] }}>Segment 2</span>
                </div>
              </div>
            </div>

            {/* Waveform visualization */}
            <div className="absolute bottom-0 left-0 right-0 h-10 flex items-end px-1">
              {Array.from({ length: 80 }, (_, i) => {
                const height = 10 + Math.random() * 25;
                const pct = i / 80 * 100;
                const inTrim = pct >= trimStartPct && pct <= trimEndPct;
                return (
                  <div
                    key={i}
                    className="flex-1 mx-px rounded-t transition-colors"
                    style={{
                      height: `${height}px`,
                      backgroundColor: inTrim
                        ? (pct < segmentMidPct ? SEGMENT_COLORS[0] : SEGMENT_COLORS[1])
                        : '#9ca3af44',
                      opacity: inTrim ? 0.7 : 0.3,
                    }}
                  />
                );
              })}
            </div>

            {/* Trim region dimming */}
            <div className="absolute inset-y-0 left-0 bg-black/30 rounded-l-lg pointer-events-none" style={{ width: `${trimStartPct}%` }} />
            <div className="absolute inset-y-0 right-0 bg-black/30 rounded-r-lg pointer-events-none" style={{ width: `${100 - trimEndPct}%` }} />

            {/* Trim handles */}
            <div
              className="absolute top-0 bottom-0 w-2 bg-primary cursor-col-resize z-20 rounded-l"
              style={{ left: `${trimStartPct}%` }}
              onMouseDown={(e) => { e.stopPropagation(); setIsDragging('trimStart'); }}
            >
              <div className="absolute top-1/2 -translate-y-1/2 left-0 w-2 h-8 bg-primary rounded-sm flex items-center justify-center">
                <div className="w-0.5 h-3 bg-primary-foreground rounded" />
              </div>
            </div>
            <div
              className="absolute top-0 bottom-0 w-2 bg-primary cursor-col-resize z-20 rounded-r"
              style={{ left: `${trimEndPct}%`, transform: 'translateX(-100%)' }}
              onMouseDown={(e) => { e.stopPropagation(); setIsDragging('trimEnd'); }}
            >
              <div className="absolute top-1/2 -translate-y-1/2 right-0 w-2 h-8 bg-primary rounded-sm flex items-center justify-center">
                <div className="w-0.5 h-3 bg-primary-foreground rounded" />
              </div>
            </div>

            {/* Playhead */}
            <div
              className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-30 pointer-events-auto cursor-col-resize"
              style={{ left: `${playheadPct}%` }}
              onMouseDown={(e) => { e.stopPropagation(); setIsDragging('playhead'); }}
            >
              <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-3 h-3 bg-red-500 rounded-full border-2 border-background" />
            </div>

            {/* Time markers */}
            <div className="absolute bottom-0 left-0 right-0 flex justify-between px-1 pointer-events-none">
              {Array.from({ length: 7 }, (_, i) => {
                const t = (i / 6) * duration;
                return (
                  <span key={i} className="text-[9px] text-muted-foreground">{formatTime(t)}</span>
                );
              })}
            </div>
          </div>
        </div>

        {/* Trim info */}
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <span className="font-medium">Trim:</span>
              <span>{formatTime(trimStart)} → {formatTime(trimEnd)}</span>
              <Badge variant="outline" className="text-[10px]">{formatTime(trimEnd - trimStart)} total</Badge>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: SEGMENT_COLORS[0] }} />
              <span>Seg 1: {formatTime(Math.min(segmentMidpoint, duration))}s</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: SEGMENT_COLORS[1] }} />
              <span>Seg 2: {formatTime(Math.max(0, duration - segmentMidpoint))}s</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
