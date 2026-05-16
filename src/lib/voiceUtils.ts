// Shared voice routing helpers — keeps Movies, Reels, and Lifestyle Stories
// on identical TTS routing logic (Speechify clone → Google clone → fallback).

import type { AITwin } from '@/types/aiTwin';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isSpeechifyVoiceId(voiceKey: string | null | undefined): boolean {
  if (!voiceKey) return false;
  return UUID_REGEX.test(voiceKey);
}

export interface VoicePayload {
  text: string;
  voice: string;
  speechifyVoiceId?: string;
  voiceCloningKey?: string;
  gender?: string;
}

/**
 * Builds the body for the `text-to-speech` edge function so that it
 * uses the AI Twin's cloned voice (Speechify or Google) when available.
 * Mirrors the routing used by MovieSceneCreator.
 */
export function buildVoicePayload(
  text: string,
  twin?: Pick<AITwin, 'voice_cloning_key' | 'gender'> | null,
): VoicePayload {
  const key = twin?.voice_cloning_key || undefined;
  const speechify = isSpeechifyVoiceId(key) ? key : undefined;
  const google = key && !speechify ? key : undefined;

  return {
    text,
    voice: 'cloned',
    speechifyVoiceId: speechify,
    voiceCloningKey: google,
    gender: twin?.gender || undefined,
  };
}

/**
 * Shape matching multi-voice-tts voiceAssignments[].
 */
export interface VoiceAssignment {
  characterName: string;
  speechifyVoiceId?: string;
  voiceCloningKey?: string;
  defaultVoice?: string;
  gender?: string;
  voiceEngine?: string;
  googleVoiceId?: string;
}

export function buildVoiceAssignments(
  twins: Array<{ name: string } & Partial<AITwin>>,
): VoiceAssignment[] {
  return twins.map((t) => {
    const speechify = isSpeechifyVoiceId(t.voice_cloning_key) ? t.voice_cloning_key! : undefined;
    const google = t.voice_cloning_key && !speechify ? t.voice_cloning_key : undefined;
    return {
      characterName: t.name,
      speechifyVoiceId: speechify,
      voiceCloningKey: google,
      gender: t.gender || undefined,
      voiceEngine: t.voice_engine || undefined,
      googleVoiceId: t.google_voice_id || undefined,
    };
  });
}
