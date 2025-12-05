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
  audioDuration?: number; // Actual voiceover duration - takes precedence
  isIntro?: boolean;
  isOutro?: boolean;
  templateId?: string;
}

// Helper to convert base64 to Uint8Array
function base64ToUint8Array(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

// Generate special prompt for intro/outro templates - NO TEXT in images to avoid spelling errors
function getTemplateImagePrompt(scene: Scene, topic: string): string {
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
    const { scenes, topic, addCaptions = true, useWaveSpeed = true } = await req.json();

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
    
    for (const scene of scenes as Scene[]) {
      console.log('Generating image for scene:', scene.sceneNumber, 'isIntro:', scene.isIntro, 'isOutro:', scene.isOutro);
      
      try {
        const imagePrompt = getTemplateImagePrompt(scene, topic);
        
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
    const videoTasks: { sceneNumber: number; taskId: string }[] = [];
    
    if (useWaveSpeed && WAVESPEED_API_KEY && finalImageUrls.length > 0) {
      console.log('Starting WaveSpeed video generation for', finalImageUrls.length, 'scenes');
      
      for (let i = 0; i < finalImageUrls.length; i++) {
        const scene = (scenes as Scene[])[i];
        const imageUrl = finalImageUrls[i];
        
        // Create motion prompt - simpler for intro/outro
        let motionPrompt = `${scene.visualDescription}. Dynamic motion, cinematic, engaging social media style.`;
        if (scene.isIntro) {
          motionPrompt = 'Subtle zoom in animation, text reveal effect, attention-grabbing intro motion.';
        } else if (scene.isOutro) {
          motionPrompt = 'Gentle zoom out or pulse effect, engaging call-to-action animation.';
        }
        
        try {
          // Use actual audio duration if provided, otherwise fall back to scene duration
          // WaveSpeed max duration is 8s per clip, so we may need multiple clips for longer audio
          const targetDuration = scene.audioDuration || scene.duration;
          const clipDuration = Math.min(targetDuration, 8);
          
          console.log(`Scene ${scene.sceneNumber}: target duration ${targetDuration}s, clip duration ${clipDuration}s`);
          
          // Use WaveSpeed image-to-video API
          const videoResponse = await fetch('https://api.wavespeed.ai/api/v3/alibaba/wan-2.5/image-to-video', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${WAVESPEED_API_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              image: imageUrl,
              prompt: motionPrompt,
              resolution: "480p",
              duration: clipDuration
            }),
          });

          if (videoResponse.ok) {
            const videoData = await videoResponse.json();
            console.log('WaveSpeed task created for scene', scene.sceneNumber, ':', videoData);
            
            if (videoData.code === 200 && videoData.data?.id) {
              videoTasks.push({
                sceneNumber: scene.sceneNumber,
                taskId: videoData.data.id
              });
            }
          } else {
            const errorText = await videoResponse.text();
            console.error('WaveSpeed error for scene', scene.sceneNumber, ':', errorText);
          }
        } catch (videoError) {
          console.error('Video generation error for scene:', scene.sceneNumber, videoError);
        }
      }
    }

    const result = {
      videoUrl: null,
      scenes: captionsData,
      sceneImages: finalImageUrls,
      videoTasks, // Include task IDs for polling
      captions: addCaptions ? captionsData.map(c => ({
        text: c.text,
        start: c.startTime,
        end: c.endTime
      })) : [],
      totalDuration,
      useWaveSpeed: videoTasks.length > 0
    };

    console.log('Reel generation complete with', videoTasks.length, 'video tasks');

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
