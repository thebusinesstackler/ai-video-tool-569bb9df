import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Generate a cryptographically secure random API key
function generateSecureKey(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  const key = Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
  return `tvk_${key}`;
}

// Hash the API key using SHA-256
async function hashApiKey(key: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(key);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Initialize Supabase client with user's auth
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    // Verify user is authenticated
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      console.error('Auth error:', authError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body
    const { name } = await req.json();
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return new Response(
        JSON.stringify({ error: 'API key name is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Generate the API key
    const plainTextKey = generateSecureKey();
    const keyHash = await hashApiKey(plainTextKey);
    const keyPrefix = plainTextKey.substring(0, 12); // "tvk_" + 8 chars

    console.log(`Generating API key for user ${user.id} with name: ${name}`);

    // Use service role to insert (bypasses RLS for insert)
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    // Store the hashed key
    const { data, error: insertError } = await supabaseAdmin
      .from('api_keys')
      .insert({
        user_id: user.id,
        name: name.trim(),
        key_hash: keyHash,
        key_prefix: keyPrefix,
      })
      .select('id, name, key_prefix, created_at')
      .single();

    if (insertError) {
      console.error('Insert error:', insertError);
      return new Response(
        JSON.stringify({ error: 'Failed to create API key' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`API key created successfully: ${data.id}`);

    // Return the plain text key (shown only once!)
    return new Response(
      JSON.stringify({
        id: data.id,
        name: data.name,
        key: plainTextKey, // Only time this is ever returned!
        key_prefix: data.key_prefix,
        created_at: data.created_at,
        message: 'Store this key securely. It will not be shown again.'
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
