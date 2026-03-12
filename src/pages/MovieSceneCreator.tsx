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
import { Sparkles, Film, ChevronRight, ChevronLeft, Save, FolderOpen, Trash2, Video, Copy, Star, Wand2, ArrowRight, Camera, Lightbulb, Image, Play, User, Volume2, ImageIcon, X, Music, Link, FileImage, Loader2, MapPin, Check, BookOpen, FileText, Clapperboard } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { convertBase64ToStorageUrl } from '@/lib/imageUtils';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { stitchVideosWithAudio } from '@/lib/videoStitch';
import { PeteAIAssistant } from '@/components/PeteAIAssistant';
import { KeyframeSceneCard, MovieSceneWithKeyframes, KeyframeData, CAMERA_MOVEMENTS } from '@/components/KeyframeSceneCard';
import { SceneTimeline } from '@/components/SceneTimeline';
import { StoryboardExport } from '@/components/StoryboardExport';
import { CommercialTemplateSelector } from '@/components/CommercialTemplateSelector';
import { LocationManager, Location } from '@/components/LocationManager';
import { CoverageSelector, SceneCoverage, CoverageShot } from '@/components/CoverageSelector';
import { CharacterBlockingEditor, CharacterBlocking } from '@/components/CharacterBlockingEditor';

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

// Helper to clean dialogue text - remove stage directions and character prefixes before TTS
const cleanDialogueForTTS = (text: string): string => {
  if (!text) return '';
  
  // Remove stage directions in parentheses: (sighs), (pauses), (whispers), etc.
  let cleaned = text.replace(/\([^)]*\)/g, '');
  
  // Remove stage directions in brackets: [emotion], [action], etc.
  cleaned = cleaned.replace(/\[[^\]]*\]/g, '');
  
  // Remove asterisk stage directions: *sighs*, *pauses*, etc.
  cleaned = cleaned.replace(/\*[^*]*\*/g, '');
  
  // Remove character name prefixes: "Character Name: " at start of lines
  cleaned = cleaned.split('\n').map(line => {
    return line.replace(/^[A-Z][a-zA-Z\s]*:\s*/i, '');
  }).join(' ');
  
  // Clean up multiple spaces and trim
  cleaned = cleaned.replace(/\s+/g, ' ').trim();
  
  return cleaned;
};

// Helper to detect if a voice ID is a Speechify UUID format
const isSpeechifyVoiceId = (voiceKey: string | null): boolean => {
  if (!voiceKey) return false;
  // Speechify voice IDs are UUIDs like: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(voiceKey);
};

// Movie length options
const MOVIE_LENGTH_OPTIONS = [
  { value: 'quick-reel', label: 'Quick Reel', description: '4-6 scenes, ~1 min', sceneCount: '4-6', duration: '~1 minute' },
  { value: 'short-story', label: 'Short Story', description: '10-15 scenes, ~3-5 min', sceneCount: '10-15', duration: '~3-5 minutes' },
  { value: 'short-film', label: 'Short Film', description: '20-30 scenes, ~10-15 min', sceneCount: '20-30', duration: '~10-15 minutes' },
  { value: 'full-movie', label: 'Full Movie', description: '40-60 scenes, ~30+ min', sceneCount: '40-60', duration: '~30+ minutes' },
];

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

// Story Bible types
interface StoryBibleCharacter {
  name: string;
  role: 'protagonist' | 'deuteragonist' | 'antagonist' | 'supporting';
  age: string;
  appearance: string;
  wardrobe: string;
  voiceStyle: string;
  personality: string;
  arc: string;
  // Voice assignment - links to AI Twin
  assignedTwinId?: string;
  assignedTwinName?: string;
  assignedVoiceCloningKey?: string;
}

interface DialogueEntry {
  character: string;
  line: string;
  emotion?: string;
}

interface StoryBible {
  logline: string;
  theme: string;
  emotionalArc: string[];
  threeActStructure: {
    setup: string;
    confrontation: string;
    resolution: string;
  };
  characters: StoryBibleCharacter[];
  wardrobeNotes: string;
  sceneDialogueMap: {
    sceneNumber: number;
    title: string;
    charactersPresent: string[];
    dialogueFlow: { character: string; action: string }[];
    conflict: string;
  }[];
}

// Movie Scene interface with conversation dialogue
interface MovieScene {
  sceneNumber: number;
  title: string;
  location: string;
  timeOfDay: string;
  description: string;
  dialogue: DialogueEntry[] | string | null; // Now supports conversation array
  narration?: string;
  charactersInScene?: string[];
  otherCharacterDialogue?: string | null;
  imagePrompt: string;
  generatedImage?: string;
  generatedVideo?: string;
  videoTaskId?: string;
  selectedCameraAngle?: string;
  selectedLighting?: string;
  mood?: string;
  suggestedMusic?: string;
  connectsTo?: number;
  // Keyframe fields
  startFrame?: KeyframeData;
  endFrame?: KeyframeData;
  transitionAction?: string;
  transitionCameraMovement?: string;
}

