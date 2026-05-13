import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const { movieIdea, character, userHint, regenerateFields } = await req.json();
    if (!character?.name) {
      return new Response(JSON.stringify({ error: 'character.name is required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const fields: string[] = Array.isArray(regenerateFields) && regenerateFields.length
      ? regenerateFields
      : ['appearance', 'wardrobe', 'voiceStyle', 'personality'];

    const apiKey = Deno.env.get('LOVABLE_API_KEY');
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'LOVABLE_API_KEY not configured' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const systemPrompt = `You are a casting director and production designer. Generate a fresh, vivid, specific profile for ONE character so they remain visually consistent across every shot of a short film.

RULES:
- Keep the existing name, role, age, gender, and arc unchanged.
- Only regenerate these fields: ${fields.join(', ')}.
- "appearance": one detailed paragraph — height/build, skin tone, hair (color, length, style), eye color, distinguishing features. Concrete, photographable.
- "wardrobe": one paragraph describing a SPECIFIC outfit (top, bottom, shoes, accessories, colors, fabric). Must be the same outfit they wear in every scene unless the story explicitly changes it.
- "voiceStyle": short phrase (e.g. "low warm baritone, slightly raspy, deliberate cadence").
- "personality": 1–2 sentences capturing tone and how they speak.
- Honor the user's hint when provided.
- Return ONLY a JSON object with the requested fields. No prose, no markdown.`;

    const userPrompt = `MOVIE IDEA:
${movieIdea || '(unspecified)'}

EXISTING CHARACTER:
${JSON.stringify(character, null, 2)}

USER HINT (optional refinements): ${userHint || '(none)'}

Return JSON like: { ${fields.map(f => `"${f}": "..."`).join(', ')} }`;

    const aiResp = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        response_format: { type: 'json_object' },
      }),
    });

    if (!aiResp.ok) {
      const text = await aiResp.text();
      return new Response(JSON.stringify({ error: `AI Gateway ${aiResp.status}: ${text}` }), {
        status: aiResp.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const data = await aiResp.json();
    let content = data?.choices?.[0]?.message?.content || '{}';
    const m = content.match(/\{[\s\S]*\}/);
    if (m) content = m[0];

    let updates: Record<string, string> = {};
    try { updates = JSON.parse(content); } catch {
      return new Response(JSON.stringify({ error: 'Failed to parse AI JSON', raw: content }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const filtered: Record<string, string> = {};
    for (const f of fields) if (typeof updates[f] === 'string') filtered[f] = updates[f];

    return new Response(JSON.stringify({ updates: filtered }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || 'Unknown error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
