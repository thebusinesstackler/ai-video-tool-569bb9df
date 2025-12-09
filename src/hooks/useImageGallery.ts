import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface GeneratedImage {
  id: string;
  user_id: string;
  image_url: string;
  prompt: string | null;
  source: string;
  reference_image_url: string | null;
  transformation: string | null;
  scene_number: number | null;
  project_id: string | null;
  created_at: string;
}

interface UseImageGalleryResult {
  images: GeneratedImage[];
  isLoading: boolean;
  fetchImages: () => Promise<void>;
  saveImage: (params: {
    imageUrl: string;
    prompt?: string;
    source?: string;
    referenceImageUrl?: string;
    transformation?: string;
    sceneNumber?: number;
    projectId?: string;
  }) => Promise<void>;
  deleteImage: (id: string) => Promise<void>;
}

export function useImageGallery(): UseImageGalleryResult {
  const { toast } = useToast();
  const [images, setImages] = useState<GeneratedImage[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchImages = async () => {
    setIsLoading(true);
    try {
      // Only fetch metadata columns to avoid timeout from large base64 image_url data
      const { data, error } = await supabase
        .from('generated_images')
        .select('id, user_id, image_url, prompt, source, reference_image_url, transformation, scene_number, project_id, created_at')
        .order('created_at', { ascending: false })
        .limit(50); // Limit results to prevent timeout

      if (error) throw error;
      setImages(data || []);
    } catch (error: any) {
      console.error('Error fetching images:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const saveImage = async ({
    imageUrl,
    prompt,
    source = 'reel',
    referenceImageUrl,
    transformation,
    sceneNumber,
    projectId
  }: {
    imageUrl: string;
    prompt?: string;
    source?: string;
    referenceImageUrl?: string;
    transformation?: string;
    sceneNumber?: number;
    projectId?: string;
  }) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.warn('No user logged in, skipping image save');
        return;
      }

      const { error } = await supabase
        .from('generated_images')
        .insert({
          user_id: user.id,
          image_url: imageUrl,
          prompt: prompt || null,
          source,
          reference_image_url: referenceImageUrl || null,
          transformation: transformation || null,
          scene_number: sceneNumber || null,
          project_id: projectId || null
        });

      if (error) throw error;
      
      // Refresh the list
      await fetchImages();
    } catch (error: any) {
      console.error('Error saving image to gallery:', error);
    }
  };

  const deleteImage = async (id: string) => {
    try {
      const { error } = await supabase
        .from('generated_images')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setImages(prev => prev.filter(img => img.id !== id));
      
      toast({
        title: "Image Deleted",
        description: "The image has been removed from your gallery."
      });
    } catch (error: any) {
      console.error('Error deleting image:', error);
      toast({
        title: "Delete Failed",
        description: error.message || "Failed to delete image.",
        variant: "destructive"
      });
    }
  };

  useEffect(() => {
    fetchImages();
  }, []);

  return {
    images,
    isLoading,
    fetchImages,
    saveImage,
    deleteImage
  };
}
