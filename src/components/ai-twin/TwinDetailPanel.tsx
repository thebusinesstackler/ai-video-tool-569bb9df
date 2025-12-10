import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { 
  CAMERA_ANGLES, 
  CAMERA_CATEGORIES, 
  getCameraAnglesByCategory,
  type CameraAngle 
} from '@/data/cameraAngles';
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
  X
} from 'lucide-react';

interface AITwin {
  id: string;
  name: string;
  reference_images: string[];
  voice_cloning_key: string | null;
  voice_sample_url: string | null;
  description: string | null;
  face_description: string | null;
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

  const categoryAngles = getCameraAnglesByCategory(selectedCategory as any);

  const handleCreateMovie = () => {
    // Navigate to movies page with this twin pre-selected
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
    // Navigate to reels page with this twin pre-selected
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
      const prompt = `Generate a ${angle.promptModifier} of this person. ${twin.face_description || twin.description || 'Maintain the same person\'s appearance, face, and features.'}. Photorealistic, high quality, professional photography.`;

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
          {twin.description && (
            <p className="text-muted-foreground mt-1">{twin.description}</p>
          )}
          <div className="flex items-center gap-2 mt-3">
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

      {/* Face Description */}
      {twin.face_description && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <User className="w-4 h-4" />
              Face Description
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
          {/* Category Tabs */}
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

          {/* Camera Angles Grid */}
          <ScrollArea className="h-72">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 pr-4">
              {categoryAngles.map(angle => (
                <Button
                  key={angle.id}
                  variant="outline"
                  className="h-24 flex-col items-start justify-start p-3 text-left hover:bg-primary hover:text-primary-foreground hover:border-primary transition-colors"
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
