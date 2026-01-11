import { useCallback, useRef } from 'react';
import { useToast } from '@/hooks/use-toast';

const DRAFT_KEY = 'reel-draft-autosave';
const AUTOSAVE_DEBOUNCE_MS = 2000;
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

export interface StrategistState {
  niche: string;
  videoDuration: '30' | '60' | 'mix';
  includePromotional: boolean;
  strategy: {
    contentPillars: { name: string; description: string; color: string }[];
    videoIdeas: any[];
    weeklySchedule: { day: string; pillar: string; contentType: string }[];
  } | null;
}

export interface ReelDraftState {
  topic: string;
  selectedSceneCount: string;
  selectedSceneDuration: string;
  selectedVoice: string;
  selectedVideoSize: string;
  transitionStyle: string;
  hookStyle: string;
  characterDescription: string;
  preSelectedReference: string | null;
  selectedTwinId: string | null;
  selectedIntro: string;
  selectedOutro: string;
  introText: string;
  outroText: string;
  enableCutScenes: boolean;
  enableLipSync: boolean;
  portraitImage: string | null;
  project: {
    topic: string;
    scenes: any[];
    voiceovers: any[];
    generatedScenes: any[];
    videoClips: any[];
    previewScenes: any[];
    status: string;
  };
  featureToggles: {
    introOutro: boolean;
    cutScenes: boolean;
    upscaler: boolean;
    lipSync: boolean;
    captions: boolean;
    backgroundMusic: boolean;
  };
  strategist?: StrategistState;
  savedAt: number;
}

// Helper functions outside the hook to avoid dependency issues
function cleanProjectForStorage(project: any) {
  return {
    ...project,
    previewScenes: project.previewScenes?.map((scene: any) => ({
      ...scene,
      imageUrl: scene.imageUrl?.startsWith('data:') ? null : scene.imageUrl,
      audioUrl: scene.audioUrl?.startsWith('data:') ? null : scene.audioUrl,
    })) || [],
    generatedScenes: project.generatedScenes?.map((scene: any) => ({
      ...scene,
      imageUrl: scene.imageUrl?.startsWith('data:') ? null : scene.imageUrl,
    })) || [],
    voiceovers: project.voiceovers?.map((v: any) => ({
      ...v,
      audioUrl: v.audioUrl?.startsWith('data:') ? (v.storageUrl || null) : v.audioUrl,
    })) || [],
  };
}

function readDraftFromStorage(): ReelDraftState | null {
  try {
    const stored = localStorage.getItem(DRAFT_KEY);
    if (!stored) return null;
    return JSON.parse(stored) as ReelDraftState;
  } catch {
    return null;
  }
}

function writeDraftToStorage(draft: ReelDraftState): boolean {
  try {
    const draftJson = JSON.stringify(draft);
    if (draftJson.length > 4 * 1024 * 1024) {
      console.warn('[AutoSave] Draft too large, skipping save');
      return false;
    }
    localStorage.setItem(DRAFT_KEY, draftJson);
    return true;
  } catch {
    return false;
  }
}

function removeDraftFromStorage(): void {
  try {
    localStorage.removeItem(DRAFT_KEY);
  } catch {
    // Ignore errors
  }
}

