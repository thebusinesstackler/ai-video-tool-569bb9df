/**
 * Enhanced Timeline Types for ChatCut AI
 * ---------------------------------------
 * Comprehensive type definitions for professional video editing.
 */

export interface TimelineClip {
  id: string;
  type: 'video' | 'image' | 'audio';
  url: string;
  name: string;
  startTime: number;
  duration: number;
  trackIndex: number;
  
  // Trimming (non-destructive)
  trimStart?: number;  // Seconds to trim from source start
  trimEnd?: number;    // Seconds to trim from source end
  
  // Playback
  speed?: number;      // Playback speed multiplier (0.5 = half speed, 2.0 = double speed)
  volume?: number;     // Audio volume (0-1, for video clips with audio)
  
  // Visual filters (for video/image clips)
  filters?: {
    brightness?: number;  // -100 to 100
    contrast?: number;    // -100 to 100
    saturation?: number;  // -100 to 100
    hue?: number;         // 0 to 360 degrees
    blur?: number;        // 0 to 100
    opacity?: number;     // 0 to 1
  };
  
  // Audio processing (for audio/voiceover clips)
  audioFade?: {
    in: number;   // Fade in duration (seconds)
    out: number;  // Fade out duration (seconds)
  };
  
  // Transform
  transform?: {
    x: number;        // Horizontal position (-1 to 1, 0 = center)
    y: number;        // Vertical position (-1 to 1, 0 = center)
    scale: number;    // Scale multiplier (1.0 = 100%)
    rotation: number; // Rotation in degrees
  };
  
  // State
  locked?: boolean;
  hidden?: boolean;
  muted?: boolean;
  
  // Metadata
  thumbnail?: string;
  waveformData?: number[];  // Cached audio waveform amplitudes
  
  // Scene-specific (for generated video scenes)
  sceneNumber?: number;
  narration?: string;
  visualDescription?: string;
  actor?: string;
  product?: string;
  cameraDirection?: string;
  expression?: string;
  movement?: string;
}

export interface TimelineOverlay {
  id: string;
  type: 'text' | 'image' | 'shape' | 'motion_graphic';
  startTime: number;
  duration: number;
  
  // Text overlays
  text?: string;
  fontSize?: number;
  fontFamily?: string;
  fontWeight?: 'normal' | 'bold' | '100' | '200' | '300' | '400' | '500' | '600' | '700' | '800' | '900';
  color?: string;
  backgroundColor?: string;
  textAlign?: 'left' | 'center' | 'right';
  
  // Image overlays
  imageUrl?: string;
  
  // Motion graphics (VEO-generated animations)
  motionGraphicType?: 'stat_card' | 'kinetic_headline' | 'side_notes' | 'cta_lockup';
  motionGraphicData?: any;
  
  // Positioning
  position: {
    x: number;     // Percentage from left (0-100)
    y: number;     // Percentage from top (0-100)
    width: number; // Percentage of container (0-100)
    height: number; // Percentage of container (0-100)
    anchor?: 'top-left' | 'top-center' | 'top-right' | 'center-left' | 'center' | 'center-right' | 'bottom-left' | 'bottom-center' | 'bottom-right';
  };
  
  // Animation
  animation?: {
    type: 'none' | 'fade' | 'slide-up' | 'slide-down' | 'slide-left' | 'slide-right' | 'zoom' | 'typewriter' | 'pop';
    duration?: number;      // Animation duration (seconds)
    delay?: number;         // Delay before animation starts (seconds)
    easing?: 'linear' | 'ease' | 'ease-in' | 'ease-out' | 'ease-in-out';
  };
  
  // Transform
  transform?: {
    scale: number;
    rotation: number;
    skewX?: number;
    skewY?: number;
  };
  
  // State
  locked?: boolean;
  hidden?: boolean;
  opacity?: number;
  
  // z-index for layering
  zIndex?: number;
}

export interface TimelineTransition {
  id: string;
  type: 'cut' | 'fade' | 'dissolve' | 'slide' | 'zoom' | 'blur' | 'wipe' | 'spin' | 'dip_to_black' | 'dip_to_white' | 'cross_dissolve';
  afterClipId: string;  // Transition appears after this clip
  duration: number;     // Transition duration (seconds)
  
  // Advanced transition options
  easing?: 'linear' | 'ease' | 'ease-in' | 'ease-out' | 'ease-in-out' | 'cubic-bezier';
  direction?: 'left' | 'right' | 'up' | 'down';
  
  // Custom parameters
  parameters?: Record<string, any>;
}

export interface TimelineMarker {
  id: string;
  time: number;
  label: string;
  color?: string;
  type?: 'chapter' | 'comment' | 'cue' | 'beat';
  
  // Chapter markers for export
  chapterData?: {
    title: string;
    description?: string;
    thumbnail?: string;
  };
  
  // Comment markers for collaboration
  commentData?: {
    author: string;
    text: string;
    resolved?: boolean;
    replies?: Array<{
      author: string;
      text: string;
      timestamp: Date;
    }>;
  };
}

