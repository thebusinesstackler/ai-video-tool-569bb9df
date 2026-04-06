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
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Authorization required' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    // Verify the calling user
    const anonClient = createClient(supabaseUrl, anonKey);
    const { data: { user }, error: authError } = await anonClient.auth.getUser(
      authHeader.replace('Bearer ', '')
    );
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { targetEmail, assetTypes } = await req.json();
    
    if (!targetEmail || typeof targetEmail !== 'string') {
      return new Response(JSON.stringify({ error: 'Target email is required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (targetEmail.toLowerCase() === user.email?.toLowerCase()) {
      return new Response(JSON.stringify({ error: 'Cannot transfer to yourself' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const adminClient = createClient(supabaseUrl, serviceKey);

    // Look up target user by email
    const { data: targetUsers, error: lookupError } = await adminClient.auth.admin.listUsers();
    if (lookupError) {
      console.error('User lookup error:', lookupError);
      return new Response(JSON.stringify({ error: 'Failed to look up target user' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const targetUser = targetUsers.users.find(
      (u: any) => u.email?.toLowerCase() === targetEmail.toLowerCase()
    );

    if (!targetUser) {
      return new Response(JSON.stringify({ error: 'No account found with that email address' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const sourceUserId = user.id;
    const targetUserId = targetUser.id;
    const results: Record<string, number> = {};

    const transferTable = async (table: string) => {
      const { data, error } = await adminClient
        .from(table)
        .update({ user_id: targetUserId })
        .eq('user_id', sourceUserId)
        .select('id');
      
      if (error) {
        console.error(`Error transferring ${table}:`, error);
        throw new Error(`Failed to transfer ${table}: ${error.message}`);
      }
      return data?.length || 0;
    };

    const types = assetTypes || ['images', 'products', 'videos'];

    // Transfer image gallery
    if (types.includes('images')) {
      results.generated_images = await transferTable('generated_images');
      results.calendar_images = await transferTable('calendar_images');
    }

    // Transfer product library (brands → products → product_gallery)
    if (types.includes('products')) {
      results.product_gallery = await transferTable('product_gallery');
      results.products = await transferTable('products');
      results.brands = await transferTable('brands');
      results.product_images = await transferTable('product_images');
    }

    // Transfer video repos
    if (types.includes('videos')) {
      results.video_repo_projects = await transferTable('video_repo_projects');
      results.video_tasks = await transferTable('video_tasks');
      results.reels = await transferTable('reels');
      results.movie_projects = await transferTable('movie_projects');
      results.projects = await transferTable('projects');
    }

    // Transfer AI twins
    if (types.includes('twins')) {
      results.ai_twins = await transferTable('ai_twins');
    }

    // Transfer logos
    if (types.includes('logos')) {
      results.user_logos = await transferTable('user_logos');
    }

    const totalTransferred = Object.values(results).reduce((a, b) => a + b, 0);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Transferred ${totalTransferred} items to ${targetEmail}`,
        details: results,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Transfer error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Transfer failed' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
