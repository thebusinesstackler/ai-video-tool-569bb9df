import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { callClaude } from "../_shared/claude.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const SYSTEM_PROMPT = `You are the AI Director with full control over a video timeline editor. You can see all clips, their durations, captions, and transitions. Users will ask you to make edits — you respond with a friendly explanation AND structured actions.

IMPORTANT: Always respond with valid JSON matching this schema:
{
  "message": "Your conversational response explaining what you did",
  "actions": [
    {
      "type": "split_clip",
      "clipIndex": 0,
      "timestamp": 4.2
    }
  ]
}

Available action types:
- split_clip: Split a clip at a timestamp. Params: clipIndex (number), timestamp (number in seconds relative to clip start)
- trim_clip: Adjust trim. Params: clipIndex, trimStart (seconds), trimEnd (seconds)
- delete_clip: Remove a clip. Params: clipIndex
- reorder_clips: Move a clip. Params: fromIndex, toIndex
- regenerate_clip: Regenerate a clip matching its duration. Params: clipIndex, prompt (optional new prompt)
- add_caption: Set caption text. Params: clipIndex, text
- set_transition: Change transition. Params: clipIndex, transition (fade|slide|crossfade|wipe|none)
- detect_scenes: Trigger scene detection. No params needed.

Rules:
1. Refer to clips by their scene number or content, not just index.
2. When splitting, calculate the timestamp carefully based on clip duration.
3. When regenerating, suggest keeping the same duration unless user asks otherwise.
4. Be concise and confident — you're the director.
5. If the user's request is unclear, ask a clarifying question (with empty actions array).
6. You can chain multiple actions in one response.
7. Always return valid JSON. Never return markdown.`;

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const { messages, timelineState } = await req.json();

    if (!messages || !Array.isArray(messages)) {
      throw new Error('messages array is required');
    }

    // Build context about the timeline
    const timelineContext = timelineState ? `
CURRENT TIMELINE STATE:
${JSON.stringify(timelineState.clips?.map((c: any, i: number) => ({
  index: i,
  sceneNumber: c.sceneNumber || i + 1,
  duration: c.duration || 0,
  trimStart: c.trimStart || 0,
  trimEnd: c.trimEnd || 0,
  caption: c.caption || c.text || '',
  hasVideo: !!c.videoUrl,
  transition: c.transition || 'crossfade',
})) || [], null, 2)}

Total clips: ${timelineState.clips?.length || 0}
Total duration: ${timelineState.totalDuration || 0}s
` : 'No timeline state provided.';

    const fullMessages = [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: `Here is the current timeline:\n${timelineContext}` },
      ...messages,
    ];

    const result = await callClaude({
      messages: fullMessages,
      thinkingBudget: 6000,
      maxTokens: 22000,
    });

    const responseText = result.text;
    console.log('Timeline Director raw response:', responseText.slice(0, 500));

    // Parse the JSON response
    let parsed: { message: string; actions: any[] };
    try {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[0]);
      } else {
        parsed = { message: responseText, actions: [] };
      }
    } catch (e) {
      console.warn('Failed to parse director response as JSON:', e);
      parsed = { message: responseText, actions: [] };
    }

    // Validate actions
    const validTypes = ['split_clip', 'trim_clip', 'delete_clip', 'reorder_clips', 'regenerate_clip', 'add_caption', 'set_transition', 'detect_scenes'];
    parsed.actions = (parsed.actions || []).filter((a: any) => validTypes.includes(a.type));

    return new Response(
      JSON.stringify({ success: true, ...parsed }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in timeline-director:', error);
    return new Response(
      JSON.stringify({ success: false, message: error instanceof Error ? error.message : 'Unknown error', actions: [] }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
