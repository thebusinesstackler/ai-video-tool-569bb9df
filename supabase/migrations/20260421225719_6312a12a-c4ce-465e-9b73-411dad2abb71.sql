CREATE POLICY "Public can view published podcast videos"
ON public.podcast_projects FOR SELECT
TO anon, authenticated
USING (video_url IS NOT NULL);

CREATE POLICY "Public can view published chatcut videos"
ON public.chatcut_drafts FOR SELECT
TO anon, authenticated
USING (video_url IS NOT NULL);