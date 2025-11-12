import React, { useState, useEffect } from 'react';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Sparkles, Film, ChevronRight, Save, FolderOpen, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

const SAMPLE_MOVIES = [
  {
    value: 'sci-fi-thriller',
    label: 'Sci-Fi Thriller',
    description: 'A sci-fi thriller about a detective who discovers she\'s living in a simulated reality. She must navigate between the real world and the simulation to uncover who trapped humanity in this digital prison and why. As she gets closer to the truth, she realizes the architect of this world is someone she once trusted.'
  },
  {
    value: 'romantic-comedy',
    label: 'Romantic Comedy',
    description: 'A romantic comedy about two rival wedding planners who are forced to work together on the biggest wedding of the year. Despite their constant bickering and completely different approaches to love and romance, they slowly realize they might be perfect for each other. But their pride and past heartbreaks keep getting in the way.'
  },
  {
    value: 'fantasy-adventure',
    label: 'Fantasy Adventure',
    description: 'A fantasy adventure following a young librarian who discovers a magical book that transports her to different fictional worlds. To return home, she must collect enchanted artifacts from classic stories while being pursued by a dark sorcerer who wants to use the book to rewrite reality itself. Along the way, she teams up with characters from beloved tales.'
  },
  {
    value: 'horror-mystery',
    label: 'Horror Mystery',
    description: 'A horror mystery about a group of friends who return to their abandoned childhood summer camp 20 years after a tragic incident. As they try to uncover what really happened that night, they realize they\'re not alone. Something sinister still lurks in the woods, and it knows their darkest secrets. One by one, they must confront their past or become its next victims.'
  },
  {
    value: 'action-heist',
    label: 'Action Heist',
    description: 'An action heist film about a retired master thief who is forced out of retirement for one last job: stealing a priceless artifact from the most secure vault in the world. She assembles a diverse crew of specialists, but discovers the artifact holds the key to preventing a global catastrophe. Now it\'s not just about the score—it\'s about saving millions of lives.'
  },
  {
    value: 'drama-biopic',
    label: 'Historical Drama',
    description: 'A historical drama chronicling the rise of a pioneering female scientist in the 1950s who fights against institutional sexism to prove her groundbreaking theory. As she races against time and rival researchers, she must choose between her career ambitions and her personal life, while her discovery could change humanity\'s understanding of the universe forever.'
  }
];

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
}

