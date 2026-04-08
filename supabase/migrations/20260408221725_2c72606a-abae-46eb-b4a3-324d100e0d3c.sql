
INSERT INTO storage.buckets (id, name, public)
VALUES ('raw-footage', 'raw-footage', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Users can upload raw footage"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'raw-footage' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can view their raw footage"
ON storage.objects FOR SELECT
USING (bucket_id = 'raw-footage' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can update their raw footage"
ON storage.objects FOR UPDATE
USING (bucket_id = 'raw-footage' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their raw footage"
ON storage.objects FOR DELETE
USING (bucket_id = 'raw-footage' AND auth.uid()::text = (storage.foldername(name))[1]);
