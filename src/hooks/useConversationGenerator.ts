import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface DialogueLine { character: string; line: string; emotion?: string }
export interface ConversationSpeaker {
  characterName: string;
  twinId?: string;
  voice_cloning_key?: string | null;
  voice?: string | null; // built-in voice id (alloy, nova, onyx, etc.)
  gender?: string | null;
  portraitUrl: string;
}

interface GenerateOpts {
  speakers: ConversationSpeaker[];
  topic: string;
  tone?: string;
  exchanges?: number;
}

interface RenderOpts {
  dialogue: DialogueLine[];
  speakers: ConversationSpeaker[];
  aspectRatio?: '9:16' | '16:9' | '1:1';
  source?: string;
  onProgress?: (stage: string, pct: number) => void;
}

interface LineTask {
  index: number; character: string; line: string; twinId: string;
  audioUrl: string; taskId: string | null; estDuration: number; error?: string;
}

export function useConversationGenerator() {
  const [generatingDialogue, setGeneratingDialogue] = useState(false);
  const [renderingVideo, setRenderingVideo] = useState(false);

  const generateDialogue = useCallback(async ({ speakers, topic, tone, exchanges }: GenerateOpts): Promise<DialogueLine[]> => {
    if (speakers.length < 2) throw new Error('Pick at least 2 speakers');
    setGeneratingDialogue(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-conversation-dialogue', {
        body: {
          characterNames: speakers.map(s => s.characterName),
          topic,
          tone: tone || 'natural',
          exchanges: exchanges || 8,
          sceneDescription: topic,
        },
      });
      if (error) throw error;
      const conv = data?.conversation;
      if (!Array.isArray(conv)) throw new Error('No conversation returned');
      return conv as DialogueLine[];
    } finally {
      setGeneratingDialogue(false);
    }
  }, []);

  const renderVideo = useCallback(async ({ dialogue, speakers, aspectRatio = '9:16', source = 'reels', onProgress }: RenderOpts): Promise<string> => {
    setRenderingVideo(true);
    try {
      onProgress?.('Generating per-line audio + lip-sync tasks...', 5);
      const { data: kickoff, error: koErr } = await supabase.functions.invoke('generate-conversation-video', {
        body: { dialogue, speakers, aspectRatio, source },
      });
      if (koErr) throw koErr;
      const lines: LineTask[] = kickoff?.lines || [];
      if (!lines.length) throw new Error('No lines kicked off');

      const taskMap = new Map<string, { videoUrl: string | null; duration: number; character: string; line: string }>();
      const pendingTasks = lines.filter(l => l.taskId).map(l => l.taskId!);

      // Poll all tasks in parallel
      onProgress?.(`Rendering ${pendingTasks.length} clips...`, 15);
      const startTime = Date.now();
      const maxWaitMs = 12 * 60 * 1000;

      while (taskMap.size < pendingTasks.length) {
        if (Date.now() - startTime > maxWaitMs) throw new Error('Render timed out');
        await new Promise(r => setTimeout(r, 4000));

        const remaining = pendingTasks.filter(id => !taskMap.has(id));
        const statuses = await Promise.all(remaining.map(async (taskId) => {
          try {
            const { data } = await supabase.functions.invoke('wavespeed-video', { body: { action: 'status', taskId } });
            return { taskId, ...data };
          } catch (e) {
            return { taskId, status: 'pending' as const };
          }
        }));

        for (const s of statuses) {
          if (s.status === 'completed' && s.videoUrl) {
            const ln = lines.find(l => l.taskId === s.taskId)!;
            taskMap.set(s.taskId, { videoUrl: s.videoUrl, duration: ln.estDuration, character: ln.character, line: ln.line });
          } else if (s.status === 'failed') {
            const ln = lines.find(l => l.taskId === s.taskId)!;
            taskMap.set(s.taskId, { videoUrl: null, duration: ln.estDuration, character: ln.character, line: ln.line });
            console.warn(`Task ${s.taskId} failed for line "${ln.line}"`);
          }
        }
        const pct = 15 + (taskMap.size / pendingTasks.length) * 70;
        onProgress?.(`Rendered ${taskMap.size}/${pendingTasks.length} clips...`, pct);
      }

      // Collect clips in dialogue order
      const clips = lines
        .filter(l => l.taskId && taskMap.get(l.taskId!)?.videoUrl)
        .map(l => {
          const t = taskMap.get(l.taskId!)!;
          return { url: t.videoUrl!, duration: t.duration, caption: `${l.character}: ${l.line}` };
        });

      if (clips.length === 0) throw new Error('All clips failed to render');

      onProgress?.('Stitching final video...', 90);
      const [w, h] = aspectRatio === '9:16' ? [1080, 1920] : aspectRatio === '16:9' ? [1920, 1080] : [1080, 1080];

      const { data: stitchData, error: stitchErr } = await supabase.functions.invoke('creatomate-stitch', {
        body: {
          clips,
          width: w,
          height: h,
          transition: 'fade',
          transitionDuration: 0.3,
        },
      });
      if (stitchErr) throw stitchErr;

      // creatomate-stitch may return either a direct URL or a renderId requiring polling
      let finalUrl: string | null = stitchData?.videoUrl || stitchData?.url || null;
      const renderId: string | null = stitchData?.renderId || stitchData?.id || null;

      if (!finalUrl && renderId) {
        const stitchStart = Date.now();
        const stitchMax = 5 * 60 * 1000;
        while (!finalUrl) {
          if (Date.now() - stitchStart > stitchMax) throw new Error('Stitch timed out');
          await new Promise(r => setTimeout(r, 3000));
          const { data: st } = await supabase.functions.invoke('creatomate-status', { body: { renderId } });
          if (st?.status === 'succeeded' || st?.status === 'completed') {
            finalUrl = st.url || st.videoUrl;
          } else if (st?.status === 'failed') {
            throw new Error(st.error || 'Stitch failed');
          }
        }
      }

      if (!finalUrl) throw new Error('No final video URL returned');
      onProgress?.('Done!', 100);
      return finalUrl;
    } finally {
      setRenderingVideo(false);
    }
  }, []);

  return { generateDialogue, renderVideo, generatingDialogue, renderingVideo };
}
