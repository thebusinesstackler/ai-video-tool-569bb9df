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
  isProductBroll?: boolean;
  scenePurpose?: string;
  startFrame?: string;
  endFrame?: string;
  templateId?: string;
  cameraAngle?: string;
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

// ── Google Cloud OAuth (service-account → access token) ─────────────────────
let _gToken: { token: string; exp: number } | null = null;
function _b64url(input: ArrayBuffer | Uint8Array | string): string {
  let bytes: Uint8Array;
  if (typeof input === 'string') bytes = new TextEncoder().encode(input);
  else if (input instanceof ArrayBuffer) bytes = new Uint8Array(input);
  else bytes = input;
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function _pemToDer(pem: string): ArrayBuffer {
  const b64 = pem.replace(/-----BEGIN [^-]+-----/g, '').replace(/-----END [^-]+-----/g, '').replace(/\s+/g, '');
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes.buffer;
}
async function getGoogleAccessToken(): Promise<string | null> {
  const raw = Deno.env.get('GOOGLE_CLOUD_SERVICE_ACCOUNT');
  if (!raw) return null;
  if (_gToken && _gToken.exp - 60 > Math.floor(Date.now() / 1000)) return _gToken.token;
  try {
    const sa = JSON.parse(raw);
    const now = Math.floor(Date.now() / 1000);
    const header = { alg: 'RS256', typ: 'JWT' };
    const payload = { iss: sa.client_email, scope: 'https://www.googleapis.com/auth/cloud-platform', aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 };
    const signingInput = `${_b64url(JSON.stringify(header))}.${_b64url(JSON.stringify(payload))}`;
    const key = await crypto.subtle.importKey('pkcs8', _pemToDer(sa.private_key), { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
    const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(signingInput));
    const jwt = `${signingInput}.${_b64url(sig)}`;
    const resp = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}` });
    if (!resp.ok) { console.error('Google OAuth failed', resp.status, await resp.text()); return null; }
    const data = await resp.json();
    _gToken = { token: data.access_token, exp: now + (data.expires_in || 3600) };
    return _gToken.token;
  } catch (e) { console.error('Google OAuth exception', e); return null; }
}

// ── Google Cloud TTS via API key (uses billing-enabled project tied to the key) ──
async function generateGoogleTTSWithApiKey(text: string, gender?: string): Promise<Uint8Array> {
  const apiKey = Deno.env.get('GOOGLE_CLOUD_TTS_API_KEY');
  if (!apiKey) throw new Error('GOOGLE_CLOUD_TTS_API_KEY not set');
  const isFemale = gender?.toLowerCase() === 'female' || gender?.toLowerCase() === 'woman';
  // Try Chirp3-HD first, fall back to Studio/Neural2 if not enabled for this key
  const voiceCandidates = isFemale
    ? [{ name: 'en-US-Chirp3-HD-Aoede' }, { name: 'en-US-Studio-O' }, { name: 'en-US-Neural2-F' }]
    : [{ name: 'en-US-Chirp3-HD-Charon' }, { name: 'en-US-Studio-Q' }, { name: 'en-US-Neural2-D' }];
  let lastErr = '';
  for (const voice of voiceCandidates) {
    const resp = await fetch(
      `https://texttospeech.googleapis.com/v1beta1/text:synthesize?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          input: { text: text.length > 5000 ? text.substring(0, 5000) : text },
          voice: { languageCode: 'en-US', name: voice.name },
          audioConfig: { audioEncoding: 'MP3' },
        }),
      }
    );
    if (resp.ok) {
      const data = await resp.json();
      if (!data.audioContent) { lastErr = 'no audioContent'; continue; }
      const bin = atob(data.audioContent);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      console.log(`Google TTS (api-key) succeeded with voice ${voice.name}`);
      return bytes;
    }
    lastErr = `${resp.status}: ${await resp.text()}`;
    console.warn(`Google TTS voice ${voice.name} failed → ${lastErr.substring(0, 200)}`);
  }
  throw new Error(`Google TTS (api-key) failed: ${lastErr}`);
}

