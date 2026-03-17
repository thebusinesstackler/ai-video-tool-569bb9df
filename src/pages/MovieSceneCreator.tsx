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
import { Sparkles, Film, ChevronRight, ChevronLeft, ChevronDown, Save, FolderOpen, Trash2, Video, Copy, Star, Wand2, ArrowRight, Camera, Lightbulb, Image, Play, User, Volume2, ImageIcon, X, Music, Link, FileImage, Loader2, MapPin, Check, BookOpen, FileText, Clapperboard, Download, MoreVertical, Pencil, Settings2, Eye } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { convertBase64ToStorageUrl } from '@/lib/imageUtils';
import { sanitizeForTTS } from '@/lib/audioSanitizer';
import { useScriptAutoSave } from '@/hooks/useScriptAutoSave';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { stitchVideosWithAudio } from '@/lib/videoStitch';
import { PeteAIAssistant } from '@/components/PeteAIAssistant';
import { useCreatorMode } from '@/hooks/useCreatorMode';
import { CreatorModeToggle } from '@/components/CreatorModeToggle';
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
  voice_engine?: string | null;
  google_voice_id?: string | null;
}

// Helper to clean dialogue text - remove stage directions and sanitize for TTS
const cleanDialogueForTTS = (text: string): string => {
  return sanitizeForTTS(text);
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
  const [isPreviewingBeforeVideo, setIsPreviewingBeforeVideo] = useState(false);
  const [pendingVideoGeneration, setPendingVideoGeneration] = useState<MovieScene[] | null>(null);
  const [showRecoveryBanner, setShowRecoveryBanner] = useState(false);
  const [recoveryProjectId, setRecoveryProjectId] = useState<string | null>(null);
  
  // Wizard step state
  const [currentStep, setCurrentStep] = useState(0);
  
  const { toast } = useToast();
  const { mode: creatorMode, setMode: setCreatorMode, isAdvanced, isBeginner } = useCreatorMode();

  // ── Debounced auto-save for movie projects ──
  const autoSaveField = useScriptAutoSave({ table: 'movie_projects', id: currentProjectId });

  // Auto-save outline and movieIdea on change (only when authenticated)
  useEffect(() => {
    if (currentProjectId && outline && userId) {
      autoSaveField({ outline });
    }
  }, [outline, currentProjectId, userId]);

  useEffect(() => {
    if (currentProjectId && movieIdea && userId) {
      autoSaveField({ movie_idea: movieIdea });
    }
  }, [movieIdea, currentProjectId, userId]);

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
  // Pass current scenes explicitly to avoid stale closure issues
  useEffect(() => {
    if (!userId) return;
    if (!scenes.length && !outline) return;

    const interval = setInterval(() => {
      autoSaveProject(scenes);
    }, 60000); // Auto-save every 60 seconds

    return () => clearInterval(interval);
  }, [userId, scenes, outline, currentProjectId, movieIdea, projectTitle, storyBible]);

  // Request notification permission on mount
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  // Check for interrupted generation on mount
  useEffect(() => {
    if (!userId) return;
    const saved = localStorage.getItem('movie-generation-active');
    if (saved) {
      try {
        const { projectId } = JSON.parse(saved);
        if (projectId) {
          // Auto-recover immediately so user never loses their work
          setRecoveryProjectId(projectId);
          setShowRecoveryBanner(true);
        }
      } catch { /* ignore */ }
    }

    // Also check for the most recent draft if no generation was interrupted
    if (!saved) {
      loadMostRecentDraft();
    }
  }, [userId]);

  // Load the most recent in-progress project as a draft
  const loadMostRecentDraft = async () => {
    if (!userId) return;
    try {
      const { data, error } = await supabase
        .from('movie_projects')
        .select('*')
        .eq('user_id', userId)
        .order('updated_at', { ascending: false })
        .limit(1);

      if (error || !data?.length) return;

      const project = data[0];
      // Only auto-restore if the project was updated recently (within last 24 hours) and has content
      const updatedAt = new Date(project.updated_at).getTime();
      const isRecent = Date.now() - updatedAt < 24 * 60 * 60 * 1000;
      const hasContent = project.movie_idea && (project.outline || (project.scenes as any[])?.length > 0);

      if (isRecent && hasContent && !currentProjectId) {
        setRecoveryProjectId(project.id);
        setShowRecoveryBanner(true);
      }
    } catch (err) {
      console.error('Failed to check for recent drafts:', err);
    }
  };

  // Helper to save/clear generation tracking
  const trackGenerationStart = (projectId: string) => {
    localStorage.setItem('movie-generation-active', JSON.stringify({ projectId, startedAt: Date.now() }));
  };
  const trackGenerationEnd = () => {
    localStorage.removeItem('movie-generation-active');
  };

  // Send browser notification
  const sendNotification = (title: string, body: string) => {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(title, { body, icon: '/favicon.ico' });
    }
  };

  // Recover interrupted project
  const recoverProject = async () => {
    if (!recoveryProjectId) return;
    setShowRecoveryBanner(false);
    trackGenerationEnd();
    
    try {
      const { data, error } = await supabase
        .from('movie_projects')
        .select('*')
        .eq('id', recoveryProjectId)
        .single();

      if (error) throw error;

      setCurrentProjectId(data.id);
      setProjectTitle(data.title);
      setMovieIdea(data.movie_idea);
      setOutline(data.outline || '');
      const loadedScenes = (data.scenes as any) || [];
      setScenes(loadedScenes);
      setStitchedVideoUrl((data as any).stitched_video_url || null);
      setStoryBible((data as any).story_bible || null);

      // ── Determine which wizard step to restore to ──
      if (loadedScenes.length > 0) {
        setCurrentStep(3);
        // Check if project has scenes with images but no videos — offer to continue
        const hasUnfinishedScenes = loadedScenes.some((s: any) => 
          (s.startFrame?.generatedImage || s.generatedImage) && !s.generatedVideo
        );
        if (hasUnfinishedScenes) {
          setIsPreviewingBeforeVideo(true);
          setPendingVideoGeneration(loadedScenes);
        }
      } else if (data.outline) {
        setCurrentStep(2);
      } else if ((data as any).story_bible) {
        setCurrentStep(1);
      } else {
        setCurrentStep(0);
      }

      toast({
        title: "Project Restored",
        description: `"${data.title}" loaded — pick up where you left off.`,
      });
    } catch (error: any) {
      console.error('Error recovering project:', error);
      toast({
        title: "Recovery Failed",
        description: "Couldn't load the project.",
        variant: "destructive"
      });
    }
  };

  const dismissRecovery = () => {
    setShowRecoveryBanner(false);
    setRecoveryProjectId(null);
    trackGenerationEnd();
  };

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
        .select('id, name, reference_images, voice_cloning_key, description, face_description, gender, voice_engine, google_voice_id')
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
      setCurrentStep(3); // Auto-advance to Scenes step
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

  // Helper: generate video for a scene and wait for completion
  // Detects multi-character dialogue and uses multi-voice TTS + image-to-video instead of single lip-sync
  const generateSceneVideoAndWait = async (scene: any, scenesSnapshot: any[]): Promise<{ videoUrl: string; audioContent?: string }> => {
    const imageToUse = scene.startFrame?.generatedImage || scene.generatedImage;
    if (!imageToUse) throw new Error(`Scene ${scene.sceneNumber} has no image`);

    const isConversation = Array.isArray(scene.dialogue) && scene.dialogue.length > 1;
    let audioContent: string | null = null;
    let estimatedDuration = 5;

    if (isConversation) {
      // ===== MULTI-CHARACTER DIALOGUE: Use multi-voice TTS =====
      const voiceAssignments: Array<{
        characterName: string;
        speechifyVoiceId?: string;
        voiceCloningKey?: string;
        defaultVoice?: string;
        gender?: string;
        voiceEngine?: string;
        googleVoiceId?: string;
      }> = [];

      if (storyBible?.characters) {
        for (const char of storyBible.characters) {
          if (char.assignedTwinId) {
            const twin = aiTwins.find(t => t.id === char.assignedTwinId);
            if (twin) {
              const isSpeechify = twin.voice_cloning_key ? isSpeechifyVoiceId(twin.voice_cloning_key) : false;
              voiceAssignments.push({
                characterName: char.name,
                speechifyVoiceId: (twin.voice_cloning_key && isSpeechify) ? twin.voice_cloning_key : undefined,
                voiceCloningKey: (twin.voice_cloning_key && !isSpeechify) ? twin.voice_cloning_key : undefined,
                gender: twin.gender || undefined,
                voiceEngine: twin.voice_engine || undefined,
                googleVoiceId: twin.google_voice_id || undefined,
              });
            }
          }
        }
      }

      // Also add any selected twins not already in voice assignments
      for (const twin of selectedTwins) {
        if (!voiceAssignments.find(v => v.characterName.toLowerCase() === twin.name.toLowerCase())) {
          const isSpeechify = twin.voice_cloning_key ? isSpeechifyVoiceId(twin.voice_cloning_key) : false;
          voiceAssignments.push({
            characterName: twin.name,
            speechifyVoiceId: (twin.voice_cloning_key && isSpeechify) ? twin.voice_cloning_key : undefined,
            voiceCloningKey: (twin.voice_cloning_key && !isSpeechify) ? twin.voice_cloning_key : undefined,
            gender: twin.gender || undefined,
            voiceEngine: twin.voice_engine || undefined,
            googleVoiceId: twin.google_voice_id || undefined,
          });
        }
      }

      const { data: multiVoiceData, error: multiVoiceError } = await supabase.functions.invoke('multi-voice-tts', {
        body: {
          dialogue: scene.dialogue,
          voiceAssignments,
        }
      });
      if (multiVoiceError) throw new Error('Failed to generate multi-voice audio');
      
      audioContent = multiVoiceData.audioContent;
      const totalWords = scene.dialogue.reduce((acc: number, d: any) => acc + (d.line?.split(/\s+/).length || 0), 0);
      estimatedDuration = Math.max(5, Math.min(30, Math.ceil(totalWords / 2.5)));

    } else {
      // ===== SINGLE CHARACTER / NARRATOR: Use single-voice TTS =====
      let textForAudio = '';
      if (scene.dialogue) {
        if (Array.isArray(scene.dialogue)) {
          textForAudio = scene.dialogue.map((d: any) => d.line).join(' ');
        } else {
          textForAudio = scene.dialogue;
        }
      }
      textForAudio = cleanDialogueForTTS(textForAudio);
      if (!textForAudio) textForAudio = "This moment is everything. I have to keep going.";

      let voiceParams: any = {};
      // Find the speaking character's twin
      let speakerTwin: AITwin | undefined;
      
      if (storyBible?.characters) {
        const protagonist = storyBible.characters.find(c => c.role === 'protagonist');
        if (protagonist?.assignedTwinId) {
          speakerTwin = aiTwins.find(t => t.id === protagonist.assignedTwinId);
        }
      }
      if (!speakerTwin) {
        speakerTwin = selectedTwins[0];
      }
      
      if (speakerTwin) {
        if (speakerTwin.voice_cloning_key) {
          const isSpeechify = isSpeechifyVoiceId(speakerTwin.voice_cloning_key);
          voiceParams = {
            speechifyVoiceId: isSpeechify ? speakerTwin.voice_cloning_key : undefined,
            voiceCloningKey: !isSpeechify ? speakerTwin.voice_cloning_key : undefined
          };
        } else if (speakerTwin.voice_engine === 'google-cloud' && speakerTwin.google_voice_id) {
          voiceParams = {
            voiceEngine: 'google-cloud',
            googleVoiceId: speakerTwin.google_voice_id
          };
        } else {
          // Use gender-appropriate WaveSpeed voice
          voiceParams = {
            gender: speakerTwin.gender || 'male',
            voice: 'ai-auto'
          };
        }
      }

      const { data: ttsData, error: ttsError } = await supabase.functions.invoke('text-to-speech', {
        body: { text: textForAudio, voice: voiceParams.voice || 'ai-auto', ...voiceParams }
      });
      if (ttsError) throw ttsError;
      audioContent = ttsData.audioContent;

      const wordCount = textForAudio.split(/\s+/).length;
      estimatedDuration = Math.max(5, Math.min(30, Math.ceil(wordCount / 2.5)));
    }

    // Build rich cinematic prompt from scene data
    const buildBatchPrompt = () => {
      const parts: string[] = [];
      const sceneDesc = scene.description || scene.title || '';
      if (sceneDesc) parts.push(sceneDesc);
      if (scene.startFrame?.imagePrompt && scene.endFrame?.imagePrompt) {
        parts.push(`Transitions from: ${scene.startFrame.imagePrompt} to: ${scene.endFrame.imagePrompt}`);
      }
      const startPos = scene.startFrame?.position || '';
      const endPos = scene.endFrame?.position || '';
      if (startPos && endPos && startPos !== endPos) parts.push(`Characters move from ${startPos} to ${endPos}`);
      if (scene.transitionAction) parts.push(scene.transitionAction);
      if (scene.transitionCameraMovement && scene.transitionCameraMovement !== 'static') parts.push(`Camera: ${scene.transitionCameraMovement}`);
      if (scene.mood) parts.push(`Mood: ${scene.mood}`);
      if (isConversation) {
        parts.push('Characters actively gesturing, leaning in, shifting weight, turning heads, using hand gestures, natural body sway and micro-expressions');
      } else {
        parts.push('Character with natural head movement, subtle gestures, expressive face, slight body sway');
      }
      parts.push('Cinematic film quality, smooth natural motion, professional cinematography, dynamic alive scene');
      return parts.join('. ') + '.';
    };

    let videoBody: any;
    if (isConversation) {
      videoBody = {
        action: 'create',
        model: 'wan-2.5-i2v',
        imageUrls: [imageToUse],
        prompt: buildBatchPrompt(),
        duration: Math.min(estimatedDuration, 10),
        aspectRatio: '16:9'
      };
    } else {
      videoBody = {
        action: 'create',
        model: 'infinitetalk',
        imageUrls: [imageToUse],
        audioUrl: `data:audio/mp3;base64,${audioContent}`,
      };
    }

    const { data: videoData, error: videoError } = await supabase.functions.invoke('wavespeed-video', {
      body: videoBody
    });
    if (videoError) throw videoError;

    // Poll for completion
    const maxPollTime = 180000;
    const startTime = Date.now();
    while (true) {
      if (Date.now() - startTime > maxPollTime) throw new Error(`Scene ${scene.sceneNumber} video timed out`);
      await new Promise(r => setTimeout(r, 3000));
      
      const { data: statusData, error: statusError } = await supabase.functions.invoke('wavespeed-video', {
        body: { action: 'status', taskId: videoData.taskId }
      });
      if (statusError) throw statusError;
      if (statusData.status === 'completed' && statusData.videoUrl) {
        return { videoUrl: statusData.videoUrl, audioContent: audioContent || undefined };
      }
      if (statusData.status === 'failed') throw new Error(`Scene ${scene.sceneNumber} video failed`);
    }
  };

  // Helper: ensure project exists in DB (create if needed) and return its ID
  const ensureProjectSaved = async (extraFields: Record<string, any> = {}): Promise<string | null> => {
    if (!userId) return null;
    const title = projectTitle || `Movie: ${movieIdea.slice(0, 50)}...`;
    const projectData: any = {
      user_id: userId,
      title,
      movie_idea: movieIdea,
      outline: outline || '',
      scenes: scenes as any,
      story_bible: storyBible as any,
      updated_at: new Date().toISOString(),
      ...extraFields,
    };

    try {
      if (currentProjectId) {
        await supabase.from('movie_projects').update(projectData).eq('id', currentProjectId);
        return currentProjectId;
      } else {
        const { data, error } = await supabase.from('movie_projects').insert([projectData]).select().single();
        if (error) throw error;
        if (data) {
          setCurrentProjectId(data.id);
          setProjectTitle(title);
          return data.id;
        }
      }
    } catch (err) {
      console.error('ensureProjectSaved failed:', err);
    }
    return currentProjectId;
  };

  // One-click Generate All - chains story bible → outline → scenes → dialogue → images → videos → stitch
  const generateAll = async () => {
    if (!movieIdea.trim()) {
      toast({
        title: "Movie Idea Required",
        description: "Please describe your movie idea first.",
        variant: "destructive"
      });
      return;
    }

    setIsGeneratingAll(true);
    setGenerateAllProgress(0);

    // ── STEP 0: Immediately persist the project so the movie idea is never lost ──
    const savedProjectId = await ensureProjectSaved();
    if (savedProjectId) trackGenerationStart(savedProjectId);

    try {
      // Step 1: Generate Story Bible (5%)
      setGenerateAllStep('Creating Story Bible...');
      setGenerateAllProgress(5);

      let characterDescription = selectedTwins.length > 0
        ? selectedTwins.map(twin => {
            const genderText = twin.gender ? `${twin.gender} ` : '';
            return `${twin.name} (${genderText}character): ${twin.face_description || twin.description || 'No description'}`;
          }).join('\n\n')
        : undefined;

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

      // ── Progressive save: story bible done ──
      await ensureProjectSaved({ story_bible: storyBibleWithVoices });

      // Step 2: Generate Outline (25%)
      setGenerateAllStep('Generating Outline...');
      
      const pronounsDesc = selectedTwins.length > 0
        ? selectedTwins.map(twin => {
            const genderText = twin.gender ? `${twin.gender} ` : '';
            const pronouns = twin.gender === 'female' ? 'she/her' : twin.gender === 'male' ? 'he/him' : 'they/them';
            return `${twin.name} (${genderText}character, pronouns: ${pronouns}): ${twin.face_description || twin.description || 'No description'}`;
          }).join('\n\n')
        : undefined;

      const { data: outlineData, error: outlineError } = await supabase.functions.invoke('generate-movie-outline', {
        body: { movieIdea, characterDescription: pronounsDesc || undefined, movieLength, storyBible: storyBibleWithVoices }
      });

      if (outlineError) throw outlineError;
      setOutline(outlineData.outline);
      setGenerateAllProgress(30);

      // ── Progressive save: outline done ──
      await ensureProjectSaved({ outline: outlineData.outline });

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
      const characterNames = selectedTwins.length > 0 
        ? selectedTwins.map(t => t.name) 
        : (storyBibleWithVoices?.characters?.map((c: any) => c.name) || []);
      
      // Build character personalities from story bible or twin descriptions
      const characterPersonalities: Record<string, string> = {};
      selectedTwins.forEach(twin => {
        characterPersonalities[twin.name] = twin.description || twin.face_description || '';
      });
      if (storyBibleWithVoices?.characters) {
        storyBibleWithVoices.characters.forEach((char: StoryBibleCharacter) => {
          if (!characterPersonalities[char.name]) {
            characterPersonalities[char.name] = `${char.personality}. Arc: ${char.arc}`;
          } else {
            characterPersonalities[char.name] = `${char.personality}. Arc: ${char.arc}`;
          }
        });
      }
      
      // Generate dialogue SEQUENTIALLY for narrative continuity
      const scenesWithDialogue: MovieScene[] = [];
      const previousDialogues: { sceneTitle: string; summary: string }[] = [];
      
      for (let index = 0; index < generatedScenes.length; index++) {
        const scene = generatedScenes[index];
        try {
            setGenerateAllProgress(55 + Math.floor((index / generatedScenes.length) * 20));
            
            // Determine scene position for context
            const totalScenes = generatedScenes.length;
            let scenePosition = `${index + 1} of ${totalScenes}`;
            if (index === 0) scenePosition = 'opening';
            else if (index === totalScenes - 1) scenePosition = 'resolution/final';
            else if (index === Math.floor(totalScenes / 2)) scenePosition = 'midpoint';
            else if (index === Math.floor(totalScenes * 0.75)) scenePosition = 'climax';
            
            // Build cumulative story context from ALL previous scenes
            const previousSceneSummary = previousDialogues.length > 0
              ? previousDialogues.map(p => `${p.sceneTitle}: ${p.summary}`).join(' → ')
              : undefined;
            
            // For 2+ characters, use conversation dialogue with rich context
            if (characterNames.length >= 2) {
              const { data: convData, error: convError } = await supabase.functions.invoke('generate-conversation-dialogue', {
                body: {
                  sceneDescription: scene.description,
                  sceneTitle: scene.title,
                  location: scene.location,
                  timeOfDay: scene.timeOfDay,
                  characterNames,
                  tone: scene.mood || 'dramatic',
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
                const sceneWithDialogue = {
                  ...scene,
                  dialogue: convData.conversation,
                  charactersInScene: characterNames
                };
                scenesWithDialogue.push(sceneWithDialogue);
                // Track dialogue for next scene's context
                const dialogueSummary = convData.conversation.slice(0, 3).map((d: any) => `${d.character}: "${d.line}"`).join('; ');
                previousDialogues.push({ sceneTitle: scene.title, summary: `${scene.description.substring(0, 100)}. Dialogue: ${dialogueSummary}` });
                continue;
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
              scenesWithDialogue.push({ ...scene, dialogue: dialogueData.dialogue });
              previousDialogues.push({ sceneTitle: scene.title, summary: scene.description.substring(0, 150) });
            } else {
              scenesWithDialogue.push(scene);
              previousDialogues.push({ sceneTitle: scene.title, summary: scene.description.substring(0, 150) });
            }
          } catch (err) {
            console.error(`Error generating dialogue for scene ${scene.sceneNumber}:`, err);
            scenesWithDialogue.push(scene);
            previousDialogues.push({ sceneTitle: scene.title, summary: scene.description.substring(0, 150) });
          }
        }
      
      setScenes(scenesWithDialogue);
      setGenerateAllProgress(75);

      // ── Progressive save: scenes + dialogue done ──
      await ensureProjectSaved({ scenes: scenesWithDialogue as any });

      // Step 6: Generate start frame images for ALL scenes (75% → 85%)
      setGenerateAllStep('Generating scene images...');
      const referenceImages = selectedTwins.length > 0 
        ? selectedTwins.flatMap(twin => twin.reference_images || []) 
        : [];
      const charDescription = selectedTwins.length > 0
        ? selectedTwins.map(twin => {
            const genderText = twin.gender || 'person';
            const faceDesc = twin.face_description || twin.description || '';
            return `${twin.name} is a ${genderText}. Physical appearance: ${faceDesc}`;
          }).join('\n\n')
        : undefined;

      for (let i = 0; i < scenesWithDialogue.length; i++) {
        const scene = scenesWithDialogue[i];
        setGenerateAllStep(`Generating image ${i + 1}/${scenesWithDialogue.length}...`);
        setGenerateAllProgress(75 + Math.floor((i / scenesWithDialogue.length) * 10));

        try {
          const { data: imageData, error: imageError } = await supabase.functions.invoke('generate-scene-image', {
            body: { 
              prompt: scene.imagePrompt,
              referenceImages,
              characterDescription: charDescription
            }
          });

          if (!imageError && imageData?.imageUrl) {
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

            scenesWithDialogue[i] = {
              ...scenesWithDialogue[i],
              startFrame: {
                imagePrompt: scene.imagePrompt,
                generatedImage: imageUrl,
                position: 'center',
                cameraAngle: 'eye-level'
              }
            };
            setScenes([...scenesWithDialogue]);
          }
        } catch (frameError) {
          console.error(`Error generating image for scene ${scene.sceneNumber}:`, frameError);
        }
      }

      setGenerateAllProgress(85);
      // ── Progressive save: images done ──
      await ensureProjectSaved({ scenes: scenesWithDialogue as any });
      sendNotification('🎬 Scenes Ready!', 'Your scenes, dialogue, and images are ready for preview.');

      // PAUSE: Show preview before video generation
      setIsGeneratingAll(false);
      setGenerateAllStep('');
      setGenerateAllProgress(0);
      setIsPreviewingBeforeVideo(true);
      setPendingVideoGeneration(scenesWithDialogue);
      
      // Switch to scenes step so user can see them
      if (isBeginner) {
        // beginner mode shows scenes inline
      } else {
        setCurrentStep(3);
      }

      toast({
        title: "🎬 Scenes Ready for Preview!",
        description: "Review your scenes, dialogue, and images before generating videos.",
      });

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

  // Continue video generation after user previews scenes
  const continueVideoGeneration = async () => {
    const scenesWithDialogue = pendingVideoGeneration;
    if (!scenesWithDialogue) return;

    setIsPreviewingBeforeVideo(false);
    setPendingVideoGeneration(null);
    setIsGeneratingAll(true);
    setGenerateAllStep('Generating scene videos...');
    setGenerateAllProgress(85);

    let videoErrors = 0;

    try {
      for (let i = 0; i < scenesWithDialogue.length; i++) {
        const scene = scenesWithDialogue[i];
        const imageToUse = (scene as any).startFrame?.generatedImage || scene.generatedImage;
        
        if (!imageToUse) {
          console.warn(`Skipping video for scene ${scene.sceneNumber} — no image`);
          videoErrors++;
          continue;
        }

        setGenerateAllStep(`Generating video ${i + 1}/${scenesWithDialogue.length}...`);
        setGenerateAllProgress(85 + Math.floor((i / scenesWithDialogue.length) * 12));

        try {
          const result = await generateSceneVideoAndWait(scenesWithDialogue[i] as MovieSceneWithKeyframes, scenesWithDialogue as MovieSceneWithKeyframes[]);
          (scenesWithDialogue[i] as any).generatedVideo = result.videoUrl;
          (scenesWithDialogue[i] as any).transitionAudioContent = result.audioContent;
          setScenes([...scenesWithDialogue]);
          setTimeout(() => autoSaveProject(scenesWithDialogue), 500);
        } catch (videoErr: any) {
          console.error(`Error generating video for scene ${scene.sceneNumber}:`, videoErr);
          videoErrors++;
          if (videoErr.message?.includes('credits') || videoErr.message?.includes('Insufficient')) {
            toast({
              title: "Video Credits Exhausted",
              description: "Your video generation credits have run out. Videos generated so far are saved.",
              variant: "destructive"
            });
            break;
          }
        }
      }

      setGenerateAllProgress(97);
      setScenes([...scenesWithDialogue]);

      // Auto-stitch all videos into final movie
      const scenesWithVideos = scenesWithDialogue.filter(s => s.generatedVideo);
      if (scenesWithVideos.length >= 2) {
        setGenerateAllStep('Stitching final movie...');
        try {
          const videosToStitch = scenesWithVideos.map(s => s.generatedVideo as string);
          const audiosToStitch = scenesWithVideos
            .map(s => (s as any).transitionAudioContent)
            .filter(Boolean)
            .map((audioBase64: string) => `data:audio/mp3;base64,${audioBase64}`);

          const stitchedBlob = await stitchVideosWithAudio({
            videoUrls: videosToStitch,
            audioUrls: audiosToStitch.length > 0 ? audiosToStitch : undefined,
            onProgress: () => {}
          });

          const url = URL.createObjectURL(stitchedBlob);
          setStitchedVideoUrl(url);

          if (currentProjectId) {
            await supabase
              .from('movie_projects')
              .update({ stitched_video_url: url, updated_at: new Date().toISOString() })
              .eq('id', currentProjectId);
          }
        } catch (stitchErr) {
          console.error('Error stitching final movie:', stitchErr);
        }
      }

      setGenerateAllProgress(100);
      setGenerateAllStep('Complete!');

      const successCount = scenesWithDialogue.filter(s => s.generatedVideo).length;
      trackGenerationEnd();
      sendNotification('🎬 Movie Complete!', `Generated ${successCount} scene videos. Your movie is ready!`);
      toast({
        title: "🎬 Movie Complete!",
        description: `Generated ${successCount}/${scenesWithDialogue.length} scene videos${scenesWithVideos.length >= 2 ? ' and stitched your movie' : ''}. ${videoErrors > 0 ? `${videoErrors} scene(s) had errors.` : ''}`,
      });

      setTimeout(() => autoSaveProject(scenesWithDialogue), 500);
    } catch (error: any) {
      console.error('Error in video generation:', error);
      toast({
        title: "Video Generation Failed",
        description: error.message || "Failed to generate videos.",
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
      const dialogueArray = Array.isArray(scene.dialogue) ? scene.dialogue : [];
      const isConversation = dialogueArray.length > 1;
      const uniqueSpeakers = isConversation ? new Set(dialogueArray.map((d: any) => d.character?.toLowerCase())).size : 1;
      const isMultiCharacter = isConversation && uniqueSpeakers >= 2;

      let audioContent: string | null = null;
      let estimatedDuration = 5;

      if (isMultiCharacter) {
        // ===== MULTI-CHARACTER: Use multi-voice TTS (Gemini multi-speaker) =====
        toast({
          title: "Generating Multi-Voice Audio",
          description: `Creating conversation with ${uniqueSpeakers} distinct character voices...`,
        });

        const voiceAssignments: Array<{
          characterName: string;
          speechifyVoiceId?: string;
          voiceCloningKey?: string;
          defaultVoice?: string;
          gender?: string;
          voiceEngine?: string;
          googleVoiceId?: string;
        }> = [];

        if (storyBible?.characters) {
          for (const char of storyBible.characters) {
            if (char.assignedTwinId) {
              const twin = aiTwins.find(t => t.id === char.assignedTwinId);
              if (twin) {
                const isSpeechify = twin.voice_cloning_key ? isSpeechifyVoiceId(twin.voice_cloning_key) : false;
                voiceAssignments.push({
                  characterName: char.name,
                  speechifyVoiceId: (twin.voice_cloning_key && isSpeechify) ? twin.voice_cloning_key : undefined,
                  voiceCloningKey: (twin.voice_cloning_key && !isSpeechify) ? twin.voice_cloning_key : undefined,
                  gender: twin.gender || undefined,
                  voiceEngine: twin.voice_engine || undefined,
                  googleVoiceId: twin.google_voice_id || undefined,
                });
              }
            }
          }
        }

        for (const twin of selectedTwins) {
          if (!voiceAssignments.find(v => v.characterName.toLowerCase() === twin.name.toLowerCase())) {
            const isSpeechify = twin.voice_cloning_key ? isSpeechifyVoiceId(twin.voice_cloning_key) : false;
            voiceAssignments.push({
              characterName: twin.name,
              speechifyVoiceId: (twin.voice_cloning_key && isSpeechify) ? twin.voice_cloning_key : undefined,
              voiceCloningKey: (twin.voice_cloning_key && !isSpeechify) ? twin.voice_cloning_key : undefined,
              gender: twin.gender || undefined,
              voiceEngine: twin.voice_engine || undefined,
              googleVoiceId: twin.google_voice_id || undefined,
            });
          }
        }

        console.log('Multi-voice TTS assignments:', voiceAssignments);

        const { data: multiVoiceData, error: multiVoiceError } = await supabase.functions.invoke('multi-voice-tts', {
          body: { dialogue: scene.dialogue, voiceAssignments }
        });
        if (multiVoiceError) throw new Error('Failed to generate multi-voice audio');

        audioContent = multiVoiceData.audioContent;
        const totalWords = dialogueArray.reduce((acc: number, d: any) => acc + (d.line?.split(/\s+/).length || 0), 0);
        estimatedDuration = Math.max(5, Math.min(30, Math.ceil(totalWords / 2.5)));
      } else {
        // ===== SINGLE CHARACTER: Use single-voice TTS =====
        let textForAudio = '';
        if (scene.dialogue) {
          if (Array.isArray(scene.dialogue)) {
            textForAudio = scene.dialogue.map((d: any) => d.line).join(' ');
          } else {
            textForAudio = scene.dialogue;
          }
        }
        textForAudio = cleanDialogueForTTS(textForAudio);
        if (!textForAudio) textForAudio = "This moment is everything. I have to keep going.";

        let voiceToUse: { name: string; speechifyVoiceId?: string; voiceCloningKey?: string; gender?: string; voiceEngine?: string; googleVoiceId?: string } | null = null;

        if (storyBible?.characters) {
          // For conversation dialogue, match first speaker to a character
          if (Array.isArray(scene.dialogue) && scene.dialogue.length > 0) {
            const firstSpeaker = scene.dialogue[0].character?.toLowerCase() || '';
            // Try exact match first, then partial/includes match
            const assignedChar = storyBible.characters.find(c => c.name.toLowerCase() === firstSpeaker)
              || storyBible.characters.find(c => firstSpeaker.includes(c.name.toLowerCase()) || c.name.toLowerCase().includes(firstSpeaker));
            if (assignedChar?.assignedTwinId) {
              const assignedTwin = aiTwins.find(t => t.id === assignedChar.assignedTwinId);
              if (assignedTwin) {
                const isSpeechify = assignedTwin.voice_cloning_key ? isSpeechifyVoiceId(assignedTwin.voice_cloning_key) : false;
                voiceToUse = {
                  name: assignedTwin.name,
                  speechifyVoiceId: (assignedTwin.voice_cloning_key && isSpeechify) ? assignedTwin.voice_cloning_key : undefined,
                  voiceCloningKey: (assignedTwin.voice_cloning_key && !isSpeechify) ? assignedTwin.voice_cloning_key : undefined,
                  gender: assignedTwin.gender || undefined,
                  voiceEngine: assignedTwin.voice_engine || undefined,
                  googleVoiceId: assignedTwin.google_voice_id || undefined,
                };
              }
            }
          } else {
            const protagonist = storyBible.characters.find(c => c.role === 'protagonist');
            if (protagonist?.assignedTwinId) {
              const assignedTwin = aiTwins.find(t => t.id === protagonist.assignedTwinId);
              if (assignedTwin) {
                const isSpeechify = assignedTwin.voice_cloning_key ? isSpeechifyVoiceId(assignedTwin.voice_cloning_key) : false;
                voiceToUse = {
                  name: assignedTwin.name,
                  speechifyVoiceId: (assignedTwin.voice_cloning_key && isSpeechify) ? assignedTwin.voice_cloning_key : undefined,
                  voiceCloningKey: (assignedTwin.voice_cloning_key && !isSpeechify) ? assignedTwin.voice_cloning_key : undefined,
                  gender: assignedTwin.gender || undefined,
                  voiceEngine: assignedTwin.voice_engine || undefined,
                  googleVoiceId: assignedTwin.google_voice_id || undefined,
                };
              }
            }
          }
        }

        // Fallback: try matching dialogue character name directly to a selected twin
        if (!voiceToUse && selectedTwins.length > 0) {
          const speakerName = Array.isArray(scene.dialogue) && scene.dialogue.length > 0 
            ? scene.dialogue[0].character?.toLowerCase() : '';
          const matchedTwin = speakerName 
            ? selectedTwins.find(t => t.name.toLowerCase() === speakerName || speakerName.includes(t.name.toLowerCase()))
            : null;
          const twin = matchedTwin || selectedTwins[0];
          const isSpeechify = twin.voice_cloning_key ? isSpeechifyVoiceId(twin.voice_cloning_key) : false;
          voiceToUse = {
            name: twin.name,
            speechifyVoiceId: (twin.voice_cloning_key && isSpeechify) ? twin.voice_cloning_key : undefined,
            voiceCloningKey: (twin.voice_cloning_key && !isSpeechify) ? twin.voice_cloning_key : undefined,
            gender: twin.gender || undefined,
            voiceEngine: twin.voice_engine || undefined,
            googleVoiceId: twin.google_voice_id || undefined,
          };
        }

        const voiceType = voiceToUse?.speechifyVoiceId ? 'cloned' : voiceToUse?.voiceCloningKey ? 'cloned' : voiceToUse?.voiceEngine === 'google-cloud' ? 'Google Cloud' : 'WaveSpeed AI';
        toast({
          title: voiceToUse ? `Generating ${voiceToUse.name}'s Voice` : "Generating Audio",
          description: voiceToUse 
            ? `Creating ${voiceToUse.gender || 'character'} voiceover for ${voiceToUse.name} via ${voiceType}...`
            : "Creating voiceover for the scene...",
        });

        let ttsVoiceParams: any = {};
        if (voiceToUse?.speechifyVoiceId || voiceToUse?.voiceCloningKey) {
          ttsVoiceParams = { speechifyVoiceId: voiceToUse.speechifyVoiceId, voiceCloningKey: voiceToUse.voiceCloningKey };
        } else if (voiceToUse?.voiceEngine === 'google-cloud' && voiceToUse?.googleVoiceId) {
          ttsVoiceParams = { voiceEngine: 'google-cloud', googleVoiceId: voiceToUse.googleVoiceId };
        } else {
          ttsVoiceParams = { voice: 'ai-auto', gender: voiceToUse?.gender || 'male' };
        }

        const { data: ttsData, error: ttsError } = await supabase.functions.invoke('text-to-speech', {
          body: { text: textForAudio, ...ttsVoiceParams }
        });
        if (ttsError) throw ttsError;
        audioContent = ttsData.audioContent;

        const wordCount = textForAudio.split(/\s+/).length;
        estimatedDuration = Math.max(5, Math.min(30, Math.ceil(wordCount / 2.5)));
      }

      toast({
        title: "Generating Video",
        description: isMultiCharacter
          ? `Creating cinematic video with ${uniqueSpeakers} characters in conversation...`
          : "Creating lip-synced video...",
      });

      // Build rich cinematic prompt from all scene data
      const buildCinematicPrompt = (forMultiChar: boolean) => {
        const parts: string[] = [];
        
        // Scene storyline and description
        const sceneDesc = scene.description || scene.title || '';
        if (sceneDesc) parts.push(sceneDesc);
        
        // Start/end frame context for visual storytelling
        if (scene.startFrame?.imagePrompt && scene.endFrame?.imagePrompt) {
          parts.push(`Scene transitions from: ${scene.startFrame.imagePrompt} to: ${scene.endFrame.imagePrompt}`);
        } else if (scene.startFrame?.imagePrompt) {
          parts.push(`Scene setting: ${scene.startFrame.imagePrompt}`);
        }

        // Character position changes
        const startPos = scene.startFrame?.position || '';
        const endPos = scene.endFrame?.position || '';
        if (startPos && endPos && startPos !== endPos) {
          parts.push(`Characters move from ${startPos} to ${endPos}`);
        }

        // Transition action from outline
        if (scene.transitionAction) parts.push(scene.transitionAction);

        // Camera movement
        if (scene.transitionCameraMovement && scene.transitionCameraMovement !== 'static') {
          const camDescs: Record<string, string> = {
            'tracking': 'Camera tracks smoothly following subject movement',
            'push-in': 'Camera pushes in toward subjects, building intensity',
            'pull-out': 'Camera pulls back revealing more of the scene',
            'pan': 'Camera pans horizontally following the action',
            'tilt': 'Camera tilts vertically revealing the environment',
            'crane-up': 'Camera cranes upward for an establishing reveal',
            'crane-down': 'Camera descends from high angle to eye level',
            'orbit': 'Camera orbits around subjects in a dramatic arc',
            'handheld': 'Natural handheld camera movement with slight shake',
            'steadicam': 'Smooth gliding steadicam movement through the scene',
            'zoom-in': 'Dramatic zoom toward the subject',
            'zoom-out': 'Lens zooms out revealing the wider context',
          };
          parts.push(camDescs[scene.transitionCameraMovement] || `Camera: ${scene.transitionCameraMovement}`);
        }

        // Camera angle
        if (scene.selectedCameraAngle && scene.selectedCameraAngle !== 'eye-level') {
          const cam = CAMERA_ANGLES.find(a => a.id === scene.selectedCameraAngle);
          if (cam) parts.push(`Shot: ${cam.name}, ${cam.description}`);
        }

        // Camera angle transition between keyframes
        const startAngle = scene.startFrame?.cameraAngle || '';
        const endAngle = scene.endFrame?.cameraAngle || '';
        if (startAngle && endAngle && startAngle !== endAngle) {
          parts.push(`Camera transitions from ${startAngle} to ${endAngle}`);
        }

        // Mood and lighting
        if (scene.mood) parts.push(`Mood: ${scene.mood}`);
        if (scene.selectedLighting && scene.selectedLighting !== 'natural') parts.push(`Lighting: ${scene.selectedLighting}`);

        // Character dynamics
        if (forMultiChar) {
          // Extract action cues from dialogue stage directions
          const dialogueActions: string[] = [];
          if (Array.isArray(scene.dialogue)) {
            for (const d of scene.dialogue) {
              const stageDir = d.line?.match(/\(([^)]+)\)/g);
              if (stageDir) dialogueActions.push(...stageDir.map(s => s.replace(/[()]/g, '')));
            }
          }
          if (dialogueActions.length > 0) {
            parts.push(`Character actions: ${dialogueActions.join(', ')}`);
          }
          parts.push('Characters actively gesturing while speaking, leaning in and out, shifting weight between feet, turning heads to face each other, using hand gestures to emphasize points, natural breathing and micro-expressions, realistic body sway');
        } else {
          parts.push('Character speaking with natural head movement, subtle gestures, expressive face, slight body sway, realistic eye movement and blinking');
        }

        parts.push('Cinematic film quality, smooth natural motion, professional cinematography, dynamic and alive scene');
        return parts.join('. ') + '.';
      };

      let videoBody: any;
      if (isMultiCharacter) {
        videoBody = {
          action: 'create',
          model: 'wan-2.5-i2v',
          imageUrls: [imageToUse],
          prompt: buildCinematicPrompt(true),
          duration: Math.min(estimatedDuration, 10),
          aspectRatio: '16:9'
        };
      } else {
        // Single character: InfiniteTalk lip-sync (auto-syncs to audio length)
        videoBody = {
          action: 'create',
          model: 'infinitetalk',
          imageUrls: [imageToUse],
          audioUrl: `data:audio/mp3;base64,${audioContent}`,
        };
      }

      const { data: videoData, error: videoError } = await supabase.functions.invoke('wavespeed-video', {
        body: videoBody
      });
      if (videoError) throw videoError;

      // Store audio for multi-character scenes (needed for stitching)
      setScenes(prevScenes =>
        prevScenes.map(s =>
          s.sceneNumber === sceneNumber
            ? { ...s, videoTaskId: videoData.taskId, transitionAudioContent: audioContent || undefined }
            : s
        )
      );

      // Poll for video completion
      const checkStatus = async () => {
        const { data: statusData, error: statusError } = await supabase.functions.invoke('wavespeed-video', {
          body: { action: 'status', taskId: videoData.taskId }
        });
        if (statusError) throw statusError;

        if (statusData.status === 'completed' && statusData.videoUrl) {
          setScenes(prevScenes => {
            const updated = prevScenes.map(s =>
              s.sceneNumber === sceneNumber
                ? { ...s, generatedVideo: statusData.videoUrl }
                : s
            );
            setTimeout(() => autoSaveProject(updated), 500);
            return updated;
          });
          setGeneratingVideoFor(null);
          toast({
            title: "Video Generated!",
            description: `Scene ${sceneNumber} ${isMultiCharacter ? 'multi-character' : 'lip-sync'} video is ready.`,
          });
        } else if (statusData.status === 'failed') {
          throw new Error('Video generation failed');
        } else {
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
          gender?: string;
          voiceEngine?: string;
          googleVoiceId?: string;
        }> = [];

        if (storyBible?.characters) {
          for (const char of storyBible.characters) {
            if (char.assignedTwinId) {
              const twin = aiTwins.find(t => t.id === char.assignedTwinId);
              if (twin) {
                const isSpeechify = twin.voice_cloning_key ? isSpeechifyVoiceId(twin.voice_cloning_key) : false;
                voiceAssignments.push({
                  characterName: char.name,
                  speechifyVoiceId: (twin.voice_cloning_key && isSpeechify) ? twin.voice_cloning_key : undefined,
                  voiceCloningKey: (twin.voice_cloning_key && !isSpeechify) ? twin.voice_cloning_key : undefined,
                  gender: twin.gender || undefined,
                  voiceEngine: twin.voice_engine || undefined,
                  googleVoiceId: twin.google_voice_id || undefined,
                  defaultVoice: char.role === 'protagonist' ? 'en-US-Journey-D' : 'en-US-Journey-F'
                });
              }
            }
          }
        }

        // Also add selected twins as fallback assignments
        for (const twin of selectedTwins) {
          if (!voiceAssignments.find(v => v.characterName.toLowerCase() === twin.name.toLowerCase())) {
            const isSpeechify = twin.voice_cloning_key ? isSpeechifyVoiceId(twin.voice_cloning_key) : false;
            voiceAssignments.push({
              characterName: twin.name,
              speechifyVoiceId: (twin.voice_cloning_key && isSpeechify) ? twin.voice_cloning_key : undefined,
              voiceCloningKey: (twin.voice_cloning_key && !isSpeechify) ? twin.voice_cloning_key : undefined,
              gender: twin.gender || undefined,
              voiceEngine: twin.voice_engine || undefined,
              googleVoiceId: twin.google_voice_id || undefined,
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
      setScenes((data.scenes as any) || []);
      setStitchedVideoUrl((data as any).stitched_video_url || null);
      setStoryBible((data as any).story_bible || null);

      // ── Set wizard step based on content ──
      const loadedScenes = (data.scenes as any) || [];
      if (loadedScenes.length > 0) {
        setCurrentStep(3);
      } else if (data.outline) {
        setCurrentStep(2);
      } else if ((data as any).story_bible) {
        setCurrentStep(1);
      } else {
        setCurrentStep(0);
      }

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
        {/* ===== HEADER — Clean: Title + Save + Overflow ===== */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Film className="w-8 h-8 text-primary" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-foreground">Movie Studio</h1>
              {currentProjectId && projectTitle && (
                <p className="text-sm text-primary">{projectTitle}</p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <CreatorModeToggle mode={creatorMode} onModeChange={setCreatorMode} />
            {userId && (
              <>
                <Dialog open={isSaveDialogOpen} onOpenChange={setIsSaveDialogOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm"><Save className="w-4 h-4 mr-1" />Save</Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>{currentProjectId ? 'Update' : 'Save'} Project</DialogTitle>
                      <DialogDescription>{currentProjectId ? 'Update your movie project' : 'Give your movie project a name'}</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label htmlFor="project-title">Project Title</Label>
                        <Input id="project-title" placeholder="Enter project title..." value={projectTitle} onChange={(e) => setProjectTitle(e.target.value)} />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button onClick={saveProject}><Save className="w-4 h-4 mr-2" />{currentProjectId ? 'Update' : 'Save'}</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="icon" className="h-9 w-9"><MoreVertical className="w-4 h-4" /></Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={startNewProject}><Film className="w-4 h-4 mr-2" />New Project</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setIsLoadDialogOpen(true)}><FolderOpen className="w-4 h-4 mr-2" />Load Project</DropdownMenuItem>
                    <DropdownMenuItem onClick={transferToReels} disabled={isTransferring || !movieIdea.trim()}><ArrowRight className="w-4 h-4 mr-2" />Transfer to Reels</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            )}
            <StoryboardExport scenes={scenes as MovieSceneWithKeyframes[]} projectTitle={projectTitle || 'Movie Storyboard'} />
          </div>
        </div>

        {/* Recovery banner for interrupted generation */}
        {showRecoveryBanner && recoveryProjectId && (
          <Card className="border-amber-500/50 bg-amber-500/5">
            <CardContent className="py-4">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-amber-500/10 rounded-full">
                    <Film className="w-5 h-5 text-amber-500" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground">Unfinished Movie Detected</h3>
                    <p className="text-sm text-muted-foreground">You have a movie that was interrupted. Pick up where you left off?</p>
                  </div>
                </div>
                <div className="flex gap-2 shrink-0">
                  <Button onClick={recoverProject} size="sm" className="gap-2">
                    <Play className="w-3.5 h-3.5" />
                    Continue
                  </Button>
                  <Button onClick={dismissRecovery} variant="ghost" size="sm">
                    <X className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Load Dialog (rendered separately) */}
        <Dialog open={isLoadDialogOpen} onOpenChange={setIsLoadDialogOpen}>
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
                      <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); deleteProject(project.id); }}>
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </DialogContent>
        </Dialog>

        {/* ===== STEPPER (Advanced mode only) ===== */}
        {isAdvanced ? (() => {
          const steps = [
            { label: 'Concept', icon: Lightbulb, done: !!movieIdea.trim() },
            { label: 'Story Bible', icon: BookOpen, done: !!storyBible },
            { label: 'Outline', icon: FileText, done: !!outline.trim() },
            { label: 'Scenes', icon: Clapperboard, done: scenes.length > 0 },
          ];
          return (
            <div className="flex items-center gap-1 bg-muted/50 rounded-xl p-2 overflow-x-auto">
              {steps.map((step, idx) => {
                const StepIcon = step.icon;
                const isActive = currentStep === idx;
                const isCompleted = step.done && currentStep > idx;
                const isClickable = step.done || idx <= currentStep;
                return (
                  <React.Fragment key={idx}>
                    {idx > 0 && <div className={`hidden sm:block w-8 h-px flex-shrink-0 ${idx <= currentStep ? 'bg-primary' : 'bg-border'}`} />}
                    <button
                      onClick={() => isClickable && setCurrentStep(idx)}
                      disabled={!isClickable}
                      className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all flex-shrink-0 ${
                        isActive
                          ? 'bg-primary text-primary-foreground shadow-md'
                          : isCompleted
                            ? 'bg-primary/10 text-primary hover:bg-primary/20'
                            : isClickable
                              ? 'text-muted-foreground hover:bg-accent'
                              : 'text-muted-foreground/40 cursor-not-allowed'
                      }`}
                    >
                      <div className="flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold border-2 flex-shrink-0" 
                        style={{
                          borderColor: isActive ? 'hsl(var(--primary-foreground))' : isCompleted ? 'hsl(var(--primary))' : 'hsl(var(--border))',
                          backgroundColor: isCompleted ? 'hsl(var(--primary))' : 'transparent',
                          color: isCompleted ? 'hsl(var(--primary-foreground))' : 'inherit',
                        }}
                      >
                        {isCompleted ? <Check className="w-3 h-3" /> : idx + 1}
                      </div>
                      <span className="hidden sm:inline">{step.label}</span>
                      <StepIcon className="w-4 h-4 sm:hidden" />
                    </button>
                  </React.Fragment>
                );
              })}
            </div>
          );
        })() : null}

        {/* ===== BEGINNER MODE: Simplified single-page flow ===== */}
        {isBeginner && (
          <div className="space-y-6">
            {/* Hero Input */}
            <Card className="border-primary/30 bg-gradient-to-br from-primary/5 to-transparent">
              <CardContent className="pt-8 pb-8 space-y-6">
                <div className="text-center space-y-2">
                  <h2 className="text-2xl font-bold text-foreground">What's your movie about?</h2>
                  <p className="text-muted-foreground">Describe your idea and we'll create the entire movie for you.</p>
                </div>

                <Textarea
                  placeholder="A sci-fi thriller about a detective who discovers she's living in a simulated reality..."
                  value={movieIdea}
                  onChange={(e) => setMovieIdea(e.target.value)}
                  rows={4}
                  className="resize-none text-base"
                />

                {/* Quick Start Chips */}
                <div className="flex flex-wrap gap-2 justify-center">
                  {SAMPLE_MOVIES.map((movie) => (
                    <Button 
                      key={movie.value} 
                      variant="outline" 
                      size="sm" 
                      onClick={() => setMovieIdea(movie.description)}
                      className="text-xs rounded-full"
                    >
                      {movie.label}
                    </Button>
                  ))}
                </div>

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
                    <><Sparkles className="w-5 h-5 mr-2" />Make My Movie ✨</>
                  )}
                </Button>
              </CardContent>
            </Card>

            {/* Completed movie player (beginner) */}
            {stitchedVideoUrl && (
              <Card className="bg-primary/5 border-primary/20">
                <CardContent className="pt-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Video className="w-5 h-5 text-primary" />
                      <h3 className="font-semibold text-foreground">Your Movie</h3>
                    </div>
                    <Button onClick={() => { const a = document.createElement('a'); a.href = stitchedVideoUrl; a.download = `${projectTitle || 'movie'}.mp4`; a.click(); }} variant="outline" size="sm" className="gap-2">
                      <Download className="w-3.5 h-3.5" /> Download
                    </Button>
                  </div>
                  <video src={stitchedVideoUrl} controls className="w-full rounded-lg border border-border" />
                </CardContent>
              </Card>
            )}

            {/* Scene summary cards (beginner — read-only) */}
            {scenes.length > 0 && !stitchedVideoUrl && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-bold text-foreground">Your Scenes</h2>
                    <p className="text-sm text-muted-foreground">{scenes.length} scenes • {scenes.filter(s => s.generatedVideo).length} videos ready</p>
                  </div>
                  {scenes.some(s => s.generatedVideo) && (
                    <Button onClick={stitchAllVideos} disabled={isStitching} className="gap-2">
                      {isStitching ? (<><Sparkles className="w-4 h-4 animate-spin" />Building...</>) : (<><Video className="w-4 h-4" />Build Movie</>)}
                    </Button>
                  )}
                </div>

                {isStitching && (
                  <div className="flex items-center gap-3 p-4 rounded-lg bg-primary/5 border border-primary/20">
                    <Sparkles className="w-5 h-5 text-primary animate-spin shrink-0" />
                    <div className="flex-1 space-y-2">
                      <p className="text-sm font-medium text-foreground">Building your movie...</p>
                      <Progress value={stitchProgress} className="h-1.5" />
                    </div>
                    <span className="text-sm font-mono text-muted-foreground">{stitchProgress}%</span>
                  </div>
                )}

                {/* Preview banner before video generation */}
                {isPreviewingBeforeVideo && (
                  <Card className="border-primary bg-gradient-to-r from-primary/5 to-primary/10">
                    <CardContent className="py-4 space-y-3">
                      <div className="flex items-center gap-2">
                        <Eye className="w-5 h-5 text-primary" />
                        <h3 className="font-semibold text-foreground">Preview Your Scenes</h3>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Review the scenes, dialogue, and images below. When you're happy, click "Generate Videos" to bring them to life.
                      </p>
                      <div className="flex gap-2">
                        <Button onClick={continueVideoGeneration} className="gap-2 bg-gradient-to-r from-primary to-primary/80">
                          <Video className="w-4 h-4" />
                          Generate Videos
                        </Button>
                        <Button variant="outline" onClick={() => { setIsPreviewingBeforeVideo(false); setPendingVideoGeneration(null); }}>
                          Edit First
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {scenes.map((scene) => (
                    <Card key={scene.sceneNumber} className="overflow-hidden">
                      <div className="flex gap-3 p-3">
                        {(scene.startFrame?.generatedImage || scene.generatedImage) && (
                          <img 
                            src={scene.startFrame?.generatedImage || scene.generatedImage} 
                            alt={`Scene ${scene.sceneNumber}`} 
                            className="w-20 h-20 rounded-lg object-cover flex-shrink-0" 
                          />
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge variant="outline" className="text-[10px]">Scene {scene.sceneNumber}</Badge>
                            {scene.generatedVideo && <Badge className="text-[10px] bg-primary text-primary-foreground">✓ Video</Badge>}
                          </div>
                          <h4 className="text-sm font-medium truncate">{scene.title}</h4>
                          <p className="text-xs text-muted-foreground line-clamp-2">{scene.description}</p>
                          {scene.dialogue && (
                            <div className="mt-1.5 space-y-0.5">
                              {(Array.isArray(scene.dialogue) 
                                ? scene.dialogue.slice(0, 2).map((d: any, i: number) => (
                                    <p key={i} className="text-[11px] text-foreground/70 truncate">
                                      <span className="font-semibold">{d.character}:</span> "{d.line}"
                                    </p>
                                  ))
                                : typeof scene.dialogue === 'string'
                                  ? scene.dialogue.split('\n').slice(0, 2).map((line, i) => (
                                      <p key={i} className="text-[11px] text-foreground/70 italic truncate">"{line}"</p>
                                    ))
                                  : null
                              )}
                              {((Array.isArray(scene.dialogue) && scene.dialogue.length > 2) || 
                                (typeof scene.dialogue === 'string' && scene.dialogue.split('\n').length > 2)) && (
                                <p className="text-[10px] text-muted-foreground">+ more lines...</p>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Save Preset Dialog (always rendered) */}
        <Dialog open={isSavePresetDialogOpen} onOpenChange={setIsSavePresetDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Save Visual Preset</DialogTitle>
              <DialogDescription>Save the current camera angle and lighting combination as a reusable preset</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="preset-name">Preset Name</Label>
                <Input id="preset-name" placeholder="e.g., Dramatic Low Angle, Golden Hour Portrait..." value={newPresetName} onChange={(e) => setNewPresetName(e.target.value)} />
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
              <Button variant="outline" onClick={() => setIsSavePresetDialogOpen(false)}>Cancel</Button>
              <Button onClick={saveVisualPreset}><Star className="w-4 h-4 mr-2" />Save Preset</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ===== STEP 1: Concept — Hero Input + Make My Movie (Advanced only) ===== */}
        {isAdvanced && currentStep === 0 && (
          <div className="space-y-6">
            {/* Hero Card */}
            <Card className="border-primary/30 bg-gradient-to-br from-primary/5 to-transparent">
              <CardContent className="pt-8 pb-8 space-y-6">
                <div className="text-center space-y-2">
                  <h2 className="text-2xl font-bold text-foreground">What's your movie about?</h2>
                  <p className="text-muted-foreground">Describe your movie idea and AI will create the entire thing for you.</p>
                </div>

                <Textarea
                  placeholder="A sci-fi thriller about a detective who discovers she's living in a simulated reality..."
                  value={movieIdea}
                  onChange={(e) => setMovieIdea(e.target.value)}
                  rows={5}
                  className="resize-none text-base"
                />

                {/* Quick Start Chips */}
                <div className="flex flex-wrap gap-2 justify-center">
                  {SAMPLE_MOVIES.map((movie) => (
                    <Button 
                      key={movie.value} 
                      variant="outline" 
                      size="sm" 
                      onClick={() => { setMovieIdea(movie.description); setPeteInputValue(movie.description); }}
                      className="text-xs rounded-full"
                    >
                      {movie.label}
                    </Button>
                  ))}
                </div>

                {/* Make My Movie Button — always visible when idea exists */}
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
                    <><Sparkles className="w-5 h-5 mr-2" />Make My Movie ✨</>
                  )}
                </Button>

                {/* Selected Twins Summary (compact) */}
                {selectedTwins.length > 0 && (
                  <div className="flex items-center gap-2 justify-center flex-wrap">
                    <span className="text-xs text-muted-foreground">Starring:</span>
                    {selectedTwins.map((twin) => (
                      <Badge key={twin.id} variant="secondary" className="gap-1 text-xs">
                        {twin.reference_images?.[0] && <img src={twin.reference_images[0]} alt="" className="w-4 h-4 rounded-full object-cover" />}
                        {twin.name}
                        <button onClick={() => setSelectedTwins(prev => prev.filter(t => t.id !== twin.id))} className="ml-0.5 hover:text-destructive">
                          <X className="w-3 h-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Advanced Options — Collapsible */}
            <Collapsible>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" className="w-full justify-between gap-2 text-muted-foreground hover:text-foreground">
                  <span className="flex items-center gap-2">
                    <Settings2 className="w-4 h-4" />
                    Advanced Options
                  </span>
                  <ChevronDown className="w-4 h-4" />
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-4 pt-2">
                {/* Movie Length */}
                <div className="space-y-2">
                  <Label>Movie Length</Label>
                  <Select value={movieLength} onValueChange={setMovieLength}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {MOVIE_LENGTH_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{opt.label}</span>
                            <span className="text-xs text-muted-foreground">{opt.description}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Character Selection */}
                {userId && (
                  <Card className="bg-card border-border">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base flex items-center gap-2"><User className="w-4 h-4 text-primary" />Cast Characters</CardTitle>
                      <CardDescription className="text-xs">Optional — AI will create characters if none selected</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex gap-2">
                        <Button size="sm" variant={characterSourceTab === 'twins' ? 'default' : 'outline'} onClick={() => setCharacterSourceTab('twins')} className="flex-1">AI Twins ({aiTwins.length})</Button>
                        <Button size="sm" variant={characterSourceTab === 'characters' ? 'default' : 'outline'} onClick={() => setCharacterSourceTab('characters')} className="flex-1">Characters ({characters.length})</Button>
                        <Button size="sm" variant={characterSourceTab === 'gallery' ? 'default' : 'outline'} onClick={() => setCharacterSourceTab('gallery')} className="flex-1">Gallery ({galleryImages.length})</Button>
                      </div>

                      {characterSourceTab === 'twins' && (
                        <div className="space-y-3">
                          {aiTwins.length === 0 ? (
                            <p className="text-sm text-muted-foreground text-center py-4">No AI Twins yet. Create one in the AI Twin section.</p>
                          ) : (
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-48 overflow-y-auto">
                              {aiTwins.map(twin => {
                                const isSelected = selectedTwins.some(t => t.id === twin.id);
                                return (
                                  <div key={twin.id} onClick={() => toggleTwinSelection(twin)}
                                    className={`cursor-pointer p-2 rounded-lg border transition-all ${isSelected ? 'border-primary bg-primary/10 ring-2 ring-primary' : 'border-border hover:border-primary/50'}`}
                                  >
                                    <div className="flex items-center gap-2">
                                      {twin.reference_images?.[0] ? (
                                        <img src={twin.reference_images[0]} alt={twin.name} className="w-10 h-10 rounded-full object-cover" />
                                      ) : (
                                        <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center"><User className="w-5 h-5 text-muted-foreground" /></div>
                                      )}
                                      <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium truncate">{twin.name}</p>
                                        {isSelected && <Badge variant="default" className="text-[10px] px-1 py-0">✓</Badge>}
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      )}

                      {characterSourceTab === 'characters' && (
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-48 overflow-y-auto">
                          {characters.length === 0 ? (
                            <p className="text-sm text-muted-foreground text-center py-4 col-span-full">No characters yet.</p>
                          ) : (
                            characters.map(char => (
                              <div key={char.id} onClick={() => { setSelectedCharacterId(char.id); setSelectedTwins([]); setSelectedGalleryImage(null); }}
                                className={`cursor-pointer p-2 rounded-lg border transition-all ${selectedCharacterId === char.id ? 'border-primary bg-primary/10 ring-2 ring-primary' : 'border-border hover:border-primary/50'}`}
                              >
                                <div className="flex items-center gap-2">
                                  {char.reference_images?.[0] ? (
                                    <img src={char.reference_images[0]} alt={char.name} className="w-10 h-10 rounded-full object-cover" />
                                  ) : (
                                    <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center"><User className="w-5 h-5 text-muted-foreground" /></div>
                                  )}
                                  <p className="text-sm font-medium truncate">{char.name}</p>
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      )}

                      {characterSourceTab === 'gallery' && (
                        <div className="grid grid-cols-4 sm:grid-cols-5 gap-2 max-h-48 overflow-y-auto">
                          {galleryImages.length === 0 ? (
                            <p className="text-sm text-muted-foreground text-center py-4 col-span-full">No gallery images yet.</p>
                          ) : (
                            galleryImages.map(img => (
                              <div key={img.id} onClick={() => { setSelectedGalleryImage(img); setSelectedTwins([]); setSelectedCharacterId(null); }}
                                className={`cursor-pointer rounded-lg border overflow-hidden transition-all ${selectedGalleryImage?.id === img.id ? 'border-primary ring-2 ring-primary' : 'border-border hover:border-primary/50'}`}
                              >
                                <img src={img.image_url} alt="Gallery" className="w-full aspect-square object-cover" />
                              </div>
                            ))
                          )}
                        </div>
                      )}

                      {(selectedTwins.length > 0 || selectedCharacter || selectedGalleryImage) && (
                        <Button size="sm" variant="ghost" onClick={() => { setSelectedTwins([]); setSelectedCharacterId(null); setSelectedGalleryImage(null); }} className="w-full text-muted-foreground">
                          <X className="w-4 h-4 mr-2" />Clear Selection
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                )}

                {/* Step-by-step buttons */}
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-px bg-border" />
                  <span className="text-xs text-muted-foreground px-2">or step by step</span>
                  <div className="flex-1 h-px bg-border" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Button onClick={generateStoryBible} disabled={isGeneratingStoryBible || !movieIdea.trim() || isGeneratingAll} variant="outline" size="sm">
                    {isGeneratingStoryBible ? (<><Sparkles className="w-4 h-4 mr-2 animate-spin" />Story Bible...</>) : (<><BookOpen className="w-4 h-4 mr-2" />Story Bible</>)}
                  </Button>
                  <Button onClick={generateOutline} disabled={isGenerating || !movieIdea.trim() || isGeneratingAll} variant="outline" size="sm">
                    {isGenerating ? (<><Sparkles className="w-4 h-4 mr-2 animate-spin" />Outline...</>) : (<><FileText className="w-4 h-4 mr-2" />Outline</>)}
                  </Button>
                </div>
              </CollapsibleContent>
            </Collapsible>

            {/* Step navigation */}
            {movieIdea.trim() && (
              <div className="flex justify-end">
                <Button onClick={() => setCurrentStep(1)} className="gap-2">
                  Next: Story Bible <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            )}
          </div>
        )}

        {/* ===== STEP 2: Story Bible — Read-Only Summary (Advanced only) ===== */}
        {isAdvanced && currentStep === 1 && (
          <div className="space-y-6">
            {storyBible ? (
              <Card className="border-primary/30 bg-gradient-to-br from-primary/5 to-transparent">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2">
                    <BookOpen className="w-5 h-5 text-primary" />
                    Story Bible
                  </CardTitle>
                  <CardDescription className="text-base">{storyBible.logline}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Characters Summary */}
                  <div>
                    <Label className="text-sm font-semibold mb-2 block">Characters ({storyBible.characters.length})</Label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {storyBible.characters.map((char, idx) => (
                        <div key={idx} className="p-2 bg-muted/50 rounded-lg border">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge variant={char.role === 'protagonist' ? 'default' : 'secondary'} className="capitalize text-xs">{char.role}</Badge>
                            <span className="font-medium text-sm">{char.name}</span>
                            {char.assignedTwinName && (
                              <Badge variant="outline" className="text-[10px] gap-1"><Volume2 className="w-2.5 h-2.5" />{char.assignedTwinName}</Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground line-clamp-1">{char.wardrobe}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Three-Act Structure — always visible as summary */}
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div className="p-2 bg-primary/5 rounded border border-primary/10">
                      <p className="font-medium text-primary">Setup</p>
                      <p className="text-muted-foreground line-clamp-3">{storyBible.threeActStructure.setup}</p>
                    </div>
                    <div className="p-2 bg-accent/50 rounded border border-accent">
                      <p className="font-medium text-accent-foreground">Confrontation</p>
                      <p className="text-muted-foreground line-clamp-3">{storyBible.threeActStructure.confrontation}</p>
                    </div>
                    <div className="p-2 bg-destructive/5 rounded border border-destructive/10">
                      <p className="font-medium text-destructive">Resolution</p>
                      <p className="text-muted-foreground line-clamp-3">{storyBible.threeActStructure.resolution}</p>
                    </div>
                  </div>

                  {/* Edit toggle for voice assignments */}
                  <Collapsible>
                    <CollapsibleTrigger asChild>
                      <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground">
                        <Pencil className="w-3.5 h-3.5" />
                        Edit Voice Assignments
                      </Button>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="pt-2">
                      <div className="space-y-3 max-h-60 overflow-y-auto">
                        {storyBible.characters.map((char, idx) => (
                          <div key={idx} className="flex items-center gap-2 p-2 bg-muted/30 rounded-lg border text-sm">
                            <span className="font-medium flex-shrink-0">{char.name}</span>
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
                              <SelectTrigger className="h-8 text-xs flex-1"><SelectValue placeholder="Assign voice..." /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="default">Default AI Voice</SelectItem>
                                {aiTwins.filter(t => t.voice_cloning_key).map(twin => (
                                  <SelectItem key={twin.id} value={twin.id}>{twin.name}'s Voice</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        ))}
                      </div>
                    </CollapsibleContent>
                  </Collapsible>

                  {/* Primary CTA */}
                  <Button onClick={() => setCurrentStep(2)} className="w-full gap-2" size="lg">
                    Looks good, continue <ChevronRight className="w-4 h-4" />
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <Card className="border-dashed">
                <CardContent className="py-12 text-center space-y-4">
                  <BookOpen className="w-12 h-12 mx-auto text-muted-foreground/50" />
                  <div>
                    <h3 className="font-semibold text-foreground">No Story Bible Yet</h3>
                    <p className="text-sm text-muted-foreground mt-1">Go back to Step 1 and generate your movie.</p>
                  </div>
                  <Button variant="outline" onClick={() => setCurrentStep(0)}>
                    <ChevronLeft className="w-4 h-4 mr-2" />Back to Concept
                  </Button>
                </CardContent>
              </Card>
            )}

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setCurrentStep(0)} className="gap-2">
                <ChevronLeft className="w-4 h-4" /> Back
              </Button>
              <Button onClick={() => setCurrentStep(2)} className="gap-2" disabled={!storyBible && !outline}>
                Next: Outline <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}

        {/* ===== STEP 3: Outline (Advanced only) ===== */}
        {isAdvanced && currentStep === 2 && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="w-5 h-5 text-primary" />
                    Movie Outline
                  </CardTitle>
                  {outline.trim() && (
                    <Button variant="ghost" size="sm" onClick={() => setShowStoryBibleEditor(!showStoryBibleEditor)} className="gap-1 text-muted-foreground">
                      <Pencil className="w-3.5 h-3.5" />
                      {showStoryBibleEditor ? 'View' : 'Edit'}
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {outline.trim() ? (
                  showStoryBibleEditor ? (
                    <Textarea value={outline} onChange={(e) => setOutline(e.target.value)} rows={12} className="resize-none" />
                  ) : (
                    <div className="p-4 bg-muted/30 rounded-lg border max-h-80 overflow-y-auto">
                      <p className="text-sm whitespace-pre-wrap text-foreground">{outline}</p>
                    </div>
                  )
                ) : (
                  <div className="text-center py-8 space-y-3">
                    <FileText className="w-10 h-10 mx-auto text-muted-foreground/50" />
                    <p className="text-muted-foreground">No outline generated yet.</p>
                    <Button onClick={generateOutline} disabled={isGenerating || !movieIdea.trim()} variant="outline">
                      {isGenerating ? (<><Sparkles className="w-4 h-4 mr-2 animate-spin" />Generating...</>) : (<><Sparkles className="w-4 h-4 mr-2" />Generate Outline</>)}
                    </Button>
                  </div>
                )}

                {outline.trim() && (
                  <Button onClick={generateScenes} disabled={!outline.trim() || isGeneratingScenes} className="w-full" size="lg">
                    {isGeneratingScenes ? (<><Sparkles className="w-4 h-4 mr-2 animate-spin" />Generating Scenes...</>) : (<><Clapperboard className="w-4 h-4 mr-2" />Generate Scenes</>)}
                  </Button>
                )}
              </CardContent>
            </Card>

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setCurrentStep(1)} className="gap-2">
                <ChevronLeft className="w-4 h-4" /> Back
              </Button>
              <Button onClick={() => setCurrentStep(3)} className="gap-2" disabled={scenes.length === 0}>
                Next: Scenes <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}

        {/* ===== STEP 4: Scenes (Advanced only) ===== */}
        {isAdvanced && currentStep === 3 && (
          <div className="space-y-6">
            {scenes.length > 0 ? (
              <div className="space-y-4">
                {/* Header */}
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-2xl font-bold text-foreground">Your Movie</h2>
                    <p className="text-sm text-muted-foreground">{scenes.length} scenes • {scenes.filter(s => s.generatedVideo).length} videos ready</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {scenes.some(s => s.generatedVideo) && (
                      <Button onClick={stitchAllVideos} disabled={isStitching} className="gap-2">
                        {isStitching ? (<><Sparkles className="w-4 h-4 animate-spin" />Building {stitchProgress}%...</>) : (<><Video className="w-4 h-4" />Build & Download</>)}
                      </Button>
                    )}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="icon" className="h-9 w-9"><MoreVertical className="w-4 h-4" /></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={regenerateAllDialogue} disabled={isRegeneratingDialogue}>
                          <Volume2 className="w-4 h-4 mr-2" />Regenerate All Dialogue
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>

                {/* Stitching progress */}
                {isStitching && (
                  <div className="flex items-center gap-3 p-4 rounded-lg bg-primary/5 border border-primary/20">
                    <Sparkles className="w-5 h-5 text-primary animate-spin shrink-0" />
                    <div className="flex-1 space-y-2">
                      <p className="text-sm font-medium text-foreground">Building your movie...</p>
                      <Progress value={stitchProgress} className="h-1.5" />
                    </div>
                    <span className="text-sm font-mono text-muted-foreground">{stitchProgress}%</span>
                  </div>
                )}

                {/* Preview banner before video generation */}
                {isPreviewingBeforeVideo && (
                  <Card className="border-primary bg-gradient-to-r from-primary/5 to-primary/10">
                    <CardContent className="py-4 space-y-3">
                      <div className="flex items-center gap-2">
                        <Eye className="w-5 h-5 text-primary" />
                        <h3 className="font-semibold text-foreground">Preview Your Scenes</h3>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Review the scenes, dialogue, and images below. When you're happy, click "Generate Videos" to bring them to life.
                      </p>
                      <div className="flex gap-2">
                        <Button onClick={continueVideoGeneration} className="gap-2 bg-gradient-to-r from-primary to-primary/80">
                          <Video className="w-4 h-4" />
                          Generate Videos
                        </Button>
                        <Button variant="outline" onClick={() => { setIsPreviewingBeforeVideo(false); setPendingVideoGeneration(null); }}>
                          Edit First
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Completed movie player */}
                {stitchedVideoUrl && (
                  <Card className="bg-primary/5 border-primary/20">
                    <CardContent className="pt-6 space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Video className="w-5 h-5 text-primary" />
                          <h3 className="font-semibold text-foreground">Complete Movie</h3>
                        </div>
                        <Button onClick={() => { const a = document.createElement('a'); a.href = stitchedVideoUrl; a.download = `${projectTitle || 'movie'}.mp4`; a.click(); }} variant="outline" size="sm" className="gap-2">
                          <Download className="w-3.5 h-3.5" /> Download
                        </Button>
                      </div>
                      <video src={stitchedVideoUrl} controls className="w-full rounded-lg border border-border" />
                    </CardContent>
                  </Card>
                )}

                {/* Scene timeline */}
                <SceneTimeline
                  scenes={scenes as MovieSceneWithKeyframes[]}
                  activeSceneIndex={activeSceneIndex}
                  onSelectScene={setActiveSceneIndex}
                  autoLinkEnabled={autoLinkScenes}
                  onToggleAutoLink={() => setAutoLinkScenes(!autoLinkScenes)}
                  onBuildMovie={stitchAllVideos}
                  isBuildingMovie={isStitching}
                  buildProgress={stitchProgress}
                  hasVideos={scenes.some(s => s.generatedVideo)}
                />

                {/* Scene cards */}
                <div className="space-y-3">
                  {scenes.map((scene, index) => (
                    <KeyframeSceneCard
                      key={scene.sceneNumber}
                      scene={{
                        ...scene,
                        startFrame: scene.startFrame || { imagePrompt: '', cameraAngle: 'eye-level', position: '' },
                        endFrame: scene.endFrame || { imagePrompt: '', cameraAngle: 'eye-level', position: '' },
                        transitionAction: scene.transitionAction || '',
                        transitionCameraMovement: scene.transitionCameraMovement || 'static',
                      dialogue: typeof scene.dialogue === 'string' ? scene.dialogue : Array.isArray(scene.dialogue) ? scene.dialogue.map((d: any) => `${d.character}: ${d.line}`).join('\n') : null
                      } as MovieSceneWithKeyframes}
                      sceneIndex={index} totalScenes={scenes.length}
                      isGeneratingImage={generatingImageFor === scene.sceneNumber || (generatingFrameFor?.sceneNumber === scene.sceneNumber)}
                      isGeneratingVideo={generatingVideoFor === scene.sceneNumber}
                      isDescribingScene={describingSceneFor?.sceneNumber === scene.sceneNumber}
                      characterName={selectedTwins.length > 0 ? selectedTwins[0]?.name : selectedCharacter?.name}
                      secondCharacterName={selectedTwins.length > 1 ? selectedTwins[1]?.name : undefined}
                      onUpdateScene={(sceneNum, updates) => { setScenes(prev => prev.map(s => s.sceneNumber === sceneNum ? { ...s, ...updates } : s)); }}
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
                  ))}
                </div>
              </div>
            ) : (
              <Card className="border-dashed">
                <CardContent className="py-12 text-center space-y-4">
                  <Clapperboard className="w-12 h-12 mx-auto text-muted-foreground/50" />
                  <div>
                    <h3 className="font-semibold text-foreground">No Scenes Yet</h3>
                    <p className="text-sm text-muted-foreground mt-1">Go back and generate scenes from your outline.</p>
                  </div>
                  <Button variant="outline" onClick={() => setCurrentStep(2)}>
                    <ChevronLeft className="w-4 h-4 mr-2" />Back to Outline
                  </Button>
                </CardContent>
              </Card>
            )}

            <div className="flex justify-start">
              <Button variant="outline" onClick={() => setCurrentStep(2)} className="gap-2">
                <ChevronLeft className="w-4 h-4" /> Back
              </Button>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default MovieSceneCreator;
