import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { CommercialSegment, TestimonialCommercial } from '@/types/testimonialCommercial';
import { toast } from 'sonner';
import { testimonialExamples, CommercialTemplate } from '@/data/testimonialExamples';

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

  const generateCommercial = useCallback(async (options?: {
    introLogoUrl?: string | null;
    introLogoAnimation?: string;
    outroLogoUrl?: string | null;
    outroLogoAnimation?: string;
  }) => {
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

      // Process each segment - store generated URLs to pass forward
      const generatedData: { audioUrl?: string; videoUrl?: string; audioDuration?: number }[] = [];
      
      for (let i = 0; i < segments.length; i++) {
        const segment = segments[i];
        updateSegment(segment.id, { status: 'generating' });
        generatedData[i] = {};

        try {
          // Generate audio for speaking/montage segments
          let audioUrl: string | undefined;
          let audioDuration: number | undefined;
          if (segment.type === 'twin-speaking' || segment.type === 'broll-montage') {
            const audioResult = await generateAudioForSegment(segment);
            audioUrl = audioResult.audioUrl;
            audioDuration = audioResult.duration;
            generatedData[i].audioUrl = audioUrl;
            generatedData[i].audioDuration = audioDuration;
            updateSegment(segment.id, { audioUrl, duration: audioDuration });
          }

          currentStep++;
          setGenerationProgress((currentStep / totalSteps) * 100);

          // Generate video for segment - pass audioUrl and duration directly since state hasn't updated yet
          const segmentWithAudio = { 
            ...segment, 
            audioUrl: audioUrl || segment.audioUrl,
            duration: audioDuration || segment.duration 
          };
          const previousData = i > 0 ? generatedData[i - 1] : null;
          const videoResult = await generateVideoForSegment(
            segmentWithAudio, 
            i > 0 ? { ...segments[i - 1], ...previousData } : null,
            audioDuration
          );
          generatedData[i].videoUrl = videoResult;
          
          // Update segment and auto-save to database
          const updatedSegment = { 
            ...segment, 
            audioUrl: audioUrl || segment.audioUrl, 
            videoUrl: videoResult, 
            duration: audioDuration || segment.duration,
            status: 'complete' as const 
          };
          updateSegment(segment.id, { videoUrl: videoResult, status: 'complete', duration: audioDuration || segment.duration });
          
          // Auto-save progress to database
          if (currentCommercial) {
            const updatedSegments = segments.map((s, idx) => 
              idx === i ? updatedSegment : (idx < i ? { ...s, ...generatedData[idx] } : s)
            );
            await supabase
              .from('testimonial_commercials')
              .update({ segments: JSON.parse(JSON.stringify(updatedSegments)) })
              .eq('id', currentCommercial.id);
          }

          currentStep++;
          setGenerationProgress((currentStep / totalSteps) * 100);
        } catch (err) {
          console.error(`Failed to generate segment ${i}:`, err);
          updateSegment(segment.id, { status: 'error' });
          throw err;
        }
      }

      // Stitch all videos together with intro/outro logos
      toast.info('Stitching commercial...');
      const finalVideoUrl = await stitchCommercial(segments, {
        introLogoUrl: options?.introLogoUrl || undefined,
        introLogoAnimation: options?.introLogoAnimation,
        outroLogoUrl: options?.outroLogoUrl || undefined,
        outroLogoAnimation: options?.outroLogoAnimation
      });

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

  const loadExampleTemplate = useCallback(async (templateId: string): Promise<{ success: boolean; name?: string }> => {
    const template = testimonialExamples.find(t => t.id === templateId);
    if (!template) {
      toast.error('Template not found');
      return { success: false };
    }

    // Fetch user's AI twins with cloned voices
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error('Please sign in first');
      return { success: false };
    }

    const { data: twins } = await supabase
      .from('ai_twins')
      .select('id, name, voice_cloning_key')
      .eq('user_id', user.id)
      .not('voice_cloning_key', 'is', null);

    if (!twins || twins.length === 0) {
      toast.error('You need at least one AI Twin with a cloned voice to use examples');
      return { success: false };
    }

    if (twins.length < template.twinCount) {
      toast.warning(`This template uses ${template.twinCount} twins but you only have ${twins.length}. Some segments will share the same twin.`);
    }

    // Create segments with assigned twins
    let twinIndex = 0;
    const newSegments: CommercialSegment[] = template.segments.map((seg) => {
      const segment: CommercialSegment = {
        ...seg,
        id: crypto.randomUUID()
      };

      // Assign twins to speaking segments
      if (seg.type === 'twin-speaking') {
        segment.twinId = twins[twinIndex % twins.length].id;
        twinIndex++;
      }

      // Assign voiceover twin for montage segments
      if (seg.type === 'broll-montage') {
        segment.voiceoverId = twins[0].id; // Use first twin for voiceover
      }

      return segment;
    });

    setSegments(newSegments);
    setCurrentCommercial(null); // Reset current commercial since this is a new one
    toast.success(`Loaded "${template.name}" template`);
    
    return { success: true, name: template.name };
  }, []);

  return {
    segments,
    setSegments,
    addSegment,
    updateSegment,
    deleteSegment,
    reorderSegments,
    saveCommercial,
    loadCommercial,
    loadExampleTemplate,
    generateCommercial,
    isGenerating,
    generationProgress,
    currentCommercial,
    setCurrentCommercial
  };
}

