CREATE POLICY "Public can view completed video repo projects"
ON public.video_repo_projects
FOR SELECT
TO anon, authenticated
USING (generated_video_url IS NOT NULL);