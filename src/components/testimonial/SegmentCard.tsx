import { useState, useRef } from 'react';
import { CommercialSegment, TransitionType } from '@/types/testimonialCommercial';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { TwinSelector } from './TwinSelector';
import { GripVertical, Trash2, User, Image, Film, Loader2, CheckCircle, AlertCircle, Upload, Sparkles, X, Wand2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/components/AuthProvider';

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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDescribing, setIsDescribing] = useState(false);
  const [uploadedImages, setUploadedImages] = useState<string[]>(segment.brollImages || []);
  const [isGeneratingCharacter, setIsGeneratingCharacter] = useState(false);
  const { user } = useAuth();

  const handleGenerateCharacter = async (description: string) => {
    if (!user?.id || !description.trim()) return;
    
    setIsGeneratingCharacter(true);
    toast.info('Generating AI character with multiple angles...');
    
    try {
      // Generate a character image using AI
      const { data, error } = await supabase.functions.invoke('generate-scene-image', {
        body: {
          prompt: `Professional headshot portrait of ${description}. Clean studio lighting, neutral background, photorealistic, high quality, looking directly at camera.`,
          aspectRatio: '1:1'
        }
      });

      if (error) throw error;
      if (!data?.imageUrl) throw new Error('No image generated');

      // Create an AI Twin with this generated image
      const { data: twin, error: twinError } = await supabase
        .from('ai_twins')
        .insert({
          user_id: user.id,
          name: description.slice(0, 50),
          description,
          reference_images: [data.imageUrl],
        })
        .select('id, name')
        .single();

      if (twinError) throw twinError;

      // Auto-assign to this segment
      onUpdate(segment.id, { twinId: twin.id, twinName: twin.name });
      toast.success(`AI character "${twin.name}" created and assigned!`);
    } catch (err) {
      console.error('Character generation error:', err);
      toast.error('Failed to generate character');
    } finally {
      setIsGeneratingCharacter(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    
    try {
      // Get user ID
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error('Please sign in to upload images');
        return;
      }

      // Upload to storage
      const fileName = `${user.id}/${crypto.randomUUID()}.${file.name.split('.').pop()}`;
      const { error: uploadError } = await supabase.storage
        .from('reels')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('reels')
        .getPublicUrl(fileName);

      // Add to uploaded images
      const newImages = [...uploadedImages, publicUrl];
      setUploadedImages(newImages);
      onUpdate(segment.id, { brollImages: newImages });

      toast.success('Image uploaded');

      // Now describe the image with AI
      await describeImage(publicUrl, newImages.length - 1);
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('Failed to upload image');
    }

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
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
      
      // Update the brollPrompts with the AI description
      const currentPrompts = segment.brollPrompts || [];
      const newPrompts = [...currentPrompts];
      newPrompts[imageIndex] = description;
      
      onUpdate(segment.id, { brollPrompts: newPrompts });
      toast.success('AI described your image');
    } catch (error) {
      console.error('Describe error:', error);
      toast.error('Failed to describe image');
    } finally {
      setIsDescribing(false);
    }
  };

  const removeImage = (imageIndex: number) => {
    const newImages = uploadedImages.filter((_, i) => i !== imageIndex);
    setUploadedImages(newImages);
    
    const newPrompts = (segment.brollPrompts || []).filter((_, i) => i !== imageIndex);
    
    onUpdate(segment.id, { 
      brollImages: newImages,
      brollPrompts: newPrompts
    });
  };

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
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                B-Roll Image
                {isDescribing && <Loader2 className="h-3 w-3 animate-spin" />}
              </Label>
              
              {/* Uploaded image preview */}
              {uploadedImages.length > 0 && (
                <div className="relative w-full aspect-video rounded-lg overflow-hidden border border-border">
                  <img 
                    src={uploadedImages[0]} 
                    alt="B-roll" 
                    className="w-full h-full object-cover"
                  />
                  <Button
                    variant="destructive"
                    size="icon"
                    className="absolute top-2 right-2 h-6 w-6"
                    onClick={() => removeImage(0)}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              )}

              {/* Upload button */}
              {uploadedImages.length === 0 && (
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

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleImageUpload}
              />
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                AI Description
                {isDescribing && <Sparkles className="h-3 w-3 text-primary animate-pulse" />}
              </Label>
              <Textarea
                placeholder="AI will describe your uploaded image..."
                value={segment.brollPrompts?.[0] || ''}
                onChange={(e) => onUpdate(segment.id, { brollPrompts: [e.target.value] })}
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
            
            {/* B-Roll Images for montage */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                B-Roll Images (4-5 scenes)
                {isDescribing && <Loader2 className="h-3 w-3 animate-spin" />}
              </Label>
              
              <div className="grid grid-cols-5 gap-2">
                {uploadedImages.map((img, i) => (
                  <div key={i} className="relative aspect-square rounded-lg overflow-hidden border border-border">
                    <img src={img} alt={`B-roll ${i + 1}`} className="w-full h-full object-cover" />
                    <Button
                      variant="destructive"
                      size="icon"
                      className="absolute top-1 right-1 h-5 w-5"
                      onClick={() => removeImage(i)}
                    >
                      <X className="h-2 w-2" />
                    </Button>
                  </div>
                ))}
                
                {uploadedImages.length < 5 && (
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
            </div>

            <div className="space-y-2">
              <Label>B-Roll Descriptions (AI generated from images)</Label>
              <Textarea
                placeholder="Upload images above - AI will describe them"
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
