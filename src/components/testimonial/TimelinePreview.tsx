import { useState, useRef, useCallback } from 'react';
import { CommercialSegment } from '@/types/testimonialCommercial';
import { User, Film, Play, Pause, ChevronUp, ChevronDown, Volume2, Clock } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';

interface TimelinePreviewProps {
  segments: CommercialSegment[];
  onReorder?: (fromIndex: number, toIndex: number) => void;
  onSelectSegment?: (id: string) => void;
}

const segmentConfig = {
  speaking: { label: 'Speaking', color: 'bg-primary', border: 'border-primary/60', icon: User },
  broll: { label: 'B-Roll', color: 'bg-amber-500', border: 'border-amber-500/60', icon: Film },
};

export function TimelinePreview({ segments, onReorder, onSelectSegment }: TimelinePreviewProps) {
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dropTargetIndex, setDropTargetIndex] = useState<number | null>(null);
  const [expanded, setExpanded] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const hoverAudioRef = useRef<HTMLAudioElement | null>(null);
  const [hoverVoiceId, setHoverVoiceId] = useState<string | null>(null);
  const [isLoadingVoice, setIsLoadingVoice] = useState<string | null>(null);

  const detectVoiceId = (segment: CommercialSegment): string => {
    const desc = (segment.character?.description || '').toLowerCase();
    const gender = (segment.character?.gender || '').toLowerCase();
    const isFemale = gender.includes('female') || gender.includes('woman') ||
      /\b(woman|female|girl|lady|she|her|mother|actress)\b/.test(desc);
    if (isFemale) return 'English_compelling_lady1';
    return 'English_Trustworth_Man';
  };

  const handleHoverStart = useCallback(async (segment: CommercialSegment) => {
    if (!segment.script?.trim()) return;
    // If already playing this one, skip
    if (hoverVoiceId === segment.id) return;

    // Stop any current playback
    if (hoverAudioRef.current) {
      hoverAudioRef.current.pause();
      hoverAudioRef.current = null;
    }

    // If segment already has audioUrl, play that
    if (segment.audioUrl) {
      const audio = new Audio(segment.audioUrl);
      hoverAudioRef.current = audio;
      setHoverVoiceId(segment.id);
      audio.onended = () => { setHoverVoiceId(null); hoverAudioRef.current = null; };
      audio.play().catch(() => {});
      return;
    }

    // Generate a quick TTS preview
    setIsLoadingVoice(segment.id);
    setHoverVoiceId(segment.id);
    try {
      const voiceId = detectVoiceId(segment);
      const { data, error } = await supabase.functions.invoke('text-to-speech', {
        body: { text: segment.script.slice(0, 200), voice_id: voiceId }
      });
      if (error) throw error;
      if (data?.audioUrl) {
        const audio = new Audio(data.audioUrl);
        hoverAudioRef.current = audio;
        audio.onended = () => { setHoverVoiceId(null); hoverAudioRef.current = null; };
        audio.play().catch(() => {});
      }
    } catch (err) {
      console.error('Hover voice preview failed:', err);
    } finally {
      setIsLoadingVoice(null);
    }
  }, [hoverVoiceId]);

  const handleHoverEnd = useCallback(() => {
    if (hoverAudioRef.current) {
      hoverAudioRef.current.pause();
      hoverAudioRef.current = null;
    }
    setHoverVoiceId(null);
  }, []);

  if (segments.length === 0) return null;

  const totalDuration = segments.reduce((sum, seg) => sum + (seg.duration || 0), 0);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getTimecode = (index: number) => {
    let elapsed = 0;
    for (let i = 0; i < index; i++) elapsed += segments[i].duration || 0;
    return formatTime(elapsed);
  };

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex !== null && index !== draggedIndex) setDropTargetIndex(index);
  };

  const handleDrop = (e: React.DragEvent, toIndex: number) => {
    e.preventDefault();
    if (draggedIndex !== null && draggedIndex !== toIndex && onReorder) onReorder(draggedIndex, toIndex);
    setDraggedIndex(null);
    setDropTargetIndex(null);
  };

  const handleSelect = (id: string) => {
    setSelectedId(id === selectedId ? null : id);
    onSelectSegment?.(id);
  };

  const getThumbnail = (segment: CommercialSegment) => {
    if (segment.brollImages?.[0]) return segment.brollImages[0];
    if (segment.character?.referenceImages?.[0]) return segment.character.referenceImages[0];
    return null;
  };

  return (
    <div className="space-y-1">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Clock className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-xs font-medium text-muted-foreground">Timeline</span>
          <Badge variant="secondary" className="text-[10px] h-4 px-1.5">{formatTime(totalDuration)}</Badge>
        </div>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setExpanded(!expanded)}>
          {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        </Button>
      </div>

      {/* Mini Bar (always visible) */}
      <TooltipProvider delayDuration={100}>
        <div className="flex h-3 rounded-full overflow-hidden border bg-muted/30">
          {segments.map((segment, index) => {
            const config = segmentConfig[segment.type] || segmentConfig.speaking;
            const widthPercent = totalDuration > 0 ? (segment.duration / totalDuration) * 100 : 0;
            return (
              <Tooltip key={segment.id}>
                <TooltipTrigger asChild>
                  <div
                    className={cn(
                      config.color, 'transition-all cursor-pointer relative',
                      selectedId === segment.id && 'brightness-125 ring-1 ring-white ring-inset',
                    )}
                    style={{ width: `${widthPercent}%`, minWidth: '4px' }}
                    onClick={() => handleSelect(segment.id)}
                  >
                    {index < segments.length - 1 && (
                      <div className="absolute right-0 top-0 bottom-0 w-px bg-background/40" />
                    )}
                  </div>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs">
                  <div className="font-medium">{config.label} #{index + 1}</div>
                  <div className="text-muted-foreground">{segment.duration}s — {getTimecode(index)}</div>
                </TooltipContent>
              </Tooltip>
            );
          })}
        </div>
      </TooltipProvider>

      {/* Expanded Timeline */}
      {expanded && (
        <ScrollArea className="w-full">
          <div className="flex gap-1.5 pt-2 pb-1 min-w-max">
            {segments.map((segment, index) => {
              const config = segmentConfig[segment.type] || segmentConfig.speaking;
              const Icon = config.icon;
              const isDragging = draggedIndex === index;
              const isDropTarget = dropTargetIndex === index;
              const isSelected = selectedId === segment.id;
              const thumb = getThumbnail(segment);
              const hasVideo = !!segment.videoUrl;
              const hasAudio = !!segment.audioUrl;

              return (
                <div
                  key={segment.id}
                  draggable={!!onReorder}
                  onDragStart={(e) => handleDragStart(e, index)}
                  onDragOver={(e) => handleDragOver(e, index)}
                  onDragLeave={() => setDropTargetIndex(null)}
                  onDrop={(e) => handleDrop(e, index)}
                  onDragEnd={() => { setDraggedIndex(null); setDropTargetIndex(null); }}
                  onClick={() => handleSelect(segment.id)}
                  className={cn(
                    'relative rounded-lg border overflow-hidden cursor-pointer transition-all group',
                    'hover:ring-1 hover:ring-primary/40',
                    isDragging && 'opacity-40 scale-95',
                    isDropTarget && 'ring-2 ring-primary',
                    isSelected ? `ring-2 ${config.border} bg-accent/50` : 'bg-card',
                  )}
                  style={{ width: `${Math.max(segment.duration * 6, 80)}px` }}
                >
                  {/* Thumbnail / Visual */}
                  <div className="h-14 relative overflow-hidden bg-muted/50">
                    {thumb ? (
                      <img src={thumb} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className={cn('w-full h-full flex items-center justify-center', config.color, 'bg-opacity-20')}>
                        <Icon className="h-5 w-5 text-muted-foreground/60" />
                      </div>
                    )}

                    {/* Play overlay for video segments */}
                    {hasVideo && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Play className="h-4 w-4 text-white" />
                      </div>
                    )}

                    {/* Timecode badge */}
                    <div className="absolute bottom-0.5 right-0.5 bg-black/70 text-white text-[9px] px-1 rounded font-mono">
                      {getTimecode(index)}
                    </div>

                    {/* Type indicator */}
                    <div className={cn('absolute top-0.5 left-0.5 h-4 w-4 rounded-full flex items-center justify-center', config.color)}>
                      <Icon className="h-2.5 w-2.5 text-white" />
                    </div>
                  </div>

                  {/* Info */}
                  <div className="px-1.5 py-1 space-y-0.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-medium truncate leading-tight">
                        {segment.character?.name || (segment.type === 'broll' ? 'B-Roll' : `Scene ${index + 1}`)}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-[9px] text-muted-foreground">{segment.duration}s</span>
                      {hasAudio && <Volume2 className="h-2.5 w-2.5 text-muted-foreground/60" />}
                      {hasVideo && <Film className="h-2.5 w-2.5 text-green-500/70" />}
                    </div>
                    {segment.script && (
                      <p className="text-[9px] text-muted-foreground/70 truncate leading-tight">{segment.script}</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      )}
    </div>
  );
}
