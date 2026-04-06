import { useCallback, useRef } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/components/AuthProvider';

const DRAFT_KEY_PREFIX = 'reel-draft-autosave';
const LEGACY_DRAFT_KEY = 'reel-draft-autosave';
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

function getDraftKey(userId?: string | null) {
  return userId ? `${DRAFT_KEY_PREFIX}:${userId}` : null;
}

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

function readDraftFromStorage(userId?: string | null): ReelDraftState | null {
  const key = getDraftKey(userId);
  if (!key) return null;

  try {
    const stored = localStorage.getItem(key);
    if (!stored) return null;
    return JSON.parse(stored) as ReelDraftState;
  } catch {
    return null;
  }
}

function writeDraftToStorage(draft: ReelDraftState, userId?: string | null): boolean {
  const key = getDraftKey(userId);
  if (!key) return false;

  try {
    const draftJson = JSON.stringify(draft);
    if (draftJson.length > 4 * 1024 * 1024) {
      console.warn('[AutoSave] Draft too large, skipping save');
      return false;
    }
    localStorage.setItem(key, draftJson);
    return true;
  } catch {
    return false;
  }
}

function removeDraftFromStorage(userId?: string | null): void {
  const key = getDraftKey(userId);
  try {
    if (key) {
      localStorage.removeItem(key);
    }
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
  const { user } = useAuth();
  const userId = user?.id;
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSaveRef = useRef<number>(0);

  const clearDraft = useCallback(() => {
    removeDraftFromStorage(userId);
    lastSaveRef.current = 0;
    console.log('[AutoSave] Draft cleared');
  }, [userId]);

  const loadDraft = useCallback((): ReelDraftState | null => {
    const draft = readDraftFromStorage(userId);
    if (!draft) return null;

    if (Date.now() - draft.savedAt > SEVEN_DAYS_MS) {
      console.log('[AutoSave] Draft expired, clearing...');
      removeDraftFromStorage(userId);
      return null;
    }

    return draft;
  }, [userId]);

  const saveDraft = useCallback((state: Omit<ReelDraftState, 'savedAt'>) => {
    if (!userId) return;

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

      if (writeDraftToStorage(draft, userId)) {
        lastSaveRef.current = draft.savedAt;
        console.log('[AutoSave] Draft saved at', new Date(draft.savedAt).toLocaleTimeString());
      }
    } catch (error) {
      console.error('[AutoSave] Failed to save draft:', error);
      if ((error as any)?.name === 'QuotaExceededError') {
        try {
          removeDraftFromStorage(userId);
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
          writeDraftToStorage(minimalDraft, userId);
          console.log('[AutoSave] Saved minimal draft after quota error');
        } catch (e) {
          console.error('[AutoSave] Even minimal save failed:', e);
        }
      }
    }
  }, [userId]);

  const saveDraftDebounced = useCallback((state: Omit<ReelDraftState, 'savedAt'>) => {
    if (!userId) return;

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      saveDraft(state);
    }, AUTOSAVE_DEBOUNCE_MS);
  }, [saveDraft, userId]);

  const hasDraft = useCallback((): boolean => {
    const draft = readDraftFromStorage(userId);
    if (!draft) return false;

    if (Date.now() - draft.savedAt > SEVEN_DAYS_MS) {
      return false;
    }

    return !!(
      draft.topic?.trim() ||
      draft.project.scenes.length > 0 ||
      draft.project.previewScenes.length > 0 ||
      draft.project.generatedScenes.length > 0 ||
      draft.strategist?.niche?.trim() ||
      draft.strategist?.strategy
    );
  }, [userId]);

  const getDraftAge = useCallback((): string => {
    const draft = readDraftFromStorage(userId);
    if (!draft) return '';
    return calculateDraftAge(draft.savedAt);
  }, [userId]);

  const notifyDraftRestored = useCallback(() => {
    const draft = readDraftFromStorage(userId);
    const age = draft ? calculateDraftAge(draft.savedAt) : '';
    toast({
      title: 'Draft Restored',
      description: `Your unsaved reel draft has been recovered (saved ${age}).`,
    });
  }, [toast, userId]);

  const clearLegacyAnonymousDraft = useCallback(() => {
    try {
      localStorage.removeItem(LEGACY_DRAFT_KEY);
    } catch {
      // Ignore errors
    }
  }, []);

  return {
    saveDraft,
    saveDraftDebounced,
    loadDraft,
    clearDraft,
    hasDraft,
    getDraftAge,
    notifyDraftRestored,
    clearLegacyAnonymousDraft,
  };
}
