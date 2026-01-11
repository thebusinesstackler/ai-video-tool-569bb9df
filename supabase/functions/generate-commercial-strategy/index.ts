import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, targetDuration, availableTwins } = await req.json();
    
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    // Build system prompt for commercial strategy
    const systemPrompt = `You are an expert video commercial strategist and creative director specializing in testimonial-style advertisements. Your goal is to help users create compelling, professional commercials that convert.

## Your Expertise:
- Creating comprehensive commercial structures with intro hooks, testimonials, B-roll, and strong CTAs
- Planning video timing and pacing for maximum impact
- Suggesting appropriate B-roll visuals that enhance the message
- Recommending music styles and tones that match the brand
- Structuring multi-segment commercials with smooth transitions

## Commercial Structure Best Practices:
1. **Hook/Intro (5-10 seconds)**: Grab attention immediately with a bold statement or question
2. **Problem Statement (10-15 seconds)**: Relate to the viewer's pain point
3. **Solution/Testimonial (60-90 seconds)**: AI Twin speakers sharing authentic experiences
4. **Social Proof/B-Roll (15-30 seconds)**: Visual evidence, product shots, happy customers
5. **Call to Action/Outro (10-15 seconds)**: Clear next step with urgency

## TTS-OPTIMIZED SCRIPT FORMATTING (CRITICAL FOR NATURAL VOICE):
When writing scripts for AI Twin segments and voiceovers, format them for natural voice delivery:
- Use ellipses (...) for natural pauses and thinking moments instead of periods
- Use em dashes (—) instead of periods for abrupt transitions
- Break into short, punchy lines for natural pacing
- Use rhetorical questions: "Right?" "Yeah... me too."
- NEVER end sentences with periods before words like "too", "me", "you", "right", "now"
- Instead of "Yeah. Me too." write "Yeah... me too."
- Add natural transitions: "And here's the thing—", "But wait..."

EXAMPLE SCRIPT FORMAT:
"Ever felt overwhelmed by the sheer number of options out there...

Yeah... me too.

It's like navigating a maze... right?

But here's the truth—what really matters isn't features...

It's how seamlessly it all connects."

## Available AI Twins for this user:
${availableTwins?.length > 0 ? availableTwins.map((t: any) => `- ${t.name}: ${t.description || 'No description'}`).join('\n') : 'No AI Twins created yet - suggest they create some first'}

## Target Duration: ${targetDuration || 60} seconds

## Response Format:
When the user's idea is ready for implementation, respond with a JSON code block containing the commercial strategy. Use this exact format:

\`\`\`json
{
  "title": "Commercial title",
  "summary": "Brief 1-2 sentence summary of the commercial concept",
  "musicStyle": "Suggested music style (e.g., 'Upbeat corporate', 'Emotional piano', 'Modern electronic')",
  "segments": [
    {
      "type": "twin-speaking",
      "twinName": "Name of AI Twin to use (must match available twins)",
      "script": "What the AI Twin will say - USE TTS-OPTIMIZED FORMATTING with ellipses and em dashes",
      "duration": 8,
      "transition": "fade-in",
      "notes": "Any production notes"
    },
    {
      "type": "broll-voice-continue",
      "brollPrompts": ["Detailed B-roll visual description 1", "Description 2"],
      "duration": 5,
      "transition": "cut",
      "notes": "Visual notes"
    },
    {
      "type": "broll-montage",
      "voiceover": "Voiceover text for montage - USE TTS-OPTIMIZED FORMATTING",
      "brollPrompts": ["Visual 1", "Visual 2", "Visual 3"],
      "duration": 8,
      "transition": "cut",
      "notes": "Montage notes"
    }
  ],
  "totalDuration": 60
}
\`\`\`

## Segment Types:
- **twin-speaking**: AI Twin on camera speaking directly (requires twinName and script)
- **broll-voice-continue**: B-roll visuals while the previous speaker's voice continues (no new audio)
- **broll-montage**: B-roll with a separate voiceover (requires voiceover text)

## Duration Rules:
- Each segment duration must be either 5 or 8 seconds (API limitation)
- Plan multiple short segments to achieve longer total durations

## Important Guidelines:
1. Always start by understanding the user's product/service and target audience
2. Ask clarifying questions if the brief is unclear
3. Be conversational and helpful, like a real creative director
4. Only output the JSON when you have a clear, approved concept
5. Match twin assignments to user's available twins
6. Keep B-roll prompts detailed and specific for AI image generation
7. ALWAYS use TTS-optimized script formatting with ellipses and em dashes for natural voice delivery`;

    const allMessages: Message[] = [
      { role: 'system', content: systemPrompt },
      ...messages
    ];

    console.log('Calling Lovable AI with messages:', allMessages.length);

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
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: 'Payment required, please add credits.' }), {
          status: 402,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const errorText = await response.text();
      console.error('AI gateway error:', response.status, errorText);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    // Stream the response back
    return new Response(response.body, {
      headers: { ...corsHeaders, 'Content-Type': 'text/event-stream' },
    });

  } catch (error) {
    console.error('Error in generate-commercial-strategy:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
