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

export type VideoFormat = '9:16' | '16:9' | '1:1';
export type VideoStyle = 'tiktok-meme' | 'tiktok-talking-head' | 'youtube-ad' | 'instagram-reel' | 'professional-ad';

interface GenerationConfig {
  format: VideoFormat;
  style: VideoStyle;
}

// Map style to optimal models and settings
function getStyleConfig(style: VideoStyle) {
  switch (style) {
    case 'tiktok-meme':
      return {
        speakingModel: 'infinitetalk' as const,
        brollModel: 'alibaba/wan-2.5/text-to-video' as const,
        useTTS: true,
        maxDuration: 8,
        aspectRatio: '9:16' as const,
      };
    case 'tiktok-talking-head':
      return {
        speakingModel: 'infinitetalk' as const,
        brollModel: 'alibaba/wan-2.5/text-to-video' as const,
        useTTS: true,
        maxDuration: 10,
        aspectRatio: '9:16' as const,
      };
    case 'instagram-reel':
      return {
        speakingModel: 'infinitetalk' as const,
        brollModel: 'alibaba/wan-2.5/text-to-video' as const,
        useTTS: true,
        maxDuration: 10,
        aspectRatio: '9:16' as const,
      };
    case 'youtube-ad':
      return {
        speakingModel: 'infinitetalk' as const,
        brollModel: 'alibaba/wan-2.5/text-to-video' as const,
        useTTS: true,
        maxDuration: 10,
        aspectRatio: '16:9' as const,
      };
    case 'professional-ad':
      return {
        speakingModel: 'infinitetalk' as const,
        brollModel: 'kling-v3.0-pro' as const,
        useTTS: true,
        maxDuration: 10,
        aspectRatio: '16:9' as const,
      };
    default:
      return {
        speakingModel: 'kling-v3.0-pro' as const,
        brollModel: 'kling-v3.0-pro' as const,
        useTTS: true,
        maxDuration: 10,
        aspectRatio: '9:16' as const,
      };
  }
}

