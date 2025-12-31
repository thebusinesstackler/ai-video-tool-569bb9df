export type SegmentType = 'twin-speaking' | 'broll-voice-continue' | 'broll-montage';
export type TransitionType = 'fade-in' | 'cut' | 'crossfade' | 'wipe' | 'slide';
export type ImageGenerationStatus = 'pending' | 'generating' | 'complete' | 'error';

// Professional cinematography types
export type CameraAngle = 'wide' | 'medium' | 'close-up' | 'over-shoulder' | 'low-angle' | 'high-angle' | 'dutch-angle' | 'pov';
export type CameraMovement = 'static' | 'push-in' | 'pull-out' | 'pan-left' | 'pan-right' | 'tracking' | 'handheld' | 'dolly';

// Individual shot variation for multi-angle coverage
export interface ShotVariation {
  id: string;
  angle: CameraAngle;
  movement: CameraMovement;
  prompt: string;
  duration: number; // 1.5-3s for montage, 5-15s for A-roll
  imageUrl?: string;
  videoUrl?: string;
  status: ImageGenerationStatus;
  isSelected?: boolean; // Whether this is the selected take for final edit
}

// Enhanced B-roll sequence structure with shot metadata
export interface BrollSequence {
  shots: ShotVariation[];
  isMontage: boolean; // true = rapid 1.5-3s cuts, false = longer contextual shots
  transitionStyle?: 'cut' | 'crossfade' | 'match-cut';
}

// Scene coverage for visual consistency across angles
export interface SceneCoverage {
  establishingShot?: string;
  povShot?: string;
  detailShot?: string;
  reactionShot?: string;
  reverseAngle?: string;
}

export interface BrollImageSlot {
  prompt: string;
  imageUrl?: string;
  status: ImageGenerationStatus;
  angle?: CameraAngle;
  movement?: CameraMovement;
  duration?: number;
}

export interface CommercialSegment {
  id: string;
  type: SegmentType;
  twinId?: string;
  twinName?: string;
  personaDescription?: string; // Auto-generated persona when no AI Twin is selected
  script?: string;
  voiceover?: string; // For broll-montage segments
  brollImages?: string[];
  brollPrompts?: string[];
  brollSlots?: BrollImageSlot[]; // Structured B-roll with individual image status
  brollSequence?: BrollSequence; // Enhanced B-roll with camera metadata
  voiceoverId?: string;
  voiceoverText?: string;
  duration: number;
  transition: TransitionType;
  videoUrl?: string;
  audioUrl?: string;
  status?: 'pending' | 'generating' | 'complete' | 'error';
  imagesApproved?: boolean; // Whether B-roll images have been reviewed and approved
  
  // Multi-angle A-roll support
  arollVariations?: ShotVariation[]; // Multiple camera angles for speaking segments
  selectedArollIndex?: number; // Which A-roll variation to use in final edit
  sceneCoverage?: SceneCoverage; // Multi-angle planning metadata
}

export interface TestimonialCommercial {
  id: string;
  user_id: string;
  name: string;
  segments: CommercialSegment[];
  video_url?: string;
  audio_url?: string;
  created_at: string;
  updated_at: string;
}

// Enhanced request types for professional stitching
export interface EnhancedVideoClip {
  url: string;
  duration: number;
  angle?: CameraAngle;
  movement?: CameraMovement;
  isAroll?: boolean;
  isMontage?: boolean;
  caption?: string;
}

export interface BackgroundMusicConfig {
  url: string;
  volume: number; // 0-100
  fadeIn: number; // seconds
  fadeOut: number; // seconds
}

export interface EnhancedStitchRequest {
  segments: {
    type: 'aroll' | 'broll' | 'montage';
    clips: EnhancedVideoClip[];
    audioUrl?: string;
    voiceContinues?: boolean; // Audio from previous segment continues
  }[];
  voiceoverTrack?: string; // Full commercial audio
  backgroundMusic?: BackgroundMusicConfig;
}
