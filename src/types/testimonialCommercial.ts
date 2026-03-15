export type SegmentType = 'speaking' | 'broll';
export type TransitionType = 'fade-in' | 'cut' | 'crossfade';

export interface CharacterProfile {
  name: string;
  description: string;
  gender?: string;
  referenceImages: string[]; // 6 cinematic angles
  twinId?: string; // If saved as AI twin
}

export interface CommercialSegment {
  id: string;
  type: SegmentType;
  character?: CharacterProfile;
  script?: string;
  brollPrompts?: string[];
  brollImages?: string[];
  voiceoverText?: string;
  productImageUrl?: string; // User-uploaded product image for swapping
  duration: number;
  transition: TransitionType;
  videoUrl?: string;
  audioUrl?: string;
  status?: 'pending' | 'generating-character' | 'character-ready' | 'approved' | 'generating' | 'complete' | 'error';
  // Legacy compatibility
  twinId?: string;
  twinName?: string;
  voiceoverId?: string;
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
