-- Create characters table
CREATE TABLE public.characters (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID,
  name TEXT NOT NULL,
  description TEXT,
  appearance_image TEXT,
  voice_type TEXT DEFAULT 'professional-female',
  kie_voice_id TEXT DEFAULT '',
  personality TEXT DEFAULT 'professional',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create video projects table
CREATE TABLE public.video_projects (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID,
  title TEXT NOT NULL,
  script TEXT NOT NULL,
  aspect_ratio TEXT DEFAULT '16:9',
  character_id UUID REFERENCES public.characters(id),
  voice_type TEXT DEFAULT 'professional-female',
  use_character_consistency BOOLEAN DEFAULT false,
  reference_image TEXT,
  seed_value TEXT,
  lock_seed BOOLEAN DEFAULT false,
  final_video_url TEXT,
  final_video_object_url TEXT,
  segments JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.characters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.video_projects ENABLE ROW LEVEL SECURITY;

-- Create policies for characters
CREATE POLICY "Users can view their own characters" 
ON public.characters 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own characters" 
ON public.characters 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own characters" 
ON public.characters 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own characters" 
ON public.characters 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create policies for video projects
CREATE POLICY "Users can view their own video projects" 
ON public.video_projects 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own video projects" 
ON public.video_projects 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own video projects" 
ON public.video_projects 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own video projects" 
ON public.video_projects 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for automatic timestamp updates
CREATE TRIGGER update_characters_updated_at
  BEFORE UPDATE ON public.characters
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_video_projects_updated_at
  BEFORE UPDATE ON public.video_projects
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();