export function useTestimonialCommercial() {
  const [segments, setSegments] = useState<CommercialSegment[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [currentCommercial, setCurrentCommercial] = useState<TestimonialCommercial | null>(null);
  const [videoFormat, setVideoFormat] = useState<VideoFormat>('9:16');
  const [videoStyle, setVideoStyle] = useState<VideoStyle>('tiktok-meme');

  const addSegment = useCallback((type: CommercialSegment['type'], prefill?: Partial<CommercialSegment>) => {
    const newSegment: CommercialSegment = {
      id: crypto.randomUUID(),
      type,
      duration: type === 'broll' ? 8 : 10,
      transition: type === 'speaking' ? 'fade-in' : 'cut',
      status: 'pending',
      ...prefill,
    };
    setSegments(prev => [...prev, newSegment]);
    return newSegment;
  }, []);

  const updateSegment = useCallback((id: string, updates: Partial<CommercialSegment>) => {
    setSegments(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s));
  }, []);

  const deleteSegment = useCallback((id: string) => {
    setSegments(prev => prev.filter(s => s.id !== id));
  }, []);

  const duplicateSegment = useCallback((id: string) => {
    setSegments(prev => {
      const source = prev.find(s => s.id === id);
      if (!source) return prev;
      const clone: CommercialSegment = {
        ...JSON.parse(JSON.stringify(source)),
        id: crypto.randomUUID(),
        status: 'pending',
        videoUrl: undefined,
        audioUrl: undefined,
      };
      const idx = prev.findIndex(s => s.id === id);
      const next = [...prev];
      next.splice(idx + 1, 0, clone);
      return next;
    });
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
      const { data: firstImg, error: firstErr } = await supabase.functions.invoke('generate-scene-image', {
        body: {
          prompt: ANGLE_PROMPTS[0](description),
          aspectRatio: '1:1'
        }
      });
      if (firstErr || !firstImg?.imageUrl) throw new Error('Failed to generate initial portrait');

      const referenceImages = [firstImg.imageUrl];

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

    for (const seg of segments) {
      if (seg.type === 'speaking' && !seg.script) {
        toast.error('Each speaking scene needs a script');
        return;
      }
    }

    setIsGenerating(true);
    setGenerationProgress(0);

    const styleConfig = getStyleConfig(videoStyle);
    const aspectRatio = videoFormat || styleConfig.aspectRatio;
    let creditError = false;

    try {
      const totalSteps = segments.length * 2 + 1;
      let step = 0;
      // Track generated clips locally to avoid stale React state
      const generatedClips: { id: string; videoUrl: string; audioUrl?: string; duration: number; script?: string }[] = [];

      for (let i = 0; i < segments.length; i++) {
        if (creditError) break; // Stop if credits exhausted
        
        const segment = segments[i];
        updateSegment(segment.id, { status: 'generating' });

        try {
          if (segment.type === 'speaking') {
            // Step 1: Generate character image if we don't have one
            let referenceImage = segment.character?.referenceImages?.[0];
            
            if (!referenceImage) {
              const charDesc = segment.character?.description || 'A professional person';
              toast.info(`Scene ${i + 1}: Generating character image...`);
              const { data: imgData } = await supabase.functions.invoke('generate-scene-image', {
                body: {
                  prompt: `Photorealistic portrait of ${charDesc}. 85mm lens, studio lighting, neutral background, looking at camera. No text, no watermark.`,
                  aspectRatio: aspectRatio === '9:16' ? '9:16' : '16:9'
                }
              });
              if (imgData?.imageUrl) {
                referenceImage = imgData.imageUrl;
                updateSegment(segment.id, {
                  character: {
                    ...(segment.character || { name: charDesc.slice(0, 60), description: charDesc, referenceImages: [] }),
                    referenceImages: [imgData.imageUrl],
                  }
                });
              }
            }

            step++;
            setGenerationProgress((step / totalSteps) * 100);

            // Step 2: Generate TTS audio
            toast.info(`Scene ${i + 1}: Generating voiceover...`);
            const gender = segment.character?.gender || 
              (segment.character?.description?.toLowerCase().includes('female') || 
               segment.character?.description?.toLowerCase().includes('woman') ? 'female' : 'male');
            
            const { data: ttsData, error: ttsError } = await supabase.functions.invoke('text-to-speech', {
              body: {
                text: segment.script,
                voice: 'ai-auto',
                gender,
              }
            });

            let audioUrl = ttsData?.audioUrl;
            
            // If TTS returned a data: URL, upload to storage for video API compatibility
            if (audioUrl?.startsWith('data:')) {
              try {
                const base64Data = audioUrl.split(',')[1];
                const binaryString = atob(base64Data);
                const bytes = new Uint8Array(binaryString.length);
                for (let j = 0; j < binaryString.length; j++) {
                  bytes[j] = binaryString.charCodeAt(j);
                }
                const blob = new Blob([bytes], { type: 'audio/mp3' });
                const fileName = `commercial-tts-${segment.id}-${Date.now()}.mp3`;
                
                const { data: uploadData } = await supabase.storage
                  .from('reels')
                  .upload(fileName, blob, { contentType: 'audio/mp3', upsert: true });
                
                if (uploadData?.path) {
                  const { data: urlData } = supabase.storage.from('reels').getPublicUrl(uploadData.path);
                  audioUrl = urlData?.publicUrl || audioUrl;
                }
              } catch (uploadErr) {
                console.warn('Audio upload failed, using data URL:', uploadErr);
              }
            }

            // Step 3: Generate video with image + audio
            if (referenceImage) {
              toast.info(`Scene ${i + 1}: Generating video...`);
              
              const videoBody: any = {
                action: 'create',
                model: styleConfig.speakingModel,
                prompt: `${segment.character?.description || 'A person'} speaking naturally, professional lighting, ${aspectRatio === '9:16' ? 'vertical TikTok format' : 'horizontal format'}. Smooth natural motion, photorealistic.`,
                imageUrls: [referenceImage],
                duration: Math.min(segment.duration, styleConfig.maxDuration),
                aspectRatio,
              };
              
              // Add audio for lip-sync if available
              if (audioUrl && !audioUrl.startsWith('data:')) {
                videoBody.audioUrl = audioUrl;
              }
              
              const { data, error } = await supabase.functions.invoke('wavespeed-video', {
                body: videoBody
              });

              if (data?.creditError) {
                creditError = true;
                toast.error('⚠️ Video credits exhausted. Please top up your WaveSpeed account.');
                updateSegment(segment.id, { audioUrl, status: 'error' });
                break;
              }
              
              if (data?.error) {
                console.error(`Scene ${i + 1} video error:`, data.error);
                // Save the audio even if video fails
                updateSegment(segment.id, { audioUrl, status: 'error' });
                step++;
                setGenerationProgress((step / totalSteps) * 100);
                continue;
              }
              
              if (!data?.taskId) {
                updateSegment(segment.id, { audioUrl, status: 'error' });
                step++;
                continue;
              }

              const videoUrl = await pollForVideo(data.taskId);
              updateSegment(segment.id, { videoUrl, audioUrl, status: 'complete' });
              generatedClips.push({ id: segment.id, videoUrl, audioUrl, duration: segment.duration, script: segment.script });
            } else {
              updateSegment(segment.id, { audioUrl, status: 'error' });
            }
          } else {
            // B-roll: generate image then video
            const prompt = segment.brollPrompts?.[0] || 'Professional B-roll footage';

            // Use existing b-roll image if already generated
            let brollImage = segment.brollImages?.[0];
            
            if (!brollImage) {
              toast.info(`B-Roll ${i + 1}: Generating image...`);
              const { data: imgData } = await supabase.functions.invoke('generate-scene-image', {
                body: { prompt, aspectRatio: aspectRatio === '9:16' ? '9:16' : '16:9' }
              });
              if (imgData?.imageUrl) brollImage = imgData.imageUrl;
            }

            step++;
            setGenerationProgress((step / totalSteps) * 100);

            if (brollImage) {
              updateSegment(segment.id, { brollImages: [brollImage], status: 'character-ready' });

              // Generate TTS for voiceover if specified
              let voiceoverAudioUrl: string | undefined;
              if (segment.voiceoverText) {
                const { data: ttsData } = await supabase.functions.invoke('text-to-speech', {
                  body: { text: segment.voiceoverText, voice: 'ai-auto', gender: 'male' }
                });
                voiceoverAudioUrl = ttsData?.audioUrl;
              }

              toast.info(`B-Roll ${i + 1}: Generating video...`);
              try {
                const { data: vidData } = await supabase.functions.invoke('wavespeed-video', {
                  body: {
                    action: 'create',
                    model: styleConfig.brollModel,
                    prompt: `${prompt}. Cinematic motion, ${aspectRatio === '9:16' ? 'vertical format' : 'horizontal format'}, professional quality.`,
                    imageUrls: [brollImage],
                    duration: Math.min(segment.duration, styleConfig.maxDuration),
                    aspectRatio,
                  }
                });

                if (vidData?.creditError) {
                  creditError = true;
                  toast.error('⚠️ Video credits exhausted. Please top up your WaveSpeed account.');
                  break;
                }

                if (vidData?.taskId) {
                  const videoUrl = await pollForVideo(vidData.taskId);
                  updateSegment(segment.id, { 
                    videoUrl, 
                    audioUrl: voiceoverAudioUrl,
                    status: 'complete' 
                  });
                  generatedClips.push({ id: segment.id, videoUrl, audioUrl: voiceoverAudioUrl, duration: segment.duration });
                } else if (vidData?.error) {
                  console.warn(`B-roll video failed: ${vidData.error}`);
                }
              } catch (vidErr) {
                console.warn(`B-roll video gen failed for segment ${i}:`, vidErr);
              }
            } else {
              updateSegment(segment.id, { status: 'error' });
            }
          }

          step++;
          setGenerationProgress((step / totalSteps) * 100);
        } catch (err) {
          console.error(`Segment ${i + 1} failed:`, err);
          updateSegment(segment.id, { status: 'error' });
          step += 2;
          setGenerationProgress((step / totalSteps) * 100);
        }
      }

      // Stitch videos using locally tracked clips (avoids stale React state)
      if (generatedClips.length === 0) {
        throw new Error('No video clips to stitch');
      }
      
      toast.info(`Stitching ${generatedClips.length} clips...`);
      const finalUrl = await stitchCommercialFromClips(generatedClips, aspectRatio);

      if (currentCommercial) {
        await supabase.from('testimonial_commercials')
          .update({ video_url: finalUrl })
          .eq('id', currentCommercial.id);
      }

      setGenerationProgress(100);
      
      if (creditError) {
        toast.warning('Commercial partially generated — some scenes failed due to insufficient credits.');
      } else {
        toast.success('Commercial generated!');
      }
      
      return finalUrl;
    } catch (error) {
      console.error('Generation failed:', error);
      const msg = error instanceof Error ? error.message : 'Generation failed';
      if (msg.includes('No video clips')) {
        toast.error('No videos were generated. Please check your WaveSpeed credits and try again.');
      } else {
        toast.error(msg);
      }
    } finally {
      setIsGenerating(false);
    }
  }, [segments, updateSegment, currentCommercial, videoFormat, videoStyle]);

  return {
    segments,
    setSegments,
    addSegment,
    updateSegment,
    deleteSegment,
    duplicateSegment,
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
    videoFormat,
    setVideoFormat,
    videoStyle,
    setVideoStyle,
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
    if (data?.creditError) throw new Error('Insufficient credits');
  }
  throw new Error('Video generation timed out');
}

async function stitchCommercialFromClips(
  clips: { id: string; videoUrl: string; audioUrl?: string; duration: number; script?: string }[],
  aspectRatio: string = '9:16'
): Promise<string> {
  const stitchClips = clips.map(c => ({
    url: c.videoUrl,
    duration: c.duration,
    caption: c.script?.slice(0, 100),
  }));

  const audioUrls = clips.filter(c => c.audioUrl).map(c => c.audioUrl!);

  try {
    const { data, error } = await supabase.functions.invoke('creatomate-stitch', {
      body: { 
        clips: stitchClips,
        audioUrl: audioUrls.length > 0 ? audioUrls[0] : undefined,
        transition: 'crossfade',
        captionStyle: 'bottom',
      }
    });
    if (error) throw error;
    if (data?.success === false) throw new Error(data?.error || 'Stitch failed');

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
    console.warn('Creatomate stitch failed, falling back to canvas:', err);
    const { stitchVideosWithAudio } = await import('@/lib/videoStitch');
    const blob = await stitchVideosWithAudio({ 
      videoUrls: stitchClips.map(c => c.url), 
      audioUrls 
    });
    return URL.createObjectURL(blob);
  }
}
