import { useState } from 'react';
import { CommercialSegment } from '@/types/testimonialCommercial';
import { User, Film, Clapperboard, GripVertical } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface TimelinePreviewProps {
  segments: CommercialSegment[];
  onReorder?: (fromIndex: number, toIndex: number) => void;
}

const segmentConfig = {
  'twin-speaking': {
    label: 'AI Twin Speaking',
    color: 'bg-primary',
    icon: User,
  },
  'broll-voice-continue': {
    label: 'B-Roll (Voice Continues)',
    color: 'bg-amber-500',
    icon: Film,
  },
  'broll-montage': {
    label: 'B-Roll Montage',
    color: 'bg-emerald-500',
    icon: Clapperboard,
  },
};

export function TimelinePreview({ segments, onReorder }: TimelinePreviewProps) {
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dropTargetIndex, setDropTargetIndex] = useState<number | null>(null);

  if (segments.length === 0) return null;

  const totalDuration = segments.reduce((sum, seg) => sum + (seg.duration || 0), 0);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return mins > 0 ? `${mins}:${secs.toString().padStart(2, '0')}` : `${secs}s`;
  };

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', index.toString());
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (draggedIndex !== null && index !== draggedIndex) {
      setDropTargetIndex(index);
    }
  };

  const handleDragLeave = () => {
    setDropTargetIndex(null);
  };

  const handleDrop = (e: React.DragEvent, toIndex: number) => {
    e.preventDefault();
    const fromIndex = draggedIndex;
    setDraggedIndex(null);
    setDropTargetIndex(null);

    if (fromIndex !== null && fromIndex !== toIndex && onReorder) {
      onReorder(fromIndex, toIndex);
    }
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDropTargetIndex(null);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">Timeline Preview</span>
          {onReorder && (
            <span className="text-xs text-muted-foreground/60">(drag to reorder)</span>
          )}
        </div>
        <span className="font-medium">{formatDuration(totalDuration)} total</span>
      </div>

      {/* Timeline Bar */}
      <TooltipProvider delayDuration={100}>
        <div className="flex h-12 rounded-lg overflow-hidden border bg-muted/30">
          {segments.map((segment, index) => {
            const config = segmentConfig[segment.type];
            const widthPercent = totalDuration > 0 ? (segment.duration / totalDuration) * 100 : 0;
            const Icon = config.icon;
            const isDragging = draggedIndex === index;
            const isDropTarget = dropTargetIndex === index;

            return (
              <Tooltip key={segment.id}>
                <TooltipTrigger asChild>
                  <div
                    draggable={!!onReorder}
                    onDragStart={(e) => handleDragStart(e, index)}
                    onDragOver={(e) => handleDragOver(e, index)}
                    onDragLeave={handleDragLeave}
                    onDrop={(e) => handleDrop(e, index)}
                    onDragEnd={handleDragEnd}
                    className={`${config.color} flex items-center justify-center gap-1 transition-all cursor-grab active:cursor-grabbing relative group
                      ${isDragging ? 'opacity-50 scale-95' : 'hover:brightness-110'}
                      ${isDropTarget ? 'ring-2 ring-white ring-inset' : ''}
                    `}
                    style={{ width: `${widthPercent}%`, minWidth: widthPercent > 0 ? '32px' : '0' }}
                  >
                    {/* Drag handle indicator */}
                    {onReorder && (
                      <GripVertical className="h-3 w-3 text-white/50 absolute left-0.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                    )}
                    <Icon className="h-4 w-4 text-white shrink-0" />
                    {widthPercent > 12 && (
                      <span className="text-xs text-white font-medium">
                        {segment.duration}s
                      </span>
                    )}
                    {/* Segment divider */}
                    {index < segments.length - 1 && (
                      <div className="absolute right-0 top-0 bottom-0 w-px bg-background/30" />
                    )}
                  </div>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs max-w-[280px]">
                  <div className="font-medium">{config.label}</div>
                  <div className="text-muted-foreground">
                    {segment.duration}s • Segment {index + 1}
                  </div>
                  {segment.type === 'twin-speaking' && segment.twinName && (
                    <div className="text-muted-foreground mt-1">
                      Twin: {segment.twinName}
                    </div>
                  )}
                  {segment.type === 'twin-speaking' && !segment.twinId && segment.personaDescription && (
                    <div className="text-primary/80 mt-1 italic">
                      Generated: {segment.personaDescription.slice(0, 80)}...
                    </div>
                  )}
                  {segment.type === 'twin-speaking' && segment.script && (
                    <div className="max-w-[250px] truncate text-muted-foreground mt-1">
                      "{segment.script.slice(0, 60)}..."
                    </div>
                  )}
                  {(segment.type === 'broll-voice-continue' || segment.type === 'broll-montage') && 
                   segment.brollPrompts && segment.brollPrompts.length > 0 && (
                    <div className="text-muted-foreground mt-1">
                      {segment.brollPrompts.length} B-roll shot{segment.brollPrompts.length !== 1 ? 's' : ''}
                    </div>
                  )}
                </TooltipContent>
              </Tooltip>
            );
          })}
        </div>
      </TooltipProvider>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
        {Object.entries(segmentConfig).map(([type, config]) => {
          const count = segments.filter(s => s.type === type).length;
          if (count === 0) return null;
          const Icon = config.icon;
          return (
            <div key={type} className="flex items-center gap-1.5">
              <div className={`w-3 h-3 rounded-sm ${config.color}`} />
              <Icon className="h-3 w-3" />
              <span>{config.label} ({count})</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
