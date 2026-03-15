import { useState } from 'react';
import { CommercialSegment, TransitionType } from '@/types/testimonialCommercial';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { 
  GripVertical, Trash2, User, Film, Loader2, CheckCircle, AlertCircle, 
  Wand2, ImageIcon, Sparkles, Check
} from 'lucide-react';

interface SegmentCardProps {
  segment: CommercialSegment;
  index: number;
  onUpdate: (id: string, updates: Partial<CommercialSegment>) => void;
  onDelete: (id: string) => void;
  onDragStart: () => void;
  onDragEnd: () => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: () => void;
  onGenerateCharacter?: (segmentId: string, description: string) => Promise<void>;
}

const statusConfig: Record<string, { label: string; color: string; icon: typeof Loader2 }> = {
  'pending': { label: 'Pending', color: 'bg-muted text-muted-foreground', icon: AlertCircle },
  'generating-character': { label: 'Generating Character...', color: 'bg-accent/20 text-accent-foreground', icon: Loader2 },
  'character-ready': { label: 'Review Character', color: 'bg-primary/20 text-primary', icon: ImageIcon },
  'approved': { label: 'Approved', color: 'bg-primary/20 text-primary', icon: CheckCircle },
  'generating': { label: 'Generating Video...', color: 'bg-accent/20 text-accent-foreground', icon: Loader2 },
  'complete': { label: 'Complete', color: 'bg-primary/20 text-primary', icon: CheckCircle },
  'error': { label: 'Error', color: 'bg-destructive/20 text-destructive', icon: AlertCircle },
};

export function SegmentCard({
  segment,
  index,
  onUpdate,
  onDelete,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
  onGenerateCharacter,
}: SegmentCardProps) {
  const status = segment.status || 'pending';
  const statusInfo = statusConfig[status] || statusConfig.pending;
  const StatusIcon = statusInfo.icon;
  const [charDescription, setCharDescription] = useState(segment.character?.description || '');
  const isGeneratingChar = status === 'generating-character';

  const handleGenerateChar = () => {
    if (!charDescription.trim() || !onGenerateCharacter) return;
    onGenerateCharacter(segment.id, charDescription);
  };

  return (
    <Card
      className="relative group hover:shadow-md transition-shadow"
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />
            <Badge variant="outline" className="gap-1 text-xs">
              {segment.type === 'speaking' ? <User className="h-3 w-3" /> : <Film className="h-3 w-3" />}
              {segment.type === 'speaking' ? 'Speaking' : 'B-Roll'}
            </Badge>
            <span className="text-xs text-muted-foreground font-mono">#{index + 1}</span>
          </div>
          <div className="flex items-center gap-2">
            <Badge className={`${statusInfo.color} text-xs gap-1`}>
              <StatusIcon className={`h-3 w-3 ${isGeneratingChar || status === 'generating' ? 'animate-spin' : ''}`} />
              {statusInfo.label}
            </Badge>
            <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100" onClick={() => onDelete(segment.id)}>
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Speaking segment */}
        {segment.type === 'speaking' && (
          <>
            {/* Character Generation / Preview */}
            {segment.character && segment.character.referenceImages.length > 0 ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="flex items-center gap-2 text-sm font-medium">
                    <Sparkles className="h-3 w-3 text-primary" />
                    {segment.character.name}
                  </Label>
                  {status === 'character-ready' && (
                    <Button
                      size="sm"
                      variant="default"
                      className="gap-1 h-7 text-xs"
                      onClick={() => onUpdate(segment.id, { status: 'approved' })}
                    >
                      <Check className="h-3 w-3" />
                      Approve
                    </Button>
                  )}
                  {status === 'approved' && (
                    <Badge className="bg-emerald-500/20 text-emerald-600 gap-1">
                      <CheckCircle className="h-3 w-3" /> Approved
                    </Badge>
                  )}
                </div>

                {/* 6 Angle Grid */}
                <div className="grid grid-cols-3 gap-2">
                  {segment.character.referenceImages.slice(0, 6).map((img, i) => (
                    <div key={i} className="relative aspect-square rounded-lg overflow-hidden border border-border bg-muted/30">
                      <img src={img} alt={`Angle ${i + 1}`} className="w-full h-full object-cover" />
                      <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/60 to-transparent p-1">
                        <span className="text-[10px] text-white font-medium">
                          {['Front', '3/4 Left', 'Side', 'Low Angle', '3/4 Right', 'Wide'][i] || `Angle ${i + 1}`}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="border border-dashed border-primary/30 rounded-lg p-4 bg-primary/5 space-y-3">
                <div className="flex items-center gap-2">
                  <Wand2 className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium">Describe the actor</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  AI will generate a photorealistic character with 6 cinematic angles
                </p>
                <Textarea
                  placeholder="e.g. Confident woman in her 30s, professional business attire, warm smile..."
                  value={charDescription}
                  onChange={(e) => setCharDescription(e.target.value)}
                  className="min-h-[60px] text-sm"
                  rows={2}
                />
                <Button
                  onClick={handleGenerateChar}
                  disabled={isGeneratingChar || !charDescription.trim()}
                  className="w-full gap-2"
                  size="sm"
                >
                  {isGeneratingChar ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Wand2 className="h-3 w-3" />
                  )}
                  Generate Character (6 Angles)
                </Button>
              </div>
            )}

            {/* Script */}
            <div className="space-y-2">
              <Label className="text-sm">Script</Label>
              <Textarea
                placeholder="What the character will say..."
                value={segment.script || ''}
                onChange={(e) => onUpdate(segment.id, { script: e.target.value })}
                rows={3}
                className="text-sm"
              />
            </div>
          </>
        )}

        {/* B-Roll segment */}
        {segment.type === 'broll' && (
          <>
            <div className="space-y-2">
              <Label className="text-sm">Visual Description</Label>
              <Textarea
                placeholder="Describe the B-roll visuals..."
                value={segment.brollPrompts?.[0] || ''}
                onChange={(e) => onUpdate(segment.id, { brollPrompts: [e.target.value] })}
                rows={2}
                className="text-sm"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm">Voiceover (optional)</Label>
              <Textarea
                placeholder="Narration over B-roll..."
                value={segment.voiceoverText || ''}
                onChange={(e) => onUpdate(segment.id, { voiceoverText: e.target.value })}
                rows={2}
                className="text-sm"
              />
            </div>
            {/* Generated B-Roll images preview */}
            {segment.brollImages && segment.brollImages.length > 0 && (
              <div className="grid grid-cols-4 gap-2">
                {segment.brollImages.map((img, i) => (
                  <div key={i} className="aspect-video rounded-md overflow-hidden border border-border">
                    <img src={img} alt={`B-roll ${i + 1}`} className="w-full h-full object-cover" />
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* Duration & Transition */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Transition</Label>
            <Select value={segment.transition} onValueChange={(v: TransitionType) => onUpdate(segment.id, { transition: v })}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="fade-in">Fade In</SelectItem>
                <SelectItem value="cut">Cut</SelectItem>
                <SelectItem value="crossfade">Crossfade</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Duration</Label>
            <Select value={segment.duration.toString()} onValueChange={(v) => onUpdate(segment.id, { duration: parseInt(v) })}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {[5, 8, 10, 15, 20, 30].map(d => (
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
