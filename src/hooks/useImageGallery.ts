import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { convertBase64ToStorageUrl } from '@/lib/imageUtils';

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
  isUploading: boolean;
  hasMore: boolean;
  fetchImages: (reset?: boolean) => Promise<void>;
  loadMore: () => Promise<void>;
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
  uploadImages: (files: FileList) => Promise<string[]>;
}

export function useImageGallery(): UseImageGalleryResult {
  const { toast } = useToast();
  const [images, setImages] = useState<GeneratedImage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const PAGE_SIZE = 12;

  const fetchImages = async (reset = false) => {
    const currentPage = reset ? 0 : page;
    if (reset) {
      setPage(0);
      setImages([]);
    }
    
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('generated_images')
        .select('id, user_id, image_url, prompt, source, reference_image_url, transformation, scene_number, project_id, created_at')
        .eq('source', 'upload')
        .order('created_at', { ascending: false })
        .range(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE - 1);

      if (error) throw error;
      
      const newImages = data || [];
      setHasMore(newImages.length === PAGE_SIZE);
      
      if (reset) {
        setImages(newImages);
      } else {
        setImages(prev => [...prev, ...newImages]);
      }
    } catch (error: any) {
      console.error('Error fetching images:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadMore = async () => {
    if (isLoading || !hasMore) return;
    const nextPage = page + 1;
    setPage(nextPage);
    
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('generated_images')
        .select('id, user_id, image_url, prompt, source, reference_image_url, transformation, scene_number, project_id, created_at')
        .order('created_at', { ascending: false })
        .range(nextPage * PAGE_SIZE, (nextPage + 1) * PAGE_SIZE - 1);

      if (error) throw error;
      
      const newImages = data || [];
      setHasMore(newImages.length === PAGE_SIZE);
      setImages(prev => [...prev, ...newImages]);
    } catch (error: any) {
      console.error('Error loading more images:', error);
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

      // Auto-convert base64 to storage URL before saving
      let finalImageUrl = imageUrl;
      if (imageUrl.startsWith('data:')) {
        console.log('Converting base64 image to storage URL...');
        finalImageUrl = await convertBase64ToStorageUrl(imageUrl, user.id, 'reels');
      }

      const { error } = await supabase
        .from('generated_images')
        .insert({
          user_id: user.id,
          image_url: finalImageUrl,
          prompt: prompt || null,
          source,
          reference_image_url: referenceImageUrl || null,
          transformation: transformation || null,
          scene_number: sceneNumber || null,
          project_id: projectId || null
        });

      if (error) throw error;
      
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

  const uploadImages = async (files: FileList): Promise<string[]> => {
    console.log('uploadImages called with', files.length, 'files');
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      console.log('No user authenticated');
      toast({
        title: "Not Authenticated",
        description: "Please log in to upload images.",
        variant: "destructive"
      });
      return [];
    }

    console.log('User authenticated:', user.id);

    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    const maxSize = 10 * 1024 * 1024; // 10MB
    const uploadedUrls: string[] = [];

    setIsUploading(true);
    try {
      console.log('Starting upload loop, files count:', files.length);
      for (const file of Array.from(files)) {
        console.log('Processing file:', file.name, 'type:', file.type, 'size:', file.size);
        
        if (!validTypes.includes(file.type)) {
          console.log('Invalid file type:', file.type);
          toast({
            title: "Invalid File Type",
            description: `${file.name} is not a supported image format. Type: ${file.type}`,
            variant: "destructive"
          });
          continue;
        }

        if (file.size > maxSize) {
          console.log('File too large:', file.size);
          toast({
            title: "File Too Large",
            description: `${file.name} exceeds 10MB limit.`,
            variant: "destructive"
          });
          continue;
        }

        const ext = file.name.split('.').pop() || 'jpg';
        const fileName = `${user.id}/${crypto.randomUUID()}.${ext}`;
        console.log('Uploading to:', fileName);

        const { error: uploadError } = await supabase.storage
          .from('reels')
          .upload(fileName, file, { contentType: file.type });

        if (uploadError) {
          console.error('Upload error:', uploadError);
          toast({
            title: "Upload Failed",
            description: `${file.name}: ${uploadError.message}`,
            variant: "destructive"
          });
          continue;
        }

        console.log('Upload successful, getting public URL');
        const { data: { publicUrl } } = supabase.storage
          .from('reels')
          .getPublicUrl(fileName);

        // Save to database
        await supabase
          .from('generated_images')
          .insert({
            user_id: user.id,
            image_url: publicUrl,
            prompt: null,
            source: 'upload'
          });

        uploadedUrls.push(publicUrl);
      }

      if (uploadedUrls.length > 0) {
        toast({
          title: "Upload Complete",
          description: `${uploadedUrls.length} image(s) uploaded successfully.`
        });
        await fetchImages();
      }

      return uploadedUrls;
    } catch (error: any) {
      console.error('Upload error:', error);
      toast({
        title: "Upload Failed",
        description: error.message || "Failed to upload images.",
        variant: "destructive"
      });
      return [];
    } finally {
      setIsUploading(false);
    }
  };

  useEffect(() => {
    fetchImages(true);
  }, []);

  return {
    images,
    isLoading,
    isUploading,
    hasMore,
    fetchImages,
    loadMore,
    saveImage,
    deleteImage,
    uploadImages
  };
}
