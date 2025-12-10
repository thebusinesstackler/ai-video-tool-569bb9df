-- Create user_logos table for storing uploaded logos
CREATE TABLE public.user_logos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT,
  logo_url TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.user_logos ENABLE ROW LEVEL SECURITY;

-- Create policies for user access
CREATE POLICY "Users can view their own logos" 
ON public.user_logos 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own logos" 
ON public.user_logos 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own logos" 
ON public.user_logos 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own logos" 
ON public.user_logos 
FOR DELETE 
USING (auth.uid() = user_id);