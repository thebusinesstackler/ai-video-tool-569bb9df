import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { useImageGallery } from '@/hooks/useImageGallery';
import { supabase } from '@/integrations/supabase/client';
import { Check, X, Loader2, Wand2, Search, ImageIcon } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';

interface ImageGrouperProps {
  selectedImages: string[];
  onImagesChange: (images: string[]) => void;
}

interface ImageGroup {
  description: string;
  images: string[];
}

export const ImageGrouper: React.FC<ImageGrouperProps> = ({ selectedImages, onImagesChange }) => {
  const { toast } = useToast();
  const { images, isLoading: galleryLoading } = useImageGallery();
  const [searchTerm, setSearchTerm] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [suggestedGroups, setSuggestedGroups] = useState<ImageGroup[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const filteredImages = images.filter(img => 
    !searchTerm || 
    img.prompt?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    img.source?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const toggleImage = (imageUrl: string) => {
    if (selectedImages.includes(imageUrl)) {
      onImagesChange(selectedImages.filter(url => url !== imageUrl));
    } else {
      onImagesChange([...selectedImages, imageUrl]);
    }
  };

  const analyzeAndGroupImages = async () => {
    if (selectedImages.length < 2) {
      toast({
        title: 'Select More Images',
        description: 'Please select at least 2 images to analyze for grouping',
        variant: 'destructive'
      });
      return;
    }

    try {
      setIsAnalyzing(true);
      
      const { data, error } = await supabase.functions.invoke('analyze-face-similarity', {
        body: { imageUrls: selectedImages }
      });

      if (error) throw error;

      if (data?.groups && data.groups.length > 0) {
        setSuggestedGroups(data.groups);
        setShowSuggestions(true);
        toast({
          title: 'Analysis Complete',
          description: `Found ${data.groups.length} group(s) of similar faces`
        });
      } else {
        toast({
          title: 'No Groups Found',
          description: 'Could not identify distinct groups. Images may all be of the same person.'
        });
      }
    } catch (error: any) {
      console.error('Error analyzing images:', error);
      toast({
        title: 'Analysis Failed',
        description: error.message || 'Failed to analyze images',
        variant: 'destructive'
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const applyGroup = (group: ImageGroup) => {
    onImagesChange(group.images);
    setShowSuggestions(false);
    toast({
      title: 'Group Applied',
      description: `Selected ${group.images.length} images from this group`
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="font-medium">Select Reference Images</h4>
          <p className="text-sm text-muted-foreground">
            Choose images from your gallery that show the same person
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline">
            {selectedImages.length} selected
          </Badge>
          <Button
            variant="outline"
            size="sm"
            onClick={analyzeAndGroupImages}
            disabled={isAnalyzing || selectedImages.length < 2}
          >
            {isAnalyzing ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Analyzing...
              </>
            ) : (
              <>
                <Wand2 className="w-4 h-4 mr-2" />
                Auto-Group Similar Faces
              </>
            )}
          </Button>
        </div>
      </div>

      {/* AI Suggested Groups */}
      {showSuggestions && suggestedGroups.length > 0 && (
        <Card className="border-primary/50 bg-primary/5">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h5 className="font-medium text-sm">AI Suggested Groups</h5>
              <Button variant="ghost" size="sm" onClick={() => setShowSuggestions(false)}>
                <X className="w-4 h-4" />
              </Button>
            </div>
            <div className="space-y-3">
              {suggestedGroups.map((group, idx) => (
                <div key={idx} className="flex items-center gap-3 p-2 rounded-lg bg-background">
                  <div className="flex -space-x-2">
                    {group.images.slice(0, 3).map((img, imgIdx) => (
                      <img 
                        key={imgIdx}
                        src={img}
                        alt=""
                        className="w-10 h-10 rounded-full border-2 border-background object-cover"
                      />
                    ))}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">Group {idx + 1}</p>
                    <p className="text-xs text-muted-foreground line-clamp-1">{group.description}</p>
                  </div>
                  <Badge variant="secondary">{group.images.length} images</Badge>
                  <Button size="sm" onClick={() => applyGroup(group)}>
                    Use This Group
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search by prompt or source..."
          className="pl-10"
        />
      </div>

      {/* Image Grid */}
      <ScrollArea className="h-[400px] border rounded-lg p-2">
        {galleryLoading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="w-6 h-6 animate-spin" />
          </div>
        ) : filteredImages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
            <ImageIcon className="w-12 h-12 mb-2" />
            <p>No images in gallery</p>
          </div>
        ) : (
          <div className="grid grid-cols-5 gap-2">
            {filteredImages.map((image) => {
              const isSelected = selectedImages.includes(image.image_url);
              return (
                <div
                  key={image.id}
                  onClick={() => toggleImage(image.image_url)}
                  className={`relative aspect-square rounded-lg overflow-hidden cursor-pointer transition-all ${
                    isSelected 
                      ? 'ring-2 ring-primary ring-offset-2' 
                      : 'hover:opacity-80'
                  }`}
                >
                  <img 
                    src={image.image_url}
                    alt={image.prompt || 'Gallery image'}
                    className="w-full h-full object-cover"
                  />
                  {isSelected && (
                    <div className="absolute top-1 right-1 bg-primary text-primary-foreground rounded-full p-1">
                      <Check className="w-3 h-3" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </ScrollArea>

      {/* Selected Preview */}
      {selectedImages.length > 0 && (
        <div>
          <h5 className="text-sm font-medium mb-2">Selected Images</h5>
          <div className="flex flex-wrap gap-2">
            {selectedImages.map((url, idx) => (
              <div key={idx} className="relative group">
                <img 
                  src={url}
                  alt={`Selected ${idx + 1}`}
                  className="w-16 h-16 object-cover rounded-lg"
                />
                <button
                  onClick={() => toggleImage(url)}
                  className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
