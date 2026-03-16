import { CommercialSegment } from '@/types/testimonialCommercial';
import { SegmentCard } from './SegmentCard';
import { Button } from '@/components/ui/button';
import { Plus, Film, User, Loader2, Sparkles } from 'lucide-react';
import { useState } from 'react';

interface SegmentTimelineProps {
  segments: CommercialSegment[];
  allSegments?: CommercialSegment[]; // Full unfiltered list for narrative role detection
  onUpdate: (id: string, updates: Partial<CommercialSegment>) => void;
  onDelete: (id: string) => void;
  onDuplicate?: (id: string) => void;
  onAdd: () => void;
  onReorder: (fromIndex: number, toIndex: number) => void;
  onGenerateCharacter?: (segmentId: string, description: string) => Promise<void>;
  segmentFilter?: 'speaking' | 'broll';
  isAddingScene?: boolean;
}

export function SegmentTimeline({
  segments,
  allSegments,
  onUpdate,
  onDelete,
  onDuplicate,
  onAdd,
  onReorder,
  onGenerateCharacter,
  segmentFilter,
  isAddingScene,
}: SegmentTimelineProps) {
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  const handleDrop = (dropIndex: number) => {
    if (dragIndex !== null && dragIndex !== dropIndex) {
      onReorder(dragIndex, dropIndex);
    }
    setDragIndex(null);
  };

  const totalDuration = segments.reduce((sum, s) => sum + s.duration, 0);
  const Icon = segmentFilter === 'broll' ? Film : User;
  const label = segmentFilter === 'broll' ? 'B-Roll' : 'Scene';

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">
            {segments.length} {label.toLowerCase()}{segments.length !== 1 ? 's' : ''} • {totalDuration}s
          </p>
        </div>
        <Button onClick={onAdd} size="sm" variant="outline" className="gap-1" disabled={isAddingScene}>
          {isAddingScene ? (
            <><Loader2 className="h-3 w-3 animate-spin" /> <Sparkles className="h-3 w-3" /> Suggesting...</>
          ) : (
            <><Plus className="h-3 w-3" /> Add {label}</>
          )}
        </Button>
      </div>

      {segments.length === 0 ? (
        <div className="border-2 border-dashed rounded-lg p-10 text-center">
          <Icon className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
          <h4 className="font-medium text-sm mb-1">No {label.toLowerCase()}s yet</h4>
          <p className="text-xs text-muted-foreground mb-3">
            {segmentFilter === 'broll' 
              ? 'B-roll is generated in the background during commercial creation' 
              : 'Use the AI Strategist above or add scenes manually'}
          </p>
          <Button variant="outline" size="sm" onClick={onAdd} className="gap-1" disabled={isAddingScene}>
            {isAddingScene ? (
              <><Loader2 className="h-3 w-3 animate-spin" /> Suggesting...</>
            ) : (
              <><Plus className="h-3 w-3" /> Add {label}</>
            )}
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {segments.map((segment, index) => (
            <SegmentCard
              key={segment.id}
              segment={segment}
              index={index}
              typeNumber={index + 1}
              onUpdate={onUpdate}
              onDelete={onDelete}
              onDuplicate={onDuplicate}
              onDragStart={() => setDragIndex(index)}
              onDragEnd={() => setDragIndex(null)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => handleDrop(index)}
              onGenerateCharacter={onGenerateCharacter}
            />
          ))}
        </div>
      )}
    </div>
  );
}
