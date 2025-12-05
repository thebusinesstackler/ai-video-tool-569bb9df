import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Scene {
  sceneNumber: number;
  narration: string;
  visualDescription: string;
  duration: number;
}

interface Voiceover {
  sceneNumber: number;
  audioUrl: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { scenes, voiceovers, topic, addCaptions = true } = await req.json();

    if (!scenes || !Array.isArray(scenes) || scenes.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Scenes are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Generating reel video for topic:', topic);
    console.log('Scenes:', scenes.length);
    console.log('Add captions:', addCaptions);

    const WAVESPEED_API_KEY = Deno.env.get('WAVESPEED_API_KEY');
    
    // For now, we'll generate scene images and return a combined result
    // In a full implementation, this would use a video generation API
    
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    // Generate images for each scene using AI
    const sceneImages: string[] = [];
    
    for (const scene of scenes as Scene[]) {
      console.log('Generating image for scene:', scene.sceneNumber);
      
      try {
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
                content: `Generate a vibrant, eye-catching image for a social media reel. 
                Scene: ${scene.visualDescription}
                Topic: ${topic}
                Style: Modern, engaging, vertical format (9:16 aspect ratio), suitable for Instagram/TikTok.
                The image should be visually striking and attention-grabbing.`
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
          }
        }
      } catch (imgError) {
        console.error('Image generation error for scene:', scene.sceneNumber, imgError);
      }
    }

    // Build caption data for each scene
    const captionsData = (scenes as Scene[]).map((scene, index) => ({
      sceneNumber: scene.sceneNumber,
      text: scene.narration,
      startTime: (scenes as Scene[]).slice(0, index).reduce((acc, s) => acc + s.duration, 0),
      endTime: (scenes as Scene[]).slice(0, index + 1).reduce((acc, s) => acc + s.duration, 0),
      imageUrl: sceneImages[index] || null
    }));

    // For now, return the generated content
    // In production, this would combine into an actual video file
    const result: {
      videoUrl: string | null;
      scenes: typeof captionsData;
      sceneImages: string[];
      captions: { text: string; start: number; end: number }[];
      message: string;
      totalDuration: number;
    } = {
      videoUrl: null, // Would be actual video URL after processing
      scenes: captionsData,
      sceneImages,
      captions: addCaptions ? captionsData.map(c => ({
        text: c.text,
        start: c.startTime,
        end: c.endTime
      })) : [],
      message: 'Video generation requires additional processing. Scene images and captions are ready.',
      totalDuration: (scenes as Scene[]).reduce((acc, s) => acc + s.duration, 0)
    };

    // If we have WaveSpeed API, attempt actual video generation
    if (WAVESPEED_API_KEY && sceneImages.length > 0) {
      try {
        // Generate video from first scene image as a demo
        const videoResponse = await fetch('https://api.wavespeed.ai/api/v3/text2video', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${WAVESPEED_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            prompt: `${topic}. ${(scenes as Scene[]).map(s => s.visualDescription).join('. ')}`,
            aspect_ratio: '9:16',
            duration: Math.min((scenes as Scene[]).reduce((acc, s) => acc + s.duration, 0), 10),
          }),
        });

        if (videoResponse.ok) {
          const videoData = await videoResponse.json();
          if (videoData.data?.task_id) {
            result.videoUrl = `pending:${videoData.data.task_id}`;
          }
        }
      } catch (videoError) {
        console.error('Video generation error:', videoError);
      }
    }

    console.log('Reel generation complete');

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
