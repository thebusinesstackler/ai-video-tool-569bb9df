-- Create ai_twins table for managing digital twins
CREATE TABLE public.ai_twins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  reference_images TEXT[] DEFAULT '{}',
  voice_sample_url TEXT,
  voice_cloning_key TEXT,
  description TEXT,
  face_description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.ai_twins ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their own twins"
ON public.ai_twins
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own twins"
ON public.ai_twins
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own twins"
ON public.ai_twins
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own twins"
ON public.ai_twins
FOR DELETE
USING (auth.uid() = user_id);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_ai_twins_updated_at
BEFORE UPDATE ON public.ai_twins
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();