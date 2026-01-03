import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const MAX_MOVIE_IDEA_LENGTH = 2000;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify authorization header exists (JWT verified by Supabase)
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { movieIdea } = await req.json();

    // Validate input
    if (!movieIdea) {
      return new Response(
        JSON.stringify({ error: 'Movie idea is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (typeof movieIdea !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Movie idea must be a string' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (movieIdea.length > MAX_MOVIE_IDEA_LENGTH) {
      return new Response(
        JSON.stringify({ error: `Movie idea exceeds maximum length of ${MAX_MOVIE_IDEA_LENGTH} characters` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');

    if (!LOVABLE_API_KEY) {
      console.error('LOVABLE_API_KEY is not configured');
      return new Response(
        JSON.stringify({ 
          response: "That sounds like an exciting movie concept! I can already envision the scenes. Let's bring this story to life together!" 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const systemPrompt = `You are Pete AI, an enthusiastic and experienced AI movie director assistant. You help filmmakers bring their creative visions to life.

Your personality:
- Warm, encouraging, and passionate about cinema
- You speak like a veteran Hollywood director who's seen it all
- You use occasional film industry terminology naturally
- You're supportive but also offer constructive creative insights
- You keep responses concise (2-3 sentences max)

Your job:
- React positively and enthusiastically to the user's movie idea
- Briefly highlight what excites you about their concept
- Encourage them to develop it further with the Movie Scene Creator
- You may suggest one small creative enhancement if appropriate

IMPORTANT: Keep your response SHORT (max 2-3 sentences). Be enthusiastic but concise!`;

    console.log('Calling Lovable AI Gateway for Pete response...');
    
    // Sanitize input for prompt (remove control characters)
    const sanitizedIdea = movieIdea.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '').trim();
    
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `The user shared this movie idea with you: "${sanitizedIdea}". Respond as Pete AI with enthusiasm!` }
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI Gateway error:', response.status, errorText);
      
      return new Response(
        JSON.stringify({ 
          response: "What a fantastic concept! I love the creative direction you're taking. Let's turn this vision into cinematic reality!" 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    const peteResponse = data.choices?.[0]?.message?.content || 
      "That's a brilliant movie idea! I can see the potential for some truly memorable scenes. Ready to start creating?";

    console.log('Pete AI response generated successfully');

    return new Response(
      JSON.stringify({ response: peteResponse }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in pete-ai-chat function:', error);
    return new Response(
      JSON.stringify({ 
        response: "I love what you're thinking! This has real potential. Let's develop this story together!",
        error: error instanceof Error ? error.message : 'Unknown error'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
