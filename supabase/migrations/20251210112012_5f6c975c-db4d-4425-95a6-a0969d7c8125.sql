-- Add gender column to ai_twins table
ALTER TABLE public.ai_twins ADD COLUMN gender text DEFAULT 'male';

-- Add a comment for clarity
COMMENT ON COLUMN public.ai_twins.gender IS 'Gender of the AI Twin (male, female, non-binary)';