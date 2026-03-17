import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface IntroOutroConfig {
  introTemplate?: string;
  introText?: string;
  outroTemplate?: string;
  outroText?: string;
}

// Dynamic hook categories for engaging openings
const HOOK_CATEGORIES = [
  { type: 'bold_claim', examples: ['This changed everything for me...', 'Nobody tells you this but...', 'I discovered something insane...'] },
  { type: 'question', examples: ['Why does everyone get this wrong?', 'Have you ever wondered why...', 'What if I told you...'] },
  { type: 'controversy', examples: ['Unpopular opinion:', 'Everyone says this but they\'re wrong...', 'I\'m about to break the internet...'] },
  { type: 'story', examples: ['I was skeptical until...', 'Three months ago I had no idea...', 'Here\'s what happened when...'] },
  { type: 'secret', examples: ['The secret nobody talks about...', 'I\'m revealing something huge...', 'They don\'t want you to know...'] },
  { type: 'countdown', examples: ['3 things you NEED to know...', '5 mistakes you\'re making right now...', 'The top 3 reasons why...'] },
  { type: 'challenge', examples: ['I bet you didn\'t know...', 'Prove me wrong on this...', 'Try this and thank me later...'] },
  { type: 'fomo', examples: ['You\'re probably making this mistake...', 'If you\'re not doing this, you\'re behind...', 'Everyone else already knows...'] },
  { type: 'social_proof', examples: ['10 million people learned this...', 'Top creators use this trick...', 'The viral method that...'] },
  { type: 'curiosity', examples: ['The real reason why...', 'Here\'s the truth about...', 'What they don\'t teach you...'] },
  { type: 'urgency', examples: ['Before it\'s too late...', 'This is time-sensitive...', 'Watch before they take it down...'] },
  { type: 'personal', examples: ['My honest experience with...', 'I tested this for 30 days...', 'The thing I wish I knew earlier...'] },
];