// ── Google Chirp3-HD TTS fallback (OAuth) ──────────────────────────────────
async function generateChirp3TTS(text: string, gender?: string): Promise<Uint8Array> {
  const accessToken = await getGoogleAccessToken();
  if (!accessToken) throw new Error('Chirp3 unavailable: GOOGLE_CLOUD_SERVICE_ACCOUNT missing or invalid');
  const isFemale = gender?.toLowerCase() === 'female' || gender?.toLowerCase() === 'woman';
  const voiceName = isFemale ? 'en-US-Chirp3-HD-Aoede' : 'en-US-Chirp3-HD-Charon';
  const sa = JSON.parse(Deno.env.get('GOOGLE_CLOUD_SERVICE_ACCOUNT') || '{}');
  const resp = await fetch(
    'https://texttospeech.googleapis.com/v1beta1/text:synthesize',
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        ...(sa.project_id ? { 'x-goog-user-project': sa.project_id } : {}),
      },
      body: JSON.stringify({
        input: { text: text.length > 5000 ? text.substring(0, 5000) : text },
        voice: { languageCode: 'en-US', name: voiceName },
        audioConfig: { audioEncoding: 'MP3' },
      }),
    }
  );
  if (!resp.ok) throw new Error(`Chirp3 TTS failed (${resp.status}): ${await resp.text()}`);
  const data = await resp.json();
  if (!data.audioContent) throw new Error('Chirp3 returned no audioContent');
  const bin = atob(data.audioContent);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

// ── OpenAI TTS for clear narrator speech ──────────────────────────────────
async function generateOpenAITTS(
  text: string,
  apiKey: string,
  gender?: string,
  instructions?: string
): Promise<Uint8Array> {
  const maleVoices = ['onyx', 'echo', 'ash'];
  const femaleVoices = ['nova', 'shimmer', 'coral'];
  const isFemale = gender?.toLowerCase() === 'female' ||
    gender?.toLowerCase() === 'woman';
  const voicePool = isFemale ? femaleVoices : maleVoices;
  const selectedVoice = voicePool[Math.floor(Math.random() * voicePool.length)];

  const body: any = {
    model: 'gpt-4o-mini-tts',
    input: text,
    voice: selectedVoice,
    response_format: 'mp3',
  };
  if (instructions) body.instructions = instructions;

  const resp = await fetch('https://api.openai.com/v1/audio/speech', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    const errText = await resp.text();
    // Try Google TTS via API key first (uses billing-enabled project)
    if (Deno.env.get('GOOGLE_CLOUD_TTS_API_KEY')) {
      try {
        console.warn(`OpenAI TTS failed (${resp.status}), trying Google TTS (api-key)`);
        return await generateGoogleTTSWithApiKey(text, gender);
      } catch (gErr) {
        console.warn('Google TTS api-key fallback failed:', gErr);
      }
    }
    // Then OAuth Chirp3 (requires service-account project to have billing)
    if (Deno.env.get('GOOGLE_CLOUD_SERVICE_ACCOUNT')) {
      console.warn(`OpenAI TTS failed (${resp.status}), falling back to Chirp3-HD (oauth)`);
      return await generateChirp3TTS(text, gender);
    }
    throw new Error(`OpenAI TTS failed (${resp.status}): ${errText}`);
  }
  return new Uint8Array(await resp.arrayBuffer());
}

async function uploadTTSAudio(
  supabase: any,
  audioBytes: Uint8Array,
  sceneNumber: number
): Promise<string> {
  const fileName = `tts/${Date.now()}-scene-${sceneNumber}.mp3`;
  const { error } = await supabase.storage
    .from('reels')
    .upload(fileName, audioBytes, { contentType: 'audio/mpeg', upsert: true });
  if (error) throw new Error(`TTS upload failed: ${error.message}`);
  const { data: urlData } = supabase.storage.from('reels').getPublicUrl(fileName);
  return urlData.publicUrl;
}

