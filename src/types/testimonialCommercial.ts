export type SegmentType = 'twin-speaking' | 'broll-voice-continue' | 'broll-montage';
export type TransitionType = 'fade-in' | 'cut' | 'crossfade' | 'wipe' | 'slide' | 'whip-pan' | 'match-cut' | 'j-cut' | 'l-cut';
export type ImageGenerationStatus = 'pending' | 'generating' | 'complete' | 'error';
export type SegmentStatus = 'incomplete' | 'ready' | 'pending' | 'generating' | 'complete' | 'error';

// Readiness check for segment validation
export interface ReadinessCheck {
  id: string;
  label: string;
  isComplete: boolean;
  isRequired: boolean;
  hint?: string;
}

export interface SegmentReadiness {
  isReady: boolean;
  checks: ReadinessCheck[];
  missingRequired: string[];
}

// Professional cinematography camera angles
export type CameraAngle = 
  | 'extreme-wide'      // Vast establishing shot
  | 'wide'              // Full environment context
  | 'medium-wide'       // Waist-up with environment
  | 'medium'            // Standard interview framing
  | 'medium-close'      // Chest-up, intimate but contextual
  | 'close-up'          // Face fills frame
  | 'extreme-close-up'  // Eyes or detail only
  | 'over-shoulder'     // OTS conversation angle
  | 'two-shot'          // Two people in frame
  | 'low-angle'         // Looking up, heroic/powerful
  | 'high-angle'        // Looking down, vulnerable/overview
  | 'dutch-angle'       // Tilted for tension/unease
  | 'birds-eye'         // Directly overhead
  | 'worms-eye'         // From ground looking up
  | 'pov'               // First-person perspective
  | 'profile'           // Side view, cinematic
  | 'three-quarter';    // 45-degree classic portrait

// Detailed camera movements - Super Bowl quality
export type CameraMovement = 
  // Static & Subtle
  | 'locked-off'            // Perfectly still, professional
  | 'subtle-float'          // Barely perceptible movement, adds life
  | 'breathing'             // Very slight in-out, organic feel
  
  // Zoom movements
  | 'slow-zoom-in'          // Gradual push toward subject
  | 'fast-zoom-in'          // Dramatic snap zoom
  | 'slow-zoom-out'         // Gradual reveal of context
  | 'crash-zoom'            // Jarring quick zoom for impact
  | 'zoom-to-close-up'      // From wide to face, emotional
  | 'zoom-from-detail'      // Start tight, reveal scene
  
  // Dolly movements
  | 'dolly-in'              // Camera physically moves toward
  | 'dolly-out'             // Camera physically pulls back
  | 'dolly-around'          // Circular movement around subject
  | 'push-in-dramatic'      // Slow, intentional approach
  | 'pull-back-reveal'      // Dramatic context reveal
  
  // Pan movements
  | 'slow-pan-left'         // Deliberate horizontal sweep left
  | 'slow-pan-right'        // Deliberate horizontal sweep right
  | 'whip-pan'              // Fast blur transition
  | 'pan-reveal'            // Pan to reveal something new
  | 'pan-follow'            // Following action horizontally
  | 'pan-across-room'       // Sweeping environmental pan
  | 'corner-reveal-pan'     // Starting at wall, revealing around corner
  
  // Tilt movements
  | 'tilt-up'               // Vertical pan upward
  | 'tilt-down'             // Vertical pan downward
  | 'tilt-reveal'           // Tilt to show something new
  
  // Tracking movements
  | 'tracking-alongside'    // Moving parallel with subject
  | 'tracking-behind'       // Following from behind
  | 'tracking-in-front'     // Leading the subject
  | 'steadicam-float'       // Smooth floating movement
  | 'gimbal-glide'          // Ultra-smooth modern stabilized
  
  // Dynamic/Handheld
  | 'handheld-subtle'       // Slight documentary feel
  | 'handheld-energetic'    // More movement, urgency
  | 'shaky-cam'             // Intentional instability
  
  // Crane movements
  | 'crane-up'              // Rising overhead shot
  | 'crane-down'            // Descending into scene
  | 'jib-sweep'             // Arcing overhead movement
  
  // Complex combinations
  | 'dolly-zoom'            // Vertigo effect
  | 'orbit'                 // 360 around subject
  | 'arc-left'              // Semi-circular left
  | 'arc-right'             // Semi-circular right
  | 'boom-down-to-eye-level'// From above to meet subject
  | 'rise-and-reveal';      // Lift up to show environment

