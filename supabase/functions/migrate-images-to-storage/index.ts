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

    console.log('Starting image migration for user:', user.id);

    // Fetch all images for this user that have base64 URLs
    const { data: images, error: fetchError } = await supabase
      .from('generated_images')
      .select('id, image_url, scene_number')
      .eq('user_id', user.id)
      .like('image_url', 'data:%');

    if (fetchError) {
      throw fetchError;
    }

    if (!images || images.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No base64 images to migrate',
          migrated: 0 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found ${images.length} base64 images to migrate`);

    let migratedCount = 0;
    let errorCount = 0;
    const errors: string[] = [];

    for (const image of images) {
      try {
        // Parse the base64 URL
        const matches = image.image_url.match(/^data:([^;]+);base64,(.+)$/);
        if (!matches) {
          console.warn(`Invalid base64 format for image ${image.id}`);
          errorCount++;
          errors.push(`Image ${image.id}: Invalid base64 format`);
          continue;
        }

        const mimeType = matches[1];
        const base64Data = matches[2];
        const extension = mimeType.split('/')[1] || 'png';

        // Convert to binary
        const binaryString = atob(base64Data);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }

        // Upload to storage
        const fileName = `${user.id}/migrated/${Date.now()}-${image.id.slice(0, 8)}.${extension}`;
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('reels')
          .upload(fileName, bytes, { contentType: mimeType });

        if (uploadError) {
          console.error(`Upload failed for image ${image.id}:`, uploadError);
          errorCount++;
          errors.push(`Image ${image.id}: Upload failed - ${uploadError.message}`);
          continue;
        }

        // Get public URL
        const { data: publicUrl } = supabase.storage.from('reels').getPublicUrl(fileName);

        // Update the database record
        const { error: updateError } = await supabase
          .from('generated_images')
          .update({ image_url: publicUrl.publicUrl })
          .eq('id', image.id);

        if (updateError) {
          console.error(`Update failed for image ${image.id}:`, updateError);
          errorCount++;
          errors.push(`Image ${image.id}: Database update failed - ${updateError.message}`);
          continue;
        }

        migratedCount++;
        console.log(`Migrated image ${image.id} to ${publicUrl.publicUrl}`);
      } catch (err) {
        console.error(`Error processing image ${image.id}:`, err);
        errorCount++;
        errors.push(`Image ${image.id}: ${err instanceof Error ? err.message : 'Unknown error'}`);
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        message: `Migration complete: ${migratedCount} images migrated, ${errorCount} errors`,
        migrated: migratedCount,
        errors: errorCount,
        errorDetails: errors.length > 0 ? errors.slice(0, 10) : undefined // Limit error details
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
