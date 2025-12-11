import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
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

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      console.error('LOVABLE_API_KEY is not configured');
      return new Response(
        JSON.stringify({ error: 'API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Upscaling image with mode: ${mode}`);
    console.log(`Image URL: ${imageUrl.substring(0, 100)}...`);

    // Build the prompt based on mode
    let prompt = '';
    switch (mode) {
      case '2x':
        prompt = 'Upscale this image to 2x resolution. Enhance details, sharpen edges, and improve overall quality while maintaining the original style and composition. Make it crisp and high-definition.';
        break;
      case '4x':
        prompt = 'Upscale this image to 4x resolution. Significantly enhance details, add fine texture details, sharpen all edges, and dramatically improve quality. Make it extremely high-definition and professional quality.';
        break;
      case 'enhance':
      default:
        prompt = 'Enhance this image: improve colors, contrast, sharpness, and overall visual quality. Fix any artifacts, improve lighting, and make it look more professional and polished while preserving the original content.';
        break;
    }

    // Call Lovable AI with image editing capability
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
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
            content: [
              { type: 'text', text: prompt },
              { type: 'image_url', image_url: { url: imageUrl } }
            ]
          }
        ],
        modalities: ['image', 'text']
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI gateway error:', response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: 'AI credits exhausted. Please add credits to continue.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      return new Response(
        JSON.stringify({ error: 'Failed to upscale image' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    console.log('AI response received');

    // Extract the upscaled image
    const upscaledImageUrl = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;
    
    if (!upscaledImageUrl) {
      console.error('No image in response:', JSON.stringify(data).substring(0, 500));
      return new Response(
        JSON.stringify({ error: 'No upscaled image returned from AI' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Upload the base64 image to Supabase storage
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Convert base64 to blob
    const base64Data = upscaledImageUrl.replace(/^data:image\/\w+;base64,/, '');
    const imageBytes = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
    
    // Determine file extension from base64 header
    const mimeMatch = upscaledImageUrl.match(/^data:(image\/\w+);base64,/);
    const mimeType = mimeMatch ? mimeMatch[1] : 'image/png';
    const extension = mimeType.split('/')[1] || 'png';
    
    const fileName = `upscaled/${Date.now()}-${mode}.${extension}`;
    
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('reels')
      .upload(fileName, imageBytes, {
        contentType: mimeType,
        upsert: false
      });

    if (uploadError) {
      console.error('Upload error:', uploadError);
      // Return base64 as fallback
      return new Response(
        JSON.stringify({ 
          upscaledImageUrl: upscaledImageUrl,
          mode,
          message: 'Image upscaled (base64 - storage upload failed)'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get public URL
    const { data: publicUrlData } = supabase.storage
      .from('reels')
      .getPublicUrl(fileName);

    console.log('Upscaled image saved to storage:', publicUrlData.publicUrl);

    return new Response(
      JSON.stringify({ 
        upscaledImageUrl: publicUrlData.publicUrl,
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
