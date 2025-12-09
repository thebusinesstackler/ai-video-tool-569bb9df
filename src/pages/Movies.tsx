import React, { useState, useEffect } from 'react';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Film, Trash2, Eye } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface MovieScene {
  sceneNumber: number;
  title: string;
  location: string;
  timeOfDay: string;
  description: string;
  dialogue: string | null;
  imagePrompt: string;
  generatedImage?: string;
  generatedVideo?: string;
  videoTaskId?: string;
  selectedVoice?: string;
}

interface MovieProject {
  id: string;
  title: string;
  movie_idea: string;
  outline: string;
  scenes: MovieScene[];
  created_at: string;
  updated_at: string;
}

const Movies = () => {
  const [projects, setProjects] = useState<MovieProject[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedProject, setSelectedProject] = useState<MovieProject | null>(null);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    loadProjects();
  }, []);

  const loadProjects = async () => {
    try {
      setIsLoading(true);
      // Only fetch metadata columns, not the large scenes JSON
      const { data, error } = await supabase
        .from('movie_projects')
        .select('id, title, movie_idea, outline, created_at, updated_at')
        .order('updated_at', { ascending: false });

      if (error) throw error;

      // Set projects with empty scenes array initially - will load on demand
      setProjects((data || []).map(p => ({
        ...p,
        scenes: [] as MovieScene[]
      })));
    } catch (error: any) {
      console.error('Error loading projects:', error);
      toast({
        title: "Load Failed",
        description: error.message || "Failed to load movie projects.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const deleteProject = async (projectId: string) => {
    try {
      const { error } = await supabase
        .from('movie_projects')
        .delete()
        .eq('id', projectId);

      if (error) throw error;

      toast({
        title: "Project Deleted",
        description: "The movie project has been removed.",
      });

      loadProjects();
    } catch (error: any) {
      console.error('Error deleting project:', error);
      toast({
        title: "Delete Failed",
        description: error.message || "Failed to delete project.",
        variant: "destructive"
      });
    }
  };

  const viewProject = async (project: MovieProject) => {
    try {
      // Load full project data including scenes
      const { data, error } = await supabase
        .from('movie_projects')
        .select('*')
        .eq('id', project.id)
        .single();

      if (error) throw error;

      setSelectedProject({
        ...data,
        scenes: (data.scenes as any) as MovieScene[]
      });
      setIsViewDialogOpen(true);
    } catch (error: any) {
      console.error('Error loading project details:', error);
      toast({
        title: "Load Failed",
        description: "Failed to load project details.",
        variant: "destructive"
      });
    }
  };

  const editProject = (projectId: string) => {
    navigate(`/movie-scene-creator?projectId=${projectId}`);
  };

  const getVideoCount = (scenes: MovieScene[]) => {
    return scenes?.filter(scene => scene.generatedVideo).length || 0;
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground mb-2">Movies</h1>
            <p className="text-muted-foreground">
              View and manage all your saved movie projects
            </p>
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : projects.length === 0 ? (
          <Card>
            <CardContent className="py-12">
              <div className="text-center">
                <Film className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">No Movies Yet</h3>
                <p className="text-muted-foreground mb-4">
                  Start creating your first movie project
                </p>
                <Button onClick={() => navigate('/movie-scene-creator')}>
                  <Film className="w-4 h-4 mr-2" />
                  Create Movie
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {projects.map((project) => {
              return (
                <Card key={project.id} className="hover:shadow-lg transition-shadow">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Film className="w-5 h-5 text-primary" />
                      {project.title}
                    </CardTitle>
                    <CardDescription>
                      {new Date(project.updated_at).toLocaleDateString()}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {project.movie_idea || 'No description'}
                    </p>
                    
                    <div className="flex gap-2">
                      <Button
                        onClick={() => viewProject(project)}
                        variant="outline"
                        size="sm"
                        className="flex-1"
                      >
                        <Eye className="w-4 h-4 mr-1" />
                        View
                      </Button>
                      <Button
                        onClick={() => editProject(project.id)}
                        size="sm"
                        className="flex-1"
                      >
                        Edit
                      </Button>
                      <Button
                        onClick={() => deleteProject(project.id)}
                        variant="ghost"
                        size="sm"
                      >
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Film className="w-5 h-5" />
                {selectedProject?.title}
              </DialogTitle>
              <DialogDescription>
                {selectedProject?.scenes?.length || 0} scenes • {getVideoCount(selectedProject?.scenes || [])} videos generated
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4 mt-4">
              {selectedProject?.scenes?.map((scene) => (
                <Card key={scene.sceneNumber}>
                  <CardHeader>
                    <CardTitle className="text-lg">
                      Scene {scene.sceneNumber}: {scene.title}
                    </CardTitle>
                    <CardDescription>
                      {scene.location} • {scene.timeOfDay}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <p className="text-sm text-muted-foreground">{scene.description}</p>
                      {scene.dialogue && (
                        <p className="text-sm text-muted-foreground italic mt-2">"{scene.dialogue}"</p>
                      )}
                    </div>
                    
                    {scene.generatedImage && (
                      <div>
                        <img 
                          src={scene.generatedImage} 
                          alt={`Scene ${scene.sceneNumber}`}
                          className="w-full rounded-lg border border-border"
                        />
                      </div>
                    )}
                    
                    {scene.generatedVideo && (
                      <div>
                        <video 
                          src={scene.generatedVideo} 
                          controls
                          className="w-full rounded-lg border border-border"
                        />
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
};

export default Movies;
