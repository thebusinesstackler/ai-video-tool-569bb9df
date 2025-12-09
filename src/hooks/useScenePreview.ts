import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { getAudioDuration } from '@/lib/audioUtils';
import { useToast } from '@/hooks/use-toast';

export interface PreviewScene {
  sceneNumber: number;
  narration: string;
  visualDescription: string;
  imageUrl: string | null;
  audioUrl: string | null;
  audioDuration: number;
  isGenerating: boolean;
  isRegenerating?: boolean;
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
  generatePreview: (scenes: Scene[], userId?: string) => Promise<void>;
  regenerateSceneImage: (sceneNumber: number, visualDescription: string) => Promise<void>;
  resetPreview: () => void;
}

export function useScenePreview(): UseScenePreviewResult {
  const { toast } = useToast();
  const [previewScenes, setPreviewScenes] = useState<PreviewScene[]>([]);
  const [voiceovers, setVoiceovers] = useState<{ sceneNumber: number; audioUrl: string; storageUrl?: string; duration: number }[]>([]);
  const [isGeneratingPreview, setIsGeneratingPreview] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressStatus, setProgressStatus] = useState('');

  const generatePreview = async (scenes: Scene[], userId?: string) => {
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
      // Step 1: Generate voiceovers
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
            body: { text: scene.narration, voice: 'alloy' }
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

          if (ttsData?.audioContent) {
            const audioUrl = `data:audio/mp3;base64,${ttsData.audioContent}`;
            const actualDuration = await getAudioDuration(audioUrl);

            let storageUrl: string | undefined;
            if (userId) {
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
                }
              } catch (uploadErr) {
                console.warn('Voiceover upload failed:', uploadErr);
              }
            }

            newVoiceovers.push({
              sceneNumber: scene.sceneNumber,
              audioUrl,
              storageUrl,
              duration: actualDuration
            });

            // Update preview scene with audio
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

      setVoiceovers(newVoiceovers);
      setProgress(30);
      setProgressStatus('Generating scene images...');

      // Step 2: Generate images for each scene
      for (let i = 0; i < scenes.length; i++) {
        const scene = scenes[i];
        
        try {
          const { data: imageData, error: imageError } = await supabase.functions.invoke('generate-scene-image', {
            body: { 
              prompt: `${scene.visualDescription}. Ultra high resolution, cinematic, vertical 9:16 aspect ratio, photorealistic, detailed lighting.` 
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

  const resetPreview = () => {
    setPreviewScenes([]);
    setVoiceovers([]);
    setProgress(0);
    setProgressStatus('');
  };

  return {
    previewScenes,
    voiceovers,
    isGeneratingPreview,
    progress,
    progressStatus,
    generatePreview,
    regenerateSceneImage,
    resetPreview
  };
}
