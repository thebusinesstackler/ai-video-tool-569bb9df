
-- Add brand_guidelines_url to profiles
ALTER TABLE public.profiles ADD COLUMN brand_guidelines_url text DEFAULT NULL;

-- Create storage bucket for brand guidelines
INSERT INTO storage.buckets (id, name, public) VALUES ('brand-guidelines', 'brand-guidelines', false);

-- Storage policies
CREATE POLICY "Users can upload own brand guidelines"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'brand-guidelines' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can view own brand guidelines"
ON storage.objects FOR SELECT
USING (bucket_id = 'brand-guidelines' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can update own brand guidelines"
ON storage.objects FOR UPDATE
USING (bucket_id = 'brand-guidelines' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete own brand guidelines"
ON storage.objects FOR DELETE
USING (bucket_id = 'brand-guidelines' AND auth.uid()::text = (storage.foldername(name))[1]);
