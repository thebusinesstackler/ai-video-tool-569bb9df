import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { getAudioDuration } from '@/lib/audioUtils';
import { useToast } from '@/hooks/use-toast';

// Helper function to upload base64 image to storage and return public URL
const uploadImageToStorage = async (
  base64Url: string,
  userId: string,
  sceneNumber: number
): Promise<string> => {
  try {
    // Check if it's a base64 URL
    if (!base64Url.startsWith('data:')) {
      return base64Url; // Already a URL
    }

    // Extract base64 data and mime type
    const matches = base64Url.match(/^data:([^;]+);base64,(.+)$/);
    if (!matches) return base64Url;

    const mimeType = matches[1];
    const base64Data = matches[2];
    const extension = mimeType.split('/')[1] || 'png';

    // Convert to blob
    const binaryString = atob(base64Data);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    const fileName = `${userId}/scene-images/${Date.now()}-scene-${sceneNumber}.${extension}`;
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('reels')
      .upload(fileName, bytes, { contentType: mimeType });

    if (uploadError) {
      console.warn('Image upload failed, using base64:', uploadError);
      return base64Url;
    }

    const { data: publicUrl } = supabase.storage.from('reels').getPublicUrl(fileName);
    return publicUrl.publicUrl;
  } catch (error) {
    console.warn('Failed to upload image to storage:', error);
    return base64Url;
  }
};

// Helper function to save image to gallery
const saveImageToGallery = async (
  imageUrl: string,
  prompt: string,
  sceneNumber: number,
  userId: string,
  referenceImageUrl?: string,
  transformation?: string
) => {
  try {
    // Upload to storage first if it's base64
    const storageUrl = await uploadImageToStorage(imageUrl, userId, sceneNumber);

    await supabase.from('generated_images').insert({
      user_id: userId,
      image_url: storageUrl, // Use storage URL instead of base64
      prompt,
      source: 'reel',
      reference_image_url: referenceImageUrl || null,
      transformation: transformation || null,
      scene_number: sceneNumber
    });
  } catch (error) {
    console.warn('Failed to save image to gallery:', error);
  }
};

export interface PreviewScene {
  sceneNumber: number;
  narration: string;
  visualDescription: string;
  imageUrl: string | null;
  audioUrl: string | null;
  audioDuration: number;
  isGenerating: boolean;
  isRegenerating?: boolean;
  isReference?: boolean;
}

interface Scene {
  sceneNumber: number;
  narration: string;
  visualDescription: string;
  duration: number;
}

interface UseScenePreviewResult {
  previewScenes: PreviewScene[];
  voiceovers: { sceneNumber: number; audioUrl: string; storageUrl?: string; duration: number }[];
  isGeneratingPreview: boolean;
  progress: number;
  progressStatus: string;
  referenceImageUrl: string | null;
  characterTransformation: string;
  setCharacterTransformation: (transformation: string) => void;
  generatePreview: (scenes: Scene[], userId?: string, referenceImageUrl?: string, voice?: string, characterRefImage?: string, characterDescription?: string, speechifyVoiceId?: string, allReferenceImages?: string[], customAudioUrl?: string, customAudioDuration?: number, voiceEngine?: string, googleVoiceId?: string, videoModel?: string) => Promise<void>;
  regenerateSceneImage: (sceneNumber: number, visualDescription: string) => Promise<void>;
  regenerateSceneVoice: (sceneNumber: number, narration: string, voice?: string, speechifyVoiceId?: string, voiceEngine?: string, googleVoiceId?: string, userId?: string) => Promise<void>;
  regenerateWithReference: (sceneNumber: number, visualDescription: string, referenceImageUrl: string, transformation?: string) => Promise<void>;
  setSceneAsReference: (sceneNumber: number) => void;
  setExternalReference: (imageUrl: string) => void;
  clearReference: () => void;
  resetPreview: () => void;
  restorePreviewScenes: (scenes: PreviewScene[], vos: { sceneNumber: number; audioUrl: string; storageUrl?: string; duration: number }[]) => void;
  insertScene: (insertIndex: number, type: 'broll' | 'intro' | 'outro', prompt: string) => Promise<void>;
  deleteScene: (sceneNumber: number) => void;
}

