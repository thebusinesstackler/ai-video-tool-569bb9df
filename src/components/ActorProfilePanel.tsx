import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  Star, StarOff, Wand2, Loader2, Maximize2, Camera, X, Volume2,
  Pause, Download, Trash2, RefreshCw, ImageIcon, Sparkles, User,
  Film, Video, ChevronLeft
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';

const VOICE_TYPE_MAP: Record<string, string> = {
  'professional-female': 'English_compelling_lady1',
  'professional-male': 'lecture_man',
  'casual-female': 'English_radiant_girl',
  'casual-male': 'Casual_Guy',
  'energetic-female': 'English_radiant_girl',
  'energetic-male': 'Casual_Guy',
  'authoritative-female': 'English_compelling_lady1',
  'authoritative-male': 'lecture_man',
};

function mapVoiceId(voiceType: string): string {
  return VOICE_TYPE_MAP[voiceType] || 'Friendly_Person';
}

const BACKGROUND_KEYWORDS = ['background', 'setting', 'environment', 'scene', 'location', 'backdrop', 'surroundings'];

interface Character {
  id: string;
  name: string;
  description: string;
  referenceImages: string[];
  voiceType: string;
  kieVoiceId?: string;
  personality: string;
  createdAt: string;
}

interface ActorProfilePanelProps {
  character: Character;
  onClose: () => void;
  onUpdate: () => void;
}

