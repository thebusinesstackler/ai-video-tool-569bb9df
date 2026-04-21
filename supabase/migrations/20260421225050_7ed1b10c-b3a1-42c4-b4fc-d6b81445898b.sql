-- Public comments on shared video repo projects
CREATE TABLE public.public_video_comments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL,
  author_name TEXT NOT NULL DEFAULT 'Anonymous',
  comment TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_public_video_comments_project ON public.public_video_comments(project_id, created_at DESC);

ALTER TABLE public.public_video_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view public comments"
ON public.public_video_comments FOR SELECT
USING (true);

CREATE POLICY "Anyone can post public comments"
ON public.public_video_comments FOR INSERT
WITH CHECK (
  char_length(trim(comment)) BETWEEN 1 AND 1000
  AND char_length(trim(author_name)) BETWEEN 1 AND 60
);

-- Public favorites (one per visitor token per video)
CREATE TABLE public.public_video_favorites (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL,
  visitor_token TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (project_id, visitor_token)
);

CREATE INDEX idx_public_video_favorites_project ON public.public_video_favorites(project_id);

ALTER TABLE public.public_video_favorites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view public favorites"
ON public.public_video_favorites FOR SELECT
USING (true);

CREATE POLICY "Anyone can add a public favorite"
ON public.public_video_favorites FOR INSERT
WITH CHECK (char_length(visitor_token) BETWEEN 8 AND 128);

CREATE POLICY "Anyone can remove their own public favorite"
ON public.public_video_favorites FOR DELETE
USING (true);