export function useScenePreview(): UseScenePreviewResult {
  const { toast } = useToast();
  const [previewScenes, setPreviewScenes] = useState<PreviewScene[]>([]);
  const [voiceovers, setVoiceovers] = useState<{ sceneNumber: number; audioUrl: string; storageUrl?: string; duration: number }[]>([]);
  const [isGeneratingPreview, setIsGeneratingPreview] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressStatus, setProgressStatus] = useState('');
  const [referenceImageUrl, setReferenceImageUrl] = useState<string | null>(null);
  const [characterTransformation, setCharacterTransformation] = useState<string>('');

  const generatePreview = async (
    scenes: Scene[], 
    userId?: string, 
    refImageUrl?: string, 
    voice: string = 'alloy',
    characterRefImage?: string,
    characterDescription?: string,
    speechifyVoiceId?: string,
    allReferenceImages?: string[],
    customAudioUrl?: string,
    customAudioDuration?: number,
    voiceEngine?: string,
    googleVoiceId?: string,
    videoModel?: string
  ) => {
    const activeReference = refImageUrl || referenceImageUrl || characterRefImage;
    // Use all reference images if provided, otherwise use just the active reference
    const referenceImagesArray = allReferenceImages?.length ? allReferenceImages : (activeReference ? [activeReference] : []);
    if (scenes.length === 0) return;

    setIsGeneratingPreview(true);
    setProgress(5);
    setProgressStatus('Initializing preview...');

    // Initialize preview scenes
    const initialScenes: PreviewScene[] = scenes.map(scene => ({
      sceneNumber: scene.sceneNumber,
      narration: scene.narration,
      visualDescription: scene.visualDescription,
      imageUrl: null,
      audioUrl: null,
      audioDuration: scene.duration,
      isGenerating: true
    }));
    setPreviewScenes(initialScenes);

    const newVoiceovers: typeof voiceovers = [];

    try {
      // Step 1: Generate voiceovers OR use custom audio OR skip for VEO3
      if (videoModel === 'veo3') {
        // VEO3 Fast generates audio natively — skip TTS entirely
        console.log('VEO3 selected — skipping TTS, audio will be generated with video');
        for (const scene of scenes) {
          newVoiceovers.push({
            sceneNumber: scene.sceneNumber,
            audioUrl: '',
            duration: scene.duration || 8
          });
        }
        setProgress(30);
      } else if (customAudioUrl && customAudioDuration) {
        // Use custom audio - assign same audio to all scenes (single audio for entire reel)
        setProgressStatus('Using custom audio...');
        const durationPerScene = customAudioDuration / scenes.length;
        
        for (let i = 0; i < scenes.length; i++) {
          const scene = scenes[i];
          newVoiceovers.push({
            sceneNumber: scene.sceneNumber,
            audioUrl: customAudioUrl,
            storageUrl: customAudioUrl,
            duration: durationPerScene
          });
          
          // Update preview scene with custom audio
          setPreviewScenes(prev => prev.map(ps =>
            ps.sceneNumber === scene.sceneNumber
              ? { ...ps, audioUrl: customAudioUrl, audioDuration: durationPerScene }
              : ps
          ));
        }
        
        setProgress(30);
      } else {
        // Generate TTS voiceovers
        setProgressStatus('Generating voiceovers...');
        
        for (let i = 0; i < scenes.length; i++) {
          const scene = scenes[i];
          
          if (!scene.narration?.trim()) {
            newVoiceovers.push({
              sceneNumber: scene.sceneNumber,
              audioUrl: '',
              duration: scene.duration || 2
            });
            continue;
          }

          try {
            const { data: ttsData, error: ttsError } = await supabase.functions.invoke('text-to-speech', {
              body: { 
                text: scene.narration, 
                voice: speechifyVoiceId ? undefined : voice,
                speechifyVoiceId: speechifyVoiceId || undefined,
                voiceEngine: voiceEngine || undefined,
                googleVoiceId: googleVoiceId || undefined
              }
            });

            if (ttsError) {
              console.error('TTS error for scene', scene.sceneNumber, ':', ttsError);
              newVoiceovers.push({
                sceneNumber: scene.sceneNumber,
                audioUrl: '',
                duration: scene.duration || 5
              });
              continue;
            }

            if (ttsData?.audioContent || ttsData?.audioUrl) {
              // Use audioUrl from response if available, otherwise construct from audioContent
              let audioUrl = ttsData.audioUrl || `data:audio/mp3;base64,${ttsData.audioContent}`;
              console.log(`Scene ${scene.sceneNumber} TTS received, audio length: ${ttsData.audioContent?.length || 'N/A'}`);

              let storageUrl: string | undefined;
              if (userId && ttsData.audioContent) {
                try {
                  const base64Data = ttsData.audioContent;
                  const binaryString = atob(base64Data);
                  const bytes = new Uint8Array(binaryString.length);
                  for (let j = 0; j < binaryString.length; j++) {
                    bytes[j] = binaryString.charCodeAt(j);
                  }

                  const fileName = `${userId}/voiceovers/${Date.now()}-scene-${scene.sceneNumber}.mp3`;
                  const { data: uploadData, error: uploadError } = await supabase.storage
                    .from('reels')
                    .upload(fileName, bytes, { contentType: 'audio/mp3' });

                  if (!uploadError && uploadData) {
                    const { data: publicUrl } = supabase.storage.from('reels').getPublicUrl(fileName);
                    storageUrl = publicUrl.publicUrl;
                    console.log(`Scene ${scene.sceneNumber} audio uploaded to storage:`, storageUrl);
                    // Use storage URL for playback (more reliable than base64)
                    audioUrl = storageUrl;
                  }
                } catch (uploadErr) {
                  console.warn('Voiceover upload failed:', uploadErr);
                }
              }

              // Get duration from the audio URL
              const actualDuration = await getAudioDuration(audioUrl);
              console.log(`Scene ${scene.sceneNumber} audio duration: ${actualDuration}s`);

              newVoiceovers.push({
                sceneNumber: scene.sceneNumber,
                audioUrl,
                storageUrl,
                duration: actualDuration
              });

              // Update preview scene with audio (prefer storage URL)
              setPreviewScenes(prev => prev.map(ps =>
                ps.sceneNumber === scene.sceneNumber
                  ? { ...ps, audioUrl, audioDuration: actualDuration }
                  : ps
              ));
            }
          } catch (ttsErr) {
            console.error('TTS generation failed for scene', scene.sceneNumber, ':', ttsErr);
            newVoiceovers.push({
              sceneNumber: scene.sceneNumber,
              audioUrl: '',
              duration: scene.duration || 5
            });
          }

          setProgress(5 + Math.round(((i + 1) / scenes.length) * 25));
        }
      }

      setVoiceovers(newVoiceovers);
      setProgress(30);
      setProgressStatus('Generating scene images...');

      // Step 2: Generate images for each scene
      for (let i = 0; i < scenes.length; i++) {
        const scene = scenes[i];
        
        try {
          // Use edit-scene-image if we have references, otherwise use generate-scene-image
          const hasReferences = referenceImagesArray.length > 0;
          const functionName = hasReferences ? 'edit-scene-image' : 'generate-scene-image';
          const { data: imageData, error: imageError } = await supabase.functions.invoke(functionName, {
            body: { 
              prompt: `${scene.visualDescription}. Ultra high resolution, cinematic, vertical 9:16 aspect ratio, photorealistic, detailed lighting.`,
              // Pass all reference images for better character consistency
              referenceImageUrl: referenceImagesArray[0] || undefined,
              referenceImages: referenceImagesArray.length > 1 ? referenceImagesArray : undefined,
              characterDescription: characterDescription || undefined
            }
          });

          if (imageError) {
            console.error('Image generation error for scene', scene.sceneNumber, ':', imageError);
            setPreviewScenes(prev => prev.map(ps =>
              ps.sceneNumber === scene.sceneNumber
                ? { ...ps, isGenerating: false }
                : ps
            ));
            continue;
          }

          if (imageData?.imageUrl) {
            setPreviewScenes(prev => prev.map(ps =>
              ps.sceneNumber === scene.sceneNumber
                ? { ...ps, imageUrl: imageData.imageUrl, isGenerating: false }
                : ps
            ));
            
            // Save to gallery
            if (userId) {
              await saveImageToGallery(
                imageData.imageUrl,
                scene.visualDescription,
                scene.sceneNumber,
                userId,
                activeReference || undefined
              );
            }
          } else {
            setPreviewScenes(prev => prev.map(ps =>
              ps.sceneNumber === scene.sceneNumber
                ? { ...ps, isGenerating: false }
                : ps
            ));
          }
        } catch (imgErr) {
          console.error('Image generation failed for scene', scene.sceneNumber, ':', imgErr);
          setPreviewScenes(prev => prev.map(ps =>
            ps.sceneNumber === scene.sceneNumber
              ? { ...ps, isGenerating: false }
              : ps
          ));
        }

        setProgress(30 + Math.round(((i + 1) / scenes.length) * 65));
        setProgressStatus(`Generated ${i + 1}/${scenes.length} scene images...`);
      }

      setProgress(100);
      setProgressStatus('Preview ready!');

      toast({
        title: "Preview Generated",
        description: "Review your scenes and click 'Create Final Video' when ready."
      });
    } catch (error: any) {
      console.error('Preview generation error:', error);
      toast({
        title: "Preview Failed",
        description: error.message || "Failed to generate preview.",
        variant: "destructive"
      });
    } finally {
      setIsGeneratingPreview(false);
    }
  };

  const regenerateSceneImage = async (sceneNumber: number, visualDescription: string) => {
    // Use reference if set
    if (referenceImageUrl) {
      return regenerateWithReference(sceneNumber, visualDescription, referenceImageUrl, characterTransformation);
    }

    setPreviewScenes(prev => prev.map(ps =>
      ps.sceneNumber === sceneNumber ? { ...ps, isRegenerating: true } : ps
    ));

    try {
      const { data: imageData, error: imageError } = await supabase.functions.invoke('generate-scene-image', {
        body: { 
          prompt: `${visualDescription}. Ultra high resolution, cinematic, vertical 9:16 aspect ratio, photorealistic, detailed lighting.` 
        }
      });

      if (imageError) throw imageError;

      if (imageData?.imageUrl) {
        setPreviewScenes(prev => prev.map(ps =>
          ps.sceneNumber === sceneNumber
            ? { ...ps, imageUrl: imageData.imageUrl, isRegenerating: false }
            : ps
        ));

        // Save to gallery - get user ID first
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          await saveImageToGallery(imageData.imageUrl, visualDescription, sceneNumber, user.id);
        }

        toast({
          title: "Image Regenerated",
          description: `Scene ${sceneNumber} image has been updated.`
        });
      }
    } catch (error: any) {
      console.error('Image regeneration error:', error);
      setPreviewScenes(prev => prev.map(ps =>
        ps.sceneNumber === sceneNumber ? { ...ps, isRegenerating: false } : ps
      ));
      toast({
        title: "Regeneration Failed",
        description: error.message || "Failed to regenerate image.",
        variant: "destructive"
      });
    }
  };

  const regenerateWithReference = async (sceneNumber: number, visualDescription: string, refImageUrl: string, transformation?: string) => {
    setPreviewScenes(prev => prev.map(ps =>
      ps.sceneNumber === sceneNumber ? { ...ps, isRegenerating: true } : ps
    ));

    try {
      const { data: imageData, error: imageError } = await supabase.functions.invoke('edit-scene-image', {
        body: { 
          prompt: `${visualDescription}. Ultra high resolution, cinematic, vertical 9:16 aspect ratio, photorealistic, detailed lighting.`,
          referenceImageUrl: refImageUrl,
          characterTransformation: transformation || undefined
        }
      });

      if (imageError) throw imageError;

      if (imageData?.imageUrl) {
        setPreviewScenes(prev => prev.map(ps =>
          ps.sceneNumber === sceneNumber
            ? { ...ps, imageUrl: imageData.imageUrl, isRegenerating: false }
            : ps
        ));

        // Save to gallery with reference and transformation info
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          await saveImageToGallery(
            imageData.imageUrl,
            visualDescription,
            sceneNumber,
            user.id,
            refImageUrl,
            transformation
          );
        }

        toast({
          title: "Image Regenerated with Reference",
          description: `Scene ${sceneNumber} image has been updated to match the reference.`
        });
      }
    } catch (error: any) {
      console.error('Image regeneration with reference error:', error);
      setPreviewScenes(prev => prev.map(ps =>
        ps.sceneNumber === sceneNumber ? { ...ps, isRegenerating: false } : ps
      ));
      toast({
        title: "Regeneration Failed",
        description: error.message || "Failed to regenerate image with reference.",
        variant: "destructive"
      });
    }
  };

  const setSceneAsReference = (sceneNumber: number) => {
    const scene = previewScenes.find(ps => ps.sceneNumber === sceneNumber);
    if (scene?.imageUrl) {
      setReferenceImageUrl(scene.imageUrl);
      // Mark this scene as reference
      setPreviewScenes(prev => prev.map(ps => ({
        ...ps,
        isReference: ps.sceneNumber === sceneNumber
      })));
      toast({
        title: "Reference Set",
        description: `Scene ${sceneNumber} is now the reference for character consistency.`
      });
    }
  };

  const setExternalReference = (imageUrl: string) => {
    setReferenceImageUrl(imageUrl);
    // Clear any scene references
    setPreviewScenes(prev => prev.map(ps => ({
      ...ps,
      isReference: false
    })));
    toast({
      title: "External Reference Set",
      description: "Captured frame is now the reference for character consistency."
    });
  };

  const clearReference = () => {
    setReferenceImageUrl(null);
    setPreviewScenes(prev => prev.map(ps => ({
      ...ps,
      isReference: false
    })));
    toast({
      title: "Reference Cleared",
      description: "No reference image is set."
    });
  };

  const resetPreview = () => {
    setPreviewScenes([]);
    setVoiceovers([]);
    setProgress(0);
    setProgressStatus('');
    setReferenceImageUrl(null);
    setCharacterTransformation('');
  };

  const insertScene = async (insertIndex: number, type: 'broll' | 'intro' | 'outro', prompt: string) => {
    const newScene: PreviewScene = {
      sceneNumber: 0,
      narration: type === 'broll' ? '' : prompt,
      visualDescription: prompt,
      imageUrl: null,
      audioUrl: null,
      audioDuration: type === 'intro' || type === 'outro' ? 3 : 2,
      isGenerating: true,
    };

    // Insert and renumber
    const updated = [...previewScenes];
    updated.splice(insertIndex, 0, newScene);
    updated.forEach((s, i) => { s.sceneNumber = i + 1; });
    setPreviewScenes(updated);

    // Also update voiceovers numbering
    setVoiceovers(prev => {
      const newVos = prev.map(v => ({ ...v }));
      // Shift voiceover scene numbers for scenes at or after insert index
      newVos.forEach(v => {
        if (v.sceneNumber > insertIndex) v.sceneNumber += 1;
      });
      return newVos;
    });

    // Generate the image
    try {
      const fullPrompt = type === 'broll'
        ? `Cinematic B-roll shot: ${prompt}. Professional videography, 9:16 vertical format, no text, no people unless specified, ultra high resolution.`
        : type === 'intro'
        ? `Bold cinematic title card: "${prompt}". Modern motion graphics style, 9:16 vertical, dramatic lighting, premium look.`
        : `Call-to-action slide: "${prompt}". Clean modern design, 9:16 vertical, professional branding, eye-catching.`;

      const { data, error } = await supabase.functions.invoke('generate-scene-image', {
        body: { prompt: fullPrompt, aspectRatio: '9:16' }
      });

      if (error || !data?.imageUrl) throw new Error('Image generation failed');

      setPreviewScenes(prev => prev.map(ps =>
        ps.sceneNumber === insertIndex + 1
          ? { ...ps, imageUrl: data.imageUrl, isGenerating: false }
          : ps
      ));

      toast({ title: `✨ ${type === 'broll' ? 'B-Roll' : type === 'intro' ? 'Intro' : 'Outro'} Added` });
    } catch (err: any) {
      setPreviewScenes(prev => prev.map(ps =>
        ps.sceneNumber === insertIndex + 1 ? { ...ps, isGenerating: false } : ps
      ));
      toast({ title: 'Generation Failed', description: err.message, variant: 'destructive' });
    }
  };

  const deleteScene = (sceneNumber: number) => {
    setPreviewScenes(prev => {
      const filtered = prev.filter(ps => ps.sceneNumber !== sceneNumber);
      filtered.forEach((s, i) => { s.sceneNumber = i + 1; });
      return filtered;
    });
    setVoiceovers(prev => {
      const filtered = prev.filter(v => v.sceneNumber !== sceneNumber);
      filtered.forEach((v, i) => { v.sceneNumber = i + 1; });
      return filtered;
    });
    toast({ title: 'Scene Removed' });
  };

  return {
    previewScenes,
    voiceovers,
    isGeneratingPreview,
    progress,
    progressStatus,
    referenceImageUrl,
    characterTransformation,
    setCharacterTransformation,
    generatePreview,
    regenerateSceneImage,
    regenerateWithReference,
    setSceneAsReference,
    setExternalReference,
    clearReference,
    resetPreview,
    insertScene,
    deleteScene,
  };
}
