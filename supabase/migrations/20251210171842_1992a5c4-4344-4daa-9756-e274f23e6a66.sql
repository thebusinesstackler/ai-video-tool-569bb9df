-- Make the project-files bucket public so voice samples can be played
UPDATE storage.buckets 
SET public = true 
WHERE id = 'project-files';