// Visual continuity tracking for consistent backgrounds
export interface VisualContext {
  location: string;           // "modern corner office", "clinical waiting room"
  backgroundElements: string; // "floor-to-ceiling windows, city skyline, mahogany desk"
  lighting: string;           // "warm afternoon sun, soft shadows from left"
  colorPalette: string;       // "warm browns, cream walls, hints of green from plants"
  props: string;              // "laptop, coffee mug, framed family photo"
  atmosphere: string;         // "professional yet warm, lived-in executive space"
}

// Individual shot variation for multi-angle coverage
export interface ShotVariation {
  id: string;
  angle: CameraAngle;
  movement: CameraMovement;
  movementDescription: string; // Detailed description: "Starting wide on the desk from 20 feet, slowly zooming in over 8 seconds to rest on her face in a tight close-up"
  prompt: string;
  duration: number;
  imageUrl?: string;
  videoUrl?: string;
  status: ImageGenerationStatus;
  isSelected?: boolean;
  visualContext?: VisualContext; // For background consistency
  startFrame?: string;  // Description of where camera starts
  endFrame?: string;    // Description of where camera ends
}

// Enhanced B-roll sequence structure with shot metadata
export interface BrollSequence {
  shots: ShotVariation[];
  isMontage: boolean;
  transitionStyle?: 'cut' | 'crossfade' | 'match-cut' | 'whip-pan' | 'invisible';
  pacing?: 'slow-deliberate' | 'rhythmic' | 'building' | 'frenetic';
}

// Scene coverage for visual consistency across angles
export interface SceneCoverage {
  establishingShot?: string;
  povShot?: string;
  detailShot?: string;
  reactionShot?: string;
  reverseAngle?: string;
  insertShot?: string;
  cutaway?: string;
  visualContext?: VisualContext; // Master context for the scene
}

export interface BrollImageSlot {
  prompt: string;
  imageUrl?: string;
  status: ImageGenerationStatus;
  angle?: CameraAngle;
  movement?: CameraMovement;
  movementDescription?: string;
  duration?: number;
  startFrame?: string;
  endFrame?: string;
}

export interface CommercialSegment {
  id: string;
  type: SegmentType;
  twinId?: string;
  twinName?: string;
  personaDescription?: string;
  script?: string;
  voiceover?: string;
  brollImages?: string[];
  brollPrompts?: string[];
  brollSlots?: BrollImageSlot[];
  brollSequence?: BrollSequence;
  voiceoverId?: string;
  voiceoverText?: string;
  duration: number;
  transition: TransitionType;
  videoUrl?: string;
  audioUrl?: string;
  status?: 'pending' | 'generating' | 'complete' | 'error';
  imagesApproved?: boolean;
  
  // Multi-angle A-roll support
  arollVariations?: ShotVariation[];
  selectedArollIndex?: number;
  sceneCoverage?: SceneCoverage;
  visualContext?: VisualContext; // Maintain visual consistency when speaker returns
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
  globalVisualContext?: Record<string, VisualContext>; // Track visual contexts by speaker/location
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
  volume: number;
  fadeIn: number;
  fadeOut: number;
}

export interface EnhancedStitchRequest {
  segments: {
    type: 'aroll' | 'broll' | 'montage';
    clips: EnhancedVideoClip[];
    audioUrl?: string;
    voiceContinues?: boolean;
  }[];
  voiceoverTrack?: string;
  backgroundMusic?: BackgroundMusicConfig;
}
