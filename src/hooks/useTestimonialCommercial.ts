import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { CommercialSegment, TestimonialCommercial } from '@/types/testimonialCommercial';
import { toast } from 'sonner';

export function useTestimonialCommercial() {
  const [segments, setSegments] = useState<CommercialSegment[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [currentCommercial, setCurrentCommercial] = useState<TestimonialCommercial | null>(null);

  const addSegment = useCallback((type: CommercialSegment['type']) => {
    const newSegment: CommercialSegment = {
      id: crypto.randomUUID(),
      type,
      duration: type === 'broll-montage' ? 15 : 5,
      transition: type === 'twin-speaking' ? 'fade-in' : 'cut',
      status: 'pending'
    };
    setSegments(prev => [...prev, newSegment]);
  }, []);

  const updateSegment = useCallback((id: string, updates: Partial<CommercialSegment>) => {
    setSegments(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s));
  }, []);

  const deleteSegment = useCallback((id: string) => {
    setSegments(prev => prev.filter(s => s.id !== id));
  }, []);

  const reorderSegments = useCallback((fromIndex: number, toIndex: number) => {
    setSegments(prev => {
      const newSegments = [...prev];
      const [removed] = newSegments.splice(fromIndex, 1);
      newSegments.splice(toIndex, 0, removed);
      return newSegments;
    });
  }, []);

  const saveCommercial = useCallback(async (name: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error('Please sign in to save');
      return null;
    }

    const segmentsJson = JSON.parse(JSON.stringify(segments));

    if (currentCommercial) {
      const { error } = await supabase
        .from('testimonial_commercials')
        .update({ name, segments: segmentsJson })
        .eq('id', currentCommercial.id);

      if (error) {
        toast.error('Failed to save commercial');
        return null;
      }
      toast.success('Commercial saved');
      return currentCommercial.id;
    } else {
      const { data, error } = await supabase
        .from('testimonial_commercials')
        .insert({ user_id: user.id, name, segments: segmentsJson })
        .select()
        .single();

      if (error) {
        toast.error('Failed to save commercial');
        return null;
      }
      setCurrentCommercial(data as unknown as TestimonialCommercial);
      toast.success('Commercial saved');
      return data.id;
    }
  }, [segments, currentCommercial]);

  const loadCommercial = useCallback(async (id: string) => {
    const { data, error } = await supabase
      .from('testimonial_commercials')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) {
      toast.error('Failed to load commercial');
      return;
    }

    const commercial = data as unknown as TestimonialCommercial;
    setCurrentCommercial(commercial);
    setSegments(commercial.segments || []);
  }, []);

  const generateCommercial = useCallback(async () => {
    if (segments.length === 0) {
      toast.error('Add at least one segment');
      return;
    }

    // Validate segments
    for (const segment of segments) {
      if (segment.type === 'twin-speaking' && (!segment.twinId || !segment.script)) {
        toast.error('Each speaking segment needs a twin and script');
        return;
      }
      if (segment.type === 'broll-montage' && (!segment.voiceoverId || !segment.voiceoverText)) {
        toast.error('Montage segments need a voice and script');
        return;
      }
    }

    setIsGenerating(true);
    setGenerationProgress(0);

    try {
      const totalSteps = segments.length * 2 + 1; // Generate each + stitch
      let currentStep = 0;

      // Process each segment
      for (let i = 0; i < segments.length; i++) {
        const segment = segments[i];
        updateSegment(segment.id, { status: 'generating' });

        try {
          // Generate audio for speaking/montage segments
          if (segment.type === 'twin-speaking' || segment.type === 'broll-montage') {
            const audioResult = await generateAudioForSegment(segment);
            updateSegment(segment.id, { audioUrl: audioResult });
          }

          currentStep++;
          setGenerationProgress((currentStep / totalSteps) * 100);

          // Generate video for segment
          const videoResult = await generateVideoForSegment(segment, i > 0 ? segments[i - 1] : null);
          updateSegment(segment.id, { videoUrl: videoResult, status: 'complete' });

          currentStep++;
          setGenerationProgress((currentStep / totalSteps) * 100);
        } catch (err) {
          console.error(`Failed to generate segment ${i}:`, err);
          updateSegment(segment.id, { status: 'error' });
          throw err;
        }
      }

      // Stitch all videos together
      toast.info('Stitching commercial...');
      const finalVideoUrl = await stitchCommercial(segments);

      if (currentCommercial) {
        await supabase
          .from('testimonial_commercials')
          .update({ video_url: finalVideoUrl })
          .eq('id', currentCommercial.id);
      }

      setGenerationProgress(100);
      toast.success('Commercial generated successfully!');
      
      return finalVideoUrl;
    } catch (error) {
      console.error('Generation failed:', error);
      toast.error('Failed to generate commercial');
    } finally {
      setIsGenerating(false);
    }
  }, [segments, updateSegment, currentCommercial]);

  return {
    segments,
    setSegments,
    addSegment,
    updateSegment,
    deleteSegment,
    reorderSegments,
    saveCommercial,
    loadCommercial,
    generateCommercial,
    isGenerating,
    generationProgress,
    currentCommercial,
    setCurrentCommercial
  };
}

