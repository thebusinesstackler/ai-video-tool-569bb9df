-- Brands table
CREATE TABLE public.brands (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  logo_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.brands ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own brands" ON public.brands FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own brands" ON public.brands FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own brands" ON public.brands FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own brands" ON public.brands FOR DELETE USING (auth.uid() = user_id);

-- Products table
CREATE TABLE public.products (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  brand_id UUID NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT,
  benefits TEXT[],
  target_audience TEXT,
  youtube_short_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own products" ON public.products FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own products" ON public.products FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own products" ON public.products FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own products" ON public.products FOR DELETE USING (auth.uid() = user_id);

-- Product gallery (multiple images per product)
CREATE TABLE public.product_gallery (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  label TEXT,
  is_primary BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.product_gallery ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own product gallery" ON public.product_gallery FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own product gallery" ON public.product_gallery FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own product gallery" ON public.product_gallery FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own product gallery" ON public.product_gallery FOR DELETE USING (auth.uid() = user_id);