export function ActorProfilePanel({ character, onClose, onUpdate }: ActorProfilePanelProps) {
  const navigate = useNavigate();
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [favoriteIndex, setFavoriteIndex] = useState(0);
  const [expandedImage, setExpandedImage] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationPrompt, setGenerationPrompt] = useState('');
  const [referenceImage, setReferenceImage] = useState<string | null>(null);
  const [isPreviewingVoice, setIsPreviewingVoice] = useState(false);
  const [isPlayingVoice, setIsPlayingVoice] = useState(false);
  const [voicePreviewUrl, setVoicePreviewUrl] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const images = character.referenceImages || [];
  const favoriteImage = images[favoriteIndex] || images[0];

  const handleSetFavorite = (index: number) => {
    setFavoriteIndex(index);
    toast.success('Favorite image updated');
  };

  const handleSelectAsReference = (imageUrl: string) => {
    setReferenceImage(imageUrl);
    setSelectedImage(null);
    toast.info('Image selected as reference — describe what to generate below');
  };

  const handleGenerateFromReference = async () => {
    if (!referenceImage || !generationPrompt.trim()) {
      toast.error('Select a reference image and describe what to generate');
      return;
    }

    setIsGenerating(true);
    try {
      const promptLower = generationPrompt.toLowerCase();
      const isBackgroundChange = BACKGROUND_KEYWORDS.some(kw => promptLower.includes(kw));

      const prompt = isBackgroundChange
        ? `Create a photorealistic image of THIS EXACT PERSON from the reference image.
${character.description ? `Person description: ${character.description}.` : ''}
BACKGROUND CHANGE: ${generationPrompt}.
CRITICAL: Keep the person COMPLETELY IDENTICAL — same face, features, skin tone, hair, clothing, pose, and expression. ONLY change the background/environment/setting as described. The person should look naturally placed in the new environment.
Style: Professional photography, high quality, cinematic lighting.`
        : `Create a photorealistic image of THIS EXACT PERSON from the reference image. 
${character.description ? `Person description: ${character.description}.` : ''}
New scene: ${generationPrompt}. 
CRITICAL: The person MUST look identical to the reference — same face, features, skin tone, hair, and overall appearance.
Style: Professional photography, high quality, cinematic lighting.`;

      const { data, error } = await supabase.functions.invoke('generate-scene-image', {
        body: {
          prompt,
          referenceImageUrl: referenceImage,
          characterDescription: character.description,
        }
      });

      if (error) throw error;

      if (data?.imageUrl) {
        // Save to character
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('Not authenticated');

        const updatedImages = [...images, data.imageUrl];
        await supabase
          .from('characters')
          .update({ reference_images: updatedImages })
          .eq('id', character.id);

        // Also save to gallery
        await supabase
          .from('generated_images')
          .insert({
            user_id: user.id,
            image_url: data.imageUrl,
            prompt,
            source: 'character-reference',
            reference_image_url: referenceImage,
          });

        toast.success('New image generated and saved!');
        setGenerationPrompt('');
        setReferenceImage(null);
        onUpdate();
      }
    } catch (err) {
      console.error('Generation error:', err);
      toast.error('Failed to generate image');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDeleteImage = async (index: number) => {
    const updatedImages = images.filter((_, i) => i !== index);
    try {
      await supabase
        .from('characters')
        .update({ reference_images: updatedImages })
        .eq('id', character.id);
      if (favoriteIndex >= updatedImages.length) setFavoriteIndex(Math.max(0, updatedImages.length - 1));
      toast.success('Image removed');
      onUpdate();
    } catch {
      toast.error('Failed to remove image');
    }
  };

  const handlePreviewVoice = async () => {
    setIsPreviewingVoice(true);
    try {
      const sampleText = `Hi, I'm ${character.name}. I'm ready to bring your vision to life.`;
      const { data, error } = await supabase.functions.invoke('text-to-speech', {
        body: { text: sampleText, voice_id: 'Friendly_Person' }
      });
      if (error) throw error;
      if (data?.audioUrl) {
        setVoicePreviewUrl(data.audioUrl);
        const audio = new Audio(data.audioUrl);
        audioRef.current = audio;
        audio.onended = () => setIsPlayingVoice(false);
        audio.play();
        setIsPlayingVoice(true);
      }
    } catch {
      toast.error('Voice preview failed');
    } finally {
      setIsPreviewingVoice(false);
    }
  };

  const toggleVoice = () => {
    if (!audioRef.current) return;
    if (isPlayingVoice) {
      audioRef.current.pause();
      setIsPlayingVoice(false);
    } else {
      audioRef.current.play();
      setIsPlayingVoice(true);
    }
  };

  const handleUseInMovie = () => {
    navigate('/movies', {
      state: {
        twinName: character.name,
        twinDescription: character.description,
        referenceImage: favoriteImage,
      }
    });
  };

  const handleUseInReel = () => {
    navigate('/reels', {
      state: {
        twinName: character.name,
        twinDescription: character.description,
        referenceImage: favoriteImage,
      }
    });
  };

  const handleUseInCommercial = () => {
    navigate('/testimonial-commercial', {
      state: {
        characterName: character.name,
        characterDescription: character.description,
        referenceImage: favoriteImage,
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* Hero Section */}
      <div className="flex gap-6">
        {/* Main/Favorite Image */}
        <div className="relative w-48 h-48 shrink-0 rounded-xl overflow-hidden border-2 border-primary/30 bg-muted">
          {favoriteImage ? (
            <img
              src={favoriteImage}
              alt={character.name}
              className="w-full h-full object-cover cursor-pointer"
              onClick={() => setExpandedImage(favoriteImage)}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <User className="h-12 w-12 text-muted-foreground" />
            </div>
          )}
          <Badge className="absolute top-2 left-2 gap-1 text-[10px] bg-primary/80">
            <Star className="h-2.5 w-2.5" /> Favorite
          </Badge>
        </div>

        {/* Profile Info */}
        <div className="flex-1 space-y-3">
          <div>
            <h2 className="text-xl font-bold text-foreground">{character.name}</h2>
            <p className="text-sm text-muted-foreground mt-1 line-clamp-3">{character.description}</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className="text-xs">{character.personality}</Badge>
            <Badge variant="secondary" className="text-xs">{character.voiceType}</Badge>
            <Badge variant="secondary" className="text-xs gap-1">
              <ImageIcon className="h-2.5 w-2.5" /> {images.length} images
            </Badge>
          </div>

          {/* Voice Preview */}
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              className="gap-1 text-xs"
              onClick={isPlayingVoice ? toggleVoice : handlePreviewVoice}
              disabled={isPreviewingVoice}
            >
              {isPreviewingVoice ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : isPlayingVoice ? (
                <Pause className="h-3 w-3" />
              ) : (
                <Volume2 className="h-3 w-3" />
              )}
              {isPreviewingVoice ? 'Generating...' : isPlayingVoice ? 'Pause' : 'Preview Voice'}
            </Button>
          </div>

          {/* Use in... */}
          <div className="flex gap-2">
            <Button size="sm" variant="outline" className="gap-1 text-xs" onClick={handleUseInMovie}>
              <Film className="h-3 w-3" /> Movie
            </Button>
            <Button size="sm" variant="outline" className="gap-1 text-xs" onClick={handleUseInReel}>
              <Video className="h-3 w-3" /> Reel
            </Button>
            <Button size="sm" variant="outline" className="gap-1 text-xs" onClick={handleUseInCommercial}>
              <Camera className="h-3 w-3" /> Commercial
            </Button>
          </div>
        </div>
      </div>

      {/* Image Gallery */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium flex items-center gap-2">
            <ImageIcon className="h-4 w-4 text-primary" />
            Reference Gallery ({images.length})
          </Label>
        </div>

        {images.length > 0 ? (
          <div className="grid grid-cols-4 gap-3">
            {images.map((img, index) => (
              <div
                key={index}
                className={cn(
                  'relative aspect-square rounded-lg overflow-hidden border-2 cursor-pointer group transition-all',
                  index === favoriteIndex ? 'border-primary ring-2 ring-primary/20' : 'border-border hover:border-primary/50',
                  referenceImage === img && 'ring-2 ring-accent'
                )}
                onClick={() => setSelectedImage(selectedImage === img ? null : img)}
              >
                <img src={img} alt={`${character.name} ${index + 1}`} className="w-full h-full object-cover" />

                {/* Favorite star */}
                {index === favoriteIndex && (
                  <div className="absolute top-1 left-1">
                    <Star className="h-4 w-4 text-yellow-400 fill-yellow-400 drop-shadow" />
                  </div>
                )}

                {/* Reference indicator */}
                {referenceImage === img && (
                  <Badge className="absolute top-1 right-1 text-[9px] bg-accent px-1 py-0">ref</Badge>
                )}

                {/* Hover actions */}
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1">
                  <Button
                    variant="secondary"
                    size="icon"
                    className="h-7 w-7 rounded-full"
                    onClick={(e) => { e.stopPropagation(); setExpandedImage(img); }}
                    title="Expand"
                  >
                    <Maximize2 className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="secondary"
                    size="icon"
                    className="h-7 w-7 rounded-full"
                    onClick={(e) => { e.stopPropagation(); handleSetFavorite(index); }}
                    title="Set as favorite"
                  >
                    {index === favoriteIndex ? <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" /> : <StarOff className="h-3 w-3" />}
                  </Button>
                  <Button
                    variant="secondary"
                    size="icon"
                    className="h-7 w-7 rounded-full"
                    onClick={(e) => { e.stopPropagation(); handleSelectAsReference(img); }}
                    title="Use as reference"
                  >
                    <Wand2 className="h-3 w-3" />
                  </Button>
                  {images.length > 1 && (
                    <Button
                      variant="destructive"
                      size="icon"
                      className="h-7 w-7 rounded-full"
                      onClick={(e) => { e.stopPropagation(); handleDeleteImage(index); }}
                      title="Remove"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="border-2 border-dashed rounded-lg p-8 text-center">
            <ImageIcon className="h-8 w-8 mx-auto text-muted-foreground/40 mb-2" />
            <p className="text-sm text-muted-foreground">No reference images yet</p>
          </div>
        )}
      </div>

      {/* Generate from Reference */}
      <Card className="p-4 border-primary/20 bg-primary/5">
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <Label className="text-sm font-medium">Generate New Image from Reference</Label>
          </div>

          {referenceImage ? (
            <div className="flex items-center gap-3">
              <div className="relative w-16 h-16 rounded-lg overflow-hidden border border-border shrink-0">
                <img src={referenceImage} alt="Reference" className="w-full h-full object-cover" />
              </div>
              <div className="flex-1 space-y-2">
                <Textarea
                  placeholder="Describe the new scene... e.g. 'holding a bottle of supplements in a modern gym' or 'wearing a red dress at a gala event'"
                  value={generationPrompt}
                  onChange={(e) => setGenerationPrompt(e.target.value)}
                  rows={2}
                  className="text-sm"
                />
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    className="gap-1 flex-1"
                    onClick={handleGenerateFromReference}
                    disabled={isGenerating || !generationPrompt.trim()}
                  >
                    {isGenerating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Wand2 className="h-3 w-3" />}
                    {isGenerating ? 'Generating...' : 'Generate'}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => { setReferenceImage(null); setGenerationPrompt(''); }}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              Hover over any image above and click the <Wand2 className="h-3 w-3 inline" /> wand to select it as a reference, then describe what to generate.
            </p>
          )}
        </div>
      </Card>

      {/* Lightbox */}
      <Dialog open={!!expandedImage} onOpenChange={() => setExpandedImage(null)}>
        <DialogContent className="max-w-3xl p-2">
          <DialogHeader className="pb-0">
            <DialogTitle className="text-sm">{character.name}</DialogTitle>
          </DialogHeader>
          {expandedImage && (
            <img src={expandedImage} alt={character.name} className="w-full rounded-lg object-contain max-h-[70vh]" />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