// Camera angle variations for visual interest
const CAMERA_ANGLES = [
  { scene: 1, angle: 'close-up, eye-level, direct engagement with viewer', purpose: 'Hook - immediate connection' },
  { scene: 2, angle: 'medium shot, slightly low angle, confident framing', purpose: 'Setup - establish authority' },
  { scene: 3, angle: 'wide establishing shot, then cut to close-up detail', purpose: 'Context - show environment' },
  { scene: 4, angle: 'over-the-shoulder or dynamic 3/4 profile', purpose: 'Body - visual variety' },
  { scene: 5, angle: 'close-up with subtle push-in motion', purpose: 'Climax - emphasis' },
  { scene: 6, angle: 'medium shot, direct address, call-to-action framing', purpose: 'CTA - engagement' },
];

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { 
      topic, 
      sceneCount = 4, 
      sceneDuration,
      targetDuration = 30,
      introConfig,
      outroConfig,
      hookStyle,
      enableCutScenes = false,
      characterDescription,
      isPodcastMode = false,
      characterId,
      characterName
    } = await req.json();

    if (!topic) {
      return new Response(
        JSON.stringify({ error: 'Topic is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    console.log('Generating reel script for topic:', topic);
    console.log('Scene count:', sceneCount, 'Scene duration:', sceneDuration || 'auto');
    console.log('Hook style:', hookStyle || 'auto');
    console.log('Cut scenes enabled:', enableCutScenes);
    console.log('Character description:', characterDescription || 'not specified');
    console.log('Podcast mode:', isPodcastMode, 'Character:', characterName || 'none');
    console.log('Intro config:', introConfig);
    console.log('Outro config:', outroConfig);

    // Handle Podcast Mode - single long-form monologue
    if (isPodcastMode) {
      const durationSeconds = sceneDuration || targetDuration;
      const wordsPerSecond = 2.5;
      const targetWords = Math.round(durationSeconds * wordsPerSecond);
      
      const podcastSystemPrompt = `You are a professional podcast scriptwriter creating an engaging monologue.

${characterName ? `CHARACTER: ${characterName}` : ''}
${characterDescription ? `CHARACTER DESCRIPTION: ${characterDescription}
- The speaker should have a personality consistent with this description
- All visual descriptions must show THIS EXACT character` : ''}

SCRIPT REQUIREMENTS:
- Write a natural, conversational monologue of approximately ${targetWords} words
- Duration target: ${durationSeconds} seconds when spoken at normal pace
- The content should feel like a genuine podcast segment, not a formal presentation
- Use natural pauses, rhetorical questions, and engaging hooks throughout
- Write in first person, as if speaking directly to the viewer/listener
- Include natural transitions: "And here's the thing...", "But wait...", "Now, let me tell you..."
- Build to a satisfying conclusion or call-to-action

TONE:
- Conversational and authentic
- Engaging and personal
- Informative but not preachy
- Natural flow with varied sentence lengths

OUTPUT FORMAT:
Return a JSON array with exactly 1 scene:
[
  {
    "sceneNumber": 1,
    "narration": "The full podcast script here (${targetWords} words)",
    "visualDescription": "Single consistent shot of the speaker. ${characterDescription || 'Professional person'} speaking directly to camera with warm lighting. Medium close-up, slight depth of field, modern studio or home office background.",
    "duration": ${durationSeconds},
    "isPodcast": true
  }
]`;

      const podcastUserPrompt = `Write a ${Math.round(durationSeconds / 60)}-minute podcast-style monologue about: "${topic}"

The script should be approximately ${targetWords} words and feel natural when spoken aloud.

Remember:
- Start with an engaging hook that draws viewers in
- Build through the content naturally
- End with a memorable conclusion or call-to-action
- The entire script will be spoken by one person looking at the camera`;

      const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${LOVABLE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'google/gemini-2.5-flash',
          messages: [
            { role: 'system', content: podcastSystemPrompt },
            { role: 'user', content: podcastUserPrompt }
          ],
          max_tokens: 8192, // Larger for long-form content
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('AI Gateway error:', response.status, errorText);
        
        if (response.status === 429) {
          return new Response(
            JSON.stringify({ error: 'Rate limit exceeded. Please try again in a moment.' }),
            { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        if (response.status === 402) {
          return new Response(
            JSON.stringify({ error: 'API credits exhausted. Please add credits to continue.' }),
            { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        throw new Error(`AI Gateway error: ${response.status}`);
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content;

      if (!content) {
        throw new Error('No content in AI response');
      }

      console.log('Raw podcast AI response length:', content.length);

      // Extract JSON from the response
      let jsonContent = content;
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        jsonContent = jsonMatch[1].trim();
      } else {
        const arrayMatch = content.match(/\[\s*\{[\s\S]*\}\s*\]/);
        if (arrayMatch) {
          jsonContent = arrayMatch[0];
        }
      }
      
      jsonContent = jsonContent.replace(/[\u0000-\u001F\u007F-\u009F]/g, ' ').trim();

      let scenes;
      try {
        scenes = JSON.parse(jsonContent);
      } catch (parseError) {
        console.error('JSON parse error:', parseError);
        // Create a fallback scene with the raw content
        scenes = [{
          sceneNumber: 1,
          narration: content.replace(/```[\s\S]*?```/g, '').replace(/\[[\s\S]*?\]/g, '').trim().slice(0, targetWords * 6),
          visualDescription: `${characterDescription || 'Professional person'} speaking directly to camera with warm lighting. Medium close-up, slight depth of field.`,
          duration: durationSeconds,
          isPodcast: true
        }];
      }

      // Apply TTS formatting to podcast scenes before returning
      scenes = scenes.map((scene: any) => ({
        ...scene,
        narration: formatScriptForTTS(scene.narration || '')
      }));

      console.log('Generated podcast scenes:', scenes.length, 'Narration length:', scenes[0]?.narration?.length);

      return new Response(
        JSON.stringify({ scenes }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Calculate scene duration - use provided value or calculate from target duration
    const introDuration = introConfig?.introTemplate && introConfig.introTemplate !== 'none' ? 3 : 0;
    const outroDuration = outroConfig?.outroTemplate && outroConfig.outroTemplate !== 'none' ? 3 : 0;
    const contentDuration = targetDuration - introDuration - outroDuration;
    
    // Use explicit sceneDuration if provided, otherwise calculate from total
    const finalSceneDuration = sceneDuration || Math.round(contentDuration / sceneCount);
    
    // Calculate word count based on scene duration
    // At 0.6x speed, about 2.5 words per second
    const wordsPerSecond = 2.5;
    const maxWordsPerScene = Math.round(finalSceneDuration * wordsPerSecond);
    const minWordsPerScene = Math.round(maxWordsPerScene * 0.8);

    // Generate dynamic hook guidance based on style
    const hookGuidance = generateHookGuidance(hookStyle, topic);
    
    // Generate camera angle instructions
    const cameraInstructions = generateCameraInstructions(sceneCount);
    
    // Cut scene instructions
    const cutSceneInstructions = enableCutScenes ? `
CUT SCENE RULES (IMPORTANT):
- After every 2 main content scenes, insert a 1-2 second "cut scene" 
- Cut scenes have NO narration (empty string), only visual description
- Cut scene types: B-roll relevant to topic, quick zoom transition, text emphasis overlay, reaction shot
- Mark cut scenes with "isCutScene": true
- Cut scenes should be visually dynamic and add energy
` : '';

    // Character consistency instructions
    const characterInstructions = characterDescription ? `
CHARACTER CONSISTENCY (CRITICAL - ABSOLUTE HIGHEST PRIORITY):
The user has specified this EXACT character: "${characterDescription}"
- EVERY single visualDescription MUST start with this character's description
- NEVER change the gender, age, ethnicity, hair, skin tone, or ANY physical traits
- NEVER substitute a different person — if the user specified "female", ALL scenes show a FEMALE
- If the user specified "male", ALL scenes show a MALE — no exceptions
- Copy the character description VERBATIM into every visualDescription, then add scene-specific actions
- Example: If description says "Young Black woman with braids, wearing a white blazer" — EVERY scene begins with "Young Black woman with braids, wearing a white blazer..."
- VALIDATION: Before returning, verify that EVERY visualDescription contains the character's gender and key traits
- If ANY scene shows a different person than described, the ENTIRE output is REJECTED
` : '';

    const systemPrompt = `You are a WORLD-CLASS short-form video scriptwriter and cinematographer creating PREMIUM, award-winning social media content. Think Super Bowl commercial quality meets viral TikTok energy.

CRITICAL STORY RULES:
- ALL scenes MUST tell ONE continuous, emotionally compelling story about the SAME topic
- Each scene builds dramatic tension - think mini-movie structure
- No scene should repeat what another scene says
- Scene flow: Hook (pattern interrupt) → Emotional setup → Core revelation → Powerful payoff/CTA
- Write ${minWordsPerScene}-${maxWordsPerScene} words per scene to fill the full ${finalSceneDuration} seconds

${hookGuidance}

NARRATION RULES:
- The "narration" field contains ONLY the exact words to be spoken aloud
- NO analysis, NO descriptions, NO stage directions, NO parentheticals
- Write in first person, conversational, as if speaking directly to the viewer
- Every word will be spoken slowly - write naturally flowing sentences
- Use transitional phrases between ideas: "And here's the thing...", "But wait...", "So what does this mean?"

## MANDATORY TTS FORMATTING (STRICTLY ENFORCED):

RULES FOR ALL NARRATION TEXT:
1. Use ONLY commas (,) and question marks (?) for pauses and rhythm
2. NEVER use periods (.) — they cause TTS to add "s" sounds making words plural
3. NEVER use em dashes (—) or double hyphens (--) — they cause 4-second silences in TTS
4. NEVER use ellipses (...) — they cause unnatural long pauses in TTS
5. Use commas for breathing pauses: "You know what, this changes everything, trust me"
6. Use question marks naturally: "But why does nobody talk about this?"
7. End sentences with commas or let them flow into the next thought
8. Write flowing, conversational sentences connected by commas

WRONG (causes TTS errors):
"You're probably wrestling with which CTMS is right... It's a jungle out there—"

CORRECT (natural TTS flow):
"You're probably wrestling with which CTMS is right, it's a jungle out there, you see countless options"

MORE CORRECT EXAMPLES:
- "Hey everyone, let me tell you something that changed my entire perspective"
- "But here's the thing, nobody talks about this, and it's a game changer"
- "So what does this mean for you, well let me break it down"

${cameraInstructions}

${characterInstructions}

BACKGROUND CONSISTENCY (CRITICAL):
- Use ONE consistent background/environment across ALL scenes
- Describe the SAME setting, lighting conditions, and atmosphere for every scene
- Only change camera angle and character pose, NOT the environment
- Example: If scene 1 is in a modern office, ALL scenes must be in that same modern office

NO TEXT IN VISUALS (CRITICAL):
- Visual descriptions must NEVER include text, captions, subtitles, titles, or written words
- Do NOT describe text overlays, text animations, or any form of written content in visualDescription
- If showing people, describe them with CLOSED MOUTHS or slight smiles - NEVER speaking, talking, or mouthing words
- The voiceover audio is separate - the visuals should show people performing TOPIC-RELEVANT actions - NOT speaking
- Show the character doing activities DIRECTLY RELATED to the narration topic:
  * Marketing topic → character at laptop with analytics dashboard, pointing at whiteboard with strategy diagrams
  * Fitness topic → character in gym environment, with workout equipment, stretching
  * Cooking topic → character in kitchen with ingredients, plating food
  * Business topic → character at desk reviewing documents, in boardroom setting
  * Tech topic → character with devices, coding on screen, presenting prototype
- NEVER default to "holding a bottle" or "holding a product" unless the topic is specifically about that product
- visualDescription must NEVER include "holding a bottle", "holding a product", "holding a supplement", or any prop in the character's hands unless the topic explicitly involves that specific item
- Characters' hands should be natural and empty — gesturing, resting, or interacting with topic-relevant items ONLY
- If you catch yourself writing "holding" + any generic object, REMOVE IT and replace with a natural pose or topic-relevant action

VISUAL-NARRATIVE ALIGNMENT (CRITICAL):
- The visualDescription MUST visually represent what the narration is discussing
- Ask yourself: "If someone watched this scene on MUTE, would they understand the topic?"
- Props, environment, and actions must match the subject matter of the narration
- Each scene's visual should illustrate the specific point being made in that scene's narration
- NEVER use generic stock-photo poses unrelated to the content

VISUAL STYLE (keep it simple):
- Every visualDescription must follow this format:
  - SUBJECT: Who/what, their action, expression, pose
  - SETTING: Location and key props relevant to the topic
  - MOOD: Lighting quality and color tone (2-3 words max)
- Do NOT include lens mm, f-stop numbers, camera brand names, or particle effects
- Focus on what the viewer SEES, not technical camera specs
- Keep descriptions under 50 words

VISUAL CONTINUITY:
- If showing a person/character, describe them IDENTICALLY in each scene
- Same clothing, same features, same styling throughout
- Only camera angle and pose should change between scenes

${cutSceneInstructions}`;

    const userPrompt = `Write ${sceneCount} scenes for a reel about: "${topic}"
Each scene should be approximately ${finalSceneDuration} seconds when narrated.

STORY FLOW (each scene MUST connect to the next):
- Scene 1 (HOOK): ${hookGuidance.includes('question') ? 'Ask a provocative question' : 'Grab attention with a bold statement'} that makes them stop scrolling
- Scene 2-${sceneCount-1} (BODY): Build the story, each adding NEW information that expands on the hook
- Scene ${sceneCount} (CLOSE): Write a SPOKEN closing that naturally wraps up the topic. NOT just "Follow for more" — instead:
  * Tie back to the hook promise ("Remember when I said X? Here's your next step...")
  * Deliver a topic-specific takeaway the viewer can act on
  * Weave the call-to-action into natural speech ("If you want more strategies like this... you know what to do—")
  * The CTA should feel like a natural conclusion to the story, not a generic sign-off

NARRATION REQUIREMENTS:
- Write ${minWordsPerScene}-${maxWordsPerScene} words per scene (this fills ${finalSceneDuration} seconds when spoken)
- Write conversational sentences that flow naturally when spoken
- Each scene should transition smoothly to the next
- Use complete thoughts and natural pauses
- IMPORTANT: Scene 1 must use a creative, engaging hook - NOT just "Stop scrolling"

${enableCutScenes ? `
CUT SCENES:
- Insert 1-2 cut scenes between main content (marked with isCutScene: true)
- Cut scenes have empty narration ("") and are 1-2 seconds
- Use them for B-roll, transitions, or emphasis moments
` : ''}

VISUAL RULES:
- Use ONE consistent visual style AND background across all scenes
- If showing a person, describe them identically each scene
- Camera angle should vary per scene for visual interest:
${CAMERA_ANGLES.slice(0, sceneCount).map(c => `  Scene ${c.scene}: ${c.angle}`).join('\n')}

CRITICAL VALIDATION BEFORE RETURNING:
- Verify narration contains ZERO periods, ZERO em dashes (—), ZERO ellipses (...)
- Only commas and question marks for pauses
- Write flowing conversational sentences
- Scene 1 HOOK narration must be a COMPLETE, compelling sentence (15+ words minimum), not a fragment like "I" or "Hook:"

Return ONLY valid JSON array:
[
  {
    "sceneNumber": 1,
    "narration": "Write ${minWordsPerScene}-${maxWordsPerScene} words here using ONLY commas and question marks, NO periods, NO em dashes, NO ellipses",
    "visualDescription": "SUBJECT: ${characterDescription ? `${characterDescription}, ` : ''}[action relevant to narration topic, closed mouth, natural expression]. SETTING: [location and key props matching the topic]. MOOD: [lighting and color tone in 2-3 words].${characterDescription ? ` CRITICAL: The SUBJECT must be ${characterDescription} — do NOT use a different person.` : ''}",
    "duration": ${finalSceneDuration},
    "cameraAngle": "close-up, eye-level"${enableCutScenes ? ',\n    "isCutScene": false' : ''}
  }
]`;

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-pro',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        max_tokens: 4096,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI Gateway error:', response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded. Please try again in a moment.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: 'API credits exhausted. Please add credits to continue.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      throw new Error(`AI Gateway error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error('No content in AI response');
    }

    console.log('Raw AI response:', content.substring(0, 500));

    // Extract JSON from the response
    let jsonContent = content;
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonContent = jsonMatch[1].trim();
    } else {
      const arrayMatch = content.match(/\[\s*\{[\s\S]*\}\s*\]/);
      if (arrayMatch) {
        jsonContent = arrayMatch[0];
      }
    }
    
    // Safe cleanup
    jsonContent = jsonContent
      .replace(/[\u0000-\u001F\u007F-\u009F]/g, ' ')
      .trim();

    // Parse the scenes with error handling
    let scenes;
    try {
      scenes = JSON.parse(jsonContent);
    } catch (parseError) {
      console.error('JSON parse error:', parseError);
      console.error('Attempted to parse:', jsonContent.substring(0, 500));
      
      try {
        let fixedJson = jsonContent
          .replace(/,\s*([}\]])/g, '$1')
          .replace(/'/g, '"');
        scenes = JSON.parse(fixedJson);
      } catch (retryError) {
        console.error('Retry parse also failed:', retryError);
        throw new Error('Failed to parse AI response as JSON. Please try again.');
      }
    }

    if (!Array.isArray(scenes) || scenes.length === 0) {
      throw new Error('Invalid scenes format');
    }

    // Extract visual style from first scene for consistency
    const baseVisualStyle = extractVisualStyle(scenes[0]?.visualDescription || '');
    const baseBackground = extractBackground(scenes[0]?.visualDescription || '');
    console.log('Base visual style extracted:', baseVisualStyle);
    console.log('Base background extracted:', baseBackground);

    // Ensure background consistency and format narration for TTS across all scenes
    scenes = scenes.map((scene: any, index: number) => {
      const cameraAngle = CAMERA_ANGLES[index] || CAMERA_ANGLES[CAMERA_ANGLES.length - 1];
      return {
        ...scene,
        narration: formatScriptForTTS(scene.narration || ''),
        visualDescription: ensureBackgroundConsistency(scene.visualDescription, baseBackground, cameraAngle.angle),
        cameraAngle: scene.cameraAngle || cameraAngle.angle
      };
    });

    // Renumber scenes to account for intro
    const hasIntro = introConfig?.introTemplate && introConfig.introTemplate !== 'none';
    const hasOutro = outroConfig?.outroTemplate && outroConfig.outroTemplate !== 'none';

    if (hasIntro) {
      scenes = scenes.map((scene: any, index: number) => ({
        ...scene,
        sceneNumber: index + 2
      }));

      const introNarration = introConfig.introText || getDefaultIntroText(introConfig.introTemplate, topic, hookStyle);
      const introScene = {
        sceneNumber: 1,
        narration: formatScriptForTTS(introNarration),
        visualDescription: getIntroVisualDescription(introConfig.introTemplate, topic, baseVisualStyle),
        duration: 3,
        isIntro: true,
        templateId: introConfig.introTemplate,
        cameraAngle: 'close-up, direct engagement'
      };
      scenes.unshift(introScene);
    }

    if (hasOutro) {
      const outroNarration = formatScriptForTTS(outroConfig.outroText || getDefaultOutroText(outroConfig.outroTemplate, topic));
      
      const outroScene = {
        sceneNumber: scenes.length + 1,
        narration: outroNarration,
        visualDescription: getOutroVisualDescription(outroConfig.outroTemplate, baseVisualStyle, topic, characterDescription),
        duration: 2,
        isOutro: true,
        templateId: outroConfig.outroTemplate,
        cameraAngle: 'medium shot, call-to-action framing'
      };
      scenes.push(outroScene);
      
      const ctaHoldScene = {
        sceneNumber: scenes.length + 1,
        narration: '',
        visualDescription: getOutroVisualDescription(outroConfig.outroTemplate, baseVisualStyle, topic, characterDescription),
        duration: 2,
        isOutro: true,
        isSilentCTA: true,
        templateId: outroConfig.outroTemplate,
        cameraAngle: 'medium shot, hold on CTA'
      };
      scenes.push(ctaHoldScene);
    }

    console.log('Generated scenes:', scenes.length, 'with intro:', hasIntro, 'outro:', hasOutro);

    return new Response(
      JSON.stringify({ scenes }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error generating reel script:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Failed to generate script' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// Generate hook guidance based on selected style or auto-select
function generateHookGuidance(hookStyle: string | undefined, topic: string): string {
  if (!hookStyle || hookStyle === 'auto') {
    // Auto-select based on topic keywords
    const topicLower = topic.toLowerCase();
    if (topicLower.includes('secret') || topicLower.includes('hidden')) {
      return getHookGuidance('secret');
    } else if (topicLower.includes('mistake') || topicLower.includes('wrong')) {
      return getHookGuidance('fomo');
    } else if (topicLower.includes('why') || topicLower.includes('how')) {
      return getHookGuidance('question');
    } else if (topicLower.includes('tips') || topicLower.includes('ways')) {
      return getHookGuidance('countdown');
    } else if (topicLower.includes('story') || topicLower.includes('experience')) {
      return getHookGuidance('story');
    }
    // Default to bold claim
    return getHookGuidance('bold_claim');
  }
  return getHookGuidance(hookStyle);
}

function getHookGuidance(hookType: string): string {
  const category = HOOK_CATEGORIES.find(c => c.type === hookType) || HOOK_CATEGORIES[0];
  return `
HOOK STYLE: ${hookType.toUpperCase().replace('_', ' ')}
Use this opening style for Scene 1:
- Examples: "${category.examples.join('", "')}"
- DO NOT use "Stop scrolling" - be more creative and specific to the topic
- Make it intriguing, surprising, or emotionally compelling
- The hook should directly relate to the topic content`;
}

function generateCameraInstructions(sceneCount: number): string {
  const angles = CAMERA_ANGLES.slice(0, sceneCount);
  return `
CAMERA ANGLE REQUIREMENTS:
Each scene MUST have a different camera angle for visual variety:
${angles.map(a => `- Scene ${a.scene}: ${a.angle} (${a.purpose})`).join('\n')}

Include the camera angle in each visualDescription field.`;
}

// Extract visual style keywords from a description for consistency
function extractVisualStyle(description: string): string {
  const styleMatch = description.match(/Style:\s*([^.]+)/i);
  const colorsMatch = description.match(/Colors?:\s*([^.]+)/i);
  const moodMatch = description.match(/Mood:\s*([^.]+)/i);
  const lightingMatch = description.match(/Lighting:\s*([^.]+)/i);
  
  const parts = [];
  if (styleMatch) parts.push(styleMatch[1].trim());
  if (colorsMatch) parts.push(`Colors: ${colorsMatch[1].trim()}`);
  if (moodMatch) parts.push(`Mood: ${moodMatch[1].trim()}`);
  if (lightingMatch) parts.push(`Lighting: ${lightingMatch[1].trim()}`);
  
  return parts.length > 0 ? parts.join('. ') : 'Cinematic 4K, vibrant colors, professional lighting, modern social media aesthetic';
}

// Extract background from description
function extractBackground(description: string): string {
  const bgMatch = description.match(/Background:\s*([^.]+)/i);
  return bgMatch ? bgMatch[1].trim() : 'modern, clean, professional setting';
}

// Ensure background consistency across scenes
function ensureBackgroundConsistency(description: string, baseBackground: string, cameraAngle: string): string {
  // If description already has a background, check if it matches
  const bgMatch = description.match(/Background:\s*([^.]+)/i);
  if (bgMatch) {
    // Replace with base background for consistency
    description = description.replace(/Background:\s*[^.]+/i, `Background: ${baseBackground}`);
  }
  
  // Ensure camera angle is included
  if (!description.toLowerCase().includes('camera:')) {
    description = description.replace(/\.\s*$/, '') + `. Camera: ${cameraAngle}.`;
  }
  
  return description;
}

// TTS sanitizer - removes problematic punctuation that causes TTS artifacts
function formatScriptForTTS(narration: string): string {
  if (!narration) return narration;
  
  let result = narration
    // Normalize curly apostrophes to straight
    .replace(/[\u2018\u2019\u0060\u00B4]/g, "'")
    // Replace em dashes with commas (prevents 4-second silences)
    .replace(/\u2014/g, ',')
    .replace(/—/g, ',')
    .replace(/--/g, ',')
    // Replace ellipses with commas (prevents long pauses)
    .replace(/\u2026/g, ',')
    .replace(/\.{2,}/g, ',')
    // Keep periods — they create natural pauses in TTS (DO NOT convert to commas)
    // Clean up double/triple commas
    .replace(/,\s*,+/g, ',')
    // Clean up comma at start of text
    .replace(/^,\s*/, '')
    // Clean up multiple spaces
    .replace(/  +/g, ' ')
    // Clean up excessive newlines
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  
  // Remove trailing commas, articles, and prepositions that create incomplete-sounding endings
  const trailingJunkPattern = /[\s,]+(a|an|the|of|in|to|for|with|on|at|by|and|but|or|is|are|was|were|that|this|it)\s*[,.]?\s*$/i;
  while (trailingJunkPattern.test(result)) {
    result = result.replace(trailingJunkPattern, '').trim();
  }
  
  // Replace trailing comma with period
  result = result.replace(/,\s*$/, '.');
  
  // Ensure narration ends with proper punctuation
  if (result && !/[.!?]$/.test(result)) {
    result += '.';
  }
  
  return result;
}

// Helper functions for intro/outro defaults - now with dynamic hooks
function smartTruncate(text: string, maxLen = 60): string {
  if (text.length <= maxLen) return text;
  // Find last natural break (comma, space) before maxLen
  const truncated = text.substring(0, maxLen);
  const lastComma = truncated.lastIndexOf(',');
  const lastSpace = truncated.lastIndexOf(' ');
  const breakAt = lastComma > maxLen * 0.4 ? lastComma : lastSpace;
  return breakAt > 0 ? truncated.substring(0, breakAt).trim() : truncated.trim();
}

function getDefaultIntroText(templateId: string, topic: string, hookStyle?: string): string {
  const topicShort = smartTruncate(topic);
  
  switch (templateId) {
    case 'hook-text':
      if (hookStyle === 'question') return `Have you ever wondered about ${topicShort}?`;
      if (hookStyle === 'secret') return `The secret about ${topicShort} that nobody talks about.`;
      if (hookStyle === 'story') return `Here's what happened when I tried ${topicShort}.`;
      return `This is going to change how you think about ${topicShort}.`;
    case 'topic-title':
      if (hookStyle === 'controversy') return `Unpopular opinion on ${topicShort}.`;
      return `The truth about ${topicShort}.`;
    case 'question-hook':
      return `Why does everyone get ${topicShort} wrong?`;
    case 'countdown':
      return `The top things you need to know about ${topicShort}.`;
    default:
      return `You need to see this about ${topicShort}.`;
  }
}

function getDefaultOutroText(templateId: string, topic?: string): string {
  const topicShort = topic ? topic.split(' ').slice(0, 5).join(' ') : '';
  
  switch (templateId) {
    case 'cta-follow':
      return topicShort 
        ? `If you want more insights like this on ${topicShort}... follow along— I've got a lot more coming—`
        : 'If you found this valuable... follow along— there\'s a lot more where this came from—';
    case 'cta-subscribe':
      return topicShort
        ? `Subscribe if you want to go deeper on ${topicShort}... I break this down every week—`
        : 'Subscribe if you want more like this... new content drops every week—';
    case 'cta-comment':
      return topicShort
        ? `I want to hear your take on ${topicShort}... drop your thoughts in the comments—`
        : 'Tell me what you think in the comments— I read every single one—';
    case 'cta-share':
      return topicShort
        ? `If someone you know needs to hear this about ${topicShort}... send it their way—`
        : 'Share this with someone who needs to hear it— it might change their perspective—';
    default:
      return topicShort
        ? `Save this for later when you need it... trust me on ${topicShort}—`
        : 'Save this for later— you\'ll want to come back to it—';
  }
}

function getIntroVisualDescription(templateId: string, topic: string, baseStyle: string): string {
  const commonStyle = baseStyle || 'Cinematic 4K, vibrant saturated colors, professional studio lighting';
  
  switch (templateId) {
    case 'hook-text':
      return `Style: ${commonStyle}. Subject: Bold attention-grabbing text graphic with kinetic typography, dramatic reveal animation. Camera: close-up, front facing, eye level. Lighting: High contrast dramatic lighting with rim light. Background: Dark gradient with subtle animated particles, depth blur. Colors: Electric purple, hot pink, cyan accents on dark background. Mood: Urgent, exciting, must-watch energy. Keywords: social media intro, vertical 9:16, motion graphics, trending TikTok style, no faces, abstract dynamic background.`;
    case 'topic-title':
      return `Style: ${commonStyle}. Subject: Elegant title card with topic "${topic}" in premium typography, subtle animation. Camera: close-up, centered frame, slight zoom in motion. Lighting: Soft diffused professional lighting. Background: Clean gradient backdrop with subtle texture, bokeh elements. Colors: Sophisticated palette matching brand, gold accents. Mood: Premium, trustworthy, professional. Keywords: title slide, social media, vertical 9:16, clean design, no faces, modern minimalist.`;
    case 'question-hook':
      return `Style: ${commonStyle}. Subject: Intriguing visual with floating question marks, puzzle elements, mystery atmosphere. Camera: medium shot, slightly low angle, dynamic. Lighting: Moody atmospheric with highlights. Background: Abstract curious environment, thought-provoking imagery. Colors: Deep blues, purples, with golden highlights. Mood: Mysterious, thought-provoking, curiosity-inducing. Keywords: question hook, vertical 9:16, intrigue, abstract, no faces, conceptual art.`;
    case 'countdown':
      return `Style: ${commonStyle}. Subject: Energetic countdown "3" with bold numbers, dynamic motion trails, excitement building. Camera: close-up, dynamic angle with movement. Lighting: High energy, multiple colored lights. Background: Dark with neon accents, particle effects, energy burst. Colors: Neon green, electric blue, hot white highlights. Mood: Energetic, anticipation, excitement. Keywords: countdown, hype intro, vertical 9:16, dynamic, no faces, motion energy.`;
    default:
      return `Style: ${commonStyle}. Subject: Engaging intro graphic, bold typography, dynamic elements. Camera: close-up, eye level, professional framing. Lighting: Studio quality. Background: Modern gradient with depth. Colors: Vibrant, attention-grabbing. Mood: Professional, engaging. Keywords: social media intro, vertical 9:16, no faces.`;
  }
}

function getOutroVisualDescription(templateId: string, baseStyle: string, topic?: string, characterDescription?: string): string {
  const commonStyle = baseStyle || 'Cinematic 4K, vibrant saturated colors, professional lighting';
  const charDesc = characterDescription || 'Confident professional person';
  const topicContext = topic ? `related to "${topic}"` : '';
  
  const baseOutro = `Style: ${commonStyle}. Shot on RED V-RAPTOR, 85mm lens, f/2.0 depth of field.
SUBJECT: ${charDesc} in a confident, inviting closing pose ${topicContext}. Natural relaxed expression, slight knowing smile, direct eye contact with camera.
LIGHTING: Warm golden hour key light, soft fill, subtle rim light creating depth and warmth.
COMPOSITION: Rule of thirds, medium shot, clean bokeh background matching the reel's visual style.
ATMOSPHERE: Warm, inviting, trustworthy energy. Professional color grading with warm amber tones.
CRITICAL: No text, no captions, no subtitles, no watermarks. CLOSED MOUTH. Vertical 9:16.`;

  switch (templateId) {
    case 'cta-follow':
      return `${baseOutro} The subject gestures invitingly toward the camera, welcoming energy, as if saying "come along for the journey."`;
    case 'cta-subscribe':
      return `${baseOutro} The subject leans slightly forward with engaged energy, as if sharing one last exciting secret.`;
    case 'cta-comment':
      return `${baseOutro} The subject has an open, curious expression, tilting head slightly, inviting conversation and dialogue.`;
    case 'cta-share':
      return `${baseOutro} The subject gestures outward with open hands, generous sharing energy, confident and warm.`;
    default:
      return `${baseOutro} The subject has a satisfied, knowing expression, as if the viewer just learned something valuable worth remembering.`;
  }
}
