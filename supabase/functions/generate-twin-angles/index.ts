import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const CAMERA_ANGLES = [
  {
    name: 'Front Portrait',
    prompt: 'front-facing portrait, direct eye contact with camera, centered composition, 85mm lens f/1.4',
  },
  {
    name: '3/4 Profile',
    prompt: 'three-quarter profile view, slight turn to the right, confident pose, 50mm lens f/2.0',
  },
  {
    name: 'Side Profile',
    prompt: 'elegant side profile view, clean silhouette, dramatic rim lighting, 85mm lens f/1.8',
  },
  {
    name: 'Low Angle Hero',
    prompt: 'slightly low angle looking up, powerful heroic framing, wide shoulders visible, 35mm lens f/2.8',
  },
];

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { twinId, faceDescription, gender, name, referenceImageUrl } = await req.json();

    if (!twinId || !faceDescription) {
      return new Response(
        JSON.stringify({ error: 'twinId and faceDescription are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY not configured');

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) throw new Error('Supabase not configured');

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const generatedUrls: string[] = [];

    for (let i = 0; i < CAMERA_ANGLES.length; i++) {
      const angle = CAMERA_ANGLES[i];

      const prompt = `Generate a PREMIUM cinematic portrait photograph of this EXACT person.

CHARACTER (match precisely): ${faceDescription}
GENDER: ${gender || 'unspecified'}
NAME: ${name || 'Character'}

CAMERA ANGLE: ${angle.prompt}

CINEMATOGRAPHY:
- Shot on RED V-RAPTOR, ${angle.prompt}
- Professional 3-point studio lighting: soft key light at 45°, subtle fill, dramatic rim/hair light
- Rich bokeh background, shallow depth of field
- Professional color grading: warm skin tones, rich contrast

REQUIREMENTS:
- EXACT same person in every image - identical face, features, skin tone, hair
- ${gender === 'female' ? 'She' : gender === 'male' ? 'He' : 'They'} should have a natural, confident expression
- Closed mouth or slight smile - NOT speaking
- Clean, professional background with depth
- Ultra photorealistic, magazine-quality, 8K detail
- Vertical 9:16 aspect ratio for social media

CRITICAL: NO text, NO captions, NO watermarks, NO written words anywhere in the image.`;

      // Build messages - include reference image if available for consistency
      const messages: any[] = [];
      if (referenceImageUrl) {
        messages.push({
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: { url: referenceImageUrl }
            },
            {
              type: 'text',
              text: `This is the reference photo of the person. Generate a NEW image of this EXACT same person from a different camera angle.\n\n${prompt}`
            }
          ]
        });
      } else {
        messages.push({ role: 'user', content: prompt });
      }

      console.log(`Generating angle ${i + 1}/${CAMERA_ANGLES.length}: ${angle.name}`);

      try {
        const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${LOVABLE_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'google/gemini-3.1-flash-image-preview',
            messages,
            modalities: ['image', 'text']
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
        const imageUrl = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;

        if (imageUrl) {
          // Upload to storage
          let finalUrl = imageUrl;
          if (imageUrl.startsWith('data:')) {
            const matches = imageUrl.match(/^data:([^;]+);base64,(.+)$/);
            if (matches) {
              const mimeType = matches[1];
              const base64Data = matches[2];
              const ext = mimeType.split('/')[1] || 'png';

              const binaryString = atob(base64Data);
              const bytes = new Uint8Array(binaryString.length);
              for (let j = 0; j < binaryString.length; j++) {
                bytes[j] = binaryString.charCodeAt(j);
              }

              const fileName = `twin-angles/${twinId}/${Date.now()}-${angle.name.toLowerCase().replace(/\s+/g, '-')}.${ext}`;
              const { data: uploadData, error: uploadError } = await supabase.storage
                .from('reels')
                .upload(fileName, bytes, { contentType: mimeType, upsert: true });

              if (!uploadError && uploadData) {
                const { data: publicUrl } = supabase.storage.from('reels').getPublicUrl(fileName);
                finalUrl = publicUrl.publicUrl;
              }
            }
          }

          generatedUrls.push(finalUrl);
          console.log(`Generated angle ${angle.name}: ${finalUrl.substring(0, 60)}...`);
        }
      } catch (genErr) {
        console.error(`Failed to generate angle ${angle.name}:`, genErr);
      }
    }

    // Update the twin's reference_images with generated angles appended
    if (generatedUrls.length > 0) {
      // Fetch current twin to get existing images
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
