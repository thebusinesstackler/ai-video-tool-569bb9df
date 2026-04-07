CREATE POLICY "Users can update their own images"
ON public.generated_images
FOR UPDATE
USING (auth.uid() = user_id);