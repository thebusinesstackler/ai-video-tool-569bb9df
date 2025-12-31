import { CommercialSegment, TransitionType } from '@/types/testimonialCommercial';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { TwinSelector } from './TwinSelector';
import { GripVertical, Trash2, User, Image, Film, Loader2, CheckCircle, AlertCircle } from 'lucide-react';

interface SegmentCardProps {
  segment: CommercialSegment;
  index: number;
  onUpdate: (id: string, updates: Partial<CommercialSegment>) => void;
  onDelete: (id: string) => void;
  onDragStart: () => void;
  onDragEnd: () => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: () => void;
}

const segmentTypeLabels = {
  'twin-speaking': 'AI Twin Speaking',
  'broll-voice-continue': 'B-Roll (Voice Continues)',
  'broll-montage': 'B-Roll Montage'
};

const segmentTypeIcons = {
  'twin-speaking': User,
  'broll-voice-continue': Image,
  'broll-montage': Film
};

const statusColors = {
  pending: 'bg-muted text-muted-foreground',
  generating: 'bg-amber-500/20 text-amber-500',
  complete: 'bg-emerald-500/20 text-emerald-500',
  error: 'bg-destructive/20 text-destructive'
};

export function SegmentCard({
  segment,
  index,
  onUpdate,
  onDelete,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop
}: SegmentCardProps) {
  const Icon = segmentTypeIcons[segment.type];
  const status = segment.status || 'pending';

  return (
    <Card
      className="relative cursor-grab active:cursor-grabbing"
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <GripVertical className="h-4 w-4 text-muted-foreground" />
            <Badge variant="outline" className="gap-1">
              <Icon className="h-3 w-3" />
              {segmentTypeLabels[segment.type]}
            </Badge>
            <span className="text-sm text-muted-foreground">#{index + 1}</span>
          </div>
          <div className="flex items-center gap-2">
            <Badge className={statusColors[status]}>
              {status === 'generating' && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
              {status === 'complete' && <CheckCircle className="h-3 w-3 mr-1" />}
              {status === 'error' && <AlertCircle className="h-3 w-3 mr-1" />}
              {status}
            </Badge>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onDelete(segment.id)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {segment.type === 'twin-speaking' && (
          <>
            <TwinSelector
              value={segment.twinId}
              onSelect={(id, name) => onUpdate(segment.id, { twinId: id, twinName: name })}
            />
            <div className="space-y-2">
              <Label>Script (What they say)</Label>
              <Textarea
                placeholder="Enter what this AI Twin will say..."
                value={segment.script || ''}
                onChange={(e) => onUpdate(segment.id, { script: e.target.value })}
                rows={3}
              />
            </div>
          </>
        )}

        {segment.type === 'broll-voice-continue' && (
          <div className="space-y-2">
            <Label>B-Roll Description (voice continues from previous)</Label>
            <Textarea
              placeholder="Describe the B-roll visuals to generate..."
              value={segment.brollPrompts?.[0] || ''}
              onChange={(e) => onUpdate(segment.id, { brollPrompts: [e.target.value] })}
              rows={2}
            />
          </div>
        )}

        {segment.type === 'broll-montage' && (
          <>
            <TwinSelector
              value={segment.voiceoverId}
              onSelect={(id) => onUpdate(segment.id, { voiceoverId: id })}
              label="Voice for Montage"
            />
            <div className="space-y-2">
              <Label>Voiceover Script</Label>
              <Textarea
                placeholder="Enter the voiceover text for this montage..."
                value={segment.voiceoverText || ''}
                onChange={(e) => onUpdate(segment.id, { voiceoverText: e.target.value })}
                rows={2}
              />
            </div>
            <div className="space-y-2">
              <Label>B-Roll Scenes (4-5 prompts, one per line)</Label>
              <Textarea
                placeholder="Product close-up shot&#10;Customer using product&#10;Happy reaction shot&#10;Lifestyle scene&#10;Logo reveal"
                value={segment.brollPrompts?.join('\n') || ''}
                onChange={(e) => onUpdate(segment.id, { 
                  brollPrompts: e.target.value.split('\n').filter(p => p.trim()) 
                })}
                rows={5}
              />
            </div>
          </>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Transition</Label>
            <Select
              value={segment.transition}
              onValueChange={(v: TransitionType) => onUpdate(segment.id, { transition: v })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="fade-in">Fade In</SelectItem>
                <SelectItem value="cut">Cut</SelectItem>
                <SelectItem value="crossfade">Crossfade</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Duration (seconds)</Label>
            <Select
              value={segment.duration.toString()}
              onValueChange={(v) => onUpdate(segment.id, { duration: parseInt(v) })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[3, 5, 7, 10, 15, 20, 30].map(d => (
                  <SelectItem key={d} value={d.toString()}>{d}s</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
