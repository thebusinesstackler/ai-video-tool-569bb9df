export type SegmentType = 'twin-speaking' | 'broll-voice-continue' | 'broll-montage';
export type TransitionType = 'fade-in' | 'cut' | 'crossfade';
export type ImageGenerationStatus = 'pending' | 'generating' | 'complete' | 'error';

export interface BrollImageSlot {
  prompt: string;
  imageUrl?: string;
  status: ImageGenerationStatus;
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
  brollSlots?: BrollImageSlot[]; // New structured B-roll with individual image status
  voiceoverId?: string;
  voiceoverText?: string;
  duration: number;
  transition: TransitionType;
  videoUrl?: string;
  audioUrl?: string;
  status?: 'pending' | 'generating' | 'complete' | 'error';
  imagesApproved?: boolean; // Whether B-roll images have been reviewed and approved
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
