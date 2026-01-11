import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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
CHARACTER CONSISTENCY (CRITICAL - MUST FOLLOW):
The user has specified this character description: "${characterDescription}"
- ALL scenes MUST describe THIS EXACT character in every visualDescription
- NEVER change the gender, age, ethnicity, or key physical traits specified
- Use the EXACT characteristics provided (e.g., if "male" is specified, ALL scenes show a male)
- Apply scene context (actions, locations, poses) TO THIS CHARACTER
- Example: If description says "Male entrepreneur, 30s", every scene shows a male entrepreneur in his 30s
` : '';

    const systemPrompt = `You are an elite short-form video scriptwriter creating ONE COHESIVE STORY for viral social media content.

CRITICAL STORY RULES:
- ALL scenes MUST tell ONE continuous story about the SAME topic
- Each scene builds on the previous one - think of it as chapters in a story
- No scene should repeat what another scene says
- Scene flow: Hook → Setup → Core content → Resolution/CTA
- Write ${minWordsPerScene}-${maxWordsPerScene} words per scene to fill the full ${finalSceneDuration} seconds

${hookGuidance}

NARRATION RULES:
- The "narration" field contains ONLY the exact words to be spoken aloud
- NO analysis, NO descriptions, NO stage directions, NO parentheticals
- Write in first person, conversational, as if speaking directly to the viewer
- Every word will be spoken slowly - write naturally flowing sentences
- Use transitional phrases between ideas: "And here's the thing...", "But wait...", "So what does this mean?"

## MANDATORY TTS FORMATTING (AI WILL BE REJECTED IF NOT FOLLOWED):

CRITICAL: NEVER USE PERIODS TO END SENTENCES. This causes TTS to add "s" sounds making words plural.

INSTEAD OF PERIODS, USE:
- Ellipses (...) for pauses and transitions: "It's overwhelming..."
- Em dashes (—) for abrupt stops: "Not buried in inboxes—"
- Line breaks between EVERY thought for natural pacing

WRONG FORMAT (DO NOT WRITE LIKE THIS - causes TTS errors):
"You're probably wrestling with which CTMS is right. It's a jungle out there. You see countless options."

CORRECT FORMAT (WRITE EXACTLY LIKE THIS):
"You're probably wrestling with which CTMS is right...

It's a jungle out there—

You see countless options..."

MORE EXAMPLES OF CORRECT FORMAT:
- Instead of "Yeah. Me too." write "Yeah... me too—"
- Instead of "It's complex. Right?" write "It's complex... right?"
- Instead of "workflow." write "workflow—" (period would make it sound like "workflows")
- Instead of "Let me tell you. It boils down to this." write "Let me tell you—it boils down to this..."

EVERY sentence must end with ... or — NEVER with a period.

${cameraInstructions}

${characterInstructions}

BACKGROUND CONSISTENCY (CRITICAL):
- Use ONE consistent background/environment across ALL scenes
- Describe the SAME setting, lighting conditions, and atmosphere for every scene
- Only change camera angle and character pose, NOT the environment
- Example: If scene 1 is in a modern office, ALL scenes must be in that same modern office

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
- Scene ${sceneCount} (CLOSE): Deliver the payoff, conclusion, or call-to-action

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
- Verify that your narration contains ZERO sentence-ending periods
- Every sentence must end with ... or —
- Line breaks between each thought
- If you see any "." at end of sentence, replace it with "..." or "—"

