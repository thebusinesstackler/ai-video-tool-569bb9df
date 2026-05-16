import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface VideoTask {
  taskId: string;
  sceneNumber: number;
  hasEmbeddedAudio?: boolean;
}

interface GeneratedScene {
  sceneNumber: number;
  text: string;
  imageUrl: string | null;
  savedImageUrl?: string | null;
  videoUrl?: string | null;
  startTime: number;
  endTime: number;
}

interface BackgroundJob {
  id: string;
  topic: string;
  userId: string;
  videoTasks: VideoTask[];
  generatedScenes: GeneratedScene[];
  voiceovers: { sceneNumber: number; audioUrl: string; storageUrl?: string; duration: number }[];
  hasEmbeddedAudio: boolean;
  completedVideos: { sceneNumber: number; videoUrl: string }[];
  status: 'polling' | 'stitching' | 'saving' | 'complete' | 'failed';
  progress: number;
  error?: string;
  createdAt: number;
}

interface BackgroundVideoContextValue {
  activeJobs: BackgroundJob[];
  registerJob: (job: Omit<BackgroundJob, 'id' | 'completedVideos' | 'status' | 'progress' | 'createdAt'>) => string;
  getJob: (id: string) => BackgroundJob | undefined;
  dismissJob: (id: string) => void;
}

const BackgroundVideoContext = createContext<BackgroundVideoContextValue | null>(null);

export const useBackgroundVideo = () => {
  const ctx = useContext(BackgroundVideoContext);
  if (!ctx) throw new Error('useBackgroundVideo must be used within BackgroundVideoProvider');
  return ctx;
};

const STORAGE_KEY = 'background-video-jobs';
const MAX_JOB_AGE_MS = 6 * 60 * 60 * 1000; // 6 hours

function loadPersistedJobs(): BackgroundJob[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as BackgroundJob[];
    return parsed.filter(j => Date.now() - j.createdAt < MAX_JOB_AGE_MS);
  } catch {
    return [];
  }
}

function persistJobs(jobs: BackgroundJob[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(jobs));
  } catch (e) {
    console.warn('[BackgroundJob] Failed to persist jobs:', e);
  }
}

