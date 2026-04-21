CREATE POLICY "Public can view ready vizard projects"
ON public.vizard_projects
FOR SELECT
TO anon, authenticated
USING (status = 'ready' AND vizard_videos IS NOT NULL);