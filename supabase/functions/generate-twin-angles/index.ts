import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const CAMERA_ANGLES = [
  { name: 'Front Portrait', prompt: 'front-facing portrait, direct eye contact with camera, centered composition, 85mm lens f/1.4' },
  { name: '3/4 Profile', prompt: 'three-quarter profile view, slight turn to the right, confident pose, 50mm lens f/2.0' },
  { name: 'Side Profile', prompt: 'elegant side profile view, clean silhouette, dramatic rim lighting, 85mm lens f/1.8' },
  { name: 'Low Angle Hero', prompt: 'slightly low angle looking up, powerful heroic framing, wide shoulders visible, 35mm lens f/2.8' },
];

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { twinId, faceDescription, gender, name, shirtLogoUrl } = await req.json();

    if (!twinId || !faceDescription) {
      return new Response(
        JSON.stringify({ error: 'twinId and faceDescription are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    if (!OPENAI_API_KEY) throw new Error('OPENAI_API_KEY not configured');

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) throw new Error('Supabase not configured');

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const generatedUrls: string[] = [];

    for (let i = 0; i < CAMERA_ANGLES.length; i++) {
      const angle = CAMERA_ANGLES[i];

      const logoInstruction = shirtLogoUrl
        ? `\nCLOTHING: The person is wearing a casual t-shirt or polo shirt with a clearly visible company/brand logo printed or embroidered prominently on the chest area. The logo should be realistic and naturally integrated into the fabric.`
        : '';

      const prompt = `Generate a PREMIUM cinematic portrait photograph.

CHARACTER (match precisely): ${faceDescription}
GENDER: ${gender || 'unspecified'}
NAME: ${name || 'Character'}
${logoInstruction}

CAMERA ANGLE: ${angle.prompt}

CINEMATOGRAPHY:
- Shot on RED V-RAPTOR, ${angle.prompt}
- Professional 3-point studio lighting: soft key light at 45°, subtle fill, dramatic rim/hair light
- Rich bokeh background, shallow depth of field
- Professional color grading: warm skin tones, rich contrast

REQUIREMENTS:
- EXACT same person in every image - identical face, features, skin tone, hair
- ${gender === 'female' ? 'She' : gender === 'male' ? 'He' : 'They'} should have a natural, confident expression
- Clean, professional background with depth
- Ultra photorealistic, magazine-quality, 8K detail
- Vertical 9:16 aspect ratio for social media
- NO text, NO captions, NO watermarks`;

      console.log(`Generating angle ${i + 1}/${CAMERA_ANGLES.length}: ${angle.name}`);

      try {
        const response = await fetch('https://api.openai.com/v1/images/generations', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${OPENAI_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'gpt-image-1',
            prompt,
            n: 1,
            size: '1024x1536',
            quality: 'high',
          }),
        });

        if (!response.ok) {
          const errText = await response.text();
          console.error(`Image gen error for angle ${angle.name}:`, response.status, errText);
          if (response.status === 429) {
            return new Response(
              JSON.stringify({ error: 'Rate limit exceeded. Please try again in a moment.', generatedUrls }),
              { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
          continue;
        }

        const data = await response.json();
        const b64 = data.data?.[0]?.b64_json;
        const imageUrl = b64 ? `data:image/png;base64,${b64}` : data.data?.[0]?.url;

        if (imageUrl) {
          let finalUrl = imageUrl;
          // Upload base64 to storage
          if (imageUrl.startsWith('data:')) {
            const base64Data = imageUrl.replace(/^data:image\/\w+;base64,/, '');
            const bytes = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
            const fileName = `twin-angles/${twinId}/${Date.now()}-${angle.name.toLowerCase().replace(/\s+/g, '-')}.png`;

            const { data: uploadData, error: uploadError } = await supabase.storage
              .from('reels')
              .upload(fileName, bytes, { contentType: 'image/png', upsert: true });

            if (!uploadError && uploadData) {
              const { data: publicUrl } = supabase.storage.from('reels').getPublicUrl(fileName);
              finalUrl = publicUrl.publicUrl;
            }
          }

          generatedUrls.push(finalUrl);
          console.log(`Generated angle ${angle.name}: ${finalUrl.substring(0, 60)}...`);
        }
      } catch (genErr) {
        console.error(`Failed to generate angle ${angle.name}:`, genErr);
      }
    }

    // Update twin's reference_images
    if (generatedUrls.length > 0) {
      const { data: twin } = await supabase
        .from('ai_twins')
        .select('reference_images')
        .eq('id', twinId)
        .single();

      const existingImages = twin?.reference_images || [];
      const allImages = [...existingImages, ...generatedUrls];

      const { error: updateError } = await supabase
        .from('ai_twins')
        .update({ reference_images: allImages })
        .eq('id', twinId);

      if (updateError) {
        console.error('Failed to update twin images:', updateError);
      } else {
        console.log(`Updated twin ${twinId} with ${generatedUrls.length} new angle images`);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        generatedUrls,
        angleCount: generatedUrls.length,
        angles: CAMERA_ANGLES.map(a => a.name)
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Generate twin angles error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
