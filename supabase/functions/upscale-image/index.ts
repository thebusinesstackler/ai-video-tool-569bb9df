import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { imageUrl, mode = 'enhance' } = await req.json();

    if (!imageUrl) {
      return new Response(
        JSON.stringify({ error: 'Image URL is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (imageUrl.startsWith('data:') && imageUrl.length > 10_000_000) {
      return new Response(
        JSON.stringify({ error: 'Image too large. Maximum size is ~7.5MB.' }),
        { status: 413, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    if (!OPENAI_API_KEY) {
      return new Response(
        JSON.stringify({ error: 'OpenAI API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Upscaling image with mode: ${mode}`);

    let prompt = '';
    switch (mode) {
      case '2x':
        prompt = 'Create an ultra high-resolution, extremely detailed version of this scene. Upscale to 2x resolution with enhanced sharpness, fine texture details, crisp edges, and improved color vibrancy. Maintain the exact same composition, subjects, and style. Professional photography quality with 8K detail.';
        break;
      case '4x':
        prompt = 'Create a maximum resolution, incredibly detailed version of this scene. Upscale to 4x resolution with extraordinary detail enhancement — add fine texture details, ultra-sharp edges, professional color grading, and dramatic quality improvement. Maintain exact composition. Magazine cover quality, 16K detail level.';
        break;
      case 'enhance':
      default:
        prompt = 'Enhance this image: dramatically improve colors, contrast, sharpness, and overall visual quality. Fix any artifacts, improve lighting balance, and make it look polished and professional. Cinematic color grading, crisp details. Maintain the original content exactly.';
        break;
    }

    // Use OpenAI gpt-image-1 for enhancement
    const response = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-image-1',
        prompt: `${prompt}\n\nOriginal image description context: Enhance/upscale this existing image while preserving all content exactly.`,
        n: 1,
        size: mode === '4x' ? '1536x1024' : '1024x1024',
        quality: 'high',
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI error:', response.status, errorText);

      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (response.status === 401 || response.status === 402) {
        return new Response(
          JSON.stringify({ error: 'OpenAI API key invalid or credits exhausted.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ error: 'Failed to upscale image' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    const b64 = data.data?.[0]?.b64_json;
    const generatedUrl = data.data?.[0]?.url;

    const upscaledImageUrl = b64 ? `data:image/png;base64,${b64}` : generatedUrl;

    if (!upscaledImageUrl) {
      return new Response(
        JSON.stringify({ error: 'No upscaled image returned from AI' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Upload to Supabase storage if base64
    if (upscaledImageUrl.startsWith('data:')) {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabase = createClient(supabaseUrl, supabaseServiceKey);

      const base64Data = upscaledImageUrl.replace(/^data:image\/\w+;base64,/, '');
      const imageBytes = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
      const fileName = `upscaled/${Date.now()}-${mode}.png`;

      const { error: uploadError } = await supabase.storage
        .from('reels')
        .upload(fileName, imageBytes, { contentType: 'image/png', upsert: false });

      if (!uploadError) {
        const { data: publicUrlData } = supabase.storage.from('reels').getPublicUrl(fileName);
        console.log('Upscaled image saved to storage:', publicUrlData.publicUrl);
        return new Response(
          JSON.stringify({
            upscaledImageUrl: publicUrlData.publicUrl,
            mode,
            message: `Image ${mode === 'enhance' ? 'enhanced' : `upscaled ${mode}`} successfully`
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.error('Upload error:', uploadError);
    }

    return new Response(
      JSON.stringify({
        upscaledImageUrl,
        mode,
        message: `Image ${mode === 'enhance' ? 'enhanced' : `upscaled ${mode}`} successfully`
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Error in upscale-image function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
