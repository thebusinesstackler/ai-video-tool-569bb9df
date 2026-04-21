CREATE POLICY "Public can view published animated statics"
ON public.animated_statics
FOR SELECT
TO anon, authenticated
USING (animation_url IS NOT NULL);