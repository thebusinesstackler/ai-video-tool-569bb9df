import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Authorization required');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get the user from the auth header
    const anonClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!);
    const { data: { user }, error: authError } = await anonClient.auth.getUser(
      authHeader.replace('Bearer ', '')
    );
    
    if (authError || !user) {
      throw new Error('Invalid authentication');
    }

    const body = await req.json();
    const { twinId } = body;

    console.log('Starting AI Twin image migration for user:', user.id, 'twin:', twinId);

    // Fetch the twin's reference images
    const { data: twin, error: fetchError } = await supabase
      .from('ai_twins')
      .select('id, name, reference_images')
      .eq('id', twinId)
      .eq('user_id', user.id)
      .single();

    if (fetchError || !twin) {
      throw new Error('AI Twin not found');
    }

    const referenceImages = twin.reference_images || [];
    let migratedCount = 0;
    let alreadyUrlCount = 0;
    const updatedImages: string[] = [];
    const errors: string[] = [];

    console.log(`Found ${referenceImages.length} reference images for twin ${twin.name}`);

    for (let i = 0; i < referenceImages.length; i++) {
      const imageUrl = referenceImages[i];
      
      // Check if it's already a URL (not base64)
      if (!imageUrl.startsWith('data:')) {
        updatedImages.push(imageUrl);
        alreadyUrlCount++;
        continue;
      }

      try {
        // Parse the base64 URL
        const matches = imageUrl.match(/^data:([^;]+);base64,(.+)$/);
        if (!matches) {
          console.warn(`Invalid base64 format for image ${i}`);
          errors.push(`Image ${i}: Invalid base64 format`);
          updatedImages.push(imageUrl); // Keep original
          continue;
        }

        const mimeType = matches[1];
        const base64Data = matches[2];
        const extension = mimeType.split('/')[1] || 'png';

        // Convert to binary
        const binaryString = atob(base64Data);
        const bytes = new Uint8Array(binaryString.length);
        for (let j = 0; j < binaryString.length; j++) {
          bytes[j] = binaryString.charCodeAt(j);
        }

        // Upload to storage
        const fileName = `${user.id}/twin-images/${twinId}/${Date.now()}-${i}.${extension}`;
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('reels')
          .upload(fileName, bytes, { contentType: mimeType });

        if (uploadError) {
          console.error(`Upload failed for image ${i}:`, uploadError);
          errors.push(`Image ${i}: Upload failed - ${uploadError.message}`);
          updatedImages.push(imageUrl); // Keep original
          continue;
        }

        // Get public URL
        const { data: publicUrl } = supabase.storage.from('reels').getPublicUrl(fileName);
        updatedImages.push(publicUrl.publicUrl);
        migratedCount++;
        console.log(`Migrated image ${i} to ${publicUrl.publicUrl}`);
      } catch (err) {
        console.error(`Error processing image ${i}:`, err);
        errors.push(`Image ${i}: ${err instanceof Error ? err.message : 'Unknown error'}`);
        updatedImages.push(imageUrl); // Keep original
      }
    }

    // Update the database with migrated URLs
    if (migratedCount > 0) {
      const { error: updateError } = await supabase
        .from('ai_twins')
        .update({ reference_images: updatedImages })
        .eq('id', twinId);

      if (updateError) {
        throw new Error(`Database update failed: ${updateError.message}`);
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        message: `Migrated ${migratedCount} images, ${alreadyUrlCount} already URLs`,
        migrated: migratedCount,
        alreadyUrls: alreadyUrlCount,
        total: referenceImages.length,
        errors: errors.length,
        errorDetails: errors.length > 0 ? errors : undefined
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Migration error:', error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error instanceof Error ? error.message : 'Migration failed' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
