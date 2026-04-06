import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { 
  Image as ImageIcon, 
  Trash2, 
  Search, 
  Loader2, 
  Download,
  Star,
  Calendar,
  X,
  Maximize2,
  ZoomIn,
  ChevronLeft,
  ChevronRight,
  Sparkles
} from 'lucide-react';
import { GeneratedImage, useImageGallery } from '@/hooks/useImageGallery';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface ImageGalleryProps {
  onSelectImage?: (imageUrl: string) => void;
  selectable?: boolean;
}

export const ImageGallery: React.FC<ImageGalleryProps> = ({ 
  onSelectImage,
  selectable = false 
}) => {
  const { images, isLoading, hasMore, loadMore, deleteImage, saveImage, fetchImages } = useImageGallery();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedImage, setSelectedImage] = useState<GeneratedImage | null>(null);
  const [filterSource, setFilterSource] = useState<string>('all');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isUpscaling, setIsUpscaling] = useState(false);
  const { toast } = useToast();

  const filteredImages = images.filter(img => {
    const matchesSearch = !searchTerm || 
      img.prompt?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      img.source?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesSource = filterSource === 'all' || img.source === filterSource;
    return matchesSearch && matchesSource;
  });

  const sources = ['all', ...new Set(images.map(img => img.source))];

  const currentIndex = selectedImage 
    ? filteredImages.findIndex(img => img.id === selectedImage.id)
    : -1;

  const handleDownload = async (imageUrl: string, imageName: string) => {
    try {
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${imageName}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Download failed:', error);
    }
  };

  const navigateImage = useCallback((direction: 'prev' | 'next') => {
    if (currentIndex === -1) return;
    
    const newIndex = direction === 'prev' 
      ? (currentIndex - 1 + filteredImages.length) % filteredImages.length
      : (currentIndex + 1) % filteredImages.length;
    
    setSelectedImage(filteredImages[newIndex]);
  }, [currentIndex, filteredImages]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!selectedImage) return;
      
      switch (e.key) {
        case 'Escape':
          if (isFullscreen) {
            setIsFullscreen(false);
          } else {
            setSelectedImage(null);
          }
          break;
        case 'ArrowLeft':
          navigateImage('prev');
          break;
        case 'ArrowRight':
          navigateImage('next');
          break;
        case 'f':
        case 'F':
          setIsFullscreen(!isFullscreen);
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedImage, isFullscreen, navigateImage]);

  const handleUpscale = async (mode: '2x' | '4x' | 'enhance') => {
    if (!selectedImage) return;
    
    setIsUpscaling(true);
    try {
      const { data, error } = await supabase.functions.invoke('upscale-image', {
        body: { 
          imageUrl: selectedImage.image_url,
          mode 
        }
      });

      if (error) throw error;
      
      if (data.upscaledImageUrl) {
        // Save the upscaled image to the gallery
        await saveImage({
          imageUrl: data.upscaledImageUrl,
          prompt: `${mode === 'enhance' ? 'Enhanced' : `Upscaled ${mode}`}: ${selectedImage.prompt || 'Original image'}`,
          source: 'upscaled',
          referenceImageUrl: selectedImage.image_url
        });
        
        await fetchImages(true);
        
        toast({
          title: "Image Upscaled",
          description: data.message || `Image ${mode === 'enhance' ? 'enhanced' : `upscaled to ${mode}`} successfully!`,
        });
      }
    } catch (error: any) {
      console.error('Upscale error:', error);
      toast({
        title: "Upscale Failed",
        description: error.message || "Failed to upscale image. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsUpscaling(false);
    }
  };

  if (isLoading) {
    return (
      <Card className="bg-card border-border">
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ImageIcon className="w-5 h-5 text-primary" />
            Image Gallery
          </CardTitle>
          <CardDescription>
            {images.length} uploaded images
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Search and Filter */}
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search by prompt..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex gap-1 flex-wrap">
              {sources.map(source => (
                <Button
                  key={source}
                  variant={filterSource === source ? "default" : "outline"}
                  size="sm"
                  onClick={() => setFilterSource(source)}
                  className="capitalize"
                >
                  {source}
                </Button>
              ))}
            </div>
          </div>

          {/* Gallery Grid */}
          {filteredImages.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <ImageIcon className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No images found</p>
              {images.length === 0 && (
                <p className="text-sm mt-2">Generated images will appear here automatically</p>
              )}
            </div>
          ) : (
            <ScrollArea className="h-[500px]">
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                {filteredImages.map((image) => (
                  <div 
                    key={image.id} 
                    className={`group relative aspect-square rounded-lg overflow-hidden bg-muted ${
                      selectable ? 'cursor-pointer hover:ring-2 hover:ring-primary' : ''
                    }`}
                    onClick={() => {
                      if (selectable && onSelectImage) {
                        onSelectImage(image.image_url);
                      } else {
                        setSelectedImage(image);
                      }
                    }}
                  >
                    <img
                      src={image.image_url}
                      alt={image.prompt || 'Generated image'}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                    
                    {/* Source badge */}
                    <div className="absolute top-2 left-2 bg-background/80 backdrop-blur-sm text-foreground text-xs px-1.5 py-0.5 rounded capitalize">
                      {image.source}
                    </div>

                    {/* Reference indicator */}
                    {image.reference_image_url && (
                      <div className="absolute top-2 right-2 bg-amber-500 text-white text-xs p-1 rounded">
                        <Star className="w-3 h-3" />
                      </div>
                    )}

                    {/* Hover overlay */}
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                      <Button
                        size="icon"
                        variant="secondary"
                        className="w-8 h-8"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDownload(image.image_url, `image-${image.id.slice(0, 8)}`);
                        }}
                      >
                        <Download className="w-4 h-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="destructive"
                        className="w-8 h-8"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteImage(image.id);
                        }}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>

                    {/* Date */}
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-2">
                      <p className="text-white text-xs flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {format(new Date(image.created_at), 'MMM d, yyyy')}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
              
              {/* Load More Button */}
              {hasMore && !searchTerm && filterSource === 'all' && (
                <div className="flex justify-center mt-4 pb-4">
                  <Button
                    variant="outline"
                    onClick={loadMore}
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Loading...
                      </>
                    ) : (
                      'Load More Images'
                    )}
                  </Button>
                </div>
              )}
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* Image Detail Dialog */}
      <Dialog open={!!selectedImage && !isFullscreen} onOpenChange={() => setSelectedImage(null)}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>Image Details</span>
              <div className="flex items-center gap-1">
                <Button 
                  variant="ghost" 
                  size="icon"
                  onClick={() => setIsFullscreen(true)}
                  title="Fullscreen (F)"
                >
                  <Maximize2 className="w-4 h-4" />
                </Button>
                <Button 
                  variant="ghost" 
                  size="icon"
                  onClick={() => setSelectedImage(null)}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </DialogTitle>
          </DialogHeader>
          {selectedImage && (
            <div className="space-y-4">
              {/* Image with navigation */}
              <div className="relative group">
                <div 
                  className="aspect-[9/16] max-h-[60vh] mx-auto rounded-lg overflow-hidden bg-muted cursor-pointer"
                  onClick={() => setIsFullscreen(true)}
                >
                  <img
                    src={selectedImage.image_url}
                    alt={selectedImage.prompt || 'Generated image'}
                    className="w-full h-full object-contain"
                  />
                </div>
                
                {/* Navigation arrows */}
                {filteredImages.length > 1 && (
                  <>
                    <Button
                      variant="secondary"
                      size="icon"
                      className="absolute left-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigateImage('prev');
                      }}
                    >
                      <ChevronLeft className="w-5 h-5" />
                    </Button>
                    <Button
                      variant="secondary"
                      size="icon"
                      className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigateImage('next');
                      }}
                    >
                      <ChevronRight className="w-5 h-5" />
                    </Button>
                  </>
                )}
                
                {/* Click hint */}
                <div className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-background/80 backdrop-blur-sm text-foreground text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity">
                  Click to view fullscreen
                </div>
              </div>
              
              <div className="space-y-2 text-sm">
                {selectedImage.prompt && (
                  <div>
                    <span className="font-medium text-muted-foreground">Prompt:</span>
                    <p className="mt-1">{selectedImage.prompt}</p>
                  </div>
                )}
                
                {selectedImage.transformation && (
                  <div>
                    <span className="font-medium text-muted-foreground">Transformation:</span>
                    <p className="mt-1">{selectedImage.transformation}</p>
                  </div>
                )}
                
                <div className="flex gap-4 text-muted-foreground">
                  <span className="capitalize">Source: {selectedImage.source}</span>
                  {selectedImage.scene_number && (
                    <span>Scene: {selectedImage.scene_number}</span>
                  )}
                  <span>{format(new Date(selectedImage.created_at), 'MMM d, yyyy h:mm a')}</span>
                </div>
                
                <div className="text-xs text-muted-foreground">
                  Use ← → arrows to navigate, F for fullscreen, Esc to close
                </div>
              </div>

              <div className="flex gap-2 flex-wrap">
                <Button
                  onClick={() => handleDownload(selectedImage.image_url, `image-${selectedImage.id.slice(0, 8)}`)}
                >
                  <Download className="w-4 h-4 mr-2" />
                  Download
                </Button>
                
                {/* Upscale dropdown */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="secondary" disabled={isUpscaling}>
                      {isUpscaling ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <ZoomIn className="w-4 h-4 mr-2" />
                      )}
                      {isUpscaling ? 'Upscaling...' : 'Upscale'}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    <DropdownMenuItem onClick={() => handleUpscale('2x')}>
                      <ZoomIn className="w-4 h-4 mr-2" />
                      Upscale 2x
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleUpscale('4x')}>
                      <ZoomIn className="w-4 h-4 mr-2" />
                      Upscale 4x
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleUpscale('enhance')}>
                      <Sparkles className="w-4 h-4 mr-2" />
                      AI Enhance
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                
                {onSelectImage && (
                  <Button
                    variant="secondary"
                    onClick={() => {
                      onSelectImage(selectedImage.image_url);
                      setSelectedImage(null);
                    }}
                  >
                    <Star className="w-4 h-4 mr-2" />
                    Use as Reference
                  </Button>
                )}
                <Button
                  variant="destructive"
                  onClick={() => {
                    deleteImage(selectedImage.id);
                    setSelectedImage(null);
                  }}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Fullscreen Lightbox */}
      {isFullscreen && selectedImage && (
        <div 
          className="fixed inset-0 z-50 bg-black flex items-center justify-center"
          onClick={() => setIsFullscreen(false)}
        >
          {/* Close button */}
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-4 right-4 text-white hover:bg-white/20"
            onClick={() => setIsFullscreen(false)}
          >
            <X className="w-6 h-6" />
          </Button>
          
          {/* Navigation */}
          {filteredImages.length > 1 && (
            <>
              <Button
                variant="ghost"
                size="icon"
                className="absolute left-4 top-1/2 -translate-y-1/2 text-white hover:bg-white/20 w-12 h-12"
                onClick={(e) => {
                  e.stopPropagation();
                  navigateImage('prev');
                }}
              >
                <ChevronLeft className="w-8 h-8" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-4 top-1/2 -translate-y-1/2 text-white hover:bg-white/20 w-12 h-12"
                onClick={(e) => {
                  e.stopPropagation();
                  navigateImage('next');
                }}
              >
                <ChevronRight className="w-8 h-8" />
              </Button>
            </>
          )}
          
          {/* Full image */}
          <img
            src={selectedImage.image_url}
            alt={selectedImage.prompt || 'Generated image'}
            className="max-w-full max-h-full object-contain"
            onClick={(e) => e.stopPropagation()}
          />
          
          {/* Image info overlay */}
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-6">
            <div className="max-w-4xl mx-auto text-white">
              {selectedImage.prompt && (
                <p className="text-sm mb-2 line-clamp-2">{selectedImage.prompt}</p>
              )}
              <div className="flex items-center gap-4 text-sm text-white/70">
                <span className="capitalize">{selectedImage.source}</span>
                <span>{format(new Date(selectedImage.created_at), 'MMM d, yyyy')}</span>
                <span>{currentIndex + 1} / {filteredImages.length}</span>
              </div>
            </div>
          </div>
          
          {/* Keyboard hints */}
          <div className="absolute top-4 left-4 text-white/50 text-xs">
            Esc to close • ← → to navigate • Click image to keep open
          </div>
        </div>
      )}
    </>
  );
};
