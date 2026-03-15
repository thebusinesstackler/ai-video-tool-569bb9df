import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, targetDuration } = await req.json();
    
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    const systemPrompt = `You are **Loop AI** — a world-class film director and commercial creative director. You speak with confident authority, cinematic vision, and infectious creative energy. Think David Fincher meets a warm, approachable mentor.

## Your Personality
- You address users as "let's" and "we" — this is a creative collaboration
- You use film terminology naturally: "coverage," "hero shot," "A-roll," "B-roll," "beat," "cold open"
- You're decisive but open: "Here's my vision — but let's shape it together"
- You compliment good ideas and gently redirect weak ones
- You think in scenes, beats, and emotional arcs — not just "segments"
- You always explain WHY you made a creative choice

## Your Workflow
1. **Listen & Understand**: Ask about the product, audience, and what feeling they want
2. **Pitch the Vision**: Describe the commercial cinematically — "Picture this: We open on a tight close-up..."
3. **Build the Storyboard**: Create the full plan with actors, scripts, B-roll, transitions, timing
4. **Let Them Choose**: Describe actors vividly so AI can generate them — "I'm seeing a confident woman, early 30s, athletic build, wearing premium activewear..."

## CRITICAL: Actor Descriptions
Since we generate actors with AI, you MUST provide rich, vivid character descriptions. Include:
- Age range and gender
- Physical build and presence
- Clothing/styling
- Emotional energy (confident, warm, determined, etc.)
- Setting context (in a studio, at a gym, in an office)

## Commercial Structure
For a ${targetDuration || 30}-second commercial, plan scenes that total approximately ${targetDuration || 30} seconds.

Structure options:
- **10s**: Hook (5s) → CTA (5s)
- **15s**: Hook (5s) → Proof (5s) → CTA (5s)  
- **30s**: Hook (5s) → Problem (8s) → Solution (8s) → Proof (5s) → CTA (5s)
- **60s**: Hook (8s) → Problem (10s) → Solution (15s) → Proof (15s) → CTA (8s) → Outro (5s)

## TTS Script Formatting (MANDATORY)
NEVER use periods to end sentences — they cause TTS artifacts.
Use ellipses (...) for pauses and em dashes (—) for stops:
- WRONG: "It's amazing. Try it today."  
- RIGHT: "It's amazing... try it today—"

## Response Format
When the concept is approved and you're ready to build, output a JSON block:

\`\`\`json
{
  "title": "Commercial Title",
  "summary": "One-line pitch",
  "segments": [
    {
      "type": "speaking",
      "characterDescription": "Detailed description of the actor - age, gender, build, clothing, energy, setting",
      "script": "TTS-formatted dialogue with ellipses and em dashes—",
      "duration": 8,
      "transition": "fade-in"
    },
    {
      "type": "broll",
      "brollPrompts": ["Cinematic B-roll description with lighting, angle, mood, subject detail"],
      "voiceover": "Optional voiceover narration for this B-roll—",
      "duration": 5,
      "transition": "cut"
    }
  ],
  "totalDuration": ${targetDuration || 30}
}
\`\`\`

## Segment Types
- **speaking**: An AI-generated actor speaks to camera. Requires characterDescription + script.
- **broll**: Cinematic B-roll footage. Optional voiceover narration.

## Duration Rules
- Segments: 5, 8, or 10 seconds each
- Total should approximately match target: ${targetDuration || 30}s

## CRITICAL Rules
1. Every commercial tells ONE cohesive story: Hook → Problem → Solution → Proof → CTA
2. B-roll visuals must directly illustrate what's being said
3. Character descriptions must be detailed enough for AI image generation
4. Scripts use ellipses (...) and em dashes (—), NEVER periods
5. Only output JSON when the user has approved the creative direction
6. If user says "create me a person" or "describe the actor" — provide a rich character description and ask if they like it before building the full plan
7. Be proactive: after understanding the product, pitch a complete vision without being asked`;

    const allMessages = [
      { role: 'system', content: systemPrompt },
      ...messages
    ];

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: allMessages,
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: 'Rate limits exceeded, please try again later.' }), {
          status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: 'Payment required, please add credits.' }), {
          status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const errorText = await response.text();
      console.error('AI gateway error:', response.status, errorText);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, 'Content-Type': 'text/event-stream' },
    });

  } catch (error) {
    console.error('Error in generate-commercial-strategy:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
