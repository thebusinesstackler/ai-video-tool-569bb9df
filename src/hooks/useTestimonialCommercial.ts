import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { CommercialSegment, TestimonialCommercial, CharacterProfile } from '@/types/testimonialCommercial';
import { toast } from 'sonner';

const ANGLE_PROMPTS = [
  (desc: string) => `Photorealistic front portrait of ${desc}. 85mm lens, studio lighting, neutral background, direct eye contact, shoulders visible. No text, no watermark.`,
  (desc: string) => `Photorealistic 3/4 left profile of ${desc}. 50mm lens, soft studio lighting, turned slightly left, warm expression. No text, no watermark.`,
  (desc: string) => `Photorealistic side profile of ${desc}. 85mm lens, dramatic rim lighting, clean background, elegant pose. No text, no watermark.`,
  (desc: string) => `Photorealistic low angle hero shot of ${desc}. 35mm lens, looking up at subject, powerful composition, confident expression. No text, no watermark.`,
  (desc: string) => `Photorealistic 3/4 right profile of ${desc}. 50mm lens, natural lighting, turned slightly right, approachable expression. No text, no watermark.`,
  (desc: string) => `Photorealistic casual wide shot of ${desc}. 35mm lens, environmental portrait, professional setting, relaxed pose. No text, no watermark.`,
];

export function useTestimonialCommercial() {
  const [segments, setSegments] = useState<CommercialSegment[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [currentCommercial, setCurrentCommercial] = useState<TestimonialCommercial | null>(null);

  const addSegment = useCallback((type: CommercialSegment['type']) => {
    const newSegment: CommercialSegment = {
      id: crypto.randomUUID(),
      type,
      duration: type === 'broll' ? 8 : 10,
      transition: type === 'speaking' ? 'fade-in' : 'cut',
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
      const next = [...prev];
      const [removed] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, removed);
      return next;
    });
  }, []);

  const approveAllSegments = useCallback(() => {
    setSegments(prev => prev.map(s => 
      s.type === 'speaking' && (s.status === 'character-ready' || s.status === 'pending')
        ? { ...s, status: 'approved' as const }
        : s
    ));
    toast.success('All scenes approved!');
  }, []);

  // Generate 6-angle character images for a speaking segment
  const generateCharacterForSegment = useCallback(async (segmentId: string, description: string) => {
    updateSegment(segmentId, { status: 'generating-character' });
    toast.info('Generating character with 6 cinematic angles...');

    try {
      // Generate first image to establish the look
      const { data: firstImg, error: firstErr } = await supabase.functions.invoke('generate-scene-image', {
        body: {
          prompt: ANGLE_PROMPTS[0](description),
          aspectRatio: '1:1'
        }
      });
      if (firstErr || !firstImg?.imageUrl) throw new Error('Failed to generate initial portrait');

      const referenceImages = [firstImg.imageUrl];

      // Generate remaining 5 angles in parallel
      const remaining = await Promise.allSettled(
        ANGLE_PROMPTS.slice(1).map(promptFn =>
          supabase.functions.invoke('generate-scene-image', {
            body: {
              prompt: promptFn(description),
              aspectRatio: '1:1',
              referenceImageUrl: firstImg.imageUrl
            }
          })
        )
      );

      for (const result of remaining) {
        if (result.status === 'fulfilled' && result.value.data?.imageUrl) {
          referenceImages.push(result.value.data.imageUrl);
        }
      }

      const character: CharacterProfile = {
        name: description.slice(0, 60),
        description,
        referenceImages,
      };

      // Save as AI Twin for reuse
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: twin } = await supabase
          .from('ai_twins')
          .insert({
            user_id: user.id,
            name: character.name,
            description,
            reference_images: referenceImages,
          })
          .select('id')
          .single();

        if (twin) character.twinId = twin.id;
      }

      updateSegment(segmentId, {
        character,
        status: 'character-ready',
      });

      toast.success(`Character generated with ${referenceImages.length} angles!`);
    } catch (err) {
      console.error('Character generation error:', err);
      updateSegment(segmentId, { status: 'error' });
      toast.error('Failed to generate character');
    }
  }, [updateSegment]);

  const saveCommercial = useCallback(async (name: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { toast.error('Please sign in'); return null; }

    const segmentsJson = JSON.parse(JSON.stringify(segments));

    if (currentCommercial) {
      const { error } = await supabase
        .from('testimonial_commercials')
        .update({ name, segments: segmentsJson })
        .eq('id', currentCommercial.id);
      if (error) { toast.error('Failed to save'); return null; }
      toast.success('Saved');
      return currentCommercial.id;
    } else {
      const { data, error } = await supabase
        .from('testimonial_commercials')
        .insert({ user_id: user.id, name, segments: segmentsJson })
        .select()
        .single();
      if (error) { toast.error('Failed to save'); return null; }
      setCurrentCommercial(data as unknown as TestimonialCommercial);
      toast.success('Saved');
      return data.id;
    }
  }, [segments, currentCommercial]);

  const loadCommercial = useCallback(async (id: string) => {
    const { data, error } = await supabase
      .from('testimonial_commercials')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) { toast.error('Failed to load'); return; }
    const commercial = data as unknown as TestimonialCommercial;
    setCurrentCommercial(commercial);
    setSegments(commercial.segments || []);
  }, []);

  const generateCommercial = useCallback(async () => {
    if (segments.length === 0) { toast.error('Add segments first'); return; }

    // Validate speaking segments
    for (const seg of segments) {
      if (seg.type === 'speaking' && !seg.script) {
        toast.error('Each speaking scene needs a script');
        return;
      }
    }

    setIsGenerating(true);
    setGenerationProgress(0);

    try {
      const totalSteps = segments.length * 2 + 1;
      let step = 0;

      for (let i = 0; i < segments.length; i++) {
        const segment = segments[i];
        updateSegment(segment.id, { status: 'generating' });

        try {
          if (segment.type === 'speaking') {
            // Use VEO3 for speaking segments - generates video with built-in voice
            const character = segment.character;
            const referenceImage = character?.referenceImages?.[0];

            // Build rich VEO3 prompt
            const charDesc = character?.description || 'A professional person';
            const veo3Prompt = `A ${charDesc} looking directly at the camera and speaking: "${segment.script}". Professional studio lighting, neutral background, natural lip movements, photorealistic.`;

            const { data, error } = await supabase.functions.invoke('wavespeed-video', {
              body: {
                action: 'create',
                model: 'veo3',
                prompt: veo3Prompt,
                duration: Math.min(segment.duration, 8),
                aspectRatio: '16:9',
                ...(referenceImage ? { imageUrls: [referenceImage] } : {}),
              }
            });

            if (error) throw error;
            if (!data?.taskId) throw new Error('No task ID returned');

            step++;
            setGenerationProgress((step / totalSteps) * 100);

            const videoUrl = await pollForVideo(data.taskId);
            updateSegment(segment.id, { videoUrl, status: 'complete' });
          } else {
            // B-roll: generate image then video
            const prompt = segment.brollPrompts?.[0] || 'Professional B-roll footage';

            const { data: imgData } = await supabase.functions.invoke('generate-scene-image', {
              body: { prompt, aspectRatio: '16:9' }
            });

            step++;
            setGenerationProgress((step / totalSteps) * 100);

            if (imgData?.imageUrl) {
              // Mark b-roll image as ready immediately
              updateSegment(segment.id, { brollImages: [imgData.imageUrl], status: 'character-ready' });

              try {
                const { data: vidData } = await supabase.functions.invoke('wavespeed-video', {
                  body: {
                    action: 'create',
                    model: 'wan-2.5-i2v',
                    prompt,
                    imageUrls: [imgData.imageUrl],
                    duration: Math.min(segment.duration, 8),
                  }
                });

                if (vidData?.taskId) {
                  const videoUrl = await pollForVideo(vidData.taskId);
                  updateSegment(segment.id, { videoUrl, status: 'complete' });
                }
              } catch (vidErr) {
                console.warn(`B-roll video gen failed for segment ${i}, image still available:`, vidErr);
                // Keep character-ready status since image was generated successfully
              }
            } else {
              updateSegment(segment.id, { status: 'error' });
            }
          }

          step++;
          setGenerationProgress((step / totalSteps) * 100);
        } catch (err) {
          console.error(`Segment ${i} failed:`, err);
          updateSegment(segment.id, { status: 'error' });
          // Continue with other segments
          step += 2;
          setGenerationProgress((step / totalSteps) * 100);
        }
      }

      // Stitch videos
      toast.info('Stitching commercial...');
      const finalUrl = await stitchCommercial(segments);

      if (currentCommercial) {
        await supabase.from('testimonial_commercials')
          .update({ video_url: finalUrl })
          .eq('id', currentCommercial.id);
      }

      setGenerationProgress(100);
      toast.success('Commercial generated!');
      return finalUrl;
    } catch (error) {
      console.error('Generation failed:', error);
      toast.error('Generation failed');
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
    generateCharacterForSegment,
    approveAllSegments,
    isGenerating,
    generationProgress,
    currentCommercial,
    setCurrentCommercial,
  };
}

async function pollForVideo(taskId: string): Promise<string> {
  const maxAttempts = 60;
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise(r => setTimeout(r, 5000));
    const { data } = await supabase.functions.invoke('wavespeed-video', {
      body: { action: 'status', taskId }
    });
    if (data?.status === 'completed' && data?.videoUrl) return data.videoUrl;
    if (data?.status === 'failed') throw new Error(data.error || 'Video generation failed');
  }
  throw new Error('Video generation timed out');
}