const MovieSceneCreator = () => {
  const [movieIdea, setMovieIdea] = useState('');
  const [outline, setOutline] = useState('');
  const [scenes, setScenes] = useState<MovieScene[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isGeneratingScenes, setIsGeneratingScenes] = useState(false);
  const [generatingImageFor, setGeneratingImageFor] = useState<number | null>(null);
  const [generatingVideoFor, setGeneratingVideoFor] = useState<number | null>(null);
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);
  const [projectTitle, setProjectTitle] = useState('');
  const [savedProjects, setSavedProjects] = useState<any[]>([]);
  const [isSaveDialogOpen, setIsSaveDialogOpen] = useState(false);
  const [isLoadDialogOpen, setIsLoadDialogOpen] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    // Check if user is authenticated
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUserId(session?.user?.id || null);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserId(session?.user?.id || null);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (userId) {
      loadSavedProjects();
    }
  }, [userId]);

  const generateOutline = async () => {
    if (!movieIdea.trim()) {
      toast({
        title: "Movie Idea Required",
        description: "Please describe your movie idea first.",
        variant: "destructive"
      });
      return;
    }

    setIsGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-movie-outline', {
        body: { movieIdea }
      });

      if (error) throw error;

      setOutline(data.outline);
      toast({
        title: "Outline Generated!",
        description: "Your movie outline is ready. Review it and generate scenes.",
      });
    } catch (error: any) {
      console.error('Error generating outline:', error);
      toast({
        title: "Generation Failed",
        description: error.message || "Failed to generate outline. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const generateScenes = async () => {
    if (!outline.trim()) {
      toast({
        title: "No Outline",
        description: "Generate an outline first before creating scenes.",
        variant: "destructive"
      });
      return;
    }

    setIsGeneratingScenes(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-movie-scenes', {
        body: { outline }
      });

      if (error) throw error;

      setScenes(data.scenes);
      toast({
        title: "Scenes Generated!",
        description: `Created ${data.scenes.length} cinematic scenes with image prompts.`,
      });
    } catch (error: any) {
      console.error('Error generating scenes:', error);
      toast({
        title: "Generation Failed",
        description: error.message || "Failed to generate scenes. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsGeneratingScenes(false);
    }
  };

  const generateSceneImage = async (sceneNumber: number, imagePrompt: string) => {
    setGeneratingImageFor(sceneNumber);
    try {
      const { data, error } = await supabase.functions.invoke('generate-scene-image', {
        body: { prompt: imagePrompt }
      });

      if (error) throw error;

      // Update the scene with the generated image
      setScenes(prevScenes => 
        prevScenes.map(scene => 
          scene.sceneNumber === sceneNumber 
            ? { ...scene, generatedImage: data.imageUrl }
            : scene
        )
      );

      toast({
        title: "Image Generated!",
        description: `Scene ${sceneNumber} image created successfully.`,
      });
    } catch (error: any) {
      console.error('Error generating image:', error);
      toast({
        title: "Image Generation Failed",
        description: error.message || "Failed to generate image. Please try again.",
        variant: "destructive"
      });
    } finally {
      setGeneratingImageFor(null);
    }
  };

  const generateLipSyncVideo = async (sceneNumber: number) => {
    const scene = scenes.find(s => s.sceneNumber === sceneNumber);
    if (!scene?.generatedImage) {
      toast({
        title: "Image Required",
        description: "Please generate the scene image first.",
        variant: "destructive"
      });
      return;
    }

    setGeneratingVideoFor(sceneNumber);
    try {
      // Generate audio from dialogue or description
      const textForAudio = scene.dialogue || scene.description;
      
      toast({
        title: "Generating Audio",
        description: "Creating voiceover for the scene...",
      });

      const { data: ttsData, error: ttsError } = await supabase.functions.invoke('text-to-speech', {
        body: { text: textForAudio, voice: 'alloy' }
      });

      if (ttsError) throw ttsError;

      // Convert base64 audio to blob URL
      const audioBlob = new Blob(
        [Uint8Array.from(atob(ttsData.audioContent), c => c.charCodeAt(0))],
        { type: 'audio/mpeg' }
      );
      const audioUrl = URL.createObjectURL(audioBlob);

      toast({
        title: "Generating Video",
        description: "Creating lip-synced video with WaveSpeed AI...",
      });

      // Generate video with lip sync
      const { data: videoData, error: videoError } = await supabase.functions.invoke('wavespeed-video', {
        body: {
          action: 'create',
          params: {
            model: 'lipsync',
            imageUrl: scene.generatedImage,
            audioUrl: audioUrl,
            prompt: `Lip sync animation for: ${scene.title}`
          }
        }
      });

      if (videoError) throw videoError;

      // Update scene with task ID
      setScenes(prevScenes => 
        prevScenes.map(s => 
          s.sceneNumber === sceneNumber 
            ? { ...s, videoTaskId: videoData.taskId }
            : s
        )
      );

      // Poll for video completion
      const checkStatus = async () => {
        const { data: statusData, error: statusError } = await supabase.functions.invoke('wavespeed-video', {
          body: {
            action: 'status',
            taskId: videoData.taskId
          }
        });

        if (statusError) throw statusError;

        if (statusData.status === 'completed' && statusData.videoUrl) {
          setScenes(prevScenes => 
            prevScenes.map(s => 
              s.sceneNumber === sceneNumber 
                ? { ...s, generatedVideo: statusData.videoUrl }
                : s
            )
          );
          setGeneratingVideoFor(null);
          
          toast({
            title: "Video Generated!",
            description: `Scene ${sceneNumber} lip-sync video is ready.`,
          });
        } else if (statusData.status === 'failed') {
          throw new Error('Video generation failed');
        } else {
          // Continue polling
          setTimeout(checkStatus, 3000);
        }
      };

      setTimeout(checkStatus, 3000);

    } catch (error: any) {
      console.error('Error generating video:', error);
      toast({
        title: "Video Generation Failed",
        description: error.message || "Failed to generate video. Please try again.",
        variant: "destructive"
      });
      setGeneratingVideoFor(null);
    }
  };

  const loadSavedProjects = async () => {
    if (!userId) return;

    try {
      const { data, error } = await supabase
        .from('movie_projects')
        .select('*')
        .order('updated_at', { ascending: false });

      if (error) throw error;

      setSavedProjects(data || []);
    } catch (error: any) {
      console.error('Error loading projects:', error);
    }
  };

  const saveProject = async () => {
    if (!userId) {
      toast({
        title: "Authentication Required",
        description: "Please log in to save projects.",
        variant: "destructive"
      });
      return;
    }

    if (!projectTitle.trim()) {
      toast({
        title: "Title Required",
        description: "Please enter a project title.",
        variant: "destructive"
      });
      return;
    }

    try {
      const projectData = {
        user_id: userId,
        title: projectTitle,
        movie_idea: movieIdea,
        outline: outline,
        scenes: scenes as any // Cast to Json type
      };

      if (currentProjectId) {
        // Update existing project
        const { error } = await supabase
          .from('movie_projects')
          .update(projectData)
          .eq('id', currentProjectId);

        if (error) throw error;

        toast({
          title: "Project Updated!",
          description: "Your movie project has been saved.",
        });
      } else {
        // Create new project
        const { data, error } = await supabase
          .from('movie_projects')
          .insert([projectData])
          .select()
          .single();

        if (error) throw error;

        setCurrentProjectId(data.id);
        toast({
          title: "Project Saved!",
          description: "Your movie project has been created.",
        });
      }

      setIsSaveDialogOpen(false);
      loadSavedProjects();
    } catch (error: any) {
      console.error('Error saving project:', error);
      toast({
        title: "Save Failed",
        description: error.message || "Failed to save project. Please try again.",
        variant: "destructive"
      });
    }
  };

  const loadProject = async (projectId: string) => {
    try {
      const { data, error } = await supabase
        .from('movie_projects')
        .select('*')
        .eq('id', projectId)
        .single();

      if (error) throw error;

      setCurrentProjectId(data.id);
      setProjectTitle(data.title);
      setMovieIdea(data.movie_idea);
      setOutline(data.outline || '');
      setScenes((data.scenes as any) || []); // Cast from Json to MovieScene[]

      setIsLoadDialogOpen(false);
      toast({
        title: "Project Loaded!",
        description: `Loaded "${data.title}"`,
      });
    } catch (error: any) {
      console.error('Error loading project:', error);
      toast({
        title: "Load Failed",
        description: error.message || "Failed to load project. Please try again.",
        variant: "destructive"
      });
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
        description: "The project has been removed.",
      });

      loadSavedProjects();

      // Clear current project if it was deleted
      if (currentProjectId === projectId) {
        setCurrentProjectId(null);
        setProjectTitle('');
        setMovieIdea('');
        setOutline('');
        setScenes([]);
      }
    } catch (error: any) {
      console.error('Error deleting project:', error);
      toast({
        title: "Delete Failed",
        description: error.message || "Failed to delete project. Please try again.",
        variant: "destructive"
      });
    }
  };

  const startNewProject = () => {
    setCurrentProjectId(null);
    setProjectTitle('');
    setMovieIdea('');
    setOutline('');
    setScenes([]);
    toast({
      title: "New Project",
      description: "Started a new movie project.",
    });
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground mb-2">Movie Scene Creator</h1>
            <p className="text-muted-foreground">
              Describe your movie idea, get an AI-generated outline, and create scenes for your film.
            </p>
            {currentProjectId && projectTitle && (
              <p className="text-sm text-primary mt-1">Currently editing: {projectTitle}</p>
            )}
          </div>
          
          {userId && (
            <div className="flex gap-2">
              <Button onClick={startNewProject} variant="outline" size="sm">
                <Film className="w-4 h-4 mr-2" />
                New Project
              </Button>
              
              <Dialog open={isLoadDialogOpen} onOpenChange={setIsLoadDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm">
                    <FolderOpen className="w-4 h-4 mr-2" />
                    Load Project
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Load Project</DialogTitle>
                    <DialogDescription>Select a project to continue working on</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-2">
                    {savedProjects.length === 0 ? (
                      <p className="text-muted-foreground text-center py-8">No saved projects yet</p>
                    ) : (
                      savedProjects.map((project) => (
                        <Card key={project.id} className="cursor-pointer hover:bg-accent/50 transition-colors">
                          <CardContent className="p-4 flex items-center justify-between">
                            <div className="flex-1" onClick={() => loadProject(project.id)}>
                              <h3 className="font-semibold">{project.title}</h3>
                              <p className="text-sm text-muted-foreground">
                                {new Date(project.updated_at).toLocaleDateString()} • {project.scenes?.length || 0} scenes
                              </p>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteProject(project.id);
                              }}
                            >
                              <Trash2 className="w-4 h-4 text-destructive" />
                            </Button>
                          </CardContent>
                        </Card>
                      ))
                    )}
                  </div>
                </DialogContent>
              </Dialog>

              <Dialog open={isSaveDialogOpen} onOpenChange={setIsSaveDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="sm">
                    <Save className="w-4 h-4 mr-2" />
                    Save Project
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{currentProjectId ? 'Update' : 'Save'} Project</DialogTitle>
                    <DialogDescription>
                      {currentProjectId ? 'Update your movie project' : 'Give your movie project a name'}
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="project-title">Project Title</Label>
                      <Input
                        id="project-title"
                        placeholder="Enter project title..."
                        value={projectTitle}
                        onChange={(e) => setProjectTitle(e.target.value)}
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button onClick={saveProject}>
                      <Save className="w-4 h-4 mr-2" />
                      {currentProjectId ? 'Update' : 'Save'}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          )}
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Movie Idea Input */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Film className="w-5 h-5 text-primary" />
                Your Movie Idea
              </CardTitle>
              <CardDescription>
                Describe what your movie is about - genre, plot, characters, setting, etc.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="sample-movies">Quick Start Samples</Label>
                <Select onValueChange={(value) => {
                  const sample = SAMPLE_MOVIES.find(m => m.value === value);
                  if (sample) setMovieIdea(sample.description);
                }}>
                  <SelectTrigger id="sample-movies">
                    <SelectValue placeholder="Choose a sample movie idea..." />
                  </SelectTrigger>
                  <SelectContent>
                    {SAMPLE_MOVIES.map((movie) => (
                      <SelectItem key={movie.value} value={movie.value}>
                        {movie.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="movie-idea">Movie Description</Label>
                <Textarea
                  id="movie-idea"
                  placeholder="Choose a sample above or write your own movie idea..."
                  value={movieIdea}
                  onChange={(e) => setMovieIdea(e.target.value)}
                  rows={10}
                  className="resize-none"
                />
              </div>
              <Button
                onClick={generateOutline}
                disabled={isGenerating}
                className="w-full"
              >
                {isGenerating ? (
                  <>
                    <Sparkles className="w-4 h-4 mr-2 animate-spin" />
                    Generating Outline...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 mr-2" />
                    Generate Movie Outline
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Generated Outline */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-primary" />
                Generated Outline
              </CardTitle>
              <CardDescription>
                AI-generated movie structure with act breakdowns and key scenes
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="outline">Outline</Label>
                <Textarea
                  id="outline"
                  placeholder="Your movie outline will appear here after generation..."
                  value={outline}
                  onChange={(e) => setOutline(e.target.value)}
                  rows={12}
                  className="resize-none"
                />
              </div>
              <Button
                onClick={generateScenes}
                disabled={!outline.trim() || isGeneratingScenes}
                className="w-full"
                variant="secondary"
              >
                {isGeneratingScenes ? (
                  <>
                    <Sparkles className="w-4 h-4 mr-2 animate-spin" />
                    Generating Scenes...
                  </>
                ) : (
                  <>
                    <ChevronRight className="w-4 h-4 mr-2" />
                    Generate Scenes from Outline
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Generated Scenes */}
        {scenes.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-2xl font-bold text-foreground">Generated Scenes</h2>
            <div className="grid gap-4">
              {scenes.map((scene) => (
                <Card key={scene.sceneNumber}>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Film className="w-5 h-5 text-primary" />
                      Scene {scene.sceneNumber}: {scene.title}
                    </CardTitle>
                    <CardDescription>
                      {scene.location} • {scene.timeOfDay}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label className="text-sm font-semibold">Description</Label>
                      <p className="text-sm text-muted-foreground mt-1">{scene.description}</p>
                    </div>
                    
                    {scene.dialogue && (
                      <div>
                        <Label className="text-sm font-semibold">Dialogue</Label>
                        <p className="text-sm text-muted-foreground mt-1 italic">{scene.dialogue}</p>
                      </div>
                    )}
                    
                    <div>
                      <Label className="text-sm font-semibold">Image Generation Prompt</Label>
                      <Textarea
                        value={scene.imagePrompt}
                        readOnly
                        rows={3}
                        className="mt-1 bg-muted/50 resize-none"
                      />
                    </div>

                    {scene.generatedImage ? (
                      <div className="space-y-3">
                        <div>
                          <Label className="text-sm font-semibold">Generated Image</Label>
                          <img 
                            src={scene.generatedImage} 
                            alt={`Scene ${scene.sceneNumber}: ${scene.title}`}
                            className="mt-2 w-full rounded-lg border border-border"
                          />
                        </div>
                        
                        {scene.generatedVideo ? (
                          <div>
                            <Label className="text-sm font-semibold">Generated Lip Sync Video</Label>
                            <video 
                              src={scene.generatedVideo} 
                              controls
                              className="mt-2 w-full rounded-lg border border-border"
                            />
                          </div>
                        ) : (
                          <Button
                            onClick={() => generateLipSyncVideo(scene.sceneNumber)}
                            disabled={generatingVideoFor === scene.sceneNumber}
                            className="w-full"
                            variant="secondary"
                          >
                            {generatingVideoFor === scene.sceneNumber ? (
                              <>
                                <Sparkles className="w-4 h-4 mr-2 animate-spin" />
                                Generating Lip Sync Video...
                              </>
                            ) : (
                              <>
                                <Film className="w-4 h-4 mr-2" />
                                Generate Lip Sync Video
                              </>
                            )}
                          </Button>
                        )}
                      </div>
                    ) : (
                      <Button
                        onClick={() => generateSceneImage(scene.sceneNumber, scene.imagePrompt)}
                        disabled={generatingImageFor === scene.sceneNumber}
                        className="w-full"
                        variant="outline"
                      >
                        {generatingImageFor === scene.sceneNumber ? (
                          <>
                            <Sparkles className="w-4 h-4 mr-2 animate-spin" />
                            Generating Image...
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-4 h-4 mr-2" />
                            Generate Scene Image
                          </>
                        )}
                      </Button>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Info Card */}
        <Card className="bg-gradient-accent border-primary/20">
          <CardContent className="pt-6">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                <Sparkles className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground mb-2">How It Works</h3>
                <ol className="text-sm text-muted-foreground space-y-2">
                  <li><strong>1. Describe Your Movie:</strong> Write about your plot, characters, genre, and setting.</li>
                  <li><strong>2. Generate Outline:</strong> AI creates a structured outline with acts, sequences, and key scenes.</li>
                  <li><strong>3. Create Scenes:</strong> Transform outline beats into detailed scenes with image prompts.</li>
                  <li><strong>4. Generate Videos:</strong> Use each scene with the image prompts to bring your movie to life.</li>
                </ol>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default MovieSceneCreator;
