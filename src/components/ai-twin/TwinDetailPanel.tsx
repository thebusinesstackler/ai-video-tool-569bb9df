import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { 
  CAMERA_ANGLES, 
  CAMERA_CATEGORIES, 
  getCameraAnglesByCategory,
  type CameraAngle 
} from '@/data/cameraAngles';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { 
  Film, 
  Video, 
  Camera, 
  Loader2, 
  Plus, 
  Volume2, 
  ImageIcon,
  Sparkles,
  User,
  Wand2,
  X,
  Edit2,
  Save,
  XCircle
} from 'lucide-react';

interface AITwin {
  id: string;
  name: string;
  reference_images: string[];
  voice_cloning_key: string | null;
  voice_sample_url: string | null;
  description: string | null;
  face_description: string | null;
  gender: string | null;
}

interface TwinDetailPanelProps {
  twin: AITwin;
  onUpdate: () => void;
}

export const TwinDetailPanel: React.FC<TwinDetailPanelProps> = ({ twin, onUpdate }) => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [selectedCategory, setSelectedCategory] = useState<string>('framing');
  const [selectedAngle, setSelectedAngle] = useState<CameraAngle | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedImages, setGeneratedImages] = useState<string[]>([]);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [customPrompt, setCustomPrompt] = useState<string>('');
  const [selectedPose, setSelectedPose] = useState<string | null>(null);
  
  // Editable fields
  const [isEditingDescription, setIsEditingDescription] = useState(false);
  const [editedDescription, setEditedDescription] = useState(twin.description || '');
  const [isSavingDescription, setIsSavingDescription] = useState(false);

  const POSE_PRESETS = [
    { id: 'standing', label: 'Standing', prompt: 'standing upright, full body visible' },
    { id: 'sitting', label: 'Sitting', prompt: 'sitting down comfortably' },
    { id: 'walking', label: 'Walking', prompt: 'walking naturally, mid-stride' },
    { id: 'arms-crossed', label: 'Arms Crossed', prompt: 'standing with arms crossed confidently' },
    { id: 'hands-pockets', label: 'Hands in Pockets', prompt: 'standing casually with hands in pockets' },
    { id: 'leaning', label: 'Leaning', prompt: 'leaning against a wall or surface' },
    { id: 'gesturing', label: 'Gesturing', prompt: 'gesturing while speaking, expressive hands' },
    { id: 'thinking', label: 'Thinking', prompt: 'in a thoughtful pose, hand near chin' },
  ];

  const categoryAngles = getCameraAnglesByCategory(selectedCategory as any);

  const handleCreateMovie = () => {
    navigate('/movies', { 
      state: { 
        selectedTwin: twin,
        twinId: twin.id,
        twinName: twin.name,
        twinDescription: twin.description,
        referenceImage: twin.reference_images?.[0]
      }
    });
  };

  const handleCreateReel = () => {
    navigate('/reels', { 
      state: { 
        selectedTwin: twin,
        twinId: twin.id,
        twinName: twin.name,
        twinDescription: twin.description,
        referenceImage: twin.reference_images?.[0]
      }
    });
  };

  const saveDescription = async () => {
    setIsSavingDescription(true);
    try {
      const { error } = await supabase
        .from('ai_twins')
        .update({ description: editedDescription.trim() || null })
        .eq('id', twin.id);

      if (error) throw error;

      toast({
        title: 'Description saved',
        description: 'Your AI Twin description has been updated'
      });
      setIsEditingDescription(false);
      onUpdate();
    } catch (error: any) {
      console.error('Error saving description:', error);
      toast({
        title: 'Error',
        description: 'Failed to save description',
        variant: 'destructive'
      });
    } finally {
      setIsSavingDescription(false);
    }
  };

  const generateTwinImage = async (angle: CameraAngle) => {
    if (!twin.reference_images?.[0]) {
      toast({
        title: 'No reference image',
        description: 'This twin needs at least one reference image',
        variant: 'destructive'
      });
      return;
    }

    setIsGenerating(true);
    setSelectedAngle(angle);

    try {
      // Build a more specific prompt that emphasizes keeping the same person
      const faceDesc = twin.face_description || twin.description || '';
      const customContext = customPrompt ? ` Scene context: ${customPrompt}.` : '';
      
      // Include selected pose in the prompt
      const poseContext = selectedPose 
        ? ` Pose: ${POSE_PRESETS.find(p => p.id === selectedPose)?.prompt || ''}.`
        : '';
      
      // Improved prompt structure for better consistency
      const prompt = `Create a photorealistic image of THIS EXACT PERSON from the reference image. 
Camera angle: ${angle.promptModifier}. 
${faceDesc ? `Person description: ${faceDesc}.` : 'Keep the exact same face, features, skin tone, and appearance as the reference.'}
${poseContext}${customContext}
CRITICAL: The person in the generated image MUST look identical to the reference - same face shape, eyes, nose, mouth, hair, and overall appearance. 
Style: Professional photography, high quality, sharp focus on the subject.`;

      const { data, error } = await supabase.functions.invoke('generate-scene-image', {
        body: {
          prompt,
          referenceImageUrl: twin.reference_images[0],
          characterDescription: twin.face_description || twin.description
        }
      });

      if (error) throw error;

      if (data?.imageUrl) {
        setGeneratedImages(prev => [data.imageUrl, ...prev]);
        
        // Save to twin's reference images
        const updatedImages = [...(twin.reference_images || []), data.imageUrl];
        const { error: updateError } = await supabase
          .from('ai_twins')
          .update({ reference_images: updatedImages })
          .eq('id', twin.id);

        if (updateError) {
          console.error('Failed to save image to twin:', updateError);
        } else {
          onUpdate();
        }

        // Also save to gallery (generated_images table)
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { error: galleryError } = await supabase
            .from('generated_images')
            .insert({
              user_id: user.id,
              image_url: data.imageUrl,
              prompt: prompt,
              source: 'ai-twin',
              reference_image_url: twin.reference_images[0]
            });

          if (galleryError) {
            console.error('Failed to save to gallery:', galleryError);
          }
        }

        toast({
          title: 'Image generated & saved',
          description: `${angle.name} shot saved to twin and gallery`
        });
      }
    } catch (error: any) {
      console.error('Error generating image:', error);
      toast({
        title: 'Generation failed',
        description: error.message || 'Failed to generate image',
        variant: 'destructive'
      });
    } finally {
      setIsGenerating(false);
      setSelectedAngle(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Twin Info Header */}
      <div className="flex items-start gap-4">
        {twin.reference_images?.[0] && (
          <img 
            src={twin.reference_images[0]} 
            alt={twin.name}
            className="w-24 h-24 rounded-lg object-cover"
          />
        )}
        <div className="flex-1">
          <h2 className="text-2xl font-bold">{twin.name}</h2>
          {twin.gender && (
            <Badge variant="outline" className="mt-1 capitalize">{twin.gender}</Badge>
          )}
          <div className="flex items-center gap-2 mt-3 flex-wrap">
            <Badge variant={twin.voice_cloning_key ? "default" : "secondary"}>
              <Volume2 className="w-3 h-3 mr-1" />
              {twin.voice_cloning_key ? "Voice Cloned" : "No Voice"}
            </Badge>
            <Badge variant="outline">
              <ImageIcon className="w-3 h-3 mr-1" />
              {twin.reference_images?.length || 0} Images
            </Badge>
          </div>
        </div>
      </div>

      {/* Editable Description */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2">
              <User className="w-4 h-4" />
              Character Description
            </CardTitle>
            {!isEditingDescription && (
              <Button 
                size="sm" 
                variant="ghost" 
                onClick={() => {
                  setEditedDescription(twin.description || '');
                  setIsEditingDescription(true);
                }}
              >
                <Edit2 className="w-4 h-4 mr-1" />
                Edit
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {isEditingDescription ? (
            <div className="space-y-3">
              <Textarea
                value={editedDescription}
                onChange={(e) => setEditedDescription(e.target.value)}
                placeholder="Describe this person for movie generation. E.g., 'A tall African American man in his 30s with a short beard, confident demeanor, wearing business casual attire. He has warm brown eyes and a friendly smile.'"
                rows={4}
                className="resize-none"
              />
              <p className="text-xs text-muted-foreground">
                This description will be used in movie scripts and image generation to ensure consistent portrayal.
              </p>
              <div className="flex gap-2">
                <Button 
                  size="sm" 
                  onClick={saveDescription}
                  disabled={isSavingDescription}
                >
                  {isSavingDescription ? (
                    <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4 mr-1" />
                  )}
                  Save
                </Button>
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={() => setIsEditingDescription(false)}
                >
                  <XCircle className="w-4 h-4 mr-1" />
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              {twin.description || 'No description set. Click Edit to describe this AI Twin for accurate movie generation.'}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Face Description (AI-generated) */}
      {twin.face_description && (
        <Card className="bg-muted/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Sparkles className="w-4 h-4" />
              AI-Analyzed Face Description
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">{twin.face_description}</p>
          </CardContent>
        </Card>
      )}

      {/* Action Buttons */}
      <div className="grid grid-cols-2 gap-3">
        <Button 
          size="lg" 
          className="bg-gradient-primary hover:opacity-90"
          onClick={handleCreateMovie}
        >
          <Film className="w-5 h-5 mr-2" />
          Create Movie
        </Button>
        <Button 
          size="lg" 
          variant="outline"
          onClick={handleCreateReel}
        >
          <Video className="w-5 h-5 mr-2" />
          Create Reel/Story
        </Button>
      </div>

      {/* Reference Images Gallery */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <ImageIcon className="w-4 h-4" />
            Reference Images ({twin.reference_images?.length || 0})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 gap-2">
            {twin.reference_images?.map((img, idx) => (
              <img 
                key={idx}
                src={img}
                alt={`Reference ${idx + 1}`}
                className="w-full aspect-square object-cover rounded-lg hover:ring-2 hover:ring-primary transition-all cursor-pointer"
              />
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Generate More Images Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wand2 className="w-5 h-5" />
            Generate More Images
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Custom Prompt */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Scene Details (optional)</label>
            <Textarea
              placeholder="Describe the background, pose, or setting. E.g., 'standing in a modern office', 'sitting at a cafe', 'outdoor park with trees', 'wearing a suit', 'arms crossed confidently'"
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              className="h-20 resize-none"
            />
          </div>

          {/* Pose Presets */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Pose (optional)</label>
            <div className="flex flex-wrap gap-2">
              {POSE_PRESETS.map(pose => (
                <Button
                  key={pose.id}
                  size="sm"
                  variant={selectedPose === pose.id ? "default" : "outline"}
                  onClick={() => setSelectedPose(selectedPose === pose.id ? null : pose.id)}
                >
                  {pose.label}
                </Button>
              ))}
            </div>
          </div>

          {/* Category Tabs */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Camera Angle Category</label>
            <div className="flex flex-wrap gap-2">
              {CAMERA_CATEGORIES.map(cat => (
                <Button
                  key={cat.id}
                  size="sm"
                  variant={selectedCategory === cat.id ? "default" : "outline"}
                  onClick={() => setSelectedCategory(cat.id)}
                >
                  {cat.name}
                </Button>
              ))}
            </div>
          </div>

          {/* Camera Angles Grid */}
          <ScrollArea className="h-72">
            <div className="grid grid-cols-2 gap-4 pr-4">
              {categoryAngles.map(angle => (
                <Button
                  key={angle.id}
                  variant="outline"
                  className="min-h-32 h-auto flex-col items-start justify-start p-4 text-left overflow-hidden hover:bg-primary hover:text-primary-foreground hover:border-primary transition-colors"
                  disabled={isGenerating}
                  onClick={() => generateTwinImage(angle)}
                >
                  <div className="flex items-center gap-2 mb-1">
                    {isGenerating && selectedAngle?.id === angle.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Camera className="w-4 h-4" />
                    )}
                    <span className="font-medium text-sm">{angle.name}</span>
                  </div>
                  <span className="text-xs opacity-70 line-clamp-2">
                    {angle.description}
                  </span>
                </Button>
              ))}
            </div>
          </ScrollArea>

          {/* Recently Generated Images */}
          {generatedImages.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium flex items-center gap-2">
                <Sparkles className="w-4 h-4" />
                Just Generated (click to enlarge)
              </h4>
              <div className="flex gap-2 overflow-x-auto pb-2">
                {generatedImages.map((img, idx) => (
                  <img 
                    key={idx}
                    src={img}
                    alt={`Generated ${idx + 1}`}
                    className="w-20 h-20 object-cover rounded-lg flex-shrink-0 cursor-pointer hover:ring-2 hover:ring-primary transition-all"
                    onClick={() => setPreviewImage(img)}
                  />
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Image Preview Dialog */}
      <Dialog open={!!previewImage} onOpenChange={() => setPreviewImage(null)}>
        <DialogContent className="max-w-4xl p-2">
          <Button 
            size="icon" 
            variant="ghost" 
            className="absolute right-2 top-2 z-10"
            onClick={() => setPreviewImage(null)}
          >
            <X className="w-4 h-4" />
          </Button>
          {previewImage && (
            <img 
              src={previewImage}
              alt="Preview"
              className="w-full h-auto max-h-[80vh] object-contain rounded-lg"
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};
