import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
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

// Helper to convert base64 to Uint8Array with memory guard (#50)
function base64ToUint8Array(base64: string): Uint8Array {
  // Guard against extremely large base64 strings (>10MB decoded)
  if (base64.length > 13_333_333) { // ~10MB in base64
    console.warn(`Large base64 payload detected (${(base64.length / 1_333_333).toFixed(1)}MB). Proceeding with caution.`);
  }
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
  
  // Allow up to 2.0 so narration can be sped up when too long for the scene
  const clampedSpeed = Math.max(0.5, Math.min(2.0, requiredSpeed));
  
  console.log(`TTS speed calc: ${words} words, normal=${normalDuration.toFixed(1)}s, target=${targetDurationSeconds}s, speed=${clampedSpeed.toFixed(2)}`);
  
  return clampedSpeed;
}

// Generate voiceover using WaveSpeed MiniMax Speech-02-HD
async function generateWaveSpeedTTS(
  text: string, 
  apiKey: string,
  emotion: string = 'neutral',
  targetDuration: number = 8,
  selectedVoice: string = 'English_Trustworth_Man'
): Promise<{ audioUrl: string; taskId: string } | null> {
  try {
    console.log('Generating TTS with WaveSpeed MiniMax Speech-02-HD...');
    
    // Use the selected voice, default to English_Trustworth_Man
    const voiceId = selectedVoice || 'English_Trustworth_Man';
    
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
// Sanitize character description to remove prop/product references
function sanitizeCharacterDescription(desc: string): string {
  if (!desc) return desc;
  return desc
    .replace(/\b(holding|carrying|gripping|clutching|showcasing|displaying|presenting)\s+(a\s+)?(supplement\s+)?bottle[s]?/gi, '')
    .replace(/\b(holding|carrying|gripping|clutching|showcasing|displaying|presenting)\s+(a\s+)?(skincare|beauty|health|fitness|tech|any)?\s*product[s]?/gi, '')
    .replace(/\b(holding|carrying|gripping|clutching|showcasing|displaying|presenting)\s+(a\s+)?(a\s+)?gadget[s]?/gi, '')
    .replace(/\b(holding|carrying|gripping|clutching)\s+a\s+\w+/gi, (match) => {
      // Only strip if it's a generic prop, keep if topic-relevant
      const genericProps = /bottle|product|item|object|thing|prop|device|gadget/i;
      return genericProps.test(match) ? '' : match;
    })
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function getTemplateImagePrompt(scene: Scene, topic: string, enableLipSync: boolean, characterDescription?: string, referenceImages?: string[], cameraAngleModifier?: string): string {
  const cleanedCharDesc = characterDescription ? sanitizeCharacterDescription(characterDescription) : '';
  const charDesc = cleanedCharDesc ? `\nCHARACTER: ${cleanedCharDesc}. Maintain EXACT same appearance in every frame.` : '';
  const refImageNote = referenceImages?.length ? `\nIMPORTANT: Match the person's appearance exactly from the reference - same face shape, skin tone, hair, features.` : '';
  const antiPropRule = `\nDo NOT add any objects, bottles, or products to the character's hands unless the scene description explicitly calls for it. Hands should be natural and empty.`;
  
  // For lip sync mode, generate front-facing portrait suitable for talking head
  if (enableLipSync && !scene.isIntro && !scene.isOutro) {
    const angleNote = cameraAngleModifier ? `\nCAMERA ANGLE: ${cameraAngleModifier}` : '';
    return `LOOKING DIRECTLY AT THE CAMERA. Front-facing portrait photo of a person making direct eye contact with the viewer.${charDesc}${refImageNote}${angleNote}

Scene context: ${scene.visualDescription}
Topic being discussed: ${topic}

REQUIREMENTS:
- Eyes locked on camera, head facing forward
- Natural confident expression, slight smile
- Soft studio lighting, clean blurred background
- Photorealistic, high quality portrait
- Vertical 9:16 format
- NO text, captions, watermarks, or written words${antiPropRule}`;
  }

  if (scene.isIntro) {
    const basePrompt = scene.visualDescription || 'Modern social media intro background';
    return `${basePrompt}. Topic: ${topic}. 
Opening shot for a reel about "${topic}".
Clean cinematic intro with rich colors, sophisticated lighting.
Vertical 9:16 portrait format.
ABSOLUTELY NO TEXT of any kind. No words, no letters, no titles, no captions, no watermarks, no typography. Pure visual imagery only. If you generate any text at all, the image is wrong.`;
  }
  
  if (scene.isOutro) {
    const basePrompt = scene.visualDescription || 'Social media call-to-action background';
    return `${basePrompt}. 
Closing shot for a reel about "${topic}".
Elegant, sophisticated, high-end brand feel with deep colors and atmospheric lighting.
Vertical 9:16 format.
NO text, captions, subtitles, titles, watermarks, or written words. Pure visual background only.`;
  }
  
  const angleModifier = cameraAngleModifier ? `\nCAMERA ANGLE: ${cameraAngleModifier}` : '';
  
  return `LOOKING DIRECTLY AT THE CAMERA. The subject faces the viewer with direct eye contact.${charDesc}${refImageNote}${angleModifier}

Scene: ${scene.visualDescription}
Topic: ${topic}
What the character is talking about: "${scene.narration}"

REQUIREMENTS:
- Direct eye contact with camera, head facing forward
- Natural confident pose
- Professional lighting, clean composition
- Photorealistic, high quality, vertical 9:16 format
- NO text, captions, watermarks, or written words${antiPropRule}`;
}

// Build image generation messages with reference images for character consistency
function buildImageGenMessages(prompt: string, referenceImages?: string[]) {
  if (referenceImages && referenceImages.length > 0) {
    // Use multimodal message with reference image for character consistency
    const content: any[] = [];
    
    // Add the first reference image
    content.push({
      type: 'image_url',
      image_url: { url: referenceImages[0] }
    });
    
    content.push({
      type: 'text',
      text: `Using this person as the EXACT character reference - match their face, features, skin tone, and appearance precisely in the generated image.\n\n${prompt}`
    });
    
    return [{ role: 'user', content }];
  }
  
  return [{ role: 'user', content: prompt }];
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
      voice = 'nova',
      preGeneratedImages = [],
      referenceImages = [],
      characterDescription = '',
      cameraAngles = [],
      videoModel = 'wan-2.1-i2v-480p',
      sceneDuration = undefined
    } = await req.json();

    if (!scenes || !Array.isArray(scenes) || scenes.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Scenes are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate each scene has required fields (#46)
    for (const scene of scenes) {
      if (typeof scene.sceneNumber !== 'number') {
        return new Response(
          JSON.stringify({ error: `Scene missing sceneNumber` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    console.log('Generating reel video for topic:', topic);
    console.log('Scenes:', scenes.length);
    console.log('Add captions:', addCaptions);
    console.log('Use WaveSpeed:', useWaveSpeed);
    console.log('Enable Lip Sync:', enableLipSync);
    console.log('Lip Sync Model:', lipSyncModel);
    console.log('Video Model:', videoModel);
    console.log('Portrait Image provided:', !!portraitImage);
    console.log('Voice:', voice);
    console.log('Voiceovers provided:', voiceovers?.length || 0);
    console.log('Pre-generated images:', preGeneratedImages?.length || 0);
    console.log('Camera angles provided:', cameraAngles?.length || 0);
    // OPENAI_API_KEY removed — not used in this function

    const WAVESPEED_API_KEY = Deno.env.get('WAVESPEED_API_KEY');
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    // Create Supabase client for storage uploads and task logging
    const supabase = SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY 
      ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
      : null;

    // Extract user ID from auth header for task logging
    let currentUserId: string | null = null;
    if (supabase) {
      try {
        const authHeader = req.headers.get('authorization');
        if (authHeader) {
          const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
          const authClient = createClient(SUPABASE_URL!, anonKey!, {
            global: { headers: { Authorization: authHeader } }
          });
          const { data: { user } } = await authClient.auth.getUser();
          currentUserId = user?.id || null;
        }
      } catch (e) {
        console.warn('Could not extract user ID for task logging:', e);
      }
    }

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
        // Get camera angle modifier for this scene (rotate through provided angles)
        const sceneIndex = (scenes as Scene[]).indexOf(scene);
        const cameraAngleModifier = cameraAngles?.length > 0 
          ? cameraAngles[sceneIndex % cameraAngles.length] 
          : undefined;
        
        const imagePrompt = getTemplateImagePrompt(scene, topic, enableLipSync, characterDescription, referenceImages, cameraAngleModifier);
        const messages = buildImageGenMessages(imagePrompt, (!scene.isIntro && !scene.isOutro) ? referenceImages : undefined);
        
        const imageResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${LOVABLE_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'google/gemini-3-pro-image-preview',
            messages,
            modalities: ['image', 'text'],
            image_generation_config: { aspect_ratio: '9:16' }
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
        // Push a placeholder so indices stay aligned with scenes
        sceneImages.push('');
        savedImageUrls.push('');
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
        
        // Determine API endpoint and body based on scene type
        let apiEndpoint: string;
        let requestBody: any;
        let sceneHasEmbeddedAudio = false;
        
        // Use actual audio duration if provided, otherwise fall back to scene duration
        const targetDuration = scene.audioDuration || scene.duration;
        // For infinitetalk, no duration cap needed — it auto-matches audio length
        // For other models: VEO 3 produces 8s clips; Kling 3.0 Pro supports 5s or 10s
        const clipDuration = (videoModel === 'infinitetalk' || lipSyncModel === 'infinitetalk') 
          ? targetDuration 
          : Math.max(3, Math.min(10, Math.round(targetDuration)));
        
        console.log(`Scene ${scene.sceneNumber}: target duration ${targetDuration}s, clip duration ${clipDuration}s, model=${videoModel}`);
        
        // Build rich character context for prompts
        const charContext = characterDescription ? `Character: ${characterDescription}.` : '';
        const topicContext = `Topic: ${topic}.`;
        
        // ====== SCENE TYPE ROUTING ======
        // When VEO3 is selected, ALL scene types use VEO3 — no mixing models.
        // Otherwise route based on scene type and other settings.
        
        const isNarratorScene = !scene.isIntro && !scene.isOutro && !scene.isSilentCTA && scene.narration?.trim();
        
        if (videoModel === 'veo3') {
          // ====== VEO3: ALL SCENES use VEO3 when selected ======
          // VEO3 generates native audio — no separate TTS needed
          const sceneType = scene.isIntro ? 'intro' : scene.isOutro ? 'outro' : 'narrator';
          console.log(`Scene ${scene.sceneNumber}: Using VEO3 for ${sceneType} scene (built-in audio)`);
          
          // Use image-to-video endpoint when we have an image, text-to-video otherwise
          const hasImage = !!imageUrl;
          if (hasImage) {
            apiEndpoint = 'https://api.wavespeed.ai/api/v3/google/veo3/image-to-video';
          } else {
            apiEndpoint = 'https://api.wavespeed.ai/api/v3/google/veo3';
          }
          
          // When we have an image, do NOT re-describe the character's appearance in the prompt
          // The image already defines what the person looks like — adding text like "Male, 30s, beard"
          // can conflict with the actual image. Only use charContext for text-to-video (no image).
          const veo3CharContext = hasImage ? '' : charContext;
          
          let veo3Prompt: string;
          if (scene.isIntro) {
            veo3Prompt = `Premium cinematic intro for a reel about "${topic}". ${veo3CharContext}
Dramatic camera push-in with shallow depth of field, volumetric light rays, commanding presence.
Ultra high quality, film-grade. Sets the mood for powerful content ahead.
${scene.narration ? `The person in the video must clearly say this exact line out loud with visible lip movement and synchronized speech audio: "${scene.narration}". Generate clear spoken voice audio matching these words.` : 'Atmospheric ambient audio only.'}
No text, no captions, no subtitles, no watermarks.`;
          } else if (scene.isOutro) {
            veo3Prompt = `Premium cinematic outro for a reel about "${topic}". ${veo3CharContext}
Elegant slow zoom out with warm golden lighting, confident closing energy, smooth professional motion.
Film-grade quality.
${scene.narration ? `The person in the video must clearly say this exact closing line out loud with visible lip movement and synchronized speech audio: "${scene.narration}". Generate clear spoken voice audio matching these words.` : 'Warm ambient closing audio only.'}
No text, no captions, no subtitles, no watermarks.`;
          } else {
            veo3Prompt = `${scene.visualDescription}. ${veo3CharContext} ${topicContext}
The person in the video speaks directly to camera and clearly says this exact line out loud: "${scene.narration}"
Generate clear spoken dialogue audio for that exact sentence, with lips visibly moving in sync with the words.
Smooth cinematic motion, professional color grading, photorealistic quality.
Natural confident expression, engaging body language, direct-to-camera delivery.
Absolutely no text, no captions, no subtitles, no watermarks.`;
          }
          
          requestBody = {
            prompt: veo3Prompt,
            generate_audio: true,
            aspect_ratio: '9:16',
            duration: 8,
            resolution: '720p'
          };
          if (hasImage) {
            requestBody.image = imageUrl;
          }
          sceneHasEmbeddedAudio = true;
          
        } else if (videoModel === 'sora-2') {
          // ====== SORA-2: ALL SCENES use Sora-2 when selected ======
          // Sora-2 generates native audio — no separate TTS needed
          const sceneType = scene.isIntro ? 'intro' : scene.isOutro ? 'outro' : 'narrator';
          console.log(`Scene ${scene.sceneNumber}: Using Sora-2 for ${sceneType} scene (built-in audio)`);
          
          apiEndpoint = 'https://api.wavespeed.ai/api/v3/openai/sora-2/image-to-video';
          
          // Sora-2 supports durations: 4, 8, 12, 16, 20 seconds
          const sora2Durations = [4, 8, 12, 16, 20];
          const sora2Duration = sora2Durations.reduce((best, d) => Math.abs(d - clipDuration) < Math.abs(best - clipDuration) ? d : best, 8);
          
          const hasImage = !!imageUrl;
          const sora2CharContext = hasImage ? '' : charContext;
          
          let sora2Prompt: string;
          if (scene.isIntro) {
            sora2Prompt = `${sora2CharContext} Premium cinematic intro for a reel about "${topic}".
Dramatic camera push-in with shallow depth of field, volumetric light rays, commanding presence.
Ultra high quality, film-grade. Sets the mood for powerful content ahead.
Smooth cinematic motion, professional color grading, photorealistic quality.
${scene.narration ? `
Audio (MANDATORY — PRIMARY OUTPUT):
The person speaks directly to camera with clear, natural, confident delivery. Lips must move in perfect sync with the words.
Voice tone: authoritative, engaging pace.
They say EXACTLY: "${scene.narration}"

Rules (STRICT):
- Spoken dialogue audio is REQUIRED and must be clearly audible
- Lip movement must match the spoken words exactly (lip-synced speech)
- Do NOT generate a silent clip
- Do NOT replace speech with music
- No voiceover — the person on screen is speaking` : 'Atmospheric ambient audio only.'}
No text, no captions, no subtitles, no watermarks.`;
          } else if (scene.isOutro) {
            sora2Prompt = `${sora2CharContext} Premium cinematic outro for a reel about "${topic}".
Elegant slow zoom out with warm golden lighting, confident closing energy, smooth professional motion.
Film-grade quality.
${scene.narration ? `
Audio (MANDATORY — PRIMARY OUTPUT):
The person speaks directly to camera with warm, inviting delivery. Lips must move in perfect sync with the words.
Voice tone: confident, closing energy, natural pace.
They say EXACTLY: "${scene.narration}"

Rules (STRICT):
- Spoken dialogue audio is REQUIRED and must be clearly audible
- Lip movement must match the spoken words exactly (lip-synced speech)
- Do NOT generate a silent clip
- Do NOT replace speech with music
- No voiceover — the person on screen is speaking` : 'Warm ambient closing audio only.'}
No text, no captions, no subtitles, no watermarks.`;
          } else {
            sora2Prompt = `${scene.visualDescription}. ${sora2CharContext} ${topicContext}

Camera: smooth cinematic motion, subtle depth shifts, professional color grading. Photorealistic, high-end commercial quality.

Audio (MANDATORY — PRIMARY OUTPUT):
The person speaks directly to camera with clear, natural, confident delivery. Lips must move in perfect sync with the words.
Voice tone: authoritative, slightly provocative, engaging pace.
They say EXACTLY: "${scene.narration}"

Rules (STRICT):
- Spoken dialogue audio is REQUIRED and must be clearly audible
- Lip movement must match the spoken words exactly (lip-synced speech)
- Do NOT generate a silent clip
- Do NOT replace speech with music
- No captions, subtitles, or on-screen text
- No voiceover — the person on screen is speaking
- If showing a person: natural expression, confident pose, engaged with the moment`;
          }
          
          requestBody = {
            image: imageUrl,
            prompt: sora2Prompt,
            duration: sora2Duration,
            aspect_ratio: '9:16'
          };
          sceneHasEmbeddedAudio = true; // Sora-2 generates audio natively
          
        } else if (isNarratorScene && enableLipSync && (videoModel === 'infinitetalk' || lipSyncModel === 'infinitetalk')) {
          // ====== INFINITETALK: Audio-driven lip sync (up to 10 min) ======
          // Takes portrait image + audio URL, produces video with embedded lip-synced audio
          // Duration auto-matches the audio length — no cap needed
          console.log(`Scene ${scene.sceneNumber}: Using InfiniteTalk for lip-sync narrator scene`);
          
          // We need an audio URL for infinitetalk
          let sceneAudioUrl = audioUrl;
          
          // If audio is base64, upload to storage first
          if (sceneAudioUrl && sceneAudioUrl.startsWith('data:') && supabase) {
            try {
              const base64Match = sceneAudioUrl.match(/^data:([^;]+);base64,(.+)$/);
              if (base64Match) {
                const audioBytes = base64ToUint8Array(base64Match[2]);
                const audioFileName = `audio/${Date.now()}-scene-${scene.sceneNumber}-tts.mp3`;
                const { error: audioUploadError } = await supabase.storage
                  .from('reels')
                  .upload(audioFileName, audioBytes, { contentType: base64Match[1], upsert: true });
                
                if (!audioUploadError) {
                  const { data: audioPublicUrl } = supabase.storage.from('reels').getPublicUrl(audioFileName);
                  sceneAudioUrl = audioPublicUrl.publicUrl;
                  console.log(`Scene ${scene.sceneNumber}: Uploaded base64 audio to storage: ${sceneAudioUrl}`);
                }
              }
            } catch (audioUploadErr) {
              console.error(`Scene ${scene.sceneNumber}: Failed to upload audio to storage:`, audioUploadErr);
            }
          }
          
          if (!sceneAudioUrl) {
            console.warn(`Scene ${scene.sceneNumber}: No audio URL for InfiniteTalk, falling back to Kling`);
            // Fall through to kling fallback below
            apiEndpoint = 'https://api.wavespeed.ai/api/v3/kwaivgi/kling-v3.0-pro/image-to-video';
            const klingDuration = clipDuration <= 7 ? 5 : 10;
            requestBody = {
              image: imageUrl,
              prompt: `${scene.visualDescription}. ${charContext} ${topicContext} Natural expression, cinematic quality. No text.`,
              duration: klingDuration
            };
            sceneHasEmbeddedAudio = false;
          } else {
            apiEndpoint = 'https://api.wavespeed.ai/api/v3/wavespeed-ai/infinitetalk-fast';
            requestBody = {
              image: imageUrl,
              audio: sceneAudioUrl,
            };
            sceneHasEmbeddedAudio = true; // InfiniteTalk embeds audio in the video
            console.log(`Scene ${scene.sceneNumber}: InfiniteTalk request — image + audio, duration will match audio length`);
          }
          
        } else if (isNarratorScene && enableLipSync && videoModel === 'wan-2.5-video-extend') {
          // ====== WAN 2.5 VIDEO EXTEND: Two-step pipeline ======
          console.log(`Scene ${scene.sceneNumber}: Using Wan 2.5 Video Extend pipeline`);
          
          const genderHint = characterDescription?.toLowerCase().includes('woman') || 
                            characterDescription?.toLowerCase().includes('female') || 
                            characterDescription?.toLowerCase().includes('girl') ||
                            characterDescription?.toLowerCase().includes('lady')
                            ? 'female' : 'male';
          
          try {
            // -- AI Super Prompt --
            console.log(`Scene ${scene.sceneNumber}: Generating AI super prompt...`);
            const superPromptResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${LOVABLE_API_KEY}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                model: 'google/gemini-3-flash-preview',
                messages: [{
                  role: 'user',
                  content: `You are Loop AI, a cinematic video director. Create a concise, vivid video-extend prompt (max 2 sentences) that describes the MOTION and CAMERA MOVEMENT for extending a video clip of a ${genderHint} speaker.

Scene context: "${scene.narration}"
Character: ${characterDescription || 'Professional speaker'}
Topic: ${topic}

Rules:
- Describe only motion, expression, and camera — NOT the scene setup (we already have the base video)
- Focus on: subtle camera drift, natural gestures, facial micro-expressions, confident delivery
- Do NOT mention text, captions, watermarks
- Keep it under 50 words
- Write only the prompt, no explanation`
                }]
              }),
            });

            let superPrompt = `${genderHint} speaker continues delivering message with natural confidence and engaging expression. Subtle camera drift, professional cinematic quality.`;
            
            if (superPromptResponse.ok) {
              const spData = await superPromptResponse.json();
              const aiPrompt = spData.choices?.[0]?.message?.content?.trim();
              if (aiPrompt && aiPrompt.length > 10) {
                superPrompt = aiPrompt;
                console.log(`Scene ${scene.sceneNumber}: AI super prompt: "${superPrompt}"`);
              }
            } else {
              console.log(`Scene ${scene.sceneNumber}: AI super prompt failed, using default`);
            }

            // -- Step 1: Generate base video from image --
            console.log(`Scene ${scene.sceneNumber}: Step 1 - Generating base video from image...`);
            const baseVideoResponse = await fetch('https://api.wavespeed.ai/api/v3/wavespeed-ai/wan-2.1-i2v-480p', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${WAVESPEED_API_KEY}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                image: imageUrl,
                prompt: `A ${genderHint} speaker with natural confident expression. ${charContext} Professional lighting, eye contact. No text or captions.`
              }),
            });

            if (!baseVideoResponse.ok) {
              const errText = await baseVideoResponse.text();
              console.error(`Scene ${scene.sceneNumber}: Base video generation failed:`, errText);
              throw new Error(`Base video failed: ${errText}`);
            }

            const baseVideoData = await baseVideoResponse.json();
            const baseTaskId = baseVideoData.data?.id;
            
            if (!baseTaskId) {
              throw new Error('No task ID returned for base video');
            }

            console.log(`Scene ${scene.sceneNumber}: Base video task ${baseTaskId}, polling...`);

            // -- Poll for base video completion --
            let baseVideoUrl: string | null = null;
            const maxPollAttempts = 60;
            for (let attempt = 0; attempt < maxPollAttempts; attempt++) {
              await new Promise(resolve => setTimeout(resolve, 3000));
              
              const statusResponse = await fetch(`https://api.wavespeed.ai/api/v3/predictions/${baseTaskId}/result`, {
                headers: { 'Authorization': `Bearer ${WAVESPEED_API_KEY}` },
              });
              
              if (statusResponse.ok) {
                const statusData = await statusResponse.json();
                if (statusData.data?.status === 'completed' && statusData.data?.outputs?.length > 0) {
                  baseVideoUrl = statusData.data.outputs[0];
                  console.log(`Scene ${scene.sceneNumber}: Base video ready: ${baseVideoUrl}`);
                  break;
                } else if (statusData.data?.status === 'failed') {
                  throw new Error('Base video generation failed');
                }
              }
            }

            if (!baseVideoUrl) {
              throw new Error('Base video polling timed out');
            }

            // -- Step 2: Call video-extend with the base video + super prompt --
            console.log(`Scene ${scene.sceneNumber}: Step 2 - Extending video with super prompt...`);
            const extendDuration = Math.max(3, Math.min(10, clipDuration));
            
            apiEndpoint = 'https://api.wavespeed.ai/api/v3/alibaba/wan-2.5/video-extend';
            requestBody = {
              video: baseVideoUrl,
              prompt: superPrompt,
              duration: extendDuration,
              resolution: '720p',
              enable_prompt_expansion: false
            };
            sceneHasEmbeddedAudio = false;
            
          } catch (extendError) {
            console.error(`Scene ${scene.sceneNumber}: Video-extend pipeline failed, falling back to wan-2.1-i2v:`, extendError);
            // Fallback to simple i2v
            apiEndpoint = 'https://api.wavespeed.ai/api/v3/wavespeed-ai/wan-2.1-i2v-480p';
            requestBody = {
              image: imageUrl,
              prompt: `A ${genderHint} speaker delivering a message with natural expression. ${charContext} ${topicContext} Professional quality. No text or captions.`
            };
            sceneHasEmbeddedAudio = false;
          }
          
        } else if (isNarratorScene && enableLipSync && videoModel === 'wan-2.6-i2v') {
          // ====== WAN 2.6 I2V: High quality image-to-video, 5/10/15s clips ======
          console.log(`Scene ${scene.sceneNumber}: Using Wan 2.6 I2V for narrator scene`);
          
          // Use user-selected duration if provided, otherwise clamp to allowed: 5, 10, or 15
          const wan26Duration = sceneDuration && [5, 10, 15].includes(sceneDuration) ? sceneDuration : (clipDuration <= 7 ? 5 : clipDuration <= 12 ? 10 : 15);
          
          apiEndpoint = 'https://api.wavespeed.ai/api/v3/alibaba/wan-2.6/image-to-video';
          requestBody = {
            image: imageUrl,
            prompt: `${scene.visualDescription}. ${charContext} ${topicContext}
Context: The narrator is saying "${scene.narration}" over this visual.
Smooth cinematic motion, professional color grading, photorealistic quality.
Natural confident expression, engaging body language.
Absolutely no text, no captions, no subtitles, no watermarks.`,
            duration: wan26Duration
          };
          sceneHasEmbeddedAudio = false;
          
        } else if (isNarratorScene && enableLipSync && videoModel === 'kling-v3.0-pro') {
          // ====== KLING 3.0 PRO: Cinematic lip sync scenes ======
          console.log(`Scene ${scene.sceneNumber}: Using Kling 3.0 Pro for narrator scene (lip sync)`);
          
          apiEndpoint = 'https://api.wavespeed.ai/api/v3/kwaivgi/kling-v3.0-pro/image-to-video';
          const klingDuration = clipDuration <= 7 ? 5 : 10;
          
          requestBody = {
            image: imageUrl,
            prompt: `${scene.visualDescription}. ${charContext} ${topicContext}
Context: The narrator is saying "${scene.narration}" over this visual.
Premium cinematic motion — smooth parallax camera movement, subtle depth shifts, professional color grading.
The visual should emotionally match the narration content. Photorealistic, high-end commercial quality.
Natural confident expression, engaging body language.
Absolutely no text, no captions, no subtitles, no watermarks.`,
            duration: klingDuration
          };
          sceneHasEmbeddedAudio = false;
          
        } else if (isNarratorScene && enableLipSync) {
          // ====== WAN 2.1 I2V 480p (default): Fast, cheap image-to-video for testing ======
          console.log(`Scene ${scene.sceneNumber}: Using Wan 2.1 I2V 480p for narrator scene`);
          
          const genderHint = characterDescription?.toLowerCase().includes('woman') || 
                            characterDescription?.toLowerCase().includes('female') || 
                            characterDescription?.toLowerCase().includes('girl') ||
                            characterDescription?.toLowerCase().includes('lady')
                            ? 'female' : 'male';
          
          apiEndpoint = 'https://api.wavespeed.ai/api/v3/wavespeed-ai/wan-2.1-i2v-480p';
          requestBody = {
            image: imageUrl,
            prompt: `A ${genderHint} speaker delivering a message with natural expression and confidence: "${scene.narration}". ${charContext} ${topicContext}
Professional, engaging delivery with eye contact. Natural lip movements and facial expressions matching speech.
Cinematic lighting, shallow depth of field, premium quality.
No text, no captions, no subtitles, no watermarks.`
          };
          sceneHasEmbeddedAudio = false;
          
        } else if (isNarratorScene && !enableLipSync) {
          // ====== KLING 3.0 PRO: Narrator scene WITHOUT lip sync ======
          console.log(`Scene ${scene.sceneNumber}: Using Kling 3.0 Pro for narrator scene (no lip sync, TTS overlay)`);
          
          apiEndpoint = 'https://api.wavespeed.ai/api/v3/kwaivgi/kling-v3.0-pro/image-to-video';
          const klingDuration = clipDuration <= 7 ? 5 : 10;
          
          requestBody = {
            image: imageUrl,
            prompt: `${scene.visualDescription}. ${charContext} ${topicContext}
Context: The narrator is saying "${scene.narration}" over this visual.
Premium cinematic motion — smooth parallax camera movement, subtle depth shifts, professional color grading.
The visual should emotionally match the narration content. Photorealistic, high-end commercial quality.
If showing a person: natural expression, confident pose, engaged with the moment.
Absolutely no text, no captions, no subtitles, no watermarks.`,
            duration: klingDuration
          };
          
        } else if (scene.isIntro) {
          // ====== SORA 2: Intro scene (non-VEO3 path) ======
          console.log(`Scene ${scene.sceneNumber}: Using Sora 2 for intro`);
          
          apiEndpoint = 'https://api.wavespeed.ai/api/v3/openai/sora-2/image-to-video';
          const sora2Durations = [4, 8, 12, 16, 20];
          const sora2Duration = sora2Durations.reduce((best, d) => Math.abs(d - clipDuration) < Math.abs(best - clipDuration) ? d : best, 4);
          
          requestBody = {
            image: imageUrl,
            prompt: `Premium cinematic intro for a reel about "${topic}". ${charContext}
Elegant slow zoom in with shallow depth of field, volumetric light rays, smooth professional motion.
Ultra high quality, film-grade. Atmospheric, sets the mood for the content ahead.
No text, no captions, no subtitles, no watermarks. Pure cinematic visuals.`,
            duration: sora2Duration,
            aspect_ratio: '9:16'
          };
          sceneHasEmbeddedAudio = true; // Sora-2 generates audio natively
          
        } else if (scene.isOutro) {
          // ====== SORA 2: Outro scene (non-VEO3 path) ======
          console.log(`Scene ${scene.sceneNumber}: Using Sora 2 for outro`);
          
          apiEndpoint = 'https://api.wavespeed.ai/api/v3/openai/sora-2/image-to-video';
          const sora2Durations = [4, 8, 12, 16, 20];
          const sora2Duration = sora2Durations.reduce((best, d) => Math.abs(d - clipDuration) < Math.abs(best - clipDuration) ? d : best, 4);
          
          const outroCharDesc = characterDescription 
            ? `The ${characterDescription} is in frame with a warm, inviting closing expression.` 
            : 'Warm, inviting atmosphere.';
          const outroNarration = scene.narration ? `The scene conveys: "${scene.narration}"` : '';
          
          requestBody = {
            image: imageUrl,
            prompt: `Premium cinematic outro for a reel about "${topic}". ${outroCharDesc}
${outroNarration}
Elegant slow zoom out with warm golden lighting, confident closing energy, smooth professional motion.
The subject has a knowing smile, relaxed and inviting posture. Film-grade quality.
No text, no captions, no subtitles, no watermarks.`,
            duration: sora2Duration,
            aspect_ratio: '9:16'
          };
          sceneHasEmbeddedAudio = true; // Sora-2 generates audio natively
          
        } else {
          // ====== KLING 3.0 PRO: B-roll / fallback ======
          console.log(`Scene ${scene.sceneNumber}: Using Kling 3.0 Pro for B-roll`);
          
          apiEndpoint = 'https://api.wavespeed.ai/api/v3/kwaivgi/kling-v3.0-pro/image-to-video';
          const klingDuration = clipDuration <= 7 ? 5 : 10;
          
          requestBody = {
            image: imageUrl,
            prompt: `${scene.visualDescription}. ${topicContext}
Premium cinematic B-roll — smooth camera movement, subtle parallax depth, professional color grading.
Photorealistic, high-end commercial quality. Emotionally resonant visuals.
Absolutely no text, no captions, no subtitles, no watermarks.`,
            duration: klingDuration
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
              console.log(`Scene ${scene.sceneNumber}: Model=${apiEndpoint.split('/').pop()}, hasEmbeddedAudio=${sceneHasEmbeddedAudio}`);
              
              videoTasks.push({
                sceneNumber: scene.sceneNumber,
                taskId: videoData.data.id,
                model: apiEndpoint,
                hasEmbeddedAudio: sceneHasEmbeddedAudio
              });
              // Log to video_tasks table
              if (supabase && currentUserId) {
                supabase.from('video_tasks').insert({
                  user_id: currentUserId,
                  task_id: videoData.data.id,
                  model: apiEndpoint.split('/').pop() || 'unknown',
                  status: 'pending',
                  source: 'reel',
                  scene_number: scene.sceneNumber,
                  prompt: (scene.visualDescription || '').substring(0, 500)
                }).then(({ error }) => { if (error) console.error('[video_tasks] log error:', error); });
              }
            }
          } else {
            const errorText = await videoResponse.text();
            console.error('WaveSpeed error for scene', scene.sceneNumber, ':', errorText);
            
            // Check for credit errors
            if (errorText.includes('Insufficient credits') || errorText.includes('insufficient_credits')) {
              console.error('Credit error detected for scene', scene.sceneNumber);
            }
            
            // Fallback: try Kling I2V if VEO 3 failed, or Wan-2.5 I2V as last resort
            // IMPORTANT: If VEO3 was the intended model, preserve speech intent in the fallback prompt
            console.log(`Falling back for scene ${scene.sceneNumber} (intended model: ${videoModel})`);
            
            const fallbackEndpoint = imageUrl 
              ? 'https://api.wavespeed.ai/api/v3/kwaivgi/kling-v3.0-pro/image-to-video'
              : 'https://api.wavespeed.ai/api/v3/alibaba/wan-2.5/image-to-video';
            const klingDuration = clipDuration <= 7 ? 5 : 10;
            
            // If VEO3 was intended, keep speech-friendly prompt; otherwise use silent B-roll prompt
            const fallbackPrompt = videoModel === 'veo3'
              ? `${scene.visualDescription || scene.narration}. ${charContext} ${topicContext} Cinematic motion, engaging expression, natural body language, direct-to-camera delivery. No text, no captions, no subtitles, no watermarks.`
              : `${scene.visualDescription}. ${topicContext} Dynamic cinematic motion, engaging visuals. No text, no captions, no subtitles, no watermarks.`;
            
            try {
              const fallbackResponse = await fetch(fallbackEndpoint, {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${WAVESPEED_API_KEY}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  image: imageUrl,
                  prompt: fallbackPrompt,
                  duration: klingDuration
                }),
              });
              
              if (fallbackResponse.ok) {
                const fallbackData = await fallbackResponse.json();
                if (fallbackData.code === 200 && fallbackData.data?.id) {
                  console.log(`Scene ${scene.sceneNumber}: Fallback to ${fallbackEndpoint.split('/').pop()} (NO embedded audio)`);
                  videoTasks.push({
                    sceneNumber: scene.sceneNumber,
                    taskId: fallbackData.data.id,
                    model: fallbackEndpoint,
                    hasEmbeddedAudio: false
                  });
                  // Log fallback task
                  if (supabase && currentUserId) {
                    supabase.from('video_tasks').insert({
                      user_id: currentUserId,
                      task_id: fallbackData.data.id,
                      model: fallbackEndpoint.split('/').pop() || 'unknown',
                      status: 'pending',
                      source: 'reel',
                      scene_number: scene.sceneNumber,
                      prompt: (scene.visualDescription || '').substring(0, 500)
                    }).then(({ error }) => { if (error) console.error('[video_tasks] fallback log error:', error); });
                  }
                }
              }
            } catch (fallbackErr) {
              console.error('Fallback also failed for scene', scene.sceneNumber, fallbackErr);
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