async function generateAudioForSegment(segment: CommercialSegment): Promise<{ audioUrl: string; duration: number }> {
  // Get the twin's voice cloning key
  const twinId = segment.type === 'twin-speaking' ? segment.twinId : segment.voiceoverId;
  
  if (!twinId) {
    throw new Error('No twin selected for this segment');
  }
  
  const { data: twin } = await supabase
    .from('ai_twins')
    .select('voice_cloning_key')
    .eq('id', twinId)
    .single();

  if (!twin?.voice_cloning_key) {
    throw new Error('Twin does not have a cloned voice');
  }

  const text = segment.type === 'twin-speaking' ? segment.script : segment.voiceoverText;
  
  // Get current user for audio storage path
  const { data: { user } } = await supabase.auth.getUser();

  const { data, error } = await supabase.functions.invoke('text-to-speech', {
    body: {
      text,
      voiceId: twin.voice_cloning_key,
      userId: user?.id
    }
  });

  if (error || !data?.audioUrl) {
    throw new Error('Failed to generate audio');
  }

  // Return both the URL and estimated duration
  return {
    audioUrl: data.audioUrl,
    duration: data.duration || Math.ceil((text?.length || 0) / 15) // Fallback estimate
  };
}

async function generateVideoForSegment(
  segment: CommercialSegment,
  previousSegment: CommercialSegment | null,
  audioDuration?: number
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

    if (!segment.audioUrl) {
      throw new Error('Audio URL is required for lip-sync video');
    }

    // Use actual audio duration for lip-sync video
    const videoDuration = audioDuration || segment.duration || 10;
    console.log(`Generating lip-sync video with duration: ${videoDuration}s, audioUrl: ${segment.audioUrl.substring(0, 50)}...`);

    const { data, error } = await supabase.functions.invoke('wavespeed-video', {
      body: {
        action: 'create',
        model: 'infinitetalk',
        imageUrls: [twin.reference_images[0]],
        audioUrl: segment.audioUrl,
        duration: videoDuration
      }
    });

    if (error) throw error;
    if (!data?.taskId) throw new Error('No task ID returned from video generation');
    return await pollForVideo(data.taskId);
  }

  // For B-roll - generate image then video
  if (segment.type === 'broll-voice-continue' || segment.type === 'broll-montage') {
    const prompts = segment.brollPrompts || [];
    const videoUrls: string[] = [];
    
    // Use audio duration for total B-roll length, divide among clips
    const totalDuration = audioDuration || segment.duration || 10;
    const clipDuration = Math.max(5, Math.ceil(totalDuration / Math.max(prompts.length, 1)));

    for (const prompt of prompts.slice(0, 5)) {
      // Generate image
      const { data: imageData } = await supabase.functions.invoke('generate-scene-image', {
        body: { prompt, sceneType: 'commercial' }
      });

      if (!imageData?.imageUrl) continue;

      // Generate short video from image - WaveSpeed i2v supports 5-10s
      const { data: videoData } = await supabase.functions.invoke('wavespeed-video', {
        body: {
          action: 'create',
          model: 'wan-2.5-i2v',
          prompt,
          imageUrls: [imageData.imageUrl],
          duration: Math.min(clipDuration, 10) // Max 10s per clip
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
            duration: totalDuration / videoUrls.length,
            audioDuration: audioDuration // Pass audio duration for proper sync
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

async function stitchCommercial(
  segments: CommercialSegment[],
  options?: {
    introLogoUrl?: string;
    introLogoAnimation?: string;
    outroLogoUrl?: string;
    outroLogoAnimation?: string;
  }
): Promise<string> {
  const clips = segments
    .filter(s => s.videoUrl)
    .map(s => ({
      url: s.videoUrl!,
      duration: s.duration,
      transition: s.transition
    }));

  const { data, error } = await supabase.functions.invoke('creatomate-stitch', {
    body: { 
      clips,
      introLogo: options?.introLogoUrl ? {
        url: options.introLogoUrl,
        animation: options.introLogoAnimation || 'fade',
        duration: 3
      } : undefined,
      outroLogo: options?.outroLogoUrl ? {
        url: options.outroLogoUrl,
        animation: options.outroLogoAnimation || 'fade',
        duration: 3
      } : undefined
    }
  });

  if (error) throw error;

  return await pollForCreatomate(data.renderId);
}
