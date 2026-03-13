import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import { VideoPlayer } from '@/components/VideoPlayer';
import { useIsMobile } from '@/hooks/use-mobile';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';
import { downloadVideo } from '@/lib/reelVideoCreator';
import { canvasStitchVideos } from '@/lib/canvasStitch';
import { getAudioDuration } from '@/lib/audioUtils';
import { TemplateSelector } from '@/components/TemplateSelector';
import { VideoPlayerWithOverlay } from '@/components/VideoPlayerWithOverlay';
import { ReelFeatureSidebar, ReelMode } from '@/components/ReelFeatureSidebar';
import { useCreatorMode } from '@/hooks/useCreatorMode';
import { CreatorModeToggle } from '@/components/CreatorModeToggle';
import { VideoUpscaler } from '@/components/VideoUpscaler';
import { CameraAngleSelector } from '@/components/CameraAngleSelector';
import { CAMERA_ANGLES } from '@/data/cameraAngles';
import { LogoAnimation } from '@/data/reelTemplates';
import { useReelDraftAutoSave, StrategistState } from '@/hooks/useReelDraftAutoSave';
import { useVideoQueue, QueuedVideo } from '@/hooks/useVideoQueue';
import { 
  Sparkles, 
  FileText, 
  Mic, 
  MicOff,
  Video, 
  Download,
  Loader2,
  RefreshCw,
  Captions,
  History,
  Trash2,
  Play,
  ChevronDown,
  Palette,
  
  Monitor,
  Layers,
  User,
  Upload,
  X,
  Image as ImageIcon,
  Camera,
  Wand2,
  FolderOpen,
  Copy,
  AlertCircle,
  ListChecks,
  Save,
  FileEdit,
  Pencil,
  ChevronUp,
  ArrowUp,
  ArrowDown
} from 'lucide-react';
import { ScenePreview } from '@/components/ScenePreview';
import { useScenePreview } from '@/hooks/useScenePreview';
import { FrameCapture } from '@/components/FrameCapture';
import { VoiceSelector } from '@/components/VoiceSelector';
import { GalleryImagePicker } from '@/components/GalleryImagePicker';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { ScriptGenerator } from '@/components/ScriptGenerator';
import { ReelEditor } from '@/components/ReelEditor';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { TopicStrategist, ContentStrategy } from '@/components/TopicStrategist';
import { VideoQueue } from '@/components/VideoQueue';

// Speech Recognition types
interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionResultList {
  length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  isFinal: boolean;
  length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
}

interface ISpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
}

declare global {
  interface Window {
    SpeechRecognition: new () => ISpeechRecognition;
    webkitSpeechRecognition: new () => ISpeechRecognition;
  }
}

interface Scene {
  sceneNumber: number;
  narration: string;
  visualDescription: string;
  duration: number;
  isIntro?: boolean;
  isOutro?: boolean;
  templateId?: string;
}

interface GeneratedScene {
  sceneNumber: number;
  text: string;
  imageUrl: string | null;
  savedImageUrl?: string | null;
  videoUrl?: string | null;
  startTime: number;
  endTime: number;
  isIntro?: boolean;
  isOutro?: boolean;
}

interface VideoClip {
  sceneNumber: number;
  videoUrl: string;
}

interface PreviewScene {
  sceneNumber: number;
  narration: string;
  visualDescription: string;
  imageUrl: string | null;
  audioUrl: string | null;
  audioDuration: number;
  isGenerating: boolean;
  isRegenerating?: boolean;
}

interface ReelProject {
  topic: string;
  scenes: Scene[];
  voiceovers: { sceneNumber: number; audioUrl: string; storageUrl?: string; duration: number }[];
  videoUrl: string | null;
  videoBlobUrl: string | null;
  generatedScenes: GeneratedScene[];
  videoClips: VideoClip[];
  previewScenes: PreviewScene[];
  status: 'idle' | 'generating-script' | 'generating-preview' | 'preview-ready' | 'generating-video' | 'rendering-video' | 'complete';
}

interface SavedReel {
  id: string;
  topic: string;
  video_url: string | null;
  thumbnail_url: string | null;
  audio_url?: string | null;
  scenes: GeneratedScene[];
  total_duration: number;
  created_at: string;
  caption_settings?: {
    enabled: boolean;
    style: string;
    background: string;
    position: string;
  };
  is_draft?: boolean;
  draft_state?: DraftState | null;
}

interface DraftState {
  selectedSceneCount: string;
  selectedSceneDuration: string;
  selectedVoice: string;
  selectedVideoSize: string;
  transitionStyle: string;
  hookStyle: string;
  characterDescription: string;
  preSelectedReference: string | null;
  selectedTwinId: string | null;
  selectedIntro: string;
  selectedOutro: string;
  introText: string;
  outroText: string;
  enableCutScenes: boolean;
  enableLipSync: boolean;
  portraitImage: string | null;
  featureToggles: {
    introOutro: boolean;
    cutScenes: boolean;
    upscaler: boolean;
    lipSync: boolean;
    captions: boolean;
    backgroundMusic: boolean;
  };
  strategist?: StrategistState;
  scenes: Scene[];
  previewScenes: PreviewScene[];
  voiceovers: { sceneNumber: number; audioUrl: string; storageUrl?: string; duration: number }[];
  // Custom audio upload state
  customAudioMode: 'tts' | 'upload';
  customAudioUrl: string | null;
  customAudioDuration: number;
}

const SCENE_COUNT_OPTIONS = [
  { value: '2', label: '2 scenes' },
  { value: '3', label: '3 scenes' },
  { value: '4', label: '4 scenes' },
  { value: '5', label: '5 scenes' },
  { value: '6', label: '6 scenes' },
];

const SCENE_DURATION_OPTIONS = [
  { value: '8', label: '8 seconds' },
  { value: '10', label: '10 seconds' },
  { value: '12', label: '12 seconds' },
  { value: '15', label: '15 seconds' },
  { value: '20', label: '20 seconds' },
  { value: '30', label: '30 seconds' },
];

const PODCAST_DURATION_OPTIONS = [
  { value: '30', label: '30 seconds' },
  { value: '60', label: '1 minute' },
  { value: '120', label: '2 minutes' },
  { value: '180', label: '3 minutes' },
  { value: '300', label: '5 minutes' },
];

const VIDEO_SIZE_OPTIONS = [
  { value: '9:16', label: 'Reel/Story (9:16)', description: 'Portrait - TikTok, Reels, Stories' },
  { value: '1:1', label: 'Square (1:1)', description: 'Instagram Feed, Facebook' },
  { value: '16:9', label: 'Landscape (16:9)', description: 'YouTube, Presentations' },
  { value: '4:5', label: 'Portrait (4:5)', description: 'Instagram Feed Portrait' },
];

