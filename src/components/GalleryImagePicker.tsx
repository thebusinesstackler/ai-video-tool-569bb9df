import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Image as ImageIcon, Search, Loader2, FolderOpen } from 'lucide-react';
import { useImageGallery } from '@/hooks/useImageGallery';

interface GalleryImagePickerProps {
  onSelect: (imageUrl: string) => void;
  trigger?: React.ReactNode;
  title?: string;
}

export const GalleryImagePicker: React.FC<GalleryImagePickerProps> = ({ 
  onSelect,
  trigger,
  title = "Select from Gallery"
}) => {
  const { images, isLoading } = useImageGallery();
  const [open, setOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const filteredImages = images.filter(img => {
    if (!searchTerm) return true;
    return img.prompt?.toLowerCase().includes(searchTerm.toLowerCase()) ||
           img.source?.toLowerCase().includes(searchTerm.toLowerCase());
  });

  const handleSelect = (imageUrl: string) => {
    onSelect(imageUrl);
    setOpen(false);
    setSearchTerm('');
  };

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
              placeholder="Search images..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Image Grid */}
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
        </div>
      </DialogContent>
    </Dialog>
  );
};
