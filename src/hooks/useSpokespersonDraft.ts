import { useEffect, useCallback, useRef } from 'react';

const STORAGE_KEY = 'spokesperson-draft';
const EXPIRY_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

interface SpokespersonDraft {
  message: string;
  selectedTwinId: string | null;
  selectedSetting: string;
  selectedMood: string;
  selectedCameraAngle: string;
  selectedDuration: string;
  selectedQuality: 'standard' | 'nano-banana' | 'kling-pro';
  generatedScript: any | null;
  sceneShots: any[];
  showSceneGallery: boolean;
  videoUrl: string | null;
  audioUrl: string | null;
  savedAt: number;
}

export function useSpokespersonDraft() {
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const saveDraft = useCallback((draft: Omit<SpokespersonDraft, 'savedAt'>) => {
    // Don't save empty drafts
    if (!draft.message && !draft.generatedScript && !draft.videoUrl) return;

    // Strip large base64 data from scene shots to avoid quota errors
    const cleanShots = (draft.sceneShots || []).map(shot => ({
      ...shot,
      imageUrl: shot.imageUrl?.startsWith('data:') ? '' : shot.imageUrl,
    }));

    const data: SpokespersonDraft = {
      ...draft,
      sceneShots: cleanShots,
      savedAt: Date.now(),
    };

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {
      // quota exceeded — clear and retry
      localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  const debouncedSave = useCallback((draft: Omit<SpokespersonDraft, 'savedAt'>) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => saveDraft(draft), 2000);
  }, [saveDraft]);

  const loadDraft = useCallback((): SpokespersonDraft | null => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const data: SpokespersonDraft = JSON.parse(raw);
      // Check expiry
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

  useEffect(() => {
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, []);

  return { saveDraft: debouncedSave, loadDraft, clearDraft };
}
