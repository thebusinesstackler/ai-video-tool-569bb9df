import { useCallback, useRef } from 'react';
import { CommercialSegment } from '@/types/testimonialCommercial';

const STORAGE_KEY = 'commercial-studio-draft';
const EXPIRY_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const DEBOUNCE_MS = 2000;

export interface CommercialDraft {
  name: string;
  segments: CommercialSegment[];
  targetDuration: string;
  videoFormat: string;
  videoStyle: string;
  finalVideoUrl: string | null;
  musicUrl: string | null;
  savedAt: number;
}

function cleanSegmentsForStorage(segments: CommercialSegment[]): CommercialSegment[] {
  return segments.map(seg => ({
    ...seg,
    // Keep remote URLs but strip base64 data to avoid quota issues
    character: seg.character ? {
      ...seg.character,
      referenceImages: (seg.character.referenceImages || []).filter(url => !url.startsWith('data:')),
    } : undefined,
    brollImages: (seg.brollImages || []).filter(url => !url.startsWith('data:')),
    audioUrl: seg.audioUrl?.startsWith('data:') ? undefined : seg.audioUrl,
    videoUrl: seg.videoUrl?.startsWith('data:') ? undefined : seg.videoUrl,
  }));
}

export function useCommercialDraft() {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const saveDraft = useCallback((draft: Omit<CommercialDraft, 'savedAt'>) => {
    // Don't save empty drafts
    if (!draft.name || (draft.name === 'Untitled Commercial' && draft.segments.length === 0)) return;

    const data: CommercialDraft = {
      ...draft,
      segments: cleanSegmentsForStorage(draft.segments),
      savedAt: Date.now(),
    };

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {
      // Quota exceeded — save minimal version
      try {
        localStorage.removeItem(STORAGE_KEY);
        const minimal: CommercialDraft = {
          ...data,
          segments: data.segments.map(s => ({
            ...s,
            character: s.character ? { ...s.character, referenceImages: [] } : undefined,
            brollImages: [],
          })),
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(minimal));
      } catch { /* give up */ }
    }
  }, []);

  const saveDraftDebounced = useCallback((draft: Omit<CommercialDraft, 'savedAt'>) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => saveDraft(draft), DEBOUNCE_MS);
  }, [saveDraft]);

  const loadDraft = useCallback((): CommercialDraft | null => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const data: CommercialDraft = JSON.parse(raw);
      if (Date.now() - data.savedAt > EXPIRY_MS) {
        localStorage.removeItem(STORAGE_KEY);
        return null;
      }
      return data;
    } catch {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
  }, []);

  const clearDraft = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  const hasDraft = useCallback((): boolean => {
    const draft = loadDraft();
    if (!draft) return false;
    return draft.segments.length > 0 || (draft.name !== 'Untitled Commercial');
  }, [loadDraft]);

  return { saveDraft, saveDraftDebounced, loadDraft, clearDraft, hasDraft };
}
