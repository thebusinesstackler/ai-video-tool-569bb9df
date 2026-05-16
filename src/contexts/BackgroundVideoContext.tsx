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

    const maxPollingTime = 300000; // 5 minutes
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

      updateJob(job.id, { status: 'stitching', progress: 75 });

      // Build clips for Creatomate
      const sortedVideos = validVideos.sort((a, b) => a.sceneNumber - b.sceneNumber);
      const sortedAudios = [...job.voiceovers].sort((a, b) => a.sceneNumber - b.sceneNumber);
      
      // Only include audio for non-embedded-audio scenes
      const perSceneEmbedded: Record<number, boolean> = {};
      job.videoTasks.forEach(t => { perSceneEmbedded[t.sceneNumber] = t.hasEmbeddedAudio || false; });
      
      const audioForStitch = sortedAudios
        .filter(a => a.audioUrl && a.audioUrl.trim() !== '' && !perSceneEmbedded[a.sceneNumber])
        .map(a => a.storageUrl || a.audioUrl);

      // Skip stitching for single-clip embedded-audio videos
      const allEmbedded = job.videoTasks.every(t => t.hasEmbeddedAudio) && audioForStitch.length === 0;
      const skipStitch = sortedVideos.length === 1 && allEmbedded;

      let finalVideoUrl: string | null = null;

      if (skipStitch) {
        console.log('[BackgroundJob] Single embedded-audio clip — skipping stitch, using original URL');
        finalVideoUrl = sortedVideos[0]?.videoUrl || null;
      } else {
        // Merge audio if needed
        let mergedAudioUrl: string | undefined;
        if (audioForStitch.length > 0) {
          try {
            const { data: mergeData } = await supabase.functions.invoke('merge-audio', {
              body: {
                segments: sortedAudios
                  .filter(a => a.audioUrl && !perSceneEmbedded[a.sceneNumber])
                  .map(a => ({ audioUrl: a.storageUrl || a.audioUrl, duration: a.duration, sceneNumber: a.sceneNumber })),
                userId: job.userId
              }
            });
            if (mergeData?.audioUrl) mergedAudioUrl = mergeData.audioUrl;
          } catch (e) {
            console.warn('Background audio merge failed:', e);
          }
        }

        // Try Creatomate cloud stitching
        try {
          const clips = sortedVideos.map(v => {
            const audio = sortedAudios.find(a => a.sceneNumber === v.sceneNumber);
            return { url: v.videoUrl, duration: audio?.duration || 5, audioDuration: audio?.duration };
          });

          const { data: stitchData } = await supabase.functions.invoke('creatomate-stitch', {
            body: { clips, audioUrl: mergedAudioUrl, transition: 'crossfade' }
          });

          if (stitchData?.success && stitchData?.renderId) {
            const renderStart = Date.now();
            while (Date.now() - renderStart < 300000) {
              if (!pollingRef.current.get(job.id)) return;
              
              const { data: status } = await supabase.functions.invoke('creatomate-status', {
                body: { renderId: stitchData.renderId }
              });

              if (status?.status === 'succeeded' && status?.url) {
                finalVideoUrl = status.url;
                break;
              }
              if (status?.status === 'failed') break;

              updateJob(job.id, { progress: 75 + Math.min(20, Math.round(((Date.now() - renderStart) / 300000) * 20)) });
              await new Promise(r => setTimeout(r, 3000));
            }
          }
        } catch (e) {
          console.warn('Background Creatomate stitch failed:', e);
        }

        // If cloud stitch failed, use first clip directly
        if (!finalVideoUrl) {
          finalVideoUrl = sortedVideos[0]?.videoUrl || null;
        }
      }

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
