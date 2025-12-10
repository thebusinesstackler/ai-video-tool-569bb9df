import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, useLocation } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Sparkles, Film, ChevronRight, Save, FolderOpen, Trash2, Video, Copy, Star, Wand2, ArrowRight, Camera, Lightbulb, Image, Play, User, Volume2, ImageIcon, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { stitchVideos } from '@/lib/videoStitch';
import { PeteAIAssistant } from '@/components/PeteAIAssistant';

interface AITwin {
  id: string;
  name: string;
  reference_images: string[];
  voice_cloning_key: string | null;
  voice_sample_url: string | null;
  description: string | null;
  face_description: string | null;
  gender: string | null;
}

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
  otherCharacterDialogue?: string | null;
  imagePrompt: string;
  generatedImage?: string;
  generatedVideo?: string;
  videoTaskId?: string;
  selectedCameraAngle?: string;
  selectedLighting?: string;
}

interface VisualPreset {
  id: string;
  name: string;
  camera_angle: string;
  lighting_style: string;
}

const CAMERA_ANGLES = [
  { id: 'eye-level', name: 'Eye Level', description: 'Standard neutral perspective' },
  { id: 'low-angle', name: 'Low Angle', description: 'Camera looks up, subject appears powerful' },
  { id: 'high-angle', name: 'High Angle', description: 'Camera looks down, subject appears vulnerable' },
  { id: 'birds-eye', name: 'Bird\'s Eye View', description: 'Directly overhead, dramatic perspective' },
  { id: 'dutch-angle', name: 'Dutch Angle', description: 'Tilted camera, creates tension and unease' },
  { id: 'over-shoulder', name: 'Over-the-Shoulder', description: 'View from behind character' },
  { id: 'pov', name: 'POV Shot', description: 'Character\'s point of view' },
  { id: 'close-up', name: 'Close-Up', description: 'Tight shot on subject, emotional detail' },
  { id: 'wide-shot', name: 'Wide Shot', description: 'Full scene establishing shot' },
  { id: 'medium-shot', name: 'Medium Shot', description: 'Waist-up framing, balanced' },
];

const LIGHTING_STYLES = [
  { id: 'natural', name: 'Natural Light', description: 'Soft, realistic daylight' },
  { id: 'golden-hour', name: 'Golden Hour', description: 'Warm sunset/sunrise glow' },
  { id: 'blue-hour', name: 'Blue Hour', description: 'Cool twilight atmosphere' },
  { id: 'noir', name: 'Film Noir', description: 'High contrast, dramatic shadows' },
  { id: 'studio', name: 'Studio Lighting', description: 'Professional three-point setup' },
  { id: 'moonlight', name: 'Moonlight', description: 'Cool, ethereal night lighting' },
  { id: 'neon', name: 'Neon/Cyberpunk', description: 'Vibrant colored lights' },
  { id: 'candlelight', name: 'Candlelight', description: 'Warm, flickering ambiance' },
  { id: 'overcast', name: 'Overcast', description: 'Soft, diffused lighting' },
  { id: 'harsh', name: 'Harsh Light', description: 'Strong direct lighting, sharp shadows' },
];