function calculateDraftAge(savedAt: number): string {
  const ageMs = Date.now() - savedAt;
  const seconds = Math.floor(ageMs / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return 'just now';
}

export function useReelDraftAutoSave() {
  const { toast } = useToast();
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSaveRef = useRef<number>(0);

  // Clear draft from localStorage
  const clearDraft = useCallback(() => {
    removeDraftFromStorage();
    lastSaveRef.current = 0;
    console.log('[AutoSave] Draft cleared');
  }, []);

  // Load draft from localStorage
  const loadDraft = useCallback((): ReelDraftState | null => {
    const draft = readDraftFromStorage();
    if (!draft) return null;

    // Check if draft is too old (older than 7 days)
    if (Date.now() - draft.savedAt > SEVEN_DAYS_MS) {
      console.log('[AutoSave] Draft expired, clearing...');
      removeDraftFromStorage();
      return null;
    }

    return draft;
  }, []);

  // Save draft to localStorage
  const saveDraft = useCallback((state: Omit<ReelDraftState, 'savedAt'>) => {
    // Skip if nothing meaningful to save
    if (!state.topic?.trim() && state.project.scenes.length === 0 && state.project.previewScenes.length === 0 && !state.strategist?.niche?.trim() && !state.strategist?.strategy) {
      return;
    }

    try {
      const cleanedProject = cleanProjectForStorage(state.project);
      
      const draft: ReelDraftState = {
        ...state,
        project: cleanedProject,
        portraitImage: state.portraitImage?.startsWith('data:') ? null : state.portraitImage,
        preSelectedReference: state.preSelectedReference?.startsWith('data:') ? null : state.preSelectedReference,
        savedAt: Date.now()
      };
      
      if (writeDraftToStorage(draft)) {
        lastSaveRef.current = draft.savedAt;
        console.log('[AutoSave] Draft saved at', new Date(draft.savedAt).toLocaleTimeString());
      }
    } catch (error) {
      console.error('[AutoSave] Failed to save draft:', error);
      // If quota exceeded, clear old draft and try again with minimal data
      if ((error as any)?.name === 'QuotaExceededError') {
        try {
          removeDraftFromStorage();
          const minimalDraft: ReelDraftState = {
            topic: state.topic,
            selectedSceneCount: state.selectedSceneCount,
            selectedSceneDuration: state.selectedSceneDuration,
            selectedVoice: state.selectedVoice,
            selectedVideoSize: state.selectedVideoSize,
            transitionStyle: state.transitionStyle,
            hookStyle: state.hookStyle,
            characterDescription: state.characterDescription,
            preSelectedReference: null,
            selectedTwinId: state.selectedTwinId,
            selectedIntro: state.selectedIntro,
            selectedOutro: state.selectedOutro,
            introText: state.introText,
            outroText: state.outroText,
            enableCutScenes: state.enableCutScenes,
            enableLipSync: state.enableLipSync,
            portraitImage: null,
            project: { topic: state.project.topic, scenes: [], voiceovers: [], generatedScenes: [], videoClips: [], previewScenes: [], status: state.project.status },
            featureToggles: state.featureToggles,
            strategist: state.strategist,
            savedAt: Date.now()
          };
          writeDraftToStorage(minimalDraft);
          console.log('[AutoSave] Saved minimal draft after quota error');
        } catch (e) {
          console.error('[AutoSave] Even minimal save failed:', e);
        }
      }
    }
  }, []);

  // Debounced save
  const saveDraftDebounced = useCallback((state: Omit<ReelDraftState, 'savedAt'>) => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      saveDraft(state);
    }, AUTOSAVE_DEBOUNCE_MS);
  }, [saveDraft]);

  // Check if draft exists and has content
  const hasDraft = useCallback((): boolean => {
    const draft = readDraftFromStorage();
    if (!draft) return false;
    
    // Check if expired
    if (Date.now() - draft.savedAt > SEVEN_DAYS_MS) {
      return false;
    }
    
    // Check if there's meaningful content
    return !!(
      draft.topic?.trim() ||
      draft.project.scenes.length > 0 ||
      draft.project.previewScenes.length > 0 ||
      draft.project.generatedScenes.length > 0 ||
      draft.strategist?.niche?.trim() ||
      draft.strategist?.strategy
    );
  }, []);

  // Get draft age for display
  const getDraftAge = useCallback((): string => {
    const draft = readDraftFromStorage();
    if (!draft) return '';
    return calculateDraftAge(draft.savedAt);
  }, []);

  // Notify user when restoring draft
  const notifyDraftRestored = useCallback(() => {
    const draft = readDraftFromStorage();
    const age = draft ? calculateDraftAge(draft.savedAt) : '';
    toast({
      title: "Draft Restored",
      description: `Your unsaved reel draft has been recovered (saved ${age}).`,
    });
  }, [toast]);

  return {
    saveDraft,
    saveDraftDebounced,
    loadDraft,
    clearDraft,
    hasDraft,
    getDraftAge,
    notifyDraftRestored
  };
}
