import { CommercialSegment } from '@/types/testimonialCommercial';
import { SegmentCard } from './SegmentCard';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Plus, User, Image, Film } from 'lucide-react';
import { useState } from 'react';

interface SegmentTimelineProps {
  segments: CommercialSegment[];
  onUpdate: (id: string, updates: Partial<CommercialSegment>) => void;
  onDelete: (id: string) => void;
  onAdd: (type: CommercialSegment['type']) => void;
  onReorder: (fromIndex: number, toIndex: number) => void;
  onGenerateBrollImages?: (segmentId: string) => Promise<void>;
  isGeneratingImages?: boolean;
}

export function SegmentTimeline({
  segments,
  onUpdate,
  onDelete,
  onAdd,
  onReorder,
  onGenerateBrollImages,
  isGeneratingImages
}: SegmentTimelineProps) {
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  const handleDrop = (dropIndex: number) => {
    if (dragIndex !== null && dragIndex !== dropIndex) {
      onReorder(dragIndex, dropIndex);
    }
    setDragIndex(null);
  };

  const totalDuration = segments.reduce((sum, s) => sum + s.duration, 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold">Timeline</h3>
          <p className="text-sm text-muted-foreground">
            {segments.length} segments • {totalDuration}s total
          </p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add Segment
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onAdd('twin-speaking')}>
              <User className="h-4 w-4 mr-2" />
              AI Twin Speaking
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onAdd('broll-voice-continue')}>
              <Image className="h-4 w-4 mr-2" />
              B-Roll (Voice Continues)
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onAdd('broll-montage')}>
              <Film className="h-4 w-4 mr-2" />
              B-Roll Montage
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {segments.length === 0 ? (
        <div className="border-2 border-dashed rounded-lg p-12 text-center">
          <Film className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h4 className="font-medium mb-2">No segments yet</h4>
          <p className="text-sm text-muted-foreground mb-4">
            Add segments to build your testimonial commercial
          </p>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline">
                <Plus className="h-4 w-4 mr-2" />
                Add First Segment
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => onAdd('twin-speaking')}>
                <User className="h-4 w-4 mr-2" />
                AI Twin Speaking
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onAdd('broll-voice-continue')}>
                <Image className="h-4 w-4 mr-2" />
                B-Roll (Voice Continues)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onAdd('broll-montage')}>
                <Film className="h-4 w-4 mr-2" />
                B-Roll Montage
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ) : (
        <div className="space-y-3">
          {segments.map((segment, index) => (
            <SegmentCard
              key={segment.id}
              segment={segment}
              index={index}
              onUpdate={onUpdate}
              onDelete={onDelete}
              onDragStart={() => setDragIndex(index)}
              onDragEnd={() => setDragIndex(null)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => handleDrop(index)}
              onGenerateBrollImages={onGenerateBrollImages}
              isGeneratingImages={isGeneratingImages}
            />
          ))}
        </div>
      )}

      {/* Visual timeline bar */}
      {segments.length > 0 && (
        <div className="mt-6">
          <Label className="text-sm text-muted-foreground mb-2 block">Visual Timeline</Label>
          <div className="flex h-8 rounded-lg overflow-hidden border">
            {segments.map((segment, index) => {
              const widthPercent = (segment.duration / totalDuration) * 100;
              const colors = {
                'twin-speaking': 'bg-primary',
                'broll-voice-continue': 'bg-secondary',
                'broll-montage': 'bg-accent'
              };
              return (
                <div
                  key={segment.id}
                  className={`${colors[segment.type]} flex items-center justify-center text-xs font-medium`}
                  style={{ width: `${widthPercent}%` }}
                  title={`${segment.twinName || segment.type}: ${segment.duration}s`}
                >
                  {segment.duration >= 5 && `${segment.duration}s`}
                </div>
              );
            })}
          </div>
          <div className="flex justify-between text-xs text-muted-foreground mt-1">
            <span>0s</span>
            <span>{totalDuration}s</span>
          </div>
        </div>
      )}
    </div>
  );
}

function Label({ children, className }: { children: React.ReactNode; className?: string }) {
  return <label className={className}>{children}</label>;
}
