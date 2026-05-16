import React, { useState, useRef, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { useSearchParams } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import { VideoPlayer } from '@/components/VideoPlayer';
import { useIsMobile } from '@/hooks/use-mobile';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ConversationBuilder } from '@/components/ConversationBuilder';
import { MessageSquare } from 'lucide-react';
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
  ArrowDown,
  Film,
  Plus,
  Package
} from 'lucide-react';
import { ScenePreview } from '@/components/ScenePreview';
import { TimelineEditor } from '@/components/TimelineEditor';
import { useScenePreview } from '@/hooks/useScenePreview';
import { FrameCapture } from '@/components/FrameCapture';
import { VoiceSelector } from '@/components/VoiceSelector';
import { VoicePitchSlider } from '@/components/VoicePitchSlider';
import { ProductSwapPanel } from '@/components/ProductSwapPanel';
import { ReelSceneTimeline } from '@/components/ReelSceneTimeline';
import { GalleryImagePicker } from '@/components/GalleryImagePicker';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { ScriptGenerator } from '@/components/ScriptGenerator';
import { ReelEditor } from '@/components/ReelEditor';
import { CaptionStyleSelector } from '@/components/CaptionStyleSelector';
import { CaptionSettings, defaultCaptionSettings } from '@/components/KaraokeCaption';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { TopicStrategist, ContentStrategy } from '@/components/TopicStrategist';
import { VideoQueue } from '@/components/VideoQueue';
import { useBackgroundVideo } from '@/contexts/BackgroundVideoContext';
import { CaptionPreviewDialog } from '@/components/CaptionPreviewDialog';
import { ContinueVideoPanel } from '@/components/ContinueVideoPanel';

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
  video_url_no_captions?: string | null;
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
  voicePitch?: number;
  generatedScenes?: GeneratedScene[];
  backgroundMusicUrl?: string | null;
  backgroundMusicMood?: string;
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
  const { registerJob, activeJobs } = useBackgroundVideo();
  const isMobile = useIsMobile();
  const { mode: creatorMode, setMode: setCreatorMode, isAdvanced, isBeginner, isQuick } = useCreatorMode();
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
  const abortRef = useRef<AbortController | null>(null);
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
  const [timelineViewActive, setTimelineViewActive] = useState(false);
  const [sidebarsHiddenForTimeline, setSidebarsHiddenForTimeline] = useState(false);
  
  
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
    regenerateSceneVoice,
    regenerateWithReference,
    setSceneAsReference,
    setExternalReference,
    clearReference,
    resetPreview,
    restorePreviewScenes,
    insertScene: insertPreviewScene,
    deleteScene: deletePreviewScene,
  } = useScenePreview();
  
  // Lip sync mode
  const [enableLipSync, setEnableLipSync] = useState(isBeginner || isQuick);
  const [lipSyncModel, setLipSyncModel] = useState<'infinitetalk'>('infinitetalk');
  const videoModel = 'sora-2' as const;
  const [wan26Duration, setWan26Duration] = useState<5 | 10 | 15>(5);
  const [portraitImage, setPortraitImage] = useState<string | null>(null);
  const [portraitPreview, setPortraitPreview] = useState<string | null>(null);
  // Voice selection — defaults empty, resolved from AI Twin cloned voice
  const [selectedVoice, setSelectedVoice] = useState<string>('');
  const [voicePitch, setVoicePitch] = useState<number>(0);
  
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
  const [aiTwins, setAiTwins] = useState<{ id: string; name: string; reference_images: string[]; voice_cloning_key: string | null; voice_sample_url: string | null; face_description: string | null; gender?: string | null; voice_engine?: string; google_voice_id?: string | null }[]>([]);
  const [selectedTwinId, setSelectedTwinId] = useState<string | null>(null);
  const [hookStyle, setHookStyle] = useState<string>('auto');
  const [enableCutScenes, setEnableCutScenes] = useState(false);
  const [characterDescription, setCharacterDescription] = useState('');
  const [characterProfile, setCharacterProfile] = useState<{
    gender?: string | null;
    ageRange?: string | null;
    appearance?: string | null;
    clothing?: string | null;
    environment?: string | null;
    product?: { detected?: boolean; type?: string; shape?: string; color?: string; label?: string; howHeld?: string } | null;
  } | null>(null);
  // Hook selection state
  const [generatedHooks, setGeneratedHooks] = useState<any[]>([]);
  const [selectedHook, setSelectedHook] = useState<any>(null);
  const [isGeneratingHooks, setIsGeneratingHooks] = useState(false);
  const [showHookSelector, setShowHookSelector] = useState(false);
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
  const [generatedCharacterShots, setGeneratedCharacterShots] = useState<{ label: string; url: string }[]>([]);
  const [selectedShotIndex, setSelectedShotIndex] = useState(0);
  const [beginnerStep, setBeginnerStep] = useState<1 | 2 | 3>(1); // 1=topic, 2=script review, 3=character+voice+generate
  const [detectedCharGender, setDetectedCharGender] = useState<'male' | 'female'>('male');
  const [isEnhancingPrompt, setIsEnhancingPrompt] = useState(false);
  // Voice preview state
  const [isPreviewingVoice, setIsPreviewingVoice] = useState(false);
  const [voicePreviewAudio, setVoicePreviewAudio] = useState<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (videoModel !== 'sora-2' || !voicePreviewAudio) return;

    voicePreviewAudio.pause();
    voicePreviewAudio.currentTime = 0;
    setVoicePreviewAudio(null);
    setIsPreviewingVoice(false);
  }, [videoModel, voicePreviewAudio]);
  // Intro/CTA slide state
  const [showIntroSlideForm, setShowIntroSlideForm] = useState(false);
  const [showCtaSlideForm, setShowCtaSlideForm] = useState(false);
  const [introSlideHeadline, setIntroSlideHeadline] = useState('');
  const [introSlideSubtitle, setIntroSlideSubtitle] = useState('');
  const [ctaSlideHeadline, setCtaSlideHeadline] = useState('');
  const [ctaSlideSubtitle, setCtaSlideSubtitle] = useState('');
  
  // Thumbnail generation state
  const [isGeneratingThumbnail, setIsGeneratingThumbnail] = useState(false);
  const [generatedThumbnails, setGeneratedThumbnails] = useState<string[]>([]);
  const [selectedThumbnailIdx, setSelectedThumbnailIdx] = useState(0);
  const [showThumbnailDialog, setShowThumbnailDialog] = useState(false);
  const [thumbnailStyle, setThumbnailStyle] = useState('dramatic');
  const [selectedThumbnailUrl, setSelectedThumbnailUrl] = useState<string | null>(null);
  
  // Outro style state
  const [outroStyle, setOutroStyle] = useState('logo-fade');
  const [isGeneratingOutro, setIsGeneratingOutro] = useState(false);
  const [outroVariations, setOutroVariations] = useState<string[]>([]);
  const [selectedOutroIdx, setSelectedOutroIdx] = useState(0);
  
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
  
  // Caption preview & continue video state
  const [captionPreviewReel, setCaptionPreviewReel] = useState<SavedReel | null>(null);
  const [captionedVideoUrl, setCaptionedVideoUrl] = useState<string | null>(null);
  const [isBurningCaptions, setIsBurningCaptions] = useState(false);
  const [addingCaptionsId, setAddingCaptionsId] = useState<string | null>(null);
  const [continueVideoReel, setContinueVideoReel] = useState<SavedReel | null>(null);
  
  // Post-production: append B-roll
  const [showAppendBroll, setShowAppendBroll] = useState(false);
  const [appendBrollPrompt, setAppendBrollPrompt] = useState('');
  const [appendBrollDuration, setAppendBrollDuration] = useState<5 | 10 | 15>(5);
  const [appendBrollModel, setAppendBrollModel] = useState<'wan-2.6-i2v' | 'wan-2.1-i2v-480p' | 'kling-v3.0-pro'>('wan-2.6-i2v');
  const [isAppendingBroll, setIsAppendingBroll] = useState(false);
  const [appendedClips, setAppendedClips] = useState<{ videoUrl: string; prompt: string; duration: number }[]>([]);
  const [isRestitching, setIsRestitching] = useState(false);
  
  // Product images for timeline insert
  const [timelineProductImages, setTimelineProductImages] = useState<{ id: string; image_url: string; name: string | null }[]>([]);
  
  // Selected product image for video generation
  const [selectedProductImageUrl, setSelectedProductImageUrl] = useState<string | null>(null);
  const [selectedProductName, setSelectedProductName] = useState<string | null>(null);

  // Lifted product swap state (persists across isMobile re-renders)
  const [swapPanelProductUrl, setSwapPanelProductUrl] = useState<string | null>(null);
  const [swapPanelPrompt, setSwapPanelPrompt] = useState('');
  const handleSwapProductChange = (url: string | null, prompt: string) => {
    setSwapPanelProductUrl(url);
    setSwapPanelPrompt(prompt);
  };
  
  // Strategist state for persistence
  const [strategistState, setStrategistState] = useState<StrategistState>({
    niche: '',
    videoDuration: 'mix',
    includePromotional: false,
    strategy: null
  });
  
  // Background music state
  const [backgroundMusicUrl, setBackgroundMusicUrl] = useState<string | null>(null);
  const [backgroundMusicMood, setBackgroundMusicMood] = useState('');
  const [isGeneratingMusic, setIsGeneratingMusic] = useState(false);
  
  // Caption settings
  const [captionSettings, setCaptionSettings] = useState<CaptionSettings>(defaultCaptionSettings);
  
  // Sync feature toggles with existing state
  const handleFeatureChange = (feature: keyof typeof featureToggles, value: boolean) => {
    setFeatureToggles(prev => ({ ...prev, [feature]: value }));
    
    // Sync with existing state and expand sections when enabled
    if (feature === 'introOutro') {
      setTemplateSectionOpen(value);
      // Auto-select default intro/outro when enabling the toggle
      if (value) {
        if (selectedIntro === 'none') setSelectedIntro('hook-text');
        if (selectedOutro === 'none') setSelectedOutro('cta-follow');
      }
    } else if (feature === 'cutScenes') {
      setEnableCutScenes(value);
      if (value) setCutScenesExpanded(true);
    } else if (feature === 'lipSync') {
      setEnableLipSync(value);
      if (value) setLipSyncExpanded(true);
    } else if (feature === 'upscaler') {
      setShowUpscaler(value);
    } else if (feature === 'captions') {
      setCaptionSettings(prev => ({ ...prev, enabled: value }));
    } else if (feature === 'backgroundMusic') {
      if (!value) {
        setBackgroundMusicUrl(null);
        setBackgroundMusicMood('');
      }
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
  
  // Track active generation for background handoff on unmount
  const activeGenerationRef = useRef<{
    videoTasks: { taskId: string; sceneNumber: number; hasEmbeddedAudio?: boolean }[];
    generatedScenes: GeneratedScene[];
    voiceovers: { sceneNumber: number; audioUrl: string; storageUrl?: string; duration: number }[];
    hasEmbeddedAudio: boolean;
    topic: string;
  } | null>(null);
  
  // On unmount during active generation, hand off to background context
  useEffect(() => {
    return () => {
      const gen = activeGenerationRef.current;
      if (gen && gen.videoTasks.length > 0 && user) {
        console.log('Handing off active generation to background context');
        registerJob({
          topic: gen.topic,
          userId: user.id,
          videoTasks: gen.videoTasks,
          generatedScenes: gen.generatedScenes,
          voiceovers: gen.voiceovers,
          hasEmbeddedAudio: gen.hasEmbeddedAudio,
        });
      }
    };
  }, [user, registerJob]);

  // Auto-save hook
  const { 
    saveDraft,
    saveDraftDebounced, 
    loadDraft, 
    clearDraft, 
    hasDraft, 
    getDraftAge,
    notifyDraftRestored 
  } = useReelDraftAutoSave();

  // Video queue hook
  const { queueCount } = useVideoQueue();

  const [draftAge, setDraftAge] = useState('');

  // Auto-restore draft on mount
  useEffect(() => {
    if (draftRestoredRef.current) return;
    
    // Don't check for draft if we're coming from Movie Scene Creator
    const source = searchParams.get('source');
    if (source === 'movie-scene') return;
    
    if (hasDraft()) {
      // Auto-restore the draft immediately instead of showing a banner
      const draft = loadDraft();
      if (draft) {
        draftRestoredRef.current = true;

        setTopic(draft.topic || '');
        setSelectedSceneCount(draft.selectedSceneCount || '4');
        setSelectedSceneDuration(draft.selectedSceneDuration || '12');
        setSelectedVoice(draft.selectedVoice || '');
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
        setEnableLipSync(isBeginner || isQuick ? true : (draft.enableLipSync || false));
        setPortraitImage(draft.portraitImage);
        setFeatureToggles(draft.featureToggles || {
          introOutro: false,
          cutScenes: false,
          upscaler: false,
          lipSync: false,
          captions: true,
          backgroundMusic: false
        });

        if (draft.project) {
          setProject({
            topic: draft.project.topic || '',
            scenes: draft.project.scenes || [],
            voiceovers: draft.project.voiceovers || [],
            videoUrl: null,
            videoBlobUrl: null,
            generatedScenes: [],
            videoClips: [],
            previewScenes: draft.project.previewScenes || [],
            status: 'idle'
          });
          // Restore preview scenes into hook
          if ((draft.project.previewScenes || []).length > 0) {
            restorePreviewScenes(draft.project.previewScenes, draft.project.voiceovers || []);
          }
        }

        if (draft.strategist) {
          setStrategistState(draft.strategist);
        }

        // Restore beginner step based on progress
        if (isBeginner) {
          const hasScenes = (draft.project?.scenes?.length || 0) > 0;
          const hasCharacter = !!draft.portraitImage || !!draft.selectedTwinId;
          if (hasCharacter) {
            setBeginnerStep(3);
          } else if (hasScenes) {
            setBeginnerStep(2);
          } else {
            setBeginnerStep(1);
          }
        }

        notifyDraftRestored();
      }
    }
  }, []);

  // Restore draft function
  const restoreDraft = useCallback(() => {
    const draft = loadDraft();
    if (!draft) return;

    draftRestoredRef.current = true;

    // Restore all persisted state
    setTopic(draft.topic || '');
    setSelectedSceneCount(draft.selectedSceneCount || '4');
    setSelectedSceneDuration(draft.selectedSceneDuration || '12');
    setSelectedVoice(draft.selectedVoice || '');
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
    setEnableLipSync(isBeginner || isQuick ? true : (draft.enableLipSync || false));
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
        videoUrl: null,
        videoBlobUrl: null,
        generatedScenes: draft.project.generatedScenes || [],
        videoClips: [],
        previewScenes: draft.project.previewScenes || [],
        status: 'idle'
      });
      // Restore preview scenes into hook
      if ((draft.project?.previewScenes || []).length > 0) {
        restorePreviewScenes(draft.project.previewScenes, draft.project.voiceovers || []);
      }
    }
    
    // Reset completion state
    setProgress(0);
    setProgressStatus('');
    setIsGenerating(false);
    setVideoError(null);

    // Restore strategist state
    if (draft.strategist) {
      setStrategistState(draft.strategist);
    }

    // Restore beginner step based on progress
    if (isBeginner) {
      const hasScenes = (draft.project?.scenes?.length || 0) > 0;
      const hasCharacter = !!draft.portraitImage || !!draft.selectedTwinId;
      if (hasCharacter) {
        setBeginnerStep(3);
      } else if (hasScenes) {
        setBeginnerStep(2);
      } else {
        setBeginnerStep(1);
      }
    }

    notifyDraftRestored();
  }, [loadDraft, notifyDraftRestored, isBeginner]);

  // Dismiss draft and clear it
  const dismissDraft = useCallback(() => {
    clearDraft();
  }, [clearDraft]);

  // Auto-save effect - triggers on key state changes
  useEffect(() => {
    // Always save when video clips arrive (even during generation)
    const hasVideoClips = project.videoClips.length > 0;
    const hasContent = topic.trim() || project.scenes.length > 0 || project.previewScenes.length > 0 || previewScenes.length > 0 || strategistState.strategy || strategistState.niche.trim() || hasVideoClips;
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
        voiceovers: previewVoiceovers.length > 0 ? previewVoiceovers : project.voiceovers,
        generatedScenes: project.generatedScenes,
        videoClips: project.videoClips,
        previewScenes: previewScenes.length > 0 ? previewScenes : project.previewScenes,
        status: project.status
      },
      featureToggles,
      strategist: strategistState
    });
  }, [
    topic, project.topic, project.scenes, project.voiceovers, 
    project.generatedScenes, project.videoClips, project.previewScenes,
    previewScenes, previewVoiceovers,
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
        
        // Store full character profile for script generation
        setCharacterProfile({
          gender: data.gender,
          ageRange: data.ageRange,
          appearance: data.appearance,
          clothing: data.clothing,
          environment: data.environment,
          product: data.product,
        });
        
        // Auto-match voice to detected character gender
        if (data.gender && !selectedTwinId) {
          const isFemale = data.gender === 'female';
          const context = `${data.description} ${data.ageRange || ''}`.toLowerCase();
          let matchedVoice: string;
          if (isFemale) {
            matchedVoice = /(older|mentor|expert|authority|founder|ceo|coach)/.test(context) ? 'Wise_Woman'
              : /(energetic|viral|fun|young|playful|bold|hype)/.test(context) ? 'Inspirational_girl'
              : /(calm|luxury|gentle|warm|trusted)/.test(context) ? 'Calm_Woman'
              : 'English_radiant_girl';
          } else {
            matchedVoice = /(calm|trusted|coach|mentor|teacher|explainer|warm)/.test(context) ? 'Patient_Man'
              : /(direct|bold|sales|urgent|controversy|strong)/.test(context) ? 'Determined_Man'
              : /(story|cinematic|documentary|narrator)/.test(context) ? 'English_expressive_narrator'
              : 'English_magnetic_voiced_man';
          }
          setSelectedVoice(matchedVoice);
          console.log(`[Voice] Auto-matched voice to ${data.gender}: ${matchedVoice}`);
        }

        const genderLabel = data.gender ? ` (${data.gender} detected)` : '';
        const productLabel = data.product?.detected ? ` — product: ${data.product.type}` : '';
        
        toast({
          title: "Character Analyzed",
          description: `${data.description}${genderLabel}${productLabel}`,
        });
      }
    } catch (error: any) {
      console.error('Failed to analyze reference image:', error);
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

  const enhancePrompt = async () => {
    if (!topic.trim() || isEnhancingPrompt) return;
    setIsEnhancingPrompt(true);
    try {
      const { data, error } = await supabase.functions.invoke('ai', {
        body: {
          messages: [
            { role: 'system', content: `You are an elite viral content strategist who has produced 500+ videos with 10M+ views each. The user will give you a rough topic or idea for a short-form video reel (TikTok/Instagram Reels/YouTube Shorts).

Your job is to DRAMATICALLY enhance and expand their idea into a highly specific, emotionally compelling, scroll-stopping topic description that a scriptwriter can use to create an incredible video.

ENHANCEMENT RULES:
1. Add a SPECIFIC angle or unique perspective (not generic advice)
2. Include an emotional hook element (curiosity gap, controversy, surprise, FOMO)
3. Specify the TARGET AUDIENCE clearly
4. Add a concrete outcome or transformation promise
5. Make it 2-4 sentences that paint a vivid picture of the video's narrative arc
6. Include power words: "secret", "actually", "nobody tells you", "changed everything", "proven", "exactly how"

EXAMPLE:
- Input: "morning habits"
- Output: "The 5 AM morning routine that turned a broke college dropout into a 7-figure entrepreneur in 18 months, and why the third habit is the one nobody talks about but actually drives 80% of the results, perfect for ambitious professionals who feel stuck in their current routine"

Return ONLY the enhanced topic text. No quotes, no labels, no explanation.` },

            { role: 'user', content: topic }
          ]
        }
      });
      if (error) throw error;
      const enhanced = data?.choices?.[0]?.message?.content?.trim();
      if (enhanced) {
        setTopic(enhanced);
        toast({ title: "Prompt Enhanced ✨", description: "Your topic has been upgraded for maximum engagement." });
      }
    } catch (err) {
      console.error('Enhance prompt error:', err);
      toast({ title: "Enhancement Failed", description: "Could not enhance your prompt. Try again.", variant: "destructive" });
    } finally {
      setIsEnhancingPrompt(false);
    }
  };

  // Add captions to a completed reel
  const handleAddCaptions = async (reel: SavedReel) => {
    if (!reel.video_url || !reel.scenes?.length) return;
    setAddingCaptionsId(reel.id);
    setCaptionPreviewReel(reel);
    setIsBurningCaptions(true);
    setCaptionedVideoUrl(null);

    try {
      const clips = reel.scenes.map((s: any) => ({
        url: s.videoUrl || reel.video_url!,
        duration: s.audioDuration || s.duration || 5,
        caption: s.text || s.narration || '',
        audioDuration: s.audioDuration || s.duration || 5,
      })).filter((c: any) => c.url);

      const captionSettings = reel.caption_settings || { style: 'karaoke', background: 'glass', position: 'bottom' };

      const { data, error } = await supabase.functions.invoke('creatomate-stitch', {
        body: {
          clips,
          audioUrl: reel.audio_url || undefined,
          captionStyle: captionSettings.position || 'bottom',
          captionBackground: captionSettings.background || 'glass',
          captionFontSize: 'medium',
          transition: 'crossfade',
        },
      });

      if (error) throw error;
      if (!data?.renderId) throw new Error('No render ID returned');

      // Poll for completion
      let attempts = 0;
      while (attempts < 60) {
        await new Promise(r => setTimeout(r, 3000));
        const { data: statusData } = await supabase.functions.invoke('creatomate-status', {
          body: { renderId: data.renderId },
        });
        if (statusData?.status === 'succeeded' && statusData?.url) {
          setCaptionedVideoUrl(statusData.url);
          setIsBurningCaptions(false);
          return;
        }
        if (statusData?.status === 'failed') throw new Error('Caption render failed');
        attempts++;
      }
      throw new Error('Caption render timed out');
    } catch (e: any) {
      console.error('Add captions failed:', e);
      toast({ title: 'Caption Failed', description: e.message, variant: 'destructive' });
      setCaptionPreviewReel(null);
      setIsBurningCaptions(false);
    } finally {
      setAddingCaptionsId(null);
    }
  };

  const handleSaveCaptions = async () => {
    if (!captionPreviewReel || !captionedVideoUrl) return;
    try {
      const { error } = await supabase.from('reels').update({
        video_url: captionedVideoUrl,
        video_url_no_captions: captionPreviewReel.video_url,
      }).eq('id', captionPreviewReel.id);
      if (error) throw error;

      setSavedReels(prev => prev.map(r =>
        r.id === captionPreviewReel.id
          ? { ...r, video_url: captionedVideoUrl, video_url_no_captions: r.video_url }
          : r
      ));
      toast({ title: 'Captions Saved', description: 'Video updated with burned-in captions.' });
    } catch (e: any) {
      toast({ title: 'Save Failed', description: e.message, variant: 'destructive' });
    } finally {
      setCaptionPreviewReel(null);
      setCaptionedVideoUrl(null);
    }
  };

  const handleRemoveCaptions = async (reel: SavedReel) => {
    if (!reel.video_url_no_captions) return;
    try {
      const { error } = await supabase.from('reels').update({
        video_url: reel.video_url_no_captions,
        video_url_no_captions: null,
      }).eq('id', reel.id);
      if (error) throw error;

      setSavedReels(prev => prev.map(r =>
        r.id === reel.id
          ? { ...r, video_url: reel.video_url_no_captions!, video_url_no_captions: null }
          : r
      ));
      toast({ title: 'Captions Removed', description: 'Restored original video without captions.' });
    } catch (e: any) {
      toast({ title: 'Remove Failed', description: e.message, variant: 'destructive' });
    }
  };


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

  // Cleanup blob URLs on unmount (#34)
  useEffect(() => {
    return () => {
      if (project.videoBlobUrl && project.videoBlobUrl.startsWith('blob:')) {
        URL.revokeObjectURL(project.videoBlobUrl);
      }
      project.videoClips.forEach(clip => {
        if (clip.videoUrl?.startsWith('blob:')) URL.revokeObjectURL(clip.videoUrl);
      });
    };
  }, []);


  useEffect(() => {
    const source = searchParams.get('source');
    const transferredTopic = searchParams.get('topic');
    
    if (source === 'movie-scene' && transferredTopic) {
      setTopic(transferredTopic);
      setSearchParams({});
      toast({
        title: "Movie Idea Transferred!",
        description: "Your movie idea has been imported. Ready to create your reel!",
      });
    } else if (source === 'hook-engine' && transferredTopic) {
      setTopic(transferredTopic);
      setSearchParams({});
      toast({
        title: "Hook Imported!",
        description: "Your hook has been set as the reel topic. Ready to generate!",
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

  // Load AI twins using lightweight summary function (avoids pulling all reference_images)
  const loadAiTwins = async (retryCount = 0) => {
    if (!user) return;
    try {
      const { data, error } = await supabase.rpc('get_twins_summary', { _user_id: user.id });
      
      if (error) {
        if ((error.code === '57014' || error.message?.includes('fetch') || error.message?.includes('JSON')) && retryCount < 2) {
          console.log(`AI Twins query failed, retrying (${retryCount + 1}/2)...`);
          setTimeout(() => loadAiTwins(retryCount + 1), 1000);
          return;
        }
        console.error('Error loading AI twins:', error);
        return;
      }
      
      if (data) {
        // Map summary format to the shape components expect
        const mapped = (data as any[]).map(t => ({
          id: t.id,
          name: t.name,
          reference_images: t.first_image ? [t.first_image] : [],
          voice_cloning_key: t.voice_cloning_key,
          voice_sample_url: t.voice_sample_url,
          face_description: t.face_description,
          gender: t.gender,
          image_count: t.image_count,
          voice_engine: t.voice_engine || 'speechify',
          google_voice_id: t.google_voice_id,
        }));
        setAiTwins(mapped);
      }
    } catch (err: any) {
      if (err?.message?.includes('fetch') && retryCount < 2) {
        console.log(`Network error loading AI twins, retrying (${retryCount + 1}/2)...`);
        setTimeout(() => loadAiTwins(retryCount + 1), 1000);
        return;
      }
      console.error('Failed to load AI twins:', err);
    }
  };

  // Load full reference_images for a specific twin (lazy load on selection)
  const loadTwinFullImages = async (twinId: string) => {
    if (!user) return null;
    try {
      const { data, error } = await supabase
        .from('ai_twins')
        .select('reference_images')
        .eq('id', twinId)
        .eq('user_id', user.id)
        .single();
      if (error || !data) return null;
      return data.reference_images || [];
    } catch {
      return null;
    }
  };

  // Fetch saved reels, characters, and AI twins on mount
  const fetchProductImages = useCallback(async () => {
    if (!user) return;
    try {
      const { data } = await supabase.from('product_images').select('id, image_url, name').eq('user_id', user.id).order('created_at', { ascending: false });
      if (data) setTimelineProductImages(data);
    } catch (e) { console.warn('Failed to load product images:', e); }
  }, [user]);

  useEffect(() => {
    if (user) {
      fetchSavedReels();
      loadCharacters();
      loadAiTwins();
      fetchProductImages();
    }
  }, [user]);

  // Refresh saved reels when background jobs complete
  const completedJobCount = activeJobs.filter(j => j.status === 'complete').length;
  useEffect(() => {
    if (completedJobCount > 0 && user) {
      fetchSavedReels();
    }
  }, [completedJobCount, user]);

  const fetchSavedReels = async (retryCount = 0) => {
    if (!user) return;
    
    // Only show loading on first attempt
    if (retryCount === 0) {
      setLoadingReels(true);
    }
    
    try {
      // Exclude scenes and draft_state which can contain massive base64 data (50MB+)
      // Scene count is derived from scenes JSON length on-demand when editing
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
        scenes: [], // Scenes loaded on-demand when editing to avoid massive JSON payloads
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
      // Build scenes data - merge videoClip URLs when available
      const videoClipMap = new Map(project.videoClips.map(v => [v.sceneNumber, v.videoUrl]));
      const voiceoverMap = new Map(project.voiceovers.map(v => [v.sceneNumber, { url: v.storageUrl || v.audioUrl, duration: v.duration }]));
      
      const scenesData = previewScenes.length > 0
        ? previewScenes.map((scene) => ({
            sceneNumber: scene.sceneNumber,
            text: scene.narration,
            imageUrl: scene.imageUrl,
            videoUrl: videoClipMap.get(scene.sceneNumber) || null,
            audioUrl: scene.audioUrl || voiceoverMap.get(scene.sceneNumber)?.url || null,
            startTime: 0,
            endTime: scene.audioDuration
          }))
        : project.previewScenes.length > 0
          ? project.previewScenes.map((scene) => ({
              sceneNumber: scene.sceneNumber,
              text: scene.narration,
              imageUrl: scene.imageUrl,
              videoUrl: videoClipMap.get(scene.sceneNumber) || null,
              audioUrl: scene.audioUrl || voiceoverMap.get(scene.sceneNumber)?.url || null,
              startTime: 0,
              endTime: scene.audioDuration
            }))
          : project.generatedScenes.map((scene) => ({
              sceneNumber: scene.sceneNumber,
              text: scene.text,
              imageUrl: scene.imageUrl,
              videoUrl: videoClipMap.get(scene.sceneNumber) || scene.videoUrl || null,
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
        customAudioDuration,
        voicePitch,
        generatedScenes: project.generatedScenes,
        backgroundMusicUrl,
        backgroundMusicMood
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
    setSelectedVoice(ds.selectedVoice || '');
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
    setEnableLipSync(isBeginner || isQuick ? true : (ds.enableLipSync || false));
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
    setVoicePitch(ds.voicePitch || 0);

    // Restore strategist state
    if (ds.strategist) {
      setStrategistState(ds.strategist);
    }

    // Restore project state with scenes and preview scenes
    // Reconstruct videoClips from generatedScenes that have videoUrl
    const restoredScenes = ds.generatedScenes || [];
    const restoredVideoClips = restoredScenes
      .filter((s: GeneratedScene) => s.videoUrl)
      .map((s: GeneratedScene) => ({ sceneNumber: s.sceneNumber, videoUrl: s.videoUrl! }));

    setProject({
      topic: draft.topic,
      scenes: ds.scenes || [],
      voiceovers: ds.voiceovers || [],
      videoUrl: null,
      videoBlobUrl: null,
      generatedScenes: restoredScenes,
      videoClips: restoredVideoClips,
      previewScenes: ds.previewScenes || [],
      status: 'idle'
    });

    // Restore preview scenes into the hook so they render in ScenePreview
    if ((ds.previewScenes || []).length > 0) {
      restorePreviewScenes(ds.previewScenes, ds.voiceovers || []);
    }

    // Reset completion state so editor view shows, not "reel ready"
    setProgress(0);
    setProgressStatus('');
    setIsGenerating(false);
    setVideoError(null);
    
    // Restore background music
    if (ds.backgroundMusicUrl) setBackgroundMusicUrl(ds.backgroundMusicUrl);
    if (ds.backgroundMusicMood) setBackgroundMusicMood(ds.backgroundMusicMood);

    // Restore beginner step based on progress
    if (isBeginner) {
      const hasScenes = (ds.scenes?.length || 0) > 0;
      const hasCharacter = !!ds.portraitImage || !!ds.selectedTwinId;
      if (hasCharacter) {
        setBeginnerStep(3);
      } else if (hasScenes) {
        setBeginnerStep(2);
      } else {
        setBeginnerStep(1);
      }
    }

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

  // Restore a completed reel as a new draft (preserving all assets)
  const restoreAsDraft = async (reel: SavedReel) => {
    if (!user) return;

    try {
      // Fetch full reel data
      const { data: fullReel, error: fetchErr } = await supabase
        .from('reels')
        .select('scenes, draft_state')
        .eq('id', reel.id)
        .single();
      if (fetchErr) throw fetchErr;

      const scenes = (fullReel?.scenes as unknown as GeneratedScene[]) || reel.scenes || [];
      const scriptScenes: Scene[] = scenes.map((scene, index) => ({
        sceneNumber: index + 1,
        narration: scene.text || '',
        visualDescription: scene.text || '',
        duration: Math.round((scene.endTime || 0) - (scene.startTime || 0)) || 12,
      }));

      const draftState: DraftState = {
        selectedSceneCount: String(scenes.length),
        selectedSceneDuration: '12',
        selectedVoice: '',
        selectedVideoSize: '9:16',
        transitionStyle: 'crossfade',
        hookStyle: 'auto',
        characterDescription: '',
        preSelectedReference: null,
        selectedTwinId: null,
        selectedIntro: 'none',
        selectedOutro: 'none',
        introText: '',
        outroText: '',
        enableCutScenes: false,
        enableLipSync: isBeginner || isQuick,
        portraitImage: null,
        featureToggles: { introOutro: false, cutScenes: false, upscaler: false, lipSync: isBeginner || isQuick, captions: true, backgroundMusic: false },
        scenes: scriptScenes,
        previewScenes: scenes.map(s => ({
          sceneNumber: s.sceneNumber,
          narration: s.text || '',
          visualDescription: s.text || '',
          imageUrl: s.imageUrl || null,
          audioUrl: null,
          audioDuration: 0,
          isGenerating: false
        })),
        voiceovers: [],
        customAudioMode: 'tts',
        customAudioUrl: null,
        customAudioDuration: 0,
        voicePitch: 0,
        generatedScenes: scenes,
      };

      const { error } = await supabase.from('reels').insert([{
        user_id: user.id,
        topic: reel.topic,
        video_url: null,
        thumbnail_url: scenes[0]?.imageUrl || null,
        scenes: scenes as unknown as any,
        total_duration: reel.total_duration,
        is_draft: true,
        draft_state: draftState as unknown as any
      }]);

      if (error) throw error;

      fetchSavedReels();

      // Also load the reel into the editor immediately so user can edit scenes
      const restoredVideoClips = scenes
        .filter(s => s.videoUrl)
        .map(s => ({ sceneNumber: s.sceneNumber, videoUrl: s.videoUrl! }));

      setProject({
        topic: reel.topic,
        scenes: scriptScenes,
        voiceovers: [],
        videoUrl: null,
        videoBlobUrl: null,
        generatedScenes: scenes,
        videoClips: restoredVideoClips,
        previewScenes: scenes.map(s => ({
          sceneNumber: s.sceneNumber,
          narration: s.text || '',
          visualDescription: s.text || '',
          imageUrl: s.imageUrl || null,
          audioUrl: null,
          audioDuration: 0,
          isGenerating: false
        })),
        status: 'idle'
      });

      setTopic(reel.topic);
      setSelectedSceneCount(String(scenes.length));
      setProgress(0);
      setProgressStatus('');
      setIsGenerating(false);
      setVideoError(null);
      setActiveTab('create');

      toast({
        title: "Restored as Draft",
        description: "Reel loaded into the editor with all assets. You can now edit scenes and swap products."
      });
    } catch (error: any) {
      console.error('Error restoring as draft:', error);
      toast({
        title: "Restore Failed",
        description: error.message || "Failed to restore reel as draft.",
        variant: "destructive"
      });
    }
  };

  // Generate background music using the generate-music edge function
  const generateBackgroundMusic = async () => {
    if (!backgroundMusicMood.trim()) {
      toast({
        title: "Mood Required",
        description: "Describe the mood or style of music you want.",
        variant: "destructive"
      });
      return;
    }

    setIsGeneratingMusic(true);
    try {
      const totalDuration = project.scenes.reduce((acc, s) => acc + s.duration, 0) || 30;
      const { data, error } = await supabase.functions.invoke('generate-music', {
        body: { mood: backgroundMusicMood, duration: Math.min(totalDuration, 120) }
      });

      if (error) throw error;

      if (data?.audioUrl) {
        setBackgroundMusicUrl(data.audioUrl);
        toast({ title: "Music Generated!", description: `Background track for "${backgroundMusicMood}" is ready.` });
      } else if (data?.audioContent) {
        const audioUrl = `data:audio/mpeg;base64,${data.audioContent}`;
        setBackgroundMusicUrl(audioUrl);
        toast({ title: "Music Generated!", description: `Background track for "${backgroundMusicMood}" is ready.` });
      }
    } catch (error: any) {
      console.error('Music generation error:', error);
      toast({
        title: "Music Generation Failed",
        description: error.message || "Failed to generate background music.",
        variant: "destructive"
      });
    } finally {
      setIsGeneratingMusic(false);
    }
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

  // Generate hook options independently
  const generateHookOptions = async () => {
    if (!topic.trim()) {
      toast({ title: "Missing Topic", description: "Enter a topic first.", variant: "destructive" });
      return;
    }
    setIsGeneratingHooks(true);
    setShowHookSelector(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-hooks', {
        body: {
          topic: topic.trim(),
          hookStyle,
          characterDescription: characterDescription.trim() || undefined,
          hookCount: 5,
        }
      });
      if (error) throw error;
      setGeneratedHooks(data.hooks || []);
      toast({ title: "Hooks Generated", description: `${data.hooks?.length || 0} hook options ready for review.` });
    } catch (error: any) {
      console.error('Hook generation error:', error);
      toast({ title: "Hook Generation Failed", description: error.message || "Please try again.", variant: "destructive" });
    } finally {
      setIsGeneratingHooks(false);
    }
  };

  const regenerateHooks = async () => {
    setSelectedHook(null);
    await generateHookOptions();
  };

  const generateScripts = async (overrides?: { characterDescriptionOverride?: string; topicOverride?: string }): Promise<Scene[] | null> => {
    const effectiveTopic = overrides?.topicOverride || topic;
    const effectiveCharDesc = overrides?.characterDescriptionOverride ?? characterDescription;
    if (!effectiveTopic.trim()) {
      toast({
        title: "Topic Required",
        description: "Please enter a topic for your reel.",
        variant: "destructive"
      });
      return;
    }

    if (abortRef.current?.signal.aborted) return null;
    setIsGenerating(true);
    setProject(prev => ({ ...prev, status: 'generating-script', topic: effectiveTopic }));
    setProgress(10);

    // For podcast mode, use 1 scene with the full duration
    const sceneCount = isPodcastMode ? 1 : parseInt(selectedSceneCount);
    const sceneDuration = isPodcastMode ? parseInt(podcastDuration) : parseInt(selectedSceneDuration);
    const targetDuration = sceneCount * sceneDuration;
    
    // Get selected character info for podcast mode
    const selectedCharacter = isPodcastMode && selectedCharacterId 
      ? characters.find(c => c.id === selectedCharacterId)
      : null;

    // Get active character image URL for visual context
    const activePortrait = getActivePortrait();

    try {
      const { data, error } = await supabase.functions.invoke('generate-reel-script', {
        body: { 
          topic: effectiveTopic, 
          sceneCount,
          sceneDuration,
          targetDuration,
          hookStyle,
          enableCutScenes: isPodcastMode ? false : enableCutScenes,
          characterDescription: effectiveCharDesc.trim() || undefined,
          characterImageUrl: activePortrait || undefined,
          characterProfile: characterProfile || undefined,
          isPodcastMode,
          characterId: selectedCharacterId,
          characterName: selectedCharacter?.name,
          transitionStyle: transitionStyle !== 'none' ? transitionStyle : undefined,
          selectedHook: selectedHook || undefined,
          productImageUrl: selectedProductImageUrl || undefined,
          productName: selectedProductName || undefined,
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

    if (abortRef.current?.signal.aborted) return;
    setIsGenerating(true);
    setVideoError(null);
    setProject(prev => ({ ...prev, status: 'generating-video', generatedScenes: [], videoClips: [], videoBlobUrl: null, videoUrl: null }));
    setProgress(5);

    const hasPreviewVoiceovers = previewVoiceovers.length > 0;
    const voiceovers: { sceneNumber: number; audioUrl: string; storageUrl?: string; duration: number }[] = hasPreviewVoiceovers ? [...previewVoiceovers] : [];

    try {
      const selectedTwin = selectedTwinId ? aiTwins.find(t => t.id === selectedTwinId) : null;
      const selectedTwinGender = selectedTwin?.gender || undefined;

      // Speechify is no longer used; use the configured non-Speechify TTS chain only.
      const autoMatchedSpeechifyVoiceId: string | undefined = undefined;

      if (videoModel === 'sora-2') {
        // Sora-2 hybrid: the backend now creates TTS when available and falls back
        // to silent Sora-2 clips when paid TTS providers are unavailable.
        console.log(`${videoModel} selected — backend will handle TTS or silent fallback per scene`);
        setProgressStatus('Preparing Sora-2 scenes...');

        for (const scene of activeScenes) {
            voiceovers.push({
              sceneNumber: scene.sceneNumber,
              audioUrl: '',
              duration: scene.duration || 8
            });
        }
      } else if (!hasPreviewVoiceovers) {
        setProgressStatus('Generating voiceovers...');

        for (const scene of activeScenes) {
          if ((scene as any).isSilentCTA || !scene.narration?.trim()) {
            console.log(`Scene ${scene.sceneNumber} is silent CTA - skipping voiceover`);
            voiceovers.push({
              sceneNumber: scene.sceneNumber,
              audioUrl: '',
              duration: scene.duration || 2
            });
            continue;
          }

          try {
            const voiceConfig = resolveVoiceForGeneration();
            const { data: ttsData, error: ttsError } = await supabase.functions.invoke('text-to-speech', {
              body: {
                text: scene.narration,
                voice: voiceConfig.voice,
                voiceEngine: voiceConfig.voiceEngine,
                speechifyVoiceId: autoMatchedSpeechifyVoiceId,
                gender: selectedTwinGender,
                pitch: voicePitch,
              }
            });

            if (ttsError) {
              console.error('TTS error for scene', scene.sceneNumber, ':', ttsError);
              continue;
            }

            if (ttsData?.audioContent) {
              const audioUrl = `data:audio/mp3;base64,${ttsData.audioContent}`;
              const actualDuration = await getAudioDuration(audioUrl);
              console.log(`Scene ${scene.sceneNumber} voiceover actual duration: ${actualDuration}s`);

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
      }

      if (hasPreviewVoiceovers) {
        setProgress(15);
        setProgressStatus('Using cached voiceovers. Creating images...');
      } else {
        setProgress(15);
        setProgressStatus(`Generated ${voiceovers.length}/${activeScenes.length} voiceovers. Creating images...`);
      }

      const scenesWithAudioDurations = activeScenes.map(scene => {
        const voiceover = voiceovers.find(v => v.sceneNumber === scene.sceneNumber);
        return {
          ...scene,
          audioDuration: voiceover?.duration
        };
      });

      const preGeneratedImages = previewScenes.length > 0
        ? previewScenes.map(ps => ({ sceneNumber: ps.sceneNumber, imageUrl: ps.imageUrl }))
        : undefined;

      const twinReferenceImages = selectedTwin?.reference_images || [];
      const effectiveLipSync = overrides?.forceEnableLipSync ?? enableLipSync;
      const effectiveLipSyncModel = overrides?.forceLipSyncModel ?? lipSyncModel;

      const diverseAngles = ['eye-level', 'three-quarter', 'low-angle', 'medium-shot', 'closeup', 'profile-shot', 'golden-hour', 'cinematic'];
      const cameraAngleRotation = scenesWithAudioDurations
        .filter((scene) => !scene.isIntro && !scene.isOutro)
        .map((scene, idx) => {
          const angleId = diverseAngles[idx % diverseAngles.length];
          const angle = CAMERA_ANGLES.find(a => a.id === angleId);
          return angle?.promptModifier || CAMERA_ANGLES.find(a => a.id === selectedCameraAngle)?.promptModifier || '';
        });

      const activePortrait = getActivePortrait();

      const { data, error } = await supabase.functions.invoke('generate-reel-video', {
        body: {
          scenes: scenesWithAudioDurations,
          topic: project.topic,
          addCaptions: featureToggles.captions,
          useWaveSpeed: true,
          enableLipSync: effectiveLipSync,
          lipSyncModel: effectiveLipSync ? effectiveLipSyncModel : undefined,
          portraitImage: effectiveLipSync ? activePortrait : undefined,
          voice: resolveVoiceForGeneration().voice,
          voiceovers: voiceovers.map(v => ({
            sceneNumber: v.sceneNumber,
            audioUrl: v.storageUrl || v.audioUrl,
            duration: v.duration
          })),
          preGeneratedImages,
          referenceImages: twinReferenceImages,
          characterDescription: characterDescription || selectedTwin?.face_description || '',
          cameraAngles: cameraAngleRotation,
          videoModel: videoModel,
          sceneDuration: undefined,
          productImageUrl: selectedProductImageUrl || undefined,
          productName: selectedProductName || undefined,
          aiTwin: selectedTwin ? {
            id: selectedTwin.id,
            name: selectedTwin.name,
            voice_cloning_key: selectedTwin.voice_cloning_key,
            voice_engine: selectedTwin.voice_engine,
            google_voice_id: selectedTwin.google_voice_id,
            gender: selectedTwin.gender,
          } : null
        }
      });

      if (error) throw error;

      const generatedScenes = data.scenes || [];
      const videoTasks = data.videoTasks || [];
      const hasEmbeddedAudio = data.hasEmbeddedAudio || false;
      const perSceneEmbeddedAudio: Record<number, boolean> = {};
      for (const task of videoTasks) {
        perSceneEmbeddedAudio[task.sceneNumber] = task.hasEmbeddedAudio || false;
      }
      console.log('Video generation response:', { videoTasks: videoTasks.length, hasEmbeddedAudio, perSceneEmbeddedAudio });

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

      if (videoTasks.length > 0) {
        activeGenerationRef.current = {
          videoTasks: videoTasks.map((t: any) => ({ taskId: t.taskId, sceneNumber: t.sceneNumber, hasEmbeddedAudio: t.hasEmbeddedAudio })),
          generatedScenes,
          voiceovers,
          hasEmbeddedAudio,
          topic: project.topic
        };

        setProject(prev => ({ ...prev, status: 'rendering-video' }));
        setProgressStatus(`Generating ${videoTasks.length} video clips with WaveSpeed...`);

        const completedVideos: { sceneNumber: number; videoUrl: string }[] = [];
        const maxPollingTime = 300000;
        const pollInterval = 5000;
        const startTime = Date.now();

        while (completedVideos.length < videoTasks.length) {
          if (Date.now() - startTime > maxPollingTime) {
            console.warn(`Video polling timed out after ${maxPollingTime / 1000}s. ${completedVideos.length}/${videoTasks.length} completed.`);
            
            // Hand off incomplete tasks to background job system
            const pendingTasks = videoTasks.filter((t: any) => !completedVideos.find(v => v.sceneNumber === t.sceneNumber));
            if (pendingTasks.length > 0 && user) {
              try {
                registerJob({
                  topic: project.topic || topic || 'Untitled Reel',
                  userId: user.id,
                  videoTasks: pendingTasks.map((t: any) => ({ taskId: t.taskId, sceneNumber: t.sceneNumber, hasEmbeddedAudio: t.hasEmbeddedAudio })),
                  generatedScenes,
                  voiceovers,
                  hasEmbeddedAudio,
                });
                toast({
                  title: "⏳ Video moved to background",
                  description: "Your video is still generating. You'll be notified when it's ready — check the indicator in the top bar.",
                });
              } catch (bgErr) {
                console.warn('Failed to register background job:', bgErr);
              }
            }
            
            // If some completed, continue with those; otherwise exit early
            if (completedVideos.length === 0) {
              setProject(prev => ({ ...prev, status: 'idle' }));
              setProgress(0);
              setProgressStatus('');
              activeGenerationRef.current = null;
              return;
            }
            
            for (const task of videoTasks) {
              if (!completedVideos.find(v => v.sceneNumber === task.sceneNumber)) {
                completedVideos.push({ sceneNumber: task.sceneNumber, videoUrl: '' });
              }
            }
            break;
          }

          for (const task of videoTasks) {
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

              if (statusData?.status === 'completed' && statusData?.videoUrl) {
                completedVideos.push({
                  sceneNumber: task.sceneNumber,
                  videoUrl: statusData.videoUrl
                });
              } else if (statusData?.status === 'failed') {
                completedVideos.push({
                  sceneNumber: task.sceneNumber,
                  videoUrl: ''
                });
              }
            } catch (pollError) {
              console.error('Polling error for task', task.taskId, ':', pollError);
            }
          }

          const finishedCount = completedVideos.filter(v => v.videoUrl).length;
          setProgress(Math.min(70, 30 + Math.round((completedVideos.length / videoTasks.length) * 40)));
          setProgressStatus(`Rendered ${finishedCount}/${videoTasks.length} clips...`);

          if (completedVideos.length < videoTasks.length) {
            await new Promise(resolve => setTimeout(resolve, pollInterval));
          }
        }

        const sortedVideos = completedVideos
          .filter(v => v.videoUrl)
          .sort((a, b) => a.sceneNumber - b.sceneNumber);
        const sortedAudios = [...voiceovers].sort((a, b) => a.sceneNumber - b.sceneNumber);

        if (sortedVideos.length > 0) {
          let audioUrlsForStitch: string[] = [];
          const allScenesHaveEmbeddedAudio = hasEmbeddedAudio && videoTasks.every((t: any) => t.hasEmbeddedAudio);
          const someScenesNeedAudio = !allScenesHaveEmbeddedAudio;

          console.log('Audio overlay decision:', {
            hasEmbeddedAudio,
            allScenesHaveEmbeddedAudio,
            someScenesNeedAudio,
            perSceneEmbeddedAudio,
            reason: allScenesHaveEmbeddedAudio ? 'All videos have embedded audio (VEO 3)' : 'Some scenes need TTS audio overlay'
          });

          if (someScenesNeedAudio) {
            const scenesNeedingAudio = activeScenes.filter(scene => !perSceneEmbeddedAudio[scene.sceneNumber]);
            const existingAudioScenes = new Set(sortedAudios.filter(a => a.audioUrl && a.audioUrl.trim() !== '').map(a => a.sceneNumber));
            const missingAudioScenes = scenesNeedingAudio.filter(s => !existingAudioScenes.has(s.sceneNumber));

            console.log('[Audio] Scenes needing audio:', scenesNeedingAudio.map(s => ({
              scene: s.sceneNumber,
              hasNarration: !!s.narration?.trim(),
              isSilentCTA: !!(s as any).isSilentCTA
            })));
            console.log('[Audio] Existing audio for scenes:', Array.from(existingAudioScenes));
            console.log('[Audio] Missing audio scenes:', missingAudioScenes.map(s => s.sceneNumber));

            if (missingAudioScenes.length > 0) {
              console.log(`Generating voiceovers for ${missingAudioScenes.length} scenes without audio...`);
              const newVoiceovers: { sceneNumber: number; audioUrl: string; storageUrl?: string; duration: number }[] = [];

              for (const scene of missingAudioScenes) {
                if ((scene as any).isSilentCTA || !scene.narration?.trim()) {
                  newVoiceovers.push({ sceneNumber: scene.sceneNumber, audioUrl: '', duration: scene.duration || 2 });
                  continue;
                }

                try {
                  const voiceConfig = resolveVoiceForGeneration();
                  const { data: ttsData, error: ttsError } = await supabase.functions.invoke('text-to-speech', {
                    body: {
                      text: scene.narration,
                      voice: voiceConfig.voice,
                      voiceEngine: voiceConfig.voiceEngine,
                      gender: selectedTwinGender,
                      pitch: voicePitch
                    }
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
                      } catch (e) {
                        console.warn('Upload failed:', e);
                      }
                    }

                    newVoiceovers.push({ sceneNumber: scene.sceneNumber, audioUrl, storageUrl, duration: actualDuration || scene.duration || 5 });
                  }
                } catch (e) {
                  console.warn(`TTS failed for scene ${scene.sceneNumber}:`, e);
                }
              }

              const mergedAudios = [...sortedAudios, ...newVoiceovers].sort((a, b) => a.sceneNumber - b.sceneNumber);
              sortedAudios.splice(0, sortedAudios.length, ...mergedAudios);
            }

            audioUrlsForStitch = sortedAudios
              .filter(a => a.audioUrl && a.audioUrl.trim() !== '' && !perSceneEmbeddedAudio[a.sceneNumber])
              .map(a => a.storageUrl || a.audioUrl);
          }

          setProgressStatus('Stitching video clips...');
          setProgress(80);

          try {
            const videoUrls = sortedVideos.map(v => v.videoUrl);
            const embeddedAudioIndices: number[] = [];
            sortedVideos.forEach((v, idx) => {
              if (perSceneEmbeddedAudio[v.sceneNumber]) {
                embeddedAudioIndices.push(idx);
              }
            });

            console.log('[Stitch] Embedded audio indices:', embeddedAudioIndices, 'Overlay audio count:', audioUrlsForStitch.length);

            // SKIP stitching for single-clip videos with embedded audio — canvas taints on cross-origin
            const allEmbedded = embeddedAudioIndices.length === videoUrls.length && audioUrlsForStitch.length === 0;
            const skipStitch = videoUrls.length === 1 && allEmbedded;

            let persistedVideoUrl: string;

            if (skipStitch) {
              console.log('[Stitch] Single embedded-audio clip — skipping stitch, using original URL');
              persistedVideoUrl = videoUrls[0];
              setProgress(95);
            } else {
              const sizeMap: Record<string, [number, number]> = {
                '9:16': [1080, 1920],
                '1:1': [1080, 1080],
                '16:9': [1920, 1080],
                '4:5': [1080, 1350],
              };
              const [stitchWidth, stitchHeight] = sizeMap[selectedVideoSize] || [1080, 1920];

              const allPublicUrls = videoUrls.every(u => u.startsWith('http'));
              const useCaptionStitch = captionSettings.enabled && allPublicUrls;
              let finalBlob: Blob | null = null;

              // Try Creatomate cloud stitching when captions are enabled
              if (useCaptionStitch) {
                try {
                  setProgressStatus('Cloud rendering with captions...');

                  let mergedAudioUrl: string | undefined;
                  if (audioUrlsForStitch.length === 1) {
                    mergedAudioUrl = audioUrlsForStitch[0];
                  } else if (audioUrlsForStitch.length > 1) {
                    try {
                      const mergeResponse = await supabase.functions.invoke('merge-audio', {
                        body: { audioUrls: audioUrlsForStitch }
                      });
                      if (mergeResponse.data?.audioUrl) mergedAudioUrl = mergeResponse.data.audioUrl;
                    } catch (e) {
                      console.log('Audio merge failed, using first audio');
                      mergedAudioUrl = audioUrlsForStitch[0];
                    }
                  }

                  const clips = sortedVideos.map((v) => {
                    const scene = generatedScenes.find(s => s.sceneNumber === v.sceneNumber);
                    const audio = sortedAudios.find(a => a.sceneNumber === v.sceneNumber);
                    return {
                      url: v.videoUrl,
                      duration: scene?.duration || 5,
                      audioDuration: audio?.duration || scene?.duration || 5,
                      caption: captionSettings.enabled && scene?.narration ? scene.narration : undefined
                    };
                  });

                  const { data: stitchData, error: stitchError } = await supabase.functions.invoke('creatomate-stitch', {
                    body: {
                      clips,
                      audioUrl: mergedAudioUrl,
                      backgroundMusicUrl: backgroundMusicUrl || undefined,
                      backgroundMusicVolume: 25,
                      transition: transitionStyle,
                      captionStyle: captionSettings.position || 'bottom',
                      width: stitchWidth,
                      height: stitchHeight,
                      captionFont: captionSettings.fontFamily || 'Montserrat',
                      captionFontSize: captionSettings.fontSize || 'medium',
                      captionFontColor: captionSettings.fontColor || '#ffffff',
                      captionBackground: captionSettings.background || 'glass',
                      captionAnimation: captionSettings.style || 'karaoke',
                      logoUrl: selectedLogoUrl || undefined,
                      logoAnimation: selectedLogoUrl ? selectedLogoAnimation : undefined,
                      introImageUrl: selectedThumbnailUrl || undefined,
                      introImageDuration: 3,
                    }
                  });

                  if (stitchError || !stitchData?.success || !stitchData?.renderId) throw new Error(stitchData?.error || 'Cloud stitch failed');

                  let cloudUrl: string | null = null;
                  for (let attempt = 0; attempt < 60; attempt++) {
                    await new Promise(r => setTimeout(r, 3000));
                    const { data: status } = await supabase.functions.invoke('creatomate-status', {
                      body: { renderId: stitchData.renderId }
                    });
                    if (status?.status === 'succeeded' && status?.url) { cloudUrl = status.url; break; }
                    if (status?.status === 'failed') throw new Error('Cloud render failed');
                    setProgress(80 + Math.min(12, (attempt / 60) * 12));
                    setProgressStatus(`Rendering... ${status?.progress ? Math.round(status.progress) + '%' : ''}`);
                  }
                  if (!cloudUrl) throw new Error('Cloud render timed out');

                  persistedVideoUrl = cloudUrl;
                  console.log('[AutoStitch] Cloud render complete:', cloudUrl);
                } catch (cloudErr) {
                  console.warn('[AutoStitch] Cloud stitch failed, falling back to canvas:', cloudErr);
                  setProgressStatus('Falling back to local stitching...');
                  // Fall through to canvas stitch below
                }
              }

              // Canvas fallback (or primary path when captions not enabled)
              if (!persistedVideoUrl || persistedVideoUrl === '') {
                const canvasBlob = await canvasStitchVideos({
                  videoUrls,
                  audioUrls: audioUrlsForStitch.length > 0 ? audioUrlsForStitch : undefined,
                  embeddedAudioIndices: embeddedAudioIndices.length > 0 ? embeddedAudioIndices : undefined,
                  backgroundMusicUrl: backgroundMusicUrl || undefined,
                  backgroundMusicVolume: 20,
                  width: stitchWidth,
                  height: stitchHeight,
                  onProgress: (p) => {
                    setProgress(75 + Math.round(p * 0.2));
                    setProgressStatus(`Stitching... ${Math.round(p)}%`);
                  },
                  onStatus: (s) => setProgressStatus(s)
                });

                finalBlob = canvasBlob;
                const blobUrl = URL.createObjectURL(canvasBlob);
                videoBlobRef.current = canvasBlob;
                persistedVideoUrl = blobUrl;

                if (user) {
                  setProgress(92);
                  setProgressStatus('Uploading final video...');
                  try {
                    const isWebm = canvasBlob.type.includes('webm');
                    const ext = isWebm ? 'webm' : 'mp4';
                    const fileName = `${user.id}/videos/${Date.now()}-stitched.${ext}`;
                    const { data: uploadData, error: uploadError } = await supabase.storage
                      .from('reels')
                      .upload(fileName, canvasBlob, { contentType: canvasBlob.type || 'video/webm' });
                    if (!uploadError && uploadData) {
                      const { data: publicUrl } = supabase.storage.from('reels').getPublicUrl(fileName);
                      persistedVideoUrl = publicUrl.publicUrl;
                    }
                  } catch (e) {
                    console.warn('Upload failed:', e);
                  }
                }
              }
            }

            setProject(prev => ({
              ...prev,
              videoUrl: persistedVideoUrl,
              videoBlobUrl: persistedVideoUrl,
              generatedScenes,
              voiceovers: sortedAudios,
              videoClips: sortedVideos.map(v => ({ sceneNumber: v.sceneNumber, videoUrl: v.videoUrl })),
              status: 'complete'
            }));

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
                handleReelSavedSuccessfully();
                fetchSavedReels();
              } catch (saveError) {
                console.error('Auto-save failed:', saveError);
              }
            }

            activeGenerationRef.current = null;
            setProgress(100);
            setProgressStatus('Complete!');
            toast({ title: "Video Generated!", description: `Created ${sortedVideos.length}-scene video and saved to library!` });
          } catch (stitchErr) {
            console.error('Stitching failed:', stitchErr);
            const fallbackVideoUrl = sortedVideos[0]?.videoUrl;
            setProject(prev => ({
              ...prev,
              videoUrl: fallbackVideoUrl,
              videoBlobUrl: fallbackVideoUrl,
              generatedScenes,
              voiceovers: sortedAudios,
              videoClips: sortedVideos,
              status: 'complete'
            }));

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
                  topic: project.topic || topic || 'Untitled Reel',
                  video_url: fallbackVideoUrl,
                  thumbnail_url: thumbnailUrl,
                  scenes: scenesWithAllAssets as unknown as any,
                  total_duration: Math.round(totalDuration)
                }]);
                handleReelSavedSuccessfully();
                fetchSavedReels();
              } catch (saveError) {
                console.error('Auto-save failed after stitch error:', saveError);
              }
            }

            setProgress(100);
            setProgressStatus('Complete (individual clips)');
            toast({ title: "Videos Generated!", description: `Generated ${sortedVideos.length} clips. Stitching failed — use clip navigation below.` });
          }
        }
      } else {
        setProject(prev => ({
          ...prev,
          generatedScenes,
          voiceovers: voiceovers.map(v => ({ ...v, duration: v.duration || 5 })),
          status: 'complete'
        }));

        if (user) {
          try {
            const thumbnailUrl = generatedScenes[0]?.imageUrl || null;
            const totalDuration = voiceovers.reduce((acc, a) => acc + (a.duration || 5), 0);
            const scenesData = generatedScenes.map((scene) => {
              const audio = voiceovers.find(a => a.sceneNumber === scene.sceneNumber);
              return { ...scene, videoUrl: null, audioUrl: audio?.storageUrl || null, audioDuration: audio?.duration || null };
            });
            await supabase.from('reels').insert([{
              user_id: user.id,
              topic: project.topic || topic || 'Untitled Reel',
              video_url: null,
              thumbnail_url: thumbnailUrl,
              scenes: scenesData as unknown as any,
              total_duration: Math.round(totalDuration)
            }]);
            handleReelSavedSuccessfully();
            fetchSavedReels();
          } catch (saveError) {
            console.error('Auto-save failed (images only):', saveError);
          }
        }

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
      activeGenerationRef.current = null;
    }
  };

  // Reels use Sora-2 native audio — voice is generated by the video model itself.
  // Only exception: if an AI Twin has a Speechify cloned voice, use that.
  const resolveVoiceForGeneration = (): { voice: string; voiceEngine: 'sora-2' | 'speechify' } => {
    const selectedTwin = selectedTwinId ? aiTwins.find(t => t.id === selectedTwinId) : null;
    
    // If the twin has a Speechify cloned voice, use it
    if (selectedTwin?.voice_cloning_key && selectedTwin?.voice_engine === 'speechify') {
      return { voice: selectedTwin.voice_cloning_key, voiceEngine: 'speechify' };
    }
    
    // Otherwise, signal Sora-2 native audio
    return { voice: 'ai-auto', voiceEngine: 'sora-2' };
  };

  const getResolvedVoiceLabel = () => resolveVoiceForGeneration().voice.replace(/_/g, ' ');

  const getResolvedVoiceDescription = () => {
    const selectedTwin = selectedTwinId ? aiTwins.find(t => t.id === selectedTwinId) : null;
    return selectedTwin
      ? `Auto-matched MiniMax voice for ${selectedTwin.name}`
      : 'Auto-matched MiniMax voice from your actor and script';
  };

  const getActivePortrait = () => {
    const selectedTwin = selectedTwinId ? aiTwins.find(t => t.id === selectedTwinId) : null;
    return portraitPreview || portraitImage || preSelectedReference || selectedTwin?.reference_images?.[0] || null;
  };

  const stopGeneration = () => {
    if (abortRef.current) {
      abortRef.current.abort();
    }
    setIsGenerating(false);
    setProgress(0);
    setProgressStatus('');
    setProject(prev => ({ ...prev, status: 'idle' }));
    toast({ title: "Generation Stopped", description: "The reel generation was cancelled." });
  };

  const generateAll = async () => {
    // Create a fresh AbortController for this generation run
    abortRef.current = new AbortController();
    
    // Use local variables since React state updates are async and won't be available immediately
    let shouldEnableLipSync = enableLipSync;
    let activeLipSyncModel = lipSyncModel;
    
    // Only auto-select a twin if the user hasn't already set a character image
    if (isBeginner && aiTwins.length > 0 && !selectedTwinId && !portraitImage) {
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
      shouldEnableLipSync = true;
      activeLipSyncModel = 'infinitetalk';
      setEnableLipSync(true);
      setLipSyncModel('infinitetalk');
    }
    
    // If beginner mode has no portrait and no twins, auto-generate a character
    if (isBeginner && !portraitImage && aiTwins.length === 0 && topic.trim()) {
      toast({ title: "Creating Character", description: "Generating a character from your topic..." });
      await generateCharacter();
      // After generation, portrait should be set — continue with lip sync enabled
      shouldEnableLipSync = true;
      activeLipSyncModel = 'infinitetalk';
    }

    // If user already has a portrait, enable lip sync
    if (isBeginner && portraitImage) {
      shouldEnableLipSync = true;
      activeLipSyncModel = 'infinitetalk';
      setEnableLipSync(true);
      setLipSyncModel('infinitetalk');
    }
    
    // Voice is resolved at TTS call time from AI Twin — no need to pre-resolve

    if (abortRef.current.signal.aborted) return;
    
    // In beginner mode, scripts may already be generated (from step 2 review)
    // Only generate scripts if we don't have them
    let generatedScenes: Scene[] | null = null;
    if (project.scenes.length > 0 && isBeginner) {
      console.log('Beginner mode: using pre-generated scripts from review step');
      generatedScenes = project.scenes;
    } else {
      // Pass character description directly to avoid stale React state
      const twinCharDesc = selectedTwinId ? (aiTwins.find(t => t.id === selectedTwinId)?.face_description || characterDescription) : characterDescription;
      generatedScenes = await generateScripts({ characterDescriptionOverride: twinCharDesc });
    }
    if (abortRef.current?.signal.aborted) return;
    
    if (generatedScenes && generatedScenes.length > 0) {
      // Pass scenes directly to avoid stale state issues
      await generateVideo({ forceEnableLipSync: shouldEnableLipSync, forceLipSyncModel: activeLipSyncModel, scenesOverride: generatedScenes });
    }
  };

  // ====== QUICK MODE: One-tap generation ======
  const generateQuickMode = async (quickTopic: string) => {
    if (!quickTopic.trim()) return;
    
    setTopic(quickTopic);
    abortRef.current = new AbortController();
    
    // Quick Mode: Force NO intro/outro — all scenes should be narrator scenes for lip sync
    setSelectedIntro('none');
    setSelectedOutro('none');
    setIntroText('');
    setOutroText('');
    
    // Quick Mode: Use 4 scenes at 8s each for a ~32s reel
    setSelectedSceneCount('4');
    setSelectedSceneDuration('8');
    
    // Auto-select AI Twin if available
    let shouldEnableLipSync = false;
    let activeLipSyncModel: string = 'infinitetalk';
    
    if (aiTwins.length > 0) {
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
      shouldEnableLipSync = true;
      setEnableLipSync(true);
      setLipSyncModel('infinitetalk');
    }
    
    // Voice is resolved at TTS call time from AI Twin
    
    if (abortRef.current.signal.aborted) return;
    
    // Generate scripts — strip any intro/outro flags to ensure all scenes are narrator scenes
    // Pass character description override to avoid stale React state
    const twinCharDesc = aiTwins.length > 0 ? (aiTwins[0].face_description || '') : characterDescription;
    const generatedScenes = await generateScripts({ characterDescriptionOverride: twinCharDesc, topicOverride: quickTopic });
    if (!generatedScenes || generatedScenes.length === 0 || abortRef.current?.signal.aborted) return;
    
    // Force all scenes to be narrator scenes (remove isIntro/isOutro/isSilentCTA)
    const narratorOnlyScenes = generatedScenes.map(scene => ({
      ...scene,
      isIntro: false,
      isOutro: false,
      isSilentCTA: false
    }));
    
    // Update project state with cleaned scenes
    setProject(prev => ({ ...prev, scenes: narratorOnlyScenes }));
    
    // Go straight to video generation (which handles voiceovers + images + video)
    await generateVideo({ 
      forceEnableLipSync: shouldEnableLipSync, 
      forceLipSyncModel: activeLipSyncModel, 
      scenesOverride: narratorOnlyScenes 
    });
  };

  // ====== QUICK MODE: Test single scene before committing ======
  const generateQuickModeTest = async (quickTopic: string) => {
    if (!quickTopic.trim()) return;
    
    setTopic(quickTopic);
    abortRef.current = new AbortController();
    
    // Force no intro/outro
    setSelectedIntro('none');
    setSelectedOutro('none');
    setIntroText('');
    setOutroText('');
    
    // Only 1 scene for testing
    setSelectedSceneCount('1');
    setSelectedSceneDuration('8');
    
    // Auto-select AI Twin
    let shouldEnableLipSync = false;
    let activeLipSyncModel: string = 'infinitetalk';
    
    if (aiTwins.length > 0) {
      const twin = aiTwins[0];
      setSelectedTwinId(twin.id);
      if (twin.reference_images?.[0]) {
        setPortraitImage(twin.reference_images[0]);
        setPortraitPreview(twin.reference_images[0]);
        setPreSelectedReference(twin.reference_images[0]);
      }
      if (twin.face_description) setCharacterDescription(twin.face_description);
      shouldEnableLipSync = true;
      setEnableLipSync(true);
      setLipSyncModel('infinitetalk');
    }
    
    // Voice is resolved at TTS call time from AI Twin
    
    if (abortRef.current.signal.aborted) return;
    
    // Generate scripts (will generate 1 scene due to selectedSceneCount)
    const twinCharDesc = aiTwins.length > 0 ? (aiTwins[0].face_description || '') : characterDescription;
    const generatedScenes = await generateScripts({ characterDescriptionOverride: twinCharDesc, topicOverride: quickTopic });
    if (!generatedScenes || generatedScenes.length === 0 || abortRef.current?.signal.aborted) return;
    
    // Take only the first scene
    const testScene = [{
      ...generatedScenes[0],
      isIntro: false,
      isOutro: false,
      isSilentCTA: false
    }];
    
    setProject(prev => ({ ...prev, scenes: testScene }));
    
    // Generate video for just this one scene
    await generateVideo({ 
      forceEnableLipSync: shouldEnableLipSync, 
      forceLipSyncModel: activeLipSyncModel, 
      scenesOverride: testScene 
    });
  };

  const resetProject = () => {
    // Auto-save current work before resetting (use immediate save, not debounced)
    if (project.scenes.length > 0 || topic?.trim() || project.previewScenes.length > 0) {
      saveDraft({
        topic, selectedSceneCount, selectedSceneDuration, selectedVoice,
        selectedVideoSize, transitionStyle, hookStyle, characterDescription,
        preSelectedReference, selectedTwinId, selectedIntro, selectedOutro,
        introText, outroText, enableCutScenes, enableLipSync, portraitImage,
        project, featureToggles, strategist: strategistState
      });
      toast({ title: "Draft Saved", description: "Your current reel has been saved as a draft." });
    }

    // Cleanup blob URL
    if (project.videoBlobUrl) {
      URL.revokeObjectURL(project.videoBlobUrl);
    }
    videoBlobRef.current = null;
    
    // Clear the draft so the old completed reel doesn't get restored
    clearDraft();
    
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
    setSelectedIntro('none');
    setSelectedOutro('none');
    setIntroText('');
    setOutroText('');
    resetPreview();
    setCharacterTransformation('');
    setCurrentReelSaved(false);
    setBeginnerStep(1);
    setGeneratedThumbnails([]);
    setSelectedThumbnailUrl(null);
    setShowThumbnailDialog(false);
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

  // Auto-derive a character prompt from the topic using AI
  const deriveCharacterFromTopic = async (topicText: string): Promise<string> => {
    try {
      const { data, error } = await supabase.functions.invoke('ai', {
        body: {
          messages: [{
            role: 'user',
            content: `Based on this social media reel topic, describe the ideal person/character who should present it. Return ONLY a short physical description (2 sentences max) suitable for AI image generation. Include gender, approximate age, ethnicity/skin tone, hair, attire, and vibe.

Topic: "${topicText}"

Example output: "A confident Black woman in her early 30s with natural curls, wearing a sleek blazer over a white tee. Warm smile, professional but approachable energy."`
          }],
          model: 'google/gemini-3-flash-preview'
        }
      });
      if (error) throw error;
      const desc = data?.choices?.[0]?.message?.content?.trim();
      return desc || 'A confident professional person in their 30s with a natural smile';
    } catch {
      return 'A confident professional person in their 30s with a natural smile';
    }
  };

  // Generate a character on-demand using AI image generation — creates 5 angle shots and saves as AI Twin
  const generateCharacter = async () => {
    // If prompt is empty, auto-derive from topic
    let charPrompt = generateCharacterPrompt.trim();
    if (!charPrompt && topic.trim()) {
      setIsGeneratingCharacter(true);
      toast({ title: "Analyzing topic...", description: "AI is creating the perfect character for your reel." });
      charPrompt = await deriveCharacterFromTopic(topic);
      setGenerateCharacterPrompt(charPrompt);
    }
    
    if (!charPrompt) {
      toast({ title: "Missing Description", description: "Please describe the person or enter a topic first.", variant: "destructive" });
      return;
    }
    
    setIsGeneratingCharacter(true);
    
    const ANGLE_PROMPTS = [
      { label: 'Front Portrait', prompt: `Front-facing professional portrait of: ${charPrompt}. Looking directly at camera, natural confident expression, slight smile. Shot on 85mm lens, f/1.4, professional studio lighting, clean bokeh background. Photorealistic, 8K quality.` },
      { label: '3/4 Profile', prompt: `3/4 angle profile portrait of: ${charPrompt}. Same person as reference — EXACT same face, features, skin tone, hair. Turned slightly to the right, natural expression. Shot on 50mm lens, soft rim light, warm tones. Photorealistic, 8K quality.` },
      { label: 'Side Profile', prompt: `Side profile portrait of: ${charPrompt}. Same person as reference — EXACT same face, features, skin tone, hair. Looking to the right, confident jawline visible. Shot on 85mm lens, dramatic side lighting. Photorealistic, 8K quality.` },
      { label: 'Low Angle Hero', prompt: `Low angle hero shot of: ${charPrompt}. Same person as reference — EXACT same face, features, skin tone, hair. Shot from below, powerful and commanding presence. 35mm wide lens, dramatic lighting from above. Photorealistic, 8K quality.` },
      { label: 'Casual Wide', prompt: `Medium-wide environmental portrait of: ${charPrompt}. Same person as reference — EXACT same face, features, skin tone, hair. In a professional/lifestyle setting, natural relaxed pose. 35mm lens, shallow depth of field. Photorealistic, 8K quality.` },
    ];
    
    try {
      const generatedImages: string[] = [];
      
      // Generate first image (front portrait — the reference)
      toast({ title: "Generating character...", description: "Creating front portrait (1/5)..." });
      
      const { data: firstData, error: firstError } = await supabase.functions.invoke('ai', {
        body: {
          messages: [{ role: 'user', content: ANGLE_PROMPTS[0].prompt + ' On a solid white background.' }],
          model: 'google/gemini-3.1-flash-image-preview',
          modalities: ['image', 'text']
        }
      });
      if (firstError) throw firstError;
      
      const firstImageUrl = firstData?.imageUrl || firstData?.choices?.[0]?.message?.images?.[0]?.image_url?.url;
      if (!firstImageUrl) throw new Error('No image returned for front portrait');
      generatedImages.push(firstImageUrl);
      
      // Set the first image immediately so the user sees progress
      setPortraitImage(firstImageUrl);
      setPortraitPreview(firstImageUrl);
      setPreSelectedReference(firstImageUrl);
      setCharacterDescription(charPrompt);
      setGeneratedCharacterShots([{ label: ANGLE_PROMPTS[0].label, url: firstImageUrl }]);
      setSelectedShotIndex(0);
      
      // Generate remaining 4 angles using the first image as reference for consistency
      for (let i = 1; i < ANGLE_PROMPTS.length; i++) {
        toast({ title: "Generating character...", description: `Creating ${ANGLE_PROMPTS[i].label} (${i + 1}/5)...` });
        
        try {
          const { data: angleData, error: angleError } = await supabase.functions.invoke('ai', {
            body: {
              messages: [{
                role: 'user',
                content: [
                  { type: 'image_url', image_url: { url: firstImageUrl } },
                  { type: 'text', text: `Using this person as the EXACT character reference — match their face, features, skin tone, hair, and build precisely.\n\n${ANGLE_PROMPTS[i].prompt}` }
                ]
              }],
              model: 'google/gemini-3.1-flash-image-preview',
              modalities: ['image', 'text']
            }
          });
          
          if (!angleError) {
            const angleImageUrl = angleData?.imageUrl || angleData?.choices?.[0]?.message?.images?.[0]?.image_url?.url;
            if (angleImageUrl) {
              generatedImages.push(angleImageUrl);
              setGeneratedCharacterShots(prev => [...prev, { label: ANGLE_PROMPTS[i].label, url: angleImageUrl }]);
            }
          }
        } catch (angleErr) {
          console.warn(`Angle ${ANGLE_PROMPTS[i].label} generation failed:`, angleErr);
        }
      }
      
      // Auto-detect gender for voice matching
      const descLower = charPrompt.toLowerCase();
      const femaleKeywords = ['woman', 'female', 'girl', 'lady', 'she', 'her', 'mother', 'mom', 'sister', 'actress', 'businesswoman', 'queen', 'princess', 'mrs', 'ms', 'miss'];
      const maleKeywords = ['man', 'male', 'boy', 'guy', 'he', 'him', 'father', 'dad', 'brother', 'actor', 'businessman', 'king', 'prince', 'mr'];
      const isFemale = femaleKeywords.some(k => descLower.includes(k));
      const isMale = !isFemale && maleKeywords.some(k => descLower.includes(k));
      const detectedGender = isFemale ? 'female' : 'male';
      setDetectedCharGender(detectedGender as 'male' | 'female');
      
      const matchedVoiceId = isFemale ? 'English_compelling_lady1' : 'English_magnetic_voiced_man';
      setSelectedVoice(matchedVoiceId);
      
      // Save as AI Twin to database
      if (user) {
        toast({ title: "Saving character...", description: "Adding to your AI Twin library..." });
        
        // Upload images to storage first
        const storedImageUrls: string[] = [];
        for (let i = 0; i < generatedImages.length; i++) {
          const img = generatedImages[i];
          if (img.startsWith('data:')) {
            try {
              const base64Data = img.split(',')[1];
              const binaryString = atob(base64Data);
              const bytes = new Uint8Array(binaryString.length);
              for (let j = 0; j < binaryString.length; j++) bytes[j] = binaryString.charCodeAt(j);
              const fileName = `${user.id}/twins/${Date.now()}-angle-${i}.png`;
              const { data: uploadData, error: uploadError } = await supabase.storage
                .from('reels')
                .upload(fileName, bytes, { contentType: 'image/png', upsert: true });
              if (!uploadError && uploadData) {
                const { data: publicUrl } = supabase.storage.from('reels').getPublicUrl(fileName);
                storedImageUrls.push(publicUrl.publicUrl);
              } else {
                storedImageUrls.push(img);
              }
            } catch { storedImageUrls.push(img); }
          } else {
            storedImageUrls.push(img);
          }
        }
        
        const twinName = charPrompt.length > 40 ? charPrompt.substring(0, 40) + '...' : charPrompt;
        
        const { data: twinData, error: twinError } = await supabase
          .from('ai_twins')
          .insert({
            user_id: user.id,
            name: twinName,
            description: charPrompt,
            face_description: charPrompt,
            gender: detectedGender,
            reference_images: storedImageUrls
          })
          .select()
          .single();
        
        if (!twinError && twinData) {
          setAiTwins(prev => [...prev, {
            id: twinData.id,
            name: twinData.name,
            reference_images: twinData.reference_images || [],
            voice_cloning_key: null,
            voice_sample_url: null,
            face_description: twinData.face_description
          }]);
          setSelectedTwinId(twinData.id);
          
          if (storedImageUrls.length > 0) {
            const selectedUrl = storedImageUrls[selectedShotIndex] || storedImageUrls[0];
            setPortraitImage(selectedUrl);
            setPortraitPreview(selectedUrl);
            setPreSelectedReference(selectedUrl);
            setGeneratedCharacterShots(storedImageUrls.map((url, idx) => ({
              label: ANGLE_PROMPTS[idx]?.label || `Shot ${idx + 1}`,
              url
            })));
          }
          
          toast({ title: "Character Saved! ✨", description: `${generatedImages.length} shots created. MiniMax voice will be matched automatically.` });
        } else {
          console.error('Failed to save AI Twin:', twinError);
          toast({ title: "Character Generated!", description: `${generatedImages.length} shots created. Could not save to library.` });
        }
      } else {
        toast({ title: "Character Generated!", description: `${generatedImages.length} shots created.` });
      }
      
      setShowGenerateCharacter(false);
    } catch (err: any) {
      toast({ title: "Generation Failed", description: err.message, variant: "destructive" });
    } finally {
      setIsGeneratingCharacter(false);
    }
  };

  // Preview the selected voice with a TTS sample
  const previewVoice = async () => {
    if (voicePreviewAudio) {
      voicePreviewAudio.pause();
      voicePreviewAudio.currentTime = 0;
      setVoicePreviewAudio(null);
      setIsPreviewingVoice(false);
      return;
    }

    if (videoModel === 'sora-2') {
      toast({
        title: "Sora-2 voice is generated with video",
        description: "Sora-2 generates native audio — click Generate Preview or Create Final Video to hear the voice.",
      });
      return;
    }

    const voiceConfig = resolveVoiceForGeneration();
    const sampleText = project.scenes[0]?.narration
      || "Hello! This is a preview of how your voiceover will sound in the final video.";

    setIsPreviewingVoice(true);
    try {
      const { data, error } = await supabase.functions.invoke('text-to-speech', {
        body: {
          text: sampleText.slice(0, 200),
          voice: voiceConfig.voice,
          voiceEngine: voiceConfig.voiceEngine,
          pitch: voicePitch,
        }
      });
      if (error) throw error;
      let audioUrl = data?.audioUrl || data?.url;
      if (!audioUrl && data?.audioContent) {
        audioUrl = `data:audio/mp3;base64,${data.audioContent}`;
      }
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

  // Generate premium AI thumbnail for the reel
  const generateThumbnail = async (appendVariation = false) => {
    setIsGeneratingThumbnail(true);
    try {
      const sceneDescriptions = project.generatedScenes
        .slice(0, 3)
        .map(s => s.text || '')
        .filter(Boolean)
        .join('. ');

      const { data, error } = await supabase.functions.invoke('generate-premium-visual', {
        body: {
          type: 'thumbnail',
          topic: project.topic || topic,
          style: thumbnailStyle,
          characterDescription: characterDescription || undefined,
          sceneDescriptions: sceneDescriptions || undefined,
          size: '1024x1536',
        }
      });
      if (error) throw error;
      const imageUrl = data?.imageUrl;
      if (!imageUrl) throw new Error('No thumbnail generated');
      
      if (appendVariation) {
        setGeneratedThumbnails(prev => [...prev, imageUrl]);
        setSelectedThumbnailIdx(prev => prev + 1);
      } else {
        setGeneratedThumbnails([imageUrl]);
        setSelectedThumbnailIdx(0);
      }
      setShowThumbnailDialog(true);
      toast({ title: "Premium Thumbnail Generated!", description: "Preview your thumbnail below." });
    } catch (err: any) {
      toast({ title: "Thumbnail Failed", description: err.message, variant: "destructive" });
    } finally {
      setIsGeneratingThumbnail(false);
    }
  };

  // Generate premium outro slide
  const generatePremiumOutro = async (headline: string, subtitle: string) => {
    setIsGeneratingOutro(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-premium-visual', {
        body: {
          type: 'outro',
          topic: project.topic || topic,
          style: outroStyle,
          ctaText: headline,
          subtitle: subtitle || undefined,
          logoUrl: selectedLogoUrl || undefined,
          size: '1024x1536',
        }
      });
      if (error) throw error;
      const imageUrl = data?.imageUrl;
      if (!imageUrl) throw new Error('No outro generated');

      setOutroVariations(prev => [...prev, imageUrl]);
      setSelectedOutroIdx(outroVariations.length);
      return imageUrl;
    } catch (err: any) {
      toast({ title: "Outro Generation Failed", description: err.message, variant: "destructive" });
      return null;
    } finally {
      setIsGeneratingOutro(false);
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

      const videoUrls = sortedVideos.map(v => v.videoUrl);
      
      // Determine which clips have embedded audio (Sora-2, VEO3)
      const embeddedAudioIndices: number[] = [];
      const audioUrlsForStitch: string[] = [];
      
      sortedVideos.forEach((v, idx) => {
        const hasAudio = sortedAudios.find(a => a.sceneNumber === v.sceneNumber && a.audioUrl?.trim());
        if (!hasAudio) {
          // No separate TTS → this clip has embedded audio (Sora-2/VEO3)
          embeddedAudioIndices.push(idx);
        }
      });
      
      // Only include overlay audio for scenes that DON'T have embedded audio
      sortedAudios.forEach(a => {
        if (a.audioUrl?.trim()) {
          const videoIdx = sortedVideos.findIndex(v => v.sceneNumber === a.sceneNumber);
          if (!embeddedAudioIndices.includes(videoIdx)) {
            audioUrlsForStitch.push(a.storageUrl || a.audioUrl);
          }
        }
      });

      console.log(`[ManualStitch] ${videoUrls.length} videos, ${embeddedAudioIndices.length} with embedded audio, ${audioUrlsForStitch.length} overlay audio tracks`);

      setProgressStatus('Stitching video clips...');
      setProgress(40);

      let stitchedBlob: Blob;
      const allPublicUrls = videoUrls.every(u => u.startsWith('http'));
      const sizeMap: Record<string, [number, number]> = { '9:16': [1080, 1920], '1:1': [1080, 1080], '16:9': [1920, 1080], '4:5': [1080, 1350] };
      const [sw, sh] = sizeMap[selectedVideoSize] || [1080, 1920];

      // Try cloud stitching first (Creatomate), fall back to canvas
      if (allPublicUrls) {
        try {
          setProgressStatus('Cloud rendering...');
          
          let mergedAudioUrl: string | undefined;
          if (audioUrlsForStitch.length === 1) {
            mergedAudioUrl = audioUrlsForStitch[0];
          } else if (audioUrlsForStitch.length > 1) {
            try {
              const mergeResponse = await supabase.functions.invoke('merge-audio', {
                body: { audioUrls: audioUrlsForStitch }
              });
              if (mergeResponse.data?.audioUrl) mergedAudioUrl = mergeResponse.data.audioUrl;
            } catch (e) {
              console.log('Audio merge failed, using first audio');
              mergedAudioUrl = audioUrlsForStitch[0];
            }
          }
          
          const clips = sortedVideos.map((v, idx) => {
            const scene = project.scenes?.find(s => s.sceneNumber === v.sceneNumber);
            const audio = sortedAudios.find(a => a.sceneNumber === v.sceneNumber);
            return {
              url: v.videoUrl,
              duration: scene?.duration || 5,
              audioDuration: audio?.duration || scene?.duration || 5,
              caption: captionSettings.enabled && scene?.narration ? scene.narration : undefined
            };
          });
          const sizeMap2: Record<string, [number, number]> = { '9:16': [1080, 1920], '1:1': [1080, 1080], '16:9': [1920, 1080], '4:5': [1080, 1350] };
          const [cw, ch] = sizeMap2[selectedVideoSize] || [1080, 1920];
          const { data: stitchData, error: stitchError } = await supabase.functions.invoke('creatomate-stitch', {
            body: {
              clips,
              audioUrl: mergedAudioUrl,
              backgroundMusicUrl: backgroundMusicUrl || undefined,
              backgroundMusicVolume: 25,
              transition: transitionStyle,
              captionStyle: captionSettings.position || 'bottom',
              width: cw,
              height: ch,
              captionFont: captionSettings.fontFamily || 'Montserrat',
              captionFontSize: captionSettings.fontSize || 'medium',
              captionFontColor: captionSettings.fontColor || '#ffffff',
              captionBackground: captionSettings.background || 'glass',
              captionAnimation: captionSettings.style || 'karaoke',
              logoUrl: selectedLogoUrl || undefined,
              logoAnimation: selectedLogoUrl ? selectedLogoAnimation : undefined,
              introImageUrl: selectedThumbnailUrl || undefined,
              introImageDuration: 3,
            }
          });
          if (stitchError || !stitchData?.success || !stitchData?.renderId) throw new Error(stitchData?.error || 'Cloud stitch failed');

          let cloudUrl: string | null = null;
          for (let attempt = 0; attempt < 60; attempt++) {
            await new Promise(r => setTimeout(r, 3000));
            const { data: status } = await supabase.functions.invoke('creatomate-status', {
              body: { renderId: stitchData.renderId }
            });
            if (status?.status === 'succeeded' && status?.url) { cloudUrl = status.url; break; }
            if (status?.status === 'failed') throw new Error('Cloud render failed');
            setProgress(40 + Math.min(50, (attempt / 60) * 50));
            setProgressStatus(`Rendering... ${status?.progress ? Math.round(status.progress) + '%' : ''}`);
          }
          if (!cloudUrl) throw new Error('Cloud render timed out');

          const resp = await fetch(cloudUrl);
          stitchedBlob = await resp.blob();
        } catch (cloudErr) {
          console.warn('Cloud stitch failed, falling back to canvas:', cloudErr);
          setProgressStatus('Falling back to local stitching...');
          stitchedBlob = await canvasStitchVideos({
            videoUrls,
            audioUrls: audioUrlsForStitch.length > 0 ? audioUrlsForStitch : undefined,
            embeddedAudioIndices: embeddedAudioIndices.length > 0 ? embeddedAudioIndices : undefined,
            backgroundMusicUrl: backgroundMusicUrl || undefined,
            backgroundMusicVolume: 20,
            width: sw, height: sh,
            onProgress: (percent) => {
              setProgress(40 + percent * 0.5);
              setProgressStatus(`Stitching... ${Math.round(percent)}%`);
            },
            onStatus: (s) => setProgressStatus(s)
          });
        }
      } else {
        stitchedBlob = await canvasStitchVideos({
          videoUrls,
          audioUrls: audioUrlsForStitch.length > 0 ? audioUrlsForStitch : undefined,
          embeddedAudioIndices: embeddedAudioIndices.length > 0 ? embeddedAudioIndices : undefined,
          backgroundMusicUrl: backgroundMusicUrl || undefined,
          backgroundMusicVolume: 20,
          width: sw, height: sh,
          onProgress: (percent) => {
            setProgress(40 + percent * 0.5);
            setProgressStatus(`Stitching... ${Math.round(percent)}%`);
          },
          onStatus: (s) => setProgressStatus(s)
        });
      }

      videoBlobRef.current = stitchedBlob;
      const blobUrl = URL.createObjectURL(stitchedBlob);
      let savedVideoUrl = blobUrl;
      
      if (user) {
        try {
          const isWebm = stitchedBlob.type.includes('webm');
          const ext = isWebm ? 'webm' : 'mp4';
          const fileName = `${user.id}/videos/${Date.now()}-stitched.${ext}`;
          const { data: uploadData, error: uploadError } = await supabase.storage
            .from('reels')
            .upload(fileName, stitchedBlob, { contentType: stitchedBlob.type || 'video/webm' });
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

      setProject(prev => ({ ...prev, videoBlobUrl: savedVideoUrl, status: 'complete' }));
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

  // Post-production: generate and append a B-roll clip
  const appendBrollClip = async () => {
    if (!appendBrollPrompt.trim()) {
      toast({ title: "Enter a prompt", description: "Describe the B-roll scene you want to add.", variant: "destructive" });
      return;
    }

    setIsAppendingBroll(true);
    try {
      // Use a reference image from existing scenes if available
      const refImage = project.generatedScenes[0]?.imageUrl || null;
      
      const { data, error } = await supabase.functions.invoke('wavespeed-video', {
        body: {
          action: 'create',
          prompt: appendBrollPrompt,
          imageUrls: refImage ? [refImage] : undefined,
          model: appendBrollModel,
          aspectRatio: selectedVideoSize === '16:9' ? '16:9' : '9:16',
          duration: appendBrollModel === 'wan-2.6-i2v' ? appendBrollDuration : undefined,
          userId: user?.id,
          source: 'reel',
        }
      });

      if (error || !data?.taskId) throw new Error(data?.error || 'Failed to start B-roll generation');

      toast({ title: "Generating B-Roll", description: "Your clip is being created..." });

      // Poll for completion
      const taskId = data.taskId;
      const maxTime = 300_000;
      const start = Date.now();
      while (Date.now() - start < maxTime) {
        await new Promise(r => setTimeout(r, 3000));
        const { data: status } = await supabase.functions.invoke('wavespeed-video', {
          body: { action: 'status', taskId }
        });
        if (status?.status === 'completed' && status?.videoUrl) {
          setAppendedClips(prev => [...prev, { videoUrl: status.videoUrl, prompt: appendBrollPrompt, duration: appendBrollDuration }]);
          setAppendBrollPrompt('');
          toast({ title: "B-Roll Ready!", description: "Clip added. Re-stitch when ready." });
          break;
        }
        if (status?.status === 'failed') throw new Error(status?.error || 'B-roll generation failed');
      }
    } catch (err: any) {
      console.error('Append B-roll error:', err);
      toast({ title: "B-Roll Failed", description: err.message, variant: "destructive" });
    } finally {
      setIsAppendingBroll(false);
    }
  };

  // Re-stitch: combine original video with appended B-roll clips
  const restitchWithAppendedClips = async () => {
    if (appendedClips.length === 0) {
      toast({ title: "No clips to add", description: "Generate at least one B-roll clip first.", variant: "destructive" });
      return;
    }

    setIsRestitching(true);
    setProgress(5);
    setProgressStatus('Preparing to re-stitch...');

    try {
      // Gather all video URLs: original scenes + appended clips
      const originalClipUrls = project.generatedScenes
        .sort((a, b) => a.sceneNumber - b.sceneNumber)
        .map(s => {
          const clip = project.videoClips.find(v => v.sceneNumber === s.sceneNumber);
          return clip?.videoUrl || s.videoUrl;
        })
        .filter(Boolean) as string[];

      // If we have a single stitched video, use that as the base
      const baseUrls = originalClipUrls.length > 0 ? originalClipUrls : (project.videoBlobUrl ? [project.videoBlobUrl] : []);
      const appendedUrls = appendedClips.map(c => c.videoUrl);
      const allUrls = [...baseUrls, ...appendedUrls];

      if (allUrls.length < 2) {
        toast({ title: "Not enough clips", description: "Need at least 2 clips to stitch.", variant: "destructive" });
        return;
      }

      setProgress(20);
      setProgressStatus('Stitching clips together...');

      const allPublic = allUrls.every(u => u.startsWith('http'));
      let stitchedBlob: Blob;

      if (allPublic) {
        try {
          const clips = allUrls.map((url, idx) => {
            const scene = project.scenes?.[idx];
            return { url, duration: scene?.duration || 5, audioDuration: scene?.duration || 5 };
          });
          const sizeMap3: Record<string, [number, number]> = { '9:16': [1080, 1920], '1:1': [1080, 1080], '16:9': [1920, 1080], '4:5': [1080, 1350] };
          const [rw, rh] = sizeMap3[selectedVideoSize] || [1080, 1920];
          const { data: stitchData, error: stitchError } = await supabase.functions.invoke('creatomate-stitch', {
            body: { clips, transition: transitionStyle || 'crossfade', width: rw, height: rh, logoUrl: selectedLogoUrl || undefined, logoAnimation: selectedLogoUrl ? selectedLogoAnimation : undefined, backgroundMusicUrl: backgroundMusicUrl || undefined, backgroundMusicVolume: 25 }
          });
          if (stitchError || !stitchData?.success || !stitchData?.renderId) throw new Error('Cloud stitch failed');

          let cloudUrl: string | null = null;
          for (let attempt = 0; attempt < 60; attempt++) {
            await new Promise(r => setTimeout(r, 3000));
            const { data: status } = await supabase.functions.invoke('creatomate-status', {
              body: { renderId: stitchData.renderId }
            });
            if (status?.status === 'succeeded' && status?.url) { cloudUrl = status.url; break; }
            if (status?.status === 'failed') throw new Error('Cloud render failed');
            setProgress(20 + Math.min(70, (attempt / 60) * 70));
          }
          if (!cloudUrl) throw new Error('Cloud render timed out');
          const resp = await fetch(cloudUrl);
          stitchedBlob = await resp.blob();
        } catch (cloudErr: any) {
          const errMsg = cloudErr?.message || String(cloudErr);
          const isCreditsError = /credit|402|insufficient/i.test(errMsg);
          
          if (isCreditsError) {
            console.warn('[Restitch] Cloud rendering credits exhausted');
            toast({ title: "Cloud Rendering Unavailable", description: "Cloud rendering credits are exhausted. Keeping original video — B-roll clips are saved as separate scenes.", variant: "destructive" });
            // Fallback: keep original video, save appended clips as extra scenes
            const newScenes = appendedClips.map((clip, idx) => ({
              sceneNumber: (project.generatedScenes?.length || 0) + idx + 1,
              prompt: clip.prompt || 'B-roll',
              text: clip.prompt || 'B-roll',
              imageUrl: '',
              videoUrl: clip.videoUrl,
              startTime: 0,
              endTime: 5,
            }));
            setProject(prev => ({
              ...prev,
              generatedScenes: [...(prev.generatedScenes || []), ...newScenes],
              videoClips: [...(prev.videoClips || []), ...newScenes.map(s => ({ sceneNumber: s.sceneNumber, videoUrl: s.videoUrl }))],
            }));
            setAppendedClips([]);
            setShowAppendBroll(false);
            setProgress(100);
            return;
          }

          // Try canvas fallback for non-credit errors
          console.warn('Cloud re-stitch failed, trying canvas:', cloudErr);
          try {
            const sizeMap: Record<string, [number, number]> = { '9:16': [1080, 1920], '1:1': [1080, 1080], '16:9': [1920, 1080], '4:5': [1080, 1350] };
            const [sw, sh] = sizeMap[selectedVideoSize] || [1080, 1920];
            stitchedBlob = await canvasStitchVideos({ videoUrls: allUrls, width: sw, height: sh, onProgress: (p) => setProgress(20 + p * 0.7) });
          } catch (canvasErr) {
            console.warn('Canvas stitch also failed:', canvasErr);
            toast({ title: "Stitching Unavailable", description: "Could not combine clips. Keeping original video — B-roll clips saved as separate scenes.", variant: "destructive" });
            const newScenes = appendedClips.map((clip, idx) => ({
              sceneNumber: (project.generatedScenes?.length || 0) + idx + 1,
              prompt: clip.prompt || 'B-roll',
              text: clip.prompt || 'B-roll',
              imageUrl: '',
              videoUrl: clip.videoUrl,
              startTime: 0,
              endTime: 5,
            }));
            setProject(prev => ({
              ...prev,
              generatedScenes: [...(prev.generatedScenes || []), ...newScenes],
              videoClips: [...(prev.videoClips || []), ...newScenes.map(s => ({ sceneNumber: s.sceneNumber, videoUrl: s.videoUrl }))],
            }));
            setAppendedClips([]);
            setShowAppendBroll(false);
            setProgress(100);
            return;
          }
        }
      } else {
        const sizeMap: Record<string, [number, number]> = { '9:16': [1080, 1920], '1:1': [1080, 1080], '16:9': [1920, 1080], '4:5': [1080, 1350] };
        const [sw, sh] = sizeMap[selectedVideoSize] || [1080, 1920];
        stitchedBlob = await canvasStitchVideos({ videoUrls: allUrls, width: sw, height: sh, onProgress: (p) => setProgress(20 + p * 0.7) });
      }

      // Upload and save
      const blobUrl = URL.createObjectURL(stitchedBlob);
      let savedUrl = blobUrl;
      if (user) {
        try {
          const ext = stitchedBlob.type.includes('webm') ? 'webm' : 'mp4';
          const fileName = `${user.id}/videos/${Date.now()}-restitched.${ext}`;
          const { data: uploadData, error: uploadError } = await supabase.storage
            .from('reels')
            .upload(fileName, stitchedBlob, { contentType: stitchedBlob.type || 'video/webm' });
          if (!uploadError && uploadData) {
            const { data: publicUrl } = supabase.storage.from('reels').getPublicUrl(fileName);
            savedUrl = publicUrl.publicUrl;
          }
        } catch (e) { console.error('Upload failed:', e); }
      }

      setProject(prev => ({ ...prev, videoBlobUrl: savedUrl, status: 'complete' }));
      setAppendedClips([]);
      setShowAppendBroll(false);
      toast({ title: "Re-stitched!", description: "Your updated reel is ready." });
      setProgress(100);
    } catch (err: any) {
      toast({ title: "Re-stitch Failed", description: err.message, variant: "destructive" });
    } finally {
      setIsRestitching(false);
    }
  };

  return (
    <Layout>
      <div className={`flex h-full ${isMobile ? '' : '-m-6'}`}>
        {/* Feature Sidebar - Hidden on Mobile and Beginner mode */}
        {!isMobile && isAdvanced && !sidebarsHiddenForTimeline && (
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
        <div className={`flex-1 overflow-auto transition-[padding] duration-200 ${isMobile ? 'p-0 pb-24' : 'p-6 pb-24'}`}>
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
                <TabsTrigger value="conversation" className="flex-1 sm:flex-none data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                  <MessageSquare className="w-4 h-4 mr-2" />
                  <span className="hidden sm:inline">Conversation</span>
                  <span className="sm:hidden">Convo</span>
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
                  <div className="space-y-3">
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
                    {isGenerating && (
                      <Button 
                        onClick={stopGeneration} 
                        variant="destructive" 
                        size="sm"
                        className="w-full"
                      >
                        <X className="w-4 h-4 mr-2" />Stop Generation
                      </Button>
                    )}
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

            {/* ===== QUICK MODE: One question, fully automated ===== */}
            {isQuick && !isGenerating && !project.videoBlobUrl && project.generatedScenes.length === 0 && (
              <Card className="border-primary/30 bg-gradient-to-br from-primary/5 via-transparent to-primary/5">
                <CardContent className="pt-10 pb-10 space-y-8">
                  <div className="text-center space-y-3 max-w-md mx-auto">
                    <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-2">
                      <Sparkles className="w-7 h-7 text-primary" />
                    </div>
                    <h2 className="text-2xl font-bold text-foreground">Quick Reel</h2>
                    <p className="text-muted-foreground text-sm">
                      Tell us your topic — we'll write the script, generate the voice, create visuals, and produce the video. All in one go.
                    </p>
                  </div>

                  <div className="max-w-lg mx-auto space-y-4">
                    <Textarea
                      placeholder="E.g., 5 morning habits of millionaires, Why most startups fail in year one, How to cook the perfect steak..."
                      value={topic}
                      onChange={(e) => setTopic(e.target.value)}
                      className="min-h-[100px] bg-background border-border resize-none text-base"
                    />

                    {topic.trim() && (
                      <div className="flex justify-end">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={enhancePrompt}
                          disabled={isEnhancingPrompt}
                          className="gap-1.5 text-xs border-primary/30 text-primary hover:bg-primary/10"
                        >
                          {isEnhancingPrompt ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wand2 className="w-3 h-3" />}
                          Enhance Prompt
                        </Button>
                      </div>
                    )}

                    {aiTwins.length > 0 && (
                      <div className="flex items-center gap-3 p-3 rounded-lg border border-border bg-muted/30">
                        {aiTwins[0].reference_images?.[0] && (
                          <img src={aiTwins[0].reference_images[0]} alt="" className="w-10 h-10 rounded-full object-cover border-2 border-primary/30" />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">Using: {aiTwins[0].name}</p>
                          <p className="text-[10px] text-muted-foreground">🎭 Lip sync + voice auto-selected</p>
                        </div>
                        <Badge variant="outline" className="text-[10px] bg-primary/10 text-primary border-primary/30 shrink-0">Auto</Badge>
                      </div>
                    )}

                    {/* Product Image (Quick Mode) */}
                    {timelineProductImages.length > 0 && (
                      <div className="space-y-2">
                        <Label className="text-xs flex items-center gap-1"><Package className="w-3 h-3 text-primary" /> Feature a Product (Optional)</Label>
                        <div className="flex gap-2 overflow-x-auto pb-1">
                          {selectedProductImageUrl && (
                            <div onClick={() => { setSelectedProductImageUrl(null); setSelectedProductName(null); }} className="cursor-pointer rounded-md border-2 border-dashed border-border hover:border-destructive/50 w-14 h-14 flex-shrink-0 flex items-center justify-center text-[9px] text-muted-foreground">
                              <X className="w-3 h-3" />
                            </div>
                          )}
                          {timelineProductImages.map(p => (
                            <div key={p.id} onClick={() => { setSelectedProductImageUrl(p.image_url); setSelectedProductName(p.name); }}
                              className={`cursor-pointer rounded-md border-2 overflow-hidden w-14 h-14 flex-shrink-0 transition-all ${selectedProductImageUrl === p.image_url ? 'border-primary ring-2 ring-primary/40' : 'border-border hover:border-primary/50'}`}>
                              <img src={p.image_url} alt={p.name || ''} className="w-full h-full object-cover" />
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="flex gap-3">
                      <Button
                        onClick={() => generateQuickModeTest(topic)}
                        disabled={!topic.trim()}
                        variant="outline"
                        className="flex-1 h-12 text-sm border-primary/30 text-primary hover:bg-primary/10"
                      >
                        <Play className="w-4 h-4 mr-1" />
                        Test 1 Scene
                      </Button>
                      <Button
                        onClick={() => generateQuickMode(topic)}
                        disabled={!topic.trim()}
                        className="flex-[2] bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 h-12 text-base"
                        size="lg"
                      >
                        <Sparkles className="w-5 h-5 mr-2" />
                        Make Full Reel ⚡
                      </Button>
                    </div>

                    <p className="text-center text-[10px] text-muted-foreground">
                      Test 1 Scene generates a single clip to preview quality. Make Full Reel produces all 4 scenes.
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Quick Mode: Generating State */}
            {isQuick && isGenerating && (
              <Card className="border-primary/30 bg-gradient-to-br from-primary/5 to-transparent">
                <CardContent className="pt-10 pb-10 space-y-6">
                  <div className="text-center space-y-3 max-w-md mx-auto">
                    <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto animate-pulse">
                      <Loader2 className="w-8 h-8 text-primary animate-spin" />
                    </div>
                    <h2 className="text-xl font-bold text-foreground">Creating Your Reel</h2>
                    <p className="text-muted-foreground text-sm">
                      {topic ? `"${topic.length > 60 ? topic.substring(0, 60) + '...' : topic}"` : 'Your reel is being produced...'}
                    </p>
                  </div>

                  <div className="max-w-sm mx-auto space-y-3">
                    <Progress value={progress} className="h-3" />
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>{progressStatus || 'Starting...'}</span>
                      <span>{Math.round(progress)}%</span>
                    </div>
                  </div>

                  <div className="flex flex-col items-center gap-2 mt-4">
                    {progress < 15 && <p className="text-xs text-muted-foreground">📝 Writing scripts...</p>}
                    {progress >= 15 && progress < 40 && <p className="text-xs text-muted-foreground">🎙️ Generating voiceovers...</p>}
                    {progress >= 40 && progress < 70 && <p className="text-xs text-muted-foreground">🎬 Creating video scenes...</p>}
                    {progress >= 70 && progress < 90 && <p className="text-xs text-muted-foreground">✂️ Stitching clips together...</p>}
                    {progress >= 90 && <p className="text-xs text-muted-foreground">✨ Almost done...</p>}
                  </div>

                  <div className="flex justify-center">
                    <Button variant="outline" size="sm" onClick={stopGeneration}>
                      <X className="w-3 h-3 mr-1" />
                      Cancel
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Quick Mode: Results — show generated scenes, voices, video */}
            {isQuick && !isGenerating && (project.videoBlobUrl || project.generatedScenes.length > 0) && (
              <Card className="border-primary/30">
                <CardContent className="pt-6 pb-6 space-y-6">
                  <div className="text-center space-y-1">
                    <h2 className="text-xl font-bold text-foreground">
                      {project.videoBlobUrl ? '🎬 Your Reel is Ready' : '🎬 Scenes Generated'}
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      {project.videoBlobUrl 
                        ? 'Review the scripts and voices below, or download your video.'
                        : project.videoClips.length > 0 
                          ? `${project.videoClips.length} video clips generated. Stitch them into a final reel.`
                          : 'Scripts are ready. Generate your video below.'}
                    </p>
                  </div>

                  {/* Final Stitched Video Player */}
                  {project.videoBlobUrl && (
                    <div className="max-w-sm mx-auto">
                      <div className="rounded-xl overflow-hidden bg-black shadow-lg">
                        <video
                          src={project.videoBlobUrl}
                          controls
                          className="w-full aspect-[9/16]"
                        />
                      </div>
                    </div>
                  )}

                  {/* Scene Timeline with Edit/Swap/B-Roll (Quick Mode) */}
                  {!project.videoBlobUrl && project.generatedScenes.length > 0 && (
                    <div className="space-y-3">
                      <ReelSceneTimeline
                        scenes={project.generatedScenes}
                        videoClips={project.videoClips}
                        voiceovers={project.voiceovers}
                        productImages={timelineProductImages}
                        selectedTwin={selectedTwinId ? aiTwins.find(t => t.id === selectedTwinId) || null : null}
                        portraitImage={portraitImage}
                        onScenesChange={(newScenes, newClips, newVos) => {
                          setProject(prev => ({
                            ...prev,
                            generatedScenes: newScenes,
                            videoClips: newClips,
                            voiceovers: newVos
                          }));
                        }}
                        onEditScene={(sceneNumber, text) => {
                          setEditingSceneNumber(sceneNumber);
                          setEditSceneText(text);
                        }}
                      />
                    </div>
                  )}

                  {/* Scene Scripts & Voices */}
                  <Collapsible>
                    <CollapsibleTrigger className="flex items-center justify-between w-full p-3 rounded-lg border border-border bg-muted/30 hover:bg-muted/50 transition-colors">
                      <span className="text-sm font-medium text-foreground flex items-center gap-2">
                        <FileText className="w-4 h-4" />
                        Scripts & Voices ({project.scenes.length} scenes)
                      </span>
                      <ChevronDown className="w-4 h-4 text-muted-foreground" />
                    </CollapsibleTrigger>
                    <CollapsibleContent className="mt-3 space-y-3">
                      {project.scenes.map((scene, idx) => (
                        <div key={idx} className="p-3 rounded-lg border border-border bg-background space-y-2">
                          <div className="flex items-center justify-between">
                            <Badge variant="outline" className="text-[10px]">Scene {scene.sceneNumber}</Badge>
                            <span className="text-[10px] text-muted-foreground">{scene.duration}s</span>
                          </div>
                          <p className="text-xs text-foreground leading-relaxed">{scene.narration}</p>
                          {project.voiceovers[idx]?.audioUrl && (
                            <audio controls src={project.voiceovers[idx].audioUrl} className="w-full h-8" />
                          )}
                        </div>
                      ))}
                    </CollapsibleContent>
                  </Collapsible>

                  {/* Action Buttons */}
                  <div className="flex flex-wrap justify-center gap-3">
                    {project.videoBlobUrl && (
                      <Button onClick={handleDownloadVideo} className="bg-gradient-primary hover:opacity-90">
                        <Download className="w-4 h-4 mr-2" />
                        Download
                      </Button>
                    )}
                    {project.videoBlobUrl && project.generatedScenes.length > 0 && (
                      <Button
                        variant="outline"
                        className="border-primary/50 text-primary hover:bg-primary/10"
                        onClick={() => {
                          setCreatorMode('advanced');
                          setTimelineViewActive(true);
                          setSidebarsHiddenForTimeline(true);
                          setSidebarCollapsed(true);
                        }}
                      >
                        <Film className="w-4 h-4 mr-2" />
                        Edit in Timeline
                      </Button>
                    )}
                    {!project.videoBlobUrl && project.videoClips.length > 1 && (
                      <Button onClick={stitchVideos} disabled={isManualStitching} className="bg-gradient-primary hover:opacity-90">
                        {isManualStitching ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Layers className="w-4 h-4 mr-2" />}
                        Stitch All Clips
                      </Button>
                    )}
                    {!project.videoBlobUrl && project.videoClips.length === 0 && project.scenes.length > 0 && (
                      <Button 
                        onClick={() => generateVideo({ forceEnableLipSync: enableLipSync, forceLipSyncModel: 'infinitetalk', scenesOverride: project.scenes })}
                        className="bg-gradient-primary hover:opacity-90"
                      >
                        <Video className="w-4 h-4 mr-2" />
                        Generate Video
                      </Button>
                    )}
                    {!currentReelSaved && (project.generatedScenes.length > 0 || project.videoBlobUrl) && (
                      <Button onClick={saveToMyReels} disabled={isSavingReel} variant="secondary">
                        {isSavingReel ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <FolderOpen className="w-4 h-4 mr-2" />}
                        Save to My Reels
                      </Button>
                    )}
                    <Button onClick={resetProject} variant="outline">
                      <RefreshCw className="w-4 h-4 mr-2" />
                      Create Another
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* ===== BEGINNER MODE: Step-based flow ===== */}
            {isBeginner && (
              <Card className="border-primary/30 bg-gradient-to-br from-primary/5 to-transparent">
                <CardContent className="pt-8 pb-8 space-y-6">
                  {/* Step indicator */}
                  <div className="flex items-center justify-center gap-2 mb-2">
                    {[1, 2, 3].map(step => (
                      <div key={step} className="flex items-center gap-1">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
                          beginnerStep === step ? 'bg-primary text-primary-foreground scale-110' :
                          beginnerStep > step ? 'bg-primary/30 text-primary' : 'bg-muted text-muted-foreground'
                        }`}>
                          {beginnerStep > step ? '✓' : step}
                        </div>
                        {step < 3 && <div className={`w-6 h-0.5 ${beginnerStep > step ? 'bg-primary/50' : 'bg-muted'}`} />}
                      </div>
                    ))}
                  </div>

                  {/* ===== STEP 1: Topic & Hook ===== */}
                  {beginnerStep === 1 && (
                    <>
                      <div className="text-center space-y-2">
                        <h2 className="text-2xl font-bold text-foreground">What's your reel about?</h2>
                        <p className="text-muted-foreground">Enter your topic and we'll build the script for you.</p>
                      </div>

                      <Textarea
                        placeholder="E.g., 5 productivity tips for remote workers, How to make the perfect coffee..."
                        value={topic}
                        onChange={(e) => setTopic(e.target.value)}
                        className="min-h-[100px] bg-background border-border resize-none text-base"
                        disabled={isGenerating}
                      />

                      {topic.trim() && (
                        <div className="flex justify-end">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={enhancePrompt}
                            disabled={isEnhancingPrompt || isGenerating}
                            className="gap-1.5 text-xs border-primary/30 text-primary hover:bg-primary/10"
                          >
                            {isEnhancingPrompt ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wand2 className="w-3 h-3" />}
                            Enhance Prompt
                          </Button>
                        </div>
                      )}

                      <div className="space-y-2">
                        <Label className="text-sm text-muted-foreground">Hook Style (First Scene)</Label>
                        <div className="flex gap-2">
                          <Select value={hookStyle} onValueChange={(v) => { setHookStyle(v); setSelectedHook(null); }} disabled={isGenerating}>
                            <SelectTrigger className="bg-background flex-1">
                              <SelectValue placeholder="Choose a hook style" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="auto">🤖 Auto (AI picks best)</SelectItem>
                              <SelectItem value="question">❓ Question Hook</SelectItem>
                              <SelectItem value="bold_claim">💥 Bold Claim</SelectItem>
                              <SelectItem value="story">📖 Story / Personal</SelectItem>
                              <SelectItem value="statistic">📊 Shocking Statistic</SelectItem>
                              <SelectItem value="myth_buster">🔥 Myth Buster</SelectItem>
                              <SelectItem value="challenge">🎯 Challenge / Dare</SelectItem>
                              <SelectItem value="fomo">⏰ FOMO / Urgency</SelectItem>
                              <SelectItem value="curiosity_gap">🧠 Curiosity Gap</SelectItem>
                              <SelectItem value="contrarian">🔄 Contrarian Take</SelectItem>
                            </SelectContent>
                          </Select>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={generateHookOptions}
                            disabled={isGeneratingHooks || !topic.trim()}
                            className="h-10 px-3 whitespace-nowrap"
                          >
                            {isGeneratingHooks ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                            <span className="ml-1.5 text-xs">Generate Hooks</span>
                          </Button>
                        </div>
                      </div>

                      {/* Hook Selector Panel */}
                      {showHookSelector && (
                        <div className="space-y-2 p-3 rounded-lg border border-primary/20 bg-primary/5">
                          <div className="flex items-center justify-between">
                            <Label className="text-sm font-medium text-foreground">🎯 Choose Your Hook</Label>
                            <div className="flex gap-1">
                              <Button variant="ghost" size="sm" className="h-6 text-[10px]" onClick={regenerateHooks} disabled={isGeneratingHooks}>
                                <RefreshCw className={cn("w-3 h-3 mr-1", isGeneratingHooks && "animate-spin")} /> Regenerate
                              </Button>
                              <Button variant="ghost" size="sm" className="h-6 text-[10px]" onClick={() => { setShowHookSelector(false); setSelectedHook(null); }}>
                                ✕
                              </Button>
                            </div>
                          </div>
                          {isGeneratingHooks ? (
                            <div className="flex items-center justify-center py-6">
                              <Loader2 className="w-5 h-5 animate-spin text-primary mr-2" />
                              <span className="text-sm text-muted-foreground">Generating hook options...</span>
                            </div>
                          ) : generatedHooks.length > 0 ? (
                            <div className="space-y-2 max-h-[300px] overflow-y-auto">
                              {generatedHooks.map((hook: any, idx: number) => (
                                <div
                                  key={idx}
                                  className={cn(
                                    "p-2.5 rounded-lg border cursor-pointer transition-all",
                                    selectedHook?.hookText === hook.hookText
                                      ? "border-primary bg-primary/10 ring-1 ring-primary/30"
                                      : "border-border hover:border-primary/40 hover:bg-accent/30"
                                  )}
                                  onClick={() => setSelectedHook(hook)}
                                >
                                  <div className="flex items-start justify-between gap-2">
                                    <div className="flex-1 min-w-0">
                                      <p className="text-sm font-medium text-foreground leading-snug">"{hook.hookText}"</p>
                                      <div className="flex items-center gap-2 mt-1">
                                        <Badge variant="secondary" className="text-[9px] h-4">{hook.hookType}</Badge>
                                        <span className="text-[10px] text-muted-foreground">Score: {hook.strengthScore}/10</span>
                                      </div>
                                      <p className="text-[10px] text-muted-foreground mt-1 line-clamp-2">{hook.whyItWorks}</p>
                                      {hook.visualDirection && (
                                        <p className="text-[10px] text-muted-foreground/70 mt-0.5 italic line-clamp-1">
                                          📹 {hook.visualDirection.action}
                                        </p>
                                      )}
                                    </div>
                                    {selectedHook?.hookText === hook.hookText && (
                                      <Badge className="bg-primary text-primary-foreground text-[9px] h-4 shrink-0">Selected</Badge>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-xs text-muted-foreground text-center py-3">Click "Generate Hooks" to see options</p>
                          )}
                          {selectedHook && (
                            <p className="text-[10px] text-primary text-center mt-1">
                              ✓ Hook selected — script will be built around this hook
                            </p>
                          )}
                        </div>
                      )}

                      {/* Cut Scenes Toggle */}
                      <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/30">
                        <div>
                          <p className="text-sm font-medium text-foreground">🎞️ Auto Cut Scenes</p>
                          <p className="text-[10px] text-muted-foreground">Add dynamic B-roll cuts between narration</p>
                        </div>
                        <Switch
                          checked={enableCutScenes}
                          onCheckedChange={(checked) => {
                            setEnableCutScenes(checked);
                            setFeatureToggles(prev => ({ ...prev, cutScenes: checked }));
                          }}
                          disabled={isGenerating}
                        />
                      </div>

                      <Button
                        onClick={async () => {
                          const scenes = await generateScripts();
                          if (scenes && scenes.length > 0) {
                            setBeginnerStep(2);
                          }
                        }}
                        disabled={isGenerating || !topic.trim()}
                        className="w-full bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70"
                        size="lg"
                      >
                        {isGenerating ? (
                          <><Loader2 className="w-5 h-5 mr-2 animate-spin" />Building your script...</>
                        ) : (
                          <><FileText className="w-5 h-5 mr-2" />Generate Script ✨</>
                        )}
                      </Button>
                    </>
                  )}

                  {/* ===== STEP 2: Script Review ===== */}
                  {beginnerStep === 2 && project.scenes.length > 0 && (
                    <>
                      <div className="text-center space-y-2">
                        <h2 className="text-2xl font-bold text-foreground">Review Your Script</h2>
                        <p className="text-muted-foreground">
                          {project.scenes.length} scenes • {project.scenes.reduce((acc, s) => acc + (s.duration || 0), 0)}s total duration
                        </p>
                      </div>

                      <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
                        {project.scenes.map((scene, idx) => (
                          <div key={idx} className="p-3 rounded-lg border border-border bg-background space-y-2">
                            <div className="flex items-center justify-between">
                              <Badge variant="outline" className="text-[10px]">
                                {(scene as any).isIntro ? '🎬 Intro' : (scene as any).isOutro ? '📢 Outro' : (scene as any).isCutScene ? '🎞️ Cut' : `Scene ${scene.sceneNumber}`}
                              </Badge>
                              <span className="text-[10px] text-muted-foreground">{scene.duration}s</span>
                            </div>
                            {scene.narration ? (
                              <Textarea
                                value={scene.narration}
                                onChange={(e) => {
                                  const newNarration = e.target.value;
                                  setProject(prev => ({
                                    ...prev,
                                    scenes: prev.scenes.map((s, i) => i === idx ? { ...s, narration: newNarration } : s)
                                  }));
                                }}
                                className="text-sm bg-muted/30 border-0 resize-none min-h-[60px]"
                                rows={2}
                              />
                            ) : (
                              <p className="text-xs text-muted-foreground italic">Silent scene</p>
                            )}
                            <p className="text-[10px] text-muted-foreground line-clamp-1">📷 {(scene as any).visualDescription?.substring(0, 80)}...</p>
                          </div>
                        ))}
                      </div>

                      {/* Voice Selection & Preview */}
                      <div className="space-y-3">
                        <VoiceSelector
                          selectedVoice={selectedVoice}
                          onVoiceSelect={setSelectedVoice}
                          compact
                          characterDescription={characterDescription}
                          characterGender={detectedCharGender}
                        />
                        <div className="p-3 rounded-lg border border-border bg-muted/30 space-y-2">
                          <VoicePitchSlider pitch={voicePitch} onPitchChange={setVoicePitch} disabled={isGenerating} />
                          {videoModel === 'sora-2' ? (
                            <p className="text-xs text-muted-foreground">
                              Sora-2 generates the voice inside the video itself, so there is no separate voice preview here.
                            </p>
                          ) : (
                            <Button
                              variant="outline"
                              size="sm"
                              className="w-full"
                              onClick={previewVoice}
                              disabled={isGenerating || isPreviewingVoice}
                            >
                              {isPreviewingVoice ? (
                                <><Loader2 className="w-3 h-3 mr-1 animate-spin" />Playing...</>
                              ) : (
                                <><Play className="w-3 h-3 mr-1" />Preview Voice</>
                              )}
                            </Button>
                          )}
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          onClick={() => setBeginnerStep(1)}
                          className="flex-1"
                        >
                          ← Back
                        </Button>
                        <Button
                          variant="outline"
                          onClick={async () => {
                            const scenes = await generateScripts();
                            if (scenes && scenes.length > 0) {
                              toast({ title: "Script Regenerated", description: "New script created. Review and continue." });
                            }
                          }}
                          disabled={isGenerating}
                          className="flex-1"
                        >
                          {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-1" />}
                          Regenerate
                        </Button>
                        <Button
                          onClick={() => {
                            setBeginnerStep(3);
                            // Auto-generate character if none exists
                            if (!portraitImage && !selectedTwinId && topic.trim()) {
                              setTimeout(() => generateCharacter(), 300);
                            }
                          }}
                          className="flex-[2] bg-gradient-to-r from-primary to-primary/80"
                        >
                          Looks Good, Continue →
                        </Button>
                      </div>
                    </>
                  )}

                  {/* ===== STEP 3: Character ===== */}
                  {beginnerStep === 3 && (
                    <>
                      <div className="text-center space-y-2">
                        <h2 className="text-2xl font-bold text-foreground">Choose Your Character</h2>
                        <p className="text-muted-foreground">Generate a character or leave blank to skip.</p>
                      </div>

                      <div className="space-y-3 p-4 rounded-lg border border-border bg-muted/30">
                        {portraitPreview ? (
                          <div className="space-y-3">
                            <div className="flex items-center gap-3">
                              <img src={portraitPreview} alt="Character" className="w-16 h-16 rounded-lg object-cover border border-border" />
                              <div className="flex-1">
                                <p className="text-sm text-foreground font-medium">Character ready! ✨</p>
                                <p className="text-xs text-muted-foreground">{characterDescription || 'Custom character'}</p>
                                {selectedTwinId && <p className="text-[10px] text-primary">Saved to AI Twins</p>}
                              </div>
                              <Button variant="ghost" size="sm" onClick={() => { setPortraitImage(null); setPortraitPreview(null); setPreSelectedReference(null); setCharacterDescription(''); setSelectedTwinId(null); setGeneratedCharacterShots([]); }}>
                                <X className="w-4 h-4" />
                              </Button>
                            </div>

                            {/* Show all generated angle shots */}
                            {generatedCharacterShots.length > 1 && (
                              <div className="space-y-2">
                                <Label className="text-xs text-muted-foreground">Select your preferred shot:</Label>
                                <div className="grid grid-cols-5 gap-1.5">
                                  {generatedCharacterShots.map((shot, idx) => (
                                    <div
                                      key={idx}
                                      onClick={() => {
                                        setSelectedShotIndex(idx);
                                        setPortraitImage(shot.url);
                                        setPortraitPreview(shot.url);
                                        setPreSelectedReference(shot.url);
                                      }}
                                      className={`cursor-pointer rounded-md overflow-hidden border-2 transition-all ${
                                        selectedShotIndex === idx
                                          ? 'border-primary ring-2 ring-primary/40'
                                          : 'border-border hover:border-primary/50'
                                      }`}
                                    >
                                      <img
                                        src={shot.url}
                                        alt={shot.label}
                                        className="w-full aspect-square object-cover"
                                      />
                                      <p className="text-[8px] text-center text-muted-foreground py-0.5 truncate px-0.5">{shot.label}</p>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Product swap for selected shot */}
                            {portraitPreview && (
                              <ProductSwapPanel
                                shotImageUrl={portraitPreview}
                                characterDescription={characterDescription}
                                onShotSwapped={(newUrl) => {
                                  setPortraitImage(newUrl);
                                  setPortraitPreview(newUrl);
                                  setPreSelectedReference(newUrl);
                                  setGeneratedCharacterShots(prev => prev.map((s, i) => i === selectedShotIndex ? { ...s, url: newUrl } : s));
                                }}
                                allShots={generatedCharacterShots}
                                currentShotIndex={selectedShotIndex}
                                onBatchSwapped={(updatedShots) => {
                                  setGeneratedCharacterShots(updatedShots);
                                  // Update portrait to the current shot's new URL
                                  const currentShot = updatedShots[selectedShotIndex];
                                  if (currentShot) {
                                    setPortraitImage(currentShot.url);
                                    setPortraitPreview(currentShot.url);
                                    setPreSelectedReference(currentShot.url);
                                  }
                                }}
                                disabled={isGenerating}
                                controlledProductUrl={swapPanelProductUrl}
                                controlledPrompt={swapPanelPrompt}
                                onProductChange={handleSwapProductChange}
                              />
                            )}


                            <Button
                              variant="outline"
                              size="sm"
                              className="w-full"
                              onClick={() => { setPortraitImage(null); setPortraitPreview(null); setPreSelectedReference(null); setSelectedTwinId(null); setGeneratedCharacterShots([]); generateCharacter(); }}
                              disabled={isGenerating || isGeneratingCharacter}
                            >
                              {isGeneratingCharacter ? (
                                <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Regenerating...</>
                              ) : (
                                <><RefreshCw className="w-4 h-4 mr-2" />Regenerate Character</>
                              )}
                            </Button>
                          </div>
                        ) : (
                          <div className="space-y-3">
                            {/* Existing AI Twins picker */}
                            {aiTwins.length > 0 && (
                              <div className="space-y-2">
                                <Label className="text-xs text-muted-foreground">Your AI Twins</Label>
                                <div className="grid grid-cols-3 gap-2 max-h-48 overflow-y-auto">
                                  {aiTwins.map(twin => {
                                    const thumbUrl = twin.reference_images?.[0];
                                    return (
                                      <div
                                        key={twin.id}
                                      onClick={async () => {
                                          if (isGenerating) return;
                                          setSelectedTwinId(twin.id);
                                          if (twin.reference_images?.[0]) {
                                            setPortraitImage(twin.reference_images[0]);
                                            setPortraitPreview(twin.reference_images[0]);
                                            setPreSelectedReference(twin.reference_images[0]);
                                            // Lazy-load all reference images for angle shots
                                            const fullImages = await loadTwinFullImages(twin.id);
                                            if (fullImages && fullImages.length > 0) {
                                              setGeneratedCharacterShots(
                                                fullImages.map((url: string, i: number) => ({ label: `Angle ${i + 1}`, url }))
                                              );
                                            } else {
                                              setGeneratedCharacterShots(
                                                twin.reference_images.map((url, i) => ({ label: `Angle ${i + 1}`, url }))
                                              );
                                            }
                                            setSelectedShotIndex(0);
                                          }
                                          if (twin.face_description) {
                                            setCharacterDescription(twin.face_description);
                                          }
                                          toast({ title: `"${twin.name}" selected ✨` });
                                        }}
                                        className="cursor-pointer rounded-lg border-2 border-border hover:border-primary/50 p-1.5 transition-all text-center bg-background"
                                      >
                                        {thumbUrl ? (
                                          <img src={thumbUrl} alt={twin.name} className="w-full aspect-square object-cover rounded-md mb-1" />
                                        ) : (
                                          <div className="w-full aspect-square rounded-md bg-muted flex items-center justify-center mb-1">
                                            <User className="w-5 h-5 text-muted-foreground" />
                                          </div>
                                        )}
                                        <p className="text-[9px] font-medium text-foreground truncate">{twin.name}</p>
                                        {twin.voice_cloning_key && (
                                          <Badge variant="outline" className="text-[8px] px-1 py-0 mt-0.5 bg-primary/10 text-primary border-primary/30">
                                            🎙️ Voice
                                          </Badge>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            )}

                            <div className="relative flex items-center">
                              <div className="flex-1 border-t border-border" />
                              <span className="px-3 text-[10px] text-muted-foreground">{aiTwins.length > 0 ? 'or generate new' : 'Generate a character'}</span>
                              <div className="flex-1 border-t border-border" />
                            </div>

                            <Input
                              placeholder="Describe your character or leave blank — AI will pick one from your topic"
                              value={generateCharacterPrompt}
                              onChange={(e) => setGenerateCharacterPrompt(e.target.value)}
                              disabled={isGenerating || isGeneratingCharacter}
                              className="bg-background"
                            />
                            <Button
                              variant="outline"
                              className="w-full"
                              onClick={generateCharacter}
                              disabled={isGenerating || isGeneratingCharacter || (!generateCharacterPrompt.trim() && !topic.trim())}
                            >
                              {isGeneratingCharacter ? (
                                <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Generating 5 shots...</>
                              ) : (
                                <><Wand2 className="w-4 h-4 mr-2" />Generate Character (5 Shots)</>
                              )}
                            </Button>

                            {/* Skeleton placeholders during generation */}
                            {isGeneratingCharacter && (
                              <div className="grid grid-cols-5 gap-1.5">
                                {[...Array(5)].map((_, i) => (
                                  <div key={i} className="space-y-1">
                                    <div className="aspect-square rounded-md bg-muted animate-pulse" />
                                    <div className="h-2 w-2/3 mx-auto rounded bg-muted animate-pulse" />
                                  </div>
                                ))}
                              </div>
                            )}

                            <p className="text-xs text-muted-foreground text-center">
                              {generateCharacterPrompt.trim() ? 'AI will create 5 angle shots and save as AI Twin' : 'Leave blank — AI will derive the character from your topic'}
                            </p>
                          </div>
                        )}
                      </div>

                      {/* Skip Character shortcut */}
                      {!portraitPreview && !isGeneratingCharacter && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="w-full text-muted-foreground hover:text-foreground"
                          onClick={generateAll}
                          disabled={isGenerating || !topic.trim()}
                        >
                          Skip Character → Make My Reel
                        </Button>
                      )}

                      {/* Voice Selection — character-driven */}
                      <div className="space-y-3 p-4 rounded-lg border border-border bg-muted/30">
                        <div className="flex items-center gap-2">
                          <Mic className="w-4 h-4 text-primary" />
                          <Label className="text-sm font-medium">Character Voice</Label>
                          <Badge variant="outline" className="text-[10px] bg-primary/10 text-primary border-primary/30">
                            {selectedVoice ? selectedVoice.replace(/_/g, ' ') : 'Not set'}
                          </Badge>
                        </div>
                        
                        <VoiceSelector
                          selectedVoice={selectedVoice}
                          onVoiceSelect={setSelectedVoice}
                          compact
                          characterDescription={characterDescription}
                          characterGender={detectedCharGender}
                        />
                        <VoicePitchSlider pitch={voicePitch} onPitchChange={setVoicePitch} disabled={isGenerating} />
                        
                        {selectedVoice && !selectedVoice.startsWith('clone:') && videoModel !== 'sora-2' && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="w-full"
                            onClick={previewVoice}
                            disabled={isGenerating}
                          >
                            {isPreviewingVoice ? (
                              <><MicOff className="w-3 h-3 mr-1" />Stop Preview</>
                            ) : (
                              <><Play className="w-3 h-3 mr-1" />Preview Voice</>
                            )}
                          </Button>
                        )}
                        {videoModel === 'sora-2' && (
                          <p className="text-xs text-muted-foreground">
                            Sora-2 voice is only created when the video is generated.
                          </p>
                        )}
                      </div>

                      {/* Summary */}
                      <div className="p-3 rounded-lg bg-muted/30 border border-border text-sm space-y-1">
                        <p className="text-muted-foreground">📝 <span className="text-foreground font-medium">{project.scenes.length} scenes</span> • {project.scenes.reduce((acc, s) => acc + (s.duration || 0), 0)}s total</p>
                        {portraitPreview && <p className="text-muted-foreground">👤 <span className="text-foreground font-medium">Character set</span></p>}
                        <p className="text-muted-foreground">🎙️ <span className="text-foreground font-medium">{selectedVoice ? selectedVoice.replace(/_/g, ' ') : 'Auto-detect voice'}</span></p>
                        <p className={`text-sm font-medium ${(portraitPreview || (aiTwins.length > 0)) ? 'text-primary' : 'text-destructive'}`}>
                          {(portraitPreview || (aiTwins.length > 0)) 
                            ? '🎭 Lip sync: ON — talking head scenes will be generated'
                            : '⚠️ Lip sync: OFF — no character selected. Videos will be B-roll only.'
                          }
                        </p>
                      </div>

                      <div className="flex gap-2">
                        <Button variant="outline" onClick={() => setBeginnerStep(2)} className="flex-1">
                          ← Back
                        </Button>
                        {isGenerating ? (
                          <Button 
                            onClick={stopGeneration} 
                            variant="destructive"
                            className="flex-[2]" 
                            size="lg"
                          >
                            <X className="w-5 h-5 mr-2" />Stop Generation
                          </Button>
                        ) : (
                          <Button 
                            onClick={generateAll} 
                            disabled={!topic.trim()} 
                            className="flex-[2] bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70" 
                            size="lg"
                          >
                            <Sparkles className="w-5 h-5 mr-2" />Make My Reel ✨
                          </Button>
                        )}
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            )}

            {/* ===== ADVANCED MODE: Tabbed layout ===== */}
            {isAdvanced && (
              <Card className="bg-card border-border">
                <Tabs defaultValue="settings" className="w-full">
                  <CardHeader className="pb-2">
                    <TabsList className="w-full grid grid-cols-4">
                      <TabsTrigger value="settings" className="text-xs gap-1"><Sparkles className="w-3 h-3" /> Settings</TabsTrigger>
                      <TabsTrigger value="script" className="text-xs gap-1" disabled={project.scenes.length === 0}><FileText className="w-3 h-3" /> Script</TabsTrigger>
                      <TabsTrigger value="character" className="text-xs gap-1"><User className="w-3 h-3" /> Character</TabsTrigger>
                      <TabsTrigger value="video" className="text-xs gap-1" disabled={project.scenes.length === 0}><Video className="w-3 h-3" /> Video</TabsTrigger>
                    </TabsList>
                  </CardHeader>

                  {/* ── SETTINGS TAB ── */}
                  <TabsContent value="settings">
                    <CardContent className="space-y-4 pt-2">
                      <TopicStrategist
                        onApplyStrategy={async (strategy) => {
                          setTopic(`${strategy.title}\n\nHook: ${strategy.hookText}`);
                          setSelectedSceneCount(strategy.sceneCount.toString());
                          setSelectedSceneDuration(Math.round(strategy.targetDuration / strategy.sceneCount).toString());
                          setHookStyle(strategy.hookStyle);
                          if (strategy.outroTemplate) setSelectedOutro(strategy.outroTemplate);
                          if (strategy.callToAction) { setOutroText(strategy.callToAction); setFeatureToggles(prev => ({ ...prev, introOutro: true })); setTemplateSectionOpen(true); }
                          toast({ title: "Idea Applied!", description: "Generating script..." });
                          setTimeout(async () => { await generateScripts(); }, 100);
                        }}
                        disabled={isGenerating}
                        initialState={strategistState}
                        onStateChange={setStrategistState}
                      />

                      <div className="space-y-2">
                        <Label htmlFor="topic">Topic / Idea</Label>
                        <div className="relative">
                          <Textarea id="topic" placeholder="E.g., 5 productivity tips for remote workers..." value={topic} onChange={(e) => setTopic(e.target.value)} className="min-h-[80px] bg-background border-border pr-12" disabled={isGenerating} />
                          <Button type="button" variant={isListening ? "destructive" : "secondary"} size="icon" className="absolute right-2 top-2" onClick={isListening ? stopListening : startListening} disabled={isGenerating}>
                            {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                          </Button>
                        </div>
                        {topic.trim() && (
                          <div className="flex justify-end">
                            <Button variant="outline" size="sm" onClick={enhancePrompt} disabled={isEnhancingPrompt || isGenerating} className="gap-1.5 text-xs border-primary/30 text-primary hover:bg-primary/10">
                              {isEnhancingPrompt ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wand2 className="w-3 h-3" />}
                              Enhance Prompt
                            </Button>
                          </div>
                        )}
                      </div>

                      {/* Podcast Mode */}
                      <div className="flex items-center justify-between p-2.5 bg-gradient-to-r from-purple-500/10 to-primary/10 rounded-lg border border-purple-500/20">
                        <div className="flex items-center gap-2">
                          <Mic className="w-4 h-4 text-purple-500" />
                          <div>
                            <p className="font-medium text-sm">Podcast Mode</p>
                            <p className="text-[10px] text-muted-foreground">Single character monologue</p>
                          </div>
                        </div>
                        <Switch checked={isPodcastMode} onCheckedChange={(checked) => { setIsPodcastMode(checked); if (checked) setEnableLipSync(true); }} disabled={isGenerating} />
                      </div>

                      {/* Compact Settings Grid */}
                      {isPodcastMode ? (
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <Label className="text-xs">Duration</Label>
                            <Select value={podcastDuration} onValueChange={setPodcastDuration} disabled={isGenerating}>
                              <SelectTrigger className="bg-background border-border h-9"><SelectValue /></SelectTrigger>
                              <SelectContent>{PODCAST_DURATION_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Character</Label>
                            <Select value={selectedCharacterId || ''} onValueChange={(v) => { setSelectedCharacterId(v || null); const char = characters.find(c => c.id === v); if (char?.reference_images?.[0]) { setPortraitImage(char.reference_images[0]); setPortraitPreview(char.reference_images[0]); analyzeReferenceImage(char.reference_images[0]); } }} disabled={isGenerating}>
                              <SelectTrigger className="bg-background border-border h-9"><SelectValue placeholder="Select..." /></SelectTrigger>
                              <SelectContent>{characters.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                            </Select>
                          </div>
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <Label className="text-xs">Scenes</Label>
                            <Select value={selectedSceneCount} onValueChange={setSelectedSceneCount} disabled={isGenerating}>
                              <SelectTrigger className="bg-background border-border h-9"><SelectValue /></SelectTrigger>
                              <SelectContent>{SCENE_COUNT_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Duration</Label>
                            <Select value={selectedSceneDuration} onValueChange={setSelectedSceneDuration} disabled={isGenerating}>
                              <SelectTrigger className="bg-background border-border h-9"><SelectValue /></SelectTrigger>
                              <SelectContent>{SCENE_DURATION_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Hook Style</Label>
                            <Select value={hookStyle} onValueChange={setHookStyle} disabled={isGenerating}>
                              <SelectTrigger className="bg-background border-border h-9"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="auto">Auto</SelectItem>
                                <SelectItem value="bold_claim">Bold Claim</SelectItem>
                                <SelectItem value="question">Question</SelectItem>
                                <SelectItem value="controversy">Controversy</SelectItem>
                                <SelectItem value="story">Story</SelectItem>
                                <SelectItem value="secret">Secret</SelectItem>
                                <SelectItem value="countdown">Countdown</SelectItem>
                                <SelectItem value="fomo">FOMO</SelectItem>
                                <SelectItem value="curiosity">Curiosity</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Transition</Label>
                            <Select value={transitionStyle} onValueChange={(v) => setTransitionStyle(v as typeof transitionStyle)} disabled={isGenerating}>
                              <SelectTrigger className="bg-background border-border h-9"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="crossfade">Crossfade</SelectItem>
                                <SelectItem value="fade">Fade</SelectItem>
                                <SelectItem value="slide">Slide</SelectItem>
                                <SelectItem value="zoom">Zoom</SelectItem>
                                <SelectItem value="wipe">Wipe</SelectItem>
                                <SelectItem value="blur">Blur</SelectItem>
                                <SelectItem value="dissolve">Dissolve</SelectItem>
                                <SelectItem value="spin">Spin</SelectItem>
                                <SelectItem value="flip">Flip</SelectItem>
                                <SelectItem value="none">None</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      )}

                      {/* Video Size as Select */}
                      <div className="space-y-1">
                        <Label className="text-xs flex items-center gap-1"><Video className="w-3 h-3 text-primary" /> Video Size</Label>
                        <Select value={selectedVideoSize} onValueChange={setSelectedVideoSize} disabled={isGenerating}>
                          <SelectTrigger className="bg-background border-border h-9"><SelectValue /></SelectTrigger>
                          <SelectContent>{VIDEO_SIZE_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>

                      {/* Inline toggles */}
                      <div className="grid grid-cols-2 gap-2">
                        <div className="flex items-center justify-between p-2 rounded-md border border-border bg-muted/30">
                          <span className="text-xs font-medium">🎞️ Cut Scenes</span>
                          <Switch checked={enableCutScenes} onCheckedChange={(c) => { setEnableCutScenes(c); setFeatureToggles(prev => ({ ...prev, cutScenes: c })); }} disabled={isGenerating} />
                        </div>
                        <div className="flex items-center justify-between p-2 rounded-md border border-border bg-muted/30">
                          <span className="text-xs font-medium">🎬 Intro/Outro</span>
                          <Switch checked={featureToggles.introOutro} onCheckedChange={(c) => handleFeatureChange('introOutro', c)} disabled={isGenerating} />
                        </div>
                      </div>

                      {/* Product Image Selection */}
                      {timelineProductImages.length > 0 && (
                        <div className="space-y-2">
                          <Label className="text-xs flex items-center gap-1"><Package className="w-3 h-3 text-primary" /> Product Image (Optional)</Label>
                          <div className="grid grid-cols-4 gap-1.5 max-h-28 overflow-y-auto">
                            {selectedProductImageUrl && (
                              <div
                                onClick={() => { setSelectedProductImageUrl(null); setSelectedProductName(null); }}
                                className="cursor-pointer rounded-md border-2 border-dashed border-border hover:border-destructive/50 p-1.5 flex items-center justify-center text-[9px] text-muted-foreground"
                              >
                                <X className="w-3 h-3 mr-0.5" /> None
                              </div>
                            )}
                            {timelineProductImages.map(p => (
                              <div
                                key={p.id}
                                onClick={() => { setSelectedProductImageUrl(p.image_url); setSelectedProductName(p.name); }}
                                className={`cursor-pointer rounded-md border-2 overflow-hidden transition-all ${selectedProductImageUrl === p.image_url ? 'border-primary ring-2 ring-primary/40' : 'border-border hover:border-primary/50'}`}
                              >
                                <img src={p.image_url} alt={p.name || 'Product'} className="w-full aspect-square object-cover" />
                                {p.name && <p className="text-[8px] text-center truncate px-0.5 py-0.5 text-muted-foreground">{p.name}</p>}
                              </div>
                            ))}
                          </div>
                          {selectedProductImageUrl && (
                            <p className="text-[10px] text-primary flex items-center gap-1">
                              <Package className="w-3 h-3" /> {selectedProductName || 'Product'} will appear naturally in scenes
                            </p>
                          )}
                        </div>
                      )}

                      {featureToggles.introOutro && (
                        <div className="p-3 rounded-lg border border-border bg-muted/30">
                          <TemplateSelector selectedIntro={selectedIntro} selectedOutro={selectedOutro} introText={introText} outroText={outroText} onIntroChange={setSelectedIntro} onOutroChange={setSelectedOutro} onIntroTextChange={setIntroText} onOutroTextChange={setOutroText} selectedLogoUrl={selectedLogoUrl} selectedLogoAnimation={selectedLogoAnimation} onLogoChange={setSelectedLogoUrl} onLogoAnimationChange={setSelectedLogoAnimation} disabled={isGenerating} />
                        </div>
                      )}

                      <Button onClick={() => generateScripts()} disabled={isGenerating || !topic.trim()} className="w-full bg-gradient-primary hover:opacity-90">
                        {isGenerating && project.status === 'generating-script' ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <FileText className="w-4 h-4 mr-2" />}
                        Generate Scripts
                      </Button>
                      <p className="text-[10px] text-center text-muted-foreground">~{parseInt(selectedSceneCount) * parseInt(selectedSceneDuration)}s total</p>
                    </CardContent>
                  </TabsContent>

                  {/* ── SCRIPT TAB ── */}
                  <TabsContent value="script">
                    <CardContent className="space-y-4 pt-2">
                      {project.scenes.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                          <FileText className="w-10 h-10 mx-auto mb-2 opacity-50" />
                          <p className="text-sm">Generate scripts first in the Settings tab.</p>
                        </div>
                      ) : (
                        <>
                          {project.voiceovers.length > 0 && (
                            <div className="flex items-center justify-between p-2 bg-primary/10 rounded-lg border border-primary/20">
                              <span className="text-xs font-medium flex items-center gap-1"><Mic className="w-3 h-3 text-primary" />Total Voiceover</span>
                              <span className="text-xs font-bold text-primary">{project.voiceovers.reduce((acc, v) => acc + v.duration, 0).toFixed(1)}s</span>
                            </div>
                          )}
                          <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
                            {project.scenes.map((scene) => {
                              const voiceover = project.voiceovers.find(v => v.sceneNumber === scene.sceneNumber);
                              return (
                                <div key={scene.sceneNumber} className={`p-3 rounded-lg border bg-background space-y-2 ${scene.isIntro || scene.isOutro ? 'border-primary/30 ring-1 ring-primary/20' : 'border-border'}`}>
                                  <div className="flex items-center justify-between">
                                    <Badge variant="outline" className="text-[10px]">
                                      {(scene as any).isIntro ? '🎬 Intro' : (scene as any).isOutro ? '📢 Outro' : (scene as any).isCutScene ? '🎞️ Cut' : `Scene ${scene.sceneNumber}`}
                                    </Badge>
                                    <span className="text-[10px] text-muted-foreground">{voiceover ? `${voiceover.duration.toFixed(1)}s` : `~${scene.duration}s`}</span>
                                  </div>
                                  {scene.narration ? (
                                    <Textarea value={scene.narration} onChange={(e) => updateSceneNarration(scene.sceneNumber, e.target.value)} className="text-sm bg-muted/30 border-0 resize-none min-h-[60px]" rows={2} disabled={isGenerating} />
                                  ) : (
                                    <p className="text-xs text-muted-foreground italic">Silent scene</p>
                                  )}
                                  <p className="text-[10px] text-muted-foreground line-clamp-1">📷 {(scene as any).visualDescription?.substring(0, 80)}...</p>
                                  {voiceover?.audioUrl && <audio controls src={voiceover.audioUrl} className="w-full h-7" />}
                                </div>
                              );
                            })}
                          </div>
                          <div className="space-y-3 p-2 rounded-lg border border-border bg-muted/30">
                            <div className="space-y-2">
                              <Label className="text-xs flex items-center gap-1"><Mic className="w-3 h-3 text-primary" /> Voice</Label>
                              <VoiceSelector selectedVoice={selectedVoice} onVoiceSelect={(v) => { setSelectedVoice(v); setProject(prev => ({ ...prev, voiceovers: [] })); }} compact characterDescription={characterDescription} characterGender={detectedCharGender} disabled={isGenerating} />
                              <VoicePitchSlider pitch={voicePitch} onPitchChange={(p) => { setVoicePitch(p); setProject(prev => ({ ...prev, voiceovers: [] })); }} disabled={isGenerating} compact />
                            </div>
                            <div className="space-y-1.5">
                              <Label className="text-[10px] text-muted-foreground">Audio Source</Label>
                              <div className="grid grid-cols-2 gap-1.5">
                                <Button type="button" variant={customAudioMode === 'tts' ? 'default' : 'outline'} size="sm" onClick={() => setCustomAudioMode('tts')} disabled={isGenerating} className="h-7 text-[10px]"><Sparkles className="w-3 h-3 mr-1" />AI Voice</Button>
                                <Button type="button" variant={customAudioMode === 'upload' ? 'default' : 'outline'} size="sm" onClick={() => setCustomAudioMode('upload')} disabled={isGenerating} className="h-7 text-[10px]"><Upload className="w-3 h-3 mr-1" />Upload MP3</Button>
                              </div>
                              {customAudioMode === 'upload' && (
                                <div className="p-2 bg-background rounded-lg border border-border">
                                  <input type="file" ref={customAudioInputRef} accept=".mp3,.wav,.m4a,.webm,audio/*" className="hidden" onChange={handleCustomAudioUpload} />
                                  {!customAudioUrl ? (
                                    <div className="border-2 border-dashed border-border rounded-lg p-2 text-center cursor-pointer hover:border-primary/50" onClick={() => customAudioInputRef.current?.click()}>
                                      {isUploadingAudio ? <Loader2 className="w-5 h-5 animate-spin text-primary mx-auto" /> : <><Upload className="w-5 h-5 mx-auto text-muted-foreground mb-1" /><p className="text-[10px] text-muted-foreground">Upload audio (Google AI Studio, etc.)</p></>}
                                    </div>
                                  ) : (
                                    <div className="flex items-center gap-2"><audio src={customAudioUrl} controls className="h-7 flex-1" /><Button variant="ghost" size="icon" onClick={removeCustomAudio} className="h-7 w-7 text-destructive"><X className="w-3 h-3" /></Button></div>
                                  )}
                                </div>
                              )}
                              {customAudioMode === 'tts' && videoModel !== 'sora-2' && (
                                <Button variant="outline" size="sm" onClick={previewVoice} disabled={isGenerating || isPreviewingVoice} className="w-full h-7 text-xs">
                                  {isPreviewingVoice ? <><Loader2 className="w-3 h-3 mr-1 animate-spin" />Playing</> : <><Play className="w-3 h-3 mr-1" />Preview</>}
                                </Button>
                              )}
                              {customAudioMode === 'tts' && videoModel === 'sora-2' && (
                                <p className="text-[10px] text-muted-foreground">
                                  Sora-2 generates native audio with the video — no separate voice preview.
                                </p>
                              )}
                            </div>
                          </div>
                          {/* Product indicator in Script tab */}
                          {timelineProductImages.length > 0 && (
                            <div className="space-y-2">
                              <Label className="text-xs flex items-center gap-1"><Package className="w-3 h-3 text-primary" /> Featured Product</Label>
                              <div className="grid grid-cols-5 gap-1.5">
                                {selectedProductImageUrl && (
                                  <div onClick={() => { setSelectedProductImageUrl(null); setSelectedProductName(null); }} className="cursor-pointer rounded-md border-2 border-dashed border-border hover:border-destructive/50 p-1 flex items-center justify-center text-[9px] text-muted-foreground aspect-square">
                                    <X className="w-3 h-3" />
                                  </div>
                                )}
                                {timelineProductImages.map(p => (
                                  <div key={p.id} onClick={() => { setSelectedProductImageUrl(p.image_url); setSelectedProductName(p.name); }}
                                    className={`cursor-pointer rounded-md border-2 overflow-hidden transition-all aspect-square ${selectedProductImageUrl === p.image_url ? 'border-primary ring-2 ring-primary/40' : 'border-border hover:border-primary/50'}`}>
                                    <img src={p.image_url} alt={p.name || 'Product'} className="w-full h-full object-cover" />
                                  </div>
                                ))}
                              </div>
                              {selectedProductImageUrl && (
                                <p className="text-[10px] text-primary flex items-center gap-1"><Package className="w-3 h-3" /> {selectedProductName || 'Product'} selected</p>
                              )}
                            </div>
                          )}
                          <Button variant="outline" onClick={() => generateScripts()} disabled={isGenerating} className="w-full h-8 text-xs">
                            <RefreshCw className="w-3 h-3 mr-1" /> Regenerate Script
                          </Button>
                        </>
                      )}
                    </CardContent>
                  </TabsContent>

                  {/* ── CHARACTER TAB ── */}
                  <TabsContent value="character">
                    <CardContent className="space-y-4 pt-2">
                      <div className="flex items-center justify-between p-2 rounded-md border border-border bg-muted/30">
                        <div className="flex items-center gap-2"><User className="w-4 h-4 text-primary" /><span className="text-sm font-medium">Lip Sync</span></div>
                        <Switch checked={enableLipSync} onCheckedChange={(c) => { setEnableLipSync(c); setFeatureToggles(prev => ({ ...prev, lipSync: c })); }} disabled={isGenerating} />
                      </div>

                      {aiTwins.length > 0 && (
                        <div className="space-y-2">
                          <Label className="text-xs text-muted-foreground">Your AI Twins</Label>
                          <div className="grid grid-cols-3 gap-2 max-h-48 overflow-y-auto">
                            {aiTwins.map(twin => {
                              const isSelected = selectedTwinId === twin.id;
                              const thumbUrl = twin.reference_images?.[0];
                              return (
                                <div key={twin.id} onClick={async () => {
                                  if (isGenerating) return;
                                  setSelectedTwinId(twin.id);
                                  if (twin.reference_images?.[0]) { setPortraitImage(twin.reference_images[0]); setPortraitPreview(twin.reference_images[0]); setPreSelectedReference(twin.reference_images[0]); const fullImages = await loadTwinFullImages(twin.id); if (fullImages && fullImages.length > 0) { setGeneratedCharacterShots(fullImages.map((url: string, i: number) => ({ label: `Angle ${i + 1}`, url }))); } }
                                  if (twin.face_description) setCharacterDescription(twin.face_description);
                                  toast({ title: `"${twin.name}" selected ✨` });
                                }} className={`cursor-pointer rounded-lg border-2 p-1.5 transition-all text-center ${isSelected ? 'border-primary ring-2 ring-primary/40 bg-primary/5' : 'border-border hover:border-primary/50 bg-muted/30'} ${isGenerating ? 'opacity-50 pointer-events-none' : ''}`}>
                                  {thumbUrl ? <img src={thumbUrl} alt={twin.name} className="w-full aspect-square object-cover rounded-md mb-1" /> : <div className="w-full aspect-square rounded-md bg-muted flex items-center justify-center mb-1"><User className="w-6 h-6 text-muted-foreground" /></div>}
                                  <p className="text-[10px] font-medium text-foreground truncate">{twin.name}</p>
                                  {twin.voice_cloning_key && <Badge variant="outline" className="text-[8px] px-1 py-0 mt-0.5 bg-primary/10 text-primary border-primary/30">🎙️</Badge>}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      <div className="relative flex items-center"><div className="flex-1 border-t border-border" /><span className="px-3 text-xs text-muted-foreground">{aiTwins.length > 0 ? 'or generate new' : 'Generate a character'}</span><div className="flex-1 border-t border-border" /></div>

                      {generatedCharacterShots.length > 0 && portraitPreview ? (
                        <div className="space-y-3 p-3 rounded-lg border border-border bg-muted/30">
                          <div className="flex items-center gap-3">
                            <img src={portraitPreview} alt="Character" className="w-14 h-14 rounded-lg object-cover border border-border" />
                            <div className="flex-1"><p className="text-sm font-medium">Character ready! ✨</p><p className="text-xs text-muted-foreground line-clamp-1">{characterDescription || 'Custom character'}</p></div>
                            <Button variant="ghost" size="sm" onClick={() => { setPortraitImage(null); setPortraitPreview(null); setPreSelectedReference(null); setCharacterDescription(''); setSelectedTwinId(null); setGeneratedCharacterShots([]); }}><X className="w-4 h-4" /></Button>
                          </div>
                          {generatedCharacterShots.length > 1 && (
                            <div className="grid grid-cols-5 gap-1.5">
                              {generatedCharacterShots.map((shot, idx) => (
                                <div key={idx} onClick={() => { setSelectedShotIndex(idx); setPortraitImage(shot.url); setPortraitPreview(shot.url); setPreSelectedReference(shot.url); }} className={`cursor-pointer rounded-md overflow-hidden border-2 transition-all ${selectedShotIndex === idx ? 'border-primary ring-2 ring-primary/40' : 'border-border hover:border-primary/50'}`}>
                                  <img src={shot.url} alt={shot.label} className="w-full aspect-square object-cover" />
                                  <p className="text-[8px] text-center text-muted-foreground py-0.5 truncate px-0.5">{shot.label}</p>
                                </div>
                              ))}
                            </div>
                          )}
                          {portraitPreview && <ProductSwapPanel shotImageUrl={portraitPreview} characterDescription={characterDescription} onShotSwapped={(newUrl) => { setPortraitImage(newUrl); setPortraitPreview(newUrl); setPreSelectedReference(newUrl); setGeneratedCharacterShots(prev => prev.map((s, i) => i === selectedShotIndex ? { ...s, url: newUrl } : s)); }} allShots={generatedCharacterShots} currentShotIndex={selectedShotIndex} onBatchSwapped={(updatedShots) => { setGeneratedCharacterShots(updatedShots); const cur = updatedShots[selectedShotIndex]; if (cur) { setPortraitImage(cur.url); setPortraitPreview(cur.url); setPreSelectedReference(cur.url); } }} disabled={isGenerating} controlledProductUrl={swapPanelProductUrl} controlledPrompt={swapPanelPrompt} onProductChange={handleSwapProductChange} />}
                          <Button variant="outline" size="sm" className="w-full" onClick={() => { setPortraitImage(null); setPortraitPreview(null); setPreSelectedReference(null); setSelectedTwinId(null); setGeneratedCharacterShots([]); generateCharacter(); }} disabled={isGenerating || isGeneratingCharacter}>
                            {isGeneratingCharacter ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Regenerating...</> : <><RefreshCw className="w-4 h-4 mr-2" />Regenerate</>}
                          </Button>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <Input placeholder="Describe character or leave blank" value={generateCharacterPrompt} onChange={(e) => setGenerateCharacterPrompt(e.target.value)} disabled={isGenerating || isGeneratingCharacter} className="bg-background" />
                          <Button variant="outline" className="w-full" onClick={generateCharacter} disabled={isGenerating || isGeneratingCharacter || (!generateCharacterPrompt.trim() && !topic.trim())}>
                            {isGeneratingCharacter ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Generating...</> : <><Wand2 className="w-4 h-4 mr-2" />Generate Character (5 Shots)</>}
                          </Button>
                          {isGeneratingCharacter && <div className="grid grid-cols-5 gap-1.5">{[...Array(5)].map((_, i) => <div key={i}><div className="aspect-square rounded-md bg-muted animate-pulse" /></div>)}</div>}
                        </div>
                      )}

                      <div className="relative flex items-center"><div className="flex-1 border-t border-border" /><span className="px-3 text-xs text-muted-foreground">or upload</span><div className="flex-1 border-t border-border" /></div>
                      {!portraitPreview && (
                        <div className="flex gap-2">
                          <div className="w-20 h-20 border-2 border-dashed border-border rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-primary/50" onClick={() => portraitInputRef.current?.click()}><Upload className="w-5 h-5 text-muted-foreground mb-1" /><span className="text-[10px] text-muted-foreground">Upload</span></div>
                          <GalleryImagePicker onSelect={(imageUrl) => { setPortraitPreview(imageUrl); setPortraitImage(imageUrl); setPreSelectedReference(imageUrl); analyzeReferenceImage(imageUrl); }} title="Select Portrait" trigger={<div className="w-20 h-20 border-2 border-dashed border-border rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-primary/50"><FolderOpen className="w-5 h-5 text-muted-foreground mb-1" /><span className="text-[10px] text-muted-foreground">Gallery</span></div>} />
                        </div>
                      )}
                      <Input ref={portraitInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => { handlePortraitUpload(e); const file = e.target.files?.[0]; if (file) { const reader = new FileReader(); reader.onload = async (ev) => { const url = ev.target?.result as string; setPreSelectedReference(url); analyzeReferenceImage(url); }; reader.readAsDataURL(file); } }} />

                      <div className="space-y-1">
                        <Label className="text-xs flex items-center gap-1"><User className="w-3 h-3" /> Character Description {isAnalyzingReference && <Loader2 className="w-3 h-3 animate-spin text-primary" />}</Label>
                        <Input placeholder="e.g., Male entrepreneur, 30s" value={characterDescription} onChange={(e) => setCharacterDescription(e.target.value)} className="text-sm" disabled={isAnalyzingReference} />
                      </div>

                      <div className="space-y-2 pt-2 border-t border-border">
                        <Label className="text-xs flex items-center gap-1"><Mic className="w-3 h-3 text-primary" /> Voice</Label>
                        <VoiceSelector selectedVoice={selectedVoice} onVoiceSelect={setSelectedVoice} compact characterDescription={characterDescription} characterGender={detectedCharGender} disabled={isGenerating} />
                        <VoicePitchSlider pitch={voicePitch} onPitchChange={setVoicePitch} disabled={isGenerating} compact />
                        {selectedVoice && videoModel !== 'sora-2' && <Button variant="outline" size="sm" className="w-full h-7 text-xs" onClick={previewVoice} disabled={isGenerating}>{isPreviewingVoice ? <><MicOff className="w-3 h-3 mr-1" />Stop</> : <><Play className="w-3 h-3 mr-1" />Preview</>}</Button>}
                        {videoModel === 'sora-2' && (
                          <p className="text-[10px] text-muted-foreground">Sora-2 voice is generated during video creation, not from the TTS preview button.</p>
                        )}
                      </div>

                      {/* Video model is auto-set to Sora-2 */}

                      <div className="space-y-2 pt-2 border-t border-border">
                        <Label className="text-xs">Audio Source</Label>
                        <div className="grid grid-cols-2 gap-2">
                          <Button type="button" variant={customAudioMode === 'tts' ? 'default' : 'outline'} size="sm" onClick={() => setCustomAudioMode('tts')} disabled={isGenerating} className="h-8 text-xs"><Sparkles className="w-3 h-3 mr-1" />AI Voice</Button>
                          <Button type="button" variant={customAudioMode === 'upload' ? 'default' : 'outline'} size="sm" onClick={() => setCustomAudioMode('upload')} disabled={isGenerating} className="h-8 text-xs"><Upload className="w-3 h-3 mr-1" />Upload</Button>
                        </div>
                        {customAudioMode === 'upload' && (
                          <div className="p-2 bg-muted/30 rounded-lg border border-border">
                            <input type="file" ref={customAudioInputRef} accept=".mp3,.wav,.m4a,.webm,audio/*" className="hidden" onChange={handleCustomAudioUpload} />
                            {!customAudioUrl ? (
                              <div className="border-2 border-dashed border-border rounded-lg p-3 text-center cursor-pointer hover:border-primary/50" onClick={() => customAudioInputRef.current?.click()}>
                                {isUploadingAudio ? <Loader2 className="w-6 h-6 animate-spin text-primary mx-auto" /> : <><Upload className="w-6 h-6 mx-auto text-muted-foreground mb-1" /><p className="text-xs text-muted-foreground">Upload audio</p></>}
                              </div>
                            ) : (
                              <div className="flex items-center gap-2"><audio src={customAudioUrl} controls className="h-7 flex-1" /><Button variant="ghost" size="icon" onClick={removeCustomAudio} className="h-7 w-7 text-destructive"><X className="w-3 h-3" /></Button></div>
                            )}
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </TabsContent>

                  {/* ── VIDEO TAB ── */}
                  <TabsContent value="video">
                    <CardContent className="space-y-4 pt-2">
                      {project.scenes.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground"><Video className="w-10 h-10 mx-auto mb-2 opacity-50" /><p className="text-sm">Generate scripts first.</p></div>
                      ) : (
                        <>
                          {enableLipSync && portraitPreview ? (
                            <div className="flex items-center gap-3 p-2 rounded-lg bg-muted/30 border border-primary/20">
                              <img src={portraitPreview} alt="Ref" className="w-12 h-12 object-cover rounded-lg border-2 border-primary" />
                              <div><p className="text-xs font-medium text-primary flex items-center gap-1"><Camera className="w-3 h-3" />Character Set</p><p className="text-[10px] text-muted-foreground">{characterDescription || 'Ready'}</p></div>
                            </div>
                          ) : enableLipSync ? (
                            <div className="p-2 rounded-md text-xs bg-destructive/10 border border-destructive/30 text-destructive">⚠️ No portrait. Select in Character tab.</div>
                          ) : (
                            <div className="p-2 rounded-md text-xs bg-muted/30 border border-border text-muted-foreground">📹 B-roll mode — enable Lip Sync in Character tab for talking head.</div>
                          )}
                          {/* Prompt Preview */}
                          {project.scenes.length > 0 && (
                            <Collapsible>
                              <CollapsibleTrigger asChild>
                                <Button variant="ghost" size="sm" className="w-full justify-between text-xs text-muted-foreground hover:text-foreground h-7">
                                  <span className="flex items-center gap-1"><FileText className="w-3 h-3" />View Prompts</span>
                                  <ChevronDown className="w-3 h-3" />
                                </Button>
                              </CollapsibleTrigger>
                              <CollapsibleContent className="space-y-2 pt-1">
                                <div className="max-h-48 overflow-y-auto space-y-2">
                                  {project.scenes.map((scene, idx) => (
                                    <div key={idx} className="p-2 rounded-md bg-muted/40 border border-border text-[11px] space-y-1">
                                      <p className="font-medium text-foreground">Scene {scene.sceneNumber}</p>
                                      <p className="text-muted-foreground"><span className="text-primary font-medium">Visual:</span> {scene.visualDescription}</p>
                                      <p className="text-muted-foreground"><span className="text-primary font-medium">Narration:</span> {scene.narration || '(silent)'}</p>
                                    </div>
                                  ))}
                                </div>
                                <p className="text-[10px] text-muted-foreground italic">Voice: {(() => { const vc = resolveVoiceForGeneration(); return `${vc.voice} (${vc.voiceEngine})`; })()}</p>
                              </CollapsibleContent>
                            </Collapsible>
                          )}
                          {/* Product picker in Video tab */}
                          {timelineProductImages.length > 0 && (
                            <div className="space-y-2">
                              <Label className="text-xs flex items-center gap-1"><Package className="w-3 h-3 text-primary" /> Featured Product</Label>
                              <div className="grid grid-cols-5 gap-1.5">
                                {selectedProductImageUrl && (
                                  <div onClick={() => { setSelectedProductImageUrl(null); setSelectedProductName(null); }} className="cursor-pointer rounded-md border-2 border-dashed border-border hover:border-destructive/50 p-1 flex items-center justify-center text-[9px] text-muted-foreground aspect-square">
                                    <X className="w-3 h-3" />
                                  </div>
                                )}
                                {timelineProductImages.map(p => (
                                  <div key={p.id} onClick={() => { setSelectedProductImageUrl(p.image_url); setSelectedProductName(p.name); }}
                                    className={`cursor-pointer rounded-md border-2 overflow-hidden transition-all aspect-square ${selectedProductImageUrl === p.image_url ? 'border-primary ring-2 ring-primary/40' : 'border-border hover:border-primary/50'}`}>
                                    <img src={p.image_url} alt={p.name || 'Product'} className="w-full h-full object-cover" />
                                  </div>
                                ))}
                              </div>
                              {selectedProductImageUrl && (
                                <p className="text-[10px] text-primary flex items-center gap-1"><Package className="w-3 h-3" /> {selectedProductName || 'Product'} selected</p>
                              )}
                            </div>
                          )}
                          <Button onClick={() => {
                            // Clear old reel before generating new preview
                            setProject(prev => ({ ...prev, generatedScenes: [], videoClips: [], videoBlobUrl: null, videoUrl: null }));
                            const referenceToUse = (enableLipSync && portraitImage) ? portraitImage : preSelectedReference;
                            const selectedCharacter = selectedCharacterId ? characters.find(c => c.id === selectedCharacterId) : null;
                            const characterRefImage = selectedCharacter?.reference_images?.[0];
                            if (referenceToUse) { setExternalReference(referenceToUse); if (preReferenceTransformation) setCharacterTransformation(preReferenceTransformation); }
                            const selectedTwin = aiTwins.find(t => t.id === selectedTwinId);
                            const voiceConfig = resolveVoiceForGeneration();
                            generatePreview(project.scenes, user?.id, referenceToUse || undefined, voiceConfig.voice || selectedVoice, characterRefImage || undefined, characterDescription || selectedTwin?.face_description || undefined, selectedTwin?.voice_cloning_key || undefined, selectedTwin?.reference_images || [], customAudioMode === 'upload' && customAudioUrl ? customAudioUrl : undefined, customAudioMode === 'upload' && customAudioDuration ? customAudioDuration : undefined, voiceConfig.voiceEngine, undefined, videoModel, selectedProductImageUrl || undefined, selectedProductName || undefined);
                          }} disabled={isGenerating || isGeneratingPreview} className="w-full bg-gradient-primary hover:opacity-90">
                            {isGeneratingPreview ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <ImageIcon className="w-4 h-4 mr-2" />}
                            Generate Preview
                          </Button>
                        </>
                      )}
                    </CardContent>
                  </TabsContent>
                </Tabs>
              </Card>
            )}

            {/* Voice Selection removed — voice is now generated from character context */}

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
                  {/* ── Character Section ── */}
                  <div className="rounded-lg border border-border p-4 space-y-4">
                    <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
                      <User className="w-4 h-4 text-primary" />
                      Character
                    </h4>
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <Sparkles className="w-3 h-3 text-primary" />
                      Select AI Twin (Quick Setup)
                    </Label>
                    {aiTwins.length === 0 ? (
                      <p className="text-xs text-muted-foreground">
                        No AI Twins found. Create one in the AI Twin page for quick voice + image setup.
                      </p>
                    ) : (
                      <div className="grid grid-cols-3 gap-2 max-h-48 overflow-y-auto">
                        {aiTwins.map(twin => {
                          const isSelected = selectedTwinId === twin.id;
                          const thumbUrl = twin.reference_images?.[0];
                          return (
                            <div
                              key={twin.id}
                              onClick={async () => {
                                if (isGenerating) return;
                                setSelectedTwinId(twin.id);
                                if (twin.reference_images?.[0]) {
                                  setPortraitImage(twin.reference_images[0]);
                                  setPortraitPreview(twin.reference_images[0]);
                                  setPreSelectedReference(twin.reference_images[0]);
                                  // Lazy-load all reference images for angle shots
                                  const fullImages = await loadTwinFullImages(twin.id);
                                  if (fullImages && fullImages.length > 0) {
                                    setGeneratedCharacterShots(
                                      fullImages.map((url: string, i: number) => ({ label: `Angle ${i + 1}`, url }))
                                    );
                                  }
                                }
                                if (twin.face_description) {
                                  setCharacterDescription(twin.face_description);
                                }
                                toast({
                                  title: `AI Twin "${twin.name}" Selected`,
                                  description: twin.voice_cloning_key 
                                    ? 'Voice clone and reference images applied' 
                                    : 'Reference images applied (no cloned voice)',
                                });
                              }}
                              className={`cursor-pointer rounded-lg border-2 p-1.5 transition-all text-center ${
                                isSelected
                                  ? 'border-primary ring-2 ring-primary/40 bg-primary/5'
                                  : 'border-border hover:border-primary/50 bg-muted/30'
                              } ${isGenerating ? 'opacity-50 pointer-events-none' : ''}`}
                            >
                              {thumbUrl ? (
                                <img
                                  src={thumbUrl}
                                  alt={twin.name}
                                  className="w-full aspect-square object-cover rounded-md mb-1"
                                />
                              ) : (
                                <div className="w-full aspect-square rounded-md bg-muted flex items-center justify-center mb-1">
                                  <User className="w-6 h-6 text-muted-foreground" />
                                </div>
                              )}
                              <p className="text-[10px] font-medium text-foreground truncate">{twin.name}</p>
                              {twin.voice_cloning_key && (
                                <Badge variant="outline" className="text-[8px] px-1 py-0 mt-0.5 bg-primary/10 text-primary border-primary/30">
                                  🎙️ Voice
                                </Badge>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                    {aiTwins.length > 0 && (
                      <p className="text-xs text-muted-foreground">
                        Tap a twin to auto-fill portrait and voice settings.
                      </p>
                    )}
                  </div>

                  {/* Generate Character On-Demand */}
                  <div className="relative flex items-center my-2">
                    <div className="flex-1 border-t border-border" />
                    <span className="px-3 text-xs text-muted-foreground">or generate a character</span>
                    <div className="flex-1 border-t border-border" />
                  </div>

                  {!showGenerateCharacter && !generatedCharacterShots.length ? (
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
                  ) : generatedCharacterShots.length > 0 && portraitPreview ? (
                    <div className="space-y-3 p-3 rounded-lg border border-border bg-muted/30">
                      <div className="flex items-center gap-3">
                        <img src={portraitPreview} alt="Character" className="w-14 h-14 rounded-lg object-cover border border-border" />
                        <div className="flex-1">
                          <p className="text-sm text-foreground font-medium">Character ready! ✨</p>
                          <p className="text-xs text-muted-foreground line-clamp-1">{characterDescription || 'Custom character'}</p>
                          {selectedTwinId && <p className="text-[10px] text-primary">Saved to AI Twins</p>}
                        </div>
                        <Button variant="ghost" size="sm" onClick={() => { setPortraitImage(null); setPortraitPreview(null); setPreSelectedReference(null); setCharacterDescription(''); setSelectedTwinId(null); setGeneratedCharacterShots([]); }}>
                          <X className="w-4 h-4" />
                        </Button>
                      </div>

                      {/* Angle shots grid */}
                      {generatedCharacterShots.length > 1 && (
                        <div className="space-y-2">
                          <Label className="text-xs text-muted-foreground">Select your preferred shot:</Label>
                          <div className="grid grid-cols-5 gap-1.5">
                            {generatedCharacterShots.map((shot, idx) => (
                              <div
                                key={idx}
                                onClick={() => {
                                  setSelectedShotIndex(idx);
                                  setPortraitImage(shot.url);
                                  setPortraitPreview(shot.url);
                                  setPreSelectedReference(shot.url);
                                }}
                                className={`cursor-pointer rounded-md overflow-hidden border-2 transition-all ${
                                  selectedShotIndex === idx
                                    ? 'border-primary ring-2 ring-primary/40'
                                    : 'border-border hover:border-primary/50'
                                }`}
                              >
                                <img src={shot.url} alt={shot.label} className="w-full aspect-square object-cover" />
                                <p className="text-[8px] text-center text-muted-foreground py-0.5 truncate px-0.5">{shot.label}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Product swap for selected shot */}
                      {portraitPreview && (
                        <ProductSwapPanel
                          shotImageUrl={portraitPreview}
                          characterDescription={characterDescription}
                          onShotSwapped={(newUrl) => {
                            setPortraitImage(newUrl);
                            setPortraitPreview(newUrl);
                            setPreSelectedReference(newUrl);
                            setGeneratedCharacterShots(prev => prev.map((s, i) => i === selectedShotIndex ? { ...s, url: newUrl } : s));
                          }}
                          allShots={generatedCharacterShots}
                          currentShotIndex={selectedShotIndex}
                          onBatchSwapped={(updatedShots) => {
                            setGeneratedCharacterShots(updatedShots);
                            const currentShot = updatedShots[selectedShotIndex];
                            if (currentShot) {
                              setPortraitImage(currentShot.url);
                              setPortraitPreview(currentShot.url);
                              setPreSelectedReference(currentShot.url);
                            }
                          }}
                          disabled={isGenerating}
                          controlledProductUrl={swapPanelProductUrl}
                          controlledPrompt={swapPanelPrompt}
                          onProductChange={handleSwapProductChange}
                        />
                      )}

                      {/* Voice section for this character */}
                      <div className="space-y-2 pt-2 border-t border-border">
                        <Label className="text-xs text-muted-foreground flex items-center gap-1">
                          <Mic className="w-3 h-3" /> Character Voice
                        </Label>
                        <VoiceSelector
                          selectedVoice={selectedVoice}
                          onVoiceSelect={setSelectedVoice}
                          compact
                          characterDescription={characterDescription}
                          characterGender={detectedCharGender}
                          disabled={isGenerating}
                        />
                        <VoicePitchSlider pitch={voicePitch} onPitchChange={setVoicePitch} disabled={isGenerating} compact />
                        {selectedVoice && videoModel !== 'sora-2' && (
                          <Button variant="outline" size="sm" className="w-full" onClick={previewVoice} disabled={isGenerating}>
                            {isPreviewingVoice ? <><MicOff className="w-3 h-3 mr-1" />Stop</> : <><Play className="w-3 h-3 mr-1" />Preview Voice</>}
                          </Button>
                        )}
                        {videoModel === 'sora-2' && (
                          <p className="text-xs text-muted-foreground">
                            Sora-2 will generate the actual voice when the reel video is created.
                          </p>
                        )}
                      </div>

                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full"
                        onClick={() => { setPortraitImage(null); setPortraitPreview(null); setPreSelectedReference(null); setSelectedTwinId(null); setGeneratedCharacterShots([]); generateCharacter(); }}
                        disabled={isGenerating || isGeneratingCharacter}
                      >
                        {isGeneratingCharacter ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Regenerating...</> : <><RefreshCw className="w-4 h-4 mr-2" />Regenerate Character</>}
                      </Button>
                    </div>
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
                          Generate (5 Shots)
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => { setShowGenerateCharacter(false); }}>
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
                  </div>

                  {/* ── Voice & Model Section ── */}
                  <div className="rounded-lg border border-border p-4 space-y-4">
                    <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
                      <Mic className="w-4 h-4 text-primary" />
                      Voice & Model
                    </h4>

                   {/* Video model: Sora-2 (auto-selected) */}
                  <div className="p-2.5 rounded-md text-xs font-medium bg-primary/10 text-primary border border-primary/30">
                    🎬 Sora-2 — cinematic video with built-in audio generation
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
                          <Sparkles className="w-5 h-5 text-primary" />
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

            {/* Captions Settings - Only visible when enabled from sidebar (Advanced only) */}
            {isAdvanced && featureToggles.captions && (
              <Card className="bg-card border-border">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Captions className="w-5 h-5 text-primary" />
                    Caption Settings
                  </CardTitle>
                  <CardDescription>
                    Choose animation style and appearance for burned-in captions
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <CaptionStyleSelector
                    settings={captionSettings}
                    onChange={setCaptionSettings}
                  />
                </CardContent>
              </Card>
            )}

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
                                    <span className="text-xs font-medium text-orange-500 bg-orange-500/10 px-2 py-0.5 rounded-full flex items-center gap-1" title="Long narration — InfiniteTalk will auto-match video length to audio">
                                      <Mic className="w-3 h-3" />
                                      {actualDuration.toFixed(1)}s
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
                                            setSelectedVoice('Wise_Woman');
                                          } else if (isMale) {
                                            setSelectedVoice('English_Trustworth_Man');
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
                        // Resolve full voice config from AI Twin
                        const voiceConfig = resolveVoiceForGeneration();
                        // Pass all reference images from the AI Twin for character consistency
                        const allTwinReferenceImages = selectedTwin?.reference_images || [];
                        
                        // Pass custom audio if in upload mode
                        const customAudio = customAudioMode === 'upload' && customAudioUrl ? customAudioUrl : undefined;
                        const customDuration = customAudioMode === 'upload' && customAudioDuration ? customAudioDuration : undefined;
                        
                        // Clear old reel before generating new preview
                        setProject(prev => ({ ...prev, generatedScenes: [], videoClips: [], videoBlobUrl: null, videoUrl: null }));
                        generatePreview(
                          project.scenes, 
                          user?.id, 
                          referenceToUse || undefined, 
                          voiceConfig.voice,
                          characterRefImage || undefined,
                          characterDescription || selectedTwin?.face_description || undefined,
                          undefined,
                          allTwinReferenceImages,
                          customAudio,
                          customDuration,
                          voiceConfig.voiceEngine,
                          undefined,
                          videoModel,
                          selectedProductImageUrl || undefined,
                          selectedProductName || undefined
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

            {/* Scene Preview / Timeline Toggle (Advanced only) */}
            {isAdvanced && (previewScenes.length > 0 || (timelineViewActive && project.generatedScenes.length > 0)) && (
              <div className="space-y-4">
                {/* View Mode Toggle */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Button
                      variant={!timelineViewActive ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => {
                        setTimelineViewActive(false);
                        setSidebarsHiddenForTimeline(false);
                      }}
                      className="h-8 text-xs"
                    >
                      <Layers className="w-3.5 h-3.5 mr-1.5" /> Scene Preview
                    </Button>
                    <Button
                      variant={timelineViewActive ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => {
                        setTimelineViewActive(true);
                        setSidebarsHiddenForTimeline(true);
                        setSidebarCollapsed(true);
                      }}
                      className="h-8 text-xs"
                    >
                      <Film className="w-3.5 h-3.5 mr-1.5" /> Timeline View
                    </Button>
                  </div>
                </div>

                {/* Timeline Editor */}
                {timelineViewActive ? (
                  <div className="border rounded-lg overflow-hidden bg-background" style={{ height: 'calc(100vh - 200px)', minHeight: 600 }}>
                    <TimelineEditor
                      scenes={(() => {
                        const sceneSrc = previewScenes.length > 0 ? previewScenes : project.generatedScenes.map(gs => {
                          const matchingScene = project.scenes.find(s => s.sceneNumber === gs.sceneNumber);
                          return {
                            sceneNumber: gs.sceneNumber,
                            narration: matchingScene?.narration || gs.text || '',
                            visualDescription: matchingScene?.visualDescription || gs.text || '',
                            imageUrl: gs.imageUrl,
                            audioUrl: project.voiceovers.find(v => v.sceneNumber === gs.sceneNumber)?.audioUrl || null,
                            audioDuration: project.voiceovers.find(v => v.sceneNumber === gs.sceneNumber)?.duration || 0,
                          };
                        });
                        return sceneSrc.map((ps, i) => ({
                          sceneNumber: ps.sceneNumber,
                          narration: ps.narration,
                          visualDescription: ps.visualDescription,
                          imageUrl: ps.imageUrl,
                          videoUrl: project.generatedScenes.find(gs => gs.sceneNumber === ps.sceneNumber)?.videoUrl || null,
                          audioUrl: ps.audioUrl,
                          audioDuration: ps.audioDuration,
                          duration: ps.audioDuration > 0 ? ps.audioDuration : parseInt(selectedSceneDuration) || 10,
                          startTime: 0,
                          endTime: 0,
                          isIntro: i === 0,
                          isOutro: i === sceneSrc.length - 1,
                        }));
                      })()}
                      voiceovers={previewVoiceovers.length > 0 ? previewVoiceovers : project.voiceovers}
                      backgroundMusicUrl={backgroundMusicUrl}
                      totalDuration={(() => { const src = previewScenes.length > 0 ? previewScenes : project.generatedScenes; return src.reduce((sum, s: any) => sum + ((s.audioDuration || 0) > 0 ? s.audioDuration : parseInt(selectedSceneDuration) || 10), 0); })()}
                      aspectRatio={selectedVideoSize}
                      onScenesUpdate={(updatedScenes) => {
                        const reorderedProjectScenes = updatedScenes.map(ts => {
                          const original = project.scenes.find(s => s.sceneNumber === ts.sceneNumber);
                          return original ? { ...original, sceneNumber: ts.sceneNumber, duration: ts.duration } : project.scenes[0];
                        });
                        setProject(prev => ({ ...prev, scenes: reorderedProjectScenes }));
                      }}
                      onClose={() => { setTimelineViewActive(false); setSidebarsHiddenForTimeline(false); }}
                      onRegenerateVoice={(sceneNumber) => {
                        const scene = previewScenes.find(s => s.sceneNumber === sceneNumber);
                        if (!scene?.narration?.trim()) return;
                        const voiceConfig = resolveVoiceForGeneration();
                        const selectedTwin = selectedTwinId ? aiTwins.find(t => t.id === selectedTwinId) : null;
                        regenerateSceneVoice(
                          sceneNumber,
                          scene.narration,
                          voiceConfig.voice,
                          selectedTwin?.voice_cloning_key || undefined,
                          voiceConfig.voiceEngine,
                          undefined,
                          user?.id
                        );
                      }}
                      onRegenerateScene={(sceneNumber) => {
                        const scene = previewScenes.find(s => s.sceneNumber === sceneNumber);
                        if (!scene) return;
                        const prompt = scene.visualDescription || scene.narration;
                        if (referenceImageUrl) {
                          regenerateWithReference(sceneNumber, prompt, referenceImageUrl, characterTransformation, characterDescription || undefined, selectedProductImageUrl || undefined, selectedProductName || undefined);
                        } else {
                          regenerateSceneImage(sceneNumber, prompt);
                        }
                      }}
                    />
                  </div>
                ) : (
                <ScenePreview
                  scenes={previewScenes}
                  onRegenerateImage={(sceneNumber, customPrompt, localRefUrl) => {
                    const scene = project.scenes.find(s => s.sceneNumber === sceneNumber);
                    const promptToUse = customPrompt || scene?.visualDescription || '';
                    
                    // Use local reference if provided, else fall back to global reference
                    if (localRefUrl) {
                      regenerateWithReference(sceneNumber, promptToUse, localRefUrl, characterTransformation, characterDescription || undefined, selectedProductImageUrl || undefined, selectedProductName || undefined);
                    } else if (referenceImageUrl) {
                      regenerateWithReference(sceneNumber, promptToUse, referenceImageUrl, characterTransformation, characterDescription || undefined, selectedProductImageUrl || undefined, selectedProductName || undefined);
                    } else {
                      regenerateSceneImage(sceneNumber, promptToUse);
                    }
                  }}
                  onRegenerateVoice={(sceneNumber) => {
                    const scene = previewScenes.find(s => s.sceneNumber === sceneNumber);
                    if (!scene?.narration?.trim()) return;
                    const voiceConfig = resolveVoiceForGeneration();
                    const selectedTwin = selectedTwinId ? aiTwins.find(t => t.id === selectedTwinId) : null;
                    regenerateSceneVoice(
                      sceneNumber,
                      scene.narration,
                      voiceConfig.voice,
                      selectedTwin?.voice_cloning_key || undefined,
                      voiceConfig.voiceEngine,
                      undefined,
                      user?.id
                    );
                  }}
                  onGenerateVoiceSample={async (req) => {
                    try {
                      const { data, error } = await supabase.functions.invoke('text-to-speech', {
                        body: {
                          text: req.narration,
                          voice: req.voiceId,
                          voiceEngine: 'wavespeed',
                        }
                      });
                      if (error) throw error;
                      if (data?.audioUrl) return { audioUrl: data.audioUrl };
                      if (data?.audioContent) return { audioUrl: `data:audio/mp3;base64,${data.audioContent}` };
                      return null;
                    } catch (e) {
                      console.error('Voice sample generation failed:', e);
                      return null;
                    }
                  }}
                  onApplyVoiceSample={(sceneNumber, audioUrl) => {
                    const updatedScenes = previewScenes.map(ps =>
                      ps.sceneNumber === sceneNumber ? { ...ps, audioUrl, audioDuration: ps.audioDuration } : ps
                    );
                    const updatedVoiceovers = previewVoiceovers.map(v =>
                      v.sceneNumber === sceneNumber ? { ...v, audioUrl } : v
                    );
                    restorePreviewScenes(updatedScenes, updatedVoiceovers);
                  }}
                  onApplyVoiceToAll={(voiceId) => {
                    // When user likes a voice, set it as the selected voice for all future generations
                    setSelectedVoice(voiceId);
                    // Regenerate voice for all scenes with this voice
                    const voiceConfig = { voice: voiceId, voiceEngine: 'wavespeed' as const };
                    previewScenes.forEach(async (scene) => {
                      if (scene.narration?.trim()) {
                        const selectedTwin = selectedTwinId ? aiTwins.find(t => t.id === selectedTwinId) : null;
                        regenerateSceneVoice(
                          scene.sceneNumber,
                          scene.narration,
                          voiceConfig.voice,
                          selectedTwin?.voice_cloning_key || undefined,
                          voiceConfig.voiceEngine,
                          undefined,
                          user?.id
                        );
                      }
                    });
                    toast({ title: "Voice Applied to All Scenes", description: `${voiceId.replace(/_/g, ' ')} will be used for all scenes.` });
                  }}
                  availableVoices={[
                    { id: 'English_radiant_girl', label: 'Radiant Girl', gender: 'Female' },
                    { id: 'Calm_Woman', label: 'Calm Woman', gender: 'Female' },
                    { id: 'Inspirational_girl', label: 'Inspirational Girl', gender: 'Female' },
                    { id: 'Wise_Woman', label: 'Wise Woman', gender: 'Female' },
                    { id: 'Lovely_Girl', label: 'Lovely Girl', gender: 'Female' },
                    { id: 'Lively_Girl', label: 'Lively Girl', gender: 'Female' },
                    { id: 'English_compelling_lady1', label: 'Compelling Lady', gender: 'Female' },
                    { id: 'English_magnetic_voiced_man', label: 'Magnetic Man', gender: 'Male' },
                    { id: 'English_Trustworth_Man', label: 'Trustworthy Man', gender: 'Male' },
                    { id: 'Casual_Guy', label: 'Casual Guy', gender: 'Male' },
                    { id: 'Deep_Voice_Man', label: 'Deep Voice Man', gender: 'Male' },
                    { id: 'English_expressive_narrator', label: 'Expressive Narrator', gender: 'Male' },
                    { id: 'English_Aussie_Bloke', label: 'Aussie Bloke', gender: 'Male' },
                    { id: 'Elegant_Man', label: 'Elegant Man', gender: 'Male' },
                    { id: 'Determined_Man', label: 'Determined Man', gender: 'Male' },
                    { id: 'Patient_Man', label: 'Patient Man', gender: 'Male' },
                    { id: 'Decent_Boy', label: 'Decent Boy', gender: 'Male' },
                  ]}
                  onCreateVideo={generateVideo}
                  isCreatingVideo={isGenerating && (project.status === 'generating-video' || project.status === 'rendering-video')}
                  disabled={isGenerating}
                  referenceImageUrl={referenceImageUrl}
                  onSetReference={setSceneAsReference}
                  onClearReference={clearReference}
                  characterTransformation={characterTransformation}
                  onCharacterTransformationChange={setCharacterTransformation}
                  onInsertScene={insertPreviewScene}
                  onDeleteScene={deletePreviewScene}
                  currentScenes={project.scenes}
                  onApplyProductScript={(newScenes) => {
                    const updated = project.scenes.map(s => {
                      const rewritten = newScenes.find((r: any) => r.sceneNumber === s.sceneNumber);
                      return rewritten ? { ...s, narration: rewritten.narration, visualDescription: rewritten.visualDescription } : s;
                    });
                    setProject(prev => ({ ...prev, scenes: updated }));
                    resetPreview();
                  }}
                />
                )}
                {/* Background Music Panel */}
                {featureToggles.backgroundMusic && (
                  <Card className="border-primary/20 bg-primary/5">
                    <CardContent className="pt-4 space-y-3">
                      <Label className="flex items-center gap-2 text-sm font-medium">
                        🎵 Background Music
                      </Label>
                      <div className="flex gap-2">
                        <Input
                          placeholder="e.g. upbeat corporate, lo-fi chill, cinematic epic..."
                          value={backgroundMusicMood}
                          onChange={(e) => setBackgroundMusicMood(e.target.value)}
                          className="flex-1"
                        />
                        <Button
                          onClick={generateBackgroundMusic}
                          disabled={isGeneratingMusic || !backgroundMusicMood.trim()}
                          size="sm"
                        >
                          {isGeneratingMusic ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                        </Button>
                      </div>
                      {backgroundMusicUrl && (
                        <div className="space-y-2">
                          <audio controls className="w-full h-8" src={backgroundMusicUrl} />
                          <Button variant="ghost" size="sm" onClick={() => setBackgroundMusicUrl(null)} className="text-xs text-muted-foreground">
                            <X className="w-3 h-3 mr-1" /> Remove Music
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}
                
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
            {!isGeneratingPreview && (project.videoBlobUrl || (project.generatedScenes.length > 0 && previewScenes.length === 0)) && (
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

                  {/* Scene Timeline with drag-reorder, B-roll insert, product shots */}
                  {!project.videoBlobUrl && project.generatedScenes.length > 0 && (
                    <ReelSceneTimeline
                      scenes={project.generatedScenes}
                      videoClips={project.videoClips}
                      voiceovers={project.voiceovers}
                      productImages={timelineProductImages}
                      selectedTwin={selectedTwinId ? aiTwins.find(t => t.id === selectedTwinId) || null : null}
                      portraitImage={portraitImage}
                      onScenesChange={(newScenes, newClips, newVos) => {
                        setProject(prev => ({
                          ...prev,
                          generatedScenes: newScenes,
                          videoClips: newClips,
                          voiceovers: newVos
                        }));
                      }}
                      onEditScene={(sceneNumber, text) => {
                        setEditingSceneNumber(sceneNumber);
                        setEditSceneText(text);
                      }}
                    />
                  )}

                  {/* Intro/CTA Slide Buttons */}
                  {project.generatedScenes.length > 0 && !project.videoBlobUrl && (
                    <div className="flex flex-wrap justify-center gap-2 mb-3">
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
                        Add Outro/CTA Slide
                      </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => generateThumbnail()}
                          disabled={isGeneratingThumbnail}
                        >
                          {isGeneratingThumbnail ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <ImageIcon className="w-3 h-3 mr-1" />}
                        Generate Thumbnail
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

                  {/* CTA Slide Form Dialog — Premium */}
                  <Dialog open={showCtaSlideForm} onOpenChange={setShowCtaSlideForm}>
                    <DialogContent className="sm:max-w-lg">
                      <DialogHeader>
                        <DialogTitle>Premium Outro / CTA Slide</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label>CTA Headline</Label>
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
                        <div className="space-y-2">
                          <Label className="text-sm">Outro Style</Label>
                          <div className="grid grid-cols-2 gap-2">
                            {[
                              { id: 'logo-fade', label: '✨ Logo Fade', desc: 'Elegant, minimal' },
                              { id: 'animated-logo', label: '⚡ Dynamic', desc: 'Energy, motion' },
                              { id: 'glitch-logo', label: '🔲 Glitch', desc: 'Modern, clean' },
                              { id: 'neon-logo', label: '💜 Neon', desc: 'Glowing, premium' },
                            ].map(s => (
                              <div
                                key={s.id}
                                className={cn(
                                  "p-2 rounded-lg border cursor-pointer text-center transition-all",
                                  outroStyle === s.id ? "border-primary bg-primary/10 ring-1 ring-primary/30" : "border-border hover:border-primary/40"
                                )}
                                onClick={() => setOutroStyle(s.id)}
                              >
                                <p className="text-xs font-medium">{s.label}</p>
                                <p className="text-[10px] text-muted-foreground">{s.desc}</p>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Outro Variations Gallery */}
                        {outroVariations.length > 0 && (
                          <div className="space-y-2">
                            <Label className="text-xs text-muted-foreground">Generated Variations</Label>
                            <div className="grid grid-cols-3 gap-2">
                              {outroVariations.map((url, idx) => (
                                <div
                                  key={idx}
                                  className={cn(
                                    "relative rounded-lg overflow-hidden border-2 cursor-pointer transition-all aspect-[9/16]",
                                    selectedOutroIdx === idx ? "border-primary ring-2 ring-primary/30" : "border-border hover:border-primary/40"
                                  )}
                                  onClick={() => setSelectedOutroIdx(idx)}
                                >
                                  <img src={url} alt={`Outro ${idx + 1}`} className="w-full h-full object-cover" />
                                  {selectedOutroIdx === idx && (
                                    <div className="absolute top-1 right-1">
                                      <Badge className="bg-primary text-primary-foreground text-[8px] h-4">✓</Badge>
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            className="flex-1"
                            onClick={async () => {
                              await generatePremiumOutro(ctaSlideHeadline, ctaSlideSubtitle);
                            }}
                            disabled={!ctaSlideHeadline.trim() || isGeneratingOutro}
                          >
                            {isGeneratingOutro ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
                            {outroVariations.length > 0 ? 'Add Variation' : 'Preview Outro'}
                          </Button>
                          {outroVariations.length > 0 && (
                            <Button
                              className="flex-1"
                              onClick={() => {
                                const selectedUrl = outroVariations[selectedOutroIdx];
                                if (selectedUrl) {
                                  const newScene: GeneratedScene = {
                                    sceneNumber: 999,
                                    text: ctaSlideSubtitle ? `${ctaSlideHeadline}\n${ctaSlideSubtitle}` : ctaSlideHeadline,
                                    imageUrl: selectedUrl,
                                    startTime: 0,
                                    endTime: 3,
                                    isIntro: false,
                                    isOutro: true,
                                  };
                                  setProject(prev => {
                                    const scenes = [...prev.generatedScenes];
                                    const maxNum = Math.max(...scenes.map(s => s.sceneNumber), 0);
                                    scenes.push({ ...newScene, sceneNumber: maxNum + 1 });
                                    return { ...prev, generatedScenes: scenes };
                                  });
                                  setShowCtaSlideForm(false);
                                  setCtaSlideHeadline('');
                                  setCtaSlideSubtitle('');
                                  setOutroVariations([]);
                                  toast({ title: "Premium Outro Added!" });
                                }
                              }}
                            >
                              <Download className="w-4 h-4 mr-2" />
                              Use Selected
                            </Button>
                          )}
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>

                  {/* Premium Thumbnail Dialog */}
                  <Dialog open={showThumbnailDialog} onOpenChange={setShowThumbnailDialog}>
                    <DialogContent className="sm:max-w-lg">
                      <DialogHeader>
                        <DialogTitle>Premium Thumbnail</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4">
                        {/* Style Selector */}
                        <div className="space-y-2">
                          <Label className="text-sm">Thumbnail Style</Label>
                          <div className="grid grid-cols-3 gap-2">
                            {[
                              { id: 'dramatic', label: '🔥 Dramatic' },
                              { id: 'clean', label: '✨ Clean' },
                              { id: 'bold', label: '💥 Bold' },
                              { id: 'cinematic', label: '🎬 Cinematic' },
                              { id: 'energetic', label: '⚡ Energetic' },
                              { id: 'minimal', label: '🤍 Minimal' },
                            ].map(s => (
                              <div
                                key={s.id}
                                className={cn(
                                  "p-1.5 rounded-md border cursor-pointer text-center text-xs transition-all",
                                  thumbnailStyle === s.id ? "border-primary bg-primary/10" : "border-border hover:border-primary/40"
                                )}
                                onClick={() => setThumbnailStyle(s.id)}
                              >
                                {s.label}
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Thumbnails Gallery */}
                        {generatedThumbnails.length > 0 && (
                          <div className="space-y-2">
                            {generatedThumbnails.length > 1 && (
                              <div className="grid grid-cols-3 gap-2">
                                {generatedThumbnails.map((url, idx) => (
                                  <div
                                    key={idx}
                                    className={cn(
                                      "relative rounded-lg overflow-hidden border-2 cursor-pointer transition-all aspect-[9/16]",
                                      selectedThumbnailIdx === idx ? "border-primary ring-2 ring-primary/30" : "border-border hover:border-primary/40"
                                    )}
                                    onClick={() => setSelectedThumbnailIdx(idx)}
                                  >
                                    <img src={url} alt={`Thumbnail ${idx + 1}`} className="w-full h-full object-cover" />
                                    {selectedThumbnailIdx === idx && (
                                      <div className="absolute top-1 right-1">
                                        <Badge className="bg-primary text-primary-foreground text-[8px] h-4">✓</Badge>
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}
                            {/* Selected thumbnail large preview */}
                            <div className="relative rounded-lg overflow-hidden border border-border">
                              <img src={generatedThumbnails[selectedThumbnailIdx]} alt="Selected thumbnail" className="w-full object-cover" />
                            </div>
                          </div>
                        )}

                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => generateThumbnail(true)}
                            disabled={isGeneratingThumbnail}
                          >
                            {isGeneratingThumbnail ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Plus className="w-3 h-3 mr-1" />}
                            Add Variation
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => generateThumbnail(false)}
                            disabled={isGeneratingThumbnail}
                          >
                            <RefreshCw className="w-3 h-3 mr-1" />
                            New Style
                          </Button>
                          <Button
                            size="sm"
                            className="ml-auto"
                            onClick={() => {
                              const selected = generatedThumbnails[selectedThumbnailIdx];
                              if (selected) {
                                setSelectedThumbnailUrl(selected);
                                toast({ title: "Thumbnail Selected", description: "It will be prepended as a 3-second intro when you stitch your video." });
                              }
                              setShowThumbnailDialog(false);
                            }}
                          >
                            <Film className="w-3 h-3 mr-1" />
                            Use as Intro
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              const selected = generatedThumbnails[selectedThumbnailIdx];
                              if (selected) {
                                const link = document.createElement('a');
                                link.href = selected;
                                link.download = `thumbnail-${project.topic || 'reel'}.png`;
                                link.click();
                              }
                            }}
                          >
                            <Download className="w-3 h-3 mr-1" />
                            Download
                          </Button>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>

                  {/* Intro thumbnail indicator */}
                  {selectedThumbnailUrl && (
                    <div className="flex items-center gap-2 p-2 rounded-lg border border-primary/30 bg-primary/5">
                      <img src={selectedThumbnailUrl} alt="Intro thumbnail" className="w-16 h-10 object-cover rounded" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-primary">Intro Thumbnail Set</p>
                        <p className="text-xs text-muted-foreground">Will be prepended as a 3s intro clip</p>
                      </div>
                      <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => setSelectedThumbnailUrl(null)}>
                        <X className="w-3 h-3" />
                      </Button>
                    </div>
                  )}

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
                      <div className="flex flex-wrap justify-center gap-2">
                        <Button 
                          onClick={handleDownloadVideo}
                          className="bg-gradient-primary hover:opacity-90"
                        >
                          <Download className="w-4 h-4 mr-2" />
                          Download for TikTok
                        </Button>
                        <Button
                          variant="outline"
                          className="border-primary/50 text-primary hover:bg-primary/10"
                          onClick={() => {
                            setTimelineViewActive(true);
                            setSidebarsHiddenForTimeline(true);
                            setSidebarCollapsed(true);
                          }}
                        >
                          <Film className="w-4 h-4 mr-2" />
                          Edit in Timeline
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => generateThumbnail()}
                          disabled={isGeneratingThumbnail}
                          className="border-primary/50 text-primary hover:bg-primary/10"
                        >
                          {isGeneratingThumbnail ? (
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          ) : (
                            <ImageIcon className="w-4 h-4 mr-2" />
                          )}
                          Generate Thumbnail
                        </Button>
                      </div>
                    )}
                    {/* Re-generate with Lip Sync */}
                    {project.videoBlobUrl && project.videoClips.length === 0 && !enableLipSync && project.generatedScenes.length > 0 && (
                      <Button
                        variant="outline"
                        className="border-primary/50 text-primary hover:bg-primary/10"
                        disabled={isGenerating}
                        onClick={() => {
                          setEnableLipSync(true);
                          setLipSyncModel('infinitetalk');
                          // If no portrait yet, prompt user
                          if (!portraitImage && aiTwins.length > 0) {
                            const twin = aiTwins[0];
                            setSelectedTwinId(twin.id);
                            if (twin.reference_images?.[0]) {
                              setPortraitImage(twin.reference_images[0]);
                              setPortraitPreview(twin.reference_images[0]);
                            }
                            if (twin.face_description) setCharacterDescription(twin.face_description);
                          }
                          if (!portraitImage && aiTwins.length === 0) {
                            toast({
                              title: "Character Needed",
                              description: "Please create an AI Twin first, then re-generate with lip sync.",
                              variant: "destructive"
                            });
                            return;
                          }
                          toast({ title: "Re-generating with Lip Sync", description: "Videos will now include talking head scenes." });
                          generateVideo({ forceEnableLipSync: true, forceLipSyncModel: 'infinitetalk', scenesOverride: project.scenes });
                        }}
                      >
                        <Video className="w-4 h-4 mr-2" />
                        Re-generate with Lip Sync
                      </Button>
                    )}
                    {/* Post-Production: Add B-Roll */}
                    {project.videoBlobUrl && project.videoClips.length === 0 && (
                      <Button
                        variant="outline"
                        className="border-accent/50 gap-1"
                        onClick={() => setShowAppendBroll(!showAppendBroll)}
                      >
                        <Film className="w-4 h-4" />
                        {showAppendBroll ? 'Hide B-Roll Panel' : 'Add B-Roll Clips'}
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

                  {/* Post-Production B-Roll Panel */}
                  {showAppendBroll && project.videoBlobUrl && (
                    <div className="mt-6 border-t pt-6 space-y-4">
                      <div className="flex items-center gap-2">
                        <Film className="w-5 h-5 text-primary" />
                        <h3 className="font-semibold text-lg">Add B-Roll Clips</h3>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Generate additional cinematic B-roll clips and re-stitch them into your reel.
                      </p>

                      {/* Model & Duration */}
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <Label className="text-xs">Model</Label>
                          <Select value={appendBrollModel} onValueChange={(v: any) => setAppendBrollModel(v)}>
                            <SelectTrigger className="h-9 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="wan-2.6-i2v">🌟 Wan 2.6 (5-15s)</SelectItem>
                              <SelectItem value="wan-2.1-i2v-480p">⚡ Wan 2.1 (fast)</SelectItem>
                              <SelectItem value="kling-v3.0-pro">🎬 Kling v3 Pro</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        {appendBrollModel === 'wan-2.6-i2v' && (
                          <div className="space-y-1">
                            <Label className="text-xs">Duration</Label>
                            <div className="flex gap-1">
                              {([5, 10, 15] as const).map(d => (
                                <Button
                                  key={d}
                                  size="sm"
                                  variant={appendBrollDuration === d ? 'default' : 'outline'}
                                  className="flex-1 h-9 text-xs"
                                  onClick={() => setAppendBrollDuration(d)}
                                >
                                  {d}s
                                </Button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Prompt */}
                      <div className="space-y-1">
                        <Label className="text-xs">Scene Description</Label>
                        <Textarea
                          value={appendBrollPrompt}
                          onChange={(e) => setAppendBrollPrompt(e.target.value)}
                          placeholder="e.g. Aerial drone shot of a modern city skyline at golden hour..."
                          rows={2}
                          className="text-sm"
                        />
                      </div>

                      <Button
                        onClick={appendBrollClip}
                        disabled={isAppendingBroll || !appendBrollPrompt.trim()}
                        className="w-full gap-2"
                      >
                        {isAppendingBroll ? (
                          <><Loader2 className="w-4 h-4 animate-spin" /> Generating...</>
                        ) : (
                          <><Plus className="w-4 h-4" /> Generate B-Roll Clip</>
                        )}
                      </Button>

                      {/* Queued clips */}
                      {appendedClips.length > 0 && (
                        <div className="space-y-2">
                          <Label className="text-xs text-muted-foreground">{appendedClips.length} clip{appendedClips.length !== 1 ? 's' : ''} ready to append</Label>
                          {appendedClips.map((clip, i) => (
                            <div key={i} className="flex items-center gap-2 bg-muted/50 rounded-lg p-2">
                              <video src={clip.videoUrl} className="w-16 h-10 rounded object-cover" muted />
                              <div className="flex-1 min-w-0">
                                <p className="text-xs truncate">{clip.prompt}</p>
                                <p className="text-xs text-muted-foreground">{clip.duration}s</p>
                              </div>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-6 w-6 p-0"
                                onClick={() => setAppendedClips(prev => prev.filter((_, idx) => idx !== i))}
                              >
                                <X className="w-3 h-3" />
                              </Button>
                            </div>
                          ))}
                          <Button
                            onClick={restitchWithAppendedClips}
                            disabled={isRestitching}
                            className="w-full gap-2 bg-gradient-to-r from-primary to-accent hover:opacity-90"
                          >
                            {isRestitching ? (
                              <><Loader2 className="w-4 h-4 animate-spin" /> Re-stitching...</>
                            ) : (
                              <><Layers className="w-4 h-4" /> Re-stitch with {appendedClips.length} New Clip{appendedClips.length !== 1 ? 's' : ''}</>
                            )}
                          </Button>
                          {isRestitching && (
                            <div className="space-y-1">
                              <Progress value={progress} className="h-2" />
                              <p className="text-xs text-center text-muted-foreground">{progressStatus}</p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
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

                        {/* Swap Product in Scene */}
                        {scene.imageUrl && (
                          <div className="space-y-2">
                            <Label className="flex items-center gap-1">
                              <Package className="w-3 h-3" />
                              Swap Product
                            </Label>
                            <p className="text-xs text-muted-foreground">
                              Upload the correct product image to replace what's in the scene.
                            </p>
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              id={`product-swap-input-${editingSceneNumber}`}
                              onChange={async (e) => {
                                const file = e.target.files?.[0];
                                if (!file || !user) return;
                                
                                toast({ title: "Swapping Product...", description: "Uploading and replacing product in scene." });
                                
                                try {
                                  // Upload product image to storage
                                  const fileName = `product-swap-${Date.now()}.${file.name.split('.').pop()}`;
                                  const { data: uploadData, error: uploadError } = await supabase.storage
                                    .from('generated-images')
                                    .upload(`${user.id}/${fileName}`, file, { contentType: file.type });
                                  
                                  if (uploadError) throw uploadError;
                                  
                                  const { data: urlData } = supabase.storage
                                    .from('generated-images')
                                    .getPublicUrl(`${user.id}/${fileName}`);
                                  
                                  const productImageUrl = urlData.publicUrl;
                                  
                                  // Analyze product image to get accurate description
                                  let productDesc = '';
                                  try {
                                    const { data: analyzeData } = await supabase.functions.invoke('analyze-product', {
                                      body: { imageUrl: productImageUrl }
                                    });
                                    const info = analyzeData?.productInfo;
                                    if (info) {
                                      productDesc = [info.productName, info.description, info.category ? `(${info.category})` : ''].filter(Boolean).join(' — ');
                                    }
                                  } catch (e) {
                                    console.warn('Product analysis failed, using generic prompt:', e);
                                  }
                                  
                                  const swapPrompt = productDesc
                                    ? `Replace the product/object being held or displayed with: ${productDesc}. Use the reference image for exact visual appearance. Keep the person, pose, lighting, and background exactly the same. Only swap the product.`
                                    : `Replace the product/object being held or displayed in this scene with the product shown in the reference image. Keep the person, pose, lighting, and background exactly the same. Only swap the product.`;
                                  
                                  // Use edit-scene-image to swap product
                                  const { data: editData, error: editError } = await supabase.functions.invoke('edit-scene-image', {
                                    body: {
                                      sceneImageUrl: scene.imageUrl,
                                      referenceImageUrl: productImageUrl,
                                      editPrompt: swapPrompt,
                                      aspectRatio: '9:16'
                                    }
                                  });
                                  
                                  if (editError) throw editError;
                                  
                                  if (editData?.imageUrl) {
                                    // Update scene image
                                    setProject(prev => ({
                                      ...prev,
                                      generatedScenes: prev.generatedScenes.map(s =>
                                        s.sceneNumber === editingSceneNumber ? { ...s, imageUrl: editData.imageUrl, videoUrl: undefined } : s
                                      ),
                                      videoClips: prev.videoClips.filter(c => c.sceneNumber !== editingSceneNumber)
                                    }));
                                    
                                    toast({ title: "Product Swapped!", description: "Scene image updated with the correct product. You can now regenerate the video." });
                                  }
                                } catch (err: any) {
                                  console.error('Product swap failed:', err);
                                  toast({ title: "Swap Failed", description: err.message || "Could not swap product.", variant: "destructive" });
                                }
                                
                                // Reset input
                                e.target.value = '';
                              }}
                            />
                            <Button
                              size="sm"
                              variant="outline"
                              className="w-full"
                              onClick={() => {
                                document.getElementById(`product-swap-input-${editingSceneNumber}`)?.click();
                              }}
                            >
                              <Package className="w-3 h-3 mr-1" />
                              Upload & Swap Product
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
                      
                      {/* Scene clips grid - only show if there are actual video clips */}
                      {videoClips.length > 0 && (
                        <div className="p-3 border-t border-border">
                          <p className="text-xs text-muted-foreground mb-2">Scene Clips ({videoClips.length}):</p>
                          <div className="grid grid-cols-5 gap-1">
                            {reel.scenes?.map((scene, idx) => {
                              if (!scene.videoUrl) return null;
                              return (
                                <VideoPlayer
                                  key={idx}
                                  videoUrl={scene.videoUrl}
                                  title={`Scene ${idx + 1} — ${reel.topic}`}
                                  trigger={
                                    <button className="aspect-square rounded overflow-hidden bg-muted relative group cursor-pointer border border-transparent hover:border-primary transition-colors">
                                      {scene.imageUrl ? (
                                        <img src={scene.imageUrl} alt={`Scene ${idx + 1}`} className="w-full h-full object-cover" />
                                      ) : (
                                        <div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground">{idx + 1}</div>
                                      )}
                                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                        <Play className="w-4 h-4 text-white" />
                                      </div>
                                    </button>
                                  }
                                />
                              );
                            })}
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
                            onClick={() => restoreAsDraft(reel)}
                            title="Restore as editable draft"
                          >
                            <FolderOpen className="w-4 h-4 mr-2" />
                            Restore
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
                          {reel.video_url && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleAddCaptions(reel)}
                              disabled={addingCaptionsId === reel.id}
                              title={reel.video_url_no_captions ? 'Re-add captions' : 'Add captions'}
                            >
                              {addingCaptionsId === reel.id ? (
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              ) : (
                                <Captions className="w-4 h-4 mr-2" />
                              )}
                              Captions
                            </Button>
                          )}
                          {reel.video_url_no_captions && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleRemoveCaptions(reel)}
                              title="Remove captions and restore original"
                            >
                              <X className="w-4 h-4 mr-2" />
                              Remove Captions
                            </Button>
                          )}
                          {reel.video_url && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setContinueVideoReel(reel)}
                              title="Continue / extend this video"
                            >
                              <Film className="w-4 h-4 mr-2" />
                              Continue
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
          <ScriptGenerator onUseInReel={(scenes) => {
            // Save current work as draft before starting fresh
            if (project.scenes.length > 0 || topic?.trim()) {
              saveDraftDebounced({
                topic, selectedSceneCount, selectedSceneDuration, selectedVoice,
                selectedVideoSize, transitionStyle, hookStyle, characterDescription,
                preSelectedReference, selectedTwinId, selectedIntro, selectedOutro,
                introText, outroText, enableCutScenes, enableLipSync, portraitImage,
                project, featureToggles, strategist: strategistState
              });
            }

            // Start completely fresh reel with imported scenes
            const sceneTopic = scenes[0]?.narration?.slice(0, 60) || 'Imported Script';
            setTopic(sceneTopic);
            setProject({
              topic: sceneTopic,
              scenes,
              voiceovers: [],
              videoUrl: null,
              videoBlobUrl: null,
              generatedScenes: [],
              videoClips: [],
              previewScenes: [],
              status: 'idle'
            });
            setSelectedSceneCount(String(scenes.length));
            setSelectedClipIndex(0);
            setProgress(0);
            setProgressStatus('');
            setVideoError(null);
            setSelectedIntro('none');
            setSelectedOutro('none');
            setIntroText('');
            setOutroText('');
            setCharacterTransformation('');
            setCurrentReelSaved(false);
            setBeginnerStep(isBeginner ? 2 : 1);
            resetPreview();
            setShowScriptGenerator(false);
            if (activeMode === 'script-only') setActiveMode('standard');
            toast({ title: "Script Imported", description: `${scenes.length} scenes imported into a fresh reel.` });
          }} />
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

      {/* Caption Preview Dialog */}
      {captionPreviewReel && (
        <CaptionPreviewDialog
          open={!!captionPreviewReel}
          onOpenChange={(open) => { if (!open) { setCaptionPreviewReel(null); setCaptionedVideoUrl(null); } }}
          originalVideoUrl={captionPreviewReel.video_url!}
          captionedVideoUrl={captionedVideoUrl}
          isProcessing={isBurningCaptions}
          onSave={handleSaveCaptions}
          onDiscard={() => { setCaptionPreviewReel(null); setCaptionedVideoUrl(null); }}
        />
      )}

      {/* Continue Video Panel */}
      {continueVideoReel && (
        <ContinueVideoPanel
          open={!!continueVideoReel}
          onOpenChange={(open) => { if (!open) setContinueVideoReel(null); }}
          reelId={continueVideoReel.id}
          videoUrl={continueVideoReel.video_url!}
          audioUrl={continueVideoReel.audio_url}
          scenes={continueVideoReel.scenes || []}
          onComplete={(newVideoUrl) => {
            setSavedReels(prev => prev.map(r =>
              r.id === continueVideoReel.id ? { ...r, video_url: newVideoUrl } : r
            ));
            supabase.from('reels').update({ video_url: newVideoUrl }).eq('id', continueVideoReel.id);
            setContinueVideoReel(null);
          }}
        />
      )}
    </Layout>
  );
};

export default Reels;
