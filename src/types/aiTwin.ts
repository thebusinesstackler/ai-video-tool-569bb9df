// Shared AI Twin interface used across the platform
export type VoiceEngine = 'speechify' | 'google-cloud' | 'wavespeed';

export interface AITwin {
  id: string;
  name: string;
  reference_images: string[];
  voice_cloning_key: string | null;
  voice_sample_url?: string | null;
  face_description: string | null;
  gender: string | null;
  description?: string | null;
  consent_audio_url?: string | null;
  voice_engine?: VoiceEngine;
  google_voice_id?: string | null;
}

// Curated Google Cloud TTS voices (premium quality)
export const GOOGLE_CLOUD_VOICES = [
  { id: 'en-US-Studio-M', label: 'Studio M', gender: 'male', family: 'Studio' },
  { id: 'en-US-Studio-O', label: 'Studio O', gender: 'female', family: 'Studio' },
  { id: 'en-US-Studio-Q', label: 'Studio Q', gender: 'male', family: 'Studio' },
  { id: 'en-US-Neural2-A', label: 'Neural2 A', gender: 'male', family: 'Neural2' },
  { id: 'en-US-Neural2-C', label: 'Neural2 C', gender: 'female', family: 'Neural2' },
  { id: 'en-US-Neural2-D', label: 'Neural2 D', gender: 'male', family: 'Neural2' },
  { id: 'en-US-Neural2-F', label: 'Neural2 F', gender: 'female', family: 'Neural2' },
] as const;
