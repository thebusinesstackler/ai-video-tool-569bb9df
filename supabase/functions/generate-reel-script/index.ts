import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { callClaude, ClaudeError } from '../_shared/claude.ts';

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
    let { 
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
      characterName,
      transitionStyle,
      selectedHook
    } = await req.json();

    if (!topic) {
      return new Response(
        JSON.stringify({ error: 'Topic is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Strip any HTML tags and entities from topic before using it anywhere
    topic = topic.replace(/<[^>]*>/g, '').replace(/&\w+;/g, ' ').replace(/\s+/g, ' ').trim();

    // Claude API key checked by shared helper

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

      try {
        const result = await callClaude({
          messages: [
            { role: 'system', content: podcastSystemPrompt },
            { role: 'user', content: podcastUserPrompt }
          ],
          thinkingBudget: 16000,
          maxTokens: 24000,
        });

        const content = result.text;

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
      } catch (error) {
        if (error instanceof ClaudeError) {
          return new Response(
            JSON.stringify({ error: error.message }),
            { status: error.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        throw error;
      }
    }

    // Determine if intro/outro are enabled
    const hasIntro = introConfig?.introTemplate && introConfig.introTemplate !== 'none';
    const hasOutro = outroConfig?.outroTemplate && outroConfig.outroTemplate !== 'none';

    // Adjust scene count: AI generates intro/outro as part of the scene array
    const totalSceneCount = sceneCount + (hasIntro ? 1 : 0) + (hasOutro ? 1 : 0);

    // Calculate scene duration - use provided value or calculate from target duration
    const finalSceneDuration = sceneDuration || Math.round(targetDuration / sceneCount);
    
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
- Cut scenes have NO narration (empty string), only a rich visual description
- Mark cut scenes with "isCutScene": true
- Cut scenes should be visually dynamic and add energy

CUT SCENE VISUAL DESCRIPTIONS MUST include:
- A specific camera angle: wide establishing shot, extreme close-up, Dutch angle, bird's-eye view, tracking shot, dolly zoom, low-angle hero shot, over-the-shoulder, crane shot, or steadicam follow
- Camera movement: slow push-in, pull-back reveal, orbit/arc around subject, tilt up/down, whip pan, rack focus shift
- Cinematic details: depth of field, lighting mood (golden hour, silhouette, rim light, dramatic shadows), lens flare, motion blur
- Subject action: hands in motion, walking away, object detail, environment reveal, contemplative profile

CUT SCENE TYPES (vary these):
- B-roll detail shot: extreme close-up of hands, product, or key object with shallow depth of field
- Atmospheric establishing shot: wide cinematic view of the setting with environmental storytelling
- Dynamic transition: character in motion — walking, turning, or gesturing with tracking camera
- Reaction/emphasis: dramatic angle (low angle hero shot or Dutch tilt) capturing emotion
- Environmental pan: slow panoramic sweep revealing context or location
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

    const systemPrompt = `You are an ELITE SHORT-FORM VIDEO DIRECTOR and STORYTELLER. You create cinematic, emotionally engaging content for TikTok, Instagram Reels, and YouTube Shorts. You think in MOTION, CUTS, PACING, EMOTION, and ATTENTION RETENTION.

═══ CORE IDENTITY: CREATIVE DIRECTOR, NOT A TEMPLATE MACHINE ═══

You are NOT a testimonial generator. You are a creative director who crafts unique, dynamic videos.

BANNED LANGUAGE — NEVER USE THESE PATTERNS:
- "I've been using..." / "I started using..." / "What I noticed was..."
- "So I decided to try..." / "And honestly..." / "Let me tell you..."
- "Stop scrolling" / "Wait for it" / "You won't believe this"
- Any formulaic testimonial opener
- Any phrasing that sounds like every other ad on social media

Instead, write like a REAL PERSON having a genuine moment — raw, specific, surprising.

═══ STORYTELLING STYLE ENGINE (AUTO-SELECT) ═══

For EVERY script, dynamically choose the best storytelling format based on the topic.
DO NOT default to testimonial. Rotate across these styles:

1. CURIOSITY-DRIVEN: Open with a question that creates an itch. Build tension. Reveal.
   Example flow: "Why does nobody talk about X?" → context → insight → payoff
2. STORY-DRIVEN: Mini narrative with a beginning, middle, and end.
   Example flow: "Last Tuesday something weird happened" → journey → discovery → reflection
3. PROBLEM → SOLUTION: Name the pain clearly, then show the shift.
   Example flow: Problem shown → failed attempts → discovery → result
4. CONTRARIAN: Challenge what everyone assumes. Create cognitive dissonance.
   Example flow: "Everyone says X. They're wrong." → why → real truth → proof
5. EDUCATIONAL: Quick insight that makes viewer feel smarter.
   Example flow: Little-known fact → context → application → "now you know"
6. OBSERVATIONAL: "You ever notice..." relatable human moment.
   Example flow: Shared experience → why it happens → insight → reframe
7. DEMONSTRATION-FIRST: Show the result BEFORE explaining. Let visuals lead.
   Example flow: Striking visual → "Here's what happened" → process → result
8. PATTERN INTERRUPT: Start with something unexpected. Break expectations.
   Example flow: Unexpected visual/statement → context → insight → resolution

VARIATION RULE: If this topic sounds like it could be a testimonial, choose styles 4-8 instead.

═══ HOOK CREATIVITY (VARIED, NEVER REPETITIVE) ═══

Hook types to rotate across (NEVER repeat the same type twice in a row):
- Question: "What if X was actually Y?" / "Why does nobody talk about X?"
- Bold statement: "This changed how I think about everything."
- Contradiction: "Everyone says X but they're wrong."
- Curiosity gap: "My doctor asked me one question that changed everything."
- Unexpected observation: "You know that feeling when X? There's a reason for that."
- Result-first: "I went from X to Y. Here's the one thing I changed."
- Challenge: "Try this for 3 days. I dare you."

Each hook MUST include: emotional trigger + curiosity gap + movement + expression

═══ COHESIVE VIDEO FLOW ENGINE ═══

All scenes must feel like ONE continuous video, NOT separate clips.

SCENE CONNECTION LOGIC (adapt but maintain cohesion):
- Scene 1: Introduce tension, curiosity, or an unexpected moment
- Scene 2: Build context, create relatability, deepen the hook
- Scene 3: Introduce the key idea, product, or turning point
- Scene 4: Show usage, insight, or the "aha" moment
- Scene 5: Show result, shift, or transformation
- Scene 6: Close with payoff, reflection, or CTA

EACH SCENE MUST ANSWER: "What changed from the last scene?"
If nothing changed → the scene is REJECTED. Rewrite or remove it.

Emotional arc: curiosity → discovery → understanding → confidence/action

═══ NATURAL HUMAN SPEECH (ANTI-AI LANGUAGE) ═══

Scripts must sound like a REAL PERSON talking to a friend:
- Use contractions naturally ("I'm", "don't", "it's")
- Vary sentence length: mix short punchy lines with flowing ones
- Include natural rhythm, pauses, and emphasis
- Sound conversational, not polished or corporate
- Each script should have a distinct voice/personality
- Avoid repetitive sentence structures across scenes

═══ CINEMATIC VISUAL DESCRIPTIONS (3X DETAIL) ═══

Every visualDescription must read like a real production brief with ALL of these:

1. ENVIRONMENT: Rich, specific detail. Not "a room" but "a sun-drenched kitchen with marble counters and steam rising from a mug"
2. LIGHTING: Always bright, natural, intentional. Specify direction: "warm golden hour side-lighting" / "soft diffused window light from the left"
3. ACTION: Step-by-step physical movement. "Reaches for the bottle, pauses, looks up at camera with eyebrows raised"
4. EXPRESSION: Emotion progression within the scene. "Confused squint softening into surprised recognition"
5. CAMERA: Movement + framing + feel. "Handheld medium close-up pushing in slowly, slight natural shake"
6. OBJECT INTERACTION: If product exists, how hands interact with it. "Fingers wrapping around the label, tilting it toward camera"
7. PACING CUE: "Quick cut" / "hold for emphasis" / "slow motion moment"

═══ MOVEMENT-FIRST RULE (MANDATORY) ═══

Every scene MUST include:
- A clear PHYSICAL ACTION (turning, lifting, pouring, walking, reacting)
- CAMERA MOTION (push-in, pull-back, tracking, handheld drift, orbit)

BANNED STATIC POSES: standing still, just looking at camera, sitting motionless, leaning
If a scene could be mistaken for a photograph → REWRITE IT.

═══ PRODUCT INTEGRATION (SMART, NOT FORCED) ═══

If a product is mentioned in the topic:
- Introduce it NATURALLY within the story flow
- Show before explaining when possible
- Integrate into real-life moments (using it, discovering it, reacting to it)
- NEVER use hard-sell language. Let the visual and story do the work.
- Product should appear within first 5-7 seconds if relevant

═══ STORY STRUCTURE ═══
- Tell ONE cohesive story across all scenes
- Each scene builds on the previous one
- Write ${minWordsPerScene}-${maxWordsPerScene} words per scene to fill ${finalSceneDuration} seconds
- End with a natural conclusion or call-to-action

${hookGuidance}

${selectedHook ? `
═══ PRE-SELECTED HOOK (USE THIS EXACTLY) ═══
The user has already chosen their hook. Use it VERBATIM as Scene 1 narration:
Hook text: "${selectedHook.hookText}"
Hook type: ${selectedHook.hookType || 'custom'}
Visual direction: ${selectedHook.visualDirection ? JSON.stringify(selectedHook.visualDirection) : 'Follow the hook tone'}
- Scene 1 narration MUST be exactly: "${selectedHook.hookText}"
- Build the REST of the script to naturally flow FROM this hook
- The hook sets the emotional tone — maintain it throughout
` : `
═══ SCENE 1 HOOK (HIGHEST PRIORITY) ═══
- The hook MUST create an irresistible urge to keep watching
- Use psychological triggers: curiosity gap, pattern interrupt, bold claim, observation
- NEVER use "Stop scrolling", "Wait for it", or "You won't believe this"
- NEVER use "I've been..." or testimonial openers
- Feel PERSONAL and SPECIFIC to the topic — not generic
- 8-15 words that pack maximum emotional punch
- Include MOVEMENT + STRONG facial expression
`}

SCENE 1 VISUAL (THUMBNAIL):
- Optimized as thumbnail-worthy hero image
- Dramatic composition, striking expression, vivid lighting
- Tight close-up with shallow depth of field
- Must include physical action + camera motion

NARRATION:
- Write in first person, conversational tone
- The "narration" field is ONLY spoken words — no stage directions or labels
- Let the writer's personality and style come through naturally
- Vary sentence length and rhythm for a natural feel
- Avoid em dashes (—) and ellipses (...) as they cause TTS audio glitches
- Sound like a real human, not an AI writing a script

═══ SELF-REVIEW: CREATIVE QUALITY CHECK ═══
Before returning, verify:
✅ Does this feel repetitive or templated? If yes → rewrite with a different style
✅ Does it sound like a real person? If no → make it more conversational
✅ Do scenes flow naturally as one video? If no → fix transitions
✅ Does every scene have physical motion? If no → add movement
✅ Is the hook creative and unique? If no → try a different hook type
✅ Are visual descriptions rich and cinematic? If no → add 3x more detail
✅ Is the storytelling style varied from typical testimonials? If no → switch style

${characterInstructions}

VISUALS:
- Keep visualDescription detailed and cinematic (40-80 words)
- Format: [Subject with specific emotion progression and dynamic body language]. [Specific camera angle, movement, and feel]. [Rich environment with atmosphere and texture]. [Intentional lighting with direction and mood]. [Pacing cue]
- REQUIRED in every visualDescription:
  * FACIAL EXPRESSION with progression: e.g. "confused squint softening into surprised recognition"
  * DYNAMIC BODY MOVEMENT: e.g. "reaches for bottle, pauses, looks up at camera"
  * CAMERA DIRECTION with feel: e.g. "handheld medium close-up pushing in slowly with natural shake"
  * ENVIRONMENT DETAIL: e.g. "sun-drenched kitchen, steam rising from mug on marble counter"
  * LIGHTING SPECIFICS: e.g. "warm golden side-light from large window"
- Use one consistent background across all scenes
- Vary camera angles between scenes for visual interest
- Match visuals to what the narration discusses
- No text, titles, or captions in visuals
${transitionStyle && transitionStyle !== 'none' ? `
TRANSITION STYLE: "${transitionStyle}"
- Include transition direction cues in visualDescription between scenes
- For "${transitionStyle}": describe how the visual should transition. For example:
  * "fade" → "Scene fades from dark" or "dissolving into view"
  * "slide" → "Frame slides in from the right" or "lateral pan entrance"
  * "zoom" → "Camera zooms in from wide" or "pulling focus forward"
  * "crossfade" → "Cross-dissolving from previous scene"
  * "wipe" → "Wiping across the frame"
  * "spin" → "Rotating entrance into frame"
  * "flip" → "Flipping perspective"
  * "blur" → "Emerging from soft blur into sharp focus"
- The FIRST scene should open with a strong entrance matching this style
- Each subsequent scene should reference the transition feel in its opening movement
` : ''}

${cutSceneInstructions}`;

    // Build intro/outro AI instructions
    const introInstructions = hasIntro ? `
INTRO SCENE (Scene 1 — MANDATORY):
- This is a 3-second spoken intro hook. Write 5-8 words maximum.
- Style hint: "${introConfig.introTemplate}" ${introConfig.introText ? `— user suggested: "${introConfig.introText}"` : ''}
- The narration must be a short, punchy hook that grabs attention instantly
- Mark with "isIntro": true
- Visual: ${getIntroVisualDescription(introConfig.introTemplate, topic, extractVisualStyle(''))}
` : '';

    const outroInstructions = hasOutro ? `
OUTRO SCENE (Final Scene — MANDATORY):
- This is a 2-second spoken call-to-action. Write 8-15 words maximum.
- CTA style: "${outroConfig.outroTemplate}" ${outroConfig.outroText ? `— user suggested: "${outroConfig.outroText}"` : ''}
- The narration must be a natural, topic-specific CTA — NOT generic "Follow for more"
- Tie back to the topic and give a reason to engage
- Mark with "isOutro": true
- Visual: ${getOutroVisualDescription(outroConfig.outroTemplate, '', topic, characterDescription)}
` : '';

    const userPrompt = `Write ${totalSceneCount} scenes for a reel about: "${topic}"
Each CONTENT scene should be approximately ${finalSceneDuration} seconds when narrated.

CREATIVE DIRECTION: Analyze this topic and choose the BEST storytelling style from the Style Engine. Do NOT default to testimonial format. Consider: Is this a curiosity topic? A how-to? A product story? A contrarian take? Choose the style that creates the most engaging, scroll-stopping video.

${introInstructions ? `SCENE STRUCTURE:
${introInstructions}
- Scenes 2-${totalSceneCount - (hasOutro ? 1 : 0)} (CONTENT): Main content scenes
${outroInstructions}` : `STORY FLOW (each scene MUST connect to the next — one continuous video):
- Scene 1 (HOOK + THUMBNAIL): THE most important scene. Write a unique, creative hook that matches your chosen storytelling style. The visual MUST be thumbnail-worthy: dramatic expression, striking composition, vivid lighting, clear motion. This image becomes the video thumbnail.
- Scene 2-${totalSceneCount-1} (BODY): Build the story with each scene adding something NEW. Each scene must answer "what changed?" If nothing changed from the previous scene, rewrite it.
- Scene ${totalSceneCount} (CLOSING CTA - MANDATORY): End with a STRONG, natural call-to-action. Tell the viewer what to do next. Must feel like a genuine conclusion, not a tacked-on ask.`}

MANDATORY: The LAST scene MUST always contain a clear call-to-action or goal for the viewer. NEVER end on just information.

NARRATION REQUIREMENTS:
- Content scenes: Write ${minWordsPerScene}-${maxWordsPerScene} words per scene (this fills ${finalSceneDuration} seconds when spoken)
${hasIntro ? '- Intro scene: Write 5-8 words only (3 seconds)' : ''}
${hasOutro ? '- Outro scene: Write 8-15 words only (2 seconds)' : ''}
- Write like a real person talking — conversational, natural, varied rhythm
- AVOID testimonial patterns ("I've been...", "I started using...", "What I noticed...")
- Each scene should transition smoothly to the next
- Scene 1 must use a creative, psychologically compelling hook
- Scene 1's visualDescription must be a high-impact, thumbnail-optimized hero shot

${enableCutScenes ? `
CUT SCENES:
- Insert 1-2 cut scenes between main content (marked with isCutScene: true)
- Cut scenes have empty narration ("") and are 1-2 seconds
- Each cut scene MUST specify a cinematic camera angle (e.g., "Extreme close-up, shallow DOF, slow push-in", "Wide establishing shot, golden hour, drone descent", "Low-angle hero shot, dramatic rim lighting, slight orbit")
- Use them for B-roll, atmospheric transitions, or emphasis moments
- Include camera movement direction and lighting mood in the visual description
` : ''}

VISUAL RULES:
- Use ONE consistent visual style AND background across all scenes
- If showing a person, describe them identically each scene
- Camera angle should vary per scene for visual interest:
${CAMERA_ANGLES.slice(0, totalSceneCount).map(c => `  Scene ${c.scene}: ${c.angle}`).join('\n')}

VALIDATION:
- Avoid em dashes (—) and ellipses (...) in narration — they break TTS audio
- Scene 1 must be a complete, engaging sentence (not a fragment)
- Last scene should include a natural call-to-action
- EVERY scene must include physical movement and camera motion
- Narration must sound natural and human, not templated
${hasIntro ? '- Scene 1 MUST have "isIntro": true' : ''}
${hasOutro ? '- Last scene MUST have "isOutro": true' : ''}

Return ONLY valid JSON array:
[
  {
    "sceneNumber": 1,
    "narration": "Your creative narration here (${minWordsPerScene}-${maxWordsPerScene} words)",
    "visualDescription": "${characterDescription ? `${characterDescription}, ` : ''}[detailed action with emotion progression]. [Camera movement and framing]. [Rich environment with atmosphere]. [Lighting direction and mood]. [Pacing cue].",
    "duration": ${finalSceneDuration},
    "cameraAngle": "close-up, eye-level"${enableCutScenes ? ',\n    "isCutScene": false' : ''}${hasIntro ? ',\n    "isIntro": true' : ''}${hasOutro ? ',\n    "isOutro": true' : ''}
  }
]`;

    try {
      const result = await callClaude({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        thinkingBudget: 16000,
      });

      const content = result.text;

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

    // Ensure intro/outro flags are properly set (AI may not always include them)
    if (hasIntro && scenes.length > 0) {
      scenes[0].isIntro = true;
      scenes[0].duration = 3;
    }
    if (hasOutro && scenes.length > 0) {
      scenes[scenes.length - 1].isOutro = true;
      scenes[scenes.length - 1].duration = 2;
    }

    console.log('Generated scenes:', scenes.length, 'with intro:', hasIntro, 'outro:', hasOutro);

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

// Lightweight TTS cleanup — only fix actual audio-breaking issues
function formatScriptForTTS(narration: string): string {
  if (!narration) return narration;
  
  let result = narration
    // Normalize curly apostrophes
    .replace(/[\u2018\u2019\u0060\u00B4]/g, "'")
    // Replace em dashes with commas (prevents 4-second silences)
    .replace(/\u2014/g, ',')
    .replace(/—/g, ',')
    .replace(/--/g, ',')
    // Reduce excessive ellipses
    .replace(/\u2026/g, '...')
    .replace(/\.{3,}/g, '.')
    // Clean up double commas
    .replace(/,\s*,+/g, ',')
    .replace(/^,\s*/, '')
    .replace(/  +/g, ' ')
    .trim();
  
  // Ensure narration ends with proper punctuation
  if (result && !/[.!?]$/.test(result)) {
    result += '.';
  }
  
  return result;
}

// Strip HTML tags and decode entities from topic text
function stripHtml(text: string): string {
  return text
    .replace(/<[^>]*>/g, '') // remove HTML tags
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Visual description helpers kept for AI prompt context

function getIntroVisualDescription(templateId: string, topic: string, baseStyle: string): string {
  const commonStyle = baseStyle || 'Cinematic 4K, vibrant saturated colors, professional studio lighting';
  
  // ALL intros must be pure visual imagery — NO text, typography, or written words
  switch (templateId) {
    case 'hook-text':
      return `Style: ${commonStyle}. Abstract cinematic opening. Dramatic light rays cutting through darkness, deep rich colors, electric purple and cyan gradients. Vertical 9:16 portrait format. ABSOLUTELY NO TEXT, NO WORDS, NO LETTERS, NO TYPOGRAPHY. Pure abstract visual only.`;
    case 'topic-title':
      return `Style: ${commonStyle}. Elegant cinematic establishing shot related to "${topic}". Soft professional lighting, clean sophisticated composition. Vertical 9:16 portrait format. ABSOLUTELY NO TEXT, NO WORDS, NO LETTERS, NO TYPOGRAPHY.`;
    case 'question-hook':
      return `Style: ${commonStyle}. Mysterious atmospheric scene, moody lighting with highlights, deep blues and purples with golden accents. Vertical 9:16 portrait format. ABSOLUTELY NO TEXT, NO WORDS, NO LETTERS, NO TYPOGRAPHY.`;
    case 'countdown':
      return `Style: ${commonStyle}. Energetic dynamic abstract scene, vibrant neon colors, high energy lighting. Vertical 9:16 portrait format. ABSOLUTELY NO TEXT, NO WORDS, NO NUMBERS, NO LETTERS, NO TYPOGRAPHY.`;
    default:
      return `Style: ${commonStyle}. Professional cinematic opening, modern clean composition, vibrant colors. Vertical 9:16 portrait format. ABSOLUTELY NO TEXT, NO WORDS, NO LETTERS, NO TYPOGRAPHY.`;
  }
}

function getOutroVisualDescription(templateId: string, baseStyle: string, topic?: string, characterDescription?: string): string {
  const commonStyle = baseStyle || 'Cinematic 4K, vibrant saturated colors, professional lighting';
  const charDesc = characterDescription || 'Confident professional person';
  const topicContext = topic ? `related to "${topic}"` : '';
  
  const baseOutro = `Style: ${commonStyle}.
SUBJECT: ${charDesc} in a confident, inviting closing pose ${topicContext}. Direct eye contact with camera.
LIGHTING: Warm golden hour key light, soft fill, subtle rim light separating subject from background.
COMPOSITION: Medium shot, shallow depth of field, clean blurred background.
CRITICAL: No text, no captions, no subtitles, no watermarks. Vertical 9:16 portrait format.`;

  switch (templateId) {
    case 'cta-follow':
      return `${baseOutro} EXPRESSION: warm genuine smile, eyebrows slightly raised invitingly. MOVEMENT: gesturing toward camera with open hand, slight forward lean, welcoming energy.`;
    case 'cta-follow-animated':
      return `${baseOutro} EXPRESSION: excited grin, eyes sparkling with enthusiasm. MOVEMENT: pointing at camera then giving a thumbs-up, energetic upbeat body language.`;
    case 'cta-subscribe':
      return `${baseOutro} EXPRESSION: conspiratorial half-smile, one eyebrow raised as if sharing a secret. MOVEMENT: leaning slightly forward, hand cupped near mouth as if whispering something exciting.`;
    case 'cta-like-subscribe':
      return `${baseOutro} EXPRESSION: big friendly smile, nodding affirmatively. MOVEMENT: thumbs-up gesture transitioning to pointing at camera, enthusiastic energy.`;
    case 'cta-all-socials':
      return `${baseOutro} EXPRESSION: confident professional smile, relaxed and approachable. MOVEMENT: arms open wide in welcoming gesture, steady composed posture.`;
    case 'cta-comment':
      return `${baseOutro} EXPRESSION: curious open expression, head tilted slightly, eyebrows raised questioningly. MOVEMENT: hands open palms-up in "what do you think?" gesture, inviting conversation.`;
    case 'cta-share':
      return `${baseOutro} EXPRESSION: excited knowing smile, eyes wide with enthusiasm. MOVEMENT: hands gesturing outward in sharing motion, generous open body language.`;
    case 'cta-duet-stitch':
      return `${baseOutro} EXPRESSION: playful challenging grin, eyebrows raised in a dare. MOVEMENT: pointing directly at camera, slight head tilt, "your turn" energy.`;
    case 'book-call':
      return `${baseOutro} EXPRESSION: warm professional smile, trustworthy and confident. MOVEMENT: hand extended toward camera as if offering a handshake, business-ready posture.`;
    default:
      return `${baseOutro} EXPRESSION: satisfied knowing smile, slight nod of approval. MOVEMENT: relaxed confident stance, subtle forward lean suggesting shared understanding.`;
  }
}
