import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { callClaude, ClaudeError } from '../_shared/claude.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const MAX_MOVIE_IDEA_LENGTH = 2000;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { movieIdea } = await req.json();

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

    const sanitizedIdea = movieIdea.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '').trim();

    console.log('Calling Claude for Pete response...');

    try {
      const result = await callClaude({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `The user shared this movie idea with you: "${sanitizedIdea}". Respond as Pete AI with enthusiasm!` }
        ],
        thinkingBudget: 4000,
      });

      console.log('Pete AI response generated successfully');

      return new Response(
        JSON.stringify({ response: result.text }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } catch (error) {
      if (error instanceof ClaudeError) {
        if (error.status === 429 || error.status === 529) {
          return new Response(
            JSON.stringify({ response: "What a fantastic concept! I love the creative direction you're taking. Let's turn this vision into cinematic reality!" }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }
      throw error;
    }

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
