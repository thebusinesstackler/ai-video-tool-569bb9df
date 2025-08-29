-- Add a new column for multiple reference images
ALTER TABLE public.characters 
ADD COLUMN reference_images text[] DEFAULT '{}';

-- Keep the existing appearance_image column for backwards compatibility
-- Users can migrate their existing single image to the array later