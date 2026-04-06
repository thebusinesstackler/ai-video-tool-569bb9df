
CREATE TABLE public.calendar_images (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  image_url TEXT NOT NULL,
  label TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.calendar_images ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own calendar images"
  ON public.calendar_images FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own calendar images"
  ON public.calendar_images FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own calendar images"
  ON public.calendar_images FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own calendar images"
  ON public.calendar_images FOR UPDATE
  USING (auth.uid() = user_id);
