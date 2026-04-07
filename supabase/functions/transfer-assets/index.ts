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
      return new Response(JSON.stringify({ error: 'Cannot share with yourself' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const adminClient = createClient(supabaseUrl, serviceKey);

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

    // Copy rows: select source user's rows, insert duplicates for target user
    const copyTable = async (table: string, extraColumns?: string[]) => {
      // First get the source rows
      const { data: rows, error: selectError } = await adminClient
        .from(table)
        .select('*')
        .eq('user_id', sourceUserId);

      if (selectError) {
        console.error(`Error reading ${table}:`, selectError);
        throw new Error(`Failed to read ${table}: ${selectError.message}`);
      }

      if (!rows || rows.length === 0) return 0;

      // Create copies with new IDs and target user_id
      const copies = rows.map((row: any) => {
        const copy = { ...row };
        delete copy.id; // let DB generate new id
        copy.user_id = targetUserId;
        return copy;
      });

      const { error: insertError } = await adminClient
        .from(table)
        .insert(copies);

      if (insertError) {
        console.error(`Error copying ${table}:`, insertError);
        throw new Error(`Failed to copy ${table}: ${insertError.message}`);
      }

      return copies.length;
    };

    // For tables with foreign keys (products → brands, product_gallery → products),
    // we need to map old IDs to new IDs
    const copyWithIdMap = async (
      table: string,
      parentIdCol?: string,
      idMap?: Map<string, string>
    ): Promise<{ count: number; idMap: Map<string, string> }> => {
      const { data: rows, error: selectError } = await adminClient
        .from(table)
        .select('*')
        .eq('user_id', sourceUserId);

      if (selectError) {
        console.error(`Error reading ${table}:`, selectError);
        throw new Error(`Failed to read ${table}: ${selectError.message}`);
      }

      if (!rows || rows.length === 0) return { count: 0, idMap: new Map() };

      const newIdMap = new Map<string, string>();

      for (const row of rows) {
        const oldId = row.id;
        const copy = { ...row };
        delete copy.id;
        copy.user_id = targetUserId;

        // Remap parent foreign key if applicable
        if (parentIdCol && idMap && copy[parentIdCol]) {
          const newParentId = idMap.get(copy[parentIdCol]);
          if (newParentId) {
            copy[parentIdCol] = newParentId;
          } else {
            // Skip if parent wasn't copied
            continue;
          }
        }

        const { data: inserted, error: insertError } = await adminClient
          .from(table)
          .insert(copy)
          .select('id')
          .single();

        if (insertError) {
          console.error(`Error copying row in ${table}:`, insertError);
          continue;
        }

        if (inserted) {
          newIdMap.set(oldId, inserted.id);
        }
      }

      return { count: newIdMap.size, idMap: newIdMap };
    };

    const types = assetTypes || ['images', 'products', 'videos'];

    // Copy image gallery
    if (types.includes('images')) {
      results.generated_images = await copyTable('generated_images');
      results.calendar_images = await copyTable('calendar_images');
    }

    // Copy product library (brands → products → product_gallery) preserving FK relationships
    if (types.includes('products')) {
      const brandsResult = await copyWithIdMap('brands');
      results.brands = brandsResult.count;

      const productsResult = await copyWithIdMap('products', 'brand_id', brandsResult.idMap);
      results.products = productsResult.count;

      const pgResult = await copyWithIdMap('product_gallery', 'product_id', productsResult.idMap);
      results.product_gallery = pgResult.count;

      results.product_images = await copyTable('product_images');
    }

    // Copy video repos
    if (types.includes('videos')) {
      results.video_repo_projects = await copyTable('video_repo_projects');
      results.video_tasks = await copyTable('video_tasks');
      results.reels = await copyTable('reels');
      results.movie_projects = await copyTable('movie_projects');
      results.projects = await copyTable('projects');
    }

    // Copy AI twins
    if (types.includes('twins')) {
      results.ai_twins = await copyTable('ai_twins');
    }

    // Copy logos
    if (types.includes('logos')) {
      results.user_logos = await copyTable('user_logos');
    }

    const totalCopied = Object.values(results).reduce((a, b) => a + b, 0);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Shared ${totalCopied} items with ${targetEmail}`,
        details: results,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Share error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Share failed' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
