export type SegmentType = 'twin-speaking' | 'broll-voice-continue' | 'broll-montage';
export type TransitionType = 'fade-in' | 'cut' | 'crossfade';

export interface CommercialSegment {
  id: string;
  type: SegmentType;
  twinId?: string;
  twinName?: string;
  script?: string;
  brollImages?: string[];
  brollPrompts?: string[];
  voiceoverId?: string;
  voiceoverText?: string;
  duration: number;
  transition: TransitionType;
  videoUrl?: string;
  audioUrl?: string;
  status?: 'pending' | 'generating' | 'complete' | 'error';
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
