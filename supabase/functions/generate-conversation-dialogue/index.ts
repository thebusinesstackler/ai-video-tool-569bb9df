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
    const { 
      sceneDescription, 
      characterNames,
      tone, 
      location, 
      timeOfDay, 
      sceneTitle,
      storyBible,
      movieIdea,
      scenePosition,
      previousSceneSummary,
      characterPersonalities,
      transitionAction
    } = await req.json();

    if (!sceneDescription) {
      throw new Error('Scene description is required');
    }

    if (!characterNames || characterNames.length < 2) {
      throw new Error('At least 2 character names are required for conversation');
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    const char1 = characterNames[0];
    const char2 = characterNames[1];

    console.log('Generating cinematic dialogue between:', char1, 'and', char2);
    console.log('Scene context:', { sceneTitle, location, tone, scenePosition });

    // Build story context
    let storyContext = '';
    if (movieIdea) storyContext += `MOVIE CONCEPT: ${movieIdea}\n`;
    if (storyBible) {
      if (storyBible.theme) storyContext += `THEME: ${storyBible.theme}\n`;
      if (storyBible.setting) storyContext += `SETTING: ${storyBible.setting}\n`;
      if (storyBible.tone) storyContext += `OVERALL TONE: ${storyBible.tone}\n`;
    }
    if (previousSceneSummary) storyContext += `\nPREVIOUSLY: ${previousSceneSummary}\n`;

    // Build character context
    let characterContext = '';
    if (characterPersonalities) {
      characterContext = Object.entries(characterPersonalities)
        .map(([name, personality]) => `${name}: ${personality}`)
        .join('\n');
    }

    // Scene position guidance
    let sceneTypeGuidance = '';
    if (scenePosition) {
      if (scenePosition.includes('1 of') || scenePosition.toLowerCase().includes('opening')) {
        sceneTypeGuidance = 'OPENING scene — establish the characters and their dynamic. Build intrigue and tension.';
      } else if (scenePosition.toLowerCase().includes('climax')) {
        sceneTypeGuidance = 'CLIMAX scene — maximum emotional stakes. Confrontation, revelation, or breaking point.';
      } else if (scenePosition.toLowerCase().includes('resolution') || scenePosition.toLowerCase().includes('final')) {
        sceneTypeGuidance = 'RESOLUTION scene — emotional payoff, closure, or a haunting final beat.';
      }
    }

    const prompt = `You are writing dialogue for a REAL MOVIE SCENE between two characters. This should sound like professional actors performing — not AI-generated text.

${storyContext ? `STORY CONTEXT:\n${storyContext}` : ''}

CHARACTERS:
1. ${char1}
2. ${char2}
${characterContext ? `\nCHARACTER PERSONALITIES:\n${characterContext}` : ''}

SCENE: "${sceneTitle || 'Untitled'}"
LOCATION: ${location || 'Unknown'} — ${timeOfDay || 'Day'}
MOOD: ${tone || 'dramatic'}
${scenePosition ? `POSITION IN STORY: ${scenePosition}` : ''}
${sceneTypeGuidance ? `\n${sceneTypeGuidance}` : ''}
${transitionAction ? `WHAT HAPPENS: ${transitionAction}` : ''}
${previousSceneSummary ? `\nSTORY SO FAR:\n${previousSceneSummary}` : ''}

SCENE DESCRIPTION:
${sceneDescription}

WRITING RULES — READ CAREFULLY:

1. EVERY LINE MUST BE LABELED WITH THE EXACT CHARACTER NAME
   Format: {"character": "${char1}", "line": "Their words here"}
   Never leave a line without a speaker. The voice engine MUST know who is talking.

2. SOUND LIKE REAL ACTORS IN A REAL MOVIE
   - Write how real people talk in emotionally charged moments
   - Each character must sound DISTINCT — different vocabulary, rhythm, personality
   - ${char1} and ${char2} should NOT sound like the same person
   - Lines should have subtext: what they MEAN vs what they SAY
   - Write for performance — a good actor should nail this on first read

3. ABSOLUTELY NO EXCESSIVE ELLIPSES
   - Maximum ONE "..." in the ENTIRE conversation, and only if truly dramatic
   - WRONG: "I just... I don't know... maybe we should..."
   - RIGHT: "I don't know. Maybe we should go."
   - RIGHT: "I don't know what to say to that."
   - Use periods and commas for pacing, NOT ellipses

4. NATURAL CONVERSATIONAL RHYTHM
   - Mix short punchy lines (3-8 words) with longer ones (15-25 words)
   - Characters can interrupt or react sharply
   - Include emotional turns — the conversation should SHIFT somewhere
   - Build tension toward a peak moment
   - Some lines should land like a punch: "No. Not anymore."
   - Others should breathe: "I waited three years for you to walk through that door, and now you're here, and I don't know what to do."

5. EMOTIONAL DIRECTION (include in "emotion" field)
   - Each line needs an emotion tag that helps the voice engine
   - Use specific, actable emotions: "angry but controlled", "quiet devastation", "forced calm", "barely holding it together", "cold and measured", "desperate", "sarcastic edge"
   - NOT generic like "happy" or "sad" — be specific and performance-ready

6. NO STAGE DIRECTIONS IN THE LINE TEXT
   - NO parentheses like (sighs) or (pauses) inside the "line" field
   - NO brackets or asterisks
   - The "emotion" field handles delivery guidance
   - The "line" field is ONLY spoken words

7. EVERY LINE MUST MATTER
   - No filler dialogue that adds nothing
   - Every line reveals character, builds tension, or moves the story
   - Cut anything that sounds like placeholder text

Return ONLY a valid JSON array:
[
  {"character": "${char1}", "line": "Their exact words.", "emotion": "specific emotional direction"},
  {"character": "${char2}", "line": "Their response.", "emotion": "specific emotional direction"}
]

Generate 6-10 exchanges (12-20 total lines). Make it CINEMATIC. Return ONLY the JSON array.`;

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content: 'You are an Oscar-caliber screenwriter. Your dialogue is legendary — sharp, emotionally devastating, and impossible to forget. You write like Aaron Sorkin meets Taylor Sheridan: every line crackles with subtext and tension. You NEVER use ellipses as a crutch. Your pacing comes from sentence structure, word choice, and emotional rhythm. Each character has a completely distinct voice. You always return valid JSON only.'
          },
          { role: 'user', content: prompt }
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI gateway error:', response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: 'API credits exhausted. Please add credits.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    let dialogueContent = data.choices[0].message.content.trim();
    
    // Clean markdown code blocks
    dialogueContent = dialogueContent.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    
    console.log('Raw dialogue content:', dialogueContent);

    // Parse JSON
    let conversation;
    try {
      conversation = JSON.parse(dialogueContent);
    } catch (parseError) {
      console.error('Failed to parse dialogue JSON:', parseError);
      const jsonMatch = dialogueContent.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        conversation = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('Could not parse dialogue response as JSON');
      }
    }

    if (!Array.isArray(conversation)) {
      throw new Error('Dialogue response is not an array');
    }

    // Clean and normalize
    const cleanedConversation = conversation.map((entry: any) => {
      let charName = entry.character || 'Unknown';
      
      // Fuzzy match to provided character names
      const char1Lower = char1.toLowerCase().replace(/\s+/g, '');
      const char2Lower = char2.toLowerCase().replace(/\s+/g, '');
      const entryCharLower = charName.toLowerCase().replace(/\s+/g, '');
      
      if (entryCharLower.includes(char1Lower) || char1Lower.includes(entryCharLower)) {
        charName = char1;
      } else if (entryCharLower.includes(char2Lower) || char2Lower.includes(entryCharLower)) {
        charName = char2;
      }

      // Clean the line text — strip excessive ellipses
      let line = (entry.line || '')
        .replace(/\([^)]*\)/g, '')
        .replace(/\[[^\]]*\]/g, '')
        .replace(/\*[^*]*\*/g, '')
        .trim();
      
      // Replace chains of "... word ..." with proper punctuation
      // "I just... I don't know... maybe" → "I just. I don't know. Maybe"
      let ellipsisCount = 0;
      line = line.replace(/\.{3}/g, () => {
        ellipsisCount++;
        return ellipsisCount <= 1 ? '...' : '.';
      });
      // Also handle unicode ellipsis
      line = line.replace(/…/g, () => {
        ellipsisCount++;
        return ellipsisCount <= 1 ? '...' : '.';
      });
      
      return {
        character: charName,
        line,
        emotion: entry.emotion || undefined,
      };
    }).filter((entry: any) => entry.line.length > 0);

    console.log('Generated cinematic conversation:', cleanedConversation.length, 'lines');

    // Also return separate dialogue by character for TTS
    const dialogueByCharacter: Record<string, string> = {};
    dialogueByCharacter[char1] = cleanedConversation
      .filter((e: any) => e.character === char1)
      .map((e: any) => e.line)
      .join(' ');
    dialogueByCharacter[char2] = cleanedConversation
      .filter((e: any) => e.character === char2)
      .map((e: any) => e.line)
      .join(' ');

    return new Response(
      JSON.stringify({ conversation: cleanedConversation, dialogueByCharacter }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in generate-conversation-dialogue:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