export interface TimelineTrack {
  id: string;
  name: string;
  type: 'video' | 'audio' | 'overlay' | 'music' | 'voiceover' | 'sfx';
  clips: TimelineClip[];
  overlays?: TimelineOverlay[];
  
  // Track-level controls
  volume?: number;    // Master volume for audio tracks (0-1)
  muted?: boolean;
  soloed?: boolean;   // Solo this track (mute all others)
  locked?: boolean;
  hidden?: boolean;
  
  // Visual
  color?: string;
  height?: number;    // Track height in pixels
  collapsed?: boolean;
}

export interface Timeline {
  id: string;
  name: string;
  duration: number;
  fps: number;        // Frame rate (24, 30, 60, etc.)
  aspectRatio: string; // '16:9', '9:16', '1:1', '4:5', etc.
  resolution: {
    width: number;
    height: number;
  };
  
  tracks: TimelineTrack[];
  transitions: TimelineTransition[];
  markers: TimelineMarker[];
  
  // Global settings
  backgroundColor?: string;
  backgroundMusicUrl?: string;
  
  // Metadata
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string;
  version?: number;
}

export interface EditorState {
  timeline: Timeline;
  
  // Playback state
  currentTime: number;
  isPlaying: boolean;
  playbackRate: number;
  volume: number;
  isMuted: boolean;
  loop?: boolean;
  inPoint?: number;   // Loop in-point (seconds)
  outPoint?: number;  // Loop out-point (seconds)
  
  // UI state
  zoom: number;       // Timeline zoom level (0.25 to 20)
  scrollOffset: number; // Horizontal scroll position
  selectedTrackId?: string;
  selectedClipIds: string[];
  selectedOverlayIds: string[];
  selectedTransitionIds: string[];
  
  // Tool state
  activeTool: 'select' | 'razor' | 'slip' | 'slide' | 'zoom' | 'pan';
  snapEnabled: boolean;
  snapTolerance: number; // Seconds
  
  // View options
  showWaveforms: boolean;
  showThumbnails: boolean;
  showMarkers: boolean;
  showSafeZones: boolean;
  showGridLines: boolean;
  
  // History
  undoStack: Timeline[];
  redoStack: Timeline[];
  maxHistorySize: number;
  
  // Auto-save
  hasUnsavedChanges: boolean;
  lastSavedAt?: Date;
  autoSaveInterval: number; // Milliseconds
}

export interface CutSuggestion {
  id: string;
  time: number;
  type: 'pause' | 'filler' | 'scene_change' | 'beat' | 'breath' | 'jump_cut' | 'awkward' | 'mistake';
  confidence: number; // 0-1
  reason: string;
  
  // Context
  clipId?: string;
  audioAnalysis?: {
    volume: number;
    frequency: number;
    transcript?: string;
  };
  
  // Actions
  suggestedAction?: 'split' | 'delete' | 'trim';
  suggestedDuration?: number; // For trim suggestions
}

export interface TimelineExportConfig {
  format: 'mp4' | 'mov' | 'webm' | 'gif';
  quality: 'draft' | 'good' | 'high' | 'maximum';
  resolution: {
    width: number;
    height: number;
  };
  fps: number;
  bitrate?: number; // Mbps
  
  // Audio
  audioCodec?: 'aac' | 'mp3' | 'opus';
  audioBitrate?: number; // Kbps
  audioSampleRate?: number; // Hz
  
  // Options
  includeAlpha?: boolean;  // For transparent backgrounds
  burnSubtitles?: boolean;
  chapters?: boolean;      // Include chapter markers
  
  // Output
  filename: string;
  outputPath?: string;
}

// Helper types
export type ClipId = string;
export type TrackId = string;
export type OverlayId = string;
export type TransitionId = string;
export type MarkerId = string;

// Event types for timeline interactions
export interface TimelineEvent {
  type: 'clip_added' | 'clip_removed' | 'clip_moved' | 'clip_trimmed' | 'clip_split' |
        'overlay_added' | 'overlay_removed' | 'overlay_moved' | 'overlay_edited' |
        'transition_added' | 'transition_removed' | 'transition_edited' |
        'marker_added' | 'marker_removed' | 'marker_moved' |
        'track_added' | 'track_removed' | 'track_reordered' |
        'playback_started' | 'playback_stopped' | 'playback_seeked' |
        'timeline_saved' | 'timeline_exported';
  timestamp: Date;
  data?: any;
}

// Utility types
export type TimelineSelection = {
  clips: ClipId[];
  overlays: OverlayId[];
  transitions: TransitionId[];
  markers: MarkerId[];
};

export type DragOperation = {
  type: 'move' | 'resize-left' | 'resize-right' | 'slip' | 'slide';
  itemId: string;
  startX: number;
  startY?: number;
  startTime: number;
  startDuration?: number;
  currentX: number;
  currentY?: number;
  snapPoints: number[];
  constrainToTrack?: boolean;
};

// Snap calculation
export interface SnapPoint {
  time: number;
  type: 'clip_start' | 'clip_end' | 'marker' | 'playhead' | 'grid' | 'in_point' | 'out_point';
  clipId?: string;
  markerId?: string;
}
