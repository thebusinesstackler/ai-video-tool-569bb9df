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
  generatedScript: any | null;
  videoUrl: string | null;
  audioUrl: string | null;
  savedAt: number;
  // Legacy fields (kept for backward compat when reading old drafts)
  selectedQuality?: string;
  sceneShots?: any[];
  showSceneGallery?: boolean;
}

export function useSpokespersonDraft() {
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const saveDraft = useCallback((draft: Omit<SpokespersonDraft, 'savedAt'>) => {
    if (!draft.message && !draft.generatedScript && !draft.videoUrl) return;

    const data: SpokespersonDraft = {
      ...draft,
      savedAt: Date.now(),
    };

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  const debouncedSave = useCallback((draft: Omit<SpokespersonDraft, 'savedAt'>) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => saveDraft(draft), 1000);
  }, [saveDraft]);

  const loadDraft = useCallback((): SpokespersonDraft | null => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const data: SpokespersonDraft = JSON.parse(raw);
      if (Date.now() - data.savedAt > EXPIRY_MS) {
        localStorage.removeItem(STORAGE_KEY);
        return null;
      }
      return data;
    } catch {
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
