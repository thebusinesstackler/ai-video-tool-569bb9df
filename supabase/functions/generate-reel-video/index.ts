import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Scene {
  sceneNumber: number;
  narration: string;
  visualDescription: string;
  duration: number;
  audioDuration?: number;
  isIntro?: boolean;
  isOutro?: boolean;
  isSilentCTA?: boolean;
  templateId?: string;
}

interface VoiceoverData {
  sceneNumber: number;
  audioUrl: string;
  duration: number;
}

// Lip sync models require audio input - they do NOT generate voice from text
// We use WaveSpeed MiniMax Speech-02 for TTS, then pass the audio URL to lip sync

// Helper to convert base64 to Uint8Array
function base64ToUint8Array(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

// Calculate TTS speed to match target duration
// With longer narrations (25-30 words), we need slower speech (0.5-0.8x) to fill 8 seconds
// Normal speech is ~150 words/minute = 2.5 words/second
// WaveSpeed speed range: 0.5 (slowest) to 2.0 (fastest)
function calculateTTSSpeed(text: string, targetDurationSeconds: number): number {
  const words = text.split(/\s+/).filter(w => w.length > 0).length;
  const normalWordsPerSecond = 2.5;
  const normalDuration = words / normalWordsPerSecond;
  
  // Calculate what speed would stretch/compress to target
  // speed < 1 = slower (takes more time), speed > 1 = faster
  const requiredSpeed = normalDuration / targetDurationSeconds;
  
  // Clamp to 0.5-1.0 range for natural, slower speech that fills the scene
  // We prefer slower speech (0.5-0.8) to ensure narration fills the full duration
  const clampedSpeed = Math.max(0.5, Math.min(1.0, requiredSpeed));
  
  console.log(`TTS speed calc: ${words} words, normal=${normalDuration.toFixed(1)}s, target=${targetDurationSeconds}s, speed=${clampedSpeed.toFixed(2)}`);
  
  return clampedSpeed;
}

// Generate voiceover using WaveSpeed MiniMax Speech-02-HD
async function generateWaveSpeedTTS(
  text: string, 
  apiKey: string,
  emotion: string = 'neutral',
  targetDuration: number = 8
): Promise<{ audioUrl: string; taskId: string } | null> {
  try {
    console.log('Generating TTS with WaveSpeed MiniMax Speech-02-HD...');
    
    // Use English voice from MiniMax
    const voiceId = 'English_Trustworth_Man';
    
    // Calculate speed to match target duration
    const speed = calculateTTSSpeed(text, targetDuration);
    
    // Use WaveSpeed MiniMax Speech-02-HD endpoint
    const response = await fetch('https://api.wavespeed.ai/api/v3/minimax/speech-02-hd', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: text,
        voice_id: voiceId,
        speed: speed,
        volume: 1,
        pitch: 0,
        emotion: emotion,
        english_normalization: true
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('WaveSpeed TTS error:', response.status, errorText);
      return null;
    }

    const data = await response.json();
    console.log('WaveSpeed TTS response:', data);
    
    if (data.code === 200 && data.data?.id) {
      return { audioUrl: '', taskId: data.data.id };
    }
    
    return null;
  } catch (error) {
    console.error('WaveSpeed TTS error:', error);
    return null;
  }
}

// Poll for WaveSpeed TTS result
async function pollWaveSpeedTTSResult(taskId: string, apiKey: string, maxAttempts: number = 30): Promise<string | null> {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const response = await fetch(`https://api.wavespeed.ai/api/v3/predictions/${taskId}/result`, {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
        },
      });

      if (!response.ok) {
        console.error('TTS poll error:', response.status);
        await new Promise(resolve => setTimeout(resolve, 1000));
        continue;
      }

      const data = await response.json();
      console.log('TTS poll result:', data.data?.status);
      
      if (data.code === 200 && data.data) {
        if (data.data.status === 'completed' || data.data.status === 'succeeded') {
          // Audio URL is in outputs array
          const audioUrl = data.data.outputs?.[0];
          if (audioUrl) {
            console.log('TTS completed, audio URL:', audioUrl);
            return audioUrl;
          }
        } else if (data.data.status === 'failed') {
          console.error('TTS task failed');
          return null;
        }
      }
      
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (error) {
      console.error('TTS poll error:', error);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  console.error('TTS polling timed out');
  return null;
}

// Generate special prompt for intro/outro templates - NO TEXT in images to avoid spelling errors
function getTemplateImagePrompt(scene: Scene, topic: string, enableLipSync: boolean): string {
  // For lip sync mode, generate front-facing portrait suitable for talking head
  if (enableLipSync && !scene.isIntro && !scene.isOutro) {
    return `Generate a front-facing portrait photo suitable for a talking head video.
      Scene context: ${scene.visualDescription}
      Topic: ${topic}
      Style: Portrait orientation, clear face, well-lit, professional look, direct eye contact with camera.
      The subject should be centered in frame, neutral or engaging expression.
      High quality, photorealistic, suitable for lip sync animation.`;
  }

  if (scene.isIntro) {
    const basePrompt = scene.visualDescription || 'Modern social media intro background';
    // Don't include text in image - we'll overlay it with HTML
    return `${basePrompt}. Topic: ${topic}. Style: Clean background design, vibrant colors, vertical 9:16 format, eye-catching social media intro screen. Abstract or thematic background without any text or words. Suitable for text overlay.`;
  }
  
  if (scene.isOutro) {
    const basePrompt = scene.visualDescription || 'Social media call-to-action background';
    // Don't include text in image - we'll overlay it with HTML
    return `${basePrompt}. Style: Engaging background design, vertical 9:16 format, social media outro screen. Abstract or thematic background without any text or words. Suitable for text overlay.`;
  }
  
  return `Generate a vibrant, eye-catching image for a social media reel. 
    Scene: ${scene.visualDescription}
    Topic: ${topic}
    Style: Modern, engaging, vertical format (9:16 aspect ratio), suitable for Instagram/TikTok.
    The image should be visually striking and attention-grabbing. Do not include any text in the image.`;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { 
      scenes, 
      topic, 
      addCaptions = true, 
      useWaveSpeed = true,
      enableLipSync = false,
      lipSyncModel = 'infinitetalk',
      portraitImage = null,
      voiceovers = [],
      voice = 'nova', // Voice for TTS
      preGeneratedImages = [], // Pre-generated images from preview
      enableVeo3Mode = false, // VEO3 mode - generates video with built-in voice
      veo3Model = 'veo3-fast' // VEO3 model variant
    } = await req.json();

    if (!scenes || !Array.isArray(scenes) || scenes.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Scenes are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Generating reel video for topic:', topic);
    console.log('Scenes:', scenes.length);
    console.log('Add captions:', addCaptions);
    console.log('Use WaveSpeed:', useWaveSpeed);
    console.log('VEO3 Mode:', enableVeo3Mode, 'Model:', veo3Model);
    console.log('Enable Lip Sync:', enableLipSync);
    console.log('Lip Sync Model:', lipSyncModel);
    console.log('Portrait Image provided:', !!portraitImage);
    console.log('Voice:', voice);
    console.log('Voiceovers provided:', voiceovers?.length || 0);
    console.log('Pre-generated images:', preGeneratedImages?.length || 0);

    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');

    const WAVESPEED_API_KEY = Deno.env.get('WAVESPEED_API_KEY');
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    // Create Supabase client for storage uploads
    const supabase = SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY 
      ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
      : null;

    // Generate images for each scene using AI
    const sceneImages: string[] = [];
    const savedImageUrls: string[] = [];
    
    // If lip sync is enabled and portrait is provided, use it for all scenes (except intro/outro)
    const useConsistentPortrait = enableLipSync && portraitImage;
    
    for (const scene of scenes as Scene[]) {
      console.log('Processing image for scene:', scene.sceneNumber, 'isIntro:', scene.isIntro, 'isOutro:', scene.isOutro);
      
      // Check if we have a pre-generated image for this scene
      const preGenImage = preGeneratedImages?.find((pg: any) => pg.sceneNumber === scene.sceneNumber);
      if (preGenImage?.imageUrl) {
        console.log('Using pre-generated image for scene', scene.sceneNumber);
        sceneImages.push(preGenImage.imageUrl);
        savedImageUrls.push(preGenImage.imageUrl);
        continue;
      }
      
      // For lip sync with consistent portrait, use the uploaded portrait for content scenes
      if (useConsistentPortrait && !scene.isIntro && !scene.isOutro) {
        console.log('Using provided portrait image for scene', scene.sceneNumber);
        sceneImages.push(portraitImage);
        savedImageUrls.push(portraitImage);
        continue;
      }
      
      try {
        const imagePrompt = getTemplateImagePrompt(scene, topic, enableLipSync);
        
        const imageResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${LOVABLE_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'google/gemini-2.5-flash-image-preview',
            messages: [
              {
                role: 'user',
                content: imagePrompt
              }
            ],
            modalities: ['image', 'text']
          }),
        });

        if (imageResponse.ok) {
          const imageData = await imageResponse.json();
          const imageUrl = imageData.choices?.[0]?.message?.images?.[0]?.image_url?.url;
          if (imageUrl) {
            sceneImages.push(imageUrl);
            
            // Upload to storage if Supabase is configured
            if (supabase && imageUrl.startsWith('data:')) {
              try {
                const base64Data = imageUrl.split(',')[1];
                const imageBytes = base64ToUint8Array(base64Data);
                const sceneType = scene.isIntro ? 'intro' : scene.isOutro ? 'outro' : 'scene';
                const fileName = `images/${Date.now()}-${sceneType}-${scene.sceneNumber}.png`;
                
                const { data: uploadData, error: uploadError } = await supabase.storage
                  .from('reels')
                  .upload(fileName, imageBytes, { 
                    contentType: 'image/png',
                    upsert: true 
                  });
                
                if (!uploadError && uploadData) {
                  const { data: publicUrl } = supabase.storage.from('reels').getPublicUrl(fileName);
                  savedImageUrls.push(publicUrl.publicUrl);
                  console.log('Saved image to storage:', fileName);
                } else {
                  console.error('Upload error:', uploadError);
                  savedImageUrls.push(imageUrl); // Fallback to base64
                }
              } catch (uploadErr) {
                console.error('Storage upload failed:', uploadErr);
                savedImageUrls.push(imageUrl); // Fallback to base64
              }
            } else {
              savedImageUrls.push(imageUrl);
            }
          }
        }
      } catch (imgError) {
        console.error('Image generation error for scene:', scene.sceneNumber, imgError);
      }
    }

    // Use saved URLs (permanent) or fall back to base64
    const finalImageUrls = savedImageUrls.length > 0 ? savedImageUrls : sceneImages;

    // Build caption data for each scene
    const captionsData = (scenes as Scene[]).map((scene, index) => ({
      sceneNumber: scene.sceneNumber,
      text: scene.narration,
      startTime: (scenes as Scene[]).slice(0, index).reduce((acc, s) => acc + s.duration, 0),
      endTime: (scenes as Scene[]).slice(0, index + 1).reduce((acc, s) => acc + s.duration, 0),
      imageUrl: finalImageUrls[index] || null,
      isIntro: scene.isIntro || false,
      isOutro: scene.isOutro || false
    }));

    const totalDuration = (scenes as Scene[]).reduce((acc, s) => acc + s.duration, 0);

    // If WaveSpeed is enabled and API key exists, start video generation tasks
    // Track which model was used for each scene to determine if audio overlay is needed
    const videoTasks: { sceneNumber: number; taskId: string; model: string; hasEmbeddedAudio: boolean }[] = [];
    
    if (useWaveSpeed && WAVESPEED_API_KEY && finalImageUrls.length > 0) {
      console.log('Starting WaveSpeed video generation for', finalImageUrls.length, 'scenes');
      console.log('VEO3 mode:', enableVeo3Mode ? `Yes (${veo3Model})` : 'No');
      console.log('Lip sync mode:', enableLipSync ? `Yes (${lipSyncModel})` : 'No');
      
      for (let i = 0; i < finalImageUrls.length; i++) {
        const scene = (scenes as Scene[])[i];
        const imageUrl = finalImageUrls[i];
        
        // Skip silent CTA scenes entirely - they don't need video generation
        if (scene.isSilentCTA) {
          console.log(`Skipping video generation for silent CTA scene ${scene.sceneNumber}`);
          continue;
        }
        
        // Get voiceover audio URL for this scene (if pre-generated)
        const sceneVoiceover = (voiceovers as VoiceoverData[])?.find(v => v.sceneNumber === scene.sceneNumber);
        const audioUrl = sceneVoiceover?.audioUrl;
        
        // Determine API endpoint and body based on mode
        let apiEndpoint: string;
        let requestBody: any;
        
        // Use actual audio duration if provided, otherwise fall back to scene duration
        const targetDuration = scene.audioDuration || scene.duration;
        // Round to nearest valid integer (3-10), clamp to range
        const clipDuration = Math.max(3, Math.min(10, Math.round(targetDuration)));
        
        console.log(`Scene ${scene.sceneNumber}: target duration ${targetDuration}s, clip duration ${clipDuration}s`);
        
        // VEO3 MODE: Generate video with built-in voice from prompt (no separate TTS needed)
        // Uses WaveSpeed text-to-video which generates video from text description
        if (enableVeo3Mode && !scene.isIntro && !scene.isOutro && scene.narration) {
          console.log(`Using VEO3/Text-to-Video mode for scene ${scene.sceneNumber} - generating video from prompt`);
          
          // Use WaveSpeed text-to-video model (WAN 2.5 is reliable and generates good quality)
          apiEndpoint = 'https://api.wavespeed.ai/api/v3/alibaba/wan-2.5/text-to-video';
          
          // Build prompt that includes what the character should SAY
          // The model will generate a video depicting the scene with dialogue
          const voicePrompt = `${scene.visualDescription}. A person speaking the words: "${scene.narration}" with clear speech, natural expression, and engaging delivery. Cinematic quality, vertical 9:16 aspect ratio for social media.`;
          
          requestBody = {
            prompt: voicePrompt,
            duration: clipDuration,
            seed: Math.floor(Math.random() * 2147483647),
            resolution: "480p"
          };
        }
        // LIP SYNC MODE: For lip sync scenes (not intro/outro), use the lip sync model
        else if (enableLipSync && !scene.isIntro && !scene.isOutro && scene.narration) {
          // Use lip sync model with native voice or provided audio
          console.log(`Using lip sync model ${lipSyncModel} for scene ${scene.sceneNumber}`);
          
          if (lipSyncModel === 'infinitetalk') {
            apiEndpoint = 'https://api.wavespeed.ai/api/v3/wavespeed-ai/infinitetalk';
          } else if (lipSyncModel === 'avatar-omni-human-1.5') {
            apiEndpoint = 'https://api.wavespeed.ai/api/v3/bytedance/avatar-omni-human-1.5';
          } else if (lipSyncModel === 'wan-animate') {
            apiEndpoint = 'https://api.wavespeed.ai/api/v3/alibaba/wan-animate';
          } else {
            apiEndpoint = 'https://api.wavespeed.ai/api/v3/wavespeed-ai/infinitetalk';
          }
          
          // Lip sync models require audio input - use provided audio or generate voiceover
          let sceneAudioUrl = audioUrl;
          
          // Check if we have valid pre-generated audio (storage URL or base64)
          const hasValidAudio = sceneAudioUrl && 
            (sceneAudioUrl.startsWith('http') || sceneAudioUrl.startsWith('data:'));
          
          console.log(`Scene ${scene.sceneNumber}: Pre-generated audio check:`, {
            audioUrl: sceneAudioUrl ? sceneAudioUrl.substring(0, 50) + '...' : 'none',
            hasValidAudio
          });
          
          // ONLY generate WaveSpeed TTS if no pre-generated audio was provided
          // This prevents double-voice issue when frontend has already generated Google Cloud TTS
          if (!hasValidAudio && scene.narration && WAVESPEED_API_KEY) {
            console.log(`Scene ${scene.sceneNumber}: Generating voiceover via WaveSpeed MiniMax TTS`);
            
            try {
              // Start TTS generation with target duration from scene
              const targetDuration = scene.duration || 8;
              const ttsResult = await generateWaveSpeedTTS(scene.narration, WAVESPEED_API_KEY, 'neutral', targetDuration);
              
              if (ttsResult?.taskId) {
                // Poll for result
                const generatedAudioUrl = await pollWaveSpeedTTSResult(ttsResult.taskId, WAVESPEED_API_KEY);
                
                if (generatedAudioUrl) {
                  sceneAudioUrl = generatedAudioUrl;
                  console.log(`Scene ${scene.sceneNumber}: WaveSpeed TTS completed:`, sceneAudioUrl);
                }
              }
            } catch (ttsError) {
              console.error(`Scene ${scene.sceneNumber}: WaveSpeed TTS error:`, ttsError);
            }
          }
          
          // Now build request with audio
          if (sceneAudioUrl) {
            requestBody = {
              image: imageUrl,
              audio: sceneAudioUrl,
              duration: clipDuration
            };
            console.log(`Scene ${scene.sceneNumber}: Using audio for lip sync`);
          } else {
            // No audio available - fall back to regular video
            console.log(`Scene ${scene.sceneNumber}: No audio available, falling back to image-to-video`);
            apiEndpoint = 'https://api.wavespeed.ai/api/v3/alibaba/wan-2.5/image-to-video';
            requestBody = {
              image: imageUrl,
              prompt: `${scene.visualDescription}. Person speaking, engaging expression.`,
              resolution: "480p",
              duration: clipDuration
            };
          }
          
          // Add prompt for wan-animate
          if (lipSyncModel === 'wan-animate') {
            requestBody.prompt = `${scene.visualDescription}. Speaking naturally, engaging expression.`;
          }
        } else {
          // Use regular image-to-video model for intro/outro
          apiEndpoint = 'https://api.wavespeed.ai/api/v3/alibaba/wan-2.5/image-to-video';
          
          let motionPrompt = `${scene.visualDescription}. Dynamic motion, cinematic, engaging social media style.`;
          if (scene.isIntro) {
            motionPrompt = 'Subtle zoom in animation, text reveal effect, attention-grabbing intro motion.';
          } else if (scene.isOutro) {
            motionPrompt = 'Gentle zoom out or pulse effect, engaging call-to-action animation.';
          }
          
          requestBody = {
            image: imageUrl,
            prompt: motionPrompt,
            resolution: "480p",
            duration: clipDuration
          };
        }
        
        try {
          console.log(`Calling WaveSpeed API for scene ${scene.sceneNumber}:`, apiEndpoint);
          
          const videoResponse = await fetch(apiEndpoint, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${WAVESPEED_API_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestBody),
          });

          if (videoResponse.ok) {
            const videoData = await videoResponse.json();
            console.log('WaveSpeed task created for scene', scene.sceneNumber, ':', videoData);
            
            if (videoData.code === 200 && videoData.data?.id) {
              // Determine if this model has embedded audio
              // VEO3 text-to-video and lip sync models (infinitetalk, wan-lipsync, avatar-omni) have embedded audio
              // Regular image-to-video does NOT have embedded audio
              const isVeo3 = enableVeo3Mode && !scene.isIntro && !scene.isOutro;
              const isActualLipSync = enableLipSync && !scene.isIntro && !scene.isOutro && 
                (apiEndpoint.includes('infinitetalk') || apiEndpoint.includes('avatar-omni') || 
                 (apiEndpoint.includes('wan-animate') && requestBody.audio));
              const hasEmbeddedAudio = isVeo3 || isActualLipSync;
              
              console.log(`Scene ${scene.sceneNumber}: Model=${apiEndpoint.split('/').pop()}, hasEmbeddedAudio=${hasEmbeddedAudio}`);
              
              videoTasks.push({
                sceneNumber: scene.sceneNumber,
                taskId: videoData.data.id,
                model: apiEndpoint,
                hasEmbeddedAudio
              });
            }
          } else {
            const errorText = await videoResponse.text();
            console.error('WaveSpeed error for scene', scene.sceneNumber, ':', errorText);
            
            // Fallback to regular image-to-video if VEO3 or lip sync fails
            const usingSpecialMode = enableVeo3Mode || enableLipSync;
            if (usingSpecialMode) {
              console.log('Falling back to regular image-to-video for scene', scene.sceneNumber);
              
              const fallbackResponse = await fetch('https://api.wavespeed.ai/api/v3/alibaba/wan-2.5/image-to-video', {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${WAVESPEED_API_KEY}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  image: imageUrl,
                  prompt: `${scene.visualDescription}. Dynamic motion, cinematic, engaging.`,
                  resolution: "480p",
                  duration: clipDuration
                }),
              });
              
              if (fallbackResponse.ok) {
                const fallbackData = await fallbackResponse.json();
                if (fallbackData.code === 200 && fallbackData.data?.id) {
                  // Fallback is always image-to-video which has NO embedded audio
                  console.log(`Scene ${scene.sceneNumber}: Fallback to image-to-video (NO embedded audio)`);
                  videoTasks.push({
                    sceneNumber: scene.sceneNumber,
                    taskId: fallbackData.data.id,
                    model: 'alibaba/wan-2.5/image-to-video',
                    hasEmbeddedAudio: false
                  });
                }
              }
            }
          }
        } catch (videoError) {
          console.error('Video generation error for scene:', scene.sceneNumber, videoError);
        }
      }
    }

    // Check if any scene has embedded audio (true lip sync or VEO3)
    const hasAnyEmbeddedAudio = videoTasks.some(t => t.hasEmbeddedAudio);
    
    const result = {
      videoUrl: null,
      scenes: captionsData,
      sceneImages: finalImageUrls,
      videoTasks, // Include task IDs with model info for polling
      captions: addCaptions ? captionsData.map(c => ({
        text: c.text,
        start: c.startTime,
        end: c.endTime
      })) : [],
      totalDuration,
      useWaveSpeed: videoTasks.length > 0,
      lipSyncEnabled: enableLipSync,
      hasEmbeddedAudio: hasAnyEmbeddedAudio // True only if actual lip sync/VEO3 was used
    };

    console.log('Reel generation complete with', videoTasks.length, 'video tasks');
    console.log('Models used:', videoTasks.map(t => ({ scene: t.sceneNumber, model: t.model.split('/').pop(), embedded: t.hasEmbeddedAudio })));

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error generating reel video:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Failed to generate video' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});