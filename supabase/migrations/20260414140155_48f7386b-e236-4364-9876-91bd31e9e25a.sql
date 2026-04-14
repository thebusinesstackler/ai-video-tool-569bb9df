
CREATE TABLE public.product_graphics (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  image_url TEXT NOT NULL,
  label TEXT,
  source_style TEXT,
  is_original BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.product_graphics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own product graphics" ON public.product_graphics FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own product graphics" ON public.product_graphics FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own product graphics" ON public.product_graphics FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own product graphics" ON public.product_graphics FOR DELETE USING (auth.uid() = user_id);
