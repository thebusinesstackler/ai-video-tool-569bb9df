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
      storyBible, movieIdea, scenePosition, previousSceneSummary, characterPersonalities, transitionAction,
      // Reels/Stories conversation mode
      topic, exchanges,
    } = await req.json();

    // ─── Validate ────────────────────────────────────────────────────────────
    if (!Array.isArray(characterNames) || characterNames.length < 2) {
      throw new Error('characterNames must be an array of at least 2 names');
    }
    if (characterNames.length > 4) {
      throw new Error('Maximum 4 speakers supported');
    }
    const description = sceneDescription || topic;
    if (!description) throw new Error('sceneDescription or topic is required');

    const speakers = characterNames.slice(0, 4);
    const numExchanges = Math.max(4, Math.min(Number(exchanges) || 8, 14));
    console.log(`Generating ${numExchanges} exchanges between ${speakers.length} speakers:`, speakers.join(', '));

    // ─── Context for movie-style dialogue (optional) ────────────────────────
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
      characterContext = Object.entries(characterPersonalities)
        .map(([name, personality]) => `${name}: ${personality}`)
        .join('\n');
    }

    let sceneTypeGuidance = '';
    if (scenePosition) {
      const sp = String(scenePosition).toLowerCase();
      if (sp.includes('1 of') || sp.includes('opening')) sceneTypeGuidance = 'OPENING scene — establish the characters and their dynamic.';
      else if (sp.includes('climax')) sceneTypeGuidance = 'CLIMAX scene — maximum emotional stakes.';
      else if (sp.includes('resolution') || sp.includes('final')) sceneTypeGuidance = 'RESOLUTION scene — emotional payoff, closure.';
    }

    const speakerList = speakers.map((s, i) => `${i + 1}. ${s}`).join('\n');
    const exampleSpeaker1 = speakers[0];
    const exampleSpeaker2 = speakers[1];

    const prompt = `You are writing dialogue for a real video scene between ${speakers.length} speakers.

${storyContext ? `STORY CONTEXT:\n${storyContext}\n` : ''}
SPEAKERS:
${speakerList}
${characterContext ? `\nCHARACTER PERSONALITIES:\n${characterContext}\n` : ''}
${sceneTitle ? `SCENE: "${sceneTitle}"` : ''}
${location ? `LOCATION: ${location}${timeOfDay ? ` — ${timeOfDay}` : ''}` : ''}
${tone ? `MOOD: ${tone}` : ''}
${scenePosition ? `POSITION IN STORY: ${scenePosition}` : ''}
${sceneTypeGuidance ? `\n${sceneTypeGuidance}` : ''}
${transitionAction ? `WHAT HAPPENS: ${transitionAction}` : ''}

CONVERSATION TOPIC / SCENE:
${description}

WRITING RULES:
1. EVERY LINE MUST BE LABELED with one of the exact speaker names above.
2. Each speaker has a distinct voice, vocabulary, rhythm, and POV — they should not sound interchangeable.
3. Rotate naturally between all ${speakers.length} speakers. Do not leave anyone silent.
4. Maximum ONE ellipsis ("...") in the entire conversation.
5. Mix short punchy lines with longer flowing ones.
6. Include an "emotion" field per line (e.g., "skeptical", "excited", "soft and curious").
7. NO stage directions or parentheticals inside "line" — only spoken words.
8. Every line must matter. No filler.
9. Generate roughly ${numExchanges} exchanges (around ${numExchanges * 1.5}–${numExchanges * 2} total lines).

Return ONLY a valid JSON array, no commentary:
[
  {"character": "${exampleSpeaker1}", "line": "Their exact words.", "emotion": "specific emotional direction"},
  {"character": "${exampleSpeaker2}", "line": "Their response.", "emotion": "specific emotional direction"}
]`;

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

      let conversation;
      try {
        conversation = JSON.parse(dialogueContent);
      } catch {
        const jsonMatch = dialogueContent.match(/\[[\s\S]*\]/);
        if (jsonMatch) conversation = JSON.parse(jsonMatch[0]);
        else throw new Error('Could not parse dialogue response as JSON');
      }

      if (!Array.isArray(conversation)) throw new Error('Dialogue response is not an array');

      // ─── Normalize character names to one of the requested speakers ────────
      const lowerSpeakers = speakers.map(s => ({ name: s, lower: s.toLowerCase().replace(/\s+/g, '') }));
      const cleanedConversation = conversation
        .map((entry: any) => {
          const rawName = (entry.character || '').toString();
          const rawLower = rawName.toLowerCase().replace(/\s+/g, '');
          let matched = lowerSpeakers.find(s => s.lower === rawLower)?.name;
          if (!matched) matched = lowerSpeakers.find(s => rawLower.includes(s.lower) || s.lower.includes(rawLower))?.name;
          const character = matched || speakers[0];

          let line = (entry.line || '')
            .replace(/\([^)]*\)/g, '')
            .replace(/\[[^\]]*\]/g, '')
            .replace(/\*[^*]*\*/g, '')
            .trim();
          let ellipsisCount = 0;
          line = line.replace(/\.{3}/g, () => { ellipsisCount++; return ellipsisCount <= 1 ? '...' : '.'; });
          line = line.replace(/…/g, () => { ellipsisCount++; return ellipsisCount <= 1 ? '...' : '.'; });

          return { character, line, emotion: entry.emotion || undefined };
        })
        .filter((e: any) => e.line.length > 0);

      console.log(`Generated conversation: ${cleanedConversation.length} lines across ${speakers.length} speakers`);

      // Per-character concatenated dialogue (legacy contract for MovieSceneCreator)
      const dialogueByCharacter: Record<string, string> = {};
      for (const s of speakers) {
        dialogueByCharacter[s] = cleanedConversation
          .filter((e: any) => e.character === s)
          .map((e: any) => e.line)
          .join(' ');
      }

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
