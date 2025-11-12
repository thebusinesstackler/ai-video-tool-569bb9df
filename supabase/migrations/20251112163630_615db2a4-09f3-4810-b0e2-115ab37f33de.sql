-- Create movie_projects table
CREATE TABLE public.movie_projects (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  movie_idea TEXT NOT NULL,
  outline TEXT,
  scenes JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.movie_projects ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for user access
CREATE POLICY "Users can view their own movie projects" 
ON public.movie_projects 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own movie projects" 
ON public.movie_projects 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own movie projects" 
ON public.movie_projects 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own movie projects" 
ON public.movie_projects 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_movie_projects_updated_at
BEFORE UPDATE ON public.movie_projects
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();