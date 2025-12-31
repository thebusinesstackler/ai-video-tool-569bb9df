-- Create testimonial_commercials table
CREATE TABLE public.testimonial_commercials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  segments JSONB NOT NULL DEFAULT '[]'::jsonb,
  video_url TEXT,
  audio_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.testimonial_commercials ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their own commercials"
ON public.testimonial_commercials
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own commercials"
ON public.testimonial_commercials
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own commercials"
ON public.testimonial_commercials
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own commercials"
ON public.testimonial_commercials
FOR DELETE
USING (auth.uid() = user_id);

-- Add trigger for updated_at
CREATE TRIGGER update_testimonial_commercials_updated_at
BEFORE UPDATE ON public.testimonial_commercials
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();