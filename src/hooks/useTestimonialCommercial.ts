import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { CommercialSegment, TestimonialCommercial, CharacterProfile } from '@/types/testimonialCommercial';
import { sanitizeForTTS } from '@/lib/audioSanitizer';
import { toast } from 'sonner';

const ANGLE_PROMPTS = [
  (desc: string) => `Photorealistic front portrait of ${desc}. Shot on RED V-RAPTOR at 85mm f/1.4, cinematic studio lighting with soft key light at 45 degrees and subtle rim light, neutral background with shallow depth of field, direct eye contact, shoulders visible, broadcast television quality. No text, no watermark.`,
  (desc: string) => `Photorealistic 3/4 left profile of ${desc}. Shot on ARRI Alexa at 50mm f/2.0, soft studio lighting with warm color temperature, slightly turned left, warm confident expression, professional color grading. No text, no watermark.`,
  (desc: string) => `Photorealistic side profile of ${desc}. Shot on RED V-RAPTOR at 85mm f/1.4, dramatic rim lighting from behind creating a golden edge, clean blurred background, elegant pose, cinematic contrast. No text, no watermark.`,
  (desc: string) => `Photorealistic low angle hero shot of ${desc}. Shot at 35mm f/2.8, looking up at subject creating a powerful composition, confident expression, dramatic upward lighting, aspirational feel. No text, no watermark.`,
  (desc: string) => `Photorealistic 3/4 right profile of ${desc}. Shot at 50mm f/2.0, natural warm lighting, turned slightly right with approachable expression, shallow depth of field, commercial quality. No text, no watermark.`,
  (desc: string) => `Photorealistic environmental wide shot of ${desc}. Shot at 35mm f/2.8, professional setting with contextual background, relaxed natural pose, cinematic color grading with warm highlights. No text, no watermark.`,
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
        brollModel: 'alibaba/wan-2.5/text-to-video' as const,
        useTTS: true,
        maxDuration: 10,
        aspectRatio: '16:9' as const,
      };
    default:
      return {
        speakingModel: 'infinitetalk' as const,
        brollModel: 'alibaba/wan-2.5/text-to-video' as const,
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
      const generatedClips: { id: string; videoUrl: string; audioUrl?: string; duration: number; script?: string }[] = [];

      // === ACTOR CONSISTENCY: Group speaking segments by characterId (twinId) ===
      // Generate ONE set of reference images per unique character, then reuse
      const characterGroups: Record<string, { description: string; segmentIds: string[]; referenceImages: string[] }> = {};
      for (const seg of segments) {
        if (seg.type !== 'speaking') continue;
        const charKey = seg.character?.twinId || seg.id; // Use twinId (characterId from strategy) or segment id as fallback
        if (!characterGroups[charKey]) {
          // Extract the base physical description (before "In this scene:" if present)
          const fullDesc = seg.character?.description || 'A professional person';
          const baseDesc = fullDesc.includes('In this scene:') ? fullDesc.split('In this scene:')[0].trim() : fullDesc;
          characterGroups[charKey] = { description: baseDesc, segmentIds: [seg.id], referenceImages: [] };
        } else {
          characterGroups[charKey].segmentIds.push(seg.id);
        }
      }

      // Pre-generate character images for each unique actor
      toast.info(`Generating ${Object.keys(characterGroups).length} unique actor(s)...`);
      for (const [charKey, group] of Object.entries(characterGroups)) {
        if (creditError) break;
        
        // Check if any segment in this group already has reference images
        const existingImages = segments.find(
          s => group.segmentIds.includes(s.id) && s.character?.referenceImages && s.character.referenceImages.length > 0
        )?.character?.referenceImages;

        if (existingImages && existingImages.length > 0) {
          group.referenceImages = existingImages;
          toast.info(`Reusing existing images for actor "${group.description.slice(0, 40)}..."`);
        } else {
          // Generate 6-angle reference images for this actor
          toast.info(`Generating character: "${group.description.slice(0, 50)}..."`);
          try {
            const { data: firstImg, error: firstErr } = await supabase.functions.invoke('generate-scene-image', {
              body: {
                prompt: ANGLE_PROMPTS[0](group.description),
                aspectRatio: '1:1'
              }
            });
            if (firstErr || !firstImg?.imageUrl) {
              console.error('Failed to generate initial portrait for actor');
              continue;
            }
            group.referenceImages = [firstImg.imageUrl];

            // Generate remaining angles using first image as reference
            const remaining = await Promise.allSettled(
              ANGLE_PROMPTS.slice(1, 4).map(promptFn =>
                supabase.functions.invoke('generate-scene-image', {
                  body: {
                    prompt: promptFn(group.description),
                    aspectRatio: '1:1',
                    referenceImageUrl: firstImg.imageUrl
                  }
                })
              )
            );
            for (const result of remaining) {
              if (result.status === 'fulfilled' && result.value.data?.imageUrl) {
                group.referenceImages.push(result.value.data.imageUrl);
              }
            }
            toast.success(`Actor generated with ${group.referenceImages.length} reference angles`);
          } catch (err) {
            console.error('Character generation error:', err);
          }
        }

        // Apply reference images to ALL segments sharing this actor
        for (const segId of group.segmentIds) {
          const seg = segments.find(s => s.id === segId);
          if (seg && group.referenceImages.length > 0) {
            updateSegment(segId, {
              character: {
                ...(seg.character || { name: '', description: '', referenceImages: [] }),
                referenceImages: group.referenceImages,
              },
              status: 'character-ready',
            });
          }
        }

        step++;
        setGenerationProgress((step / totalSteps) * 30); // First 30% is character gen
      }

      // === SCENE-BY-SCENE GENERATION ===
      for (let i = 0; i < segments.length; i++) {
        if (creditError) break;
        
        const segment = segments[i];
        updateSegment(segment.id, { status: 'generating' });

        try {
          if (segment.type === 'speaking') {
            // Get reference image from pre-generated character group
            const charKey = segment.character?.twinId || segment.id;
            const group = characterGroups[charKey];
            let referenceImage = group?.referenceImages?.[0] || segment.character?.referenceImages?.[0];
            
            if (!referenceImage) {
              const charDesc = segment.character?.description || 'A professional person';
              toast.info(`Scene ${i + 1}: Generating fallback character image...`);
              const { data: imgData } = await supabase.functions.invoke('generate-scene-image', {
                body: {
                  prompt: `Photorealistic portrait of ${charDesc}. Shot on RED V-RAPTOR, 85mm f/1.4 lens, cinematic studio lighting with soft key light at 45 degrees, subtle rim light, neutral background with shallow depth of field. No text, no watermark.`,
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
            setGenerationProgress(30 + (step / totalSteps) * 70);

            // Generate TTS audio
            toast.info(`Scene ${i + 1}: Generating voiceover...`);
            const gender = segment.character?.gender || 
              (segment.character?.description?.toLowerCase().includes('female') || 
               segment.character?.description?.toLowerCase().includes('woman') ? 'female' : 'male');
            
            const { data: ttsData, error: ttsError } = await supabase.functions.invoke('text-to-speech', {
              body: {
                text: sanitizeForTTS(segment.script || ''),
                voice: 'ai-auto',
                gender,
              }
            });

            let audioUrl = ttsData?.audioUrl;
            
            // Upload data: URLs to storage for video API compatibility
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

            // Generate video with ENHANCED cinematic prompt
            if (referenceImage) {
              toast.info(`Scene ${i + 1}: Generating video...`);
              
              // Extract scene-specific action from description
              const fullDesc = segment.character?.description || 'A person';
              const sceneAction = fullDesc.includes('In this scene:') 
                ? fullDesc.split('In this scene:')[1].trim()
                : fullDesc;
              
              // Build a rich cinematic prompt
              const narrativeRole = segment.script?.length && segment.script.length < 50 ? 'delivering a punchy one-liner' : 'speaking passionately and naturally';
              const cinematicPrompt = `${sceneAction}. ${narrativeRole}. Professional cinematic lighting, natural subtle head movements and gestures, photorealistic skin detail, ${aspectRatio === '9:16' ? 'vertical 9:16 format, tight medium shot framing' : 'horizontal 16:9 widescreen, cinematic composition'}. Shot on RED V-RAPTOR, shallow depth of field, broadcast television quality. No text overlays, no watermarks, no captions.`;

              const videoBody: any = {
                action: 'create',
                model: styleConfig.speakingModel,
                prompt: cinematicPrompt,
                imageUrls: [referenceImage],
                // InfiniteTalk auto-derives duration from audio — don't cap speaking segments
                aspectRatio,
              };
              
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
                updateSegment(segment.id, { audioUrl, status: 'error' });
                step++;
                setGenerationProgress(30 + (step / totalSteps) * 70);
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
            // B-roll: generate image then video with ENHANCED cinematic prompts
            const rawPrompt = segment.brollPrompts?.[0] || 'Professional B-roll footage';
            // Enhance B-roll prompt with cinematic quality descriptors
            const enhancedBrollPrompt = `${rawPrompt}. Ultra-cinematic 4K, shot on ARRI Alexa Mini with Signature Prime lenses, shallow depth of field at f/2.0, professional color grading with rich contrast, volumetric lighting, broadcast television quality. No text, no watermarks, no captions, no logos.`;

            // Use existing b-roll image if already generated
            let brollImage = segment.brollImages?.[0];
            
            if (!brollImage) {
              toast.info(`B-Roll ${i + 1}: Generating cinematic image...`);
              const { data: imgData } = await supabase.functions.invoke('generate-scene-image', {
                body: { prompt: enhancedBrollPrompt, aspectRatio: aspectRatio === '9:16' ? '9:16' : '16:9' }
              });
              if (imgData?.imageUrl) brollImage = imgData.imageUrl;
            }

            step++;
            setGenerationProgress(30 + (step / totalSteps) * 70);

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

              toast.info(`B-Roll ${i + 1}: Generating cinematic video...`);
              // Enhanced video prompt for B-roll
              const brollVideoPrompt = `${rawPrompt}. Cinematic slow-motion footage, smooth camera movement, ${aspectRatio === '9:16' ? 'vertical 9:16 format' : 'horizontal 16:9 widescreen'}, professional lighting with volumetric rays, broadcast quality, shot at 60fps for buttery smooth motion. No text, no watermarks.`;
              try {
                const { data: vidData } = await supabase.functions.invoke('wavespeed-video', {
                  body: {
                    action: 'create',
                    model: styleConfig.brollModel,
                    prompt: brollVideoPrompt,
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
