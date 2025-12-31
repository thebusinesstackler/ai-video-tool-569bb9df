import { useState, useRef } from 'react';
import { CommercialSegment, TransitionType, BrollImageSlot, ShotVariation, BrollSequence } from '@/types/testimonialCommercial';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { TwinSelector } from './TwinSelector';
import { ShotVariationPicker } from './ShotVariationPicker';
import { BrollSequenceEditor } from './BrollSequenceEditor';
import { 
  GripVertical, Trash2, User, Image, Film, Loader2, CheckCircle, 
  AlertCircle, Upload, Sparkles, X, RefreshCw, ImagePlus, Check, Camera, Video
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface SegmentCardProps {
  segment: CommercialSegment;
  index: number;
  onUpdate: (id: string, updates: Partial<CommercialSegment>) => void;
  onDelete: (id: string) => void;
  onDragStart: () => void;
  onDragEnd: () => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: () => void;
  onGenerateBrollImages?: (segmentId: string) => Promise<void>;
  isGeneratingImages?: boolean;
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
  onDrop,
  onGenerateBrollImages,
  isGeneratingImages
}: SegmentCardProps) {
  const Icon = segmentTypeIcons[segment.type];
  const status = segment.status || 'pending';
  const fileInputRef = useRef<HTMLInputElement>(null);
  const replaceInputRef = useRef<HTMLInputElement>(null);
  const [isDescribing, setIsDescribing] = useState(false);
  const [replacingIndex, setReplacingIndex] = useState<number | null>(null);
  const [regeneratingIndex, setRegeneratingIndex] = useState<number | null>(null);

  // Use brollSlots if available, otherwise fall back to legacy brollImages/brollPrompts
  const brollSlots: BrollImageSlot[] = segment.brollSlots || 
    (segment.brollPrompts || []).map((prompt, i) => ({
      prompt,
      imageUrl: segment.brollImages?.[i],
      status: segment.brollImages?.[i] ? 'complete' : 'pending'
    }));

  const hasAllImages = brollSlots.length > 0 && brollSlots.every(slot => slot.imageUrl);
  const hasSomeImages = brollSlots.some(slot => slot.imageUrl);
  const needsImages = brollSlots.length > 0 && !hasAllImages;

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error('Please sign in to upload images');
        return;
      }

      const fileName = `${user.id}/${crypto.randomUUID()}.${file.name.split('.').pop()}`;
      const { error: uploadError } = await supabase.storage
        .from('reels')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('reels')
        .getPublicUrl(fileName);

      // Add to brollSlots
      const newSlots: BrollImageSlot[] = [
        ...brollSlots,
        { prompt: '', imageUrl: publicUrl, status: 'complete' }
      ];
      
      const newImages = newSlots.map(s => s.imageUrl).filter(Boolean) as string[];
      const newPrompts = newSlots.map(s => s.prompt);
      
      onUpdate(segment.id, { 
        brollSlots: newSlots,
        brollImages: newImages,
        brollPrompts: newPrompts 
      });

      toast.success('Image uploaded');
      await describeImage(publicUrl, newSlots.length - 1);
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('Failed to upload image');
    }

    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleReplaceImage = async (e: React.ChangeEvent<HTMLInputElement>, slotIndex: number) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error('Please sign in to upload images');
        return;
      }

      const fileName = `${user.id}/${crypto.randomUUID()}.${file.name.split('.').pop()}`;
      const { error: uploadError } = await supabase.storage
        .from('reels')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('reels')
        .getPublicUrl(fileName);

      // Update the specific slot
      const newSlots = [...brollSlots];
      newSlots[slotIndex] = { ...newSlots[slotIndex], imageUrl: publicUrl, status: 'complete' };
      
      const newImages = newSlots.map(s => s.imageUrl).filter(Boolean) as string[];
      
      onUpdate(segment.id, { 
        brollSlots: newSlots,
        brollImages: newImages
      });

      toast.success('Image replaced');
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('Failed to replace image');
    }

    if (replaceInputRef.current) replaceInputRef.current.value = '';
    setReplacingIndex(null);
  };

  const regenerateSingleImage = async (slotIndex: number) => {
    const slot = brollSlots[slotIndex];
    if (!slot?.prompt) {
      toast.error('No prompt available for this slot');
      return;
    }

    setRegeneratingIndex(slotIndex);
    
    try {
      const { data, error } = await supabase.functions.invoke('generate-scene-image', {
        body: { prompt: slot.prompt, sceneType: 'commercial' }
      });

      if (error) throw error;
      if (!data?.imageUrl) throw new Error('No image generated');

      const newSlots = [...brollSlots];
      newSlots[slotIndex] = { ...newSlots[slotIndex], imageUrl: data.imageUrl, status: 'complete' };
      
      const newImages = newSlots.map(s => s.imageUrl).filter(Boolean) as string[];
      
      onUpdate(segment.id, { 
        brollSlots: newSlots,
        brollImages: newImages
      });

      toast.success('Image regenerated');
    } catch (error) {
      console.error('Regenerate error:', error);
      toast.error('Failed to regenerate image');
    } finally {
      setRegeneratingIndex(null);
    }
  };

  const describeImage = async (imageUrl: string, imageIndex: number) => {
    setIsDescribing(true);
    try {
      const { data, error } = await supabase.functions.invoke('describe-scene', {
        body: { imageUrl }
      });

      if (error) throw error;

      const description = data?.description || 'Scene description';
      
      const newSlots = [...brollSlots];
      if (newSlots[imageIndex]) {
        newSlots[imageIndex] = { ...newSlots[imageIndex], prompt: description };
      }
      
      const newPrompts = newSlots.map(s => s.prompt);
      onUpdate(segment.id, { brollSlots: newSlots, brollPrompts: newPrompts });
      toast.success('AI described your image');
    } catch (error) {
      console.error('Describe error:', error);
      toast.error('Failed to describe image');
    } finally {
      setIsDescribing(false);
    }
  };

  const removeImage = (imageIndex: number) => {
    const newSlots = brollSlots.filter((_, i) => i !== imageIndex);
    const newImages = newSlots.map(s => s.imageUrl).filter(Boolean) as string[];
    const newPrompts = newSlots.map(s => s.prompt);
    
    onUpdate(segment.id, { 
      brollSlots: newSlots,
      brollImages: newImages,
      brollPrompts: newPrompts
    });
  };

  const approveImages = () => {
    onUpdate(segment.id, { imagesApproved: true });
    toast.success('B-roll images approved');
  };

  const isBrollSegment = segment.type === 'broll-voice-continue' || segment.type === 'broll-montage';

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
            {isBrollSegment && segment.imagesApproved && (
              <Badge className="bg-emerald-500/20 text-emerald-500 gap-1">
                <Check className="h-3 w-3" />
                Images Ready
              </Badge>
            )}
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
            
            {!segment.twinId && segment.personaDescription && (
              <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles className="h-4 w-4 text-primary" />
                  <Label className="text-primary font-medium">AI-Generated Persona</Label>
                </div>
                <p className="text-sm text-muted-foreground">{segment.personaDescription}</p>
              </div>
            )}
            
            <div className="space-y-2">
              <Label>Script (What they say)</Label>
              <Textarea
                placeholder="Enter what this speaker will say..."
                value={segment.script || ''}
                onChange={(e) => onUpdate(segment.id, { script: e.target.value })}
                rows={3}
              />
            </div>

            {/* Multi-Angle A-Roll Shot Variations */}
            {segment.arollVariations && segment.arollVariations.length > 0 && (
              <ShotVariationPicker
                variations={segment.arollVariations}
                selectedIndex={segment.selectedArollIndex || 0}
                onSelect={(index) => onUpdate(segment.id, { selectedArollIndex: index })}
                onUpdate={(variations) => onUpdate(segment.id, { arollVariations: variations })}
                personaDescription={segment.personaDescription}
              />
            )}

            {/* Visual Context Display */}
            {segment.visualContext && (
              <div className="p-3 rounded-lg bg-muted/50 border border-border">
                <div className="flex items-center gap-2 mb-2">
                  <Camera className="h-4 w-4 text-muted-foreground" />
                  <Label className="text-sm font-medium">Visual Context</Label>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                  {segment.visualContext.location && (
                    <div><span className="font-medium">Location:</span> {segment.visualContext.location}</div>
                  )}
                  {segment.visualContext.lighting && (
                    <div><span className="font-medium">Lighting:</span> {segment.visualContext.lighting}</div>
                  )}
                  {segment.visualContext.atmosphere && (
                    <div><span className="font-medium">Atmosphere:</span> {segment.visualContext.atmosphere}</div>
                  )}
                  {segment.visualContext.colorPalette && (
                    <div><span className="font-medium">Colors:</span> {segment.visualContext.colorPalette}</div>
                  )}
                </div>
              </div>
            )}
          </>
        )}

        {segment.type === 'broll-voice-continue' && (
          <div className="space-y-4">
            {/* B-Roll Image Gallery */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="flex items-center gap-2">
                  B-Roll Image
                  {isDescribing && <Loader2 className="h-3 w-3 animate-spin" />}
                </Label>
                {brollSlots.length > 0 && brollSlots[0]?.prompt && !brollSlots[0]?.imageUrl && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onGenerateBrollImages?.(segment.id)}
                    disabled={isGeneratingImages}
                    className="gap-1"
                  >
                    {isGeneratingImages ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <ImagePlus className="h-3 w-3" />
                    )}
                    Generate Image
                  </Button>
                )}
              </div>
              
              {/* Show generated image with controls */}
              {brollSlots.length > 0 && brollSlots[0]?.imageUrl && (
                <div className="relative w-full aspect-video rounded-lg overflow-hidden border border-border group">
                  <img 
                    src={brollSlots[0].imageUrl} 
                    alt="B-roll" 
                    className="w-full h-full object-cover"
                  />
                  {/* Overlay controls */}
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => regenerateSingleImage(0)}
                      disabled={regeneratingIndex === 0}
                    >
                      {regeneratingIndex === 0 ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <RefreshCw className="h-4 w-4" />
                      )}
                      Regenerate
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        setReplacingIndex(0);
                        replaceInputRef.current?.click();
                      }}
                    >
                      <Upload className="h-4 w-4" />
                      Replace
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => removeImage(0)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}

              {/* Upload button when no image */}
              {(!brollSlots.length || !brollSlots[0]?.imageUrl) && !brollSlots[0]?.prompt && (
                <div 
                  className="border-2 border-dashed border-border rounded-lg p-6 text-center cursor-pointer hover:border-primary/50 transition-colors"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    Upload an image for B-roll
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    AI will describe it automatically
                  </p>
                </div>
              )}

              {/* Show prompt waiting for image generation */}
              {brollSlots.length > 0 && brollSlots[0]?.prompt && !brollSlots[0]?.imageUrl && (
                <div className="border-2 border-dashed border-primary/30 rounded-lg p-4 bg-primary/5">
                  <div className="flex items-center gap-2 mb-2">
                    <Sparkles className="h-4 w-4 text-primary" />
                    <span className="text-sm font-medium text-primary">Ready to Generate</span>
                  </div>
                  <p className="text-sm text-muted-foreground line-clamp-2">{brollSlots[0].prompt}</p>
                </div>
              )}

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleImageUpload}
              />
              <input
                ref={replaceInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => replacingIndex !== null && handleReplaceImage(e, replacingIndex)}
              />
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                AI Description
                {isDescribing && <Sparkles className="h-3 w-3 text-primary animate-pulse" />}
              </Label>
              <Textarea
                placeholder="AI will describe your uploaded image..."
                value={brollSlots[0]?.prompt || segment.brollPrompts?.[0] || ''}
                onChange={(e) => {
                  const newSlots: BrollImageSlot[] = brollSlots.length > 0 
                    ? [{ ...brollSlots[0], prompt: e.target.value }]
                    : [{ prompt: e.target.value, status: 'pending' }];
                  onUpdate(segment.id, { 
                    brollSlots: newSlots,
                    brollPrompts: [e.target.value] 
                  });
                }}
                rows={2}
              />
            </div>
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

            {/* B-Roll Sequence Editor for cinematic montages */}
            {segment.brollSequence && (
              <BrollSequenceEditor
                sequence={segment.brollSequence}
                onUpdate={(updatedSequence) => onUpdate(segment.id, { brollSequence: updatedSequence })}
                isGenerating={isGeneratingImages}
              />
            )}
            
            {/* B-Roll Images Gallery for montage */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="flex items-center gap-2">
                  B-Roll Images
                  {isDescribing && <Loader2 className="h-3 w-3 animate-spin" />}
                </Label>
                <div className="flex items-center gap-2">
                  {needsImages && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onGenerateBrollImages?.(segment.id)}
                      disabled={isGeneratingImages}
                      className="gap-1"
                    >
                      {isGeneratingImages ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <ImagePlus className="h-3 w-3" />
                      )}
                      Generate Missing
                    </Button>
                  )}
                  {hasAllImages && !segment.imagesApproved && (
                    <Button
                      size="sm"
                      variant="default"
                      onClick={approveImages}
                      className="gap-1"
                    >
                      <Check className="h-3 w-3" />
                      Approve All
                    </Button>
                  )}
                </div>
              </div>
              
              {/* Image Grid */}
              <div className="grid grid-cols-5 gap-2">
                {brollSlots.map((slot, i) => (
                  <div 
                    key={i} 
                    className="relative aspect-square rounded-lg overflow-hidden border border-border group"
                  >
                    {slot.imageUrl ? (
                      <>
                        <img src={slot.imageUrl} alt={`B-roll ${i + 1}`} className="w-full h-full object-cover" />
                        {/* Hover controls */}
                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1 p-1">
                          <Button
                            size="icon"
                            variant="secondary"
                            className="h-6 w-6"
                            onClick={() => regenerateSingleImage(i)}
                            disabled={regeneratingIndex === i}
                          >
                            {regeneratingIndex === i ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <RefreshCw className="h-3 w-3" />
                            )}
                          </Button>
                          <Button
                            size="icon"
                            variant="secondary"
                            className="h-6 w-6"
                            onClick={() => {
                              setReplacingIndex(i);
                              replaceInputRef.current?.click();
                            }}
                          >
                            <Upload className="h-3 w-3" />
                          </Button>
                          <Button
                            size="icon"
                            variant="destructive"
                            className="h-6 w-6"
                            onClick={() => removeImage(i)}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      </>
                    ) : slot.prompt ? (
                      <div className="w-full h-full bg-primary/10 flex flex-col items-center justify-center p-1">
                        {slot.status === 'generating' ? (
                          <Loader2 className="h-4 w-4 text-primary animate-spin" />
                        ) : (
                          <ImagePlus className="h-4 w-4 text-primary/50" />
                        )}
                        <span className="text-[8px] text-center text-muted-foreground mt-1 line-clamp-2">
                          {slot.prompt.slice(0, 30)}...
                        </span>
                      </div>
                    ) : (
                      <div 
                        className="w-full h-full flex items-center justify-center cursor-pointer hover:bg-muted/50 transition-colors"
                        onClick={() => fileInputRef.current?.click()}
                      >
                        <Upload className="h-4 w-4 text-muted-foreground" />
                      </div>
                    )}
                  </div>
                ))}
                
                {brollSlots.length < 5 && (
                  <div 
                    className="aspect-square border-2 border-dashed border-border rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-primary/50 transition-colors"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload className="h-4 w-4 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground mt-1">Add</span>
                  </div>
                )}
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleImageUpload}
              />
              <input
                ref={replaceInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => replacingIndex !== null && handleReplaceImage(e, replacingIndex)}
              />
            </div>

            <div className="space-y-2">
              <Label>B-Roll Descriptions</Label>
              <Textarea
                placeholder="Enter prompts for B-roll images (one per line)"
                value={brollSlots.map(s => s.prompt).join('\n') || segment.brollPrompts?.join('\n') || ''}
                onChange={(e) => {
                  const prompts = e.target.value.split('\n').filter(p => p.trim());
                  const newSlots: BrollImageSlot[] = prompts.map((prompt, i) => ({
                    prompt,
                    imageUrl: brollSlots[i]?.imageUrl,
                    status: brollSlots[i]?.imageUrl ? 'complete' : 'pending'
                  }));
                  onUpdate(segment.id, { 
                    brollSlots: newSlots,
                    brollPrompts: prompts 
                  });
                }}
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