export const BackgroundVideoProvider = ({ children }: { children: React.ReactNode }) => {
  const { toast } = useToast();
  const [jobs, setJobs] = useState<BackgroundJob[]>(() => loadPersistedJobs());
  const pollingRef = useRef<Map<string, boolean>>(new Map());
  const pollJobRef = useRef<((job: BackgroundJob) => void) | null>(null);

  // Persist jobs to localStorage whenever they change
  useEffect(() => {
    persistJobs(jobs);
  }, [jobs]);

  const registerJob = useCallback((jobData: Omit<BackgroundJob, 'id' | 'completedVideos' | 'status' | 'progress' | 'createdAt'>): string => {
    const id = crypto.randomUUID();
    const job: BackgroundJob = {
      ...jobData,
      id,
      completedVideos: [],
      status: 'polling',
      progress: 0,
      createdAt: Date.now(),
    };
    setJobs(prev => [...prev, job]);
    // Start polling immediately
    pollJobRef.current?.(job);
    return id;
  }, []);

  const getJob = useCallback((id: string) => jobs.find(j => j.id === id), [jobs]);

  const dismissJob = useCallback((id: string) => {
    pollingRef.current.delete(id);
    setJobs(prev => prev.filter(j => j.id !== id));
  }, []);

  const updateJob = useCallback((id: string, updates: Partial<BackgroundJob>) => {
    setJobs(prev => prev.map(j => j.id === id ? { ...j, ...updates } : j));
  }, []);

  const pollJob = useCallback(async (job: BackgroundJob) => {
    if (pollingRef.current.get(job.id)) return; // Already polling
    pollingRef.current.set(job.id, true);

    const maxPollingTime = 1800000; // 30 minutes — InfiniteTalk HD can take 10-15 min per clip
    const pollInterval = 5000;
    const startTime = Date.now();
    const completedVideos: { sceneNumber: number; videoUrl: string }[] = [];

    try {
      while (completedVideos.length < job.videoTasks.length) {
        if (!pollingRef.current.get(job.id)) return; // Job dismissed
        
        if (Date.now() - startTime > maxPollingTime) {
          // Timeout - continue with what we have
          for (const task of job.videoTasks) {
            if (!completedVideos.find(v => v.sceneNumber === task.sceneNumber)) {
              completedVideos.push({ sceneNumber: task.sceneNumber, videoUrl: '' });
            }
          }
          break;
        }

        for (const task of job.videoTasks) {
          if (completedVideos.find(v => v.sceneNumber === task.sceneNumber)) continue;

          try {
            const { data: statusData } = await supabase.functions.invoke('wavespeed-video', {
              body: { action: 'status', taskId: task.taskId }
            });

            if (statusData?.status === 'completed' && statusData.videoUrl) {
              completedVideos.push({ sceneNumber: task.sceneNumber, videoUrl: statusData.videoUrl });
            } else if (statusData?.status === 'failed') {
              completedVideos.push({ sceneNumber: task.sceneNumber, videoUrl: '' });
            }
          } catch (e) {
            console.error('Background poll error:', e);
          }
        }

        const progress = Math.round((completedVideos.length / job.videoTasks.length) * 70);
        updateJob(job.id, { completedVideos: [...completedVideos], progress });

        if (completedVideos.length < job.videoTasks.length) {
          await new Promise(r => setTimeout(r, pollInterval));
        }
      }

      // All tasks done - try cloud stitching
      const validVideos = completedVideos.filter(v => v.videoUrl && v.videoUrl.trim() !== '');
      
      if (validVideos.length === 0) {
        updateJob(job.id, { status: 'failed', error: 'All video scenes failed' });
        toast({ title: "Background Generation Failed", description: "All video scenes failed to generate.", variant: "destructive" });
        return;
      }

      // Stitching disabled — deliver individual clips (export to ChatCut AI)
      const sortedVideos = validVideos.sort((a, b) => a.sceneNumber - b.sceneNumber);
      const sortedAudios = [...job.voiceovers].sort((a, b) => a.sceneNumber - b.sceneNumber);
      const finalVideoUrl: string | null = sortedVideos[0]?.videoUrl || null;

      // Save to library
      updateJob(job.id, { status: 'saving', progress: 95 });

      try {
        const thumbnailUrl = job.generatedScenes[0]?.imageUrl || null;
        const totalDuration = sortedAudios.reduce((acc, a) => acc + a.duration, 0);
        const scenesWithAssets = job.generatedScenes.map(scene => {
          const video = sortedVideos.find(v => v.sceneNumber === scene.sceneNumber);
          const audio = sortedAudios.find(a => a.sceneNumber === scene.sceneNumber);
          return { ...scene, videoUrl: video?.videoUrl || null, audioUrl: audio?.storageUrl || null, audioDuration: audio?.duration || null };
        });

        await supabase.from('reels').insert([{
          user_id: job.userId,
          topic: job.topic,
          video_url: finalVideoUrl,
          thumbnail_url: thumbnailUrl,
          scenes: scenesWithAssets as unknown as any,
          total_duration: Math.round(totalDuration)
        }]);

        updateJob(job.id, { status: 'complete', progress: 100 });
        toast({ title: "🎬 Background Video Complete!", description: `"${job.topic}" has been saved to your library.` });
      } catch (saveErr) {
        console.error('Background save error:', saveErr);
        updateJob(job.id, { status: 'failed', error: 'Failed to save to library' });
      }
    } catch (err) {
      console.error('Background job error:', err);
      updateJob(job.id, { status: 'failed', error: err instanceof Error ? err.message : 'Unknown error' });
      toast({ title: "Background Generation Failed", description: err instanceof Error ? err.message : 'Unknown error', variant: "destructive" });
    } finally {
      pollingRef.current.delete(job.id);
    }
  }, [toast, updateJob]);

  // Keep latest pollJob in ref so registerJob/resume effects can call it
  useEffect(() => {
    pollJobRef.current = pollJob;
  }, [pollJob]);

  // Resume polling for any persisted in-progress jobs on mount
  useEffect(() => {
    const resumable = jobs.filter(
      j => (j.status === 'polling' || j.status === 'stitching' || j.status === 'saving')
        && !pollingRef.current.get(j.id)
    );
    resumable.forEach(j => pollJobRef.current?.(j));
    // Only run on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Clean up completed/failed jobs older than 10 minutes
  useEffect(() => {
    const interval = setInterval(() => {
      setJobs(prev => prev.filter(j => {
        if ((j.status === 'complete' || j.status === 'failed') && Date.now() - j.createdAt > 600000) {
          return false;
        }
        return true;
      }));
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  return (
    <BackgroundVideoContext.Provider value={{ activeJobs: jobs, registerJob, getJob, dismissJob }}>
      {children}
    </BackgroundVideoContext.Provider>
  );
};
