import React, { useState, useEffect, useRef } from 'react';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Film, Trash2, Eye, Volume2, ImageIcon, Play, Loader2, Square, Plus } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate, useLocation } from 'react-router-dom';
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

interface AITwin {
  id: string;
  name: string;
  reference_images: string[];
  voice_cloning_key: string | null;
  voice_sample_url: string | null;
  description: string | null;
  face_description: string | null;
}

const Movies = () => {
  const location = useLocation();
  const [projects, setProjects] = useState<MovieProject[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedProject, setSelectedProject] = useState<MovieProject | null>(null);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  // AI Twin from navigation state
  const [selectedTwin, setSelectedTwin] = useState<AITwin | null>(null);
  const [voicePreviewText, setVoicePreviewText] = useState('');
  const [isPreviewingVoice, setIsPreviewingVoice] = useState(false);
  const [isPlayingVoice, setIsPlayingVoice] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    loadProjects();
  }, []);

  // Check for AI Twin from navigation state
  useEffect(() => {
    const state = location.state as { selectedTwin?: AITwin } | null;
    if (state?.selectedTwin) {
      setSelectedTwin(state.selectedTwin);
      // Clear the state to prevent showing twin panel on refresh
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

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

  // Voice preview functionality
  const previewClonedVoice = async () => {
    if (!voicePreviewText.trim()) {
      toast({
        title: "Enter Text",
        description: "Please type something for your AI Twin to say.",
        variant: "destructive"
      });
      return;
    }

    if (!selectedTwin?.voice_sample_url) {
      toast({
        title: "No Voice Sample",
        description: "This AI Twin doesn't have a cloned voice.",
        variant: "destructive"
      });
      return;
    }

    setIsPreviewingVoice(true);
    try {
      // Use the text-to-speech function with cloned voice
      const { data, error } = await supabase.functions.invoke('text-to-speech', {
        body: {
          text: voicePreviewText,
          voice: 'cloned',
          clonedVoiceUrl: selectedTwin.voice_sample_url
        }
      });

      if (error) throw error;

      if (data?.audioUrl) {
        // Stop any currently playing audio
        if (audioRef.current) {
          audioRef.current.pause();
          audioRef.current = null;
        }

        const audio = new Audio(data.audioUrl);
        audioRef.current = audio;
        
        audio.onplay = () => setIsPlayingVoice(true);
        audio.onended = () => setIsPlayingVoice(false);
        audio.onerror = () => {
          setIsPlayingVoice(false);
          toast({
            title: "Playback Error",
            description: "Failed to play the audio.",
            variant: "destructive"
          });
        };
        
        await audio.play();
      }

      toast({
        title: "Voice Preview Ready",
        description: `Playing ${selectedTwin.name}'s voice...`,
      });
    } catch (error: any) {
      console.error('Voice preview error:', error);
      toast({
        title: "Preview Failed",
        description: error.message || "Failed to preview cloned voice.",
        variant: "destructive"
      });
    } finally {
      setIsPreviewingVoice(false);
    }
  };

  const stopVoicePlayback = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
      setIsPlayingVoice(false);
    }
  };

  const createMovieWithTwin = () => {
    navigate('/movie-scene-creator', {
      state: {
        selectedTwin,
        twinId: selectedTwin?.id,
        twinName: selectedTwin?.name,
        twinDescription: selectedTwin?.description,
        referenceImages: selectedTwin?.reference_images
      }
    });
  };

  const clearSelectedTwin = () => {
    setSelectedTwin(null);
    setVoicePreviewText('');
    stopVoicePlayback();
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
          <Button onClick={() => navigate('/movie-scene-creator')}>
            <Plus className="w-4 h-4 mr-2" />
            New Movie
          </Button>
        </div>

        {/* AI Twin Feature Panel */}
        {selectedTwin && (
          <Card className="border-primary bg-gradient-to-r from-primary/5 to-primary/10">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Film className="w-5 h-5 text-primary" />
                  Create Movie with {selectedTwin.name}
                </CardTitle>
                <Button variant="ghost" size="sm" onClick={clearSelectedTwin}>
                  Close
                </Button>
              </div>
              <CardDescription>
                Your AI Twin is ready to star in a movie. Preview the cloned voice below.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Twin Info Row */}
              <div className="flex gap-6">
                {/* Reference Images */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium flex items-center gap-2">
                    <ImageIcon className="w-4 h-4" />
                    Reference Images ({selectedTwin.reference_images?.length || 0})
                  </Label>
                  <div className="flex gap-2">
                    {selectedTwin.reference_images?.slice(0, 4).map((img, idx) => (
                      <img 
                        key={idx}
                        src={img}
                        alt={`Reference ${idx + 1}`}
                        className="w-16 h-16 rounded-lg object-cover border-2 border-border"
                      />
                    ))}
                    {(selectedTwin.reference_images?.length || 0) > 4 && (
                      <div className="w-16 h-16 rounded-lg bg-muted flex items-center justify-center text-sm font-medium">
                        +{selectedTwin.reference_images!.length - 4} more
                      </div>
                    )}
                  </div>
                </div>

                {/* Twin Details */}
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-2">
                    <Badge variant={selectedTwin.voice_cloning_key ? "default" : "secondary"}>
                      <Volume2 className="w-3 h-3 mr-1" />
                      {selectedTwin.voice_cloning_key ? "Voice Cloned" : "No Voice"}
                    </Badge>
                    {selectedTwin.face_description && (
                      <Badge variant="outline" className="text-xs">
                        {selectedTwin.face_description.includes('male') ? 'Male' : 
                         selectedTwin.face_description.includes('female') ? 'Female' : 'Person'}
                      </Badge>
                    )}
                  </div>
                  {selectedTwin.description && (
                    <p className="text-sm text-muted-foreground">{selectedTwin.description}</p>
                  )}
                </div>
              </div>

              {/* Voice Preview Section */}
              {selectedTwin.voice_sample_url && (
                <div className="space-y-3 p-4 bg-background rounded-lg border">
                  <Label className="text-sm font-medium flex items-center gap-2">
                    <Volume2 className="w-4 h-4 text-primary" />
                    Preview Cloned Voice
                  </Label>
                  <Textarea
                    placeholder={`Type what you want ${selectedTwin.name} to say...`}
                    value={voicePreviewText}
                    onChange={(e) => setVoicePreviewText(e.target.value)}
                    className="min-h-[80px] resize-none"
                  />
                  <div className="flex gap-2">
                    {isPlayingVoice ? (
                      <Button 
                        variant="outline" 
                        onClick={stopVoicePlayback}
                      >
                        <Square className="w-4 h-4 mr-2" />
                        Stop
                      </Button>
                    ) : (
                      <Button 
                        onClick={previewClonedVoice}
                        disabled={isPreviewingVoice || !voicePreviewText.trim()}
                      >
                        {isPreviewingVoice ? (
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                          <Play className="w-4 h-4 mr-2" />
                        )}
                        {isPreviewingVoice ? 'Generating...' : 'Preview Voice'}
                      </Button>
                    )}
                  </div>
                </div>
              )}

              {/* Create Movie Button */}
              <Button 
                size="lg" 
                className="w-full bg-gradient-primary hover:opacity-90"
                onClick={createMovieWithTwin}
              >
                <Film className="w-5 h-5 mr-2" />
                Start Creating Movie with {selectedTwin.name}
              </Button>
            </CardContent>
          </Card>
        )}

        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : projects.length === 0 && !selectedTwin ? (
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