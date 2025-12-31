import { useState } from 'react';
import { ShotVariation, CameraAngle, CameraMovement } from '@/types/testimonialCommercial';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Camera, Video, Loader2, CheckCircle, RefreshCw, 
  ImagePlus, Eye
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface ShotVariationPickerProps {
  variations: ShotVariation[];
  selectedIndex: number;
  onSelect: (index: number) => void;
  onUpdate: (variations: ShotVariation[]) => void;
  personaDescription?: string;
}

const angleLabels: Record<CameraAngle, string> = {
  'extreme-wide': 'Extreme Wide',
  'wide': 'Wide Shot',
  'medium-wide': 'Medium Wide',
  'medium': 'Medium Shot',
  'medium-close': 'Medium Close',
  'close-up': 'Close-Up',
  'extreme-close-up': 'Extreme CU',
  'over-shoulder': 'Over Shoulder',
  'two-shot': 'Two Shot',
  'low-angle': 'Low Angle',
  'high-angle': 'High Angle',
  'dutch-angle': 'Dutch Angle',
  'birds-eye': 'Birds Eye',
  'worms-eye': 'Worms Eye',
  'pov': 'POV',
  'profile': 'Profile',
  'three-quarter': '3/4 View'
};

const movementLabels: Record<CameraMovement, string> = {
  'locked-off': 'Locked',
  'subtle-float': 'Float',
  'breathing': 'Breathing',
  'slow-zoom-in': 'Slow Zoom In',
  'fast-zoom-in': 'Fast Zoom',
  'slow-zoom-out': 'Zoom Out',
  'crash-zoom': 'Crash Zoom',
  'zoom-to-close-up': 'Zoom to CU',
  'zoom-from-detail': 'Zoom From Detail',
  'dolly-in': 'Dolly In',
  'dolly-out': 'Dolly Out',
  'dolly-around': 'Dolly Around',
  'push-in-dramatic': 'Push In',
  'pull-back-reveal': 'Pull Back',
  'slow-pan-left': 'Pan Left',
  'slow-pan-right': 'Pan Right',
  'whip-pan': 'Whip Pan',
  'pan-reveal': 'Pan Reveal',
  'pan-follow': 'Pan Follow',
  'pan-across-room': 'Pan Room',
  'corner-reveal-pan': 'Corner Reveal',
  'tilt-up': 'Tilt Up',
  'tilt-down': 'Tilt Down',
  'tilt-reveal': 'Tilt Reveal',
  'tracking-alongside': 'Track Side',
  'tracking-behind': 'Track Behind',
  'tracking-in-front': 'Track Front',
  'steadicam-float': 'Steadicam',
  'gimbal-glide': 'Gimbal',
  'handheld-subtle': 'Handheld',
  'handheld-energetic': 'Handheld+',
  'shaky-cam': 'Shaky',
  'crane-up': 'Crane Up',
  'crane-down': 'Crane Down',
  'jib-sweep': 'Jib Sweep',
  'dolly-zoom': 'Dolly Zoom',
  'orbit': 'Orbit',
  'arc-left': 'Arc Left',
  'arc-right': 'Arc Right',
  'boom-down-to-eye-level': 'Boom Down',
  'rise-and-reveal': 'Rise Reveal'
};

const angleColors: Record<CameraAngle, string> = {
  'extreme-wide': 'bg-indigo-500/20 text-indigo-500',
  'wide': 'bg-blue-500/20 text-blue-500',
  'medium-wide': 'bg-sky-500/20 text-sky-500',
  'medium': 'bg-green-500/20 text-green-500',
  'medium-close': 'bg-emerald-500/20 text-emerald-500',
  'close-up': 'bg-amber-500/20 text-amber-500',
  'extreme-close-up': 'bg-orange-500/20 text-orange-500',
  'over-shoulder': 'bg-purple-500/20 text-purple-500',
  'two-shot': 'bg-violet-500/20 text-violet-500',
  'low-angle': 'bg-red-500/20 text-red-500',
  'high-angle': 'bg-cyan-500/20 text-cyan-500',
  'dutch-angle': 'bg-pink-500/20 text-pink-500',
  'birds-eye': 'bg-teal-500/20 text-teal-500',
  'worms-eye': 'bg-rose-500/20 text-rose-500',
  'pov': 'bg-orange-500/20 text-orange-500',
  'profile': 'bg-fuchsia-500/20 text-fuchsia-500',
  'three-quarter': 'bg-lime-500/20 text-lime-500'
};