async function stitchCommercial(segments: CommercialSegment[]): Promise<string> {
  const clips = segments.filter(s => s.videoUrl).map(s => ({
    url: s.videoUrl!,
    duration: s.duration,
    transition: s.transition,
  }));

  if (clips.length === 0) throw new Error('No video clips to stitch');

  try {
    const { data, error } = await supabase.functions.invoke('creatomate-stitch', {
      body: { clips }
    });
    if (error) throw error;
    if (data?.success === false) throw new Error(data?.error || 'Stitch failed');

    // Poll for creatomate
    const maxAttempts = 30;
    for (let i = 0; i < maxAttempts; i++) {
      await new Promise(r => setTimeout(r, 3000));
      const { data: status } = await supabase.functions.invoke('creatomate-status', {
        body: { renderId: data.renderId }
      });
      if (status?.status === 'succeeded' && status?.url) return status.url;
      if (status?.status === 'failed') throw new Error('Stitching failed');
    }
    throw new Error('Stitching timed out');
  } catch (err) {
    console.warn('Creatomate stitch failed, falling back:', err);
    const { stitchVideosWithAudio } = await import('@/lib/videoStitch');
    const blob = await stitchVideosWithAudio({ videoUrls: clips.map(c => c.url), audioUrls: [] });
    return URL.createObjectURL(blob);
  }
}
