import { useState, useEffect, useCallback } from 'react';

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

const STORAGE_KEY = 'lovable_video_queue';

export const useVideoQueue = () => {
  const [queue, setQueue] = useState<QueuedVideo[]>([]);

  // Load queue from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          setQueue(parsed);
        }
      }
    } catch (err) {
      console.error('Failed to load video queue:', err);
    }
  }, []);

  // Save queue to localStorage whenever it changes
  const saveQueue = useCallback((newQueue: QueuedVideo[]) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newQueue));
      setQueue(newQueue);
    } catch (err) {
      console.error('Failed to save video queue:', err);
    }
  }, []);

  const addToQueue = useCallback((videos: Omit<QueuedVideo, 'id' | 'addedAt'>[]) => {
    const newVideos: QueuedVideo[] = videos.map(video => ({
      ...video,
      id: `queue_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      addedAt: new Date().toISOString()
    }));
    
    setQueue(prev => {
      const updated = [...prev, ...newVideos];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      return updated;
    });
    
    return newVideos.length;
  }, []);

  const removeFromQueue = useCallback((id: string) => {
    setQueue(prev => {
      const updated = prev.filter(v => v.id !== id);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  const clearQueue = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setQueue([]);
  }, []);

  const moveInQueue = useCallback((fromIndex: number, toIndex: number) => {
    setQueue(prev => {
      const updated = [...prev];
      const [moved] = updated.splice(fromIndex, 1);
      updated.splice(toIndex, 0, moved);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  return {
    queue,
    addToQueue,
    removeFromQueue,
    clearQueue,
    moveInQueue,
    queueCount: queue.length
  };
};
