
CREATE POLICY "Authenticated users can upload to reels bucket"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'reels');

CREATE POLICY "Authenticated users can read from reels bucket"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'reels');

CREATE POLICY "Public read access to reels bucket"
ON storage.objects
FOR SELECT
TO anon
USING (bucket_id = 'reels');