export function ShotVariationPicker({
  variations,
  selectedIndex,
  onSelect,
  onUpdate,
  personaDescription
}: ShotVariationPickerProps) {
  const [generatingIndex, setGeneratingIndex] = useState<number | null>(null);
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);

  const generateImage = async (index: number) => {
    const variation = variations[index];
    if (!variation?.prompt) return;

    setGeneratingIndex(index);

    try {
      // Enhance prompt with persona and movement details
      let enhancedPrompt = variation.prompt;
      if (personaDescription) {
        enhancedPrompt = `${variation.prompt}. The subject is: ${personaDescription}`;
      }
      if (variation.movementDescription) {
        enhancedPrompt += `. Camera movement: ${variation.movementDescription}`;
      }

      const { data, error } = await supabase.functions.invoke('generate-scene-image', {
        body: { prompt: enhancedPrompt, sceneType: 'commercial' }
      });

      if (error) throw error;

      const updatedVariations = [...variations];
      updatedVariations[index] = {
        ...updatedVariations[index],
        imageUrl: data?.imageUrl,
        status: data?.imageUrl ? 'complete' : 'error'
      };

      onUpdate(updatedVariations);
      toast.success(`Generated ${angleLabels[variation.angle]} shot`);
    } catch (error) {
      console.error('Failed to generate image:', error);
      toast.error('Failed to generate image');
      
      const updatedVariations = [...variations];
      updatedVariations[index] = { ...updatedVariations[index], status: 'error' };
      onUpdate(updatedVariations);
    } finally {
      setGeneratingIndex(null);
    }
  };

  const generateAllImages = async () => {
    for (let i = 0; i < variations.length; i++) {
      if (!variations[i].imageUrl) {
        await generateImage(i);
      }
    }
  };

  const hasAllImages = variations.every(v => v.imageUrl);

  return (
    <Card className="border-primary/20">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <Camera className="h-4 w-4 text-primary" />
            Multi-Angle Coverage
          </CardTitle>
          {!hasAllImages && (
            <Button
              size="sm"
              variant="outline"
              onClick={generateAllImages}
              disabled={generatingIndex !== null}
              className="gap-1"
            >
              {generatingIndex !== null ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <ImagePlus className="h-3 w-3" />
              )}
              Generate All
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-3">
          {variations.map((variation, index) => (
            <div
              key={variation.id}
              className={`relative rounded-lg overflow-hidden border-2 cursor-pointer transition-all ${
                selectedIndex === index 
                  ? 'border-primary ring-2 ring-primary/30' 
                  : 'border-border hover:border-primary/50'
              }`}
              onClick={() => onSelect(index)}
            >
              {/* Thumbnail */}
              <div className="aspect-video bg-muted relative">
                {variation.imageUrl ? (
                  <img 
                    src={variation.imageUrl} 
                    alt={`${angleLabels[variation.angle]} preview`}
                    className="w-full h-full object-cover"
                  />
                ) : variation.status === 'generating' || generatingIndex === index ? (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Loader2 className="h-6 w-6 text-primary animate-spin" />
                  </div>
                ) : (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 p-2">
                    <Camera className="h-6 w-6 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground text-center line-clamp-2">
                      {variation.movementDescription?.slice(0, 50) || variation.prompt?.slice(0, 40)}...
                    </span>
                  </div>
                )}

                {/* Selection indicator */}
                {selectedIndex === index && (
                  <div className="absolute top-1 right-1">
                    <CheckCircle className="h-4 w-4 text-primary fill-background" />
                  </div>
                )}

                {/* Hover overlay for existing images */}
                {variation.imageUrl && (
                  <div className="absolute inset-0 bg-black/60 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                    <Button
                      size="icon"
                      variant="secondary"
                      className="h-7 w-7"
                      onClick={(e) => {
                        e.stopPropagation();
                        setPreviewIndex(index);
                      }}
                    >
                      <Eye className="h-3 w-3" />
                    </Button>
                    <Button
                      size="icon"
                      variant="secondary"
                      className="h-7 w-7"
                      onClick={(e) => {
                        e.stopPropagation();
                        generateImage(index);
                      }}
                      disabled={generatingIndex === index}
                    >
                      {generatingIndex === index ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <RefreshCw className="h-3 w-3" />
                      )}
                    </Button>
                  </div>
                )}

                {/* Generate button for missing images */}
                {!variation.imageUrl && generatingIndex !== index && (
                  <Button
                    size="sm"
                    variant="secondary"
                    className="absolute bottom-1 left-1 right-1 h-6 text-xs"
                    onClick={(e) => {
                      e.stopPropagation();
                      generateImage(index);
                    }}
                  >
                    <ImagePlus className="h-3 w-3 mr-1" />
                    Generate
                  </Button>
                )}
              </div>

              {/* Labels */}
              <div className="p-2 bg-card">
                <div className="flex items-center gap-1 flex-wrap">
                  <Badge variant="outline" className={`text-[10px] ${angleColors[variation.angle]}`}>
                    {angleLabels[variation.angle]}
                  </Badge>
                  <Badge variant="outline" className="text-[10px]">
                    {movementLabels[variation.movement]}
                  </Badge>
                </div>
                {variation.movementDescription && (
                  <p className="text-[9px] text-muted-foreground mt-1 line-clamp-2">
                    {variation.movementDescription}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Selected variation info */}
        {variations[selectedIndex] && (
          <div className="mt-3 p-3 bg-muted rounded-lg space-y-2">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Video className="h-3 w-3" />
              <span>Selected: {angleLabels[variations[selectedIndex].angle]} • {variations[selectedIndex].duration}s</span>
            </div>
            {variations[selectedIndex].movementDescription && (
              <p className="text-xs text-muted-foreground">
                <strong>Movement:</strong> {variations[selectedIndex].movementDescription}
              </p>
            )}
            {variations[selectedIndex].startFrame && (
              <p className="text-xs text-muted-foreground">
                <strong>Start:</strong> {variations[selectedIndex].startFrame}
              </p>
            )}
            {variations[selectedIndex].endFrame && (
              <p className="text-xs text-muted-foreground">
                <strong>End:</strong> {variations[selectedIndex].endFrame}
              </p>
            )}
          </div>
        )}

        {/* Full preview modal */}
        {previewIndex !== null && variations[previewIndex]?.imageUrl && (
          <div 
            className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
            onClick={() => setPreviewIndex(null)}
          >
            <img 
              src={variations[previewIndex].imageUrl} 
              alt="Preview"
              className="max-w-full max-h-full object-contain rounded-lg"
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
