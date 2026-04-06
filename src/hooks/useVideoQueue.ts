import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/components/AuthProvider';

export interface QueuedVideo {
  id: string;
  title: string;
  hookText: string;
  hookStyle: string;
  targetDuration: 30 | 60;
  sceneCount: number;
  sceneDurations: number[];
  contentType: string;
  callToAction: string | null;
  outroTemplate: string;
  seriesNumber: number;
  seriesPillar: string;
  niche: string;
  addedAt: string;
}

const STORAGE_KEY_PREFIX = 'lovable_video_queue';
const LEGACY_STORAGE_KEY = 'lovable_video_queue';

const getStorageKey = (userId?: string | null) => {
  return userId ? `${STORAGE_KEY_PREFIX}:${userId}` : null;
};

export const useVideoQueue = () => {
  const { user } = useAuth();
  const userId = user?.id;
  const [queue, setQueue] = useState<QueuedVideo[]>([]);

  useEffect(() => {
    if (!userId) {
      setQueue([]);
      return;
    }

    try {
      const stored = localStorage.getItem(getStorageKey(userId)!);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          setQueue(parsed);
          return;
        }
      }
      setQueue([]);
    } catch (err) {
      console.error('Failed to load video queue:', err);
      setQueue([]);
    }
  }, [userId]);

  const saveQueue = useCallback((newQueue: QueuedVideo[]) => {
    if (!userId) {
      setQueue([]);
      return;
    }

    try {
      localStorage.setItem(getStorageKey(userId)!, JSON.stringify(newQueue));
      setQueue(newQueue);
    } catch (err) {
      console.error('Failed to save video queue:', err);
    }
  }, [userId]);

  const addToQueue = useCallback((videos: Omit<QueuedVideo, 'id' | 'addedAt'>[]) => {
    if (!userId) return 0;

    const newVideos: QueuedVideo[] = videos.map(video => ({
      ...video,
      id: `queue_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      addedAt: new Date().toISOString()
    }));

    setQueue(prev => {
      const updated = [...prev, ...newVideos];
      localStorage.setItem(getStorageKey(userId)!, JSON.stringify(updated));
      return updated;
    });

    return newVideos.length;
  }, [userId]);

  const removeFromQueue = useCallback((id: string) => {
    if (!userId) return;

    setQueue(prev => {
      const updated = prev.filter(v => v.id !== id);
      localStorage.setItem(getStorageKey(userId)!, JSON.stringify(updated));
      return updated;
    });
  }, [userId]);

  const clearQueue = useCallback(() => {
    if (!userId) {
      setQueue([]);
      return;
    }

    localStorage.removeItem(getStorageKey(userId)!);
    setQueue([]);
  }, [userId]);

  const moveInQueue = useCallback((fromIndex: number, toIndex: number) => {
    if (!userId) return;

    setQueue(prev => {
      const updated = [...prev];
      const [moved] = updated.splice(fromIndex, 1);
      updated.splice(toIndex, 0, moved);
      localStorage.setItem(getStorageKey(userId)!, JSON.stringify(updated));
      return updated;
    });
  }, [userId]);

  const clearLegacyAnonymousQueue = useCallback(() => {
    try {
      localStorage.removeItem(LEGACY_STORAGE_KEY);
    } catch {
      // Ignore errors
    }
  }, []);

  return {
    queue,
    addToQueue,
    removeFromQueue,
    clearQueue,
    moveInQueue,
    saveQueue,
    clearLegacyAnonymousQueue,
    queueCount: queue.length
  };
};