// UUID = Speechify voice clone id
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Invoke the shared `text-to-speech` edge function so that Reels uses the
// same routing as MovieSceneCreator: Speechify clone → Google clone → fallback.
async function generateClonedTTSViaEdge(
  text: string,
  twin: any,
  gender: string,
  authHeader: string | null,
): Promise<Uint8Array | null> {
  try {
    const url = Deno.env.get('SUPABASE_URL');
    const anon = Deno.env.get('SUPABASE_ANON_KEY') || Deno.env.get('SUPABASE_PUBLISHABLE_KEY');
    if (!url) return null;
    const key = twin?.voice_cloning_key || null;
    const speechifyVoiceId = key && UUID_RE.test(key) ? key : undefined;
    const voiceCloningKey = key && !speechifyVoiceId ? key : undefined;

    const resp = await fetch(`${url}/functions/v1/text-to-speech`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(authHeader ? { Authorization: authHeader } : {}),
        ...(anon ? { apikey: anon } : {}),
      },
      body: JSON.stringify({
        text,
        voice: speechifyVoiceId || voiceCloningKey ? 'cloned' : 'ai-auto',
        speechifyVoiceId,
        voiceCloningKey,
        gender,
      }),
    });
    if (!resp.ok) {
      console.warn(`text-to-speech edge fn returned ${resp.status}`);
      return null;
    }
    const data = await resp.json();
    const b64 = data?.audioContent;
    if (!b64) return null;
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    console.log(`Cloned TTS via edge fn (provider=${data.provider || 'unknown'}) — ${bytes.length} bytes`);
    return bytes;
  } catch (e) {
    console.warn('generateClonedTTSViaEdge failed:', e);
    return null;
  }
}

async function tryCreateTTSUrl(
  supabase: any,
  text: string,
  sceneNumber: number,
  openAiKey: string,
  gender: string,
  twin?: any,
  authHeader?: string | null,
): Promise<string | null> {
  try {
    let ttsBytes: Uint8Array | null = null;

    // PRIMARY: route through the shared TTS edge fn whenever a twin is supplied
    // (gives us Speechify/Google cloned voice — same as MovieSceneCreator)
    if (twin?.voice_cloning_key) {
      ttsBytes = await generateClonedTTSViaEdge(text, twin, gender, authHeader || null);
    }

    // FALLBACK: legacy OpenAI gpt-4o-mini-tts narrator (used when no twin clone)
    if (!ttsBytes) {
      ttsBytes = await generateOpenAITTS(
        text,
        openAiKey,
        gender,
        'Speak with confident energy, like a professional YouTube creator. Natural pace, engaging delivery.'
      );
    }

    const ttsUrl = await uploadTTSAudio(supabase, ttsBytes, sceneNumber);
    console.log(`Scene ${sceneNumber}: TTS audio uploaded: ${ttsUrl}`);
    return ttsUrl;
  } catch (error) {
    console.warn(`Scene ${sceneNumber}: TTS unavailable, continuing with silent video fallback`, error);
    return null;
  }
}

