import { useEffect, useCallback, useRef } from 'react';
import { useToast } from '@/hooks/use-toast';

const DRAFT_KEY = 'reel-draft-autosave';
const AUTOSAVE_DEBOUNCE_MS = 2000;

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

export function useReelDraftAutoSave() {
  const { toast } = useToast();
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastSaveRef = useRef<number>(0);

  // Clean large data from project before saving
  const cleanProjectForStorage = useCallback((project: any) => {
    return {
      ...project,
      // Keep only essential data, remove base64 data URLs to save space
      previewScenes: project.previewScenes?.map((scene: any) => ({
        ...scene,
        // Keep image URLs but strip base64 data URIs (they're too large)
        imageUrl: scene.imageUrl?.startsWith('data:') ? null : scene.imageUrl,
        audioUrl: scene.audioUrl?.startsWith('data:') ? null : scene.audioUrl,
      })) || [],
      generatedScenes: project.generatedScenes?.map((scene: any) => ({
        ...scene,
        imageUrl: scene.imageUrl?.startsWith('data:') ? null : scene.imageUrl,
      })) || [],
      voiceovers: project.voiceovers?.map((v: any) => ({
        ...v,
        // Keep storage URLs, remove base64
        audioUrl: v.audioUrl?.startsWith('data:') ? (v.storageUrl || null) : v.audioUrl,
      })) || [],
    };
  }, []);

  // Save draft to localStorage
  const saveDraft = useCallback((state: Omit<ReelDraftState, 'savedAt'>) => {
    // Skip if nothing meaningful to save
    if (!state.topic?.trim() && state.project.scenes.length === 0 && state.project.previewScenes.length === 0) {
      return;
    }

    try {
      // Clean large data to avoid quota issues
      const cleanedProject = cleanProjectForStorage(state.project);
      
      const draft: ReelDraftState = {
        ...state,
        project: cleanedProject,
        // Also clean portrait image if it's base64
        portraitImage: state.portraitImage?.startsWith('data:') ? null : state.portraitImage,
        preSelectedReference: state.preSelectedReference?.startsWith('data:') ? null : state.preSelectedReference,
        savedAt: Date.now()
      };
      
      // Check size before saving (localStorage limit is ~5MB)
      const draftJson = JSON.stringify(draft);
      if (draftJson.length > 4 * 1024 * 1024) { // 4MB safety limit
        console.warn('[AutoSave] Draft too large, skipping save');
        return;
      }
      
      localStorage.setItem(DRAFT_KEY, draftJson);
      lastSaveRef.current = draft.savedAt;
      console.log('[AutoSave] Draft saved at', new Date(draft.savedAt).toLocaleTimeString());
    } catch (error) {
      console.error('[AutoSave] Failed to save draft:', error);
      // If quota exceeded, clear old draft and try again with minimal data
      if ((error as any)?.name === 'QuotaExceededError') {
        try {
          localStorage.removeItem(DRAFT_KEY);
          const minimalDraft = {
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
          localStorage.setItem(DRAFT_KEY, JSON.stringify(minimalDraft));
          console.log('[AutoSave] Saved minimal draft after quota error');
        } catch (e) {
          console.error('[AutoSave] Even minimal save failed:', e);
        }
      }
    }
  }, [cleanProjectForStorage]);

  // Debounced save
  const saveDraftDebounced = useCallback((state: Omit<ReelDraftState, 'savedAt'>) => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      saveDraft(state);
    }, AUTOSAVE_DEBOUNCE_MS);
  }, [saveDraft]);

  // Load draft from localStorage
  const loadDraft = useCallback((): ReelDraftState | null => {
    try {
      const stored = localStorage.getItem(DRAFT_KEY);
      if (!stored) return null;

      const draft = JSON.parse(stored) as ReelDraftState;
      
      // Check if draft is too old (older than 7 days)
      const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
      if (Date.now() - draft.savedAt > SEVEN_DAYS_MS) {
        console.log('[AutoSave] Draft expired, clearing...');
        clearDraft();
        return null;
      }

      return draft;
    } catch (error) {
      console.error('[AutoSave] Failed to load draft:', error);
      return null;
    }
  }, []);

  // Clear draft from localStorage
  const clearDraft = useCallback(() => {
    try {
      localStorage.removeItem(DRAFT_KEY);
      lastSaveRef.current = 0;
      console.log('[AutoSave] Draft cleared');
    } catch (error) {
      console.error('[AutoSave] Failed to clear draft:', error);
    }
  }, []);

  // Check if draft exists and has content
  const hasDraft = useCallback((): boolean => {
    const draft = loadDraft();
    if (!draft) return false;
    
    // Check if there's meaningful content
    return !!(
      draft.topic?.trim() ||
      draft.project.scenes.length > 0 ||
      draft.project.previewScenes.length > 0 ||
      draft.project.generatedScenes.length > 0
    );
  }, [loadDraft]);

  // Get draft age for display
  const getDraftAge = useCallback((): string => {
    const draft = loadDraft();
    if (!draft) return '';

    const ageMs = Date.now() - draft.savedAt;
    const seconds = Math.floor(ageMs / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return 'just now';
  }, [loadDraft]);

  // Notify user when restoring draft
  const notifyDraftRestored = useCallback(() => {
    toast({
      title: "Draft Restored",
      description: `Your unsaved reel draft has been recovered (saved ${getDraftAge()}).`,
    });
  }, [toast, getDraftAge]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

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