const MovieSceneCreator = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
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
  const [isStitching, setIsStitching] = useState(false);
  const [stitchProgress, setStitchProgress] = useState(0);
  const [stitchedVideoUrl, setStitchedVideoUrl] = useState<string | null>(null);
  const [visualPresets, setVisualPresets] = useState<VisualPreset[]>([]);
  const [isSavePresetDialogOpen, setIsSavePresetDialogOpen] = useState(false);
  const [newPresetName, setNewPresetName] = useState('');
  const [selectedSceneForPreset, setSelectedSceneForPreset] = useState<number | null>(null);
  const [isTransferring, setIsTransferring] = useState(false);
  const [peteInputValue, setPeteInputValue] = useState('');
  const [characters, setCharacters] = useState<{ id: string; name: string; description: string | null; reference_images: string[] | null }[]>([]);
  const [aiTwins, setAiTwins] = useState<AITwin[]>([]);
  const [galleryImages, setGalleryImages] = useState<{ id: string; image_url: string; prompt: string | null }[]>([]);
  const [selectedCharacterId, setSelectedCharacterId] = useState<string | null>(null);
  const [selectedTwin, setSelectedTwin] = useState<AITwin | null>(null);
  const [selectedGalleryImage, setSelectedGalleryImage] = useState<{ id: string; image_url: string; prompt: string | null } | null>(null);
  const [characterSourceTab, setCharacterSourceTab] = useState<'twins' | 'characters' | 'gallery'>('twins');
  const { toast } = useToast();

  // Check for AI Twin from navigation state
  useEffect(() => {
    const state = location.state as { selectedTwin?: AITwin; referenceImages?: string[] } | null;
    if (state?.selectedTwin) {
      setSelectedTwin(state.selectedTwin);
      toast({
        title: "AI Twin Selected",
        description: `${state.selectedTwin.name} is ready to star in your movie!`,
      });
      // Clear the state to prevent showing twin panel on refresh
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  // Handle movie idea from Pete AI
  const handleMovieIdeaCaptured = (idea: string) => {
    setMovieIdea(idea);
    setPeteInputValue(idea);
  };

  // Handle quick start sample selection
  const handleSampleSelect = (sampleValue: string) => {
    const sample = SAMPLE_MOVIES.find(m => m.value === sampleValue);
    if (sample) {
      setPeteInputValue(sample.description);
    }
  };

  // Transfer to Reels & Stories
  const transferToReels = async () => {
    if (!movieIdea.trim()) {
      toast({
        title: "No Movie Idea",
        description: "Please enter a movie idea first before transferring to Reels.",
        variant: "destructive"
      });
      return;
    }

    setIsTransferring(true);
    try {
      // Auto-save the project if user is logged in
      if (userId && (outline || scenes.length > 0)) {
        const title = projectTitle || `Movie: ${movieIdea.slice(0, 50)}...`;
        
        if (currentProjectId) {
          // Update existing project
          await supabase
            .from('movie_projects')
            .update({
              movie_idea: movieIdea,
              outline: outline,
              scenes: scenes as any,
              title: title,
              updated_at: new Date().toISOString()
            })
            .eq('id', currentProjectId);
        } else {
          // Create new project
          const { data } = await supabase
            .from('movie_projects')
            .insert([{
              user_id: userId,
              movie_idea: movieIdea,
              outline: outline,
              scenes: scenes as any,
              title: title
            }])
            .select()
            .single();
          
          if (data) {
            setCurrentProjectId(data.id);
          }
        }
        
        toast({
          title: "Project Saved",
          description: "Your movie project has been auto-saved."
        });
      }

      // Navigate to Reels with movie idea as topic
      const params = new URLSearchParams({
        source: 'movie-scene',
        topic: movieIdea,
        ...(outline && { outline: outline.slice(0, 500) })
      });
      
      navigate(`/reels?${params.toString()}`);
      
    } catch (error: any) {
      console.error('Transfer error:', error);
      toast({
        title: "Transfer Failed",
        description: error.message || "Failed to transfer to Reels.",
        variant: "destructive"
      });
    } finally {
      setIsTransferring(false);
    }
  };

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
      loadVisualPresets();
      loadCharacters();
      loadAiTwins();
      loadGalleryImages();
    }
  }, [userId]);

  const loadCharacters = async () => {
    if (!userId) return;
    try {
      const { data, error } = await supabase
        .from('characters')
        .select('id, name, description, reference_images')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      setCharacters(data || []);
    } catch (error) {
      console.error('Failed to load characters:', error);
    }
  };

  const loadAiTwins = async () => {
    if (!userId) return;
    try {
      const { data, error } = await supabase
        .from('ai_twins')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      setAiTwins((data as AITwin[]) || []);
    } catch (error) {
      console.error('Failed to load AI twins:', error);
    }
  };

  const loadGalleryImages = async () => {
    if (!userId) return;
    try {
      const { data, error } = await supabase
        .from('generated_images')
        .select('id, image_url, prompt')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(20);
      
      if (error) throw error;
      setGalleryImages(data || []);
    } catch (error) {
      console.error('Failed to load gallery images:', error);
    }
  };

  const selectedCharacter = characters.find(c => c.id === selectedCharacterId);

  // Load project from URL parameter if present
  useEffect(() => {
    const projectId = searchParams.get('projectId');
    if (projectId && userId) {
      loadProject(projectId);
    }
  }, [searchParams, userId]);

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
      // Build character description from selected AI Twin, character, or gallery image
      let characterDescription: string | undefined;
      
      if (selectedTwin) {
        // Use AI Twin's detailed description, face description, and gender
        const genderText = selectedTwin.gender ? `${selectedTwin.gender} ` : '';
        const pronouns = selectedTwin.gender === 'female' ? 'she/her' : selectedTwin.gender === 'male' ? 'he/him' : 'they/them';
        characterDescription = `${selectedTwin.name} (${genderText}character, pronouns: ${pronouns}): ${selectedTwin.face_description || selectedTwin.description || 'No description'}`;
      } else if (selectedCharacter) {
        characterDescription = `${selectedCharacter.name}: ${selectedCharacter.description || 'No description'}`;
      } else if (selectedGalleryImage) {
        characterDescription = selectedGalleryImage.prompt 
          ? `Character based on image: ${selectedGalleryImage.prompt}`
          : 'Use the reference image to maintain character consistency';
      }

      const { data, error } = await supabase.functions.invoke('generate-movie-outline', {
        body: { movieIdea, characterDescription }
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
      // Pass character description for consistency in scenes
      let characterDescription: string | undefined;
      let characterName: string | undefined;
      
      if (selectedTwin) {
        const genderText = selectedTwin.gender ? `${selectedTwin.gender} ` : '';
        const pronouns = selectedTwin.gender === 'female' ? 'she/her' : selectedTwin.gender === 'male' ? 'he/him' : 'they/them';
        characterDescription = `${selectedTwin.name} (${genderText}character, pronouns: ${pronouns}): ${selectedTwin.face_description || selectedTwin.description || 'No description'}`;
        characterName = selectedTwin.name;
      } else if (selectedCharacter) {
        characterDescription = `${selectedCharacter.name}: ${selectedCharacter.description || 'No description'}`;
        characterName = selectedCharacter.name;
      } else if (selectedGalleryImage?.prompt) {
        characterDescription = `Character based on: ${selectedGalleryImage.prompt}`;
      }

      const { data, error } = await supabase.functions.invoke('generate-movie-scenes', {
        body: { outline, characterDescription }
      });

      if (error) throw error;

      const generatedScenes = data.scenes as MovieScene[];
      setScenes(generatedScenes);
      
      toast({
        title: "Scenes Generated!",
        description: `Created ${generatedScenes.length} scenes. Generating dialogue...`,
      });

      // Auto-generate dialogue for each scene
      const scenesWithDialogue = await Promise.all(
        generatedScenes.map(async (scene) => {
          try {
            const sceneContext = {
              sceneDescription: scene.description,
              sceneTitle: scene.title,
              location: scene.location,
              timeOfDay: scene.timeOfDay,
              characterName,
              tone: scene.title.toLowerCase().includes('tension') || scene.title.toLowerCase().includes('conflict') 
                ? 'dramatic' 
                : scene.title.toLowerCase().includes('romance') || scene.title.toLowerCase().includes('love')
                  ? 'romantic'
                  : 'natural'
            };

            // Generate main character (AI Twin) dialogue
            const { data: mainDialogueData, error: mainDialogueError } = await supabase.functions.invoke('generate-scene-dialogue', {
              body: { ...sceneContext, isMainCharacter: true }
            });

            if (mainDialogueError) {
              console.error(`Failed to generate main dialogue for scene ${scene.sceneNumber}:`, mainDialogueError);
              return scene;
            }

            // Check if scene involves multiple characters (look for keywords)
            const hasOtherCharacters = /interact|conversation|talk|speak|meet|confront|argue|discuss|responds|replies|another|other person|companion|partner|friend|enemy|stranger/i.test(scene.description);
            
            let otherDialogue = null;
            if (hasOtherCharacters && characterName) {
              // Generate other character's dialogue
              const { data: otherDialogueData, error: otherDialogueError } = await supabase.functions.invoke('generate-scene-dialogue', {
                body: { ...sceneContext, isMainCharacter: false }
              });

              if (!otherDialogueError && otherDialogueData?.dialogue) {
                otherDialogue = otherDialogueData.dialogue;
              }
            }

            return { 
              ...scene, 
              dialogue: mainDialogueData.dialogue,
              otherCharacterDialogue: otherDialogue
            };
          } catch (err) {
            console.error(`Error generating dialogue for scene ${scene.sceneNumber}:`, err);
            return scene;
          }
        })
      );

      setScenes(scenesWithDialogue);
      toast({
        title: "Complete!",
        description: `Generated ${generatedScenes.length} scenes with dialogue.`,
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
    const scene = scenes.find(s => s.sceneNumber === sceneNumber);
    
    // Enhance prompt with camera angle and lighting if selected
    let enhancedPrompt = imagePrompt;
    
    if (scene?.selectedCameraAngle && scene.selectedCameraAngle !== 'eye-level') {
      const cameraAngle = CAMERA_ANGLES.find(a => a.id === scene.selectedCameraAngle);
      if (cameraAngle) {
        enhancedPrompt = `${enhancedPrompt}. Shot with ${cameraAngle.name.toLowerCase()}, ${cameraAngle.description.toLowerCase()}`;
      }
    }
    
    if (scene?.selectedLighting && scene.selectedLighting !== 'natural') {
      const lighting = LIGHTING_STYLES.find(l => l.id === scene.selectedLighting);
      if (lighting) {
        enhancedPrompt = `${enhancedPrompt}. Lit with ${lighting.name.toLowerCase()}, ${lighting.description.toLowerCase()}`;
      }
    }
    
    setGeneratingImageFor(sceneNumber);
    try {
      // Pass ALL reference images for character consistency
      let referenceImages: string[] = [];
      let characterDescription: string | undefined;
      
      if (selectedTwin) {
        // Use ALL reference images from AI Twin for better consistency
        referenceImages = selectedTwin.reference_images || [];
        // Build comprehensive character description including all physical details
        const genderText = selectedTwin.gender ? `${selectedTwin.gender}` : 'person';
        const faceDesc = selectedTwin.face_description || '';
        const generalDesc = selectedTwin.description || '';
        characterDescription = `${selectedTwin.name} is a ${genderText}. Physical appearance: ${faceDesc}. ${generalDesc}`.trim();
        
        // Prepend character description to the prompt for better likeness
        enhancedPrompt = `The main character is ${selectedTwin.name}, a ${genderText} with these features: ${faceDesc || generalDesc}. Scene: ${enhancedPrompt}`;
      } else if (selectedCharacter?.reference_images?.length) {
        referenceImages = selectedCharacter.reference_images;
        characterDescription = `${selectedCharacter.name}: ${selectedCharacter.description || ''}`;
        if (selectedCharacter.description) {
          enhancedPrompt = `The main character is ${selectedCharacter.name} with these features: ${selectedCharacter.description}. Scene: ${enhancedPrompt}`;
        }
      } else if (selectedGalleryImage) {
        referenceImages = [selectedGalleryImage.image_url];
        characterDescription = selectedGalleryImage.prompt || undefined;
      }

      const { data, error } = await supabase.functions.invoke('generate-scene-image', {
        body: { 
          prompt: enhancedPrompt,
          referenceImages,
          characterDescription
        }
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

  const updateSceneCameraAngle = (sceneNumber: number, angle: string) => {
    setScenes(prevScenes => 
      prevScenes.map(s => 
        s.sceneNumber === sceneNumber 
          ? { ...s, selectedCameraAngle: angle }
          : s
      )
    );
  };

  const updateSceneLighting = (sceneNumber: number, lighting: string) => {
    setScenes(prevScenes => 
      prevScenes.map(s => 
        s.sceneNumber === sceneNumber 
          ? { ...s, selectedLighting: lighting }
          : s
      )
    );
  };

  const loadVisualPresets = async () => {
    if (!userId) return;

    try {
      const { data, error } = await supabase
        .from('visual_presets')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      setVisualPresets(data || []);
    } catch (error: any) {
      console.error('Error loading visual presets:', error);
    }
  };

  const saveVisualPreset = async () => {
    if (!userId || !selectedSceneForPreset) {
      toast({
        title: "Error",
        description: "Unable to save preset. Please try again.",
        variant: "destructive"
      });
      return;
    }

    if (!newPresetName.trim()) {
      toast({
        title: "Name Required",
        description: "Please enter a name for your preset.",
        variant: "destructive"
      });
      return;
    }

    const scene = scenes.find(s => s.sceneNumber === selectedSceneForPreset);
    if (!scene) return;

    try {
      const { error } = await supabase
        .from('visual_presets')
        .insert([{
          user_id: userId,
          name: newPresetName,
          camera_angle: scene.selectedCameraAngle || 'eye-level',
          lighting_style: scene.selectedLighting || 'natural'
        }]);

      if (error) throw error;

      toast({
        title: "Preset Saved!",
        description: `"${newPresetName}" has been saved to your presets.`,
      });

      setNewPresetName('');
      setIsSavePresetDialogOpen(false);
      setSelectedSceneForPreset(null);
      loadVisualPresets();
    } catch (error: any) {
      console.error('Error saving preset:', error);
      toast({
        title: "Save Failed",
        description: error.message || "Failed to save preset. Please try again.",
        variant: "destructive"
      });
    }
  };

  const applyVisualPreset = (sceneNumber: number, presetId: string) => {
    const preset = visualPresets.find(p => p.id === presetId);
    if (!preset) return;

    setScenes(prevScenes =>
      prevScenes.map(s =>
        s.sceneNumber === sceneNumber
          ? {
              ...s,
              selectedCameraAngle: preset.camera_angle,
              selectedLighting: preset.lighting_style,
              // Clear generated content so user regenerates with new settings
              generatedImage: undefined,
              generatedVideo: undefined,
              videoTaskId: undefined,
            }
          : s
      )
    );

    toast({
      title: "Preset Applied",
      description: `Applied "${preset.name}" to Scene ${sceneNumber}. Regenerate the image to see changes.`,
    });
  };

  const deleteVisualPreset = async (presetId: string) => {
    try {
      const { error } = await supabase
        .from('visual_presets')
        .delete()
        .eq('id', presetId);

      if (error) throw error;

      toast({
        title: "Preset Deleted",
        description: "The preset has been removed.",
      });

      loadVisualPresets();
    } catch (error: any) {
      console.error('Error deleting preset:', error);
      toast({
        title: "Delete Failed",
        description: error.message || "Failed to delete preset.",
        variant: "destructive"
      });
    }
  };

  const duplicateScene = (sceneNumber: number) => {
    const sceneToDuplicate = scenes.find(s => s.sceneNumber === sceneNumber);
    if (!sceneToDuplicate) return;

    // Create a copy with a new scene number
    const maxSceneNumber = Math.max(...scenes.map(s => s.sceneNumber));
    const duplicatedScene: MovieScene = {
      ...sceneToDuplicate,
      sceneNumber: maxSceneNumber + 1,
      title: `${sceneToDuplicate.title} (Copy)`,
      // Clear generated content so user can generate fresh variations
      generatedImage: undefined,
      generatedVideo: undefined,
      videoTaskId: undefined,
    };

    // Add the duplicated scene after the original
    const originalIndex = scenes.findIndex(s => s.sceneNumber === sceneNumber);
    const newScenes = [...scenes];
    newScenes.splice(originalIndex + 1, 0, duplicatedScene);

    setScenes(newScenes);
    
    toast({
      title: "Scene Duplicated",
      description: `Created a copy of Scene ${sceneNumber}. You can now modify and generate variations.`,
    });
  };

  const deleteScene = (sceneNumber: number) => {
    setScenes(prevScenes => prevScenes.filter(s => s.sceneNumber !== sceneNumber));
    
    toast({
      title: "Scene Deleted",
      description: `Removed Scene ${sceneNumber} from your project.`,
    });
  };

  const updateSceneText = (sceneNumber: number, field: keyof MovieScene, value: string) => {
    setScenes(prevScenes =>
      prevScenes.map(s =>
        s.sceneNumber === sceneNumber
          ? { ...s, [field]: value }
          : s
      )
    );
  };

  const generateDialogue = async (sceneNumber: number) => {
    const scene = scenes.find(s => s.sceneNumber === sceneNumber);
    if (!scene) return;

    const characterName = selectedTwin?.name || selectedCharacter?.name;

    try {
      toast({
        title: "Generating Dialogue",
        description: `Creating dialogue for ${characterName || 'main character'}...`
      });

      const sceneContext = {
        sceneDescription: scene.description,
        sceneTitle: scene.title,
        location: scene.location,
        timeOfDay: scene.timeOfDay,
        characterName,
        tone: 'natural'
      };

      // Generate main character dialogue
      const { data, error } = await supabase.functions.invoke('generate-scene-dialogue', {
        body: { ...sceneContext, isMainCharacter: true }
      });

      if (error) throw error;

      if (data?.dialogue) {
        updateSceneText(sceneNumber, 'dialogue', data.dialogue);
        
        // Check if scene might have other characters
        const hasOtherCharacters = /interact|conversation|talk|speak|meet|confront|argue|discuss|responds|replies|another|other person|companion|partner|friend|enemy|stranger/i.test(scene.description);
        
        if (hasOtherCharacters && characterName) {
          // Also generate other character's dialogue
          const { data: otherData } = await supabase.functions.invoke('generate-scene-dialogue', {
            body: { ...sceneContext, isMainCharacter: false }
          });
          
          if (otherData?.dialogue) {
            updateSceneText(sceneNumber, 'otherCharacterDialogue', otherData.dialogue);
          }
        }

        toast({
          title: "Dialogue Generated!",
          description: hasOtherCharacters ? "Generated dialogue for both characters." : "AI-generated dialogue has been added."
        });
      }
    } catch (error) {
      console.error('Error generating dialogue:', error);
      toast({
        title: "Generation Failed",
        description: "Failed to generate dialogue. Please try again.",
        variant: "destructive"
      });
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
      
      // Determine if we're using cloned voice from AI Twin
      const useClonedVoice = selectedTwin?.voice_sample_url;
      
      toast({
        title: useClonedVoice ? "Generating Cloned Voice Audio" : "Generating Audio",
        description: useClonedVoice 
          ? `Creating voiceover using ${selectedTwin.name}'s cloned voice...`
          : "Creating voiceover for the scene...",
      });

      const { data: ttsData, error: ttsError } = await supabase.functions.invoke('text-to-speech', {
        body: { 
          text: textForAudio, 
          voice: 'en-US-Journey-D',
          clonedVoiceUrl: useClonedVoice || undefined
        }
      });

      if (ttsError) throw ttsError;

      toast({
        title: "Generating Video",
        description: useClonedVoice 
          ? `Creating lip-synced video with ${selectedTwin.name}'s voice...`
          : "Creating lip-synced video using default voice...",
      });

      // Generate video with lip sync using InfiniteTalk model
      const { data: videoData, error: videoError } = await supabase.functions.invoke('wavespeed-video', {
        body: {
          action: 'create',
          model: 'infinitetalk',
          imageUrls: [scene.generatedImage],
          audioUrl: `data:audio/mp3;base64,${ttsData.audioContent}`,
          duration: 5
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
      setStitchedVideoUrl((data as any).stitched_video_url || null);

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
        setStitchedVideoUrl(null);
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
    setStitchedVideoUrl(null);
    toast({
      title: "New Project",
      description: "Started a new movie project.",
    });
  };

  const stitchAllVideos = async () => {
    // Check if all scenes have generated videos
    const videosToStitch = scenes
      .filter(scene => scene.generatedVideo)
      .map(scene => scene.generatedVideo as string);

    if (videosToStitch.length === 0) {
      toast({
        title: "No Videos to Stitch",
        description: "Please generate videos for at least one scene first.",
        variant: "destructive"
      });
      return;
    }

    if (videosToStitch.length < scenes.length) {
      toast({
        title: "Warning",
        description: `Only ${videosToStitch.length} of ${scenes.length} scenes have videos. Missing scenes will be skipped.`,
      });
    }

    setIsStitching(true);
    setStitchProgress(0);

    try {
      toast({
        title: "Stitching Videos",
        description: "Combining all scene videos into a complete movie. This may take a few minutes...",
      });

      // Stitch videos using FFmpeg
      const stitchedBlob = await stitchVideos(videosToStitch, (progress) => {
        setStitchProgress(progress);
      });

      // Create a URL for the stitched video
      const url = URL.createObjectURL(stitchedBlob);
      setStitchedVideoUrl(url);

      // Update the current project with stitched video URL if it's saved
      if (currentProjectId) {
        const projectData = {
          stitched_video_url: url,
          updated_at: new Date().toISOString()
        };

        const { error } = await supabase
          .from('movie_projects')
          .update(projectData)
          .eq('id', currentProjectId);

        if (error) {
          console.error('Error updating stitched video URL:', error);
        }
      }

      toast({
        title: "Video Stitched!",
        description: `Successfully combined ${videosToStitch.length} scene videos into a complete movie.`,
      });
    } catch (error: any) {
      console.error('Error stitching videos:', error);
      toast({
        title: "Stitching Failed",
        description: error.message || "Failed to stitch videos. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsStitching(false);
      setStitchProgress(0);
    }
  };

  return (
    <Layout>
      <div className="space-y-6">
        {/* Enhanced Header with Description */}
        <div className="space-y-4">
          <div className="flex items-start justify-between">
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <Film className="w-8 h-8 text-primary" />
                </div>
                <div>
                  <h1 className="text-3xl font-bold text-foreground">Movie Scene Creator Studio</h1>
                  {currentProjectId && projectTitle && (
                    <p className="text-sm text-primary">Currently editing: {projectTitle}</p>
                  )}
                </div>
              </div>
              <p className="text-lg text-muted-foreground max-w-3xl">
                Turn your movie ideas into visual reality! Create complete films with AI-powered scene generation.
              </p>
            </div>

            {/* Transfer to Reels Button */}
            <Button
              onClick={transferToReels}
              disabled={isTransferring || !movieIdea.trim()}
              variant="outline"
              className="gap-2"
            >
              {isTransferring ? (
                <>
                  <Sparkles className="w-4 h-4 animate-spin" />
                  Transferring...
                </>
              ) : (
                <>
                  Transfer to Reels
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </Button>
          </div>

          {/* Feature Highlights */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 rounded-lg px-3 py-2">
              <Lightbulb className="w-4 h-4 text-primary" />
              <span>Describe any concept</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 rounded-lg px-3 py-2">
              <Sparkles className="w-4 h-4 text-primary" />
              <span>AI-generated outlines</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 rounded-lg px-3 py-2">
              <Camera className="w-4 h-4 text-primary" />
              <span>Custom camera angles</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 rounded-lg px-3 py-2">
              <Image className="w-4 h-4 text-primary" />
              <span>Generate scene images</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 rounded-lg px-3 py-2">
              <Play className="w-4 h-4 text-primary" />
              <span>Lip-synced videos</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 rounded-lg px-3 py-2">
              <Video className="w-4 h-4 text-primary" />
              <span>Stitch into movie</span>
            </div>
          </div>
        </div>

        {/* AI Twin Panel */}
        {selectedTwin && (
          <Card className="border-primary bg-gradient-to-r from-primary/5 to-primary/10">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <User className="w-5 h-5 text-primary" />
                  Starring: {selectedTwin.name}
                </CardTitle>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => setSelectedTwin(null)}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
              <CardDescription>
                This AI Twin will be featured in your movie with their cloned voice and reference images.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="flex items-start gap-4">
                {/* Reference Images */}
                <div className="flex -space-x-3">
                  {selectedTwin.reference_images?.slice(0, 4).map((img, idx) => (
                    <img 
                      key={idx}
                      src={img}
                      alt={`Reference ${idx + 1}`}
                      className="w-12 h-12 rounded-full border-2 border-background object-cover"
                    />
                  ))}
                  {(selectedTwin.reference_images?.length || 0) > 4 && (
                    <div className="w-12 h-12 rounded-full bg-muted border-2 border-background flex items-center justify-center text-xs font-medium">
                      +{selectedTwin.reference_images!.length - 4}
                    </div>
                  )}
                </div>

                {/* Twin Info */}
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant={selectedTwin.voice_cloning_key ? "default" : "secondary"}>
                      <Volume2 className="w-3 h-3 mr-1" />
                      {selectedTwin.voice_cloning_key ? "Cloned Voice Ready" : "No Voice"}
                    </Badge>
                    <Badge variant="outline">
                      <ImageIcon className="w-3 h-3 mr-1" />
                      {selectedTwin.reference_images?.length || 0} Reference Images
                    </Badge>
                    {selectedTwin.face_description && (
                      <Badge variant="outline" className="text-xs">
                        {selectedTwin.face_description.toLowerCase().includes('male') && !selectedTwin.face_description.toLowerCase().includes('female') ? 'Male' : 
                         selectedTwin.face_description.toLowerCase().includes('female') ? 'Female' : 'Person'}
                      </Badge>
                    )}
                  </div>
                  {selectedTwin.description && (
                    <p className="text-sm text-muted-foreground">{selectedTwin.description}</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Pete AI Assistant */}
        <PeteAIAssistant 
          onMovieIdeaCaptured={handleMovieIdeaCaptured}
          currentIdea={movieIdea}
          inputValue={peteInputValue}
          onInputChange={setPeteInputValue}
        />

        {/* Quick Start Samples */}
        <div className="space-y-3">
          <p className="text-sm font-medium text-muted-foreground">Quick Start Ideas</p>
          <div className="flex flex-wrap gap-2">
            {SAMPLE_MOVIES.map((movie) => (
              <Button
                key={movie.value}
                variant="outline"
                size="sm"
                onClick={() => handleSampleSelect(movie.value)}
                className="text-xs"
              >
                {movie.label}
              </Button>
            ))}
          </div>
        </div>

        {/* Main Character Selection */}
        {userId && (
          <Card className="bg-card border-border">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3">
                <User className="w-5 h-5 text-primary" />
                <div>
                  <CardTitle className="text-base">Main Character</CardTitle>
                  <CardDescription className="text-xs">Select who will star in your movie</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Source Tabs */}
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant={characterSourceTab === 'twins' ? 'default' : 'outline'}
                  onClick={() => setCharacterSourceTab('twins')}
                  className="flex-1"
                >
                  AI Twins ({aiTwins.length})
                </Button>
                <Button
                  size="sm"
                  variant={characterSourceTab === 'characters' ? 'default' : 'outline'}
                  onClick={() => setCharacterSourceTab('characters')}
                  className="flex-1"
                >
                  Characters ({characters.length})
                </Button>
                <Button
                  size="sm"
                  variant={characterSourceTab === 'gallery' ? 'default' : 'outline'}
                  onClick={() => setCharacterSourceTab('gallery')}
                  className="flex-1"
                >
                  Gallery ({galleryImages.length})
                </Button>
              </div>

              {/* AI Twins Tab */}
              {characterSourceTab === 'twins' && (
                <div className="space-y-3">
                  {aiTwins.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No AI Twins yet. Create one in the AI Twin section.
                    </p>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-48 overflow-y-auto">
                      {aiTwins.map(twin => (
                        <div
                          key={twin.id}
                          onClick={() => {
                            setSelectedTwin(twin);
                            setSelectedCharacterId(null);
                            setSelectedGalleryImage(null);
                          }}
                          className={`cursor-pointer p-2 rounded-lg border transition-all ${
                            selectedTwin?.id === twin.id 
                              ? 'border-primary bg-primary/10 ring-2 ring-primary' 
                              : 'border-border hover:border-primary/50'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            {twin.reference_images?.[0] ? (
                              <img 
                                src={twin.reference_images[0]} 
                                alt={twin.name}
                                className="w-10 h-10 rounded-full object-cover"
                              />
                            ) : (
                              <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                                <User className="w-5 h-5 text-muted-foreground" />
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{twin.name}</p>
                              <div className="flex items-center gap-1">
                                {twin.gender && (
                                  <Badge variant="outline" className="text-[10px] capitalize px-1 py-0">{twin.gender}</Badge>
                                )}
                                {twin.voice_sample_url && (
                                  <Volume2 className="w-3 h-3 text-primary" />
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Characters Tab */}
              {characterSourceTab === 'characters' && (
                <div className="space-y-3">
                  {characters.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No characters yet. Create one in the Characters section.
                    </p>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-48 overflow-y-auto">
                      {characters.map(char => (
                        <div
                          key={char.id}
                          onClick={() => {
                            setSelectedCharacterId(char.id);
                            setSelectedTwin(null);
                            setSelectedGalleryImage(null);
                          }}
                          className={`cursor-pointer p-2 rounded-lg border transition-all ${
                            selectedCharacterId === char.id 
                              ? 'border-primary bg-primary/10 ring-2 ring-primary' 
                              : 'border-border hover:border-primary/50'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            {char.reference_images?.[0] ? (
                              <img 
                                src={char.reference_images[0]} 
                                alt={char.name}
                                className="w-10 h-10 rounded-full object-cover"
                              />
                            ) : (
                              <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                                <User className="w-5 h-5 text-muted-foreground" />
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{char.name}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Gallery Tab */}
              {characterSourceTab === 'gallery' && (
                <div className="space-y-3">
                  {galleryImages.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No gallery images yet. Generate some in the Reels or Movies section.
                    </p>
                  ) : (
                    <div className="grid grid-cols-4 sm:grid-cols-5 gap-2 max-h-48 overflow-y-auto">
                      {galleryImages.map(img => (
                        <div
                          key={img.id}
                          onClick={() => {
                            setSelectedGalleryImage(img);
                            setSelectedTwin(null);
                            setSelectedCharacterId(null);
                          }}
                          className={`cursor-pointer rounded-lg border overflow-hidden transition-all ${
                            selectedGalleryImage?.id === img.id 
                              ? 'border-primary ring-2 ring-primary' 
                              : 'border-border hover:border-primary/50'
                          }`}
                        >
                          <img 
                            src={img.image_url} 
                            alt="Gallery"
                            className="w-full aspect-square object-cover"
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Clear Selection */}
              {(selectedTwin || selectedCharacter || selectedGalleryImage) && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setSelectedTwin(null);
                    setSelectedCharacterId(null);
                    setSelectedGalleryImage(null);
                  }}
                  className="w-full text-muted-foreground"
                >
                  <X className="w-4 h-4 mr-2" />
                  Clear Selection (AI will create character)
                </Button>
              )}

              {/* Selected Preview */}
              {selectedGalleryImage && (
                <div className="p-3 bg-primary/5 rounded-lg border border-primary/20 flex items-start gap-3">
                  <img 
                    src={selectedGalleryImage.image_url} 
                    alt="Selected"
                    className="w-16 h-16 rounded-lg object-cover border border-border"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-foreground">Gallery Image</p>
                    {selectedGalleryImage.prompt && (
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{selectedGalleryImage.prompt}</p>
                    )}
                    <p className="text-[10px] text-primary mt-1">This image will be used as character reference</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Project Actions */}
        <div className="flex items-center justify-between">
          <div></div>
          
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

        <Dialog open={isSavePresetDialogOpen} onOpenChange={setIsSavePresetDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Save Visual Preset</DialogTitle>
              <DialogDescription>
                Save the current camera angle and lighting combination as a reusable preset
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="preset-name">Preset Name</Label>
                <Input
                  id="preset-name"
                  placeholder="e.g., Dramatic Low Angle, Golden Hour Portrait..."
                  value={newPresetName}
                  onChange={(e) => setNewPresetName(e.target.value)}
                />
              </div>
              {selectedSceneForPreset && (
                <div className="text-sm text-muted-foreground">
                  <p className="font-semibold mb-1">Current Settings:</p>
                  <p>Camera: {CAMERA_ANGLES.find(a => a.id === (scenes.find(s => s.sceneNumber === selectedSceneForPreset)?.selectedCameraAngle || 'eye-level'))?.name}</p>
                  <p>Lighting: {LIGHTING_STYLES.find(l => l.id === (scenes.find(s => s.sceneNumber === selectedSceneForPreset)?.selectedLighting || 'natural'))?.name}</p>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsSavePresetDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={saveVisualPreset}>
                <Star className="w-4 h-4 mr-2" />
                Save Preset
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Current Movie Idea Display */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Film className="w-5 h-5 text-primary" />
                Current Movie Idea
              </CardTitle>
              <CardDescription>
                Your movie concept captured from Pete AI
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="min-h-[200px] p-4 bg-muted/50 rounded-lg border border-border">
                {movieIdea ? (
                  <p className="text-foreground whitespace-pre-wrap">{movieIdea}</p>
                ) : (
                  <p className="text-muted-foreground italic">
                    Type your movie idea in Pete AI above or click a Quick Start sample to get started...
                  </p>
                )}
              </div>
              <Button
                onClick={generateOutline}
                disabled={isGenerating || !movieIdea.trim()}
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
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold text-foreground">Generated Scenes</h2>
              {scenes.some(s => s.generatedVideo) && (
                <Button
                  onClick={stitchAllVideos}
                  disabled={isStitching}
                  size="lg"
                  className="gap-2"
                >
                  {isStitching ? (
                    <>
                      <Sparkles className="w-5 h-5 animate-spin" />
                      Stitching {stitchProgress}%...
                    </>
                  ) : (
                    <>
                      <Video className="w-5 h-5" />
                      Stitch All Videos into Movie
                    </>
                  )}
                </Button>
              )}
            </div>

            {isStitching && (
              <Card className="bg-gradient-accent border-primary/20">
                <CardContent className="pt-6">
                  <div className="space-y-4">
                    <div className="flex items-center gap-4">
                      <Sparkles className="w-6 h-6 text-primary animate-spin" />
                      <div className="flex-1">
                        <h3 className="font-semibold text-foreground">Stitching Videos</h3>
                        <p className="text-sm text-muted-foreground">
                          Combining all scene videos into a complete movie...
                        </p>
                      </div>
                    </div>
                    <Progress value={stitchProgress} className="h-2" />
                    <p className="text-sm text-center text-muted-foreground">{stitchProgress}% complete</p>
                  </div>
                </CardContent>
              </Card>
            )}

            {stitchedVideoUrl && (
              <Card className="bg-gradient-accent border-primary/20">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Video className="w-5 h-5 text-primary" />
                    Complete Movie
                  </CardTitle>
                  <CardDescription>
                    All {scenes.filter(s => s.generatedVideo).length} scene videos stitched together
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <video 
                    src={stitchedVideoUrl} 
                    controls
                    className="w-full rounded-lg border border-border"
                  />
                  <div className="mt-4 flex gap-2">
                    <Button
                      onClick={() => {
                        const a = document.createElement('a');
                        a.href = stitchedVideoUrl;
                        a.download = `${projectTitle || 'movie'}.mp4`;
                        a.click();
                      }}
                      variant="outline"
                      className="flex-1"
                    >
                      Download Movie
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            <div className="grid gap-4">
              {scenes.map((scene) => (
                <Card key={scene.sceneNumber}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <CardTitle className="flex items-center gap-2">
                          <Film className="w-5 h-5 text-primary" />
                          Scene {scene.sceneNumber}: {scene.title}
                        </CardTitle>
                        <CardDescription>
                          {scene.location} • {scene.timeOfDay}
                        </CardDescription>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          onClick={() => duplicateScene(scene.sceneNumber)}
                          variant="ghost"
                          size="sm"
                          title="Duplicate scene"
                        >
                          <Copy className="w-4 h-4" />
                        </Button>
                        <Button
                          onClick={() => deleteScene(scene.sceneNumber)}
                          variant="ghost"
                          size="sm"
                          title="Delete scene"
                        >
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label className="text-sm font-semibold">Title</Label>
                      <Input
                        value={scene.title}
                        onChange={(e) => updateSceneText(scene.sceneNumber, 'title', e.target.value)}
                        className="mt-1"
                      />
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label className="text-sm font-semibold">Location</Label>
                        <Input
                          value={scene.location}
                          onChange={(e) => updateSceneText(scene.sceneNumber, 'location', e.target.value)}
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <Label className="text-sm font-semibold">Time of Day</Label>
                        <Input
                          value={scene.timeOfDay}
                          onChange={(e) => updateSceneText(scene.sceneNumber, 'timeOfDay', e.target.value)}
                          className="mt-1"
                        />
                      </div>
                    </div>
                    
                    <div>
                      <Label className="text-sm font-semibold">Description</Label>
                      <Textarea
                        value={scene.description}
                        onChange={(e) => updateSceneText(scene.sceneNumber, 'description', e.target.value)}
                        rows={3}
                        className="mt-1 resize-none"
                      />
                    </div>
                    
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <Label className="text-sm font-semibold flex items-center gap-2">
                          <User className="w-4 h-4 text-primary" />
                          {selectedTwin?.name || 'Main Character'} Dialogue
                          <span className="text-xs text-muted-foreground font-normal">(AI Twin speaks this)</span>
                        </Label>
                        <Button
                          onClick={() => generateDialogue(scene.sceneNumber)}
                          variant="outline"
                          size="sm"
                          className="h-7"
                        >
                          <Wand2 className="w-3 h-3 mr-1" />
                          Generate
                        </Button>
                      </div>
                      <Textarea
                        value={scene.dialogue || ''}
                        onChange={(e) => updateSceneText(scene.sceneNumber, 'dialogue', e.target.value)}
                        rows={3}
                        className="mt-1 resize-none italic border-primary/30"
                        placeholder={`Enter what ${selectedTwin?.name || 'the main character'} will say...`}
                      />
                    </div>

                    {scene.otherCharacterDialogue && (
                      <div>
                        <Label className="text-sm font-semibold flex items-center gap-2 mb-1">
                          <User className="w-4 h-4 text-muted-foreground" />
                          Other Character Dialogue
                          <span className="text-xs text-muted-foreground font-normal">(Supporting character)</span>
                        </Label>
                        <Textarea
                          value={scene.otherCharacterDialogue || ''}
                          onChange={(e) => updateSceneText(scene.sceneNumber, 'otherCharacterDialogue', e.target.value)}
                          rows={2}
                          className="mt-1 resize-none italic opacity-80"
                          placeholder="Other character's lines..."
                        />
                      </div>
                    )}
                    
                    <div>
                      <Label className="text-sm font-semibold">Image Generation Prompt</Label>
                      <Textarea
                        value={scene.imagePrompt}
                        onChange={(e) => updateSceneText(scene.sceneNumber, 'imagePrompt', e.target.value)}
                        rows={3}
                        className="mt-1 resize-none"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor={`camera-${scene.sceneNumber}`} className="text-sm font-semibold">
                        Camera Angle
                      </Label>
                      <Select
                        value={scene.selectedCameraAngle || 'eye-level'}
                        onValueChange={(angle) => updateSceneCameraAngle(scene.sceneNumber, angle)}
                      >
                        <SelectTrigger 
                          id={`camera-${scene.sceneNumber}`}
                          className="bg-background border-border"
                        >
                          <SelectValue placeholder="Select camera angle" />
                        </SelectTrigger>
                        <SelectContent className="bg-background border-border z-50">
                          {CAMERA_ANGLES.map((angle) => (
                            <SelectItem 
                              key={angle.id} 
                              value={angle.id}
                              className="bg-background hover:bg-accent focus:bg-accent"
                            >
                              <div className="flex flex-col">
                                <span className="font-medium">{angle.name}</span>
                                <span className="text-xs text-muted-foreground">{angle.description}</span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor={`lighting-${scene.sceneNumber}`} className="text-sm font-semibold">
                        Lighting Style
                      </Label>
                      <Select
                        value={scene.selectedLighting || 'natural'}
                        onValueChange={(lighting) => updateSceneLighting(scene.sceneNumber, lighting)}
                      >
                        <SelectTrigger 
                          id={`lighting-${scene.sceneNumber}`}
                          className="bg-background border-border"
                        >
                          <SelectValue placeholder="Select lighting style" />
                        </SelectTrigger>
                        <SelectContent className="bg-background border-border z-50">
                          {LIGHTING_STYLES.map((lighting) => (
                            <SelectItem 
                              key={lighting.id} 
                              value={lighting.id}
                              className="bg-background hover:bg-accent focus:bg-accent"
                            >
                              <div className="flex flex-col">
                                <span className="font-medium">{lighting.name}</span>
                                <span className="text-xs text-muted-foreground">{lighting.description}</span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-sm font-semibold">Visual Presets</Label>
                      <div className="flex gap-2">
                        <Select
                          onValueChange={(presetId) => applyVisualPreset(scene.sceneNumber, presetId)}
                        >
                          <SelectTrigger className="bg-background border-border flex-1">
                            <SelectValue placeholder="Apply saved preset..." />
                          </SelectTrigger>
                          <SelectContent className="bg-background border-border z-50">
                            {visualPresets.length === 0 ? (
                              <div className="p-2 text-sm text-muted-foreground">No saved presets</div>
                            ) : (
                              visualPresets.map((preset) => (
                                <SelectItem 
                                  key={preset.id} 
                                  value={preset.id}
                                  className="bg-background hover:bg-accent focus:bg-accent"
                                >
                                  <div className="flex items-center justify-between w-full">
                                    <span>{preset.name}</span>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-6 w-6 p-0 ml-2"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        deleteVisualPreset(preset.id);
                                      }}
                                    >
                                      <Trash2 className="w-3 h-3 text-destructive" />
                                    </Button>
                                  </div>
                                </SelectItem>
                              ))
                            )}
                          </SelectContent>
                        </Select>
                        <Button
                          onClick={() => {
                            setSelectedSceneForPreset(scene.sceneNumber);
                            setIsSavePresetDialogOpen(true);
                          }}
                          variant="outline"
                          size="sm"
                          title="Save current settings as preset"
                        >
                          <Star className="w-4 h-4" />
                        </Button>
                      </div>
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
                          <div className="space-y-3">
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
                          </div>
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