async function generateAudioForSegment(segment: CommercialSegment): Promise<string> {
  // Get the twin's voice cloning key
  const { data: twin } = await supabase
    .from('ai_twins')
    .select('voice_cloning_key')
    .eq('id', segment.type === 'twin-speaking' ? segment.twinId : segment.voiceoverId)
    .single();

  if (!twin?.voice_cloning_key) {
    throw new Error('Twin does not have a cloned voice');
  }

  const text = segment.type === 'twin-speaking' ? segment.script : segment.voiceoverText;

  const { data, error } = await supabase.functions.invoke('text-to-speech', {
    body: {
      text,
      voiceId: twin.voice_cloning_key
    }
  });

  if (error || !data?.audioUrl) {
    throw new Error('Failed to generate audio');
  }

  return data.audioUrl;
}

async function generateVideoForSegment(
  segment: CommercialSegment,
  previousSegment: CommercialSegment | null
): Promise<string> {
  // For twin speaking - use infinitetalk lip-sync
  if (segment.type === 'twin-speaking') {
    const { data: twin } = await supabase
      .from('ai_twins')
      .select('reference_images')
      .eq('id', segment.twinId)
      .single();

    if (!twin?.reference_images?.[0]) {
      throw new Error('Twin does not have reference images');
    }

    const { data, error } = await supabase.functions.invoke('wavespeed-video', {
      body: {
        action: 'create',
        params: {
          model: 'infinitetalk',
          imageUrls: [twin.reference_images[0]],
          audioUrl: segment.audioUrl,
          duration: segment.duration
        }
      }
    });

    if (error) throw error;
    return await pollForVideo(data.taskId);
  }

  // For B-roll - generate image then video
  if (segment.type === 'broll-voice-continue' || segment.type === 'broll-montage') {
    const prompts = segment.brollPrompts || [];
    const videoUrls: string[] = [];

    for (const prompt of prompts.slice(0, 5)) {
      // Generate image
      const { data: imageData } = await supabase.functions.invoke('generate-scene-image', {
        body: { prompt, sceneType: 'commercial' }
      });

      if (!imageData?.imageUrl) continue;

      // Generate short video from image
      const { data: videoData } = await supabase.functions.invoke('wavespeed-video', {
        body: {
          action: 'create',
          params: {
            model: 'wan-2.5-i2v',
            prompt,
            imageUrls: [imageData.imageUrl],
            duration: Math.ceil(segment.duration / prompts.length)
          }
        }
      });

      if (videoData?.taskId) {
        const videoUrl = await pollForVideo(videoData.taskId);
        videoUrls.push(videoUrl);
      }
    }

    // If montage, stitch b-roll clips with audio
    if (segment.type === 'broll-montage' && videoUrls.length > 0) {
      const { data } = await supabase.functions.invoke('creatomate-stitch', {
        body: {
          clips: videoUrls.map((url, i) => ({
            url,
            duration: segment.duration / videoUrls.length
          })),
          audioUrl: segment.audioUrl,
          transition: 'cut'
        }
      });

      if (data?.renderId) {
        return await pollForCreatomate(data.renderId);
      }
    }

    return videoUrls[0] || '';
  }

  throw new Error('Unknown segment type');
}

async function pollForVideo(taskId: string): Promise<string> {
  const maxAttempts = 60;
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise(r => setTimeout(r, 5000));

    const { data } = await supabase.functions.invoke('wavespeed-video', {
      body: { action: 'status', taskId }
    });

    if (data?.status === 'completed' && data?.videoUrl) {
      return data.videoUrl;
    }
    if (data?.status === 'failed') {
      throw new Error(data.error || 'Video generation failed');
    }
  }
  throw new Error('Video generation timed out');
}

async function pollForCreatomate(renderId: string): Promise<string> {
  const maxAttempts = 30;
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise(r => setTimeout(r, 3000));

    const { data } = await supabase.functions.invoke('creatomate-status', {
      body: { renderId }
    });

    if (data?.status === 'succeeded' && data?.url) {
      return data.url;
    }
    if (data?.status === 'failed') {
      throw new Error('Video stitching failed');
    }
  }
  throw new Error('Video stitching timed out');
}

async function stitchCommercial(segments: CommercialSegment[]): Promise<string> {
  const clips = segments
    .filter(s => s.videoUrl)
    .map(s => ({
      url: s.videoUrl!,
      duration: s.duration,
      transition: s.transition
    }));

  const { data, error } = await supabase.functions.invoke('creatomate-stitch', {
    body: { clips }
  });

  if (error) throw error;

  return await pollForCreatomate(data.renderId);
}
