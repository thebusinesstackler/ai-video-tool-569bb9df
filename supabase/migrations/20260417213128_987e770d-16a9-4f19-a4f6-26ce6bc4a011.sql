UPDATE public.video_repo_projects 
SET status = 'completed',
    generated_video_url = 'https://d1q70pf5vjeyhc.cloudfront.net/predictions/ba2d48c97ab54ea8b1d27478beb7f227/1.mp4',
    segment_urls = ARRAY['https://d1q70pf5vjeyhc.cloudfront.net/predictions/ba2d48c97ab54ea8b1d27478beb7f227/1.mp4'],
    external_task_id = '2723383b0dac4768a0b9ba3723729db6',
    custom_name = COALESCE(custom_name, 'Sunlife Organics x Lifecykel'),
    updated_at = now()
WHERE id = 'ee8e0b07-fecf-4544-bf80-a6e35856bb27';