Return ONLY valid JSON array:
[
  {
    "sceneNumber": 1,
    "narration": "Write ${minWordsPerScene}-${maxWordsPerScene} words here ending with ... or — NEVER periods",
    "visualDescription": "Style: [style]. Subject: [what]. Camera: ${CAMERA_ANGLES[0].angle}. Lighting: [type]. Background: [env - use same for ALL scenes]. Colors: [palette]. Mood: [mood].",
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
        model: 'google/gemini-2.5-flash',
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
      const outroNarration = formatScriptForTTS(outroConfig.outroText || getDefaultOutroText(outroConfig.outroTemplate));
      
      const outroScene = {
        sceneNumber: scenes.length + 1,
        narration: outroNarration,
        visualDescription: getOutroVisualDescription(outroConfig.outroTemplate, baseVisualStyle),
        duration: 2,
        isOutro: true,
        templateId: outroConfig.outroTemplate,
        cameraAngle: 'medium shot, call-to-action framing'
      };
      scenes.push(outroScene);
      
      const ctaHoldScene = {
        sceneNumber: scenes.length + 1,
        narration: '',
        visualDescription: getOutroVisualDescription(outroConfig.outroTemplate, baseVisualStyle),
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

// AGGRESSIVE TTS formatter - converts ALL periods to prevent "s" sound artifacts
function formatScriptForTTS(narration: string): string {
  if (!narration) return narration;
  
  return narration
    // AGGRESSIVE: Convert ALL sentence-ending periods to em dashes with line breaks
    // This is the main fix for words like "workflow." sounding like "workflows"
    .replace(/\.(\s|$)/g, '—\n\n')
    // Convert commas before conjunctions to ellipses for breath pauses
    .replace(/,\s+(and|but|so|because|or|if|when|while)\b/gi, '...\n\n$1')
    // Add line breaks after question marks
    .replace(/\?\s+/g, '?\n\n')
    // Add line breaks after exclamation marks
    .replace(/!\s+/g, '!\n\n')
    // Add pauses after common transition phrases
    .replace(/(But here's the thing|And here's the truth|Here's what I mean|Now imagine|Think about it|And here's why|Here's the problem|The truth is|Let me tell you|You see|Well|So here's|Now here's)/gi, '$1—\n\n')
    // Clean up double em dashes
    .replace(/—\s*—/g, '—')
    // Ensure proper formatting around em dashes (no extra spaces)
    .replace(/\s*—\s*/g, '—\n\n')
    // Clean up multiple line breaks
    .replace(/\n{3,}/g, '\n\n')
    // Clean up multiple spaces
    .replace(/  +/g, ' ')
    .trim();
}

// Helper functions for intro/outro defaults - now with dynamic hooks
function getDefaultIntroText(templateId: string, topic: string, hookStyle?: string): string {
  // Use hook style to generate dynamic intro text
  const topicShort = topic.split(' ').slice(0, 5).join(' ');
  
  switch (templateId) {
    case 'hook-text':
      if (hookStyle === 'question') return `Have you ever wondered about ${topicShort}?`;
      if (hookStyle === 'secret') return `The secret about ${topicShort} that nobody talks about...`;
      if (hookStyle === 'story') return `Here\'s what happened when I tried ${topicShort}...`;
      return `This is going to change how you think about ${topicShort}...`;
    case 'topic-title':
      if (hookStyle === 'controversy') return `Unpopular opinion on ${topicShort}...`;
      return `The truth about ${topicShort}...`;
    case 'question-hook':
      return `Why does everyone get ${topicShort} wrong?`;
    case 'countdown':
      return `The top things you need to know about ${topicShort}...`;
    default:
      return `You need to see this about ${topicShort}...`;
  }
}

function getDefaultOutroText(templateId: string): string {
  switch (templateId) {
    case 'cta-follow':
      return 'Follow for more!';
    case 'cta-subscribe':
      return 'Subscribe now!';
    case 'cta-comment':
      return 'Comment below!';
    case 'cta-share':
      return 'Share this!';
    default:
      return 'Save this!';
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

function getOutroVisualDescription(templateId: string, baseStyle: string): string {
  const commonStyle = baseStyle || 'Cinematic 4K, vibrant saturated colors, professional lighting';
  
  switch (templateId) {
    case 'cta-follow':
      return `Style: ${commonStyle}. Subject: Animated follow button with glow effects, social media icons, floating hearts and plus signs. Camera: medium shot, centered, direct engagement. Lighting: Bright, inviting warmth. Background: Gradient with subtle social media motifs. Colors: Platform reds, pinks, warm tones. Mood: Friendly, welcoming. Keywords: social media outro, vertical 9:16, engagement, no faces, no text.`;
    case 'cta-subscribe':
      return `Style: ${commonStyle}. Subject: Subscribe button animation with notification bell glowing. Camera: close-up, engaging direct frame. Lighting: Exciting, dynamic lighting. Background: Teaser preview atmosphere, countdown elements. Colors: Red button, yellow bell, anticipation colors. Mood: Exciting, cliffhanger. Keywords: YouTube style, vertical 9:16, teaser, no faces, no text.`;
    case 'cta-comment':
      return `Style: ${commonStyle}. Subject: Comment bubble graphics, interactive chat elements floating. Camera: medium shot, inviting, conversational angle. Lighting: Warm, friendly glow. Background: Community discussion vibes, multiple chat bubbles. Colors: Friendly blues, conversation greens. Mood: Conversational, inclusive. Keywords: engagement, vertical 9:16, discussion, no faces, no text.`;
    case 'cta-share':
      return `Style: ${commonStyle}. Subject: Share arrow icons multiplying, viral spread visualization, network expansion graphics. Camera: wide shot, dynamic outward motion. Lighting: Energetic, spreading light rays. Background: Network connections, spreading ripples effect. Colors: Viral purples, sharing blues. Mood: Shareable, viral energy. Keywords: viral, vertical 9:16, network effect, no faces, no text.`;
    default:
      return `Style: ${commonStyle}. Subject: Eye-catching save/bookmark icon with pulse animation. Camera: close-up, centered frame. Lighting: Warm, inviting glow. Background: Subtle gradient with save iconography. Colors: Warm golden tones, bookmark oranges. Mood: Valuable, must-save content. Keywords: save, bookmark, vertical 9:16, no faces, no text.`;
  }
}
