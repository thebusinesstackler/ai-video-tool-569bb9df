import { useState, useEffect, useCallback, useRef } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { CommercialSegment } from '@/types/testimonialCommercial';
import { Play, Pause, SkipForward, SkipBack, X, Camera, Clock, Film, Volume2, Type, ArrowRight, PanelRightClose, PanelRightOpen } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StoryboardPreviewProps {
  segments: CommercialSegment[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  commercialName: string;
}

function getCameraAngle(index: number, type: 'speaking' | 'broll'): string {
  if (type === 'broll') return 'Cinematic Wide / Detail Shot';
  const angles = [
    'Medium Close-Up — Eye Level',
    'Over-the-Shoulder — 3/4 Angle',
    'Close-Up — Slight Low Angle',
    'Wide Shot — Establishing',
    'Medium Shot — Straight On',
    'Tight Close-Up — Hero Angle',
  ];
  return angles[index % angles.length];
}

function getTransitionLabel(transition: string): string {
  switch (transition) {
    case 'fade-in': return 'Fade In';
    case 'crossfade': return 'Crossfade';
    case 'cut': return 'Hard Cut';
    default: return 'Cut';
  }
}

export function StoryboardPreview({ segments, open, onOpenChange, commercialName }: StoryboardPreviewProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [showPanel, setShowPanel] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const seg = segments[currentIndex];
  const totalDuration = segments.reduce((s, seg) => s + seg.duration, 0);
  const elapsedBefore = segments.slice(0, currentIndex).reduce((s, seg) => s + seg.duration, 0);

  // Get the best image for display
  const getDisplayImage = (seg: CommercialSegment): string | null => {
    if (seg.type === 'speaking' && seg.character?.referenceImages?.length) {
      return seg.character.referenceImages[0];
    }
    if (seg.brollImages?.length) {
      return seg.brollImages[0];
    }
    return null;
  };

  const next = useCallback(() => {
    setElapsed(0);
    if (currentIndex < segments.length - 1) {
      setCurrentIndex(i => i + 1);
    } else {
      setIsPlaying(false);
      setCurrentIndex(0);
    }
  }, [currentIndex, segments.length]);

  const prev = useCallback(() => {
    setElapsed(0);
    setCurrentIndex(i => Math.max(0, i - 1));
  }, []);

  // Auto-advance when playing
  useEffect(() => {
    if (!isPlaying || !seg) return;
    intervalRef.current = setInterval(() => {
      setElapsed(prev => {
        const next = prev + 0.1;
        if (next >= seg.duration) {
          if (currentIndex < segments.length - 1) {
            setCurrentIndex(i => i + 1);
            return 0;
          } else {
            setIsPlaying(false);
            return seg.duration;
          }
        }
        return next;
      });
    }, 100);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [isPlaying, seg, currentIndex, segments.length]);

  // Reset on open
  useEffect(() => {
    if (open) { setCurrentIndex(0); setElapsed(0); setIsPlaying(false); }
  }, [open]);

  if (!seg) return null;

  const displayImage = getDisplayImage(seg);
  const progress = seg.duration > 0 ? (elapsed / seg.duration) * 100 : 0;
  const globalProgress = totalDuration > 0 ? ((elapsedBefore + elapsed) / totalDuration) * 100 : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl w-[95vw] h-[85vh] p-0 gap-0 overflow-hidden bg-black border-border/30">
        {/* Top Bar */}
        <div className="flex items-center justify-between px-4 py-2.5 bg-background/95 border-b border-border/30">
          <div className="flex items-center gap-3">
            <Film className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold text-foreground">{commercialName}</span>
            <Badge variant="outline" className="text-[10px]">
              Storyboard Preview
            </Badge>
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span>{segments.length} scenes</span>
            <span>{totalDuration}s total</span>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onOpenChange(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Main Preview Area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 flex relative">
            {/* Image/Visual Area */}
            <div className="flex-1 relative bg-black flex items-center justify-center overflow-hidden">
              {displayImage ? (
                <img
                  src={displayImage}
                  alt={`Scene ${currentIndex + 1}`}
                  className={cn(
                    'max-h-full max-w-full object-contain transition-opacity duration-500',
                    seg.transition === 'fade-in' ? 'animate-in fade-in duration-700' : '',
                  )}
                  key={currentIndex}
                />
              ) : (
                <div className="flex flex-col items-center gap-3 text-muted-foreground">
                  <Camera className="h-12 w-12 opacity-30" />
                  <span className="text-sm">No preview image</span>
                </div>
              )}

              {/* Scene number overlay */}
              <div className="absolute top-4 left-4 flex items-center gap-2">
                <Badge className="bg-black/70 text-white border-0 text-xs backdrop-blur-sm">
                  Scene {currentIndex + 1} / {segments.length}
                </Badge>
                <Badge variant={seg.type === 'speaking' ? 'default' : 'secondary'} className="text-[10px]">
                  {seg.type === 'speaking' ? '🎬 Speaking' : '🎞️ B-Roll'}
                </Badge>
              </div>

              {/* Transition indicator between scenes */}
              <div className="absolute top-4 right-4">
                <Badge className="bg-black/70 text-white border-0 text-[10px] backdrop-blur-sm gap-1">
                  <ArrowRight className="h-2.5 w-2.5" />
                  {getTransitionLabel(seg.transition)}
                </Badge>
              </div>

              {/* Script overlay at bottom */}
              {(seg.script || seg.voiceoverText) && (
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/60 to-transparent p-6 pt-16">
                  <p className="text-white text-base leading-relaxed font-medium text-center max-w-2xl mx-auto drop-shadow-lg">
                    "{seg.script || seg.voiceoverText}"
                  </p>
                </div>
              )}

              {/* Scene progress bar */}
              <div className="absolute bottom-0 left-0 right-0">
                <Progress value={progress} className="h-1 rounded-none bg-white/10 [&>div]:bg-primary" />
              </div>
            </div>

            {/* Right Info Panel */}
            <div className="w-[260px] bg-background border-l border-border/30 flex flex-col overflow-y-auto">
              {/* Camera & Technical */}
              <div className="p-4 space-y-4 border-b border-border/30">
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5 font-medium">Camera Angle</p>
                  <div className="flex items-start gap-2">
                    <Camera className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />
                    <p className="text-xs font-medium text-foreground">{getCameraAngle(currentIndex, seg.type)}</p>
                  </div>
                </div>

                <div>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5 font-medium">Duration</p>
                  <div className="flex items-center gap-2">
                    <Clock className="h-3.5 w-3.5 text-primary shrink-0" />
                    <p className="text-xs font-medium text-foreground">{seg.duration}s</p>
                    <span className="text-[10px] text-muted-foreground">({elapsedBefore}s – {elapsedBefore + seg.duration}s)</span>
                  </div>
                </div>

                <div>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5 font-medium">Transition</p>
                  <p className="text-xs font-medium text-foreground">{getTransitionLabel(seg.transition)}</p>
                </div>
              </div>

              {/* Character Info */}
              {seg.type === 'speaking' && seg.character && (
                <div className="p-4 space-y-3 border-b border-border/30">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Character</p>
                  <p className="text-xs text-foreground leading-relaxed">{seg.character.description}</p>
                  {seg.character.referenceImages.length > 0 && (
                    <div className="flex gap-1 overflow-x-auto">
                      {seg.character.referenceImages.slice(0, 6).map((img, i) => (
                        <img key={i} src={img} alt={`Angle ${i + 1}`} className="h-10 w-10 rounded object-cover border border-border/50 shrink-0" />
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* B-Roll Prompt */}
              {seg.type === 'broll' && seg.brollPrompts?.[0] && (
                <div className="p-4 space-y-2 border-b border-border/30">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">B-Roll Direction</p>
                  <p className="text-xs text-foreground leading-relaxed">{seg.brollPrompts[0]}</p>
                </div>
              )}

              {/* Script */}
              {(seg.script || seg.voiceoverText) && (
                <div className="p-4 space-y-2 border-b border-border/30">
                  <div className="flex items-center gap-1.5">
                    <Type className="h-3 w-3 text-primary" />
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                      {seg.type === 'speaking' ? 'Dialogue' : 'Voiceover'}
                    </p>
                  </div>
                  <p className="text-xs text-foreground leading-relaxed italic">"{seg.script || seg.voiceoverText}"</p>
                </div>
              )}

              {/* Audio Status */}
              <div className="p-4 space-y-2">
                <div className="flex items-center gap-1.5">
                  <Volume2 className="h-3 w-3 text-primary" />
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Audio</p>
                </div>
                <p className="text-xs text-foreground">
                  {seg.audioUrl ? '✅ Voice generated' : '⏳ Pending generation'}
                </p>
                {seg.voiceoverId && (
                  <p className="text-[10px] text-muted-foreground font-mono">{seg.voiceoverId}</p>
                )}
              </div>

              {/* Scene Thumbnails */}
              <div className="p-4 border-t border-border/30 mt-auto">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-2">All Scenes</p>
                <div className="grid grid-cols-4 gap-1.5">
                  {segments.map((s, i) => {
                    const thumb = getDisplayImage(s);
                    return (
                      <button
                        key={s.id}
                        onClick={() => { setCurrentIndex(i); setElapsed(0); }}
                        className={cn(
                          'rounded border overflow-hidden aspect-video relative transition-all',
                          i === currentIndex ? 'border-primary ring-1 ring-primary' : 'border-border/50 opacity-60 hover:opacity-100'
                        )}
                      >
                        {thumb ? (
                          <img src={thumb} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full bg-muted flex items-center justify-center">
                            <span className="text-[8px] text-muted-foreground">{i + 1}</span>
                          </div>
                        )}
                        <span className="absolute bottom-0 left-0 right-0 bg-black/70 text-[7px] text-white text-center py-0.5">
                          {s.duration}s
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Playback Controls */}
          <div className="px-4 py-3 bg-background border-t border-border/30 flex items-center gap-4">
            {/* Global progress */}
            <div className="flex-1">
              <Progress value={globalProgress} className="h-1.5 bg-muted [&>div]:bg-primary" />
              <div className="flex justify-between mt-1">
                <span className="text-[10px] text-muted-foreground">{Math.round(elapsedBefore + elapsed)}s</span>
                <span className="text-[10px] text-muted-foreground">{totalDuration}s</span>
              </div>
            </div>

            {/* Playback buttons */}
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={prev} disabled={currentIndex === 0}>
                <SkipBack className="h-4 w-4" />
              </Button>
              <Button
                variant="default"
                size="icon"
                className="h-9 w-9 rounded-full"
                onClick={() => {
                  if (!isPlaying && currentIndex === segments.length - 1 && elapsed >= seg.duration) {
                    setCurrentIndex(0);
                    setElapsed(0);
                  }
                  setIsPlaying(!isPlaying);
                }}
              >
                {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={next} disabled={currentIndex === segments.length - 1}>
                <SkipForward className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}