const MOOD_ICONS: Record<string, string> = {
  tense: '😰',
  romantic: '💕',
  action: '💥',
  melancholic: '😢',
  triumphant: '🏆',
  mysterious: '🔮',
  peaceful: '🕊️',
  horror: '👻',
  comedic: '😄',
  epic: '⚔️',
  nostalgic: '📷',
  inspiring: '✨',
};

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
  const [isRegeneratingDialogue, setIsRegeneratingDialogue] = useState(false);
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
  // Story Bible state
  const [storyBible, setStoryBible] = useState<StoryBible | null>(null);
  const [isGeneratingStoryBible, setIsGeneratingStoryBible] = useState(false);
  const [showStoryBibleEditor, setShowStoryBibleEditor] = useState(false);
  // Keyframe system state
  const [autoLinkScenes, setAutoLinkScenes] = useState(true);
  const [activeSceneIndex, setActiveSceneIndex] = useState(0);
  const [generatingFrameFor, setGeneratingFrameFor] = useState<{ sceneNumber: number; frame: 'start' | 'end' } | null>(null);
  const [galleryImages, setGalleryImages] = useState<{ id: string; image_url: string; prompt: string | null }[]>([]);
  const [selectedCharacterId, setSelectedCharacterId] = useState<string | null>(null);
  const [selectedTwins, setSelectedTwins] = useState<AITwin[]>([]); // Multi-twin selection
  const [selectedGalleryImage, setSelectedGalleryImage] = useState<{ id: string; image_url: string; prompt: string | null } | null>(null);
  const [characterSourceTab, setCharacterSourceTab] = useState<'twins' | 'characters' | 'gallery'>('twins');
  const [movieLength, setMovieLength] = useState<string>('quick-reel');
  const [previewingVoiceFor, setPreviewingVoiceFor] = useState<string | null>(null);
  const [describingSceneFor, setDescribingSceneFor] = useState<{ sceneNumber: number; frame: 'start' | 'end' } | null>(null);
  
  // Location & Coverage System state
  const [locations, setLocations] = useState<Location[]>([]);
  const [isExtractingLocations, setIsExtractingLocations] = useState(false);
  const [sceneCoverages, setSceneCoverages] = useState<Map<number, SceneCoverage>>(new Map());
  const [sceneBlockings, setSceneBlockings] = useState<Map<number, CharacterBlocking[]>>(new Map());
  const [isGeneratingCoverage, setIsGeneratingCoverage] = useState(false);
  
  // One-click generation state
  const [isGeneratingAll, setIsGeneratingAll] = useState(false);
  const [generateAllStep, setGenerateAllStep] = useState('');
  const [generateAllProgress, setGenerateAllProgress] = useState(0);
  
  // Wizard step state
  const [currentStep, setCurrentStep] = useState(0);
  
  const { toast } = useToast();

  // Helper to toggle twin selection
  const toggleTwinSelection = (twin: AITwin) => {
    setSelectedTwins(prev => {
      const isSelected = prev.some(t => t.id === twin.id);
      if (isSelected) {
        return prev.filter(t => t.id !== twin.id);
      } else {
        return [...prev, twin];
      }
    });
    setSelectedCharacterId(null);
    setSelectedGalleryImage(null);
  };

  // Preview AI Twin's cloned voice
  const previewTwinVoice = async (twin: AITwin) => {
    if (!twin.voice_cloning_key) {
      toast({
        title: "No Voice Configured",
        description: `${twin.name} doesn't have a cloned voice set up yet.`,
        variant: "destructive"
      });
      return;
    }

    setPreviewingVoiceFor(twin.id);
    try {
      const previewText = `Hello, I'm ${twin.name}. This is a preview of my cloned voice for your movie.`;
      
      const isSpeechify = isSpeechifyVoiceId(twin.voice_cloning_key);
      console.log('Voice preview - Using Speechify:', isSpeechify, 'Voice ID:', twin.voice_cloning_key);
      
      const { data, error } = await supabase.functions.invoke('text-to-speech', {
        body: {
          text: previewText,
          voice: 'en-US-Journey-D',
          speechifyVoiceId: isSpeechify ? twin.voice_cloning_key : undefined,
          voiceCloningKey: !isSpeechify ? twin.voice_cloning_key : undefined
        }
      });

      if (error) throw error;

      if (data?.audioContent) {
        const audio = new Audio(`data:audio/mp3;base64,${data.audioContent}`);
        audio.play();
        
        toast({
          title: "Playing Voice Preview",
          description: `${twin.name}'s cloned voice (${data.provider || 'TTS'})`,
        });
      } else {
        throw new Error('No audio content returned');
      }
    } catch (error: any) {
      console.error('Voice preview error:', error);
      toast({
        title: "Voice Preview Failed",
        description: error.message || "Failed to preview voice. Please try again.",
        variant: "destructive"
      });
    } finally {
      setPreviewingVoiceFor(null);
    }
  };

  // Check for AI Twin from navigation state
  useEffect(() => {
    const state = location.state as { selectedTwin?: AITwin; referenceImages?: string[] } | null;
    if (state?.selectedTwin) {
      setSelectedTwins([state.selectedTwin]);
      toast({
        title: "AI Twin Selected",
        description: `${state.selectedTwin.name} is ready to star in your movie!`,
      });
      // Clear the state to prevent showing twin panel on refresh
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  // Auto-save function - saves project silently without showing dialogs
  const autoSaveProject = async (updatedScenes?: MovieScene[]) => {
    if (!userId) return;
    if (!movieIdea.trim() && !outline && scenes.length === 0) return;
    
    try {
      const scenesToSave = updatedScenes || scenes;
      const title = projectTitle || `Movie: ${movieIdea.slice(0, 50)}...`;
      
      const projectData = {
        user_id: userId,
        title,
        movie_idea: movieIdea,
        outline: outline,
        scenes: scenesToSave as any,
        story_bible: storyBible as any,
        updated_at: new Date().toISOString()
      };

      if (currentProjectId) {
        // Update existing project
        const { error } = await supabase
          .from('movie_projects')
          .update(projectData)
          .eq('id', currentProjectId);

        if (error) throw error;
        console.log('Project auto-saved (updated)');
      } else if (scenesToSave.length > 0 || outline) {
        // Create new project only if we have content
        const { data, error } = await supabase
          .from('movie_projects')
          .insert([projectData])
          .select()
          .single();

        if (error) throw error;
        if (data) {
          setCurrentProjectId(data.id);
          setProjectTitle(title);
          console.log('Project auto-saved (created):', data.id);
        }
      }
    } catch (error: any) {
      console.error('Auto-save failed:', error);
    }
  };

  // Extract locations from outline using AI
  const extractLocationsFromOutline = async () => {
    if (!outline.trim()) {
      toast({
        title: "No Outline",
        description: "Please generate an outline first.",
        variant: "destructive"
      });
      return;
    }

    setIsExtractingLocations(true);
    try {
      const { data, error } = await supabase.functions.invoke('extract-locations', {
        body: { outline }
      });

      if (error) throw error;

      if (data?.locations && Array.isArray(data.locations)) {
        setLocations(data.locations);
        toast({
          title: "Locations Extracted",
          description: `Found ${data.locations.length} unique locations in your outline.`
        });
      }
    } catch (error: any) {
      console.error('Error extracting locations:', error);
      toast({
        title: "Extraction Failed",
        description: error.message || "Failed to extract locations.",
        variant: "destructive"
      });
    } finally {
      setIsExtractingLocations(false);
    }
  };

  // Get location reference for a scene based on its location name
  const getLocationReferenceForScene = (scene: MovieScene): string | undefined => {
    if (!scene.location || locations.length === 0) return undefined;
    
    // Try to match scene location to a defined location
    const sceneLoc = scene.location.toLowerCase();
    const matchedLocation = locations.find(loc => 
      sceneLoc.includes(loc.name.toLowerCase()) || 
      loc.name.toLowerCase().includes(sceneLoc.split(' ')[0])
    );
    
    return matchedLocation?.referenceImage;
  };

  // Update scene coverage
  const updateSceneCoverage = (coverage: SceneCoverage) => {
    setSceneCoverages(prev => {
      const newMap = new Map(prev);
      newMap.set(coverage.sceneNumber, coverage);
      return newMap;
    });
  };

  // Update scene blocking
  const updateSceneBlocking = (sceneNumber: number, blocking: CharacterBlocking[]) => {
    setSceneBlockings(prev => {
      const newMap = new Map(prev);
      newMap.set(sceneNumber, blocking);
      return newMap;
    });
  };

  // Generate all coverage shots for a scene
  const generateCoverageShots = async (coverage: SceneCoverage) => {
    const selectedShots = coverage.shots.filter(s => s.selected);
    if (selectedShots.length === 0) {
      toast({
        title: "No Shots Selected",
        description: "Please select at least one shot to generate.",
        variant: "destructive"
      });
      return;
    }

    setIsGeneratingCoverage(true);
    const scene = scenes.find(s => s.sceneNumber === coverage.sceneNumber);
    if (!scene) return;

    const locationRef = coverage.locationId 
      ? locations.find(l => l.id === coverage.locationId)?.referenceImage
      : getLocationReferenceForScene(scene);

    const blocking = sceneBlockings.get(coverage.sceneNumber) || [];

    try {
      // Generate each shot sequentially to avoid rate limits
      for (let i = 0; i < selectedShots.length; i++) {
        const shot = selectedShots[i];
        
        toast({
          title: `Generating Shot ${i + 1}/${selectedShots.length}`,
          description: shot.description
        });

        // Build shot-specific prompt
        let shotPrompt = `${shot.description}. `;
        
        // Add character focus for character-specific shots
        if (shot.characterFocus) {
          const charBlocking = blocking.find(b => b.characterName === shot.characterFocus);
          if (charBlocking) {
            shotPrompt += `Character ${shot.characterFocus} positioned ${charBlocking.startPosition} of frame, facing ${charBlocking.facing}. `;
          }
        }

        // Add shot type specific instructions
        switch (shot.type) {
          case 'establishing':
            shotPrompt += `Wide establishing shot showing the entire location: ${scene.location}. ${scene.timeOfDay}. `;
            break;
          case 'two-shot':
            shotPrompt += `Medium two-shot with both characters in frame. `;
            break;
          case 'close-up':
            shotPrompt += `Tight close-up on face, emphasizing emotion. `;
            break;
          case 'over-shoulder':
            shotPrompt += `Over-the-shoulder shot from ${shot.fromCharacter}'s perspective looking at ${shot.characterFocus}. `;
            break;
          case 'reaction':
            shotPrompt += `Reaction shot capturing ${shot.characterFocus}'s emotional response. `;
            break;
        }

        // Gather reference images
        let referenceImages: string[] = [];
        if (shot.characterFocus && storyBible?.characters) {
          const char = storyBible.characters.find(c => c.name === shot.characterFocus);
          if (char?.assignedTwinId) {
            const twin = aiTwins.find(t => t.id === char.assignedTwinId);
            if (twin?.reference_images) {
              referenceImages = twin.reference_images;
            }
          }
        }

        const { data, error } = await supabase.functions.invoke('generate-scene-image', {
          body: {
            prompt: shotPrompt + scene.description,
            referenceImages,
            locationReference: locationRef,
            characterBlocking: blocking
          }
        });

        if (error) {
          console.error(`Error generating shot ${shot.id}:`, error);
          continue;
        }

        // Update the shot with generated image
        setSceneCoverages(prev => {
          const newMap = new Map(prev);
          const existingCoverage = newMap.get(coverage.sceneNumber);
          if (existingCoverage) {
            const updatedShots = existingCoverage.shots.map(s =>
              s.id === shot.id ? { ...s, imageUrl: data.imageUrl } : s
            );
            newMap.set(coverage.sceneNumber, { ...existingCoverage, shots: updatedShots });
          }
          return newMap;
        });
      }

      toast({
        title: "Coverage Generated",
        description: `Generated ${selectedShots.length} shots for Scene ${coverage.sceneNumber}.`
      });
    } catch (error: any) {
      console.error('Error generating coverage:', error);
      toast({
        title: "Generation Failed",
        description: error.message || "Failed to generate coverage shots.",
        variant: "destructive"
      });
    } finally {
      setIsGeneratingCoverage(false);
    }
  };

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

  // Periodic auto-save every 60 seconds when there's unsaved content
  useEffect(() => {
    if (!userId) return;
    if (!scenes.length && !outline) return;

    const interval = setInterval(() => {
      autoSaveProject();
    }, 60000); // Auto-save every 60 seconds

    return () => clearInterval(interval);
  }, [userId, scenes, outline, currentProjectId, movieIdea, projectTitle, storyBible]);

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

  const loadAiTwins = async (retryCount = 0) => {
    if (!userId) return;
    try {
      const { data, error } = await supabase
        .from('ai_twins')
        .select('id, name, reference_images, voice_cloning_key, description, face_description')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(50);
      
      if (error) {
        // Retry on timeout errors
        if (error.code === '57014' && retryCount < 2) {
          console.log(`AI twins query timed out, retrying (${retryCount + 1}/2)...`);
          await new Promise(resolve => setTimeout(resolve, 1000));
          return loadAiTwins(retryCount + 1);
        }
        throw error;
      }
      setAiTwins((data as AITwin[]) || []);
    } catch (error) {
      console.error('Failed to load AI twins:', error);
      toast({
        title: "Failed to load AI Twins",
        description: "Please refresh the page to try again.",
        variant: "destructive"
      });
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

  // Generate Story Bible first
  const generateStoryBible = async () => {
    if (!movieIdea.trim()) {
      toast({
        title: "Movie Idea Required",
        description: "Please describe your movie idea first.",
        variant: "destructive"
      });
      return;
    }

    setIsGeneratingStoryBible(true);
    try {
      let characterDescription: string | undefined;
      
      if (selectedTwins.length > 0) {
        // Build descriptions for all selected twins
        characterDescription = selectedTwins.map(twin => {
          const genderText = twin.gender ? `${twin.gender} ` : '';
          return `${twin.name} (${genderText}character): ${twin.face_description || twin.description || 'No description'}`;
        }).join('\n\n');
      } else if (selectedCharacter) {
        characterDescription = `${selectedCharacter.name}: ${selectedCharacter.description || 'No description'}`;
      }

      const { data, error } = await supabase.functions.invoke('generate-story-bible', {
        body: { movieIdea, characterDescription }
      });

      if (error) throw error;

      // Auto-assign voices from selected AI Twins to matching story bible characters
      let storyBibleWithVoices = data.storyBible;
      if (selectedTwins.length > 0 && storyBibleWithVoices.characters) {
        storyBibleWithVoices = {
          ...storyBibleWithVoices,
          characters: storyBibleWithVoices.characters.map((char: any) => {
            // Find matching twin by name (case-insensitive)
            const matchingTwin = selectedTwins.find(
              twin => twin.name.toLowerCase() === char.name.toLowerCase()
            );
            if (matchingTwin) {
              return {
                ...char,
                assignedTwinId: matchingTwin.id,
                assignedTwinName: matchingTwin.name,
                assignedVoiceCloningKey: matchingTwin.voice_cloning_key || undefined
              };
            }
            return char;
          })
        };
      }

      setStoryBible(storyBibleWithVoices);
      setShowStoryBibleEditor(true);
      setCurrentStep(1); // Auto-advance to Story Bible step
      
      const assignedCount = storyBibleWithVoices.characters?.filter((c: any) => c.assignedTwinId).length || 0;
      toast({
        title: "Story Bible Generated!",
        description: `Created ${storyBibleWithVoices.characters?.length || 0} characters${assignedCount > 0 ? ` (${assignedCount} with voices auto-assigned)` : ''}. Review and edit before generating scenes.`,
      });
    } catch (error: any) {
      console.error('Error generating story bible:', error);
      toast({
        title: "Generation Failed",
        description: error.message || "Failed to generate story bible. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsGeneratingStoryBible(false);
    }
  };

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
      
      if (selectedTwins.length > 0) {
        // Use all AI Twins' detailed descriptions
        characterDescription = selectedTwins.map(twin => {
          const genderText = twin.gender ? `${twin.gender} ` : '';
          const pronouns = twin.gender === 'female' ? 'she/her' : twin.gender === 'male' ? 'he/him' : 'they/them';
          return `${twin.name} (${genderText}character, pronouns: ${pronouns}): ${twin.face_description || twin.description || 'No description'}`;
        }).join('\n\n');
      } else if (selectedCharacter) {
        characterDescription = `${selectedCharacter.name}: ${selectedCharacter.description || 'No description'}`;
      } else if (selectedGalleryImage) {
        characterDescription = selectedGalleryImage.prompt 
          ? `Character based on image: ${selectedGalleryImage.prompt}`
          : 'Use the reference image to maintain character consistency';
      }

      const { data, error } = await supabase.functions.invoke('generate-movie-outline', {
        body: { movieIdea, characterDescription, movieLength }
      });

      if (error) throw error;

      setOutline(data.outline);
      setCurrentStep(2); // Auto-advance to Outline step
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
      // Pass character description and story bible for consistency
      let characterDescription: string | undefined;
      let characterName: string | undefined;
      
      if (selectedTwins.length > 0) {
        characterDescription = selectedTwins.map(twin => {
          const genderText = twin.gender ? `${twin.gender} ` : '';
          const pronouns = twin.gender === 'female' ? 'she/her' : twin.gender === 'male' ? 'he/him' : 'they/them';
          return `${twin.name} (${genderText}character, pronouns: ${pronouns}): ${twin.face_description || twin.description || 'No description'}`;
        }).join('\n\n');
        characterName = selectedTwins.map(t => t.name).join(' & ');
      } else if (selectedCharacter) {
        characterDescription = `${selectedCharacter.name}: ${selectedCharacter.description || 'No description'}`;
        characterName = selectedCharacter.name;
      } else if (selectedGalleryImage?.prompt) {
        characterDescription = `Character based on: ${selectedGalleryImage.prompt}`;
      }

      // Pass story bible if available for better consistency
      const { data, error } = await supabase.functions.invoke('generate-movie-scenes', {
        body: { 
          outline, 
          characterDescription,
          storyBible: storyBible || undefined,
          movieLength
        }
      });

      if (error) throw error;

      // Ensure all scenes have camera angle and lighting set (with fallbacks)
      const generatedScenes = (data.scenes as MovieScene[]).map(scene => ({
        ...scene,
        selectedCameraAngle: scene.selectedCameraAngle || 'eye-level',
        selectedLighting: scene.selectedLighting || 'natural',
      }));
      setScenes(generatedScenes);
      
      toast({
        title: "Scenes Generated!",
        description: `Created ${generatedScenes.length} scenes. Generating dialogue...`,
      });

      // Auto-generate dialogue for each scene with specific character assignments
      const scenesWithDialogue = await Promise.all(
        generatedScenes.map(async (scene) => {
          try {
            // Get character names from story bible dialogue map
            const sceneDialogueMap = storyBible?.sceneDialogueMap?.find(
              (s: any) => s.sceneNumber === scene.sceneNumber
            );
            
            // Determine which characters are in this scene, prioritizing the selected AI Twins
            let charactersInScene: string[] = [];
            if (selectedTwins.length > 0) {
              const twinNames = selectedTwins.map(t => t.name);

              if (sceneDialogueMap?.charactersPresent?.length) {
                const presentSet = new Set(sceneDialogueMap.charactersPresent);
                // Prefer twins that are actually marked as present in this scene
                charactersInScene = twinNames.filter(name => presentSet.has(name));

                // If none of the twins are explicitly listed, fall back to all selected twins
                if (charactersInScene.length === 0) {
                  charactersInScene = twinNames;
                }
              } else {
                charactersInScene = twinNames;
              }
            } else if (sceneDialogueMap?.charactersPresent) {
              charactersInScene = sceneDialogueMap.charactersPresent;
            } else if (characterName) {
              charactersInScene = [characterName];
            }

            const sceneContext = {
              sceneDescription: scene.description,
              sceneTitle: scene.title,
              location: scene.location,
              timeOfDay: scene.timeOfDay,
              tone: scene.title.toLowerCase().includes('tension') || scene.title.toLowerCase().includes('conflict') 
                ? 'dramatic' 
                : scene.title.toLowerCase().includes('romance') || scene.title.toLowerCase().includes('love')
                  ? 'romantic'
                  : 'natural'
            };

            // If we have 2+ characters, generate dialogue for first character
            const firstCharacter = charactersInScene[0];
            const { data: mainDialogueData, error: mainDialogueError } = await supabase.functions.invoke('generate-scene-dialogue', {
              body: { 
                ...sceneContext, 
                characterName: firstCharacter,
                isMainCharacter: true 
              }
            });

            if (mainDialogueError) {
              console.error(`Failed to generate main dialogue for scene ${scene.sceneNumber}:`, mainDialogueError);
              return scene;
            }

            // If we have a second character, generate their dialogue too
            let otherDialogue = null;
            if (charactersInScene.length >= 2) {
              const secondCharacter = charactersInScene[1];
              const { data: otherDialogueData, error: otherDialogueError } = await supabase.functions.invoke('generate-scene-dialogue', {
                body: { 
                  ...sceneContext, 
                  characterName: secondCharacter,
                  otherCharacterName: firstCharacter,
                  isMainCharacter: false 
                }
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
        description: `Generated ${generatedScenes.length} scenes with dialogue for all characters.`,
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

  // One-click Generate All - chains story bible, outline, locations, scenes with dialogue, and first frame
  const generateAll = async () => {
    if (!movieIdea.trim()) {
      toast({
        title: "Movie Idea Required",
        description: "Please describe your movie idea first.",
        variant: "destructive"
      });
      return;
    }

    if (selectedTwins.length === 0) {
      toast({
        title: "Select AI Twins",
        description: "Please select at least one AI Twin to star in your movie.",
        variant: "destructive"
      });
      return;
    }

    setIsGeneratingAll(true);
    setGenerateAllProgress(0);

    try {
      // Step 1: Generate Story Bible (10%)
      setGenerateAllStep('Creating Story Bible...');
      setGenerateAllProgress(5);

      let characterDescription = selectedTwins.map(twin => {
        const genderText = twin.gender ? `${twin.gender} ` : '';
        return `${twin.name} (${genderText}character): ${twin.face_description || twin.description || 'No description'}`;
      }).join('\n\n');

      const { data: storyBibleData, error: storyBibleError } = await supabase.functions.invoke('generate-story-bible', {
        body: { movieIdea, characterDescription }
      });

      if (storyBibleError) throw storyBibleError;

      // Auto-assign voices from selected AI Twins
      let storyBibleWithVoices = storyBibleData.storyBible;
      if (storyBibleWithVoices.characters) {
        storyBibleWithVoices = {
          ...storyBibleWithVoices,
          characters: storyBibleWithVoices.characters.map((char: any) => {
            const matchingTwin = selectedTwins.find(
              twin => twin.name.toLowerCase() === char.name.toLowerCase()
            );
            if (matchingTwin) {
              return {
                ...char,
                assignedTwinId: matchingTwin.id,
                assignedTwinName: matchingTwin.name,
                assignedVoiceCloningKey: matchingTwin.voice_cloning_key || undefined
              };
            }
            return char;
          })
        };
      }
      setStoryBible(storyBibleWithVoices);
      setGenerateAllProgress(15);

      // Step 2: Generate Outline (25%)
      setGenerateAllStep('Generating Outline...');
      
      const pronounsDesc = selectedTwins.map(twin => {
        const genderText = twin.gender ? `${twin.gender} ` : '';
        const pronouns = twin.gender === 'female' ? 'she/her' : twin.gender === 'male' ? 'he/him' : 'they/them';
        return `${twin.name} (${genderText}character, pronouns: ${pronouns}): ${twin.face_description || twin.description || 'No description'}`;
      }).join('\n\n');

      const { data: outlineData, error: outlineError } = await supabase.functions.invoke('generate-movie-outline', {
        body: { movieIdea, characterDescription: pronounsDesc, movieLength }
      });

      if (outlineError) throw outlineError;
      setOutline(outlineData.outline);
      setGenerateAllProgress(30);

      // Step 3: Extract Locations (35%)
      setGenerateAllStep('Extracting Locations...');
      
      const { data: locationsData, error: locationsError } = await supabase.functions.invoke('extract-locations', {
        body: { outline: outlineData.outline }
      });

      if (!locationsError && locationsData?.locations) {
        setLocations(locationsData.locations);
      }
      setGenerateAllProgress(40);

      // Step 4: Generate Scenes (55%)
      setGenerateAllStep('Generating Scenes...');
      
      const { data: scenesData, error: scenesError } = await supabase.functions.invoke('generate-movie-scenes', {
        body: { 
          outline: outlineData.outline, 
          characterDescription: pronounsDesc,
          storyBible: storyBibleWithVoices,
          movieLength
        }
      });

      if (scenesError) throw scenesError;

      const generatedScenes = (scenesData.scenes as MovieScene[]).map(scene => ({
        ...scene,
        selectedCameraAngle: scene.selectedCameraAngle || 'eye-level',
        selectedLighting: scene.selectedLighting || 'natural',
      }));
      setGenerateAllProgress(55);

      // Step 5: Generate Conversation Dialogue for each scene (75%)
      setGenerateAllStep('Creating Blockbuster Dialogue...');
      const characterNames = selectedTwins.map(t => t.name);
      
      // Build character personalities from story bible or twin descriptions
      const characterPersonalities: Record<string, string> = {};
      selectedTwins.forEach(twin => {
        characterPersonalities[twin.name] = twin.description || twin.face_description || '';
      });
      if (storyBibleData?.characters) {
        storyBibleData.characters.forEach((char: StoryBibleCharacter) => {
          if (characterPersonalities[char.name] !== undefined) {
            characterPersonalities[char.name] = `${char.personality}. Arc: ${char.arc}`;
          }
        });
      }
      
      const scenesWithDialogue = await Promise.all(
        generatedScenes.map(async (scene, index) => {
          try {
            setGenerateAllProgress(55 + Math.floor((index / generatedScenes.length) * 20));
            
            // Determine scene position for context
            const totalScenes = generatedScenes.length;
            let scenePosition = `${index + 1} of ${totalScenes}`;
            if (index === 0) scenePosition = 'opening';
            else if (index === totalScenes - 1) scenePosition = 'resolution/final';
            else if (index === Math.floor(totalScenes / 2)) scenePosition = 'midpoint';
            else if (index === Math.floor(totalScenes * 0.75)) scenePosition = 'climax';
            
            // Get previous scene summary for continuity
            const previousSceneSummary = index > 0 
              ? `${generatedScenes[index - 1].title}: ${generatedScenes[index - 1].description.substring(0, 150)}...`
              : undefined;
            
            // For 2+ characters, use conversation dialogue with rich context
            if (selectedTwins.length >= 2) {
              const { data: convData, error: convError } = await supabase.functions.invoke('generate-conversation-dialogue', {
                body: {
                  sceneDescription: scene.description,
                  sceneTitle: scene.title,
                  location: scene.location,
                  timeOfDay: scene.timeOfDay,
                  characterNames,
                  tone: scene.mood || 'dramatic',
                  // NEW: Pass rich story context for blockbuster dialogue
                  movieIdea: movieIdea,
                  storyBible: storyBibleData ? {
                    theme: storyBibleData.theme,
                    logline: storyBibleData.logline,
                    tone: storyBibleData.emotionalArc?.join(', ')
                  } : undefined,
                  scenePosition,
                  previousSceneSummary,
                  characterPersonalities,
                  transitionAction: scene.transitionAction
                }
              });

              if (!convError && convData?.conversation) {
                return {
                  ...scene,
                  dialogue: convData.conversation, // Array of {character, line}
                  charactersInScene: characterNames
                };
              }
            }

            // Fallback: single character dialogue
            const { data: dialogueData, error: dialogueError } = await supabase.functions.invoke('generate-scene-dialogue', {
              body: {
                sceneDescription: scene.description,
                sceneTitle: scene.title,
                location: scene.location,
                timeOfDay: scene.timeOfDay,
                characterName: characterNames[0],
                isMainCharacter: true
              }
            });

            if (!dialogueError && dialogueData?.dialogue) {
              return { ...scene, dialogue: dialogueData.dialogue };
            }

            return scene;
          } catch (err) {
            console.error(`Error generating dialogue for scene ${scene.sceneNumber}:`, err);
            return scene;
          }
        })
      );
      
      setScenes(scenesWithDialogue);
      setGenerateAllProgress(75);

      // Step 6: Generate first scene's start frame (90%)
      if (scenesWithDialogue.length > 0) {
        setGenerateAllStep('Generating First Frame...');
        const firstScene = scenesWithDialogue[0];
        
        // Build prompt for first frame
        let enhancedPrompt = firstScene.imagePrompt;
        const referenceImages = selectedTwins.flatMap(twin => twin.reference_images || []);
        const charDescription = selectedTwins.map(twin => {
          const genderText = twin.gender || 'person';
          const faceDesc = twin.face_description || twin.description || '';
          return `${twin.name} is a ${genderText}. Physical appearance: ${faceDesc}`;
        }).join('\n\n');

        try {
          const { data: imageData, error: imageError } = await supabase.functions.invoke('generate-scene-image', {
            body: { 
              prompt: enhancedPrompt,
              referenceImages,
              characterDescription: charDescription
            }
          });

          if (!imageError && imageData?.imageUrl) {
            scenesWithDialogue[0] = {
              ...scenesWithDialogue[0],
              startFrame: {
                imagePrompt: enhancedPrompt,
                generatedImage: imageData.imageUrl,
                position: 'center',
                cameraAngle: 'eye-level'
              }
            };
            setScenes([...scenesWithDialogue]);
          }
        } catch (frameError) {
          console.error('Error generating first frame:', frameError);
        }
      }

      setGenerateAllProgress(100);
      setGenerateAllStep('Complete!');

      toast({
        title: "Movie Generated!",
        description: `Created ${scenesWithDialogue.length} scenes with dialogue and first frame. Review and customize as needed.`,
      });

      // Auto-save
      setTimeout(() => autoSaveProject(scenesWithDialogue), 500);

    } catch (error: any) {
      console.error('Error in generateAll:', error);
      toast({
        title: "Generation Failed",
        description: error.message || "Failed to generate movie. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsGeneratingAll(false);
      setGenerateAllStep('');
      setGenerateAllProgress(0);
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
      
      // Fix #3: Gather reference images from AI Twins assigned in Story Bible
      const storyBibleTwinIds = new Set<string>();
      if (storyBible?.characters) {
        for (const char of storyBible.characters) {
          if (char.assignedTwinId) {
            storyBibleTwinIds.add(char.assignedTwinId);
          }
        }
      }
      
      // Combine selected twins with story bible assigned twins
      const allRelevantTwins = [...selectedTwins];
      for (const twinId of storyBibleTwinIds) {
        if (!allRelevantTwins.find(t => t.id === twinId)) {
          const twin = aiTwins.find(t => t.id === twinId);
          if (twin) allRelevantTwins.push(twin);
        }
      }
      
      if (allRelevantTwins.length > 0) {
        // Use ALL reference images from all relevant AI Twins for better consistency
        referenceImages = allRelevantTwins.flatMap(twin => twin.reference_images || []);
        // Build comprehensive character description including all physical details
        characterDescription = allRelevantTwins.map(twin => {
          const genderText = twin.gender ? `${twin.gender}` : 'person';
          const faceDesc = twin.face_description || '';
          const generalDesc = twin.description || '';
          return `${twin.name} is a ${genderText}. Physical appearance: ${faceDesc}. ${generalDesc}`.trim();
        }).join('\n\n');
        
        // Build detailed character descriptions and collect reference images for AI Twins
        const charactersPrompt = allRelevantTwins.map(twin => {
          const genderText = twin.gender || 'person';
          const faceDesc = twin.face_description || twin.description || '';
          return `${twin.name}, a ${genderText} with these features: ${faceDesc}`;
        }).join('. Also featuring ');

        enhancedPrompt = `The characters are ${charactersPrompt}. Scene: ${enhancedPrompt}`;
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

      // Get location reference and blocking for this scene
      const locationReference = scene ? getLocationReferenceForScene(scene) : undefined;
      const characterBlocking = sceneBlockings.get(sceneNumber) || [];

      const { data, error } = await supabase.functions.invoke('generate-scene-image', {
        body: { 
          prompt: enhancedPrompt,
          referenceImages,
          characterDescription,
          locationReference,
          characterBlocking
        }
      });

      if (error) throw error;

      // Update the scene with the generated image
      setScenes(prevScenes => {
        const updated = prevScenes.map(scene => 
          scene.sceneNumber === sceneNumber 
            ? { ...scene, generatedImage: data.imageUrl }
            : scene
        );
        // Auto-save after image generation
        setTimeout(() => autoSaveProject(updated), 500);
        return updated;
      });

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

  // Keyframe helper functions
  const updateKeyframe = (sceneNumber: number, frame: 'start' | 'end', updates: Partial<KeyframeData>) => {
    setScenes(prevScenes =>
      prevScenes.map(s =>
        s.sceneNumber === sceneNumber
          ? { 
              ...s, 
              [frame === 'start' ? 'startFrame' : 'endFrame']: {
                ...(s[frame === 'start' ? 'startFrame' : 'endFrame'] || { imagePrompt: '', cameraAngle: 'eye-level', position: '' }),
                ...updates
              }
            }
          : s
      )
    );
  };

  const generateKeyframeImage = async (sceneNumber: number, frame: 'start' | 'end') => {
    const scene = scenes.find(s => s.sceneNumber === sceneNumber);
    if (!scene) return;
    
    const frameData = frame === 'start' ? scene.startFrame : scene.endFrame;
    if (!frameData?.imagePrompt) {
      toast({ title: "Image prompt required", variant: "destructive" });
      return;
    }

    setGeneratingFrameFor({ sceneNumber, frame });
    try {
      let referenceImages: string[] = [];
      let characterDescription: string | undefined;
      
      if (selectedTwins.length > 0) {
        referenceImages = selectedTwins.flatMap(twin => twin.reference_images || []);
        characterDescription = selectedTwins.map(twin => 
          `${twin.name}: ${twin.face_description || twin.description || ''}`
        ).join('\n\n');
      }

      const enhancedPrompt = `${frameData.imagePrompt}. Camera: ${frameData.cameraAngle}. Position: ${frameData.position}`;

      const { data, error } = await supabase.functions.invoke('generate-scene-image', {
        body: { prompt: enhancedPrompt, referenceImages, characterDescription }
      });

      if (error) throw error;

      // Convert base64 to storage URL for better performance and persistence
      let imageUrl = data.imageUrl;
      if (imageUrl && imageUrl.startsWith('data:')) {
        try {
          const { data: userData } = await supabase.auth.getUser();
          if (userData?.user?.id) {
            const storageUrl = await convertBase64ToStorageUrl(imageUrl, userData.user.id, 'reels');
            if (storageUrl && !storageUrl.startsWith('data:')) {
              imageUrl = storageUrl;
            }
          }
        } catch (uploadErr) {
          console.warn('Failed to upload to storage, using base64:', uploadErr);
        }
      }

      updateKeyframe(sceneNumber, frame, { generatedImage: imageUrl });
      
      // Auto-link: if end frame generated and auto-link is on, copy to next scene's start
      if (frame === 'end' && autoLinkScenes) {
        const nextScene = scenes.find(s => s.sceneNumber === sceneNumber + 1);
        if (nextScene) {
          updateKeyframe(sceneNumber + 1, 'start', { 
            generatedImage: imageUrl,
            imagePrompt: frameData.imagePrompt 
          });
        }
      }

      // Auto-save after generating frame image
      setTimeout(() => autoSaveProject(), 500);

      toast({ title: `${frame === 'start' ? 'Start' : 'End'} frame generated!` });
    } catch (error: any) {
      toast({ title: "Generation failed", description: error.message, variant: "destructive" });
    } finally {
      setGeneratingFrameFor(null);
    }
  };

  // Describe scene using AI to generate image prompt
  const describeScene = async (sceneNumber: number, frame: 'start' | 'end') => {
    const scene = scenes.find(s => s.sceneNumber === sceneNumber);
    if (!scene) return;

    setDescribingSceneFor({ sceneNumber, frame });
    try {
      const characterDescription = selectedTwins.length > 0 
        ? selectedTwins.map(twin => `${twin.name}: ${twin.face_description || twin.description || ''}`).join('\n\n')
        : selectedCharacter?.description || undefined;

      const frameData = frame === 'start' ? scene.startFrame : scene.endFrame;

      const { data, error } = await supabase.functions.invoke('describe-scene', {
        body: {
          sceneTitle: scene.title,
          location: scene.location,
          timeOfDay: scene.timeOfDay,
          dialogue: typeof scene.dialogue === 'string' ? scene.dialogue : 
                    Array.isArray(scene.dialogue) ? scene.dialogue.map(d => d.line).join(' ') : null,
          transitionAction: scene.transitionAction,
          characterDescription,
          cameraAngle: frameData?.cameraAngle || 'eye-level',
          position: frameData?.position,
          frameType: frame,
          mood: scene.mood,
          lighting: scene.selectedLighting
        }
      });

      if (error) throw error;

      if (data?.imagePrompt) {
        updateKeyframe(sceneNumber, frame, { imagePrompt: data.imagePrompt });
        toast({ title: `${frame === 'start' ? 'Start' : 'End'} frame described!` });
      }
    } catch (error: any) {
      toast({ title: "Description failed", description: error.message, variant: "destructive" });
    } finally {
      setDescribingSceneFor(null);
    }
  };

  // Describe scene and then generate image
  const describeAndGenerateScene = async (sceneNumber: number, frame: 'start' | 'end') => {
    const scene = scenes.find(s => s.sceneNumber === sceneNumber);
    if (!scene) return;

    setDescribingSceneFor({ sceneNumber, frame });
    try {
      const characterDescription = selectedTwins.length > 0 
        ? selectedTwins.map(twin => `${twin.name}: ${twin.face_description || twin.description || ''}`).join('\n\n')
        : selectedCharacter?.description || undefined;

      const frameData = frame === 'start' ? scene.startFrame : scene.endFrame;

      // Step 1: Describe the scene
      const { data: describeData, error: describeError } = await supabase.functions.invoke('describe-scene', {
        body: {
          sceneTitle: scene.title,
          location: scene.location,
          timeOfDay: scene.timeOfDay,
          dialogue: typeof scene.dialogue === 'string' ? scene.dialogue : 
                    Array.isArray(scene.dialogue) ? scene.dialogue.map(d => d.line).join(' ') : null,
          transitionAction: scene.transitionAction,
          characterDescription,
          cameraAngle: frameData?.cameraAngle || 'eye-level',
          position: frameData?.position,
          frameType: frame,
          mood: scene.mood,
          lighting: scene.selectedLighting
        }
      });

      if (describeError) throw describeError;

      if (!describeData?.imagePrompt) {
        throw new Error('No description generated');
      }

      // Update the prompt
      updateKeyframe(sceneNumber, frame, { imagePrompt: describeData.imagePrompt });
      setDescribingSceneFor(null);

      // Step 2: Generate the image
      setGeneratingFrameFor({ sceneNumber, frame });

      let referenceImages: string[] = [];
      if (selectedTwins.length > 0) {
        referenceImages = selectedTwins.flatMap(twin => twin.reference_images || []);
      }

      const enhancedPrompt = `${describeData.imagePrompt}. Camera: ${frameData?.cameraAngle || 'eye-level'}. Position: ${frameData?.position || ''}`;

      const { data: imageData, error: imageError } = await supabase.functions.invoke('generate-scene-image', {
        body: { prompt: enhancedPrompt, referenceImages, characterDescription }
      });

      if (imageError) throw imageError;

      // Convert base64 to storage URL
      let imageUrl = imageData.imageUrl;
      if (imageUrl && imageUrl.startsWith('data:')) {
        try {
          const { data: userData } = await supabase.auth.getUser();
          if (userData?.user?.id) {
            const storageUrl = await convertBase64ToStorageUrl(imageUrl, userData.user.id, 'reels');
            if (storageUrl && !storageUrl.startsWith('data:')) {
              imageUrl = storageUrl;
            }
          }
        } catch (uploadErr) {
          console.warn('Failed to upload to storage, using base64:', uploadErr);
        }
      }

      updateKeyframe(sceneNumber, frame, { generatedImage: imageUrl });

      // Auto-link to next scene if applicable
      if (frame === 'end' && autoLinkScenes) {
        const nextScene = scenes.find(s => s.sceneNumber === sceneNumber + 1);
        if (nextScene) {
          updateKeyframe(sceneNumber + 1, 'start', { 
            generatedImage: imageUrl,
            imagePrompt: describeData.imagePrompt 
          });
        }
      }

      // Auto-save after generating frame image
      setTimeout(() => autoSaveProject(), 500);

      toast({ title: `${frame === 'start' ? 'Start' : 'End'} frame auto-generated!` });
    } catch (error: any) {
      toast({ title: "Auto-generate failed", description: error.message, variant: "destructive" });
    } finally {
      setDescribingSceneFor(null);
      setGeneratingFrameFor(null);
    }
  };

  const linkToPreviousScene = (sceneNumber: number) => {
    const prevScene = scenes.find(s => s.sceneNumber === sceneNumber - 1);
    if (prevScene?.endFrame?.generatedImage) {
      updateKeyframe(sceneNumber, 'start', {
        generatedImage: prevScene.endFrame.generatedImage,
        imagePrompt: prevScene.endFrame.imagePrompt,
        cameraAngle: prevScene.endFrame.cameraAngle,
        position: prevScene.endFrame.position
      });
      toast({ title: "Linked to previous scene" });
    }
  };

  // Apply commercial template
  const applyCommercialTemplate = (templateScenes: MovieSceneWithKeyframes[], movieIdea: string) => {
    setMovieIdea(movieIdea);
    setScenes(templateScenes as MovieScene[]);
    setOutline(`Commercial Template Applied\n\n${movieIdea}\n\nScenes: ${templateScenes.length}`);
    toast({
      title: "Template Applied!",
      description: `Loaded ${templateScenes.length} pre-configured scenes. Customize and generate images.`
    });
  };

  const generateDialogue = async (sceneNumber: number) => {
    const scene = scenes.find(s => s.sceneNumber === sceneNumber);
    if (!scene) return;

    const characterNames = selectedTwins.length > 0 ? selectedTwins.map(t => t.name) : [selectedCharacter?.name].filter(Boolean);

    try {
      toast({
        title: "Generating Blockbuster Dialogue",
        description: `Creating cinematic dialogue...`
      });

      // For 2+ characters, use conversation dialogue with story context
      if (selectedTwins.length >= 2) {
        // Build character personalities
        const characterPersonalities: Record<string, string> = {};
        selectedTwins.forEach(twin => {
          characterPersonalities[twin.name] = twin.description || twin.face_description || '';
        });
        if (storyBible?.characters) {
          storyBible.characters.forEach((char: StoryBibleCharacter) => {
            if (characterPersonalities[char.name] !== undefined) {
              characterPersonalities[char.name] = `${char.personality}. Arc: ${char.arc}`;
            }
          });
        }

        // Get scene position for context
        const totalScenes = scenes.length;
        const sceneIdx = scenes.findIndex(s => s.sceneNumber === sceneNumber);
        let scenePosition = `${sceneIdx + 1} of ${totalScenes}`;
        if (sceneIdx === 0) scenePosition = 'opening';
        else if (sceneIdx === totalScenes - 1) scenePosition = 'resolution/final';
        
        // Get previous scene summary
        const previousSceneSummary = sceneIdx > 0 
          ? `${scenes[sceneIdx - 1].title}: ${scenes[sceneIdx - 1].description?.substring(0, 150)}...`
          : undefined;

        const { data: convData, error: convError } = await supabase.functions.invoke('generate-conversation-dialogue', {
          body: {
            sceneDescription: scene.description,
            sceneTitle: scene.title,
            location: scene.location,
            timeOfDay: scene.timeOfDay,
            characterNames,
            tone: scene.mood || 'dramatic',
            movieIdea: movieIdea,
            storyBible: storyBible ? {
              theme: storyBible.theme,
              logline: storyBible.logline,
              tone: storyBible.emotionalArc?.join(', ')
            } : undefined,
            scenePosition,
            previousSceneSummary,
            characterPersonalities,
            transitionAction: scene.transitionAction
          }
        });

        if (convError) throw convError;

        if (convData?.conversation) {
          // Store as conversation array
          setScenes(prevScenes =>
            prevScenes.map(s =>
              s.sceneNumber === sceneNumber
                ? { ...s, dialogue: convData.conversation, charactersInScene: characterNames }
                : s
            )
          );
          
          toast({
            title: "Dialogue Generated!",
            description: `Created ${convData.conversation.length} lines of blockbuster dialogue.`
          });
          return;
        }
      }

      // Fallback: single character dialogue
      const sceneContext = {
        sceneDescription: scene.description,
        sceneTitle: scene.title,
        location: scene.location,
        timeOfDay: scene.timeOfDay,
        characterName: characterNames[0],
        tone: scene.mood || 'natural'
      };

      const { data, error } = await supabase.functions.invoke('generate-scene-dialogue', {
        body: { ...sceneContext, isMainCharacter: true }
      });

      if (error) throw error;

      if (data?.dialogue) {
        updateSceneText(sceneNumber, 'dialogue', data.dialogue);
        
        toast({
          title: "Dialogue Generated!",
          description: "AI-generated dialogue has been added."
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

  // Regenerate dialogue for ALL scenes with longer 30+ second dialogue
  const regenerateAllDialogue = async () => {
    if (scenes.length === 0) {
      toast({
        title: "No Scenes",
        description: "Generate scenes first before regenerating dialogue.",
        variant: "destructive"
      });
      return;
    }

    setIsRegeneratingDialogue(true);
    const characterName = selectedTwins.length > 0 ? selectedTwins.map(t => t.name).join(' & ') : selectedCharacter?.name;

    try {
      toast({
        title: "Regenerating All Dialogue",
        description: `Creating longer 30+ second dialogue for ${scenes.length} scenes...`,
      });

      const updatedScenes = await Promise.all(
        scenes.map(async (scene) => {
          try {
            const sceneContext = {
              sceneDescription: scene.description,
              sceneTitle: scene.title,
              location: scene.location,
              timeOfDay: scene.timeOfDay,
              characterName,
              tone: scene.mood || 'natural'
            };

            // Generate main character dialogue
            const { data: mainDialogueData, error: mainDialogueError } = await supabase.functions.invoke('generate-scene-dialogue', {
              body: { ...sceneContext, isMainCharacter: true }
            });

            if (mainDialogueError) {
              console.error(`Failed to generate dialogue for scene ${scene.sceneNumber}:`, mainDialogueError);
              return scene;
            }

            // Check if scene involves multiple characters
            const hasOtherCharacters = /interact|conversation|talk|speak|meet|confront|argue|discuss|responds|replies|another|other person|companion|partner|friend|enemy|stranger/i.test(scene.description);
            
            let otherDialogue = null;
            if (hasOtherCharacters && characterName) {
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
            console.error(`Error regenerating dialogue for scene ${scene.sceneNumber}:`, err);
            return scene;
          }
        })
      );

      setScenes(updatedScenes);
      toast({
        title: "Dialogue Regenerated!",
        description: `Updated dialogue for ${scenes.length} scenes with longer 30+ second content.`,
      });
    } catch (error: any) {
      console.error('Error regenerating dialogue:', error);
      toast({
        title: "Regeneration Failed",
        description: error.message || "Failed to regenerate dialogue. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsRegeneratingDialogue(false);
    }
  };

  const generateLipSyncVideo = async (sceneNumber: number) => {
    const scene = scenes.find(s => s.sceneNumber === sceneNumber);
    
    // Check for keyframe images (new system) or legacy generatedImage
    const imageToUse = scene?.startFrame?.generatedImage || scene?.generatedImage;
    
    if (!imageToUse) {
      toast({
        title: "Image Required",
        description: "Please generate the start frame image first (in the Keyframes tab).",
        variant: "destructive"
      });
      return;
    }

    setGeneratingVideoFor(sceneNumber);
    try {
      // Generate audio from dialogue (never use description as dialogue)
      let textForAudio = '';
      if (scene.dialogue) {
        if (Array.isArray(scene.dialogue)) {
          textForAudio = scene.dialogue.map(d => d.line).join(' ');
        } else {
          textForAudio = scene.dialogue;
        }
      }
      
      // Clean dialogue text - remove stage directions before TTS
      textForAudio = cleanDialogueForTTS(textForAudio);
      
      // If no dialogue, use a simple default
      if (!textForAudio) {
        textForAudio = "This moment is everything. I have to keep going.";
      }
      
      // Determine voice to use based on story bible character assignments or selected twins
      let voiceToUse: { name: string; speechifyVoiceId?: string; voiceCloningKey?: string } | null = null;
      
      // Check if we have a story bible with voice assignments
      if (storyBible?.characters) {
        // For conversation-style dialogue, find the first speaking character
        if (Array.isArray(scene.dialogue) && scene.dialogue.length > 0) {
          const firstSpeaker = scene.dialogue[0].character;
          const assignedChar = storyBible.characters.find(c => 
            c.name.toLowerCase() === firstSpeaker.toLowerCase()
          );
          if (assignedChar?.assignedTwinId) {
            const assignedTwin = aiTwins.find(t => t.id === assignedChar.assignedTwinId);
            if (assignedTwin?.voice_cloning_key) {
              const isSpeechify = isSpeechifyVoiceId(assignedTwin.voice_cloning_key);
              voiceToUse = { 
                name: assignedTwin.name,
                speechifyVoiceId: isSpeechify ? assignedTwin.voice_cloning_key : undefined,
                voiceCloningKey: !isSpeechify ? assignedTwin.voice_cloning_key : undefined
              };
            }
          }
        } else {
          // For non-conversation dialogue, use protagonist's voice if assigned
          const protagonist = storyBible.characters.find(c => c.role === 'protagonist');
          if (protagonist?.assignedTwinId) {
            const assignedTwin = aiTwins.find(t => t.id === protagonist.assignedTwinId);
            if (assignedTwin?.voice_cloning_key) {
              const isSpeechify = isSpeechifyVoiceId(assignedTwin.voice_cloning_key);
              voiceToUse = { 
                name: assignedTwin.name,
                speechifyVoiceId: isSpeechify ? assignedTwin.voice_cloning_key : undefined,
                voiceCloningKey: !isSpeechify ? assignedTwin.voice_cloning_key : undefined
              };
            }
          }
        }
      }
      
      // Fallback to selected twins if no story bible assignment
      if (!voiceToUse) {
        const twinWithVoice = selectedTwins.find(t => t.voice_cloning_key);
        if (twinWithVoice?.voice_cloning_key) {
          const isSpeechify = isSpeechifyVoiceId(twinWithVoice.voice_cloning_key);
          voiceToUse = { 
            name: twinWithVoice.name, 
            speechifyVoiceId: isSpeechify ? twinWithVoice.voice_cloning_key : undefined,
            voiceCloningKey: !isSpeechify ? twinWithVoice.voice_cloning_key : undefined
          };
        }
      }
      
      toast({
        title: voiceToUse ? "Generating Cloned Voice Audio" : "Generating Audio",
        description: voiceToUse 
          ? `Creating voiceover using ${voiceToUse.name}'s cloned voice...`
          : "Creating voiceover for the scene...",
      });

      console.log('TTS request with voice:', voiceToUse);
      const { data: ttsData, error: ttsError } = await supabase.functions.invoke('text-to-speech', {
        body: { 
          text: textForAudio, 
          voice: 'en-US-Journey-D',
          speechifyVoiceId: voiceToUse?.speechifyVoiceId || undefined,
          voiceCloningKey: voiceToUse?.voiceCloningKey || undefined
        }
      });

      if (ttsError) throw ttsError;

      toast({
        title: "Generating Video",
        description: voiceToUse 
          ? `Creating lip-synced video with ${voiceToUse.name}'s voice...`
          : "Creating lip-synced video using default voice...",
      });

      // Generate video with lip sync using InfiniteTalk model
      const { data: videoData, error: videoError } = await supabase.functions.invoke('wavespeed-video', {
        body: {
          action: 'create',
          model: 'infinitetalk',
          imageUrls: [imageToUse],
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

  // Generate transition video using keyframe interpolation (start → end frame) WITH audio/dialogue
  const generateTransitionVideo = async (sceneNumber: number) => {
    const scene = scenes.find(s => s.sceneNumber === sceneNumber);
    
    if (!scene?.startFrame?.generatedImage || !scene?.endFrame?.generatedImage) {
      toast({
        title: "Both Frames Required",
        description: "Please generate both start and end frame images first.",
        variant: "destructive"
      });
      return;
    }

    setGeneratingVideoFor(sceneNumber);
    try {
      // STEP 1: Check if dialogue is conversation-style (array) or single narrator
      const isConversationDialogue = Array.isArray(scene.dialogue) && scene.dialogue.length > 0;
      
      let audioContent: string | null = null;
      let estimatedDuration = 5;

      if (isConversationDialogue && scene.dialogue && Array.isArray(scene.dialogue)) {
        // MULTI-VOICE: Generate separate audio for each character
        toast({
          title: "Generating Multi-Voice Audio",
          description: `Creating conversation audio for ${scene.dialogue.length} dialogue lines...`,
        });

        // Build voice assignments from story bible
        const voiceAssignments: Array<{
          characterName: string;
          speechifyVoiceId?: string;
          voiceCloningKey?: string;
          defaultVoice?: string;
        }> = [];

        if (storyBible?.characters) {
          for (const char of storyBible.characters) {
            if (char.assignedTwinId) {
              const twin = aiTwins.find(t => t.id === char.assignedTwinId);
              if (twin?.voice_cloning_key) {
                const isSpeechify = isSpeechifyVoiceId(twin.voice_cloning_key);
                voiceAssignments.push({
                  characterName: char.name,
                  speechifyVoiceId: isSpeechify ? twin.voice_cloning_key : undefined,
                  voiceCloningKey: !isSpeechify ? twin.voice_cloning_key : undefined,
                  defaultVoice: char.role === 'protagonist' ? 'en-US-Journey-D' : 'en-US-Journey-F'
                });
              }
            }
          }
        }

        // Also add selected twins as fallback assignments
        for (const twin of selectedTwins) {
          if (twin.voice_cloning_key && !voiceAssignments.find(v => v.characterName.toLowerCase() === twin.name.toLowerCase())) {
            const isSpeechify = isSpeechifyVoiceId(twin.voice_cloning_key);
            voiceAssignments.push({
              characterName: twin.name,
              speechifyVoiceId: isSpeechify ? twin.voice_cloning_key : undefined,
              voiceCloningKey: !isSpeechify ? twin.voice_cloning_key : undefined
            });
          }
        }

        console.log('Voice assignments for multi-voice TTS:', voiceAssignments);

        // Call multi-voice TTS
        const { data: multiVoiceData, error: multiVoiceError } = await supabase.functions.invoke('multi-voice-tts', {
          body: {
            dialogue: scene.dialogue,
            voiceAssignments,
            defaultVoice: 'en-US-Journey-D'
          }
        });

        if (multiVoiceError) {
          console.error('Multi-voice TTS error:', multiVoiceError);
          throw new Error('Failed to generate multi-voice audio');
        }

        audioContent = multiVoiceData.audioContent;
        
        // Estimate duration based on total word count
        const totalWords = scene.dialogue.reduce((acc, d) => acc + (d.line?.split(/\s+/).length || 0), 0);
        estimatedDuration = Math.max(5, Math.min(30, Math.ceil(totalWords / 2.5)));
        
        console.log(`Multi-voice audio generated: ${multiVoiceData.lineCount} lines, ~${estimatedDuration}s`);
        
      } else {
        // SINGLE VOICE: Generate audio for narrator/single character
        let dialogueText = '';
        if (scene.dialogue) {
          if (Array.isArray(scene.dialogue)) {
            dialogueText = scene.dialogue.map(d => d.line).join(' ');
          } else {
            dialogueText = scene.dialogue;
          }
        }
        
        // If no dialogue, generate it first
        if (!dialogueText) {
          const characterName = selectedTwins.length > 0 ? selectedTwins.map(t => t.name).join(' & ') : selectedCharacter?.name;
          
          toast({
            title: "Generating Dialogue",
            description: `Creating dialogue for Scene ${sceneNumber}...`,
          });

          const sceneContext = {
            sceneDescription: scene.description,
            sceneTitle: scene.title,
            location: scene.location,
            timeOfDay: scene.timeOfDay,
            characterName,
            tone: 'natural'
          };

          const { data: dialogueData, error: dialogueError } = await supabase.functions.invoke('generate-scene-dialogue', {
            body: { ...sceneContext, isMainCharacter: true }
          });

          if (!dialogueError && dialogueData?.dialogue) {
            dialogueText = dialogueData.dialogue;
            setScenes(prevScenes => 
              prevScenes.map(s => 
                s.sceneNumber === sceneNumber 
                  ? { ...s, dialogue: dialogueText }
                  : s
              )
            );
          } else {
            dialogueText = "This is my moment. I need to make it count.";
          }
        }
        
        // Clean dialogue text
        dialogueText = cleanDialogueForTTS(dialogueText);

        // Determine voice to use
        let voiceToUse: { name: string; speechifyVoiceId?: string; voiceCloningKey?: string } | null = null;
        
        if (storyBible?.characters) {
          const protagonist = storyBible.characters.find(c => c.role === 'protagonist');
          if (protagonist?.assignedTwinId) {
            const assignedTwin = aiTwins.find(t => t.id === protagonist.assignedTwinId);
            if (assignedTwin?.voice_cloning_key) {
              const isSpeechify = isSpeechifyVoiceId(assignedTwin.voice_cloning_key);
              voiceToUse = { 
                name: assignedTwin.name,
                speechifyVoiceId: isSpeechify ? assignedTwin.voice_cloning_key : undefined,
                voiceCloningKey: !isSpeechify ? assignedTwin.voice_cloning_key : undefined
              };
            }
          }
        }
        
        if (!voiceToUse) {
          const twinWithVoice = selectedTwins.find(t => t.voice_cloning_key);
          if (twinWithVoice?.voice_cloning_key) {
            const isSpeechify = isSpeechifyVoiceId(twinWithVoice.voice_cloning_key);
            voiceToUse = { 
              name: twinWithVoice.name, 
              speechifyVoiceId: isSpeechify ? twinWithVoice.voice_cloning_key : undefined,
              voiceCloningKey: !isSpeechify ? twinWithVoice.voice_cloning_key : undefined
            };
          }
        }
        
        toast({
          title: voiceToUse ? `Using ${voiceToUse.name}'s Voice` : "Generating Audio",
          description: "Creating voiceover for the scene...",
        });

        const { data: ttsData, error: ttsError } = await supabase.functions.invoke('text-to-speech', {
          body: { 
            text: dialogueText, 
            voice: 'en-US-Journey-D',
            speechifyVoiceId: voiceToUse?.speechifyVoiceId || undefined,
            voiceCloningKey: voiceToUse?.voiceCloningKey || undefined
          }
        });

        if (ttsError) throw ttsError;
        audioContent = ttsData.audioContent;
        
        const wordCount = dialogueText.split(/\s+/).length;
        estimatedDuration = Math.max(5, Math.min(30, Math.ceil(wordCount / 2.5)));
      }

      // STEP 2: Generate the transition video with keyframe interpolation
      toast({
        title: "Generating Cinematic Transition",
        description: `Creating ${estimatedDuration}s video with camera movement and action...`,
      });

      // Build CINEMATIC video prompt with detailed camera and action instructions
      const startAngle = scene.startFrame?.cameraAngle || 'eye-level';
      const endAngle = scene.endFrame?.cameraAngle || 'eye-level';
      const startPos = scene.startFrame?.position || '';
      const endPos = scene.endFrame?.position || '';
      
      // Build cinematic prompt parts
      const promptParts: string[] = [];
      
      // Add scene action/transition
      if (scene.transitionAction) {
        promptParts.push(scene.transitionAction);
      } else if (scene.description) {
        promptParts.push(scene.description);
      }
      
      // Add character movement if positions change
      if (startPos && endPos && startPos !== endPos) {
        promptParts.push(`Character moves from ${startPos} to ${endPos}`);
      }
      
      // Add camera angle transition if different
      if (startAngle !== endAngle) {
        promptParts.push(`Camera transitions from ${startAngle} to ${endAngle}`);
      }
      
      // Add camera movement instructions with detailed descriptions
      if (scene.transitionCameraMovement) {
        const movementDescriptions: Record<string, string> = {
          'static': 'Camera remains completely still, steady frame',
          'tracking': 'Camera tracks horizontally, following subject movement smoothly',
          'push-in': 'Camera pushes in toward subject, dolly movement creating intensity',
          'pull-out': 'Camera pulls back from subject, revealing more of the scene',
          'pan': 'Camera pans horizontally, rotating to follow action',
          'tilt': 'Camera tilts vertically, revealing scene from top to bottom or vice versa',
          'crane-up': 'Camera cranes upward, rising to reveal establishing shot',
          'crane-down': 'Camera descends from high angle to eye level',
          'orbit': 'Camera orbits around the subject in a dramatic arc',
          'handheld': 'Handheld camera movement, natural documentary style shaking',
          'steadicam': 'Smooth gliding steadicam movement through the scene',
          'zoom-in': 'Dramatic lens zoom toward subject, tightening frame',
          'zoom-out': 'Lens zooms out, widening the frame to reveal context'
        };
        const movementDesc = movementDescriptions[scene.transitionCameraMovement] || scene.transitionCameraMovement;
        promptParts.push(`Camera movement: ${movementDesc}`);
      }
      
      // Add mood/lighting context
      if (scene.mood) {
        promptParts.push(`Mood: ${scene.mood}`);
      }
      if (scene.selectedLighting) {
        promptParts.push(`Lighting: ${scene.selectedLighting}`);
      }
      
      // Combine into cinematic video prompt
      const videoPrompt = promptParts.length > 0 
        ? promptParts.join('. ') + '. Cinematic quality, smooth motion, professional cinematography.'
        : 'Smooth cinematic transition between keyframes. Professional film quality.';
      
      console.log('Cinematic video prompt:', videoPrompt);
      
      // Use ByteDance Seedance V1 Lite I2V 720p for the visual transition (start→end frame)
      const { data: videoData, error: videoError } = await supabase.functions.invoke('wavespeed-video', {
        body: {
          action: 'create',
          model: 'seedance-i2v',
          startFrameUrl: scene.startFrame.generatedImage,
          endFrameUrl: scene.endFrame.generatedImage,
          prompt: videoPrompt,
          duration: estimatedDuration,
          aspectRatio: '16:9'
        }
      });

      if (videoError) throw videoError;

      // Update scene with task ID
      setScenes(prevScenes => 
        prevScenes.map(s => 
          s.sceneNumber === sceneNumber 
            ? { ...s, videoTaskId: videoData.taskId, transitionAudioContent: audioContent }
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
          // Video is ready - store the video URL
          // Note: Audio merging with video would require additional processing
          // For now, store both separately and the user can combine them if needed
          setScenes(prevScenes => {
            const updated = prevScenes.map(s => 
              s.sceneNumber === sceneNumber 
                ? { ...s, generatedVideo: statusData.videoUrl }
                : s
            );
            // Auto-save after video generation
            setTimeout(() => autoSaveProject(updated), 500);
            return updated;
          });
          setGeneratingVideoFor(null);
          
          toast({
            title: "Transition Video Ready!",
            description: `Scene ${sceneNumber} keyframe transition video is complete.`,
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
      console.error('Error generating transition video:', error);
      toast({
        title: "Transition Video Failed",
        description: error.message || "Failed to generate transition video. Please try again.",
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
      // Fix #2: Load story bible from saved project
      setStoryBible((data as any).story_bible || null);

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
    // Collect videos and their corresponding audio
    const scenesWithVideos = scenes.filter(scene => scene.generatedVideo);
    const videosToStitch = scenesWithVideos.map(scene => scene.generatedVideo as string);
    
    // Fix #1: Collect audio for each scene (transitionAudioContent is base64)
    const audiosToStitch = scenesWithVideos
      .map(scene => (scene as any).transitionAudioContent)
      .filter(Boolean)
      .map(audioBase64 => `data:audio/mp3;base64,${audioBase64}`);

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
        description: `Combining ${videosToStitch.length} scene videos${audiosToStitch.length > 0 ? ` with ${audiosToStitch.length} audio tracks` : ''}. This may take a few minutes...`,
      });

      // Fix #1: Stitch videos WITH audio using the enhanced function
      const stitchedBlob = await stitchVideosWithAudio({
        videoUrls: videosToStitch,
        audioUrls: audiosToStitch.length > 0 ? audiosToStitch : undefined,
        onProgress: (progress) => {
          setStitchProgress(progress);
        }
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

            {/* Action Buttons */}
            <div className="flex items-center gap-2">
              <CommercialTemplateSelector onApplyTemplate={applyCommercialTemplate} />
              
              <StoryboardExport 
                scenes={scenes as MovieSceneWithKeyframes[]} 
                projectTitle={projectTitle || 'Movie Storyboard'} 
              />
              
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

        {/* AI Twins Panel - Now supports multiple */}
        {selectedTwins.length > 0 && (
          <Card className="border-primary bg-gradient-to-r from-primary/5 to-primary/10">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <User className="w-5 h-5 text-primary" />
                  Starring: {selectedTwins.map(t => t.name).join(' & ')}
                </CardTitle>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => setSelectedTwins([])}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
              <CardDescription>
                {selectedTwins.length === 1 
                  ? "This AI Twin will be featured in your movie with their cloned voice and reference images."
                  : `These ${selectedTwins.length} AI Twins will star together in your movie.`}
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="flex flex-wrap gap-4">
                {selectedTwins.map((twin, idx) => (
                  <div key={twin.id} className="flex items-start gap-3 p-2 rounded-lg bg-background/50">
                    {/* Reference Images */}
                    <div className="flex -space-x-2">
                      {twin.reference_images?.slice(0, 3).map((img, imgIdx) => (
                        <img 
                          key={imgIdx}
                          src={img}
                          alt={`Reference ${imgIdx + 1}`}
                          className="w-10 h-10 rounded-full border-2 border-background object-cover"
                        />
                      ))}
                    </div>

                    {/* Twin Info */}
                    <div className="space-y-1">
                      <p className="font-medium text-sm">{twin.name}</p>
                      <div className="flex items-center gap-1 flex-wrap">
                        {twin.voice_cloning_key ? (
                          <Button
                            variant="default"
                            size="sm"
                            className="h-5 text-[10px] px-1.5 gap-0.5"
                            onClick={() => previewTwinVoice(twin)}
                            disabled={previewingVoiceFor === twin.id}
                          >
                            {previewingVoiceFor === twin.id ? (
                              <Loader2 className="w-2.5 h-2.5 animate-spin" />
                            ) : (
                              <Volume2 className="w-2.5 h-2.5" />
                            )}
                            {previewingVoiceFor === twin.id ? "Playing..." : "Preview Voice"}
                          </Button>
                        ) : (
                          <Badge variant="secondary" className="text-[10px]">
                            <Volume2 className="w-2.5 h-2.5 mr-0.5" />
                            No Voice
                          </Badge>
                        )}
                        <Badge variant="outline" className="text-[10px]">
                          <ImageIcon className="w-2.5 h-2.5 mr-0.5" />
                          {twin.reference_images?.length || 0}
                        </Badge>
                        {twin.gender && (
                          <Badge variant="outline" className="text-[10px] capitalize">
                            {twin.gender}
                          </Badge>
                        )}
                      </div>
                    </div>

                    {/* Remove single twin */}
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="h-6 w-6 p-0"
                      onClick={() => setSelectedTwins(prev => prev.filter(t => t.id !== twin.id))}
                    >
                      <X className="w-3 h-3" />
                    </Button>
                  </div>
                ))}
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
                      {aiTwins.map(twin => {
                        const isSelected = selectedTwins.some(t => t.id === twin.id);
                        return (
                          <div
                            key={twin.id}
                            onClick={() => {
                              toggleTwinSelection(twin);
                            }}
                            className={`cursor-pointer p-2 rounded-lg border transition-all ${
                              isSelected 
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
                                  {twin.voice_cloning_key && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-5 w-5 p-0"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        previewTwinVoice(twin);
                                      }}
                                      disabled={previewingVoiceFor === twin.id}
                                    >
                                      {previewingVoiceFor === twin.id ? (
                                        <Loader2 className="w-3 h-3 animate-spin text-primary" />
                                      ) : (
                                        <Volume2 className="w-3 h-3 text-primary" />
                                      )}
                                    </Button>
                                  )}
                                  {isSelected && (
                                    <Badge variant="default" className="text-[10px] px-1 py-0">✓</Badge>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
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
                            setSelectedTwins([]);
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
                            setSelectedTwins([]);
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
              {(selectedTwins.length > 0 || selectedCharacter || selectedGalleryImage) && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setSelectedTwins([]);
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
              
              {/* Movie Length Selector */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Movie Length</Label>
                <Select value={movieLength} onValueChange={setMovieLength}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select movie length" />
                  </SelectTrigger>
                  <SelectContent>
                    {MOVIE_LENGTH_OPTIONS.map(option => (
                      <SelectItem key={option.value} value={option.value}>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{option.label}</span>
                          <span className="text-xs text-muted-foreground">({option.description})</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {MOVIE_LENGTH_OPTIONS.find(o => o.value === movieLength)?.description || 'Select a format'}
                </p>
              </div>

              {/* Generate All Button - One-Click Workflow */}
              {selectedTwins.length >= 1 && (
                <Button
                  onClick={generateAll}
                  disabled={isGeneratingAll || !movieIdea.trim()}
                  className="w-full bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70"
                  size="lg"
                >
                  {isGeneratingAll ? (
                    <div className="flex items-center gap-3 w-full">
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <div className="flex-1 text-left">
                        <p className="font-medium">{generateAllStep}</p>
                        <Progress value={generateAllProgress} className="h-1.5 mt-1" />
                      </div>
                      <span className="text-sm">{generateAllProgress}%</span>
                    </div>
                  ) : (
                    <>
                      <Wand2 className="w-5 h-5 mr-2" />
                      Generate Complete Movie
                    </>
                  )}
                </Button>
              )}
              
              {selectedTwins.length === 0 && (
                <div className="p-3 bg-muted/50 rounded-lg border border-dashed text-center">
                  <p className="text-sm text-muted-foreground">
                    Select AI Twins above to enable one-click movie generation
                  </p>
                </div>
              )}

              <div className="flex items-center gap-2">
                <div className="flex-1 h-px bg-border" />
                <span className="text-xs text-muted-foreground px-2">or step by step</span>
                <div className="flex-1 h-px bg-border" />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <Button
                  onClick={generateStoryBible}
                  disabled={isGeneratingStoryBible || !movieIdea.trim() || isGeneratingAll}
                  variant="outline"
                  size="sm"
                  className="w-full"
                >
                  {isGeneratingStoryBible ? (
                    <>
                      <Sparkles className="w-4 h-4 mr-2 animate-spin" />
                      Story Bible...
                    </>
                  ) : (
                    <>
                      <User className="w-4 h-4 mr-2" />
                      Story Bible
                    </>
                  )}
                </Button>
                <Button
                  onClick={generateOutline}
                  disabled={isGenerating || !movieIdea.trim() || isGeneratingAll}
                  variant="outline"
                  size="sm"
                  className="w-full"
                >
                  {isGenerating ? (
                    <>
                      <Sparkles className="w-4 h-4 mr-2 animate-spin" />
                      Outline...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 mr-2" />
                      Generate Outline
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Story Bible Card (when generated) */}
          {storyBible && (
            <Card className="border-primary/30 bg-gradient-to-br from-primary/5 to-transparent">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <User className="w-5 h-5 text-primary" />
                    Story Bible
                  </CardTitle>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowStoryBibleEditor(!showStoryBibleEditor)}
                  >
                    {showStoryBibleEditor ? 'Collapse' : 'Expand'}
                  </Button>
                </div>
                <CardDescription>
                  {storyBible.logline}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Characters Grid */}
                <div>
                  <Label className="text-sm font-semibold mb-2 block">Characters ({storyBible.characters.length})</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {storyBible.characters.map((char, idx) => (
                      <div key={idx} className="p-2 bg-muted/50 rounded-lg border">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant={char.role === 'protagonist' ? 'default' : 'secondary'} className="capitalize text-xs">
                            {char.role}
                          </Badge>
                          <span className="font-medium text-sm">{char.name}</span>
                          {char.assignedTwinName && (
                            <Badge variant="outline" className="text-[10px] gap-1">
                              <Volume2 className="w-2.5 h-2.5" />
                              {char.assignedTwinName}
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground line-clamp-1">{char.wardrobe}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {showStoryBibleEditor && (
                  <>
                    {/* Three Act Structure */}
                    <div className="space-y-2">
                      <Label className="text-sm font-semibold">Three-Act Structure</Label>
                      <div className="grid grid-cols-3 gap-2 text-xs">
                        <div className="p-2 bg-green-500/10 rounded border border-green-500/20">
                          <p className="font-medium text-green-600">Setup</p>
                          <p className="text-muted-foreground line-clamp-3">{storyBible.threeActStructure.setup}</p>
                        </div>
                        <div className="p-2 bg-yellow-500/10 rounded border border-yellow-500/20">
                          <p className="font-medium text-yellow-600">Confrontation</p>
                          <p className="text-muted-foreground line-clamp-3">{storyBible.threeActStructure.confrontation}</p>
                        </div>
                        <div className="p-2 bg-red-500/10 rounded border border-red-500/20">
                          <p className="font-medium text-red-600">Resolution</p>
                          <p className="text-muted-foreground line-clamp-3">{storyBible.threeActStructure.resolution}</p>
                        </div>
                      </div>
                    </div>

                    {/* Character Details */}
                    <div className="space-y-2">
                      <Label className="text-sm font-semibold">Character Wardrobes (Consistent Throughout)</Label>
                      <div className="space-y-3 max-h-60 overflow-y-auto">
                        {storyBible.characters.map((char, idx) => (
                          <div key={idx} className="p-3 bg-muted/30 rounded-lg border text-sm">
                            <div className="flex items-center gap-2 mb-2">
                              <span className="font-medium">{char.name}</span>
                              <Badge variant="outline" className="text-xs capitalize">{char.role}</Badge>
                            </div>
                            <p className="text-xs mb-1"><span className="font-medium">Appearance:</span> {char.appearance}</p>
                            <p className="text-xs text-primary mb-1"><span className="font-medium">Wardrobe:</span> {char.wardrobe}</p>
                            <p className="text-xs text-muted-foreground mb-2"><span className="font-medium">Voice Style:</span> {char.voiceStyle}</p>
                            
                            {/* Voice Assignment Dropdown */}
                            <div className="flex items-center gap-2 pt-2 border-t border-border">
                              <Volume2 className="w-4 h-4 text-primary" />
                              <Select
                                value={char.assignedTwinId || 'default'}
                                onValueChange={(value) => {
                                  const twin = aiTwins.find(t => t.id === value);
                                  setStoryBible(prev => {
                                    if (!prev) return prev;
                                    const updatedCharacters = [...prev.characters];
                                    updatedCharacters[idx] = {
                                      ...updatedCharacters[idx],
                                      assignedTwinId: value === 'default' ? undefined : value,
                                      assignedTwinName: twin?.name,
                                      assignedVoiceCloningKey: twin?.voice_cloning_key || undefined
                                    };
                                    return { ...prev, characters: updatedCharacters };
                                  });
                                }}
                              >
                                <SelectTrigger className="h-8 text-xs flex-1">
                                  <SelectValue placeholder="Assign voice..." />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="default">
                                    <span className="flex items-center gap-2">
                                      <Volume2 className="w-3 h-3" />
                                      Default AI Voice
                                    </span>
                                  </SelectItem>
                                  {aiTwins.filter(t => t.voice_cloning_key).map(twin => (
                                    <SelectItem key={twin.id} value={twin.id}>
                                      <span className="flex items-center gap-2">
                                        {twin.reference_images?.[0] && (
                                          <img 
                                            src={twin.reference_images[0]} 
                                            alt={twin.name}
                                            className="w-4 h-4 rounded-full object-cover"
                                          />
                                        )}
                                        {twin.name}'s Voice
                                      </span>
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              {char.assignedTwinName && (
                                <Badge variant="default" className="text-[10px]">
                                  {char.assignedTwinName}
                                </Badge>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          )}

          {/* Location Manager */}
          {outline && (
            <LocationManager
              locations={locations}
              onLocationsChange={setLocations}
              outline={outline}
              onExtractLocations={extractLocationsFromOutline}
              isExtracting={isExtractingLocations}
            />
          )}

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
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h2 className="text-2xl font-bold text-foreground">Generated Scenes</h2>
              <div className="flex items-center gap-2">
                <Button
                  onClick={regenerateAllDialogue}
                  disabled={isRegeneratingDialogue}
                  variant="outline"
                  size="sm"
                  className="gap-2"
                >
                  {isRegeneratingDialogue ? (
                    <>
                      <Sparkles className="w-4 h-4 animate-spin" />
                      Regenerating...
                    </>
                  ) : (
                    <>
                      <Volume2 className="w-4 h-4" />
                      Regenerate All Dialogue (30s+)
                    </>
                  )}
                </Button>
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

            {/* Scene Timeline */}
            <SceneTimeline
              scenes={scenes as MovieSceneWithKeyframes[]}
              activeSceneIndex={activeSceneIndex}
              onSelectScene={setActiveSceneIndex}
              autoLinkEnabled={autoLinkScenes}
              onToggleAutoLink={() => setAutoLinkScenes(!autoLinkScenes)}
            />

            {/* Keyframe Scene Cards */}
            <div className="space-y-4">
              {scenes.map((scene, index) => {
                // Get characters in this scene from story bible
                const charactersInScene = storyBible?.sceneDialogueMap?.find(
                  s => s.sceneNumber === scene.sceneNumber
                )?.charactersPresent || 
                (scene.charactersInScene || []);
                
                const sceneCoverage = sceneCoverages.get(scene.sceneNumber);
                const sceneBlocking = sceneBlockings.get(scene.sceneNumber) || [];
                
                return (
                  <div key={scene.sceneNumber} className="space-y-2">
                    {/* Coverage & Blocking Controls */}
                    {charactersInScene.length > 0 && (
                      <div className="flex items-center gap-2 px-2">
                        <span className="text-xs text-muted-foreground">Scene {scene.sceneNumber} tools:</span>
                        <CoverageSelector
                          sceneNumber={scene.sceneNumber}
                          sceneTitle={scene.title}
                          charactersInScene={charactersInScene}
                          locationId={locations.find(l => 
                            scene.location?.toLowerCase().includes(l.name.toLowerCase())
                          )?.id}
                          coverage={sceneCoverage}
                          onCoverageChange={updateSceneCoverage}
                          onGenerateCoverage={generateCoverageShots}
                          isGenerating={isGeneratingCoverage}
                        />
                        <CharacterBlockingEditor
                          sceneNumber={scene.sceneNumber}
                          charactersInScene={charactersInScene}
                          blocking={sceneBlocking}
                          onBlockingChange={(blocking) => updateSceneBlocking(scene.sceneNumber, blocking)}
                        />
                        {locations.length > 0 && (
                          <Badge variant="outline" className="text-xs gap-1">
                            <MapPin className="w-3 h-3" />
                            {locations.find(l => 
                              scene.location?.toLowerCase().includes(l.name.toLowerCase())
                            )?.name || 'No location match'}
                          </Badge>
                        )}
                      </div>
                    )}
                    
                    <KeyframeSceneCard
                      scene={{
                        ...scene,
                        startFrame: scene.startFrame || { imagePrompt: '', cameraAngle: 'eye-level', position: '' },
                        endFrame: scene.endFrame || { imagePrompt: '', cameraAngle: 'eye-level', position: '' },
                        transitionAction: scene.transitionAction || '',
                        transitionCameraMovement: scene.transitionCameraMovement || 'static',
                        dialogue: typeof scene.dialogue === 'string' ? scene.dialogue : 
                                  Array.isArray(scene.dialogue) ? scene.dialogue.map(d => d.line).join('\n') : null
                      } as MovieSceneWithKeyframes}
                      sceneIndex={index}
                      totalScenes={scenes.length}
                      isGeneratingImage={generatingImageFor === scene.sceneNumber || 
                        (generatingFrameFor?.sceneNumber === scene.sceneNumber)}
                      isGeneratingVideo={generatingVideoFor === scene.sceneNumber}
                      isDescribingScene={describingSceneFor?.sceneNumber === scene.sceneNumber}
                      characterName={selectedTwins.length > 0 ? selectedTwins[0]?.name : selectedCharacter?.name}
                      secondCharacterName={selectedTwins.length > 1 ? selectedTwins[1]?.name : undefined}
                      onUpdateScene={(sceneNum, updates) => {
                        setScenes(prev => prev.map(s => 
                          s.sceneNumber === sceneNum ? { ...s, ...updates } : s
                        ));
                      }}
                      onUpdateKeyframe={updateKeyframe}
                      onGenerateStartImage={(sceneNum) => generateKeyframeImage(sceneNum, 'start')}
                      onGenerateEndImage={(sceneNum) => generateKeyframeImage(sceneNum, 'end')}
                      onGenerateVideo={generateLipSyncVideo}
                      onGenerateTransitionVideo={generateTransitionVideo}
                      onGenerateDialogue={generateDialogue}
                      onDescribeScene={describeScene}
                      onDescribeAndGenerate={describeAndGenerateScene}
                      onDuplicate={duplicateScene}
                      onDelete={deleteScene}
                      onLinkToPreviousScene={linkToPreviousScene}
                      previousSceneEndFrame={index > 0 ? scenes[index - 1]?.endFrame : undefined}
                    />
                  </div>
                );
              })}
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
