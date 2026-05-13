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
    const { outline, characterDescription, storyBible, movieLength = 'quick-reel' } = await req.json();
    
    if (!outline) {
      return new Response(
        JSON.stringify({ error: 'Movie outline is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Build character context from story bible or fallback to single character description
    let characterContext = '';
    let wardrobeContext = '';
    let dialogueMapContext = '';
    
    if (storyBible?.characters && Array.isArray(storyBible.characters)) {
      // Build comprehensive character context from story bible
      const characterDescriptions = storyBible.characters.map((char: any) => 
        `${char.name} (${char.role}): ${char.appearance}. WARDROBE: ${char.wardrobe}. Voice style: ${char.voiceStyle}. Personality: ${char.personality}.`
      ).join('\n');
      
      characterContext = `\n\nCRITICAL CHARACTER PROFILES (maintain consistency across ALL scenes):\n${characterDescriptions}`;
      
      // Wardrobe consistency notes
      wardrobeContext = storyBible.characters.map((char: any) => 
        `- ${char.name} ALWAYS wears: ${char.wardrobe}`
      ).join('\n');
      
      // Dialogue map for scene assignments
      if (storyBible.sceneDialogueMap && Array.isArray(storyBible.sceneDialogueMap)) {
        dialogueMapContext = '\n\nSCENE DIALOGUE ASSIGNMENTS:\n' + 
          storyBible.sceneDialogueMap.map((scene: any) => 
            `Scene ${scene.sceneNumber} "${scene.title}": ${scene.charactersPresent?.join(', ') || 'TBD'} - ${scene.conflict || ''}`
          ).join('\n');
      }
    } else if (characterDescription) {
      characterContext = `\n\nCRITICAL - MAIN CHARACTER (must appear in EVERY scene with this EXACT description): ${characterDescription}. Use this exact appearance description in every imagePrompt to maintain character consistency.`;
    }

    // Fix #5: Parse cinematography from outline if present
    let cinematographyContext = '';
    
    // Check for cinematography section in outline
    const cinematographyMatch = outline.match(/CINEMATOGRAPHY NOTES[:\s]*([\s\S]*?)(?=\n\n[A-Z]|\n---|\n##|$)/i);
    if (cinematographyMatch) {
      cinematographyContext = `\n\nCINEMATOGRAPHY FROM OUTLINE (MUST FOLLOW):\n${cinematographyMatch[1].trim()}`;
    }
    
    // Parse per-scene cinematography from outline (format: "Scene X: ... Cinematography: ...")
    const scenesCinematography: Record<number, string> = {};
    const sceneCinematographyRegex = /Scene\s+(\d+)[^]*?(?:Cinematography|Camera)[:\s]*([^\n]+(?:\n\s+-[^\n]+)*)/gi;
    let match;
    while ((match = sceneCinematographyRegex.exec(outline)) !== null) {
      scenesCinematography[parseInt(match[1])] = match[2].trim();
    }
    
    if (Object.keys(scenesCinematography).length > 0) {
      cinematographyContext += '\n\nPER-SCENE CINEMATOGRAPHY INSTRUCTIONS:\n' +
        Object.entries(scenesCinematography)
          .map(([num, cine]) => `Scene ${num}: ${cine}`)
          .join('\n');
    }

    // Claude API key checked by shared helper

    // Scene count based on movie length
    const sceneCountMap: Record<string, string> = {
      'quick-reel': '4-6',
      'short-story': '10-15',
      'short-film': '20-30',
      'full-movie': '40-60'
    };
    const targetSceneCount = sceneCountMap[movieLength] || '8-12';
    
    console.log(`Generating ${movieLength} scenes (${targetSceneCount}) from outline with story bible:`, !!storyBible, 'cinematography parsed:', !!cinematographyContext);

const systemPrompt = `You are an expert screenwriter and cinematographer specializing in creating immersive audiovisual experiences with KEYFRAME-BASED scene design. Your task is to break down a movie outline into detailed, cinematic scenes where each scene has a START FRAME and END FRAME for video generation.
${characterContext}
${wardrobeContext ? `\n\nWARDROBE CONSISTENCY (MUST be included in EVERY image prompt):\n${wardrobeContext}` : ''}
${dialogueMapContext}
${cinematographyContext}

For each scene, you must provide:
1. Scene number and title
2. Location and time of day
3. Detailed visual description (what the camera sees)
4. Character actions and emotions
5. Complete narration for voiceover (60-120 seconds of content)
6. START FRAME: The opening keyframe with image prompt, camera angle, and character position
7. END FRAME: The closing keyframe with image prompt, camera angle, and character position
8. TRANSITION: What action happens between frames and how the camera moves
9. The BEST lighting style for the scene based on mood and atmosphere

KEYFRAME DESIGN PRINCIPLES:
- START FRAME establishes the scene's beginning state
- END FRAME shows where the scene concludes (and should flow into the next scene's start)
- TRANSITION describes the action and camera movement connecting the frames
- For continuity: each scene's END should visually connect to the next scene's START

AVAILABLE CAMERA ANGLES (use for both start and end frames):
- "eye-level": Standard neutral perspective, good for dialogue
- "low-angle": Camera looks up, makes subject appear powerful or imposing
- "high-angle": Camera looks down, makes subject appear vulnerable
- "birds-eye": Directly overhead, dramatic establishing shots
- "dutch-angle": Tilted camera, creates tension and unease
- "over-shoulder": View from behind character, good for conversations
- "pov": Character's point of view, immersive moments
- "close-up": Tight shot on subject, emotional detail, intimate moments
- "wide-shot": Full scene establishing shot, grand locations
- "medium-shot": Waist-up framing, balanced general use

AVAILABLE CAMERA MOVEMENTS (for transitions):
- "static": Camera stays in place
- "tracking": Camera follows subject horizontally
- "push-in": Camera moves toward subject (dolly in)
- "pull-out": Camera moves away from subject (dolly out)
- "pan": Camera rotates horizontally
- "tilt": Camera rotates vertically
- "crane-up": Camera rises
- "crane-down": Camera lowers
- "orbit": Camera circles around subject

AVAILABLE LIGHTING STYLES (pick the most appropriate):
- "natural": Soft, realistic daylight
- "golden-hour": Warm sunset/sunrise glow, romantic or peaceful
- "blue-hour": Cool twilight atmosphere, mysterious
- "noir": High contrast, dramatic shadows, thriller/mystery
- "studio": Professional three-point setup, interviews
- "moonlight": Cool, ethereal night lighting
- "neon": Vibrant colored lights, cyberpunk/urban night
- "candlelight": Warm, flickering ambiance, intimate
- "overcast": Soft, diffused lighting, melancholy
- "harsh": Strong direct lighting, sharp shadows, confrontation

AVAILABLE MOODS (pick the most fitting):
- "tense": Suspenseful, thriller moments - Suggested music: Dark ambient, low drones, heartbeat sounds
- "romantic": Love, intimacy, connection - Suggested music: Soft piano, strings, gentle acoustic
- "action": Fast-paced, exciting, battles - Suggested music: Intense orchestral, driving percussion, electronic beats
- "melancholic": Sad, reflective, loss - Suggested music: Minor key piano, sorrowful strings, rain ambience
- "triumphant": Victory, achievement, climax - Suggested music: Epic orchestral, brass fanfares, uplifting choir
- "mysterious": Intrigue, secrets, unknown - Suggested music: Ethereal synths, subtle tension, whispered tones
- "peaceful": Calm, serene, contemplative - Suggested music: Ambient nature sounds, soft pads, gentle melody
- "horror": Fear, dread, supernatural - Suggested music: Dissonant strings, sudden stings, eerie silence
- "comedic": Funny, lighthearted, playful - Suggested music: Quirky instruments, upbeat tempo, playful melody
- "epic": Grand scale, important moment - Suggested music: Full orchestra, choir, powerful drums
- "nostalgic": Memory, past, bittersweet - Suggested music: Vintage sounds, music box, warm analog tones
- "inspiring": Hope, motivation, uplift - Suggested music: Rising crescendo, major key, building energy

DIALOGUE FORMAT — CRITICAL:
- Dialogue MUST be a CONVERSATION ARRAY with clearly labeled speakers
- Every single line must have the exact character name in the "character" field
- Each scene should have natural back-and-forth between characters
- Different characters MUST sound completely different — distinct vocabulary, rhythm, personality

DIALOGUE WRITING RULES (MANDATORY):
1. EVERY LINE IS LABELED: {"character": "ExactName", "line": "Their words", "emotion": "delivery direction"}
2. NO EXCESSIVE ELLIPSES: Maximum ONE "..." per entire scene. Use periods and commas for pacing.
   - WRONG: "I just... I don't know... maybe we should..."
   - RIGHT: "I don't know. Maybe we should go."
3. SOUND LIKE REAL ACTORS: Write how real people talk in emotional moments — not robotic AI text.
4. DISTINCT VOICES: A tough character sounds different from a nervous one. Match personality to dialogue style.
5. EMOTIONAL DIRECTION: Include "emotion" field with specific, actable direction: "angry but controlled", "quiet devastation", "sarcastic", "barely holding it together"
6. NO STAGE DIRECTIONS in the "line" field — no (sighs), [pauses], *whispers*. The "emotion" field handles delivery.
7. NATURAL RHYTHM: Mix short punchy lines ("No. Not anymore.") with longer flowing ones.
8. SUBTEXT: Characters hint at deeper meanings, don't over-explain everything.
9. EVERY LINE MATTERS: No filler. Each line reveals character, builds tension, or moves the story.
10. CONVERSATIONAL FLOW: Characters react to each other, interrupt, push back. Not random lines stacked together.

DIALOGUE EXAMPLE (follow this quality):
[
  {"character": "Marcus", "line": "You should have told me the truth.", "emotion": "low, frustrated"},
  {"character": "Ava", "line": "I was trying to protect you.", "emotion": "hurt, defensive"},
  {"character": "Marcus", "line": "No. You were protecting yourself.", "emotion": "sharper now"},
  {"character": "Ava", "line": "That's not fair.", "emotion": "voice shaking"},
  {"character": "Marcus", "line": "Maybe not. But it's true.", "emotion": "quiet, disappointed"}
]

CRITICAL: Return ONLY a valid JSON array with this exact structure (no markdown, no code blocks):
[
  {
    "sceneNumber": 1,
    "title": "Opening Scene Title",
    "location": "Location description",
    "timeOfDay": "Day/Night/Dawn/Dusk",
    "description": "Detailed description of what happens in this scene",
    "charactersInScene": ["Character1", "Character2"],
    "dialogue": [
      { "character": "Maria", "line": "We need to find the key before sunset.", "emotion": "urgent" },
      { "character": "James", "line": "Are you sure this is the right place?", "emotion": "doubtful" },
      { "character": "Maria", "line": "Trust me. I know what I'm doing.", "emotion": "confident, steely" }
    ],
    "narration": "Optional scene narration or voiceover...",
    "startFrame": {
      "imagePrompt": "Detailed prompt for START frame. MUST include character wardrobes from story bible.",
      "cameraAngle": "wide-shot",
      "position": "Character standing at left of frame, facing right"
    },
    "endFrame": {
      "imagePrompt": "Detailed prompt for END frame. MUST include character wardrobes from story bible.",
      "cameraAngle": "close-up",
      "position": "Character now center frame, facing camera"
    },
    "transitionAction": "Character walks forward toward the camera while speaking",
    "transitionCameraMovement": "push-in",
    "imagePrompt": "Fallback single image prompt with ALL character wardrobes included",
    "selectedCameraAngle": "close-up",
    "selectedLighting": "golden-hour",
    "mood": "romantic",
    "suggestedMusic": "Soft piano with gentle strings, warm and intimate atmosphere",
    "ambientSound": "Distant café chatter, espresso machine hiss, soft jazz on the speakers, faint traffic from the street outside",
    "backgroundChatter": [
      "Two voices murmuring about a deadline at a nearby table",
      "A barista calling out an order: 'Oat flat white for Daniel'",
      "A laptop keyboard tapping rhythmically off-screen"
    ],
    "connectsTo": 2
  }
]

IMPORTANT FORMATTING RULES:
- Dialogue MUST be an array of conversation turns with character, line, and emotion fields
- Character names in dialogue MUST exactly match names in charactersInScene
- Different characters should sound different based on their voiceStyle from the story bible
- NO character speaks to themselves — scenes must have actual conversations
- Make scenes 60-120 seconds when narration + dialogue are spoken
- ALWAYS include startFrame, endFrame, transitionAction, and transitionCameraMovement
- The END frame of scene N should visually connect to the START frame of scene N+1
- Include "connectsTo" field with the next scene number for continuity
- startFrame and endFrame must each have imagePrompt, cameraAngle, and position
- Image prompts MUST include character wardrobes exactly as defined in the story bible
- suggestedMusic should be specific and match the mood
- ambientSound is REQUIRED: 1–2 sentence soundscape describing the room tone, weather, off-screen activity, props making sound, etc. Make it filmic and specific to the location.
- backgroundChatter is REQUIRED: 2–4 short overheard lines/sounds from people OR objects NOT in charactersInScene (e.g. a TV news anchor, a barista, kids playing outside, a phone buzzing). Use straight ASCII quotes ' instead of " inside these strings.

Return ONLY the JSON array, no other text or formatting.`;

    // Variation seed so identical inputs produce fresh creative interpretations each run
    const variationSeed = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

    const userPrompt = `Based on this movie outline, generate ${targetSceneCount} key cinematic scenes.

${outline}

CREATIVE VARIATION SEED: ${variationSeed}
Use this seed to make this generation feel fresh — vary camera angles, blocking, lighting choices, opening lines, and pacing compared to a typical interpretation. Surprise me with bold, distinct creative choices while staying true to the story.

Return a JSON OBJECT (not a bare array) with this exact shape:
{ "scenes": [ {...scene1}, {...scene2}, ... ] }

CRITICAL JSON SAFETY RULES:
- All strings MUST be valid JSON: escape every internal double-quote as \\" and every backslash as \\\\.
- Do NOT use smart/curly quotes ("" '') anywhere — use straight ASCII quotes only.
- Do NOT use unescaped newlines inside strings.
- Prefer single straight quotes ' inside dialogue lines instead of double quotes to avoid escaping issues.
- No markdown, no code fences, no commentary — only the JSON object.`;

    try {
      // Use Lovable AI Gateway directly with strict JSON mode for reliable parsing
      const apiKey = Deno.env.get('LOVABLE_API_KEY');
      if (!apiKey) throw new ClaudeError('LOVABLE_API_KEY is not configured', 500);

      const gwRes = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'google/gemini-2.5-flash',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          max_tokens: 16000,
          temperature: 0.95,
          response_format: { type: 'json_object' },
        }),
      });

      if (!gwRes.ok) {
        const errText = await gwRes.text();
        console.error('Gateway error:', gwRes.status, errText);
        throw new ClaudeError(`AI gateway error: ${errText}`, gwRes.status);
      }

      const gwJson = await gwRes.json();
      let generatedContent: string = gwJson?.choices?.[0]?.message?.content || '';

      if (!generatedContent) {
        throw new Error('No content generated');
      }

      console.log('Raw AI response length:', generatedContent.length);

    // Strip optional code fences if model added them
    const fenceMatch = generatedContent.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (fenceMatch) generatedContent = fenceMatch[1];
    generatedContent = generatedContent.trim();

    let parsed: any;
    try {
      parsed = JSON.parse(generatedContent);
    } catch (e) {
      // Last-resort cleanup: strip control chars + trailing commas
      const cleaned = generatedContent
        .replace(/^\uFEFF/, '')
        .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g, '')
        .replace(/,\s*([\]}])/g, '$1');
      try {
        parsed = JSON.parse(cleaned);
      } catch (e2) {
        console.error('JSON parse failed. Preview:', generatedContent.substring(0, 800));
        throw new Error(`Failed to parse AI response: ${e2 instanceof Error ? e2.message : 'Unknown error'}`);
      }
    }

    // Accept either {scenes:[...]} (json_object mode) or a bare array
    const scenes = Array.isArray(parsed) ? parsed : parsed?.scenes;
    if (!Array.isArray(scenes) || scenes.length === 0) {
      throw new Error('Invalid scenes format - expected non-empty array');
    }

    console.log(`Successfully generated ${scenes.length} scenes`);

    return new Response(
      JSON.stringify({ scenes }),
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

  } catch (error: any) {
    console.error('Error in generate-movie-scenes:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Failed to generate scenes' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
