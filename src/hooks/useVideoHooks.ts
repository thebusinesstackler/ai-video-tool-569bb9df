import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface HookScores {
  scrollStop: number;
  clarity: number;
  emotionalPull: number;
  conversionIntent: number;
  curiosity: number;
  adSuitability: number;
  organicSuitability: number;
}

export interface VideoHook {
  hookText: string;
  hookType: string;
  whyChosen: string;
  bestPlatform: string;
  onScreenText: string;
  voiceoverVersion: string;
  visualDirection: string;
  scores: HookScores;
  bestFor: string[];
}

export interface ContentSummary {
  mainTopic: string;
  keyPromise: string;
  problemBeingSolved: string;
  emotionalTone: string;
  strongestClaims: string[];
  ctaIntent: string;
  bestAudienceAngle: string;
  likelyUseCase: string;
  pacing: string;
  contentType: string;
  keyInsights: string[];
}

export interface ContextSettings {
  platform: string;
  targetAudience: string;
  videoGoal: string;
  niche: string;
  toneOfVoice: string;
  ctaGoal: string;
  videoType: string;
  brandVoice: string;
  offer: string;
  contentMode: string;
  hookStyle: string;
}

const DEFAULT_CONTEXT: ContextSettings = {
  platform: '',
  targetAudience: '',
  videoGoal: '',
  niche: '',
  toneOfVoice: '',
  ctaGoal: '',
  videoType: '',
  brandVoice: '',
  offer: '',
  contentMode: '',
  hookStyle: 'balanced',
};

export function useVideoHooks() {
  const [contentSummary, setContentSummary] = useState<ContentSummary | null>(null);
  const [hooks, setHooks] = useState<VideoHook[]>([]);
  const [contextSettings, setContextSettings] = useState<ContextSettings>(DEFAULT_CONTEXT);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isRefining, setIsRefining] = useState(false);
  const [videoTitle, setVideoTitle] = useState('');
  const [videoDescription, setVideoDescription] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [savedSessions, setSavedSessions] = useState<any[]>([]);

  const analyzeVideo = useCallback(async () => {
    if (!videoTitle && !videoDescription) {
      toast.error('Please provide a video title or description/transcript');
      return;
    }
    setIsAnalyzing(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-video-hooks', {
        body: {
          action: 'analyze',
          videoTitle,
          videoDescription,
          contextSettings,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setContentSummary(data.summary);
      toast.success('Video analyzed successfully');
    } catch (err: any) {
      console.error('Analysis error:', err);
      toast.error(err.message || 'Failed to analyze video');
    } finally {
      setIsAnalyzing(false);
    }
  }, [videoTitle, videoDescription, contextSettings]);

  const generateHooks = useCallback(async () => {
    if (!contentSummary) {
      toast.error('Analyze the video first');
      return;
    }
    setIsGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-video-hooks', {
        body: {
          action: 'generate',
          videoTitle,
          videoDescription,
          contextSettings: { ...contextSettings, contentSummary },
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setHooks(data.hooks || []);
      toast.success(`Generated ${data.hooks?.length || 0} hooks`);
    } catch (err: any) {
      console.error('Hook generation error:', err);
      toast.error(err.message || 'Failed to generate hooks');
    } finally {
      setIsGenerating(false);
    }
  }, [contentSummary, videoTitle, videoDescription, contextSettings]);

  const refineHook = useCallback(async (hookIndex: number, instruction: string) => {
    const hook = hooks[hookIndex];
    if (!hook) return;
    setIsRefining(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-video-hooks', {
        body: {
          action: 'refine',
          videoTitle,
          hookToRefine: hook,
          refineInstruction: instruction,
          contextSettings,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      if (data.hook) {
        setHooks(prev => prev.map((h, i) => (i === hookIndex ? data.hook : h)));
        toast.success('Hook refined');
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to refine hook');
    } finally {
      setIsRefining(false);
    }
  }, [hooks, videoTitle, contextSettings]);

  const saveSession = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { toast.error('Please sign in'); return; }
    
    const { error } = await supabase.from('video_hooks').insert({
      user_id: user.id,
      video_url: videoUrl || null,
      video_title: videoTitle,
      content_summary: contentSummary as any,
      context_settings: contextSettings as any,
      hooks: hooks as any,
      status: 'complete',
    });
    if (error) { toast.error('Failed to save'); return; }
    toast.success('Hook session saved');
    loadSessions();
  }, [videoUrl, videoTitle, contentSummary, contextSettings, hooks]);

  const loadSessions = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase
      .from('video_hooks')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(20);
    if (data) setSavedSessions(data);
  }, []);

  const loadSession = useCallback((session: any) => {
    setVideoTitle(session.video_title || '');
    setVideoUrl(session.video_url || '');
    setContentSummary(session.content_summary);
    setContextSettings(session.context_settings || DEFAULT_CONTEXT);
    setHooks(session.hooks || []);
  }, []);

  useEffect(() => { loadSessions(); }, [loadSessions]);

  const updateContext = useCallback((key: keyof ContextSettings, value: string) => {
    setContextSettings(prev => ({ ...prev, [key]: value }));
  }, []);

  const resetAll = useCallback(() => {
    setContentSummary(null);
    setHooks([]);
    setVideoTitle('');
    setVideoDescription('');
    setVideoUrl('');
    setContextSettings(DEFAULT_CONTEXT);
  }, []);

  return {
    contentSummary, hooks, contextSettings, isAnalyzing, isGenerating, isRefining,
    videoTitle, setVideoTitle, videoDescription, setVideoDescription,
    videoUrl, setVideoUrl,
    analyzeVideo, generateHooks, refineHook, saveSession, loadSession,
    updateContext, resetAll, savedSessions, setHooks,
  };
}
