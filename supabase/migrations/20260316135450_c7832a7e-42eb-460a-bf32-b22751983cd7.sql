CREATE OR REPLACE FUNCTION public.get_twins_summary(_user_id uuid)
RETURNS TABLE (
  id uuid,
  name text,
  first_image text,
  image_count int,
  voice_cloning_key text,
  voice_sample_url text,
  face_description text,
  gender text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    t.id,
    t.name,
    t.reference_images[1] as first_image,
    coalesce(array_length(t.reference_images, 1), 0) as image_count,
    t.voice_cloning_key,
    t.voice_sample_url,
    t.face_description,
    t.gender
  FROM public.ai_twins t
  WHERE t.user_id = _user_id
    AND t.reference_images IS NOT NULL
    AND array_length(t.reference_images, 1) > 0
  ORDER BY t.created_at DESC
  LIMIT 50;
$$;