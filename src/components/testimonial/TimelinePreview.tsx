import { useState } from 'react';
import { CommercialSegment } from '@/types/testimonialCommercial';
import { User, Film, GripVertical } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

interface TimelinePreviewProps {
  segments: CommercialSegment[];
  onReorder?: (fromIndex: number, toIndex: number) => void;
}

const segmentConfig = {
  'speaking': {
    label: 'Speaking',
    color: 'bg-primary',
    icon: User,
  },
  'broll': {
    label: 'B-Roll',
    color: 'bg-amber-500',
    icon: Film,
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

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">Timeline</span>
        <span className="font-medium">{formatDuration(totalDuration)} total</span>
      </div>

      <TooltipProvider delayDuration={100}>
        <div className="flex h-10 rounded-lg overflow-hidden border bg-muted/30">
          {segments.map((segment, index) => {
            const config = segmentConfig[segment.type] || segmentConfig.speaking;
            const widthPercent = totalDuration > 0 ? (segment.duration / totalDuration) * 100 : 0;
            const Icon = config.icon;
            const isDragging = draggedIndex === index;
            const isDropTarget = dropTargetIndex === index;
            const charImage = segment.character?.referenceImages?.[0];

            return (
              <Tooltip key={segment.id}>
                <TooltipTrigger asChild>
                  <div
                    draggable={!!onReorder}
                    onDragStart={(e) => handleDragStart(e, index)}
                    onDragOver={(e) => handleDragOver(e, index)}
                    onDragLeave={() => setDropTargetIndex(null)}
                    onDrop={(e) => handleDrop(e, index)}
                    onDragEnd={() => { setDraggedIndex(null); setDropTargetIndex(null); }}
                    className={`${config.color} flex items-center justify-center gap-1 transition-all cursor-grab relative group
                      ${isDragging ? 'opacity-50 scale-95' : 'hover:brightness-110'}
                      ${isDropTarget ? 'ring-2 ring-white ring-inset' : ''}
                    `}
                    style={{ width: `${widthPercent}%`, minWidth: '28px' }}
                  >
                    {charImage ? (
                      <Avatar className="h-6 w-6 border border-white/40 shrink-0">
                        <AvatarImage src={charImage} alt="Character" className="object-cover" />
                        <AvatarFallback><User className="h-3 w-3" /></AvatarFallback>
                      </Avatar>
                    ) : (
                      <Icon className="h-3 w-3 text-white shrink-0" />
                    )}
                    {widthPercent > 12 && (
                      <span className="text-[10px] text-white font-medium">{segment.duration}s</span>
                    )}
                    {index < segments.length - 1 && (
                      <div className="absolute right-0 top-0 bottom-0 w-px bg-background/30" />
                    )}
                  </div>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs">
                  <div className="font-medium">{config.label}</div>
                  <div className="text-muted-foreground">{segment.duration}s • #{index + 1}</div>
                  {segment.character?.name && (
                    <div className="text-muted-foreground">{segment.character.name}</div>
                  )}
                </TooltipContent>
              </Tooltip>
            );
          })}
        </div>
      </TooltipProvider>
    </div>
  );
}
