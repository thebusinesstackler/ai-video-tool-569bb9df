-- Create reels table to store generated reels
CREATE TABLE public.reels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  topic text NOT NULL,
  video_url text,
  thumbnail_url text,
  scenes jsonb DEFAULT '[]'::jsonb,
  total_duration integer DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.reels ENABLE ROW LEVEL SECURITY;

-- RLS policies for user-specific access
CREATE POLICY "Users can view their own reels" 
ON public.reels 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own reels" 
ON public.reels 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own reels" 
ON public.reels 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own reels" 
ON public.reels 
FOR DELETE 
USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER update_reels_updated_at
BEFORE UPDATE ON public.reels
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create storage bucket for reel videos
INSERT INTO storage.buckets (id, name, public) 
VALUES ('reels', 'reels', true);

-- Storage policies
CREATE POLICY "Users can upload their own reel videos"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'reels' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Reel videos are publicly accessible"
ON storage.objects
FOR SELECT
USING (bucket_id = 'reels');

CREATE POLICY "Users can delete their own reel videos"
ON storage.objects
FOR DELETE
USING (bucket_id = 'reels' AND auth.uid()::text = (storage.foldername(name))[1]);