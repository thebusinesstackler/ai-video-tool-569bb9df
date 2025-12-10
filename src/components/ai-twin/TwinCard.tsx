import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Trash2, Volume2, ImageIcon, Eye, Film, Video } from 'lucide-react';

interface AITwin {
  id: string;
  name: string;
  reference_images: string[];
  voice_cloning_key: string | null;
  voice_sample_url: string | null;
  description: string | null;
  face_description: string | null;
  created_at: string;
}

interface TwinCardProps {
  twin: AITwin;
  onDelete: () => void;
  onSelect: () => void;
}

export const TwinCard: React.FC<TwinCardProps> = ({ twin, onDelete, onSelect }) => {
  const navigate = useNavigate();
  const primaryImage = twin.reference_images?.[0];
  const imageCount = twin.reference_images?.length || 0;

  const handleCreateMovie = (e: React.MouseEvent) => {
    e.stopPropagation();
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

  const handleCreateReel = (e: React.MouseEvent) => {
    e.stopPropagation();
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

  return (
    <Card className="group hover:shadow-lg transition-all duration-300 overflow-hidden">
      <div className="relative aspect-square bg-muted">
        {primaryImage ? (
          <img 
            src={primaryImage} 
            alt={twin.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <ImageIcon className="w-12 h-12 text-muted-foreground" />
          </div>
        )}
        
        {/* Overlay with additional images preview */}
        {imageCount > 1 && (
          <div className="absolute bottom-2 right-2 flex -space-x-2">
            {twin.reference_images.slice(1, 4).map((img, idx) => (
              <img 
                key={idx}
                src={img}
                alt=""
                className="w-8 h-8 rounded-full border-2 border-background object-cover"
              />
            ))}
            {imageCount > 4 && (
              <div className="w-8 h-8 rounded-full bg-background/80 border-2 border-background flex items-center justify-center text-xs font-medium">
                +{imageCount - 4}
              </div>
            )}
          </div>
        )}

        {/* Hover overlay */}
        <div className="absolute inset-0 bg-black/70 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
          <Button size="sm" variant="secondary" onClick={onSelect} className="bg-white text-black hover:bg-gray-100">
            <Eye className="w-4 h-4 mr-1" />
            View
          </Button>
          <Button size="sm" variant="destructive" onClick={(e) => { e.stopPropagation(); onDelete(); }} className="bg-red-600 hover:bg-red-700">
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <CardContent className="p-4 space-y-3">
        <h3 className="font-semibold text-lg truncate">{twin.name}</h3>
        {twin.description && (
          <p className="text-sm text-muted-foreground line-clamp-2">
            {twin.description}
          </p>
        )}
        
        <div className="flex items-center gap-2">
          <Badge variant={twin.voice_cloning_key ? "default" : "secondary"} className="text-xs">
            <Volume2 className="w-3 h-3 mr-1" />
            {twin.voice_cloning_key ? "Voice Cloned" : "No Voice"}
          </Badge>
          <Badge variant="outline" className="text-xs">
            <ImageIcon className="w-3 h-3 mr-1" />
            {imageCount} {imageCount === 1 ? 'Image' : 'Images'}
          </Badge>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2 pt-2">
          <Button 
            size="sm" 
            className="flex-1 bg-gradient-primary hover:opacity-90"
            onClick={handleCreateMovie}
          >
            <Film className="w-4 h-4 mr-1" />
            Movie
          </Button>
          <Button 
            size="sm" 
            variant="outline" 
            className="flex-1"
            onClick={handleCreateReel}
          >
            <Video className="w-4 h-4 mr-1" />
            Reel
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
