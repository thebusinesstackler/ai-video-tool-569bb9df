ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS brand_url text,
  ADD COLUMN IF NOT EXISTS brand_analysis jsonb;