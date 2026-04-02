import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { callClaude, ClaudeError } from '../_shared/claude.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { topic, hookStyle, characterDescription, hookCount = 5 } = await req.json();

    if (!topic) {
      return new Response(
        JSON.stringify({ error: 'Topic is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const sanitizedTopic = topic.replace(/<[^>]*>/g, '').replace(/&\w+;/g, ' ').replace(/\s+/g, ' ').trim();

    console.log('Generating hooks for topic:', sanitizedTopic, 'count:', hookCount, 'style:', hookStyle);

    const systemPrompt = `You are a HOOK SPECIALIST for TikTok, Instagram Reels, and YouTube Shorts. You study viral content patterns and understand what makes people stop scrolling.

═══ YOUR TRAINING DATA — REAL HIGH-PERFORMING HOOK EXAMPLES ═══

EXAMPLE PRODUCT: Lifecykel Mushroom Extracts (Lion's Mane, Reishi, Cordyceps)

HOOK EXAMPLE 1:
Hook: "Why am I still tired even after taking supplements?"
Why it works:
- Creates tension and relatability — viewer thinks "that's me!"
- Calls out a real frustration people feel daily
- Creates a curiosity gap: "wait, why IS that?"
Visual direction:
- Actor looks tired, holding coffee, slight slouch
- Quick head turn toward camera (MOVEMENT)
- Slight handheld zoom-in (CAMERA MOTION)
- Expression: confused + frustrated, furrowed brow

HOOK EXAMPLE 2:
Hook: "I tried every energy supplement… none of them worked."
Why it works:
- Personal story creates instant credibility
- "None of them worked" creates tension
- Viewer wants to know: what DID work?
Visual direction:
- Actor shaking head slightly while holding supplement bottle
- Lowers bottle disappointedly, then looks up at camera (MOVEMENT)
- Subtle forward camera push (CAMERA MOTION)
- Expression: disappointed → transitioning to hopeful

HOOK EXAMPLE 3:
Hook: "My doctor asked me one question that changed everything."
Why it works:
- Authority figure (doctor) adds weight
- "One question" is specific and intriguing
- "Changed everything" promises transformation
Visual direction:
- Actor pausing mid-step, turning to face camera (MOVEMENT)
- Medium close-up with slow push-in (CAMERA MOTION)
- Expression: wide-eyed realization, slight head tilt

═══ HOOK CREATION RULES ═══

Every hook MUST include:
1. EMOTIONAL TRIGGER: tension, curiosity, relatability, shock, or desire
2. CURIOSITY GAP: an incomplete loop the viewer needs closed
3. NATURAL TONE: sounds like a real person talking, not a commercial
4. BREVITY: 5-15 words maximum
5. SPECIFICITY: tied to the actual topic, not generic

HOOK TYPES TO VARY ACROSS:
- Tension/Frustration: "Why does X never work?" / "I was doing X wrong this whole time"
- Personal Story: "I tried X for 30 days and..." / "Nobody warned me about X"
- Authority: "My doctor/coach/mentor told me..." / "The CEO of X said..."
- Contrarian: "Everyone says X but they're wrong" / "Stop doing X immediately"
- Result: "I went from X to Y in Z days" / "This one change gave me X"
- Question: "What if X was actually Y?" / "Why does nobody talk about X?"
- Challenge: "I bet you can't X" / "Try this for 3 days"

BANNED HOOKS (overused, low engagement):
- "Stop scrolling"
- "Wait for it"
- "You won't believe this"
- "Watch until the end"
- "POV:"
- Any hook that could apply to ANY topic (must be specific)

═══ HOOK VALIDATION CHECKLIST ═══
Before including ANY hook, verify:
✅ Does this create genuine curiosity? (Not just clickbait)
✅ Does this feel native to TikTok/Reels? (Not corporate/formal)
✅ Is it short and punchy? (Under 15 words)
✅ Would this actually stop someone mid-scroll?
✅ Is it specific to this topic? (Can't be used for anything else)
✅ Does it have an emotional trigger?
If ANY answer is NO → replace with a stronger hook.

═══ OUTPUT FORMAT ═══
Return a JSON array of hook objects. Each hook MUST include matching visual direction with movement, camera motion, and expression.`;

    const userPrompt = `Generate ${hookCount} unique, high-performing hooks for a short-form video about: "${sanitizedTopic}"

${hookStyle && hookStyle !== 'auto' ? `Preferred hook style: ${hookStyle}. Generate at least 2 hooks in this style, but vary the rest.` : 'Vary the hook types across different categories for maximum options.'}

${characterDescription ? `Character: ${characterDescription}. All visual directions must feature THIS exact character.` : ''}

For each hook, provide:
1. The hook text (5-15 words)
2. The hook type/category
3. Why this hook works (psychological analysis)
4. Visual direction with REQUIRED: physical action, camera motion, facial expression
5. A strength score (1-10) based on scroll-stopping potential

Return ONLY valid JSON:
[
  {
    "hookText": "The actual hook narration",
    "hookType": "tension",
    "whyItWorks": "Creates relatability by calling out a shared frustration",
    "visualDirection": {
      "action": "Actor quickly turns head toward camera while setting down coffee cup",
      "cameraMotion": "Quick push-in close-up with handheld shake",
      "expression": "Frustrated confusion shifting to determined intensity",
      "lighting": "Bright natural daylight, clean and well-lit"
    },
    "strengthScore": 9,
    "thumbnailOptimized": true
  }
]`;

    try {
      const result = await callClaude({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        thinkingBudget: 10000,
      });

      const content = result.text;
      if (!content) throw new Error('No content in AI response');

      // Extract JSON
      let jsonContent = content;
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        jsonContent = jsonMatch[1].trim();
      } else {
        const arrayMatch = content.match(/\[\s*\{[\s\S]*\}\s*\]/);
        if (arrayMatch) jsonContent = arrayMatch[0];
      }

      jsonContent = jsonContent.replace(/[\u0000-\u001F\u007F-\u009F]/g, ' ').trim();

      let hooks;
      try {
        hooks = JSON.parse(jsonContent);
      } catch {
        try {
          hooks = JSON.parse(jsonContent.replace(/,\s*([}\]])/g, '$1').replace(/'/g, '"'));
        } catch {
          throw new Error('Failed to parse hooks response');
        }
      }

      if (!Array.isArray(hooks) || hooks.length === 0) {
        throw new Error('No hooks generated');
      }

      // Sort by strength score descending
      hooks.sort((a: any, b: any) => (b.strengthScore || 0) - (a.strengthScore || 0));

      console.log('Generated', hooks.length, 'hooks for topic:', sanitizedTopic);

      return new Response(
        JSON.stringify({ hooks }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );

    } catch (error) {
      if (error instanceof ClaudeError) {
        return new Response(
          JSON.stringify({ error: error.message }),
          { status: error.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      throw error;
    }

  } catch (error) {
    console.error('Error generating hooks:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Failed to generate hooks' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
