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
    const { 
      sceneDescription, characterNames, tone, location, timeOfDay, sceneTitle,
      storyBible, movieIdea, scenePosition, previousSceneSummary, characterPersonalities, transitionAction
    } = await req.json();

    if (!sceneDescription) throw new Error('Scene description is required');
    if (!characterNames || characterNames.length < 2) throw new Error('At least 2 character names are required');

    const char1 = characterNames[0];
    const char2 = characterNames[1];
    console.log('Generating cinematic dialogue between:', char1, 'and', char2);

    let storyContext = '';
    if (movieIdea) storyContext += `MOVIE CONCEPT: ${movieIdea}\n`;
    if (storyBible) {
      if (storyBible.theme) storyContext += `THEME: ${storyBible.theme}\n`;
      if (storyBible.setting) storyContext += `SETTING: ${storyBible.setting}\n`;
      if (storyBible.tone) storyContext += `OVERALL TONE: ${storyBible.tone}\n`;
    }
    if (previousSceneSummary) storyContext += `\nPREVIOUSLY: ${previousSceneSummary}\n`;

    let characterContext = '';
    if (characterPersonalities) {
      characterContext = Object.entries(characterPersonalities).map(([name, personality]) => `${name}: ${personality}`).join('\n');
    }

    let sceneTypeGuidance = '';
    if (scenePosition) {
      if (scenePosition.includes('1 of') || scenePosition.toLowerCase().includes('opening')) sceneTypeGuidance = 'OPENING scene — establish the characters and their dynamic.';
      else if (scenePosition.toLowerCase().includes('climax')) sceneTypeGuidance = 'CLIMAX scene — maximum emotional stakes.';
      else if (scenePosition.toLowerCase().includes('resolution') || scenePosition.toLowerCase().includes('final')) sceneTypeGuidance = 'RESOLUTION scene — emotional payoff, closure.';
    }

    const prompt = `You are writing dialogue for a REAL MOVIE SCENE between two characters.

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

SCENE DESCRIPTION:
${sceneDescription}

WRITING RULES:
1. EVERY LINE MUST BE LABELED: {"character": "${char1}", "line": "...", "emotion": "..."}
2. SOUND LIKE REAL ACTORS — distinct vocabulary, rhythm, personality per character
3. Maximum ONE "..." in the ENTIRE conversation
4. Mix short punchy lines with longer flowing ones
5. Include "emotion" field with specific actable directions
6. NO stage directions in "line" field — only spoken words
7. Every line must matter — no filler

Return ONLY a valid JSON array:
[
  {"character": "${char1}", "line": "Their exact words.", "emotion": "specific emotional direction"},
  {"character": "${char2}", "line": "Their response.", "emotion": "specific emotional direction"}
]

Generate 6-10 exchanges (12-20 total lines). Return ONLY the JSON array.`;

    try {
      const result = await callClaude({
        messages: [
          {
            role: 'system',
            content: 'You are an Oscar-caliber screenwriter. Your dialogue is sharp, emotionally devastating, and impossible to forget. You write like Aaron Sorkin meets Taylor Sheridan. You NEVER use ellipses as a crutch. You always return valid JSON only.'
          },
          { role: 'user', content: prompt }
        ],
        thinkingBudget: 8000,
      });

      let dialogueContent = result.text.trim();
      dialogueContent = dialogueContent.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      console.log('Raw dialogue content:', dialogueContent);

      let conversation;
      try {
        conversation = JSON.parse(dialogueContent);
      } catch {
        const jsonMatch = dialogueContent.match(/\[[\s\S]*\]/);
        if (jsonMatch) conversation = JSON.parse(jsonMatch[0]);
        else throw new Error('Could not parse dialogue response as JSON');
      }

      if (!Array.isArray(conversation)) throw new Error('Dialogue response is not an array');

      const cleanedConversation = conversation.map((entry: any) => {
        let charName = entry.character || 'Unknown';
        const char1Lower = char1.toLowerCase().replace(/\s+/g, '');
        const char2Lower = char2.toLowerCase().replace(/\s+/g, '');
        const entryCharLower = charName.toLowerCase().replace(/\s+/g, '');
        if (entryCharLower.includes(char1Lower) || char1Lower.includes(entryCharLower)) charName = char1;
        else if (entryCharLower.includes(char2Lower) || char2Lower.includes(entryCharLower)) charName = char2;

        let line = (entry.line || '').replace(/\([^)]*\)/g, '').replace(/\[[^\]]*\]/g, '').replace(/\*[^*]*\*/g, '').trim();
        let ellipsisCount = 0;
        line = line.replace(/\.{3}/g, () => { ellipsisCount++; return ellipsisCount <= 1 ? '...' : '.'; });
        line = line.replace(/…/g, () => { ellipsisCount++; return ellipsisCount <= 1 ? '...' : '.'; });

        return { character: charName, line, emotion: entry.emotion || undefined };
      }).filter((entry: any) => entry.line.length > 0);

      console.log('Generated cinematic conversation:', cleanedConversation.length, 'lines');

      const dialogueByCharacter: Record<string, string> = {};
      dialogueByCharacter[char1] = cleanedConversation.filter((e: any) => e.character === char1).map((e: any) => e.line).join(' ');
      dialogueByCharacter[char2] = cleanedConversation.filter((e: any) => e.character === char2).map((e: any) => e.line).join(' ');

      return new Response(
        JSON.stringify({ conversation: cleanedConversation, dialogueByCharacter }),
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
    console.error('Error in generate-conversation-dialogue:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