// Detect gender from character description
function detectGender(desc?: string): string {
  if (!desc) return 'male';
  const lower = desc.toLowerCase();
  if (lower.includes('woman') || lower.includes('female') || lower.includes('girl') || lower.includes('lady') || lower.includes('she ')) return 'female';
  return 'male';
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
- Hyper-realistic skin with visible pores, natural imperfections, subsurface scattering — NOT airbrushed or plastic
- Professional 3-point cinematic lighting (key light at 45°, soft fill, rim/hair light), warm natural color temperature
- Shallow depth of field, clean blurred background with bokeh
- Shot on 85mm f/1.4 lens, film-grade color grading
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
- Hyper-realistic skin texture (pores, micro-wrinkles, natural imperfections) — never plastic or CGI
- Professional cinematic lighting: key light with soft fill, rim light separation, warm natural tones
- Shallow depth of field, clean composition, shot on 85mm lens
- Vertical 9:16 format
- NO text, captions, watermarks, or written words${antiPropRule}`;
}

// Build image generation prompt text (for OpenAI DALL-E which doesn't accept reference images)
function buildImageGenPrompt(prompt: string, referenceImages?: string[]) {
  if (referenceImages && referenceImages.length > 0) {
    return `${prompt}\n\nIMPORTANT: Generate this as a hyper-realistic image matching the described character exactly. Natural skin with visible pores and imperfections. Professional cinematic lighting with 3-point setup, warm natural color grading. Shot on ARRI Alexa.`;
  }
  return prompt;
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
      sceneDuration = undefined,
      productImageUrl = null,
      productName = null,
      aiTwin = null
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
    const WAVESPEED_API_KEY = Deno.env.get('WAVESPEED_API_KEY');
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY is not configured');
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
        const fullPrompt = buildImageGenPrompt(imagePrompt, (!scene.isIntro && !scene.isOutro) ? referenceImages : undefined);
        
        // Use OpenAI gpt-image-1
        const imageResponse = await fetch('https://api.openai.com/v1/images/generations', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${OPENAI_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'gpt-image-1',
            prompt: fullPrompt,
            n: 1,
            size: '1024x1536',
            quality: 'high',
          }),
        });

        if (imageResponse.ok) {
          const imageData = await imageResponse.json();
          const b64 = imageData.data?.[0]?.b64_json;
          const imgUrl = imageData.data?.[0]?.url;
          const imageUrl = b64 ? `data:image/png;base64,${b64}` : imgUrl;
          
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
                  savedImageUrls.push(imageUrl);
                }
              } catch (uploadErr) {
                console.error('Storage upload failed:', uploadErr);
                savedImageUrls.push(imageUrl);
              }
            } else {
              savedImageUrls.push(imageUrl);
            }
          }
        } else {
          const errText = await imageResponse.text();
          console.error('OpenAI image gen failed for scene', scene.sceneNumber, ':', errText);
          sceneImages.push('');
          savedImageUrls.push('');
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
        
        // Build rich character context for prompts — includes full project context
        const charContext = characterDescription ? `Character: ${characterDescription}.` : '';
        const topicContext = `Topic: ${topic}.${productName ? ` Featured product: ${productName}.` : ''}`;
        const isProductBrollScene = !!(scene as any).isProductBroll;
        const isCTAScene = (scene as any).scenePurpose === 'cta' || (scene.isOutro && !scene.isIntro);
        const sceneStartFrame = (scene as any).startFrame || '';
        const sceneEndFrame = (scene as any).endFrame || '';
        
        // ====== SCENE TYPE ROUTING ======
        // Product B-roll scenes get special treatment — use product image directly
        // CTA scenes get close-up framing instructions
        // When VEO3 is selected, ALL scene types use VEO3 — no mixing models.
        // Otherwise route based on scene type and other settings.
        
        const isNarratorScene = !scene.isIntro && !scene.isOutro && !scene.isSilentCTA && scene.narration?.trim();
        
        // ====== PRODUCT B-ROLL: Dedicated product-only scene ======
        if (isProductBrollScene && productImageUrl) {
          console.log(`Scene ${scene.sceneNumber}: Product B-roll scene — using product image for cinematic rotation`);
          
          // Use Sora-2 or Kling for cinematic product rotation from product image
          const productModel = videoModel === 'veo3' ? 'veo3' : 'sora-2';
          
          if (productModel === 'veo3') {
            apiEndpoint = 'https://api.wavespeed.ai/api/v3/google/veo3/image-to-video';
            requestBody = {
              image: productImageUrl,
              prompt: `Cinematic product showcase. ${productName ? `The product "${productName}" ` : 'A premium product '}sits on a clean, elegant surface — marble countertop with soft warm side lighting. 
Slow 180-degree orbit around the product with shallow depth of field. Rack focus from background to product label. 
Warm directional key light catching the packaging details, soft ambient fill. Premium commercial quality.
Atmospheric ambient sound only. No speech, no text, no captions, no watermarks.
${topicContext}`,
              generate_audio: true,
              aspect_ratio: '9:16',
              duration: 4,
              resolution: '720p'
            };
            sceneHasEmbeddedAudio = true;
          } else {
            apiEndpoint = 'https://api.wavespeed.ai/api/v3/openai/sora-2/image-to-video';
            requestBody = {
              image: productImageUrl,
              prompt: `Cinematic product showcase. ${productName ? `"${productName}" ` : 'Premium product '}on a clean surface — marble or wood with warm lighting.
Slow orbit rotation around the product, shallow depth of field, rack focus catching the label.
Warm directional key light, premium commercial B-roll quality. Elegant and aspirational.
No text, no captions, no watermarks. Pure visual product hero shot.
${topicContext}`,
              duration: 4,
              aspect_ratio: '9:16'
            };
            sceneHasEmbeddedAudio = true;
          }
          
        } else if (videoModel === 'veo3') {
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
          } else if (scene.isOutro || isCTAScene) {
            veo3Prompt = `CLOSE-UP SHOT of person looking directly at camera. ${veo3CharContext}
Tight framing — face fills most of the frame, eyes locked on viewer, warm confident smile. 
Slow subtle push-in creating intimacy. Warm golden lighting, shallow depth of field.
${productImageUrl && productName ? `The product "${productName}" is visible on a surface nearby or held casually in one hand.` : ''}
Film-grade quality. This is the CTA — the viewer should feel personally spoken to.
${scene.narration ? `The person clearly says this exact closing line with visible lip movement and synchronized speech: "${scene.narration}". Generate clear spoken voice audio.` : 'Warm ambient closing audio only.'}
No text, no captions, no subtitles, no watermarks.`;
          } else {
            // Add close-up instruction for scenes marked as close-up
            const isCloseUp = scene.cameraAngle?.toLowerCase().includes('extreme close-up') || scene.cameraAngle?.toLowerCase().includes('intimate');
            const closeUpNote = isCloseUp ? `CAMERA: Tight close-up on face — eyes + mouth fill the frame. Intimate, emphatic framing like a cinematic zoom-in moment.` : '';
            const frameContext = sceneStartFrame ? `START FRAME: ${sceneStartFrame}. ` : '';
            const endContext = sceneEndFrame ? `END FRAME: ${sceneEndFrame}. ` : '';
            
            veo3Prompt = `${scene.visualDescription}. ${veo3CharContext} ${topicContext}
${closeUpNote}
${frameContext}${endContext}
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
          
        } else if (videoModel === 'sora-2' && isNarratorScene) {
          // ====== SORA-2 NARRATOR: OpenAI TTS + InfiniteTalk HD for clear speech ======
          console.log(`Scene ${scene.sceneNumber}: Sora-2 narrator → OpenAI TTS + InfiniteTalk HD`);
          
          if (!supabase) throw new Error('Supabase client required for TTS upload');
          
          const gender = detectGender(characterDescription);
          const ttsUrl = await tryCreateTTSUrl(supabase, scene.narration, scene.sceneNumber, OPENAI_API_KEY!, gender, aiTwin, authHeader);

          if (ttsUrl) {
            apiEndpoint = 'https://api.wavespeed.ai/api/v3/wavespeed-ai/infinitetalk';
            requestBody = {
              image: imageUrl,
              audio: ttsUrl,
              resolution: '720p'
            };
            sceneHasEmbeddedAudio = true;
          } else {
            const sora2Durations = [4, 8, 12, 16, 20];
            const sora2Duration = sora2Durations.reduce((best, d) => Math.abs(d - clipDuration) < Math.abs(best - clipDuration) ? d : best, 8);
            apiEndpoint = 'https://api.wavespeed.ai/api/v3/openai/sora-2/image-to-video';
            requestBody = {
              image: imageUrl,
              prompt: `${scene.visualDescription}. ${charContext} ${topicContext}
Context: This scene represents the caption/narration: "${scene.narration}"
Cinematic motion, natural confident expression, direct-to-camera energy, professional color grading.
Atmospheric ambient audio only. No speech. No text, no captions, no subtitles, no watermarks.`,
              duration: sora2Duration,
              aspect_ratio: '9:16'
            };
            sceneHasEmbeddedAudio = false;
          }
          
        } else if (videoModel === 'sora-2') {
          // ====== SORA-2: Intro/Outro/B-roll scenes (non-narrator) ======
          const sceneType = scene.isIntro ? 'intro' : scene.isOutro ? 'outro' : 'b-roll';
          console.log(`Scene ${scene.sceneNumber}: Using Sora-2 for ${sceneType} scene (native audio)`);
          
          apiEndpoint = 'https://api.wavespeed.ai/api/v3/openai/sora-2/image-to-video';
          
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
Atmospheric ambient audio only.
No text, no captions, no subtitles, no watermarks.`;
          } else if (scene.isOutro || isCTAScene) {
            sora2Prompt = `${sora2CharContext} CLOSE-UP of person looking directly at camera for CTA. Reel about "${topic}".
Tight framing on face, eyes locked on viewer, warm confident smile. Slow subtle push-in.
${productImageUrl && productName ? `Product "${productName}" visible nearby.` : ''}
Warm golden lighting, shallow depth of field, confident closing energy.
Film-grade quality. No text, no captions, no watermarks.`;
          } else {
            const isCloseUp = scene.cameraAngle?.toLowerCase().includes('extreme close-up') || scene.cameraAngle?.toLowerCase().includes('intimate');
            const closeUpNote = isCloseUp ? 'CAMERA: Tight close-up on face — eyes + mouth fill the frame, intimate emphatic framing.' : '';
            sora2Prompt = `${scene.visualDescription}. ${sora2CharContext} ${topicContext}
${closeUpNote}
Camera: smooth cinematic motion, subtle depth shifts, professional color grading. Photorealistic, high-end commercial quality.
Atmospheric ambient audio. No speech. No text, no captions, no subtitles, no watermarks.`;
          }
          
          requestBody = {
            image: imageUrl,
            prompt: sora2Prompt,
            duration: sora2Duration,
            aspect_ratio: '9:16'
          };
          sceneHasEmbeddedAudio = true;
          
        } else if (isNarratorScene && enableLipSync && (videoModel === 'infinitetalk' || lipSyncModel === 'infinitetalk')) {
          // ====== INFINITETALK: OpenAI TTS + InfiniteTalk HD ======
          console.log(`Scene ${scene.sceneNumber}: InfiniteTalk — generating OpenAI TTS first`);
          
          if (!supabase) throw new Error('Supabase client required for TTS upload');
          
          const gender = detectGender(characterDescription);
          const ttsUrl = await tryCreateTTSUrl(supabase, scene.narration, scene.sceneNumber, OPENAI_API_KEY!, gender, aiTwin, authHeader);

          if (ttsUrl) {
            apiEndpoint = 'https://api.wavespeed.ai/api/v3/wavespeed-ai/infinitetalk';
            requestBody = {
              image: imageUrl,
              audio: ttsUrl,
              resolution: '720p'
            };
            sceneHasEmbeddedAudio = true;
          } else {
            apiEndpoint = 'https://api.wavespeed.ai/api/v3/wavespeed-ai/wan-2.1-i2v-480p';
            requestBody = {
              image: imageUrl,
              prompt: `${scene.visualDescription}. ${charContext} ${topicContext}
Context: This scene represents the caption/narration: "${scene.narration}"
Natural expression, confident direct-to-camera delivery, cinematic lighting. No text, captions, subtitles, or watermarks.`
            };
            sceneHasEmbeddedAudio = false;
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
            const superPromptContent = `You are Loop AI, a cinematic video director. Create a concise, vivid video-extend prompt (max 2 sentences) that describes the MOTION and CAMERA MOVEMENT for extending a video clip of a ${genderHint} speaker.

Scene context: "${scene.narration}"
Character: ${characterDescription || 'Professional speaker'}
Topic: ${topic}

Rules:
- Describe only motion, expression, and camera — NOT the scene setup (we already have the base video)
- Focus on: subtle camera drift, natural gestures, facial micro-expressions, confident delivery
- Do NOT mention text, captions, watermarks
- Keep it under 50 words
- Write only the prompt, no explanation`;

            // Use OpenAI GPT-4o for super prompt generation
            const superPromptResponse = await fetch('https://api.openai.com/v1/chat/completions', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${OPENAI_API_KEY}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                model: 'gpt-4o',
                messages: [{ role: 'user', content: superPromptContent }],
                max_tokens: 200,
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
${isCTAScene ? 'CLOSE-UP: Tight framing on face, eyes locked on viewer, confident warm expression.' : ''}
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
          
        } else if (scene.isOutro || isCTAScene) {
          // ====== SORA 2: CTA/Outro scene — CLOSE-UP ======
          console.log(`Scene ${scene.sceneNumber}: Using Sora 2 for CTA/outro (close-up)`);
          
          apiEndpoint = 'https://api.wavespeed.ai/api/v3/openai/sora-2/image-to-video';
          const sora2Durations = [4, 8, 12, 16, 20];
          const sora2Duration = sora2Durations.reduce((best, d) => Math.abs(d - clipDuration) < Math.abs(best - clipDuration) ? d : best, 4);
          
          const outroCharDesc = characterDescription 
            ? `CLOSE-UP of ${characterDescription} looking directly at camera.` 
            : 'CLOSE-UP of person looking directly at camera.';
          const outroNarration = scene.narration ? `Scene conveys: "${scene.narration}"` : '';
          
          requestBody = {
            image: imageUrl,
            prompt: `${outroCharDesc} CTA for reel about "${topic}".
${outroNarration}
Tight framing on face — eyes locked on viewer, warm confident knowing smile. Slow subtle push-in creating intimacy.
${productImageUrl && productName ? `Product "${productName}" visible on surface nearby.` : ''}
Warm golden lighting, shallow depth of field. Film-grade quality.
No text, no captions, no subtitles, no watermarks.`,
            duration: sora2Duration,
            aspect_ratio: '9:16'
          };
          sceneHasEmbeddedAudio = true;
          
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