const Reels = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const { mode: creatorMode, setMode: setCreatorMode, isAdvanced, isBeginner } = useCreatorMode();
  const [searchParams, setSearchParams] = useSearchParams();
  const [topic, setTopic] = useState('');
  const [selectedSceneCount, setSelectedSceneCount] = useState('4');
  const [selectedSceneDuration, setSelectedSceneDuration] = useState('12');
  const [project, setProject] = useState<ReelProject>({
    topic: '',
    scenes: [],
    voiceovers: [],
    videoUrl: null,
    videoBlobUrl: null,
    generatedScenes: [],
    videoClips: [],
    previewScenes: [],
    status: 'idle'
  });
  const [progress, setProgress] = useState(0);
  const [progressStatus, setProgressStatus] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [savedReels, setSavedReels] = useState<SavedReel[]>([]);
  const [loadingReels, setLoadingReels] = useState(true);
  const [activeTab, setActiveTab] = useState('create');
  const [isSavingReel, setIsSavingReel] = useState(false);
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [currentReelSaved, setCurrentReelSaved] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [videoError, setVideoError] = useState<string | null>(null);
  const [selectedClipIndex, setSelectedClipIndex] = useState<number>(0);
  const [draftReels, setDraftReels] = useState<SavedReel[]>([]);
  
  // Movie Scene Creator source tracking
  const [fromMovieScene, setFromMovieScene] = useState(false);
  
  // Template state
  const [selectedIntro, setSelectedIntro] = useState('none');
  const [selectedOutro, setSelectedOutro] = useState('none');
  const [introText, setIntroText] = useState('');
  const [outroText, setOutroText] = useState('');
  const [templateSectionOpen, setTemplateSectionOpen] = useState(false);
  
  // Stitching state
  const [isManualStitching, setIsManualStitching] = useState(false);
  const [editingSceneNumber, setEditingSceneNumber] = useState<number | null>(null);
  const [editSceneText, setEditSceneText] = useState('');
  
  // Scene preview hook
  const { 
    previewScenes, 
    voiceovers: previewVoiceovers,
    isGeneratingPreview, 
    progress: previewProgress, 
    progressStatus: previewProgressStatus,
    referenceImageUrl,
    characterTransformation,
    setCharacterTransformation,
    generatePreview,
    regenerateSceneImage,
    regenerateWithReference,
    setSceneAsReference,
    setExternalReference,
    clearReference,
    resetPreview
  } = useScenePreview();
  
  // Lip sync mode
  const [enableLipSync, setEnableLipSync] = useState(false);
  const [lipSyncModel, setLipSyncModel] = useState<'infinitetalk' | 'avatar-omni-human-1.5' | 'wan-animate'>('infinitetalk');
  const [portraitImage, setPortraitImage] = useState<string | null>(null);
  const [portraitPreview, setPortraitPreview] = useState<string | null>(null);
  // Voice selection for TTS (WaveSpeed MiniMax HD voices)
  const [selectedVoice, setSelectedVoice] = useState<string>('ai-auto');
  
  // Custom audio upload for lip sync
  const [customAudioMode, setCustomAudioMode] = useState<'tts' | 'upload'>('tts');
  const [customAudioUrl, setCustomAudioUrl] = useState<string | null>(null);
  const [customAudioDuration, setCustomAudioDuration] = useState<number>(0);
  const [isUploadingAudio, setIsUploadingAudio] = useState(false);
  const customAudioInputRef = useRef<HTMLInputElement>(null);
  
  // Transition style for video stitching
  const [transitionStyle, setTransitionStyle] = useState<'fade' | 'slide' | 'zoom' | 'crossfade' | 'wipe' | 'blur' | 'dissolve' | 'spin' | 'flip' | 'none'>('crossfade');
  
  // Podcast mode
  const [isPodcastMode, setIsPodcastMode] = useState(false);
  const [podcastDuration, setPodcastDuration] = useState('60');
  const [selectedCharacterId, setSelectedCharacterId] = useState<string | null>(null);
  
  const portraitInputRef = useRef<HTMLInputElement>(null);
  
  // Pre-generation reference image selection
  const [preSelectedReference, setPreSelectedReference] = useState<string | null>(null);
  const [preReferenceTransformation, setPreReferenceTransformation] = useState('');
  const [characters, setCharacters] = useState<{ id: string; name: string; reference_images: string[] }[]>([]);
  const [aiTwins, setAiTwins] = useState<{ id: string; name: string; reference_images: string[]; voice_cloning_key: string | null; voice_sample_url: string | null; face_description: string | null }[]>([]);
  const [selectedTwinId, setSelectedTwinId] = useState<string | null>(null);
  const [hookStyle, setHookStyle] = useState<string>('auto');
  const [enableCutScenes, setEnableCutScenes] = useState(false);
  const [characterDescription, setCharacterDescription] = useState('');
  const [isAnalyzingReference, setIsAnalyzingReference] = useState(false);
  const referenceInputRef = useRef<HTMLInputElement>(null);
  
  // Camera angle and logo state
  const [selectedCameraAngle, setSelectedCameraAngle] = useState('eye-level');
  const [selectedLogoUrl, setSelectedLogoUrl] = useState<string | null>(null);
  const [selectedLogoAnimation, setSelectedLogoAnimation] = useState<LogoAnimation>('fade');
  
  // Generate Character state
  const [showGenerateCharacter, setShowGenerateCharacter] = useState(false);
  const [generateCharacterPrompt, setGenerateCharacterPrompt] = useState('');
  const [isGeneratingCharacter, setIsGeneratingCharacter] = useState(false);
  
  // Voice preview state
  const [isPreviewingVoice, setIsPreviewingVoice] = useState(false);
  const [voicePreviewAudio, setVoicePreviewAudio] = useState<HTMLAudioElement | null>(null);
  // Intro/CTA slide state
  const [showIntroSlideForm, setShowIntroSlideForm] = useState(false);
  const [showCtaSlideForm, setShowCtaSlideForm] = useState(false);
  const [introSlideHeadline, setIntroSlideHeadline] = useState('');
  const [introSlideSubtitle, setIntroSlideSubtitle] = useState('');
  const [ctaSlideHeadline, setCtaSlideHeadline] = useState('');
  const [ctaSlideSubtitle, setCtaSlideSubtitle] = useState('');
  
  // Video size state
  const [selectedVideoSize, setSelectedVideoSize] = useState('9:16');
  
  // Enhancement sections expanded state
  const [cutScenesExpanded, setCutScenesExpanded] = useState(false);
  const [lipSyncExpanded, setLipSyncExpanded] = useState(false);
  const [showScriptGenerator, setShowScriptGenerator] = useState(false);
  
  // Feature sidebar state
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [activeMode, setActiveMode] = useState<ReelMode>('standard');
  const [featureToggles, setFeatureToggles] = useState({
    introOutro: false,
    cutScenes: false,
    upscaler: false,
    lipSync: false,
    captions: true,
    backgroundMusic: false
  });
  const [editingReel, setEditingReel] = useState<SavedReel | null>(null);
  const [showUpscaler, setShowUpscaler] = useState(false);
  
  // Strategist state for persistence
  const [strategistState, setStrategistState] = useState<StrategistState>({
    niche: '',
    videoDuration: 'mix',
    includePromotional: false,
    strategy: null
  });
  
  // Sync feature toggles with existing state
  const handleFeatureChange = (feature: keyof typeof featureToggles, value: boolean) => {
    setFeatureToggles(prev => ({ ...prev, [feature]: value }));
    
    // Sync with existing state and expand sections when enabled
    if (feature === 'introOutro') {
      setTemplateSectionOpen(value);
    } else if (feature === 'cutScenes') {
      setEnableCutScenes(value);
      if (value) setCutScenesExpanded(true);
    } else if (feature === 'lipSync') {
      setEnableLipSync(value);
      if (value) setLipSyncExpanded(true);
    } else if (feature === 'upscaler') {
      setShowUpscaler(value);
    } else if (feature === 'captions') {
      // Captions are enabled by default - could add caption settings expansion
    } else if (feature === 'backgroundMusic') {
      // Background music toggle - could add music selection UI
    }
  };
  
  // Sync mode changes
  const handleModeChange = (mode: ReelMode) => {
    setActiveMode(mode);
    if (mode === 'podcast') {
      setIsPodcastMode(true);
    } else {
      setIsPodcastMode(false);
    }
    // Open script generator dialog when script-only mode is selected
    if (mode === 'script-only') {
      setShowScriptGenerator(true);
    }
  };
  
  const videoBlobRef = useRef<Blob | null>(null);
  const recognitionRef = useRef<ISpeechRecognition | null>(null);
  const draftRestoredRef = useRef(false);

  // Auto-save hook
  const { 
    saveDraftDebounced, 
    loadDraft, 
    clearDraft, 
    hasDraft, 
    getDraftAge,
    notifyDraftRestored 
  } = useReelDraftAutoSave();

  // Video queue hook
  const { queueCount } = useVideoQueue();

  // State for showing draft recovery banner
  const [showDraftRecoveryBanner, setShowDraftRecoveryBanner] = useState(false);
  const [draftAge, setDraftAge] = useState('');

  // Check for draft on mount
  useEffect(() => {
    if (draftRestoredRef.current) return;
    
    // Don't check for draft if we're coming from Movie Scene Creator
    const source = searchParams.get('source');
    if (source === 'movie-scene') return;
    
    if (hasDraft()) {
      setDraftAge(getDraftAge());
      setShowDraftRecoveryBanner(true);
    }
  }, []);

  // Restore draft function
  const restoreDraft = useCallback(() => {
    const draft = loadDraft();
    if (!draft) return;

    draftRestoredRef.current = true;
    setShowDraftRecoveryBanner(false);

    // Restore all persisted state
    setTopic(draft.topic || '');
    setSelectedSceneCount(draft.selectedSceneCount || '4');
    setSelectedSceneDuration(draft.selectedSceneDuration || '12');
    setSelectedVoice(draft.selectedVoice || 'en-US-Journey-F');
    setSelectedVideoSize(draft.selectedVideoSize || '9:16');
    setTransitionStyle((draft.transitionStyle as any) || 'crossfade');
    setHookStyle(draft.hookStyle || 'auto');
    setCharacterDescription(draft.characterDescription || '');
    setPreSelectedReference(draft.preSelectedReference);
    setSelectedTwinId(draft.selectedTwinId);
    setSelectedIntro(draft.selectedIntro || 'none');
    setSelectedOutro(draft.selectedOutro || 'none');
    setIntroText(draft.introText || '');
    setOutroText(draft.outroText || '');
    setEnableCutScenes(draft.enableCutScenes || false);
    setEnableLipSync(draft.enableLipSync || false);
    setPortraitImage(draft.portraitImage);
    setFeatureToggles(draft.featureToggles || {
      introOutro: false,
      cutScenes: false,
      upscaler: false,
      lipSync: false,
      captions: true,
      backgroundMusic: false
    });

    // Restore project state
    if (draft.project) {
      setProject({
        topic: draft.project.topic || '',
        scenes: draft.project.scenes || [],
        voiceovers: draft.project.voiceovers || [],
        videoUrl: null, // Don't restore blob URLs
        videoBlobUrl: null,
        generatedScenes: draft.project.generatedScenes || [],
        videoClips: draft.project.videoClips || [],
        previewScenes: draft.project.previewScenes || [],
        status: 'idle' // Reset status
      });
    }

    // Restore strategist state
    if (draft.strategist) {
      setStrategistState(draft.strategist);
    }

    notifyDraftRestored();
  }, [loadDraft, notifyDraftRestored]);

  // Dismiss draft and clear it
  const dismissDraft = useCallback(() => {
    setShowDraftRecoveryBanner(false);
    clearDraft();
  }, [clearDraft]);

  // Auto-save effect - triggers on key state changes
  useEffect(() => {
    // Skip auto-save if we're generating or nothing meaningful to save
    if (isGenerating) return;
    
    const hasContent = topic.trim() || project.scenes.length > 0 || project.previewScenes.length > 0 || strategistState.strategy || strategistState.niche.trim();
    if (!hasContent) return;

    saveDraftDebounced({
      topic,
      selectedSceneCount,
      selectedSceneDuration,
      selectedVoice,
      selectedVideoSize,
      transitionStyle,
      hookStyle,
      characterDescription,
      preSelectedReference,
      selectedTwinId,
      selectedIntro,
      selectedOutro,
      introText,
      outroText,
      enableCutScenes,
      enableLipSync,
      portraitImage,
      project: {
        topic: project.topic,
        scenes: project.scenes,
        voiceovers: project.voiceovers,
        generatedScenes: project.generatedScenes,
        videoClips: project.videoClips,
        previewScenes: project.previewScenes,
        status: project.status
      },
      featureToggles,
      strategist: strategistState
    });
  }, [
    topic, project.topic, project.scenes, project.voiceovers, 
    project.generatedScenes, project.videoClips, project.previewScenes,
    selectedSceneCount, selectedSceneDuration, selectedVoice, selectedVideoSize,
    transitionStyle, hookStyle, characterDescription, preSelectedReference, selectedTwinId,
    selectedIntro, selectedOutro, introText, outroText, enableCutScenes, enableLipSync,
    portraitImage, featureToggles, strategistState, isGenerating, saveDraftDebounced
  ]);

  // Clear draft when reel is successfully saved to database
  const handleReelSavedSuccessfully = useCallback(() => {
    clearDraft();
    setCurrentReelSaved(true);
  }, [clearDraft]);

  // Auto-analyze reference image for character description
  const analyzeReferenceImage = async (imageUrl: string) => {
    setIsAnalyzingReference(true);
    try {
      const { data, error } = await supabase.functions.invoke('analyze-reference-image', {
        body: { imageUrl }
      });
      
      if (error) throw error;
      
      if (data?.description) {
        setCharacterDescription(data.description);
        
        // Auto-detect gender from the analysis and set matching voice
        const descLower = data.description.toLowerCase();
        const femaleKeywords = ['woman', 'female', 'girl', 'lady', 'she', 'her', 'mother', 'sister'];
        const maleKeywords = ['man', 'male', 'boy', 'guy', 'he', 'him', 'father', 'brother'];
        const isFemale = femaleKeywords.some(k => descLower.includes(k));
        const isMale = !isFemale && maleKeywords.some(k => descLower.includes(k));
        
        if (isFemale) {
          setSelectedVoice('en-US-Journey-F');
        } else if (isMale) {
          setSelectedVoice('en-US-Journey-D');
        }
        
        toast({
          title: "Character Detected",
          description: `Auto-filled: ${data.description}${isFemale ? ' (female voice set)' : isMale ? ' (male voice set)' : ''}`,
        });
      }
    } catch (error: any) {
      console.error('Failed to analyze reference image:', error);
      // Don't show error toast - just silently fail and let user fill manually
    } finally {
      setIsAnalyzingReference(false);
    }
  };

  // Helper to set reference and trigger analysis
  const handleReferenceSelected = (imageUrl: string) => {
    setPreSelectedReference(imageUrl);
    analyzeReferenceImage(imageUrl);
  };

  const startListening = () => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      toast({
        title: "Not Supported",
        description: "Speech recognition is not supported in your browser. Try Chrome.",
        variant: "destructive"
      });
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onresult = (event) => {
      let transcript = '';
      for (let i = 0; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
      }
      setTopic(transcript);
    };

    recognition.onerror = (event) => {
      console.error('Speech recognition error:', event.error);
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
  };

  const stopListening = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListening(false);
    }
  };

  // Handle portrait image upload for lip sync
  const handlePortraitUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    if (!file.type.startsWith('image/')) {
      toast({
        title: "Invalid File",
        description: "Please upload an image file (JPG, PNG, etc.)",
        variant: "destructive"
      });
      return;
    }
    
    // Create preview
    const reader = new FileReader();
    reader.onload = async (event) => {
      const base64Image = event.target?.result as string;
      setPortraitPreview(base64Image);
      
      // Upload to storage for a persistent URL
      if (user) {
        try {
          const base64Data = base64Image.split(',')[1];
          const binaryString = atob(base64Data);
          const bytes = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }
          
          const fileName = `${user.id}/portraits/${Date.now()}-portrait.${file.type.split('/')[1]}`;
          const { data: uploadData, error: uploadError } = await supabase.storage
            .from('reels')
            .upload(fileName, bytes, { contentType: file.type });
          
          if (!uploadError && uploadData) {
            const { data: publicUrl } = supabase.storage.from('reels').getPublicUrl(fileName);
            setPortraitImage(publicUrl.publicUrl);
            console.log('Uploaded portrait to storage:', publicUrl.publicUrl);
          } else {
            // Fall back to base64
            setPortraitImage(base64Image);
          }
        } catch (err) {
          console.warn('Portrait upload failed, using base64:', err);
          setPortraitImage(base64Image);
        }
      } else {
        setPortraitImage(base64Image);
      }
    };
    reader.readAsDataURL(file);
  };

  const removePortrait = () => {
    setPortraitImage(null);
    setPortraitPreview(null);
    if (portraitInputRef.current) {
      portraitInputRef.current.value = '';
    }
  };

  // Handle custom audio upload for lip sync
  const handleCustomAudioUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const validTypes = ['audio/mpeg', 'audio/wav', 'audio/mp3', 'audio/m4a', 'audio/x-m4a', 'audio/mp4', 'audio/webm'];
    if (!validTypes.includes(file.type) && !file.name.match(/\.(mp3|wav|m4a|webm)$/i)) {
      toast({
        title: "Invalid File",
        description: "Please upload an audio file (MP3, WAV, M4A, WebM)",
        variant: "destructive"
      });
      return;
    }

    if (file.size > 50 * 1024 * 1024) {
      toast({
        title: "File Too Large",
        description: "Audio file must be under 50MB",
        variant: "destructive"
      });
      return;
    }
    
    setIsUploadingAudio(true);
    
    try {
      // Get duration from file
      const audioUrl = URL.createObjectURL(file);
      const duration = await getAudioDuration(audioUrl);
      URL.revokeObjectURL(audioUrl);
      
      // Upload to storage
      if (user) {
        const extension = file.name.split('.').pop() || 'mp3';
        const fileName = `${user.id}/custom-audio/${Date.now()}-custom.${extension}`;
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('reels')
          .upload(fileName, file, { contentType: file.type });
        
        if (uploadError) throw uploadError;
        
        const { data: publicUrl } = supabase.storage.from('reels').getPublicUrl(fileName);
        setCustomAudioUrl(publicUrl.publicUrl);
        setCustomAudioDuration(duration);
        
        toast({
          title: "Audio Uploaded",
          description: `Custom audio ready (${duration.toFixed(1)}s)`
        });
      } else {
        throw new Error('Please sign in to upload audio');
      }
    } catch (err: any) {
      console.error('Custom audio upload error:', err);
      toast({
        title: "Upload Failed",
        description: err.message || "Failed to upload audio file",
        variant: "destructive"
      });
    } finally {
      setIsUploadingAudio(false);
    }
  };

  const removeCustomAudio = () => {
    setCustomAudioUrl(null);
    setCustomAudioDuration(0);
    if (customAudioInputRef.current) {
      customAudioInputRef.current.value = '';
    }
  };

  // Handle Movie Scene Creator transfers
  useEffect(() => {
    const source = searchParams.get('source');
    const transferredTopic = searchParams.get('topic');
    
    if (source === 'movie-scene' && transferredTopic) {
      setTopic(transferredTopic);
      setFromMovieScene(true);
      // Clear params to avoid re-triggering
      setSearchParams({});
      toast({
        title: "Movie Idea Transferred!",
        description: "Your movie idea has been imported. Ready to create your reel!",
      });
    }
  }, [searchParams]);

  // Load characters with retry logic for timeout handling
  const loadCharacters = async (retryCount = 0) => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('characters')
        .select('id, name, reference_images')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);
      
      if (error) {
        if (error.code === '57014' && retryCount < 2) {
          console.log(`Characters query timeout, retrying (${retryCount + 1}/2)...`);
          setTimeout(() => loadCharacters(retryCount + 1), 1000);
          return;
        }
        console.error('Error loading characters:', error);
        return;
      }
      
      if (data) {
        setCharacters(data.filter(c => c.reference_images && c.reference_images.length > 0));
      }
    } catch (err) {
      console.error('Failed to load characters:', err);
    }
  };

  // Load AI twins with retry logic for timeout and network handling
  const loadAiTwins = async (retryCount = 0) => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('ai_twins')
        .select('id, name, reference_images, voice_cloning_key, voice_sample_url, face_description')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);
      
      if (error) {
        if ((error.code === '57014' || error.message?.includes('fetch')) && retryCount < 2) {
          console.log(`AI Twins query failed, retrying (${retryCount + 1}/2)...`);
          setTimeout(() => loadAiTwins(retryCount + 1), 1000);
          return;
        }
        console.error('Error loading AI twins:', error);
        return;
      }
      
      if (data) {
        setAiTwins(data.filter(t => t.reference_images && t.reference_images.length > 0));
      }
    } catch (err: any) {
      // Retry on network failures
      if (err?.message?.includes('fetch') && retryCount < 2) {
        console.log(`Network error loading AI twins, retrying (${retryCount + 1}/2)...`);
        setTimeout(() => loadAiTwins(retryCount + 1), 1000);
        return;
      }
      console.error('Failed to load AI twins:', err);
    }
  };

  // Fetch saved reels, characters, and AI twins on mount
  useEffect(() => {
    if (user) {
      fetchSavedReels();
      loadCharacters();
      loadAiTwins();
    }
  }, [user]);

  const fetchSavedReels = async (retryCount = 0) => {
    if (!user) return;
    
    // Only show loading on first attempt
    if (retryCount === 0) {
      setLoadingReels(true);
    }
    
    try {
      // Fetch lightweight columns first - exclude heavy scenes/draft_state to avoid JSON parse failures on large responses
      const { data, error } = await supabase
        .from('reels')
        .select('id, topic, video_url, thumbnail_url, total_duration, created_at, caption_settings, audio_url, is_draft')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);
      
      if (error) {
        // Retry on timeout errors (57014) or network errors
        if ((error.code === '57014' || error.message?.includes('fetch')) && retryCount < 3) {
          console.log(`Reels query failed, retrying (${retryCount + 1}/3)...`);
          setTimeout(() => fetchSavedReels(retryCount + 1), 1000 * (retryCount + 1));
          return;
        }
        throw error;
      }
      
      // Cast the data to our SavedReel type and separate drafts from completed reels
      const allReels: SavedReel[] = (data || []).map(item => ({
        id: item.id,
        topic: item.topic,
        video_url: item.video_url,
        thumbnail_url: item.thumbnail_url,
        audio_url: item.audio_url,
        scenes: [],
        total_duration: item.total_duration ?? 0,
        created_at: item.created_at,
        caption_settings: item.caption_settings as SavedReel['caption_settings'],
        is_draft: item.is_draft ?? false,
        draft_state: null
      }));
      
      // Separate drafts from completed reels
      setSavedReels(allReels.filter(r => !r.is_draft));
      setDraftReels(allReels.filter(r => r.is_draft));
    } catch (error: any) {
      // Handle network failures with retry
      if (error?.message?.includes('fetch') && retryCount < 3) {
        console.log(`Network error, retrying (${retryCount + 1}/3)...`);
        setTimeout(() => fetchSavedReels(retryCount + 1), 1000 * (retryCount + 1));
        return;
      }
      
      console.error('Error fetching reels:', error);
      toast({
        title: "Unable to load reels",
        description: "Temporary connection issue. Click Refresh to try again.",
        variant: "destructive"
      });
    } finally {
      if (retryCount === 0 || retryCount >= 3) {
        setLoadingReels(false);
      }
    }
  };

  // Save current work as a draft to the database
  const saveDraftToDatabase = async () => {
    if (!user) {
      toast({
        title: "Sign In Required",
        description: "Please sign in to save drafts.",
        variant: "destructive"
      });
      return;
    }

    const hasContent = project.scenes.length > 0 || project.previewScenes.length > 0 || previewScenes.length > 0;
    if (!hasContent && !topic.trim()) {
      toast({
        title: "Nothing to Save",
        description: "Generate some content first before saving as draft.",
        variant: "destructive"
      });
      return;
    }

    setIsSavingDraft(true);

    try {
      // Build scenes data from preview scenes or project scenes
      const scenesData = previewScenes.length > 0
        ? previewScenes.map((scene) => ({
            sceneNumber: scene.sceneNumber,
            text: scene.narration,
            imageUrl: scene.imageUrl,
            videoUrl: null,
            audioUrl: scene.audioUrl,
            startTime: 0,
            endTime: scene.audioDuration
          }))
        : project.previewScenes.length > 0
          ? project.previewScenes.map((scene) => ({
              sceneNumber: scene.sceneNumber,
              text: scene.narration,
              imageUrl: scene.imageUrl,
              videoUrl: null,
              audioUrl: scene.audioUrl,
              startTime: 0,
              endTime: scene.audioDuration
            }))
          : project.generatedScenes.map((scene) => ({
              sceneNumber: scene.sceneNumber,
              text: scene.text,
              imageUrl: scene.imageUrl,
              videoUrl: scene.videoUrl || null,
              startTime: scene.startTime,
              endTime: scene.endTime
            }));

      const thumbnailUrl = previewScenes[0]?.imageUrl 
        || project.previewScenes[0]?.imageUrl 
        || project.generatedScenes[0]?.imageUrl 
        || null;

      const totalDuration = previewVoiceovers.reduce((acc, a) => acc + a.duration, 0) 
        || project.voiceovers.reduce((acc, a) => acc + a.duration, 0) 
        || project.previewScenes.reduce((acc, s) => acc + s.audioDuration, 0)
        || project.scenes.reduce((acc, s) => acc + s.duration, 0)
        || 0;

      // Build the draft state with all settings
      const draftState: DraftState = {
        selectedSceneCount,
        selectedSceneDuration,
        selectedVoice,
        selectedVideoSize,
        transitionStyle,
        hookStyle,
        characterDescription,
        preSelectedReference,
        selectedTwinId,
        selectedIntro,
        selectedOutro,
        introText,
        outroText,
        enableCutScenes,
        enableLipSync,
        portraitImage,
        featureToggles,
        strategist: strategistState,
        scenes: project.scenes,
        previewScenes: previewScenes.length > 0 ? previewScenes : project.previewScenes,
        voiceovers: previewVoiceovers.length > 0 ? previewVoiceovers : project.voiceovers,
        customAudioMode,
        customAudioUrl,
        customAudioDuration
      };

      const { error } = await supabase.from('reels').insert([{
        user_id: user.id,
        topic: project.topic || topic || 'Untitled Draft',
        video_url: null,
        thumbnail_url: thumbnailUrl,
        scenes: scenesData as unknown as any,
        total_duration: Math.round(totalDuration),
        is_draft: true,
        draft_state: draftState as unknown as any
      }]);

      if (error) throw error;

      // Clear local draft since we saved to database
      clearDraft();
      fetchSavedReels();

      toast({
        title: "Draft Saved!",
        description: "Your work has been saved. Continue editing anytime from the Drafts tab."
      });
    } catch (error: any) {
      console.error('Error saving draft:', error);
      toast({
        title: "Save Failed",
        description: error.message || "Failed to save draft.",
        variant: "destructive"
      });
    } finally {
      setIsSavingDraft(false);
    }
  };

  // Restore a draft from the database
  const restoreDraftFromDatabase = async (draft: SavedReel) => {
    // Fetch full draft data (scenes + draft_state) on demand to avoid large list queries
    try {
      const { data: fullDraft, error } = await supabase
        .from('reels')
        .select('scenes, draft_state')
        .eq('id', draft.id)
        .single();
      
      if (error) throw error;
      
      const draftState = fullDraft?.draft_state as unknown as DraftState | null;
      
      if (!draftState) {
        // If no draft_state, just load the topic and scenes like duplicateReel
        duplicateReel({ ...draft, scenes: (fullDraft?.scenes as unknown as GeneratedScene[]) || [] });
        return;
      }

    const ds = draftState;
    
    // Restore all settings
    setTopic(draft.topic);
    setSelectedSceneCount(ds.selectedSceneCount || '4');
    setSelectedSceneDuration(ds.selectedSceneDuration || '12');
    setSelectedVoice(ds.selectedVoice || 'en-US-Journey-F');
    setSelectedVideoSize(ds.selectedVideoSize || '9:16');
    setTransitionStyle((ds.transitionStyle as any) || 'crossfade');
    setHookStyle(ds.hookStyle || 'auto');
    setCharacterDescription(ds.characterDescription || '');
    setPreSelectedReference(ds.preSelectedReference);
    setSelectedTwinId(ds.selectedTwinId);
    setSelectedIntro(ds.selectedIntro || 'none');
    setSelectedOutro(ds.selectedOutro || 'none');
    setIntroText(ds.introText || '');
    setOutroText(ds.outroText || '');
    setEnableCutScenes(ds.enableCutScenes || false);
    setEnableLipSync(ds.enableLipSync || false);
    setPortraitImage(ds.portraitImage);
    setFeatureToggles(ds.featureToggles || {
      introOutro: false,
      cutScenes: false,
      upscaler: false,
      lipSync: false,
      captions: true,
      backgroundMusic: false
    });
    
    // Restore custom audio settings
    setCustomAudioMode(ds.customAudioMode || 'tts');
    setCustomAudioUrl(ds.customAudioUrl || null);
    setCustomAudioDuration(ds.customAudioDuration || 0);

    // Restore strategist state
    if (ds.strategist) {
      setStrategistState(ds.strategist);
    }

    // Restore project state with scenes and preview scenes
    setProject({
      topic: draft.topic,
      scenes: ds.scenes || [],
      voiceovers: ds.voiceovers || [],
      videoUrl: null,
      videoBlobUrl: null,
      generatedScenes: [],
      videoClips: [],
      previewScenes: ds.previewScenes || [],
      status: 'idle'
    });

    // Switch to create tab
    setActiveTab('create');

    toast({
      title: "Draft Restored!",
      description: "All your settings and scenes have been loaded. Continue editing!"
    });
    } catch (err: any) {
      console.error('Error restoring draft:', err);
      toast({
        title: "Restore Failed",
        description: err.message || "Failed to load draft data.",
        variant: "destructive"
      });
    }
  };

  // Delete a draft reel
  const deleteDraft = async (draftId: string) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('reels')
        .delete()
        .eq('id', draftId);

      if (error) throw error;

      toast({
        title: "Draft Deleted",
        description: "The draft has been removed."
      });

      setDraftReels(prev => prev.filter(d => d.id !== draftId));
    } catch (error: any) {
      console.error('Error deleting draft:', error);
      toast({
        title: "Delete Failed",
        description: error.message || "Failed to delete draft.",
        variant: "destructive"
      });
    }
  };

  const deleteReel = async (reelId: string, videoUrl: string | null) => {
    if (!user) return;

    try {
      // Delete from storage if video exists
      if (videoUrl) {
        const path = videoUrl.split('/reels/')[1];
        if (path) {
          await supabase.storage.from('reels').remove([path]);
        }
      }

      // Delete from database
      const { error } = await supabase
        .from('reels')
        .delete()
        .eq('id', reelId);

      if (error) throw error;

      toast({
        title: "Reel Deleted",
        description: "The reel has been removed from your library."
      });

      setSavedReels(prev => prev.filter(r => r.id !== reelId));
    } catch (error: any) {
      console.error('Error deleting reel:', error);
      toast({
        title: "Delete Failed",
        description: error.message || "Failed to delete reel.",
        variant: "destructive"
      });
    }
  };

  // Duplicate a saved reel - loads its script into the create form
  const duplicateReel = (reel: SavedReel) => {
    // Set the topic
    setTopic(reel.topic);
    
    // Convert saved scenes to script scenes
    if (reel.scenes && reel.scenes.length > 0) {
      const scriptScenes: Scene[] = reel.scenes.map((scene, index) => ({
        sceneNumber: index + 1,
        narration: scene.text || '',
        visualDescription: scene.text || '',
        duration: Math.round((scene.endTime || 0) - (scene.startTime || 0)) || 12,
      }));
      
      setProject(prev => ({
        ...prev,
        topic: reel.topic,
        scenes: scriptScenes,
        status: 'idle',
        generatedScenes: [],
        videoClips: [],
        voiceovers: [],
        previewScenes: [],
        videoBlobUrl: null,
        videoUrl: null
      }));
      
      setSelectedSceneCount(String(scriptScenes.length));
    }
    
    // Switch to create tab
    setActiveTab('create');
    
    // Reset preview state
    resetPreview();
    
    toast({
      title: "Reel Duplicated",
      description: "Script loaded. You can now regenerate with modifications.",
    });
  };

  // Manual save to My Reels
  const saveToMyReels = async () => {
    if (!user) {
      toast({
        title: "Sign In Required",
        description: "Please sign in to save reels.",
        variant: "destructive"
      });
      return;
    }

    const hasContent = project.generatedScenes.length > 0 || project.previewScenes.length > 0 || project.videoBlobUrl;
    if (!hasContent) {
      toast({
        title: "Nothing to Save",
        description: "Generate some content first before saving.",
        variant: "destructive"
      });
      return;
    }

    setIsSavingReel(true);

    try {
      const scenesData = project.generatedScenes.length > 0 
        ? project.generatedScenes.map((scene) => {
            const video = project.videoClips.find(v => v.sceneNumber === scene.sceneNumber);
            const audio = project.voiceovers.find(a => a.sceneNumber === scene.sceneNumber);
            return {
              ...scene,
              videoUrl: video?.videoUrl || null,
              audioUrl: audio?.storageUrl || null,
              audioDuration: audio?.duration || null
            };
          })
        : project.previewScenes.map((scene) => ({
            sceneNumber: scene.sceneNumber,
            text: scene.narration,
            imageUrl: scene.imageUrl,
            videoUrl: null,
            audioUrl: scene.audioUrl,
            audioDuration: scene.audioDuration,
            startTime: 0,
            endTime: scene.audioDuration
          }));

      const thumbnailUrl = project.generatedScenes[0]?.imageUrl 
        || project.previewScenes[0]?.imageUrl 
        || null;

      const totalDuration = project.voiceovers.reduce((acc, a) => acc + a.duration, 0) 
        || project.previewScenes.reduce((acc, s) => acc + s.audioDuration, 0)
        || project.scenes.reduce((acc, s) => acc + s.duration, 0)
        || 0;

      let savedVideoUrl = project.videoBlobUrl;
      if (project.videoBlobUrl && project.videoBlobUrl.startsWith('blob:') && videoBlobRef.current) {
        const fileName = `${user.id}/${Date.now()}-reel.mp4`;
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('reels')
          .upload(fileName, videoBlobRef.current, { contentType: 'video/mp4' });

        if (!uploadError && uploadData) {
          const { data: publicUrl } = supabase.storage.from('reels').getPublicUrl(fileName);
          savedVideoUrl = publicUrl.publicUrl;
        }
      }

      await supabase.from('reels').insert([{
        user_id: user.id,
        topic: project.topic || topic || 'Untitled Reel',
        video_url: savedVideoUrl,
        thumbnail_url: thumbnailUrl,
        scenes: scenesData as unknown as any,
        total_duration: Math.round(totalDuration)
      }]);

      handleReelSavedSuccessfully();
      fetchSavedReels();

      toast({
        title: "Reel Saved!",
        description: "Your reel has been saved to My Reels."
      });
    } catch (error: any) {
      console.error('Error saving reel:', error);
      toast({
        title: "Save Failed",
        description: error.message || "Failed to save reel.",
        variant: "destructive"
      });
    } finally {
      setIsSavingReel(false);
    }
  };

  const generateScripts = async (): Promise<Scene[] | null> => {
    if (!topic.trim()) {
      toast({
        title: "Topic Required",
        description: "Please enter a topic for your reel.",
        variant: "destructive"
      });
      return;
    }

    setIsGenerating(true);
    setProject(prev => ({ ...prev, status: 'generating-script', topic }));
    setProgress(10);

    // For podcast mode, use 1 scene with the full duration
    const sceneCount = isPodcastMode ? 1 : parseInt(selectedSceneCount);
    const sceneDuration = isPodcastMode ? parseInt(podcastDuration) : parseInt(selectedSceneDuration);
    const targetDuration = sceneCount * sceneDuration;
    
    // Get selected character info for podcast mode
    const selectedCharacter = isPodcastMode && selectedCharacterId 
      ? characters.find(c => c.id === selectedCharacterId)
      : null;

    try {
      const { data, error } = await supabase.functions.invoke('generate-reel-script', {
        body: { 
          topic, 
          sceneCount,
          sceneDuration,
          targetDuration,
          hookStyle,
          enableCutScenes: isPodcastMode ? false : enableCutScenes,
          characterDescription: characterDescription.trim() || undefined,
          isPodcastMode,
          characterId: selectedCharacterId,
          characterName: selectedCharacter?.name,
          introConfig: selectedIntro !== 'none' ? {
            introTemplate: selectedIntro,
            introText: introText
          } : undefined,
          outroConfig: selectedOutro !== 'none' ? {
            outroTemplate: selectedOutro,
            outroText: outroText
          } : undefined
        }
      });

      if (error) throw error;

      setProject(prev => ({
        ...prev,
        scenes: data.scenes,
        status: 'idle'
      }));
      setProgress(25);

      toast({
        title: "Scripts Generated",
        description: isPodcastMode 
          ? `Podcast script (~${Math.round(sceneDuration / 60)} min) created.`
          : `${sceneCount} scene scripts (${selectedSceneDuration}s each) created for your reel.`
      });
      
      return data.scenes as Scene[];
    } catch (error: any) {
      console.error('Script generation error:', error);
      toast({
        title: "Generation Failed",
        description: error.message || "Failed to generate scripts.",
        variant: "destructive"
      });
      setProject(prev => ({ ...prev, status: 'idle' }));
      return null;
    } finally {
      setIsGenerating(false);
    }
  };

  const generateVideo = async (overrides?: { forceEnableLipSync?: boolean; forceLipSyncModel?: string; scenesOverride?: Scene[] }) => {
    const activeScenes = overrides?.scenesOverride || project.scenes;
    if (activeScenes.length === 0) {
      toast({
        title: "Missing Scripts",
        description: "Please generate scripts first.",
        variant: "destructive"
      });
      return;
    }

    setIsGenerating(true);
    setVideoError(null);
    setProject(prev => ({ ...prev, status: 'generating-video' }));
    setProgress(5);
    
    // Use preview voiceovers if they exist, otherwise generate new ones
    const hasPreviewVoiceovers = previewVoiceovers.length > 0;
    const voiceovers: { sceneNumber: number; audioUrl: string; storageUrl?: string; duration: number }[] = 
      hasPreviewVoiceovers ? [...previewVoiceovers] : [];

    try {
      // Generate voiceovers if we don't have them from preview
      if (!hasPreviewVoiceovers) {
        setProgressStatus('Generating voiceovers...');
      
      // Step 1: Generate voiceovers for each scene using OpenAI TTS and get actual durations
      for (const scene of activeScenes) {
        // Skip silent CTA scenes (no narration needed)
        if ((scene as any).isSilentCTA || !scene.narration?.trim()) {
          console.log(`Scene ${scene.sceneNumber} is silent CTA - skipping voiceover`);
          // Add a placeholder with the scene's duration for timing
          voiceovers.push({
            sceneNumber: scene.sceneNumber,
            audioUrl: '', // No audio
            duration: scene.duration || 2
          });
          continue;
        }
        
        try {
          // Check if using cloned voice from AI Twin
          const selectedTwin = selectedTwinId ? aiTwins.find(t => t.id === selectedTwinId) : null;
          const clonedVoiceUrl = selectedTwin?.voice_cloning_key || null;
          
          const { data: ttsData, error: ttsError } = await supabase.functions.invoke('text-to-speech', {
            body: { 
              text: scene.narration, 
              voice: clonedVoiceUrl ? undefined : selectedVoice,
              clonedVoiceUrl 
            }
          });
          
          if (ttsError) {
            console.error('TTS error for scene', scene.sceneNumber, ':', ttsError);
            continue;
          }
          
          if (ttsData?.audioContent) {
            const audioUrl = `data:audio/mp3;base64,${ttsData.audioContent}`;
            
            // Get actual audio duration
            const actualDuration = await getAudioDuration(audioUrl);
            console.log(`Scene ${scene.sceneNumber} voiceover actual duration: ${actualDuration}s`);
            
            // Upload individual voiceover to storage for persistence
            let storageUrl: string | undefined;
            if (user) {
              try {
                const base64Data = ttsData.audioContent;
                const binaryString = atob(base64Data);
                const bytes = new Uint8Array(binaryString.length);
                for (let i = 0; i < binaryString.length; i++) {
                  bytes[i] = binaryString.charCodeAt(i);
                }
                
                const fileName = `${user.id}/voiceovers/${Date.now()}-scene-${scene.sceneNumber}.mp3`;
                const { data: uploadData, error: uploadError } = await supabase.storage
                  .from('reels')
                  .upload(fileName, bytes, { contentType: 'audio/mp3' });
                
                if (!uploadError && uploadData) {
                  const { data: publicUrl } = supabase.storage.from('reels').getPublicUrl(fileName);
                  storageUrl = publicUrl.publicUrl;
                  console.log('Uploaded voiceover to storage:', storageUrl);
                }
              } catch (uploadErr) {
                console.warn('Voiceover upload failed:', uploadErr);
              }
            }
            
            voiceovers.push({
              sceneNumber: scene.sceneNumber,
              audioUrl,
              storageUrl,
              duration: actualDuration
            });
          }
        } catch (ttsErr) {
          console.error('TTS generation failed for scene', scene.sceneNumber, ':', ttsErr);
        }
      }
      } // End of if (!hasPreviewVoiceovers)
      
      // Set progress based on whether we used cached voiceovers
      if (hasPreviewVoiceovers) {
        setProgress(15);
        setProgressStatus('Using cached voiceovers. Creating images...');
      } else {
        setProgress(15);
        setProgressStatus(`Generated ${voiceovers.length}/${activeScenes.length} voiceovers. Creating images...`);
      }
      
      // Step 2: Generate scene images and start video tasks via backend
      // Pass actual audio durations so WaveSpeed generates correct length videos
      const scenesWithAudioDurations = activeScenes.map(scene => {
        const voiceover = voiceovers.find(v => v.sceneNumber === scene.sceneNumber);
        return {
          ...scene,
          audioDuration: voiceover?.duration // Pass actual voiceover duration
        };
      });
      
      // Pass pre-generated images from preview if available
      const preGeneratedImages = previewScenes.length > 0 
        ? previewScenes.map(ps => ({ sceneNumber: ps.sceneNumber, imageUrl: ps.imageUrl }))
        : undefined;
      
      // Get AI Twin reference images for character consistency
      const selectedTwin = selectedTwinId ? aiTwins.find(t => t.id === selectedTwinId) : null;
      const twinReferenceImages = selectedTwin?.reference_images || [];
      
      const effectiveLipSync = overrides?.forceEnableLipSync ?? enableLipSync;
      const effectiveLipSyncModel = overrides?.forceLipSyncModel ?? lipSyncModel;
      
      // Build camera angle rotation for variety across scenes
      const diverseAngles = ['eye-level', 'three-quarter', 'low-angle', 'medium-shot', 'closeup', 'profile-shot', 'golden-hour', 'cinematic'];
      const cameraAngleRotation = scenesWithAudioDurations.map((scene, idx) => {
        if (scene.isIntro || scene.isOutro) return undefined; // No angle for intro/outro
        const angleId = diverseAngles[idx % diverseAngles.length];
        const angle = CAMERA_ANGLES.find(a => a.id === angleId);
        return angle?.promptModifier || CAMERA_ANGLES.find(a => a.id === selectedCameraAngle)?.promptModifier;
      }).filter(Boolean);
      
      const { data, error } = await supabase.functions.invoke('generate-reel-video', {
        body: { 
          scenes: scenesWithAudioDurations,
          topic: project.topic,
          addCaptions: featureToggles.captions,
          useWaveSpeed: true,
          // Lip sync configuration
          enableLipSync: effectiveLipSync,
          lipSyncModel: effectiveLipSync ? effectiveLipSyncModel : undefined,
          portraitImage: effectiveLipSync ? (portraitImage || twinReferenceImages[0]) : undefined,
          voice: selectedVoice,
          // Pass voiceover storage URLs for lip sync
          voiceovers: voiceovers.map(v => ({
            sceneNumber: v.sceneNumber,
            audioUrl: v.storageUrl || v.audioUrl,
            duration: v.duration
          })),
          // Pass pre-generated images from preview
          preGeneratedImages,
          // Character consistency data
          referenceImages: twinReferenceImages,
          characterDescription: characterDescription || selectedTwin?.face_description || '',
          // Camera angle variety per scene
          cameraAngles: cameraAngleRotation
        }
      });

      if (error) throw error;

      const generatedScenes = data.scenes || [];
      const videoTasks = data.videoTasks || [];
      // Track if videos have embedded audio (true only for actual lip sync/VEO3, NOT image-to-video fallback)
      const hasEmbeddedAudio = data.hasEmbeddedAudio || false;
      console.log('Video generation response:', { videoTasks: videoTasks.length, hasEmbeddedAudio });
      
      const scenesWithImages = generatedScenes.filter((s: GeneratedScene) => s.imageUrl);
      
      if (scenesWithImages.length === 0) {
        throw new Error('No scene images were generated');
      }

      setProject(prev => ({
        ...prev,
        generatedScenes,
        voiceovers,
      }));
      setProgress(30);

      // Step 3: If we have video tasks, poll for completion
      if (videoTasks.length > 0) {
        setProject(prev => ({ ...prev, status: 'rendering-video' }));
        setProgressStatus(`Generating ${videoTasks.length} video clips with WaveSpeed...`);

        const completedVideos: { sceneNumber: number; videoUrl: string }[] = [];
        const maxPollingTime = 300000; // 5 minutes max
        const pollInterval = 5000; // 5 seconds between polls
        const startTime = Date.now();

        while (completedVideos.length < videoTasks.length) {
          if (Date.now() - startTime > maxPollingTime) {
            throw new Error('Video generation timed out. Please try again.');
          }

          for (const task of videoTasks) {
            // Skip if already completed
            if (completedVideos.find(v => v.sceneNumber === task.sceneNumber)) continue;

            try {
              const { data: statusData, error: statusError } = await supabase.functions.invoke('wavespeed-video', {
                body: { action: 'status', taskId: task.taskId }
              });

              if (statusError) {
                console.error('Status check error:', statusError);
                continue;
              }

              console.log(`Task ${task.taskId} status:`, statusData);

              if (statusData.status === 'completed' && statusData.videoUrl) {
                completedVideos.push({
                  sceneNumber: task.sceneNumber,
                  videoUrl: statusData.videoUrl
                });
                setProgressStatus(`Generated ${completedVideos.length}/${videoTasks.length} video clips...`);
              } else if (statusData.status === 'failed') {
                // Log the failure but don't throw - skip this scene and continue with others
                console.error(`Scene ${task.sceneNumber} video failed:`, statusData.error);
                // Mark as "completed" with empty URL so we don't poll forever
                completedVideos.push({
                  sceneNumber: task.sceneNumber,
                  videoUrl: '' // Will be filtered out later
                });
                toast({
                  title: `Scene ${task.sceneNumber} Failed`,
                  description: statusData.error || 'Video generation failed for this scene. Other scenes will continue.',
                  variant: "destructive"
                });
              }
            } catch (pollError) {
              console.error('Polling error:', pollError);
            }
          }

          const progressPercent = 30 + Math.round((completedVideos.length / videoTasks.length) * 40);
          setProgress(progressPercent);

          if (completedVideos.length < videoTasks.length) {
            await new Promise(resolve => setTimeout(resolve, pollInterval));
          }
        }

        // Step 4: All videos completed - stitch them together with audio
        // Filter out failed scenes (empty URLs) before stitching
        const sortedVideos = completedVideos
          .filter(v => v.videoUrl && v.videoUrl.trim() !== '')
          .sort((a, b) => a.sceneNumber - b.sceneNumber);
        const sortedAudios = voiceovers.sort((a, b) => a.sceneNumber - b.sceneNumber);
        
        if (sortedVideos.length === 0) {
          throw new Error('All video scenes failed to generate. Please try again.');
        }
        
        setProgress(75);
        setProgressStatus('Stitching video clips with voiceover...');
        
        // Use built-in canvas stitcher
        {
          setProgressStatus('Preparing audio...');
          
          // Collect audio URLs for stitching
          let audioUrlsForStitch: string[] = [];
          
          // IMPORTANT: Only skip audio overlay if videos ACTUALLY have embedded audio
          const shouldSkipAudioOverlay = hasEmbeddedAudio;
          
          console.log('Audio overlay decision:', { 
            hasEmbeddedAudio, 
            enableLipSync,
            shouldSkipAudioOverlay,
            reason: shouldSkipAudioOverlay ? 'Videos have embedded audio from lip sync' : 'Videos need audio overlay'
          });
          
          if (!shouldSkipAudioOverlay) {
            // Generate voiceovers if needed
            if (sortedAudios.length === 0 || sortedAudios.every(a => !a.audioUrl || a.audioUrl.trim() === '')) {
              console.log('No voiceovers available, generating now...');
              setProgressStatus('Generating voiceovers...');
              
              for (const scene of activeScenes) {
                if ((scene as any).isSilentCTA || !scene.narration?.trim()) {
                  voiceovers.push({ sceneNumber: scene.sceneNumber, audioUrl: '', duration: scene.duration || 2 });
                  continue;
                }
                try {
                  const { data: ttsData, error: ttsError } = await supabase.functions.invoke('text-to-speech', {
                    body: { text: scene.narration, voice: selectedVoice }
                  });
                  if (!ttsError && ttsData?.audioContent) {
                    const audioUrl = `data:audio/mp3;base64,${ttsData.audioContent}`;
                    const actualDuration = await getAudioDuration(audioUrl);
                    let storageUrl: string | undefined;
                    if (user) {
                      try {
                        const binaryString = atob(ttsData.audioContent);
                        const bytes = new Uint8Array(binaryString.length);
                        for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
                        const fileName = `${user.id}/voiceovers/${Date.now()}-scene-${scene.sceneNumber}.mp3`;
                        const { data: uploadData, error: uploadError } = await supabase.storage.from('reels').upload(fileName, bytes, { contentType: 'audio/mp3' });
                        if (!uploadError && uploadData) {
                          const { data: publicUrl } = supabase.storage.from('reels').getPublicUrl(fileName);
                          storageUrl = publicUrl.publicUrl;
                        }
                      } catch (e) { console.warn('Upload failed:', e); }
                    }
                    voiceovers.push({ sceneNumber: scene.sceneNumber, audioUrl, storageUrl, duration: actualDuration || scene.duration || 5 });
                  }
                } catch (e) { console.warn(`TTS failed for scene ${scene.sceneNumber}:`, e); }
              }
              sortedAudios.length = 0;
              sortedAudios.push(...voiceovers.sort((a, b) => a.sceneNumber - b.sceneNumber));
            }
            
            audioUrlsForStitch = sortedAudios
              .filter(a => a.audioUrl && a.audioUrl.trim() !== '')
              .map(a => a.storageUrl || a.audioUrl);
          }

          setProgressStatus('Stitching video clips...');
          setProgress(80);
          
          try {
            const videoUrls = sortedVideos.map(v => v.videoUrl);
            
            const finalBlob = await canvasStitchVideos({
              videoUrls,
              audioUrls: audioUrlsForStitch.length > 0 ? audioUrlsForStitch : undefined,
              onProgress: (p) => {
                setProgress(75 + Math.round(p * 0.2));
                setProgressStatus(`Stitching... ${Math.round(p)}%`);
              },
              onStatus: (s) => setProgressStatus(s)
            });
            
            const blobUrl = URL.createObjectURL(finalBlob);
            videoBlobRef.current = finalBlob;
            
            let persistedVideoUrl = blobUrl;
            if (user) {
              setProgress(92);
              setProgressStatus('Uploading final video...');
              try {
                const fileName = `${user.id}/videos/${Date.now()}-stitched.mp4`;
                const { data: uploadData, error: uploadError } = await supabase.storage
                  .from('reels')
                  .upload(fileName, finalBlob, { contentType: 'video/mp4' });
                if (!uploadError && uploadData) {
                  const { data: publicUrl } = supabase.storage.from('reels').getPublicUrl(fileName);
                  persistedVideoUrl = publicUrl.publicUrl;
                }
              } catch (e) { console.warn('Upload failed:', e); }
            }
            
            setProject(prev => ({
              ...prev,
              videoUrl: persistedVideoUrl,
              videoBlobUrl: persistedVideoUrl,
              generatedScenes,
              voiceovers: sortedAudios,
              videoClips: [],
              status: 'complete'
            }));

            // Auto-save to library
            setProgress(95);
            setProgressStatus('Saving to library...');

            if (user) {
              try {
                const thumbnailUrl = generatedScenes[0]?.imageUrl || null;
                const totalDuration = sortedAudios.reduce((acc, a) => acc + a.duration, 0);
                const scenesWithAllAssets = generatedScenes.map((scene) => {
                  const video = sortedVideos.find(v => v.sceneNumber === scene.sceneNumber);
                  const audio = sortedAudios.find(a => a.sceneNumber === scene.sceneNumber);
                  return { ...scene, videoUrl: video?.videoUrl || null, audioUrl: audio?.storageUrl || null, audioDuration: audio?.duration || null };
                });
                await supabase.from('reels').insert([{
                  user_id: user.id,
                  topic: project.topic,
                  video_url: persistedVideoUrl,
                  thumbnail_url: thumbnailUrl,
                  scenes: scenesWithAllAssets as unknown as any,
                  total_duration: totalDuration
                }]);
                fetchSavedReels();
              } catch (saveError) { console.error('Auto-save failed:', saveError); }
            }

            setProgress(100);
            setProgressStatus('Complete!');
            toast({ title: "Video Generated!", description: `Created ${sortedVideos.length}-scene video and saved to library!` });
          } catch (stitchErr) {
            console.error('Stitching failed:', stitchErr);
            // Final fallback: show individual clips
            setProject(prev => ({
              ...prev,
              videoUrl: sortedVideos[0]?.videoUrl,
              videoBlobUrl: sortedVideos[0]?.videoUrl,
              generatedScenes,
              voiceovers: sortedAudios,
              videoClips: sortedVideos,
              status: 'complete'
            }));
            setProgress(100);
            setProgressStatus('Complete (individual clips)');
            toast({ title: "Videos Generated!", description: `Generated ${sortedVideos.length} clips. Stitching failed — use clip navigation below.` });
          }
        }
      } else {
        // Fallback: No video tasks, just show images
        setProject(prev => ({
          ...prev,
          generatedScenes,
          voiceovers: voiceovers.map(v => ({ ...v, duration: v.duration || 5 })),
          status: 'complete'
        }));
        setProgress(100);
        setProgressStatus('Images generated (no video tasks created)');

        toast({
          title: "Images Generated",
          description: "Scene images created. Video generation unavailable.",
          variant: "destructive"
        });
      }
    } catch (error: any) {
      console.error('Video generation error:', error);
      const errorMessage = error.message || "Failed to generate video.";
      setVideoError(errorMessage);
      toast({
        title: "Video Generation Failed",
        description: errorMessage,
        variant: "destructive"
      });
      setProject(prev => ({ ...prev, status: 'idle' }));
    } finally {
      setIsGenerating(false);
    }
  };

  // Helper to detect gender from text and return matching voice
  const detectGenderVoice = (text: string): string | null => {
    const lower = text.toLowerCase();
    const femaleKeywords = ['woman', 'female', 'girl', 'lady', 'she', 'her', 'mother', 'mom', 'sister', 'actress', 'businesswoman', 'queen', 'princess', 'mrs', 'ms', 'miss', 'feminine'];
    const maleKeywords = ['man', 'male', 'boy', 'guy', 'he', 'him', 'father', 'dad', 'brother', 'actor', 'businessman', 'king', 'prince', 'mr', 'masculine'];
    const isFemale = femaleKeywords.some(k => lower.includes(k));
    const isMale = maleKeywords.some(k => lower.includes(k));
    if (isFemale && !isMale) return 'English_compelling_lady1';
    if (isMale && !isFemale) return 'English_magnetic_voiced_man';
    return null;
  };

  const generateAll = async () => {
    // In beginner mode, auto-select the first AI Twin for character consistency
    // Use local variables since React state updates are async and won't be available immediately
    let shouldEnableLipSync = enableLipSync;
    let activeLipSyncModel = lipSyncModel;
    
    if (isBeginner && aiTwins.length > 0 && !selectedTwinId) {
      const twin = aiTwins[0];
      setSelectedTwinId(twin.id);
      if (twin.reference_images?.[0]) {
        setPortraitImage(twin.reference_images[0]);
        setPortraitPreview(twin.reference_images[0]);
        setPreSelectedReference(twin.reference_images[0]);
      }
      if (twin.face_description) {
        setCharacterDescription(twin.face_description);
      }
      // Enable lip sync for talking head style
      shouldEnableLipSync = true;
      activeLipSyncModel = 'infinitetalk';
      setEnableLipSync(true);
      setLipSyncModel('infinitetalk');
      
      // Auto-match voice to twin's gender from face description, gender field, or name
      const twinGender = (twin as any).gender?.toLowerCase() || '';
      const twinDesc = (twin.face_description || twin.name || '').toLowerCase();
      const genderText = `${twinGender} ${twinDesc}`;
      const detectedVoice = detectGenderVoice(genderText);
      if (detectedVoice) {
        setSelectedVoice(detectedVoice);
      }
    }
    
    // Also detect gender from the topic itself if no twin and voice hasn't been manually changed
    if (isBeginner && (!aiTwins.length || !selectedTwinId)) {
      const topicVoice = detectGenderVoice(topic + ' ' + characterDescription);
      if (topicVoice) {
        setSelectedVoice(topicVoice);
      }
    }
    
    const generatedScenes = await generateScripts();
    if (generatedScenes && generatedScenes.length > 0) {
      // Pass scenes directly to avoid stale state issues
      await generateVideo({ forceEnableLipSync: shouldEnableLipSync, forceLipSyncModel: activeLipSyncModel, scenesOverride: generatedScenes });
    }
  };

  const resetProject = () => {
    // Cleanup blob URL
    if (project.videoBlobUrl) {
      URL.revokeObjectURL(project.videoBlobUrl);
    }
    videoBlobRef.current = null;
    
    setProject({
      topic: '',
      scenes: [],
      voiceovers: [],
      videoUrl: null,
      videoBlobUrl: null,
      generatedScenes: [],
      videoClips: [],
      previewScenes: [],
      status: 'idle'
    });
    setSelectedClipIndex(0);
    setTopic('');
    setProgress(0);
    setProgressStatus('');
    setVideoError(null);
    // Reset templates
    setSelectedIntro('none');
    setSelectedOutro('none');
    setIntroText('');
    setOutroText('');
    // Reset preview
    resetPreview();
    // Reset save state
    setCurrentReelSaved(false);
    // Clear auto-saved draft
    clearDraft();
  };

  const handleDownloadVideo = async () => {
    if (videoBlobRef.current) {
      downloadVideo(videoBlobRef.current, `reel-${project.topic.slice(0, 20).replace(/\s+/g, '-')}.mp4`);
    } else if (project.videoBlobUrl && project.videoBlobUrl.startsWith('http')) {
      // Download from URL (WaveSpeed)
      try {
        const response = await fetch(project.videoBlobUrl);
        const blob = await response.blob();
        downloadVideo(blob, `reel-${project.topic.slice(0, 20).replace(/\s+/g, '-')}.mp4`);
      } catch (error) {
        console.error('Download error:', error);
        // Fallback: open in new tab
        window.open(project.videoBlobUrl, '_blank');
      }
    }
  };

  const updateSceneNarration = (sceneNumber: number, narration: string) => {
    setProject(prev => ({
      ...prev,
      scenes: prev.scenes.map(scene =>
        scene.sceneNumber === sceneNumber ? { ...scene, narration } : scene
      )
    }));
  };

  // Generate a character on-demand using AI image generation
  const generateCharacter = async () => {
    if (!generateCharacterPrompt.trim()) {
      toast({ title: "Missing Description", description: "Please describe the person you want to generate.", variant: "destructive" });
      return;
    }
    setIsGeneratingCharacter(true);
    try {
      const { data, error } = await supabase.functions.invoke('ai', {
        body: {
          messages: [{
            role: 'user',
            content: `Generate a professional headshot portrait photo of: ${generateCharacterPrompt}. 
              The person should be looking directly at the camera with a natural confident expression, slight smile.
              Professional studio lighting, clean background, high quality portrait suitable for video production.
              Photorealistic, 8K quality. On a solid white background.`
          }],
          model: 'google/gemini-3.1-flash-image-preview',
          modalities: ['image', 'text']
        }
      });
      if (error) throw error;
      const imageUrl = data?.imageUrl || data?.choices?.[0]?.message?.images?.[0]?.image_url?.url;
      if (imageUrl) {
        setPortraitImage(imageUrl);
        setPortraitPreview(imageUrl);
        setPreSelectedReference(imageUrl);
        setCharacterDescription(generateCharacterPrompt);
        setShowGenerateCharacter(false);
        
        // Auto-detect gender from description and set matching voice
        const descLower = generateCharacterPrompt.toLowerCase();
        const femaleKeywords = ['woman', 'female', 'girl', 'lady', 'she', 'her', 'mother', 'mom', 'sister', 'actress', 'businesswoman', 'queen', 'princess', 'mrs', 'ms', 'miss'];
        const maleKeywords = ['man', 'male', 'boy', 'guy', 'he', 'him', 'father', 'dad', 'brother', 'actor', 'businessman', 'king', 'prince', 'mr'];
        const isFemale = femaleKeywords.some(k => descLower.includes(k));
        const isMale = !isFemale && maleKeywords.some(k => descLower.includes(k));
        
        if (isFemale) {
          setSelectedVoice('en-US-Journey-F');
        } else if (isMale) {
          setSelectedVoice('en-US-Journey-D');
        }
        // If ambiguous, keep current voice
        
        toast({ title: "Character Generated!", description: `Portrait set as reference.${isFemale ? ' Female voice auto-selected.' : isMale ? ' Male voice auto-selected.' : ''}` });
      } else {
        throw new Error('No image returned');
      }
    } catch (err: any) {
      toast({ title: "Generation Failed", description: err.message, variant: "destructive" });
    } finally {
      setIsGeneratingCharacter(false);
    }
  };

  // Preview the selected voice with a TTS sample
  const previewVoice = async () => {
    // Stop any currently playing preview
    if (voicePreviewAudio) {
      voicePreviewAudio.pause();
      voicePreviewAudio.currentTime = 0;
      setVoicePreviewAudio(null);
      setIsPreviewingVoice(false);
      return;
    }

    const sampleText = project.scenes[0]?.narration 
      || "Hello! This is a preview of how your voiceover will sound in the final video.";
    
    setIsPreviewingVoice(true);
    try {
      const { data, error } = await supabase.functions.invoke('text-to-speech', {
        body: { text: sampleText.slice(0, 200), voice: selectedVoice }
      });
      if (error) throw error;
      const audioUrl = data?.audioUrl || data?.url;
      if (!audioUrl) throw new Error('No audio returned');
      
      const audio = new Audio(audioUrl);
      audio.onended = () => {
        setIsPreviewingVoice(false);
        setVoicePreviewAudio(null);
      };
      setVoicePreviewAudio(audio);
      await audio.play();
    } catch (err: any) {
      toast({ title: "Voice Preview Failed", description: err.message, variant: "destructive" });
      setIsPreviewingVoice(false);
    }
  };

  const insertSlide = async (position: 'intro' | 'cta', headline: string, subtitle: string) => {
    if (!headline.trim()) {
      toast({ title: "Missing Headline", description: "Please enter a headline for the slide.", variant: "destructive" });
      return;
    }
    toast({ title: `Generating ${position === 'intro' ? 'Intro' : 'CTA'} Slide...` });
    try {
      const { data, error } = await supabase.functions.invoke('ai', {
        body: {
          messages: [{
            role: 'user',
            content: `Generate a premium social media ${position === 'intro' ? 'intro' : 'call-to-action'} slide background.
              Style: Modern, premium, cinematic gradient background suitable for overlay text.
              Theme hint: "${headline}" ${subtitle ? `- "${subtitle}"` : ''}
              CRITICAL: Do NOT include any text, letters, words, or typography. Pure visual background design only.
              Vertical 9:16 format, rich colors, depth, professional quality.`
          }],
          model: 'google/gemini-3.1-flash-image-preview',
          modalities: ['image', 'text']
        }
      });
      if (error) throw error;
      const imageUrl = data?.imageUrl || data?.choices?.[0]?.message?.images?.[0]?.image_url?.url;
      if (!imageUrl) throw new Error('No image generated');

      const newScene: GeneratedScene = {
        sceneNumber: position === 'intro' ? 0 : 999,
        text: subtitle ? `${headline}\n${subtitle}` : headline,
        imageUrl,
        startTime: 0,
        endTime: 3,
        isIntro: position === 'intro',
        isOutro: position === 'cta'
      };

      setProject(prev => {
        let scenes = [...prev.generatedScenes];
        if (position === 'intro') {
          // Renumber existing scenes
          scenes = scenes.map(s => ({ ...s, sceneNumber: s.sceneNumber + 1 }));
          scenes.unshift({ ...newScene, sceneNumber: 1 });
        } else {
          const maxNum = Math.max(...scenes.map(s => s.sceneNumber), 0);
          scenes.push({ ...newScene, sceneNumber: maxNum + 1 });
        }
        return { ...prev, generatedScenes: scenes };
      });

      if (position === 'intro') {
        setShowIntroSlideForm(false);
        setIntroSlideHeadline('');
        setIntroSlideSubtitle('');
      } else {
        setShowCtaSlideForm(false);
        setCtaSlideHeadline('');
        setCtaSlideSubtitle('');
      }
      toast({ title: `${position === 'intro' ? 'Intro' : 'CTA'} Slide Added!` });
    } catch (err: any) {
      toast({ title: "Failed", description: err.message, variant: "destructive" });
    }
  };

  // Manual stitch videos together
  const stitchVideos = async () => {
    if (project.videoClips.length < 2) {
      toast({
        title: "Nothing to Stitch",
        description: "Need at least 2 video clips to stitch together.",
        variant: "destructive"
      });
      return;
    }

    setIsManualStitching(true);
    setProgress(10);
    setProgressStatus('Preparing to stitch videos...');

    try {
      const sortedVideos = [...project.videoClips].sort((a, b) => a.sceneNumber - b.sceneNumber);
      const sortedAudios = [...project.voiceovers].sort((a, b) => a.sceneNumber - b.sceneNumber);

      // Merge all audio URLs
      const audioUrls = sortedAudios.map(a => a.audioUrl);
      let mergedAudioUrl = audioUrls[0];

      if (audioUrls.length > 1) {
        setProgressStatus('Merging audio tracks...');
        setProgress(20);
        
        try {
          const mergeResponse = await supabase.functions.invoke('merge-audio', {
            body: { audioUrls }
          });
          if (mergeResponse.data?.audioUrl) {
            mergedAudioUrl = mergeResponse.data.audioUrl;
          }
        } catch (e) {
          console.log('Audio merge failed, using first audio');
        }
      }

      setProgressStatus('Stitching video clips...');
      setProgress(40);

      const videoUrls = sortedVideos.map(v => v.videoUrl);
      const audioUrlsForStitch = sortedAudios
        .filter(a => a.audioUrl && a.audioUrl.trim() !== '')
        .map(a => a.audioUrl);

      const stitchedBlob = await canvasStitchVideos({
        videoUrls,
        audioUrls: audioUrlsForStitch.length > 0 ? audioUrlsForStitch : undefined,
        onProgress: (percent) => {
          setProgress(40 + percent * 0.5);
          setProgressStatus(`Stitching... ${Math.round(percent)}%`);
        },
        onStatus: (s) => setProgressStatus(s)
      });

      videoBlobRef.current = stitchedBlob;
      const blobUrl = URL.createObjectURL(stitchedBlob);
      let savedVideoUrl = blobUrl;
      
      if (user) {
        try {
          const fileName = `${user.id}/${Date.now()}-stitched.mp4`;
          const { data: uploadData, error: uploadError } = await supabase.storage
            .from('reels')
            .upload(fileName, stitchedBlob, { contentType: 'video/mp4' });
          if (!uploadError && uploadData) {
            const { data: publicUrl } = supabase.storage.from('reels').getPublicUrl(fileName);
            savedVideoUrl = publicUrl.publicUrl;
          }
          const thumbnailUrl = project.generatedScenes[0]?.imageUrl || null;
          const totalDuration = project.voiceovers.reduce((acc, a) => acc + a.duration, 0);
          const scenesWithAllAssets = project.generatedScenes.map((scene) => {
            const video = project.videoClips.find(v => v.sceneNumber === scene.sceneNumber);
            const audio = project.voiceovers.find(a => a.sceneNumber === scene.sceneNumber);
            return { ...scene, videoUrl: video?.videoUrl || null, audioUrl: audio?.storageUrl || null, audioDuration: audio?.duration || null };
          });
          await supabase.from('reels').insert([{ user_id: user.id, topic: project.topic, video_url: savedVideoUrl, thumbnail_url: thumbnailUrl, scenes: scenesWithAllAssets as unknown as any, total_duration: totalDuration }]);
          fetchSavedReels();
        } catch (e) { console.error('Failed to save:', e); }
      }

      setProject(prev => ({ ...prev, videoBlobUrl: savedVideoUrl, videoClips: [], status: 'complete' }));
      toast({ title: "Videos Stitched & Saved!", description: "Merged and saved to My Reels." });

      setProgress(100);
      setProgressStatus('Complete!');

    } catch (error: any) {
      console.error('Stitch error:', error);
      toast({
        title: "Stitch Failed",
        description: error.message || "Failed to stitch videos together.",
        variant: "destructive"
      });
    } finally {
      setIsManualStitching(false);
    }
  };

  return (
    <Layout>
      <div className={`flex h-full ${isMobile ? '' : '-m-6'}`}>
        {/* Feature Sidebar - Hidden on Mobile and Beginner mode */}
        {!isMobile && isAdvanced && (
          <ReelFeatureSidebar
            collapsed={sidebarCollapsed}
            onCollapsedChange={setSidebarCollapsed}
            activeMode={activeMode}
            onModeChange={handleModeChange}
            features={featureToggles}
            onFeatureChange={handleFeatureChange}
            disabled={isGenerating}
          />
        )}
        
        {/* Main Content */}
        <div className={`flex-1 overflow-auto ${isMobile ? 'p-0' : 'p-6'}`}>
          <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold gradient-text">Reels & Stories</h1>
                <p className="text-muted-foreground mt-1">
                  {activeMode === 'podcast' 
                    ? 'Create long-form audio-focused podcast content'
                    : activeMode === 'ai-twin'
                    ? 'Use your AI twin with cloned voice for videos'
                    : activeMode === 'script-only'
                    ? 'Generate scripts without video production'
                    : 'Create engaging short-form videos with AI-generated scripts and captions'
                  }
                </p>
              </div>
              <div className="flex items-center gap-2">
                <CreatorModeToggle mode={creatorMode} onModeChange={setCreatorMode} />
                {showUpscaler && (
                  <Button 
                    variant="outline" 
                    onClick={() => setShowUpscaler(false)}
                    size="sm"
                  >
                    <X className="w-4 h-4 mr-2" />
                    Close Upscaler
                  </Button>
                )}
                {project.scenes.length > 0 && (
                  <Button variant="outline" onClick={resetProject}>
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Start Over
                  </Button>
                )}
              </div>
            </div>

            {/* Draft Recovery Banner */}
            {showDraftRecoveryBanner && (
              <Alert className="border-primary/50 bg-primary/5">
                <AlertCircle className="h-4 w-4 text-primary" />
                <AlertTitle>Unsaved Draft Found</AlertTitle>
                <AlertDescription className="flex flex-col sm:flex-row sm:items-center gap-3">
                  <span>You have an unsaved reel draft from {draftAge}. Would you like to restore it?</span>
                  <div className="flex gap-2">
                    <Button size="sm" variant="default" onClick={restoreDraft}>
                      <History className="w-4 h-4 mr-1" />
                      Restore Draft
                    </Button>
                    <Button size="sm" variant="ghost" onClick={dismissDraft}>
                      Dismiss
                    </Button>
                  </div>
                </AlertDescription>
              </Alert>
            )}

            {/* Video Upscaler Panel */}
            {showUpscaler && (
              <VideoUpscaler 
                videoUrl={project.videoBlobUrl}
                onUpscaleComplete={(url) => {
                  toast({
                    title: "Video Upscaled",
                    description: "Your enhanced video is ready"
                  });
                }}
                disabled={isGenerating}
              />
            )}

            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
              <TabsList className="bg-card border border-border w-full sm:w-auto">
                <TabsTrigger value="create" className="flex-1 sm:flex-none data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                  <Video className="w-4 h-4 mr-2" />
                  <span className="hidden sm:inline">Create Reel</span>
                  <span className="sm:hidden">Create</span>
                </TabsTrigger>
                <TabsTrigger value="queue" className="flex-1 sm:flex-none data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                  <ListChecks className="w-4 h-4 mr-2" />
                  <span className="hidden sm:inline">Queue {queueCount > 0 ? `(${queueCount})` : ''}</span>
                  <span className="sm:hidden">Queue {queueCount > 0 ? `(${queueCount})` : ''}</span>
                </TabsTrigger>
                <TabsTrigger value="drafts" className="flex-1 sm:flex-none data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                  <FileEdit className="w-4 h-4 mr-2" />
                  <span className="hidden sm:inline">Drafts {draftReels.length > 0 ? `(${draftReels.length})` : ''}</span>
                  <span className="sm:hidden">Drafts {draftReels.length > 0 ? `(${draftReels.length})` : ''}</span>
                </TabsTrigger>
                <TabsTrigger value="history" className="flex-1 sm:flex-none data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                  <History className="w-4 h-4 mr-2" />
                  <span className="hidden sm:inline">My Reels ({savedReels.length})</span>
                  <span className="sm:hidden">Reels ({savedReels.length})</span>
                </TabsTrigger>
              </TabsList>

              {/* Mobile Mode Selector (Advanced only) */}
              {isMobile && isAdvanced && (
                <div className="flex flex-wrap gap-2">
                  <Select value={activeMode} onValueChange={(value) => handleModeChange(value as ReelMode)}>
                    <SelectTrigger className="bg-card border-border w-full">
                      <SelectValue placeholder="Select mode..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="standard">
                        <div className="flex items-center gap-2">
                          <Video className="w-4 h-4" />
                          Standard Reel
                        </div>
                      </SelectItem>
                      <SelectItem value="podcast">
                        <div className="flex items-center gap-2">
                          <Mic className="w-4 h-4" />
                          Podcast Mode
                        </div>
                      </SelectItem>
                      <SelectItem value="ai-twin">
                        <div className="flex items-center gap-2">
                          <User className="w-4 h-4" />
                          AI Twin Mode
                        </div>
                      </SelectItem>
                      <SelectItem value="script-only">
                        <div className="flex items-center gap-2">
                          <FileText className="w-4 h-4" />
                          Script Generator
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

          <TabsContent value="create" className="space-y-6">
            {/* Progress Bar */}
            {(isGenerating || isManualStitching) && (
              <Card className="bg-card border-border">
                <CardContent className="pt-6">
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground flex items-center gap-2">
                        {project.status === 'generating-script' && 'Generating scripts...'}
                        {project.status === 'generating-video' && 'Generating scene images...'}
                        {project.status === 'rendering-video' && (progressStatus || 'Rendering video...')}
                        {isManualStitching && (progressStatus || 'Stitching...')}
                      </span>
                      <span className="text-primary font-medium">
                        {progress}%
                      </span>
                    </div>
                    <Progress value={progress} className="h-2" />
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Error with Retry Button */}
            {videoError && !isGenerating && (
              <Card className="bg-destructive/10 border-destructive/50">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex-1">
                      <p className="text-destructive font-medium">Video generation failed</p>
                      <p className="text-sm text-muted-foreground mt-1">{videoError}</p>
                    </div>
                    <Button 
                      onClick={() => {
                        setVideoError(null);
                        generateVideo();
                      }}
                      variant="outline"
                      className="border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground"
                    >
                      <RefreshCw className="w-4 h-4 mr-2" />
                      Retry
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* ===== BEGINNER MODE: Simple topic + one button ===== */}
            {isBeginner && (
              <Card className="border-primary/30 bg-gradient-to-br from-primary/5 to-transparent">
                <CardContent className="pt-8 pb-8 space-y-6">
                  <div className="text-center space-y-2">
                    <h2 className="text-2xl font-bold text-foreground">What's your reel about?</h2>
                    <p className="text-muted-foreground">Type a topic and we'll create the entire reel for you.</p>
                  </div>

                  <Textarea
                    placeholder="E.g., 5 productivity tips for remote workers, How to make the perfect coffee..."
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    className="min-h-[100px] bg-background border-border resize-none text-base"
                    disabled={isGenerating}
                  />

                  {/* Hook Style Selector */}
                  <div className="space-y-2">
                    <Label className="text-sm text-muted-foreground">Hook Style (First Scene)</Label>
                    <Select value={hookStyle} onValueChange={setHookStyle} disabled={isGenerating}>
                      <SelectTrigger className="bg-background">
                        <SelectValue placeholder="Choose a hook style" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="auto">🤖 Auto (AI picks best)</SelectItem>
                        <SelectItem value="question">❓ Question Hook</SelectItem>
                        <SelectItem value="bold-claim">💥 Bold Claim</SelectItem>
                        <SelectItem value="story">📖 Story / Personal</SelectItem>
                        <SelectItem value="statistic">📊 Shocking Statistic</SelectItem>
                        <SelectItem value="myth-buster">🔥 Myth Buster</SelectItem>
                        <SelectItem value="challenge">🎯 Challenge / Dare</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <Button 
                    onClick={generateAll} 
                    disabled={isGenerating || !topic.trim()} 
                    className="w-full bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70" 
                    size="lg"
                  >
                    {isGenerating ? (
                      <><Loader2 className="w-5 h-5 mr-2 animate-spin" />Creating your reel...</>
                    ) : (
                      <><Sparkles className="w-5 h-5 mr-2" />Make My Reel ✨</>
                    )}
                  </Button>

                  {/* Voice selector + preview in beginner mode */}
                  <div className="space-y-3 pt-2 border-t border-border">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Mic className="w-4 h-4" />
                      <span>Voice</span>
                    </div>
                    <VoiceSelector
                      selectedVoice={selectedVoice}
                      onVoiceSelect={setSelectedVoice}
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full"
                      onClick={previewVoice}
                      disabled={isGenerating || selectedVoice.startsWith('clone:')}
                    >
                      {isPreviewingVoice ? (
                        <>
                          <MicOff className="w-3 h-3 mr-1" />
                          Stop Preview
                        </>
                      ) : (
                        <>
                          <Play className="w-3 h-3 mr-1" />
                          Preview Voice
                        </>
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* ===== ADVANCED MODE: Full controls ===== */}
            {isAdvanced && (
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-primary" />
                  Create Your Reel
                </CardTitle>
                <CardDescription>
                  Choose a duration and enter a topic to generate scene scripts with captions
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* AI Topic Strategist */}
                <TopicStrategist
                  onApplyStrategy={(strategy) => {
                    // Build topic with title and hook
                    setTopic(`${strategy.title}\n\nHook: ${strategy.hookText}`);
                    
                    // Set scene count
                    setSelectedSceneCount(strategy.sceneCount.toString());
                    
                    // Calculate average scene duration
                    const avgDuration = Math.round(strategy.targetDuration / strategy.sceneCount);
                    setSelectedSceneDuration(avgDuration.toString());
                    
                    // Set hook style
                    setHookStyle(strategy.hookStyle);
                    
                    // Set outro template if available
                    if (strategy.outroTemplate) {
                      setSelectedOutro(strategy.outroTemplate);
                    }
                    
                    // Set CTA text for promotional content
                    if (strategy.callToAction) {
                      setOutroText(strategy.callToAction);
                      setFeatureToggles(prev => ({ ...prev, introOutro: true }));
                      setTemplateSectionOpen(true);
                    }
                  }}
                  disabled={isGenerating}
                  initialState={strategistState}
                  onStateChange={setStrategistState}
                />

                <div className="space-y-2">
                  <Label htmlFor="topic">Topic / Idea</Label>
                  <div className="relative">
                    <Textarea
                      id="topic"
                      placeholder="E.g., 5 productivity tips for remote workers, How to make the perfect coffee, Travel hacks for budget trips..."
                      value={topic}
                      onChange={(e) => setTopic(e.target.value)}
                      className="min-h-[100px] bg-background border-border pr-12"
                      disabled={isGenerating}
                    />
                    <Button
                      type="button"
                      variant={isListening ? "destructive" : "secondary"}
                      size="icon"
                      className="absolute right-2 top-2"
                      onClick={isListening ? stopListening : startListening}
                      disabled={isGenerating}
                    >
                      {isListening ? (
                        <MicOff className="w-4 h-4" />
                      ) : (
                        <Mic className="w-4 h-4" />
                      )}
                    </Button>
                    {isListening && (
                      <span className="absolute right-14 top-3 text-xs text-destructive animate-pulse">
                        Listening...
                      </span>
                    )}
                  </div>
                </div>

                {/* Podcast Mode Toggle */}
                <div className="flex items-center justify-between p-3 bg-gradient-to-r from-purple-500/10 to-primary/10 rounded-lg border border-purple-500/20">
                  <div className="flex items-center gap-3">
                    <Mic className="w-5 h-5 text-purple-500" />
                    <div>
                      <p className="font-medium text-sm">Podcast Mode</p>
                      <p className="text-xs text-muted-foreground">Single character monologue (up to 5 minutes)</p>
                    </div>
                  </div>
                  <Switch
                    checked={isPodcastMode}
                    onCheckedChange={(checked) => {
                      setIsPodcastMode(checked);
                      if (checked) {
                        setEnableLipSync(true); // Auto-enable lip sync for podcast
                      }
                    }}
                    disabled={isGenerating}
                  />
                </div>

                {isPodcastMode ? (
                  // Podcast Mode Settings
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 p-4 bg-purple-500/5 rounded-lg border border-purple-500/20">
                    <div className="space-y-2">
                      <Label>Podcast Duration</Label>
                      <Select value={podcastDuration} onValueChange={setPodcastDuration} disabled={isGenerating}>
                        <SelectTrigger className="bg-background border-border">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {PODCAST_DURATION_OPTIONS.map(option => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">
                        ~{Math.round(parseInt(podcastDuration) * 2.5)} words
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label>Character</Label>
                      <Select 
                        value={selectedCharacterId || ''} 
                        onValueChange={(v) => {
                          setSelectedCharacterId(v || null);
                          // Set character's first reference image as portrait
                          const char = characters.find(c => c.id === v);
                          if (char && char.reference_images?.[0]) {
                            setPortraitImage(char.reference_images[0]);
                            setPortraitPreview(char.reference_images[0]);
                            analyzeReferenceImage(char.reference_images[0]);
                          }
                        }} 
                        disabled={isGenerating}
                      >
                        <SelectTrigger className="bg-background border-border">
                          <SelectValue placeholder="Select character..." />
                        </SelectTrigger>
                        <SelectContent>
                          {characters.map(char => (
                            <SelectItem key={char.id} value={char.id}>
                              {char.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {characters.length === 0 && (
                        <p className="text-xs text-muted-foreground">
                          No characters found. Create one in the Characters page.
                        </p>
                      )}
                    </div>

                  </div>
                ) : (
                  // Normal Reel Mode Settings
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="space-y-2">
                      <Label>Number of Scenes</Label>
                      <Select value={selectedSceneCount} onValueChange={setSelectedSceneCount} disabled={isGenerating}>
                        <SelectTrigger className="bg-background border-border">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {SCENE_COUNT_OPTIONS.map(option => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Scene Duration</Label>
                      <Select value={selectedSceneDuration} onValueChange={setSelectedSceneDuration} disabled={isGenerating}>
                        <SelectTrigger className="bg-background border-border">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {SCENE_DURATION_OPTIONS.map(option => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">
                        Total: ~{parseInt(selectedSceneCount) * parseInt(selectedSceneDuration)}s
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label>Hook Style</Label>
                      <Select value={hookStyle} onValueChange={setHookStyle} disabled={isGenerating}>
                        <SelectTrigger className="bg-background border-border">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="auto">Auto (Topic-based)</SelectItem>
                          <SelectItem value="bold_claim">Bold Claim</SelectItem>
                          <SelectItem value="question">Question</SelectItem>
                          <SelectItem value="controversy">Controversy</SelectItem>
                          <SelectItem value="story">Story</SelectItem>
                          <SelectItem value="secret">Secret Reveal</SelectItem>
                          <SelectItem value="countdown">Countdown/List</SelectItem>
                          <SelectItem value="fomo">FOMO</SelectItem>
                          <SelectItem value="curiosity">Curiosity Gap</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>


                    <div className="space-y-2">
                      <Label>Transition Style</Label>
                      <Select value={transitionStyle} onValueChange={(v) => setTransitionStyle(v as typeof transitionStyle)} disabled={isGenerating}>
                        <SelectTrigger className="bg-background border-border">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="crossfade">Crossfade (Smooth)</SelectItem>
                          <SelectItem value="fade">Fade (Quick)</SelectItem>
                          <SelectItem value="slide">Slide (Dynamic)</SelectItem>
                          <SelectItem value="zoom">Zoom (Cinematic)</SelectItem>
                          <SelectItem value="wipe">Wipe (Directional)</SelectItem>
                          <SelectItem value="blur">Blur (Dreamy)</SelectItem>
                          <SelectItem value="dissolve">Dissolve (Soft)</SelectItem>
                          <SelectItem value="spin">Spin (Energetic)</SelectItem>
                          <SelectItem value="flip">Flip (3D Effect)</SelectItem>
                          <SelectItem value="none">None (Hard Cut)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}

                {/* Video Size Selection */}
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Video className="w-4 h-4 text-primary" />
                    Video Size / Aspect Ratio
                  </Label>
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
                    {VIDEO_SIZE_OPTIONS.map(option => (
                      <button
                        key={option.value}
                        onClick={() => setSelectedVideoSize(option.value)}
                        disabled={isGenerating}
                        className={`p-3 rounded-lg border text-left transition-all ${
                          selectedVideoSize === option.value
                            ? 'border-primary bg-primary/10 ring-1 ring-primary'
                            : 'border-border bg-muted/30 hover:border-primary/50'
                        } disabled:opacity-50 disabled:cursor-not-allowed`}
                      >
                        <div className="font-medium text-sm">{option.label}</div>
                        <div className="text-[10px] text-muted-foreground mt-0.5">{option.description}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Cut Scenes Toggle with Expandable Options */}
                <Collapsible open={cutScenesExpanded} onOpenChange={setCutScenesExpanded}>
                  <div className="rounded-lg border border-border overflow-hidden">
                    <CollapsibleTrigger asChild>
                      <div 
                        className={`flex items-center justify-between p-3 cursor-pointer transition-colors ${
                          enableCutScenes ? 'bg-primary/10' : 'bg-muted/50 hover:bg-muted'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <Layers className="w-4 h-4 text-primary" />
                          <div>
                            <Label className="text-sm font-medium cursor-pointer">Insert Cut Scenes</Label>
                            <p className="text-xs text-muted-foreground">Add 1-2s transition scenes for better flow</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={enableCutScenes}
                            onCheckedChange={(checked) => {
                              setEnableCutScenes(checked);
                              setFeatureToggles(prev => ({ ...prev, cutScenes: checked }));
                              if (checked) setCutScenesExpanded(true);
                            }}
                            disabled={isGenerating}
                            onClick={(e) => e.stopPropagation()}
                          />
                          <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${cutScenesExpanded ? 'rotate-180' : ''}`} />
                        </div>
                      </div>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="p-4 border-t border-border bg-background space-y-4">
                        <div className="space-y-2">
                          <Label className="text-sm">Cut Scene Style</Label>
                          <Select defaultValue="dynamic" disabled={isGenerating || !enableCutScenes}>
                            <SelectTrigger className="bg-muted/50 border-border">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="dynamic">Dynamic (Motion)</SelectItem>
                              <SelectItem value="subtle">Subtle (Fade)</SelectItem>
                              <SelectItem value="dramatic">Dramatic (Zoom)</SelectItem>
                              <SelectItem value="minimal">Minimal (Quick Cut)</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label className="text-sm">Cut Scene Duration</Label>
                          <Select defaultValue="1.5" disabled={isGenerating || !enableCutScenes}>
                            <SelectTrigger className="bg-muted/50 border-border">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="0.5">0.5 seconds</SelectItem>
                              <SelectItem value="1">1 second</SelectItem>
                              <SelectItem value="1.5">1.5 seconds</SelectItem>
                              <SelectItem value="2">2 seconds</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Cut scenes will be automatically inserted between main scenes to create smooth transitions.
                        </p>
                      </div>
                    </CollapsibleContent>
                  </div>
                </Collapsible>

                <div className="flex items-end">
                  <Button 
                    onClick={generateScripts}
                    disabled={isGenerating || !topic.trim()}
                    className="w-full bg-gradient-primary hover:opacity-90"
                  >
                    {isGenerating && project.status === 'generating-script' ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <FileText className="w-4 h-4 mr-2" />
                    )}
                    Generate Scripts
                  </Button>
                </div>
              </CardContent>
            </Card>
            )}

            {/* Voice Selection - Hidden in beginner mode and when using uploaded audio */}
            {isAdvanced && customAudioMode !== 'upload' && (
              <>
                {selectedTwinId && aiTwins.find(t => t.id === selectedTwinId)?.voice_cloning_key ? (
                  <Card className="bg-card border-border">
                    <CardHeader>
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-primary" />
                        AI Twin Cloned Voice Active
                      </CardTitle>
                      <CardDescription>
                        Using cloned voice from "{aiTwins.find(t => t.id === selectedTwinId)?.name}"
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => {
                          setSelectedTwinId(null);
                          setSelectedVoice('en-US-Journey-D');
                          toast({
                            title: "Voice Reset",
                            description: "Switched to standard voice selection",
                          });
                        }}
                      >
                        Switch to Standard Voice
                      </Button>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="space-y-2">
                    <VoiceSelector 
                      selectedVoice={selectedVoice}
                      onVoiceSelect={setSelectedVoice}
                      disabled={isGenerating}
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full"
                      onClick={previewVoice}
                      disabled={isGenerating || selectedVoice.startsWith('clone:')}
                    >
                      {isPreviewingVoice ? (
                        <>
                          <MicOff className="w-3 h-3 mr-1" />
                          Stop Preview
                        </>
                      ) : (
                        <>
                          <Mic className="w-3 h-3 mr-1" />
                          Preview Voice
                        </>
                      )}
                    </Button>
                  </div>
                )}
              </>
            )}

            {/* Lip Sync Mode - Expandable (Advanced only) */}
            {isAdvanced && (
            <Collapsible open={lipSyncExpanded} onOpenChange={setLipSyncExpanded}>
              <Card className="bg-card border-border overflow-hidden">
                <CollapsibleTrigger asChild>
                  <CardHeader className="cursor-pointer hover:bg-muted/30 transition-colors">
                    <CardTitle className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <User className="w-5 h-5 text-primary" />
                        Lip Sync Mode
                        {enableLipSync && (
                          <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded-full">
                            Enabled
                          </span>
                        )}
                      </div>
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={enableLipSync}
                            onCheckedChange={(checked) => {
                              setEnableLipSync(checked);
                              setFeatureToggles(prev => ({ ...prev, lipSync: checked }));
                              if (checked) setLipSyncExpanded(true);
                            }}
                            disabled={isGenerating}
                            onClick={(e) => e.stopPropagation()}
                        />
                        <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${lipSyncExpanded ? 'rotate-180' : ''}`} />
                      </div>
                    </CardTitle>
                    <CardDescription>
                      Create talking head videos with synchronized lip movements
                    </CardDescription>
                  </CardHeader>
                </CollapsibleTrigger>
                <CollapsibleContent>
                {enableLipSync && (
                <CardContent className="space-y-4 pt-0">
                  {/* AI Twin Selector */}
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <Sparkles className="w-3 h-3 text-primary" />
                      Select AI Twin (Quick Setup)
                    </Label>
                    <Select 
                      value={selectedTwinId || ''} 
                      onValueChange={(v) => {
                        setSelectedTwinId(v || null);
                        const twin = aiTwins.find(t => t.id === v);
                        if (twin) {
                          // Set portrait from twin's first reference image
                          if (twin.reference_images?.[0]) {
                            setPortraitImage(twin.reference_images[0]);
                            setPortraitPreview(twin.reference_images[0]);
                            setPreSelectedReference(twin.reference_images[0]);
                          }
                          // Set character description from face description
                          if (twin.face_description) {
                            setCharacterDescription(twin.face_description);
                          }
                          toast({
                            title: `AI Twin "${twin.name}" Selected`,
                            description: twin.voice_cloning_key 
                              ? 'Voice clone and reference images applied' 
                              : 'Reference images applied (no cloned voice)',
                          });
                        }
                      }} 
                      disabled={isGenerating}
                    >
                      <SelectTrigger className="bg-background border-border">
                        <SelectValue placeholder="Choose an AI Twin..." />
                      </SelectTrigger>
                      <SelectContent>
                        {aiTwins.map(twin => (
                          <SelectItem key={twin.id} value={twin.id}>
                            <div className="flex items-center gap-2">
                              <span>{twin.name}</span>
                              {twin.voice_cloning_key && (
                                <span className="text-[10px] bg-primary/20 text-primary px-1.5 py-0.5 rounded">Voice</span>
                              )}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {aiTwins.length === 0 && (
                      <p className="text-xs text-muted-foreground">
                        No AI Twins found. Create one in the AI Twin page for quick voice + image setup.
                      </p>
                    )}
                    {aiTwins.length > 0 && (
                      <p className="text-xs text-muted-foreground">
                        Select your AI Twin to auto-fill portrait and cloned voice settings.
                      </p>
                    )}
                  </div>

                  {/* Generate Character On-Demand */}
                  <div className="relative flex items-center my-2">
                    <div className="flex-1 border-t border-border" />
                    <span className="px-3 text-xs text-muted-foreground">or generate a character</span>
                    <div className="flex-1 border-t border-border" />
                  </div>

                  {!showGenerateCharacter ? (
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full"
                      onClick={() => setShowGenerateCharacter(true)}
                      disabled={isGenerating}
                    >
                      <Wand2 className="w-3 h-3 mr-1" />
                      Generate a Person with AI
                    </Button>
                  ) : (
                    <div className="space-y-2 p-3 rounded-lg border border-border bg-muted/30">
                      <Label className="text-xs">Describe the person</Label>
                      <Textarea
                        value={generateCharacterPrompt}
                        onChange={(e) => setGenerateCharacterPrompt(e.target.value)}
                        placeholder="e.g. Professional woman in her 30s, dark hair, business attire, warm smile"
                        rows={2}
                        className="text-xs"
                      />
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={generateCharacter}
                          disabled={isGeneratingCharacter || !generateCharacterPrompt.trim()}
                          className="flex-1"
                        >
                          {isGeneratingCharacter ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Sparkles className="w-3 h-3 mr-1" />}
                          Generate
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setShowGenerateCharacter(false)}>
                          Cancel
                        </Button>
                      </div>
                    </div>
                  )}

                  <div className="relative flex items-center my-2">
                    <div className="flex-1 border-t border-border" />
                    <span className="px-3 text-xs text-muted-foreground">or upload manually</span>
                    <div className="flex-1 border-t border-border" />
                  </div>

                  {/* Portrait Upload */}
                  <div className="space-y-2">
                    <Label>Character Portrait</Label>
                    {portraitPreview ? (
                      <div className="relative inline-block">
                        <img 
                          src={portraitPreview} 
                          alt="Portrait preview" 
                          className="w-32 h-32 object-cover rounded-lg border border-border"
                        />
                        <Button
                          variant="destructive"
                          size="icon"
                          className="absolute -top-2 -right-2 w-6 h-6"
                          onClick={() => {
                            removePortrait();
                            setCharacterDescription('');
                            setPreSelectedReference(null);
                          }}
                        >
                          <X className="w-3 h-3" />
                        </Button>
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <div 
                          className="w-32 h-32 border-2 border-dashed border-border rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-primary/50 transition-colors"
                          onClick={() => portraitInputRef.current?.click()}
                        >
                          <Upload className="w-6 h-6 text-muted-foreground mb-2" />
                          <span className="text-xs text-muted-foreground text-center px-2">Upload New</span>
                        </div>
                        <GalleryImagePicker
                          onSelect={(imageUrl) => {
                            setPortraitPreview(imageUrl);
                            setPortraitImage(imageUrl);
                            // Also set as reference image for script generation
                            setPreSelectedReference(imageUrl);
                            analyzeReferenceImage(imageUrl);
                          }}
                          title="Select Portrait from Gallery"
                          trigger={
                            <div className="w-32 h-32 border-2 border-dashed border-border rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-primary/50 transition-colors">
                              <FolderOpen className="w-6 h-6 text-muted-foreground mb-2" />
                              <span className="text-xs text-muted-foreground text-center px-2">From Gallery</span>
                            </div>
                          }
                        />
                      </div>
                    )}
                    <Input
                      ref={portraitInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        handlePortraitUpload(e);
                        // After upload completes, also analyze for character description
                        const file = e.target.files?.[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onload = async (event) => {
                            const imageUrl = event.target?.result as string;
                            setPreSelectedReference(imageUrl);
                            analyzeReferenceImage(imageUrl);
                          };
                          reader.readAsDataURL(file);
                        }
                      }}
                    />
                    <p className="text-xs text-muted-foreground">
                      Upload or select a front-facing portrait for lip sync and character consistency
                    </p>
                  </div>

                  {/* Character Description - Auto-detected from portrait */}
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <User className="w-3 h-3" />
                      Character Description
                      {isAnalyzingReference && (
                        <span className="flex items-center gap-1 text-primary">
                          <Loader2 className="w-3 h-3 animate-spin" />
                          <span className="text-[10px]">Detecting...</span>
                        </span>
                      )}
                    </Label>
                    <Input
                      placeholder="e.g., Male entrepreneur, 30s, professional attire"
                      value={characterDescription}
                      onChange={(e) => setCharacterDescription(e.target.value)}
                      className="text-sm"
                      disabled={isAnalyzingReference}
                    />
                    <p className="text-xs text-muted-foreground">
                      {portraitPreview 
                        ? "Auto-detected from portrait. Edit if needed - this ensures scripts describe your character correctly."
                        : "Describe the person so all generated scripts match their gender, age, and appearance."}
                    </p>
                  </div>

                  {/* Model Selection */}
                  <div className="space-y-2">
                    <Label>Lip Sync Model</Label>
                    <Select 
                      value={lipSyncModel} 
                      onValueChange={(v) => setLipSyncModel(v as typeof lipSyncModel)}
                      disabled={isGenerating}
                    >
                      <SelectTrigger className="bg-background border-border">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="infinitetalk">
                          InfiniteTalk (Recommended)
                        </SelectItem>
                        <SelectItem value="avatar-omni-human-1.5">
                          Avatar Omni Human 1.5
                        </SelectItem>
                        <SelectItem value="wan-animate">
                          WAN Animate (Character)
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      {lipSyncModel === 'infinitetalk' && 'Best for realistic talking head videos with native voice'}
                      {lipSyncModel === 'avatar-omni-human-1.5' && 'Full body avatar animation with native speech'}
                      {lipSyncModel === 'wan-animate' && 'Animated character with lip sync (requires audio)'}
                    </p>
                  </div>

                  {/* Voiceover Source Selection */}
                  <div className="space-y-3 pt-2 border-t border-border">
                    <Label className="flex items-center gap-2">
                      <Mic className="w-3 h-3" />
                      Voiceover Source
                    </Label>
                    
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        type="button"
                        variant={customAudioMode === 'tts' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setCustomAudioMode('tts')}
                        disabled={isGenerating}
                        className="justify-start"
                      >
                        <Sparkles className="w-4 h-4 mr-2" />
                        AI Voice
                      </Button>
                      <Button
                        type="button"
                        variant={customAudioMode === 'upload' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setCustomAudioMode('upload')}
                        disabled={isGenerating}
                        className="justify-start"
                      >
                        <Upload className="w-4 h-4 mr-2" />
                        Upload Audio
                      </Button>
                    </div>

                    {customAudioMode === 'upload' && (
                      <div className="space-y-3 p-3 bg-muted/30 rounded-lg border border-border">
                        <input
                          type="file"
                          ref={customAudioInputRef}
                          accept=".mp3,.wav,.m4a,.webm,audio/*"
                          className="hidden"
                          onChange={handleCustomAudioUpload}
                        />
                        
                        {!customAudioUrl ? (
                          <div
                            className="border-2 border-dashed border-border rounded-lg p-4 text-center cursor-pointer hover:border-primary/50 hover:bg-muted/50 transition-colors"
                            onClick={() => customAudioInputRef.current?.click()}
                          >
                            {isUploadingAudio ? (
                              <div className="flex flex-col items-center gap-2">
                                <Loader2 className="w-8 h-8 animate-spin text-primary" />
                                <p className="text-sm text-muted-foreground">Uploading...</p>
                              </div>
                            ) : (
                              <>
                                <Upload className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
                                <p className="text-sm font-medium">Click to upload audio</p>
                                <p className="text-xs text-muted-foreground mt-1">
                                  MP3, WAV, M4A, WebM • Max 50MB
                                </p>
                              </>
                            )}
                          </div>
                        ) : (
                          <div className="space-y-2">
                            <div className="flex items-center justify-between p-3 bg-background rounded-lg border border-border">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                                  <Mic className="w-5 h-5 text-primary" />
                                </div>
                                <div>
                                  <p className="text-sm font-medium">Custom Audio</p>
                                  <p className="text-xs text-muted-foreground">
                                    Duration: {customAudioDuration.toFixed(1)}s
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <audio
                                  src={customAudioUrl}
                                  controls
                                  className="h-8 w-32"
                                />
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  onClick={removeCustomAudio}
                                  className="h-8 w-8 text-destructive hover:bg-destructive/10"
                                >
                                  <X className="w-4 h-4" />
                                </Button>
                              </div>
                            </div>
                            <p className="text-xs text-muted-foreground">
                              This audio will be used for lip sync instead of AI-generated voiceover
                            </p>
                          </div>
                        )}
                      </div>
                    )}

                    {customAudioMode === 'tts' && (
                      <p className="text-xs text-muted-foreground">
                        AI will generate voiceover from your script and sync lips to the audio
                      </p>
                    )}
                  </div>
                </CardContent>
              )}
              </CollapsibleContent>
              </Card>
            </Collapsible>
            )}

            {/* Intro/Outro Templates - Only visible when enabled from sidebar (Advanced only) */}
            {isAdvanced && featureToggles.introOutro && (
              <Collapsible open={templateSectionOpen} onOpenChange={setTemplateSectionOpen}>
                <Card className="bg-card border-border">
                  <CollapsibleTrigger asChild>
                    <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                      <CardTitle className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Palette className="w-5 h-5 text-primary" />
                          Intro & Outro Templates
                          {(selectedIntro !== 'none' || selectedOutro !== 'none') && (
                            <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded-full">
                              {[selectedIntro !== 'none' && 'Intro', selectedOutro !== 'none' && 'Outro'].filter(Boolean).join(' + ')}
                            </span>
                          )}
                        </div>
                        <ChevronDown className={`w-5 h-5 text-muted-foreground transition-transform ${templateSectionOpen ? 'rotate-180' : ''}`} />
                      </CardTitle>
                      <CardDescription>
                        Add professional intro and outro screens to your reel
                      </CardDescription>
                    </CardHeader>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <CardContent className="pt-0">
                      <TemplateSelector
                        selectedIntro={selectedIntro}
                        selectedOutro={selectedOutro}
                        introText={introText}
                        outroText={outroText}
                        onIntroChange={setSelectedIntro}
                        onOutroChange={setSelectedOutro}
                        onIntroTextChange={setIntroText}
                        onOutroTextChange={setOutroText}
                        selectedLogoUrl={selectedLogoUrl}
                        selectedLogoAnimation={selectedLogoAnimation}
                        onLogoChange={setSelectedLogoUrl}
                        onLogoAnimationChange={setSelectedLogoAnimation}
                        disabled={isGenerating}
                      />
                    </CardContent>
                  </CollapsibleContent>
                </Card>
              </Collapsible>
            )}

            {/* Generated Scenes (Advanced only - beginner skips straight to video) */}
            {isAdvanced && project.scenes.length > 0 && (
              <Card className="bg-card border-border">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="w-5 h-5 text-primary" />
                    Scene Scripts
                  </CardTitle>
                  <CardDescription>
                    Review and edit your scene scripts before generating the video
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Total duration summary */}
                  {project.voiceovers.length > 0 && (
                    <div className="flex items-center justify-between p-3 bg-primary/10 rounded-lg border border-primary/20">
                      <div className="flex items-center gap-2">
                        <Mic className="w-4 h-4 text-primary" />
                        <span className="text-sm font-medium">Total Voiceover Duration</span>
                      </div>
                      <span className="text-sm font-bold text-primary">
                        {project.voiceovers.reduce((acc, v) => acc + v.duration, 0).toFixed(1)}s
                      </span>
                    </div>
                  )}
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {project.scenes.map((scene) => {
                      const voiceover = project.voiceovers.find(v => v.sceneNumber === scene.sceneNumber);
                      const actualDuration = voiceover?.duration;
                      
                      return (
                        <Card key={scene.sceneNumber} className={`bg-background border-border ${scene.isIntro || scene.isOutro ? 'ring-2 ring-primary/30' : ''}`}>
                          <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium flex items-center gap-2">
                              <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                                scene.isIntro ? 'bg-green-500/20 text-green-500' : 
                                scene.isOutro ? 'bg-orange-500/20 text-orange-500' : 
                                'bg-primary/20 text-primary'
                              }`}>
                                {scene.isIntro ? 'I' : scene.isOutro ? 'O' : scene.sceneNumber}
                              </span>
                              {scene.isIntro ? 'Intro' : scene.isOutro ? 'Outro' : `Scene ${scene.sceneNumber}`}
                              {(scene.isIntro || scene.isOutro) && (
                                <span className="text-xs bg-muted px-1.5 py-0.5 rounded">Template</span>
                              )}
                              <div className="ml-auto flex items-center gap-1.5">
                                {actualDuration ? (
                                  actualDuration > 8 ? (
                                    <span className="text-xs font-medium text-orange-500 bg-orange-500/10 px-2 py-0.5 rounded-full flex items-center gap-1" title="Audio exceeds 8s video limit - will carry over to next clip">
                                      <Mic className="w-3 h-3" />
                                      {actualDuration.toFixed(1)}s ⚠️
                                    </span>
                                  ) : (
                                    <span className="text-xs font-medium text-primary bg-primary/10 px-2 py-0.5 rounded-full flex items-center gap-1">
                                      <Mic className="w-3 h-3" />
                                      {actualDuration.toFixed(1)}s
                                    </span>
                                  )
                                ) : (
                                  <span className="text-xs text-muted-foreground">
                                    ~{scene.duration}s
                                  </span>
                                )}
                              </div>
                            </CardTitle>
                            {actualDuration && actualDuration > 8 && (
                              <p className="text-xs text-orange-500 mt-1">
                                ⚠️ Audio ({actualDuration.toFixed(1)}s) exceeds 8s video limit. Consider shortening.
                              </p>
                            )}
                          </CardHeader>
                          <CardContent className="space-y-2">
                            <div>
                              <Label className="text-xs text-muted-foreground flex items-center gap-2">
                                Narration (Caption)
                                <span className="text-muted-foreground/70">
                                  {scene.narration.split(/\s+/).filter(w => w).length} words
                                </span>
                              </Label>
                              <Textarea
                                value={scene.narration}
                                onChange={(e) => updateSceneNarration(scene.sceneNumber, e.target.value)}
                                className="mt-1 text-sm min-h-[80px] bg-card border-border"
                                disabled={isGenerating}
                              />
                            </div>
                            <div>
                              <Label className="text-xs text-muted-foreground">Visual Description</Label>
                              <p className="text-xs text-muted-foreground mt-1 p-2 bg-muted/50 rounded">
                                {scene.visualDescription}
                              </p>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>

                  {/* Character Reference Selection - Before Preview */}
                  {/* Show simplified version if lip sync portrait is already set */}
                  {enableLipSync && portraitPreview ? (
                    <Card className="bg-muted/30 border-dashed border-green-500/30">
                      <CardContent className="py-4">
                        <div className="flex items-center gap-3">
                          <img 
                            src={portraitPreview} 
                            alt="Reference" 
                            className="w-16 h-16 object-cover rounded-lg border-2 border-green-500"
                          />
                          <div className="flex-1">
                            <p className="text-sm font-medium text-green-600 dark:text-green-400 flex items-center gap-2">
                              <Camera className="w-4 h-4" />
                              Character Reference Set
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Using lip sync portrait: {characterDescription || 'Analyzing...'}
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ) : (
                    <Card className="bg-muted/30 border-dashed border-primary/30">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <Camera className="w-4 h-4 text-primary" />
                          Character Reference (Optional)
                        </CardTitle>
                        <CardDescription className="text-xs">
                          Select a reference image to maintain character consistency across all scenes
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {preSelectedReference || selectedTwinId ? (
                          <div className="flex items-start gap-4">
                            <div className="relative flex gap-2">
                              {/* Show all reference images for AI Twin */}
                              {selectedTwinId && aiTwins.find(t => t.id === selectedTwinId)?.reference_images?.slice(0, 5).map((img, idx) => (
                                <img 
                                  key={idx}
                                  src={img} 
                                  alt={`Reference ${idx + 1}`} 
                                  className={`w-16 h-16 object-cover rounded-lg border-2 ${idx === 0 ? 'border-primary' : 'border-border'}`}
                                />
                              ))}
                              {selectedTwinId && (aiTwins.find(t => t.id === selectedTwinId)?.reference_images?.length || 0) > 5 && (
                                <div className="w-16 h-16 rounded-lg bg-muted flex items-center justify-center text-xs font-medium border-2 border-border">
                                  +{(aiTwins.find(t => t.id === selectedTwinId)?.reference_images?.length || 0) - 5}
                                </div>
                              )}
                              {/* Show single reference if not from AI Twin */}
                              {!selectedTwinId && preSelectedReference && (
                                <img 
                                  src={preSelectedReference} 
                                  alt="Reference" 
                                  className="w-24 h-24 object-cover rounded-lg border-2 border-primary"
                                />
                              )}
                              <Button
                                variant="destructive"
                                size="icon"
                                className="absolute -top-2 -right-2 w-6 h-6"
                                onClick={() => {
                                  setPreSelectedReference(null);
                                  setPreReferenceTransformation('');
                                  setCharacterDescription('');
                                  setSelectedTwinId(null);
                                }}
                              >
                                <X className="w-3 h-3" />
                              </Button>
                            </div>
                            <div className="flex-1 space-y-2">
                              {selectedTwinId && (
                                <div className="flex items-center gap-2 mb-2">
                                  <span className="text-sm font-medium">{aiTwins.find(t => t.id === selectedTwinId)?.name}</span>
                                  {aiTwins.find(t => t.id === selectedTwinId)?.voice_cloning_key && (
                                    <span className="text-[10px] bg-primary text-primary-foreground px-1.5 py-0.5 rounded">Cloned Voice</span>
                                  )}
                                  <span className="text-xs text-muted-foreground">
                                    ({aiTwins.find(t => t.id === selectedTwinId)?.reference_images?.length || 0} images)
                                  </span>
                                </div>
                              )}
                              <Label className="text-xs">Character Transformation (Optional)</Label>
                              <Input
                                placeholder="e.g., make them a superhero, wearing a suit..."
                                value={preReferenceTransformation}
                                onChange={(e) => setPreReferenceTransformation(e.target.value)}
                                className="text-sm"
                              />
                            </div>
                          </div>
                        ) : (
                          <div className="flex gap-2 flex-wrap">
                            {/* Upload */}
                            <div 
                              className="w-20 h-20 border-2 border-dashed border-border rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-primary/50 transition-colors"
                              onClick={() => referenceInputRef.current?.click()}
                            >
                              <Upload className="w-5 h-5 text-muted-foreground mb-1" />
                              <span className="text-[10px] text-muted-foreground text-center">Upload</span>
                            </div>
                            
                            {/* From Gallery */}
                            <GalleryImagePicker
                              onSelect={(imageUrl) => handleReferenceSelected(imageUrl)}
                              title="Select Reference from Gallery"
                              trigger={
                                <div className="w-20 h-20 border-2 border-dashed border-border rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-primary/50 transition-colors">
                                  <FolderOpen className="w-5 h-5 text-muted-foreground mb-1" />
                                  <span className="text-[10px] text-muted-foreground text-center">Gallery</span>
                                </div>
                              }
                            />
                            
                            {/* From AI Twins - show twins with voice badge */}
                            {aiTwins.length > 0 && (
                              <div className="flex gap-2">
                                {aiTwins.slice(0, 3).map((twin) => (
                                  twin.reference_images?.[0] && (
                                    <div 
                                      key={twin.id}
                                      className="w-20 h-20 rounded-lg overflow-hidden cursor-pointer border-2 border-border hover:border-primary transition-colors relative group"
                                      onClick={() => {
                                        handleReferenceSelected(twin.reference_images[0]);
                                        setSelectedTwinId(twin.id);
                                        // Auto-apply cloned voice if available
                                        if (twin.voice_cloning_key) {
                                          setSelectedVoice(`clone:${twin.voice_cloning_key}`);
                                          toast({
                                            title: `AI Twin "${twin.name}" Selected`,
                                            description: 'Cloned voice will be used for voiceovers',
                                          });
                                        } else {
                                          // Auto-match voice to twin's gender
                                          const twinGender = (twin as any).gender?.toLowerCase();
                                          const descLower = (twin.face_description || twin.name || '').toLowerCase();
                                          const femaleHints = ['woman', 'female', 'girl', 'lady', 'she', 'her'];
                                          const isFemale = twinGender === 'female' || femaleHints.some(k => descLower.includes(k));
                                          const isMale = twinGender === 'male' || (!isFemale && ['man', 'male', 'boy', 'guy'].some(k => descLower.includes(k)));
                                          
                                          if (isFemale) {
                                            setSelectedVoice('en-US-Journey-F');
                                          } else if (isMale) {
                                            setSelectedVoice('en-US-Journey-D');
                                          }
                                          
                                          toast({
                                            title: `AI Twin "${twin.name}" Selected`,
                                            description: `Reference image applied${isFemale ? ', female voice set' : isMale ? ', male voice set' : ' (no cloned voice)'}`,
                                          });
                                        }
                                        // Apply face description if available
                                        if (twin.face_description) {
                                          setCharacterDescription(twin.face_description);
                                        }
                                      }}
                                      title={twin.name}
                                    >
                                      <img 
                                        src={twin.reference_images[0]} 
                                        alt={twin.name}
                                        className="w-full h-full object-cover"
                                      />
                                      <div className="absolute bottom-0 left-0 right-0 bg-black/70 px-1 py-0.5">
                                        <p className="text-[9px] text-white truncate">{twin.name}</p>
                                      </div>
                                      {twin.voice_cloning_key && (
                                        <div className="absolute top-1 right-1 bg-primary text-primary-foreground px-1 py-0.5 rounded text-[8px]">
                                          Voice
                                        </div>
                                      )}
                                    </div>
                                  )
                                ))}
                              </div>
                            )}
                            
                            {/* From Characters - show character thumbnails if available */}
                            {characters.length > 0 && (
                              <div className="flex gap-2">
                                {characters.slice(0, 3).map((char) => (
                                  char.reference_images?.[0] && (
                                    <div 
                                      key={char.id}
                                      className="w-20 h-20 rounded-lg overflow-hidden cursor-pointer border-2 border-border hover:border-primary transition-colors relative group"
                                      onClick={() => handleReferenceSelected(char.reference_images[0])}
                                      title={char.name}
                                    >
                                      <img 
                                        src={char.reference_images[0]} 
                                        alt={char.name}
                                        className="w-full h-full object-cover"
                                      />
                                      <div className="absolute bottom-0 left-0 right-0 bg-black/70 px-1 py-0.5">
                                        <p className="text-[9px] text-white truncate">{char.name}</p>
                                      </div>
                                    </div>
                                  )
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                        <Input
                          ref={referenceInputRef}
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            // Upload to storage for persistence
                            if (user) {
                              const fileName = `${user.id}/references/${Date.now()}-ref.${file.type.split('/')[1] || 'jpg'}`;
                              const { data: uploadData, error: uploadError } = await supabase.storage
                                .from('reels')
                                .upload(fileName, file, { contentType: file.type });
                              if (!uploadError && uploadData) {
                                const { data: publicUrl } = supabase.storage.from('reels').getPublicUrl(fileName);
                                handleReferenceSelected(publicUrl.publicUrl);
                                return;
                              }
                            }
                            // Fallback to base64
                            const reader = new FileReader();
                            reader.onload = (ev) => {
                              handleReferenceSelected(ev.target?.result as string);
                            };
                            reader.readAsDataURL(file);
                          }}
                        />
                        
                        {/* Character Description for Script Generation */}
                        <div className="space-y-2 pt-2 border-t border-border/50">
                          <Label className="text-xs flex items-center gap-2">
                            <User className="w-3 h-3" />
                            Character Description (for script)
                            {isAnalyzingReference && (
                              <span className="flex items-center gap-1 text-primary">
                                <Loader2 className="w-3 h-3 animate-spin" />
                                <span className="text-[10px]">Detecting...</span>
                              </span>
                            )}
                          </Label>
                          <Input
                            placeholder="e.g., Male entrepreneur, 30s, professional attire"
                            value={characterDescription}
                            onChange={(e) => setCharacterDescription(e.target.value)}
                            className="text-sm"
                            disabled={isAnalyzingReference}
                          />
                          <p className="text-[10px] text-muted-foreground">
                            {preSelectedReference 
                              ? "Auto-detected from image. Edit if needed to ensure scripts match the character."
                              : "Describe the person to ensure all generated scripts match their gender, age, and appearance"}
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  <div className="flex gap-3 pt-4">
                    <Button
                      onClick={() => {
                        // Use portrait image as reference when lip sync is enabled
                        const referenceToUse = (enableLipSync && portraitImage) ? portraitImage : preSelectedReference;
                        
                        // Get character reference image if a character is selected
                        const selectedCharacter = selectedCharacterId 
                          ? characters.find(c => c.id === selectedCharacterId)
                          : null;
                        const characterRefImage = selectedCharacter?.reference_images?.[0];
                        
                        if (referenceToUse) {
                          setExternalReference(referenceToUse);
                          if (preReferenceTransformation) {
                            setCharacterTransformation(preReferenceTransformation);
                          }
                        }
                        const selectedTwin = aiTwins.find(t => t.id === selectedTwinId);
                        // Use voice_cloning_key which is the Speechify voice ID
                        const speechifyVoiceId = selectedTwin?.voice_cloning_key || undefined;
                        // Pass all reference images from the AI Twin for character consistency
                        const allTwinReferenceImages = selectedTwin?.reference_images || [];
                        
                        // Pass custom audio if in upload mode
                        const customAudio = customAudioMode === 'upload' && customAudioUrl ? customAudioUrl : undefined;
                        const customDuration = customAudioMode === 'upload' && customAudioDuration ? customAudioDuration : undefined;
                        
                        generatePreview(
                          project.scenes, 
                          user?.id, 
                          referenceToUse || undefined, 
                          selectedVoice,
                          characterRefImage || undefined,
                          characterDescription || selectedTwin?.face_description || undefined,
                          speechifyVoiceId,
                          allTwinReferenceImages,
                          customAudio,
                          customDuration
                        );
                      }}
                      disabled={isGenerating || isGeneratingPreview}
                      className="flex-1 bg-gradient-primary hover:opacity-90"
                    >
                      {isGeneratingPreview ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <ImageIcon className="w-4 h-4 mr-2" />
                      )}
                      Generate Preview
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Preview Progress (Advanced only) */}
            {isAdvanced && isGeneratingPreview && (
              <Card className="bg-card border-border">
                <CardContent className="pt-6">
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground flex items-center gap-2">
                        <ImageIcon className="w-4 h-4 text-primary" />
                        {previewProgressStatus || 'Generating preview...'}
                      </span>
                      <span className="text-primary font-medium">{previewProgress}%</span>
                    </div>
                    <Progress value={previewProgress} className="h-2" />
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Scene Preview (Advanced only) */}
            {isAdvanced && previewScenes.length > 0 && !project.videoBlobUrl && (
              <div className="space-y-4">
                <ScenePreview
                  scenes={previewScenes}
                  onRegenerateImage={(sceneNumber, customPrompt, localRefUrl) => {
                    const scene = project.scenes.find(s => s.sceneNumber === sceneNumber);
                    const promptToUse = customPrompt || scene?.visualDescription || '';
                    
                    // Use local reference if provided, else fall back to global reference
                    if (localRefUrl) {
                      regenerateWithReference(sceneNumber, promptToUse, localRefUrl, characterTransformation);
                    } else if (referenceImageUrl) {
                      regenerateWithReference(sceneNumber, promptToUse, referenceImageUrl, characterTransformation);
                    } else {
                      regenerateSceneImage(sceneNumber, promptToUse);
                    }
                  }}
                  onCreateVideo={generateVideo}
                  isCreatingVideo={isGenerating && (project.status === 'generating-video' || project.status === 'rendering-video')}
                  disabled={isGenerating}
                  referenceImageUrl={referenceImageUrl}
                  onSetReference={setSceneAsReference}
                  onClearReference={clearReference}
                  characterTransformation={characterTransformation}
                  onCharacterTransformationChange={setCharacterTransformation}
                />
                
                {/* Save Draft Button */}
                <div className="flex justify-center">
                  <Button 
                    onClick={saveDraftToDatabase}
                    disabled={isSavingDraft}
                    variant="outline"
                    className="border-primary/50 hover:bg-primary/10"
                  >
                    {isSavingDraft ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Save className="w-4 h-4 mr-2" />
                    )}
                    Save Draft for Later
                  </Button>
                </div>
              </div>
            )}

            {/* Final Video / Generated Scenes */}
            {(project.videoBlobUrl || project.generatedScenes.length > 0) && (
              <>
              <Card className="bg-card border-border">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Captions className="w-5 h-5 text-primary" />
                    {project.videoBlobUrl ? 'Your TikTok Reel is Ready!' : 'Your Reel is Ready!'}
                  </CardTitle>
                  <CardDescription>
                    {project.videoBlobUrl 
                      ? 'MP4 video with burned-in captions ready for TikTok/Instagram'
                      : `${project.generatedScenes.length} scene images with captions`}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Video player - use overlay component for multiple clips with audio sync */}
                  {project.videoBlobUrl && (
                    <div className="space-y-4">
                      {project.videoClips.length > 1 ? (
                        /* Multiple clips - use VideoPlayerWithOverlay for text overlay and audio sync */
                        <>
                          <VideoPlayerWithOverlay
                            scenes={project.generatedScenes}
                            voiceovers={project.voiceovers}
                            videoClips={project.videoClips}
                            onClipChange={setSelectedClipIndex}
                          />
                          {/* Frame capture for reference */}
                          <div className="flex justify-center">
                            <FrameCapture
                              videoUrl={project.videoClips[selectedClipIndex]?.videoUrl || ''}
                              onFrameCaptured={setExternalReference}
                            />
                          </div>
                        </>
                      ) : (
                        /* Single stitched video - use regular video player */
                        <>
                          <div className="aspect-[9/16] max-w-sm mx-auto bg-black rounded-lg overflow-hidden shadow-xl">
                            <video
                              src={project.videoBlobUrl}
                              controls
                              className="w-full h-full object-contain"
                              playsInline
                            />
                          </div>
                          {/* Frame capture for stitched video */}
                          <div className="flex justify-center">
                            <FrameCapture
                              videoUrl={project.videoBlobUrl || ''}
                              onFrameCaptured={setExternalReference}
                            />
                          </div>
                        </>
                      )}
                    </div>
                  )}

                  {/* Scene Images/Videos Gallery - show only if no stitched video */}
                  {!project.videoBlobUrl && project.generatedScenes.length > 0 && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      {project.generatedScenes.map((scene, idx) => (
                        <div key={scene.sceneNumber} className="relative group">
                          <div className="aspect-[9/16] bg-black rounded-lg overflow-hidden">
                            {scene.videoUrl ? (
                              <VideoPlayer
                                videoUrl={scene.videoUrl}
                                title={`Scene ${scene.sceneNumber}`}
                                trigger={
                                  <div className="relative cursor-pointer w-full h-full">
                                    {scene.imageUrl ? (
                                      <img
                                        src={scene.imageUrl}
                                        alt={`Scene ${scene.sceneNumber}`}
                                        className="w-full h-full object-cover"
                                      />
                                    ) : (
                                      <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                                        Video
                                      </div>
                                    )}
                                    <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                      <Play className="w-10 h-10 text-white drop-shadow-lg" />
                                    </div>
                                  </div>
                                }
                              />
                            ) : scene.imageUrl ? (
                              <img
                                src={scene.imageUrl}
                                alt={`Scene ${scene.sceneNumber}`}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                                No image
                              </div>
                            )}
                            {/* Caption overlay */}
                            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-3 pointer-events-none">
                              <p className="text-white text-xs line-clamp-3">{scene.text}</p>
                            </div>
                            {/* Scene number badge */}
                            <div className="absolute top-2 left-2 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold pointer-events-none">
                              {scene.sceneNumber}
                            </div>
                            {/* Video indicator */}
                            {scene.videoUrl && (
                              <div className="absolute top-2 right-2 bg-primary text-primary-foreground text-xs px-1.5 py-0.5 rounded pointer-events-none">
                                <Video className="w-3 h-3" />
                              </div>
                            )}
                            {/* Edit overlay - shown on hover */}
                            <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                              <Button
                                size="sm"
                                variant="secondary"
                                className="text-xs"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEditingSceneNumber(scene.sceneNumber);
                                  setEditSceneText(scene.text);
                                }}
                              >
                                <Pencil className="w-3 h-3 mr-1" />
                                Edit
                              </Button>
                              <div className="flex gap-1">
                                {idx > 0 && (
                                  <Button
                                    size="icon"
                                    variant="secondary"
                                    className="h-7 w-7"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      // Swap with previous scene
                                      setProject(prev => {
                                        const scenes = [...prev.generatedScenes];
                                        const clips = [...prev.videoClips];
                                        const vos = [...prev.voiceovers];
                                        // Swap scene numbers
                                        const prevNum = scenes[idx - 1].sceneNumber;
                                        const currNum = scenes[idx].sceneNumber;
                                        scenes[idx - 1] = { ...scenes[idx - 1], sceneNumber: currNum };
                                        scenes[idx] = { ...scenes[idx], sceneNumber: prevNum };
                                        [scenes[idx - 1], scenes[idx]] = [scenes[idx], scenes[idx - 1]];
                                        // Also swap video clips
                                        const ci = clips.findIndex(c => c.sceneNumber === currNum);
                                        const pi = clips.findIndex(c => c.sceneNumber === prevNum);
                                        if (ci >= 0) clips[ci] = { ...clips[ci], sceneNumber: prevNum };
                                        if (pi >= 0) clips[pi] = { ...clips[pi], sceneNumber: currNum };
                                        // Swap voiceovers
                                        const vi = vos.findIndex(v => v.sceneNumber === currNum);
                                        const pvi = vos.findIndex(v => v.sceneNumber === prevNum);
                                        if (vi >= 0) vos[vi] = { ...vos[vi], sceneNumber: prevNum };
                                        if (pvi >= 0) vos[pvi] = { ...vos[pvi], sceneNumber: currNum };
                                        return { ...prev, generatedScenes: scenes, videoClips: clips, voiceovers: vos };
                                      });
                                    }}
                                  >
                                    <ArrowUp className="w-3 h-3" />
                                  </Button>
                                )}
                                {idx < project.generatedScenes.length - 1 && (
                                  <Button
                                    size="icon"
                                    variant="secondary"
                                    className="h-7 w-7"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setProject(prev => {
                                        const scenes = [...prev.generatedScenes];
                                        const clips = [...prev.videoClips];
                                        const vos = [...prev.voiceovers];
                                        const nextNum = scenes[idx + 1].sceneNumber;
                                        const currNum = scenes[idx].sceneNumber;
                                        scenes[idx + 1] = { ...scenes[idx + 1], sceneNumber: currNum };
                                        scenes[idx] = { ...scenes[idx], sceneNumber: nextNum };
                                        [scenes[idx], scenes[idx + 1]] = [scenes[idx + 1], scenes[idx]];
                                        const ci = clips.findIndex(c => c.sceneNumber === currNum);
                                        const ni = clips.findIndex(c => c.sceneNumber === nextNum);
                                        if (ci >= 0) clips[ci] = { ...clips[ci], sceneNumber: nextNum };
                                        if (ni >= 0) clips[ni] = { ...clips[ni], sceneNumber: currNum };
                                        const vi = vos.findIndex(v => v.sceneNumber === currNum);
                                        const nvi = vos.findIndex(v => v.sceneNumber === nextNum);
                                        if (vi >= 0) vos[vi] = { ...vos[vi], sceneNumber: nextNum };
                                        if (nvi >= 0) vos[nvi] = { ...vos[nvi], sceneNumber: currNum };
                                        return { ...prev, generatedScenes: scenes, videoClips: clips, voiceovers: vos };
                                      });
                                    }}
                                  >
                                    <ArrowDown className="w-3 h-3" />
                                  </Button>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Intro/CTA Slide Buttons */}
                  {project.generatedScenes.length > 0 && !project.videoBlobUrl && (
                    <div className="flex justify-center gap-2 mb-3">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setShowIntroSlideForm(true)}
                      >
                        <Sparkles className="w-3 h-3 mr-1" />
                        Add Intro Slide
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setShowCtaSlideForm(true)}
                      >
                        <Sparkles className="w-3 h-3 mr-1" />
                        Add CTA Slide
                      </Button>
                    </div>
                  )}

                  {/* Intro Slide Form Dialog */}
                  <Dialog open={showIntroSlideForm} onOpenChange={setShowIntroSlideForm}>
                    <DialogContent className="sm:max-w-md">
                      <DialogHeader>
                        <DialogTitle>Add Intro Slide</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label>Headline</Label>
                          <Input
                            value={introSlideHeadline}
                            onChange={(e) => setIntroSlideHeadline(e.target.value)}
                            placeholder="e.g. 5 Tips to Grow Your Business"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Subtitle (optional)</Label>
                          <Input
                            value={introSlideSubtitle}
                            onChange={(e) => setIntroSlideSubtitle(e.target.value)}
                            placeholder="e.g. Watch until the end!"
                          />
                        </div>
                        <Button
                          className="w-full"
                          onClick={() => insertSlide('intro', introSlideHeadline, introSlideSubtitle)}
                          disabled={!introSlideHeadline.trim()}
                        >
                          <Sparkles className="w-4 h-4 mr-2" />
                          Generate & Insert Intro
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>

                  {/* CTA Slide Form Dialog */}
                  <Dialog open={showCtaSlideForm} onOpenChange={setShowCtaSlideForm}>
                    <DialogContent className="sm:max-w-md">
                      <DialogHeader>
                        <DialogTitle>Add Call-to-Action Slide</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label>Headline</Label>
                          <Input
                            value={ctaSlideHeadline}
                            onChange={(e) => setCtaSlideHeadline(e.target.value)}
                            placeholder="e.g. Follow for more tips!"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Subtitle (optional)</Label>
                          <Input
                            value={ctaSlideSubtitle}
                            onChange={(e) => setCtaSlideSubtitle(e.target.value)}
                            placeholder="e.g. Link in bio 👇"
                          />
                        </div>
                        <Button
                          className="w-full"
                          onClick={() => insertSlide('cta', ctaSlideHeadline, ctaSlideSubtitle)}
                          disabled={!ctaSlideHeadline.trim()}
                        >
                          <Sparkles className="w-4 h-4 mr-2" />
                          Generate & Insert CTA
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>

                  <div className="flex flex-wrap justify-center gap-3">
                    {/* Stitch button - show when we have multiple clips */}
                    {project.videoClips.length > 1 && (
                      <div className="w-full space-y-3">
                        <div className="flex justify-center">
                          <Button 
                            onClick={stitchVideos}
                            disabled={isManualStitching}
                            className="bg-gradient-to-r from-purple-600 to-pink-600 hover:opacity-90"
                          >
                            {isManualStitching ? (
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            ) : (
                              <Layers className="w-4 h-4 mr-2" />
                            )}
                            Stitch All Clips Together
                          </Button>
                        </div>
                        {isManualStitching && (
                          <div className="space-y-2 px-4">
                            <Progress value={progress} className="h-2" />
                            <div className="flex justify-between text-xs text-muted-foreground">
                              <span>{progressStatus}</span>
                              <span>{Math.round(progress)}%</span>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                    {project.videoBlobUrl && project.videoClips.length === 0 && (
                      <Button 
                        onClick={handleDownloadVideo}
                        className="bg-gradient-primary hover:opacity-90"
                      >
                        <Download className="w-4 h-4 mr-2" />
                        Download for TikTok
                      </Button>
                    )}
                    {/* Save to My Reels button */}
                    {!currentReelSaved && (project.generatedScenes.length > 0 || project.previewScenes.length > 0 || project.videoBlobUrl) && (
                      <Button 
                        onClick={saveToMyReels}
                        disabled={isSavingReel}
                        variant="secondary"
                      >
                        {isSavingReel ? (
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                          <FolderOpen className="w-4 h-4 mr-2" />
                        )}
                        Save to My Reels
                      </Button>
                    )}
                    {currentReelSaved && (
                      <Button variant="secondary" disabled className="opacity-70">
                        <History className="w-4 h-4 mr-2" />
                        Saved
                      </Button>
                    )}
                    <Button onClick={resetProject} variant="outline">
                      <RefreshCw className="w-4 h-4 mr-2" />
                      Create Another
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Edit Scene Sheet */}
              <Sheet open={editingSceneNumber !== null} onOpenChange={(open) => { if (!open) setEditingSceneNumber(null); }}>
                <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
                  <SheetHeader>
                    <SheetTitle>Edit Scene {editingSceneNumber}</SheetTitle>
                  </SheetHeader>
                  {editingSceneNumber !== null && (() => {
                    const scene = project.generatedScenes.find(s => s.sceneNumber === editingSceneNumber);
                    if (!scene) return null;
                    return (
                      <div className="space-y-4 mt-4">
                        {/* Scene preview */}
                        {scene.imageUrl && (
                          <div className="aspect-[9/16] rounded-lg overflow-hidden bg-black">
                            <img src={scene.imageUrl} alt={`Scene ${scene.sceneNumber}`} className="w-full h-full object-cover" />
                          </div>
                        )}
                        
                        {/* Edit script */}
                        <div className="space-y-2">
                          <Label>Scene Script</Label>
                          <Textarea
                            value={editSceneText}
                            onChange={(e) => setEditSceneText(e.target.value)}
                            rows={4}
                            className="text-sm"
                          />
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => {
                              setProject(prev => ({
                                ...prev,
                                generatedScenes: prev.generatedScenes.map(s => 
                                  s.sceneNumber === editingSceneNumber ? { ...s, text: editSceneText } : s
                                ),
                                scenes: prev.scenes.map(s =>
                                  s.sceneNumber === editingSceneNumber ? { ...s, narration: editSceneText } : s
                                )
                              }));
                              toast({ title: "Script Updated", description: `Scene ${editingSceneNumber} script saved.` });
                            }}
                          >
                            <Save className="w-3 h-3 mr-1" />
                            Save Script
                          </Button>
                        </div>

                        {/* Regenerate image */}
                        <div className="space-y-2">
                          <Label>Regenerate Image</Label>
                          <Button
                            size="sm"
                            variant="outline"
                            className="w-full"
                            onClick={async () => {
                              const sceneData = project.scenes.find(s => s.sceneNumber === editingSceneNumber);
                              if (!sceneData) return;
                              toast({ title: "Regenerating Image...", description: `Scene ${editingSceneNumber}` });
                              try {
                                const { data, error } = await supabase.functions.invoke('generate-scene-image', {
                                  body: {
                                    prompt: sceneData.visualDescription || editSceneText,
                                    sceneNumber: editingSceneNumber,
                                    aspectRatio: '9:16'
                                  }
                                });
                                if (error) throw error;
                                if (data?.imageUrl) {
                                  setProject(prev => ({
                                    ...prev,
                                    generatedScenes: prev.generatedScenes.map(s =>
                                      s.sceneNumber === editingSceneNumber ? { ...s, imageUrl: data.imageUrl, videoUrl: undefined } : s
                                    ),
                                    videoClips: prev.videoClips.filter(c => c.sceneNumber !== editingSceneNumber)
                                  }));
                                  toast({ title: "Image Regenerated!", description: `Scene ${editingSceneNumber} image updated.` });
                                }
                              } catch (err: any) {
                                toast({ title: "Failed", description: err.message, variant: "destructive" });
                              }
                            }}
                          >
                            <ImageIcon className="w-3 h-3 mr-1" />
                            Regenerate Image
                          </Button>
                        </div>

                        {/* Regenerate video */}
                        {scene.imageUrl && (
                          <div className="space-y-2">
                            <Label>Regenerate Video</Label>
                            <Button
                              size="sm"
                              variant="outline"
                              className="w-full"
                              onClick={async () => {
                                const voiceover = project.voiceovers.find(v => v.sceneNumber === editingSceneNumber);
                                toast({ title: "Regenerating Video...", description: `Scene ${editingSceneNumber}` });
                                try {
                                  const { data, error } = await supabase.functions.invoke('wavespeed-video', {
                                    body: {
                                      imageUrl: scene.imageUrl,
                                      duration: voiceover?.duration || 5,
                                      model: 'seedance'
                                    }
                                  });
                                  if (error) throw error;
                                  if (data?.videoUrl) {
                                    setProject(prev => ({
                                      ...prev,
                                      generatedScenes: prev.generatedScenes.map(s =>
                                        s.sceneNumber === editingSceneNumber ? { ...s, videoUrl: data.videoUrl } : s
                                      ),
                                      videoClips: [
                                        ...prev.videoClips.filter(c => c.sceneNumber !== editingSceneNumber),
                                        { sceneNumber: editingSceneNumber!, videoUrl: data.videoUrl }
                                      ]
                                    }));
                                    toast({ title: "Video Regenerated!", description: `Scene ${editingSceneNumber} video updated.` });
                                  }
                                } catch (err: any) {
                                  toast({ title: "Failed", description: err.message, variant: "destructive" });
                                }
                              }}
                            >
                              <Video className="w-3 h-3 mr-1" />
                              Regenerate Video
                            </Button>
                          </div>
                        )}

                        <Button className="w-full" onClick={() => setEditingSceneNumber(null)}>
                          Done
                        </Button>
                      </div>
                    );
                  })()}
                </SheetContent>
              </Sheet>
              </>
            )}
          </TabsContent>

          <TabsContent value="queue" className="space-y-6">
            <VideoQueue 
              onSelectVideo={(video: QueuedVideo) => {
                // Convert queued video to strategy format and apply it
                const strategy: ContentStrategy = {
                  title: video.title,
                  hookText: video.hookText,
                  hookStyle: video.hookStyle,
                  targetDuration: video.targetDuration,
                  sceneCount: video.sceneCount,
                  sceneDurations: video.sceneDurations,
                  contentType: video.contentType,
                  callToAction: video.callToAction,
                  outroTemplate: video.outroTemplate,
                  seriesNumber: video.seriesNumber,
                  seriesPillar: video.seriesPillar
                };
                
                // Apply the strategy
                setTopic(strategy.title);
                setSelectedSceneCount(String(strategy.sceneCount));
                const totalDuration = strategy.sceneDurations.reduce((a, b) => a + b, 0);
                const avgDuration = Math.round(totalDuration / strategy.sceneCount);
                setSelectedSceneDuration(String(avgDuration));
                if (strategy.hookStyle) {
                  setHookStyle(strategy.hookStyle);
                }
                if (strategy.outroTemplate && strategy.outroTemplate !== 'none') {
                  setSelectedOutro(strategy.outroTemplate);
                }
                
                // Switch to create tab
                setActiveTab('create');
                
                toast({
                  title: 'Video Loaded!',
                  description: `"${strategy.title}" is ready to generate.`
                });
              }}
            />
          </TabsContent>

          <TabsContent value="drafts" className="space-y-6">
            {loadingReels ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                {[...Array(3)].map((_, i) => (
                  <Card key={i} className="bg-card border-border overflow-hidden animate-pulse">
                    <div className="aspect-[9/16] bg-muted" />
                    <CardContent className="p-4 space-y-3">
                      <div className="h-4 bg-muted rounded w-3/4" />
                      <div className="h-3 bg-muted rounded w-1/2" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : draftReels.length === 0 ? (
              <Card className="bg-card border-border">
                <CardContent className="pt-6 text-center">
                  <FileEdit className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-medium">No Saved Drafts</h3>
                  <p className="text-muted-foreground mb-4">
                    When you're working on a reel and want to continue later, click "Save Draft for Later" to save your progress here.
                  </p>
                  <Button onClick={() => setActiveTab('create')}>
                    <Video className="w-4 h-4 mr-2" />
                    Create a Reel
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                {draftReels.map((draft) => {
                  const sceneCount = draft.scenes?.length || 0;
                  const hasTwin = draft.draft_state?.selectedTwinId;
                  const hasStrategist = draft.draft_state?.strategist?.strategy;
                  
                  return (
                    <Card key={draft.id} className="bg-card border-border overflow-hidden">
                      <div className="aspect-[9/16] bg-black relative">
                        {draft.thumbnail_url ? (
                          <img
                            src={draft.thumbnail_url}
                            alt={draft.topic}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-muted-foreground bg-gradient-to-br from-muted/50 to-muted">
                            <FileEdit className="w-12 h-12" />
                          </div>
                        )}
                        <div className="absolute top-2 left-2 bg-amber-500/90 text-white text-xs px-2 py-1 rounded font-medium">
                          Draft
                        </div>
                        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 to-transparent p-4">
                          <p className="text-white text-sm font-medium line-clamp-2">{draft.topic}</p>
                          <p className="text-white/70 text-xs mt-1">
                            {new Date(draft.created_at).toLocaleDateString()} • {sceneCount} scenes
                          </p>
                        </div>
                        {/* Feature badges */}
                        <div className="absolute top-2 right-2 flex flex-col gap-1">
                          {hasTwin && (
                            <span className="bg-primary/90 text-primary-foreground text-[10px] px-1.5 py-0.5 rounded">
                              AI Twin
                            </span>
                          )}
                          {hasStrategist && (
                            <span className="bg-purple-500/90 text-white text-[10px] px-1.5 py-0.5 rounded">
                              Strategy
                            </span>
                          )}
                        </div>
                      </div>
                      
                      {/* Scene thumbnails grid */}
                      {sceneCount > 1 && (
                        <div className="p-3 border-t border-border">
                          <p className="text-xs text-muted-foreground mb-2">Scenes:</p>
                          <div className="grid grid-cols-5 gap-1">
                            {draft.scenes?.slice(0, 5).map((scene, idx) => (
                              <div
                                key={idx}
                                className="aspect-square rounded overflow-hidden bg-muted"
                              >
                                {scene.imageUrl ? (
                                  <img src={scene.imageUrl} alt={`Scene ${idx + 1}`} className="w-full h-full object-cover" />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground">{idx + 1}</div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      <CardContent className="pt-4">
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={() => restoreDraftFromDatabase(draft)}
                            className="flex-1 bg-gradient-primary hover:opacity-90"
                          >
                            <Wand2 className="w-4 h-4 mr-2" />
                            Continue Editing
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => deleteDraft(draft.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>

          <TabsContent value="history" className="space-y-6">
            {loadingReels ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                {[...Array(6)].map((_, i) => (
                  <Card key={i} className="bg-card border-border overflow-hidden animate-pulse">
                    <div className="aspect-[9/16] bg-muted" />
                    <CardContent className="p-4 space-y-3">
                      <div className="h-4 bg-muted rounded w-3/4" />
                      <div className="h-3 bg-muted rounded w-1/2" />
                      <div className="flex gap-2 pt-2">
                        <div className="h-8 bg-muted rounded flex-1" />
                        <div className="h-8 bg-muted rounded flex-1" />
                        <div className="h-8 bg-muted rounded w-8" />
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : savedReels.length === 0 ? (
              <Card className="bg-card border-border">
                <CardContent className="pt-6 text-center">
                  <History className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-medium">No Saved Reels</h3>
                  <p className="text-muted-foreground mb-4">
                    Create and save your first reel to see it here.
                  </p>
                  <Button onClick={() => setActiveTab('create')}>
                    <Video className="w-4 h-4 mr-2" />
                    Create a Reel
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                {savedReels.map((reel) => {
                  // Get scenes - show grid if there are multiple scenes
                  const sceneCount = reel.scenes?.length || 0;
                  const videoClips = reel.scenes?.filter(s => s.videoUrl) || [];
                  const hasScenes = sceneCount > 1;
                  
                  return (
                    <Card key={reel.id} className="bg-card border-border overflow-hidden">
                      <div className="aspect-[9/16] bg-black relative">
                        {reel.video_url ? (
                          <video
                            src={reel.video_url}
                            className="w-full h-full object-contain"
                            controls
                            playsInline
                          />
                        ) : reel.thumbnail_url ? (
                          <img
                            src={reel.thumbnail_url}
                            alt={reel.topic}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                            <Video className="w-12 h-12" />
                          </div>
                        )}
                        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 to-transparent p-4">
                          <p className="text-white text-sm font-medium line-clamp-2">{reel.topic}</p>
                          <p className="text-white/70 text-xs mt-1">
                            {new Date(reel.created_at).toLocaleDateString()} • {reel.total_duration}s • {sceneCount} scenes
                          </p>
                        </div>
                        {videoClips.length > 0 && (
                          <div className="absolute top-2 right-2 bg-black/70 text-white text-xs px-2 py-1 rounded">
                            {videoClips.length}/{sceneCount} clips
                          </div>
                        )}
                      </div>
                      
                      {/* Scene clips grid - show if there are multiple scenes */}
                      {hasScenes && (
                        <div className="p-3 border-t border-border">
                          <p className="text-xs text-muted-foreground mb-2">Individual Clips:</p>
                          <div className="grid grid-cols-5 gap-1">
                            {reel.scenes?.map((scene, idx) => (
                              <VideoPlayer
                                key={idx}
                                videoUrl={scene.videoUrl || ''}
                                title={`Scene ${idx + 1}`}
                                trigger={
                                  <button
                                    className="aspect-square rounded overflow-hidden bg-muted relative group cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
                                    disabled={!scene.videoUrl}
                                  >
                                    {scene.imageUrl ? (
                                      <img src={scene.imageUrl} alt={`Scene ${idx + 1}`} className="w-full h-full object-cover" />
                                    ) : (
                                      <div className="w-full h-full flex items-center justify-center text-xs">{idx + 1}</div>
                                    )}
                                    {scene.videoUrl && (
                                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                        <Play className="w-3 h-3 text-white" />
                                      </div>
                                    )}
                                  </button>
                                }
                              />
                            ))}
                          </div>
                        </div>
                      )}
                      
                      <CardContent className="pt-4">
                        <div className="flex gap-2 flex-wrap">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => duplicateReel(reel)}
                            title="Duplicate and use same script"
                          >
                            <Copy className="w-4 h-4 mr-2" />
                            Duplicate
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setEditingReel(reel)}
                          >
                            <Wand2 className="w-4 h-4 mr-2" />
                            Edit
                          </Button>
                          {reel.video_url && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                const link = document.createElement('a');
                                link.href = reel.video_url!;
                                link.download = `reel-${reel.topic.slice(0, 20)}.mp4`;
                                link.click();
                              }}
                            >
                              <Download className="w-4 h-4 mr-2" />
                              Download
                            </Button>
                          )}
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => deleteReel(reel.id, reel.video_url)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>
          </div>
        </div>
      </div>
      {/* Script Generator Dialog */}
      <Dialog open={showScriptGenerator} onOpenChange={(open) => {
        setShowScriptGenerator(open);
        if (!open && activeMode === 'script-only') {
          setActiveMode('standard');
        }
      }}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto mx-4">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-primary" />
              Script Generator
            </DialogTitle>
          </DialogHeader>
          <ScriptGenerator />
        </DialogContent>
      </Dialog>

      {/* Reel Editor */}
      {editingReel && (
        <ReelEditor
          reel={editingReel}
          open={!!editingReel}
          onOpenChange={(open) => !open && setEditingReel(null)}
          onReelUpdated={(updatedReel) => {
            setSavedReels(prev => prev.map(r => r.id === updatedReel.id ? updatedReel : r));
            setEditingReel(null);
          }}
        />
      )}
    </Layout>
  );
};

export default Reels;
