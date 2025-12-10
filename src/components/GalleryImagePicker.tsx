import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Image as ImageIcon, Search, Loader2, FolderOpen, User, Wand2, Sparkles } from 'lucide-react';
import { useImageGallery } from '@/hooks/useImageGallery';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';

interface GalleryImagePickerProps {
  onSelect: (imageUrl: string) => void;
  trigger?: React.ReactNode;
  title?: string;
  showCharacters?: boolean;
  showGenerate?: boolean;
}

interface Character {
  id: string;
  name: string;
  description: string | null;
  reference_images: string[] | null;
}

export const GalleryImagePicker: React.FC<GalleryImagePickerProps> = ({ 
  onSelect,
  trigger,
  title = "Select from Gallery",
  showCharacters = true,
  showGenerate = true
}) => {
  const { images, isLoading } = useImageGallery();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [characters, setCharacters] = useState<Character[]>([]);
  const [loadingCharacters, setLoadingCharacters] = useState(false);
  const [activeTab, setActiveTab] = useState('gallery');
  
  // Image generation state
  const [generatePrompt, setGeneratePrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    if (open && showCharacters && user) {
      fetchCharacters();
    }
  }, [open, showCharacters, user]);

  const fetchCharacters = async () => {
    if (!user) return;
    setLoadingCharacters(true);
    try {
      const { data, error } = await supabase
        .from('characters')
        .select('id, name, description, reference_images')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      setCharacters(data || []);
    } catch (error) {
      console.error('Failed to fetch characters:', error);
    } finally {
      setLoadingCharacters(false);
    }
  };

  const filteredImages = images.filter(img => {
    if (!searchTerm) return true;
    return img.prompt?.toLowerCase().includes(searchTerm.toLowerCase()) ||
           img.source?.toLowerCase().includes(searchTerm.toLowerCase());
  });

  const filteredCharacters = characters.filter(char => {
    if (!searchTerm) return true;
    return char.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
           char.description?.toLowerCase().includes(searchTerm.toLowerCase());
  });

  const handleSelect = (imageUrl: string) => {
    onSelect(imageUrl);
    setOpen(false);
    setSearchTerm('');
    setGeneratePrompt('');
  };

  const handleGenerateImage = async () => {
    if (!generatePrompt.trim()) return;
    
    setIsGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-scene-image', {
        body: { prompt: generatePrompt }
      });
      
      if (error) throw error;
      
      if (data?.imageUrl) {
        handleSelect(data.imageUrl);
      }
    } catch (error) {
      console.error('Failed to generate image:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  const hasCharacters = showCharacters && characters.length > 0;
  const showTabs = hasCharacters || showGenerate;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm" className="gap-2">
            <FolderOpen className="w-4 h-4" />
            Gallery
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ImageIcon className="w-5 h-5 text-primary" />
            {title}
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search images or characters..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>

          {showTabs ? (
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="w-full grid grid-cols-3">
                <TabsTrigger value="gallery" className="gap-1">
                  <ImageIcon className="w-3 h-3" />
                  Gallery
                </TabsTrigger>
                {showCharacters && (
                  <TabsTrigger value="characters" className="gap-1">
                    <User className="w-3 h-3" />
                    Characters
                  </TabsTrigger>
                )}
                {showGenerate && (
                  <TabsTrigger value="generate" className="gap-1">
                    <Wand2 className="w-3 h-3" />
                    Generate
                  </TabsTrigger>
                )}
              </TabsList>

              <TabsContent value="gallery" className="mt-4">
                {isLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                  </div>
                ) : filteredImages.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <ImageIcon className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>No images found</p>
                    {images.length === 0 && (
                      <p className="text-sm mt-2">Generate some images first to see them here</p>
                    )}
                  </div>
                ) : (
                  <ScrollArea className="h-[400px]">
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                      {filteredImages.map((image) => (
                        <button
                          key={image.id}
                          onClick={() => handleSelect(image.image_url)}
                          className="group relative aspect-square rounded-lg overflow-hidden bg-muted hover:ring-2 hover:ring-primary transition-all focus:outline-none focus:ring-2 focus:ring-primary"
                        >
                          <img
                            src={image.image_url}
                            alt={image.prompt || 'Gallery image'}
                            className="w-full h-full object-cover"
                          />
                          
                          {/* Source badge */}
                          <div className="absolute top-1 left-1 bg-background/80 backdrop-blur-sm text-foreground text-[10px] px-1 py-0.5 rounded capitalize">
                            {image.source}
                          </div>

                          {/* Hover overlay */}
                          <div className="absolute inset-0 bg-primary/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <div className="bg-background/90 text-foreground text-xs px-2 py-1 rounded font-medium">
                              Select
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </TabsContent>

              {showCharacters && (
                <TabsContent value="characters" className="mt-4">
                  {loadingCharacters ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="w-8 h-8 animate-spin text-primary" />
                    </div>
                  ) : filteredCharacters.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                      <User className="w-12 h-12 mx-auto mb-4 opacity-50" />
                      <p>No characters found</p>
                      <p className="text-sm mt-2">Create characters in the Characters page to use them here</p>
                    </div>
                  ) : (
                    <ScrollArea className="h-[400px]">
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                        {filteredCharacters.map((character) => (
                          character.reference_images?.map((imgUrl, idx) => (
                            <button
                              key={`${character.id}-${idx}`}
                              onClick={() => handleSelect(imgUrl)}
                              className="group relative aspect-square rounded-lg overflow-hidden bg-muted hover:ring-2 hover:ring-primary transition-all focus:outline-none focus:ring-2 focus:ring-primary"
                            >
                              <img
                                src={imgUrl}
                                alt={character.name}
                                className="w-full h-full object-cover"
                              />
                              
                              {/* Character name badge */}
                              <div className="absolute bottom-0 left-0 right-0 bg-black/70 px-2 py-1">
                                <p className="text-xs text-white truncate">{character.name}</p>
                              </div>

                              {/* Hover overlay */}
                              <div className="absolute inset-0 bg-primary/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                <div className="bg-background/90 text-foreground text-xs px-2 py-1 rounded font-medium">
                                  Select
                                </div>
                              </div>
                            </button>
                          ))
                        ))}
                      </div>
                    </ScrollArea>
                  )}
                </TabsContent>
              )}

              {showGenerate && (
                <TabsContent value="generate" className="mt-4">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Image Description</Label>
                      <Textarea
                        placeholder="Describe the image you want to generate... e.g., 'A professional woman in a modern office setting, warm lighting, confident pose'"
                        value={generatePrompt}
                        onChange={(e) => setGeneratePrompt(e.target.value)}
                        rows={4}
                        className="resize-none"
                      />
                    </div>
                    <Button
                      onClick={handleGenerateImage}
                      disabled={isGenerating || !generatePrompt.trim()}
                      className="w-full gap-2"
                    >
                      {isGenerating ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Generating...
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-4 h-4" />
                          Generate Image
                        </>
                      )}
                    </Button>
                    <p className="text-xs text-muted-foreground text-center">
                      AI will generate an image based on your description and automatically select it
                    </p>
                  </div>
                </TabsContent>
              )}
            </Tabs>
          ) : (
            /* No tabs - just gallery */
            isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : filteredImages.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <ImageIcon className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No images found</p>
                {images.length === 0 && (
                  <p className="text-sm mt-2">Generate some images first to see them here</p>
                )}
              </div>
            ) : (
              <ScrollArea className="h-[400px]">
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                  {filteredImages.map((image) => (
                    <button
                      key={image.id}
                      onClick={() => handleSelect(image.image_url)}
                      className="group relative aspect-square rounded-lg overflow-hidden bg-muted hover:ring-2 hover:ring-primary transition-all focus:outline-none focus:ring-2 focus:ring-primary"
                    >
                      <img
                        src={image.image_url}
                        alt={image.prompt || 'Gallery image'}
                        className="w-full h-full object-cover"
                      />
                      
                      {/* Source badge */}
                      <div className="absolute top-1 left-1 bg-background/80 backdrop-blur-sm text-foreground text-[10px] px-1 py-0.5 rounded capitalize">
                        {image.source}
                      </div>

                      {/* Hover overlay */}
                      <div className="absolute inset-0 bg-primary/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <div className="bg-background/90 text-foreground text-xs px-2 py-1 rounded font-medium">
                          Select
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </ScrollArea>
            )
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};