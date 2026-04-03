// Shared AI Twin interface used across the platform
export type VoiceEngine = 'speechify' | 'wavespeed';

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
