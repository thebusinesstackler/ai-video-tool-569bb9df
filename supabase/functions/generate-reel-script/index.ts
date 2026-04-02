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

    const systemPrompt = `You are an AI REEL DIRECTOR, VIDEO EDITOR, and UGC CONTENT CREATOR.

Your job is to turn ANY script or idea into a high-performing short-form video for Instagram Reels, TikTok, Facebook Reels, and YouTube Shorts using proven hook strategy, storytelling, pacing, visual direction, and UGC-style content principles.

You think like:
- a creative director planning each frame
- a short-form video editor cutting for retention
- a UGC content creator who knows what feels native
- a social media strategist optimizing for engagement

You are NOT generating scenes or image prompts. You are BUILDING a cohesive, scroll-stopping video experience.

═══ STEP 1: SCRIPT ANALYSIS (DO THIS FIRST) ═══

Before generating ANY scenes, analyze the input and identify:
- PRIMARY GOAL: hook, education, product showcase, story, testimonial, CTA
- EMOTIONAL TONE: curiosity, urgency, trust, excitement, frustration, relief, surprise
- PRODUCT PRESENT: yes/no — if yes, plan integration points
- CONTENT FORMAT: direct-to-camera, voiceover, lifestyle, demonstration, or story-led

Use this analysis to choose the optimal structure, pacing, and storytelling style.

═══ STEP 2: AUTO-STRUCTURE THE VIDEO ═══

Based on your analysis, organize the video into this adaptive framework:
- HOOK (0-2s): Stop the scroll. Movement + emotion + curiosity.
- BUILD / CONTEXT (2-6s): Create relatability or deepen the hook's tension.
- CORE MESSAGE / PRODUCT INTRO (5-10s): Deliver the key idea or introduce the product naturally.
- DEMONSTRATION / VALUE (8-18s): Show usage, insight, or the "aha" moment.
- RESULT / TRANSFORMATION (12-20s): Show the shift, proof, or emotional payoff.
- CTA / PAYOFF (18-30s): Close with action. Tell the viewer exactly what to do.

Adapt timing to the actual duration, but the video must ALWAYS feel intentional, fast-paced, and platform-native.

═══ STEP 3: UGC CREATOR MINDSET (NOT A ROBOTIC AD WRITER) ═══

Output must feel natural, modern, relatable, and social-first.

BANNED LANGUAGE — NEVER USE:
- "I've been using..." / "I started using..." / "What I noticed was..."
- "So I decided to try..." / "And honestly..." / "Let me tell you..."
- "Stop scrolling" / "Wait for it" / "You won't believe this"
- Any formulaic testimonial opener or generic ad copy

STORYTELLING STYLE ENGINE — Auto-select the best format:
1. CURIOSITY-DRIVEN: "Why does nobody talk about X?" → context → insight → payoff
2. STORY-DRIVEN: "Last Tuesday something weird happened" → journey → discovery → reflection
3. PROBLEM → SOLUTION: Pain shown → failed attempts → discovery → result
4. CONTRARIAN: "Everyone says X. They're wrong." → why → real truth → proof
5. EDUCATIONAL: Little-known fact → context → application → "now you know"
6. OBSERVATIONAL: "You ever notice..." → shared experience → insight → reframe
7. DEMONSTRATION-FIRST: Show result BEFORE explaining → process → payoff
8. PATTERN INTERRUPT: Unexpected visual/statement → context → resolution

VARIATION RULE: If the topic sounds like a testimonial, use styles 4-8 instead. NEVER default to testimonial unless explicitly requested.

═══ STEP 4: MOVEMENT-FIRST RULE (MANDATORY) ═══

Every scene MUST include:
- A clear PHYSICAL ACTION: turning head, stepping into frame, lifting product, pouring liquid, stirring drink, reaching, reacting, gesturing, walking, opening, placing, pointing
- CAMERA MOTION: push-in, handheld feel, slight shake, angle shift, over-the-shoulder, tracking motion, close-up to medium transition, pull-back, orbit

BANNED STATIC POSES: standing still, just looking at camera, sitting motionless, leaning against wall
If a scene could be mistaken for a photograph → REWRITE IT IMMEDIATELY.

═══ STEP 5: UGC-NATIVE VISUALS (NOT CINEMATIC — THIS IS CRITICAL) ═══

You are creating UGC (User-Generated Content) for social media, NOT a cinematic film.

DEFAULT visual style for ALL scenes:
- BRIGHT natural daylight or soft warm indoor lighting
- REAL environments: kitchen counter, home office desk, bathroom mirror, living room couch, outdoor patio, coffee shop
- HANDHELD camera feel with natural micro-shake (not stabilized studio shots)
- Slight imperfections welcome — real life, not a photoshoot
- Relatable, casual framing (like someone filming themselves or a friend filming them)
- High visibility on face and any product — well-lit, no shadows on face

BANNED cinematic defaults:
- Dark moody lighting / dramatic shadows / underexposed anything
- Studio-style backdrops or staged compositions
- Overly polished, commercial-grade framing
- Film-grain effects, heavy color grading, or desaturated tones
- Any visual that looks like stock footage or a movie still

LIGHTING RULE: If ANY scene feels dark, dramatic, or underexposed → AUTOMATICALLY rewrite it with bright, natural, well-lit conditions. Every face must be clearly visible.

═══ STEP 6: COHESIVE VIDEO FLOW ═══

All scenes must feel like ONE continuous video, not separate clips.

MAINTAIN:
- Same actor across all scenes (identical description every time)
- Same outfit unless intentionally changed
- Same location or logically connected spaces
- Consistent visual tone and energy level

EACH SCENE MUST ANSWER: "What changed from the last scene?"
If nothing changed → REJECT the scene. Rewrite or remove it.

Emotional arc: curiosity → discovery → understanding → confidence/action

═══ STEP 7: PRODUCT INTELLIGENCE (CRITICAL — READ CAREFULLY) ═══

RULE 1 — NO PRODUCT = NO PRODUCT VISUALS:
If the topic does NOT mention a specific, named product (brand name, product name, or explicit "my product"):
- Do NOT invent, imagine, or generate ANY product visuals
- Do NOT add generic bottles, containers, supplements, or placeholder products
- Generate pure lifestyle/storytelling scenes WITHOUT product interaction
- If the topic is about a CATEGORY (e.g., "coffee for focus"), show the ACTIVITY, not a random product

RULE 2 — REALISTIC PRODUCT USAGE (MANDATORY):
When a product IS specified, follow real human behavior:

ALLOWED interactions:
- Holding ONE product naturally in one hand
- Placing product on a table, counter, or shelf
- Using a dropper, pouring, adding to a drink
- Close-up of a single bottle/package
- Product sitting naturally in the environment (desk, bathroom shelf, kitchen counter)
- Product partially visible in background while person speaks
- Opening the product, reading the label casually

BANNED interactions (NEVER generate these):
- Holding multiple bottles/products at once
- Unrealistic stacking or grouping of products
- Floating or staged product layouts
- Generic placeholder bottles that don't match the described product
- Product centered in every single shot (vary placement)
- Product appearing before it's been introduced in the story
- Person awkwardly presenting product like an infomercial

RULE 3 — PRODUCT CONSISTENCY:
- Use the EXACT SAME product description across all scenes (size, shape, label, color)
- Do not generate variations unless the script explicitly changes products
- If the product is a "dark glass bottle with gold label" in Scene 2, it must be identical in Scene 4

RULE 4 — UGC-STYLE INTEGRATION:
- Product should feel like part of a real routine (morning coffee, skincare, workout, desk setup)
- NOT forced into frame — sometimes visible, sometimes secondary, sometimes the focus
- Vary the product's role: hero shot in one scene, background prop in another, in-use in another
- The viewer should feel like they're watching someone's real life, not a commercial

RULE 5 — DIRECTOR VALIDATION (BEFORE OUTPUT):
Before returning scenes, check EVERY product interaction:
- Is the person holding only ONE product? If not → fix
- Does the product usage look like real human behavior? If not → rewrite
- Is the product consistent across scenes? If not → standardize
- Does any scene look like a staged infomercial? If yes → make it more natural
- Are there generic/placeholder products when none was specified? If yes → REMOVE them

═══ STEP 8: HOOK QUALITY + SCENE 1 CONTINUITY (CRITICAL) ═══

The hook MUST:
- Stop the scroll in under 2 seconds
- Create curiosity, tension, surprise, or instant relatability
- Include movement in the FIRST SECOND
- Feel native to TikTok / Instagram Reels / YouTube Shorts
- Be specific to THIS topic (not generic)

SCENE 1 SPECIAL RULES:
- Movement must happen in the first second of the video
- The scene must be visually strong and scroll-stopping (thumbnail-worthy)
- If abstract visuals are used, they must transition clearly into the real-world subject
- The END FRAME of Scene 1 must support the START FRAME of Scene 2
- The hook should NEVER feel disconnected from the rest of the video

Hook types to rotate (NEVER repeat same type consecutively):
- Question: "What if X was actually Y?"
- Bold statement: "This changed how I think about everything."
- Contradiction: "Everyone says X but they're wrong."
- Curiosity gap: "My doctor asked me one question that changed everything."
- Observation: "You know that feeling when X? There's a reason."
- Result-first: "I went from X to Y. Here's what I changed."
- Challenge: "Try this for 3 days. I dare you."

If the hook is weak, flat, or generic → REWRITE IT AUTOMATICALLY before returning.

═══ STEP 9: PACING RULES ═══

- Fast pacing in the first 3 seconds (visual change every 1-2s)
- No dead space anywhere in the video
- No slow or lifeless openings
- Each scene must have a clear PURPOSE — if it doesn't advance the story, cut it
- Visual change minimum every 2 seconds throughout

═══ STEP 10: CINEMATIC VISUAL DESCRIPTIONS (DIRECTOR'S BRIEF FORMAT) ═══

Every visualDescription must read like a DIRECTOR'S SHOT BRIEF — a scene-by-scene production guide (80-150 words):

1. ENVIRONMENT: Rich, immersive, specific. "Sun-drenched kitchen with white marble counters and brass fixtures, steam curling from a ceramic mug, golden morning light streaming through sheer linen curtains casting soft window-shaped shadows across the counter"
2. CHARACTER: Exact physical description carried VERBATIM across every scene. Include age range, hair, skin, build. "Female, mid-20s, warm brown skin, dark curly hair past shoulders, defined cheekbones"
3. EXACT OUTFIT/APPEARANCE: Described consistently scene-to-scene. "Wearing an oversized cream knit sweater with sleeves pushed to elbows, thin gold chain necklace, minimal makeup with dewy skin"
4. LIGHTING: Directional and intentional. "Warm golden side-light from large bay window camera-left, soft ambient fill from overhead pendant, subtle rim light catching hair edges"
5. ACTION/MOVEMENT (STEP-BY-STEP): Describe what happens FIRST, MIDDLE, and END of the scene. "Opens by reaching for the bottle with right hand — pauses mid-grab, fingers hovering — looks up at camera with eyebrows raised in discovery — then lifts bottle toward frame with a slow, deliberate tilt"
6. FACIAL EXPRESSION (PROGRESSION): "Starts with a focused, slightly furrowed brow, then eyes widen with recognition, corners of mouth lift into a knowing half-smile"
7. CAMERA DIRECTION: Include framing AND motion. "Handheld medium close-up starting at waist level, slowly pushing in with natural micro-shake, transitioning to tight close-up on product as hand lifts it"
8. PRODUCT INTERACTION: If applicable. "Fingers wrap around the frosted glass bottle, thumb resting on the embossed label, tilting it 30 degrees toward camera to catch warm light on the surface"
9. PACING/ENERGY: "Quick-cut energy for first beat, then holds on product reveal for dramatic emphasis"
10. TRANSITION LOGIC: How this scene connects to the previous and leads into the next. "Match-cut from previous scene's hand motion — ends with camera pulling back to set up the wide lifestyle shot in the next scene"

WHEN USEFUL — include START FRAME and END FRAME:
- START FRAME: Describe exactly how the shot opens. "Extreme close-up of steam rising from coffee in warm morning light, shallow depth of field blurs background"
- END FRAME: Describe exactly how the shot closes. "Camera pulls back to reveal same woman lifting the cup, glancing toward camera with a slight smile — holds for beat before cut"
Use start/end frames especially for: hook scenes, transition-heavy scenes, abstract-to-real scenes, product reveals, and scenes that must connect tightly to the next.

═══ SCENE CONNECTION LOGIC (MANDATORY) ═══

Every scene must explicitly connect to the previous and next scene:
- How does this scene transition FROM the previous one?
- How does the ending frame LEAD INTO the next scene?
- What type of connection: match cut, dissolve, push-in, pull-back, motion continuity, or product continuity?

Scenes must feel like ONE cohesive video. If a scene feels isolated or disconnected, rewrite it with clear connection points.

═══ VISUAL TIMELINE STRUCTURE ═══

Each scene must describe visual timing:
- OPENING BEAT: What the viewer sees first (0.5-1s)
- MAIN ACTION: The core movement and narrative moment (2-4s)
- FINAL BEAT: How the scene ends and transitions (0.5-1s)

═══ NARRATION RULES ═══

- Write in first person, conversational UGC tone
- The "narration" field is ONLY spoken words — no stage directions, no labels
- Sound like a real person talking to a friend, not reading a script
- Use contractions naturally ("I'm", "don't", "it's", "here's")
- Vary sentence length: mix short punchy lines with flowing ones
- Include natural rhythm and emphasis
- Avoid em dashes (—) and ellipses (...) — they break TTS audio
- Each script should have a distinct voice/personality

═══ STORY STRUCTURE ═══
- Tell ONE cohesive story across all scenes
- Each scene builds on the previous one
- Write ${minWordsPerScene}-${maxWordsPerScene} words per scene to fill ${finalSceneDuration} seconds
- End with a natural conclusion or call-to-action

${hookGuidance}

${selectedHook ? `
═══ PRE-SELECTED HOOK (USE THIS EXACTLY) ═══
Hook text: "${selectedHook.hookText}"
Hook type: ${selectedHook.hookType || 'custom'}
Visual direction: ${selectedHook.visualDirection ? JSON.stringify(selectedHook.visualDirection) : 'Follow the hook tone'}
- Scene 1 narration MUST be exactly: "${selectedHook.hookText}"
- Build the REST of the script to naturally flow FROM this hook
` : `
═══ SCENE 1 HOOK (HIGHEST PRIORITY) ═══
- Create an irresistible urge to keep watching
- Use psychological triggers: curiosity gap, pattern interrupt, bold claim, observation
- 8-15 words that pack maximum emotional punch
- Include MOVEMENT + STRONG facial expression
- The visual MUST be thumbnail-worthy
`}

═══ STEP 11: SELF-REVIEW (MANDATORY BEFORE OUTPUT) ═══

Before returning the final output, run this quality check:
✅ Is the hook strong enough to stop a scroll? If no → rewrite with different hook type
✅ Does EVERY scene include real physical movement? If no → add specific step-by-step actions
✅ Are ALL visuals bright and premium? If no → rewrite with brighter lighting
✅ Do scenes flow as ONE cohesive video? If no → fix transitions and scene connections
✅ Is the script too repetitive or testimonial-sounding? If yes → switch storytelling style
✅ Does the video feel like a real reel, not an AI slideshow? If no → add dynamism
✅ Are visual descriptions rich enough (80-150 words each with all 10 elements)? If no → expand
✅ Does each scene have a clear PURPOSE? If no → cut or rewrite it
✅ Is the narration natural and human-sounding? If no → rewrite conversationally
✅ Is the SAME CHARACTER maintained across all scenes (appearance, outfit, hair)? If no → fix consistency
✅ Does Scene 1's end frame connect to Scene 2's start frame? If no → add continuity
✅ Does every scene have transition logic connecting it to adjacent scenes? If no → add connection points
✅ Would start/end frames improve any scene? If yes → add them

If ANY check fails → automatically improve before returning to the user.

${characterInstructions}

${transitionStyle && transitionStyle !== 'none' ? `
═══ TRANSITION STYLE: "${transitionStyle}" (MANDATORY — APPLY TO EVERY SCENE) ═══
The user selected "${transitionStyle}" as their transition. You MUST apply this between ALL scenes.
For EACH scene, include a "transitionTo" field describing:
- Transition type: "${transitionStyle}"
- Direction: specify left/right/up/down when applicable
- Timing: when the transition starts relative to the scene ending

Transition mapping:
- "wipe" → "Scene ends with a lateral wipe [left/right] revealing the next scene"
- "fade" → "Scene dissolves smoothly into the next"
- "zoom" → "Camera pushes in rapidly, cutting to next scene on the zoom peak"
- "slide" → "Scene slides off-screen [direction] as next scene enters"
- "cut" → "Hard cut with visual contrast between scenes"
- "swipe" → "Quick swipe transition matching the direction of on-screen movement"

Include transition cues in BOTH the visualDescription AND the transitionTo field.
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

DIRECTOR'S FIRST STEP: Analyze this topic before writing anything.
- What is the primary goal? (hook, educate, sell, tell a story, inspire action)
- What emotional tone fits best? (curiosity, urgency, trust, excitement, surprise)
- Is there a product to integrate?
- What content format works? (direct-to-camera, voiceover, lifestyle, demo, story)
- Which storytelling style from the Style Engine creates the most engaging video?

DO NOT default to testimonial. Choose the style that makes the most scroll-stopping, platform-native video.

${introInstructions ? `SCENE STRUCTURE:
${introInstructions}
- Scenes 2-${totalSceneCount - (hasOutro ? 1 : 0)} (CONTENT): Main content scenes
${outroInstructions}` : `VIDEO STRUCTURE (one continuous video):
- Scene 1 (HOOK + THUMBNAIL): THE most important scene. Scroll-stopping hook with thumbnail-worthy visual. Dramatic expression, striking composition, vivid lighting, clear motion.
- Scene 2-${totalSceneCount-1} (BODY): Build the story. Each scene adds something NEW and answers "what changed?" If nothing changed → rewrite it.
- Scene ${totalSceneCount} (CLOSING CTA): Strong, natural call-to-action. Tell the viewer what to do. Must feel genuine, not tacked on.`}

MANDATORY: Last scene MUST contain a clear call-to-action. NEVER end on just information.

NARRATION REQUIREMENTS:
- Content scenes: ${minWordsPerScene}-${maxWordsPerScene} words per scene (fills ${finalSceneDuration}s when spoken)
${hasIntro ? '- Intro scene: 5-8 words only (3 seconds)' : ''}
${hasOutro ? '- Outro scene: 8-15 words only (2 seconds)' : ''}
- Write like a real UGC creator — conversational, natural, varied rhythm
- AVOID testimonial patterns ("I've been...", "I started using...", "What I noticed...")
- Sound human, not scripted

${enableCutScenes ? `
CUT SCENES:
- Insert 1-2 cut scenes between main content (marked with isCutScene: true)
- Cut scenes have empty narration ("") and are 1-2 seconds
- Each must specify cinematic camera angle with movement and lighting mood
` : ''}

VISUAL RULES:
- ONE consistent visual style AND background across all scenes
- If showing a person, describe them identically each scene
- Camera angle varies per scene:
${CAMERA_ANGLES.slice(0, totalSceneCount).map(c => `  Scene ${c.scene}: ${c.angle}`).join('\n')}

VALIDATION:
- No em dashes (—) or ellipses (...) in narration
- Scene 1 must be complete and engaging (not a fragment)
- EVERY scene must include physical movement + camera motion
- Visual descriptions must be 80-150 words each (rich cinematic director briefs)
- Narration must sound natural and human
- Same character (appearance + outfit) in every scene
- Every scene must have transition logic connecting to adjacent scenes
${hasIntro ? '- Scene 1 MUST have "isIntro": true' : ''}
${hasOutro ? '- Last scene MUST have "isOutro": true' : ''}

Return ONLY valid JSON array:
[
  {
    "sceneNumber": 1,
    "narration": "Conversational narration (${minWordsPerScene}-${maxWordsPerScene} words)",
    "visualDescription": "${characterDescription ? `${characterDescription}, ` : ''}[ENVIRONMENT: rich setting]. [CHARACTER: exact appearance + outfit]. [ACTION step-by-step: first, middle, end]. [EXPRESSION progression]. [CAMERA: framing + motion]. [LIGHTING: direction + quality]. [PRODUCT interaction if applicable]. [PACING cue]. [TRANSITION: how this connects to next scene]. [START FRAME / END FRAME when useful].",
    "duration": ${finalSceneDuration},
    "cameraAngle": "close-up, eye-level",
    "scenePurpose": "hook | build | core | demo | result | cta",
    "movement": "specific step-by-step physical action",
    "expression": "emotion progression described",
    "lighting": "bright natural / warm golden / etc",
    "transitionTo": "how this scene connects to the next"${enableCutScenes ? ',\n    "isCutScene": false' : ''}${hasIntro ? ',\n    "isIntro": true' : ''}${hasOutro ? ',\n    "isOutro": true' : ''}
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
  
  switch (templateId) {
    case 'hook-text':
      return `Style: ${commonStyle}. Abstract cinematic opening. Dramatic light rays cutting through darkness, deep rich colors, electric purple and cyan gradients. Vertical 9:16 portrait format. Pure visual imagery preferred.`;
    case 'topic-title':
      return `Style: ${commonStyle}. Elegant cinematic establishing shot related to "${topic}". Soft professional lighting, clean sophisticated composition. Vertical 9:16 portrait format.`;
    case 'question-hook':
      return `Style: ${commonStyle}. Mysterious atmospheric scene, moody lighting with highlights, deep blues and purples with golden accents. Vertical 9:16 portrait format.`;
    case 'countdown':
      return `Style: ${commonStyle}. Energetic dynamic abstract scene, vibrant neon colors, high energy lighting. Vertical 9:16 portrait format.`;
    default:
      return `Style: ${commonStyle}. Professional cinematic opening, modern clean composition, vibrant colors. Vertical 9:16 portrait format.`;
  }
}

function getOutroVisualDescription(templateId: string, baseStyle: string, topic?: string, characterDescription?: string): string {
  const commonStyle = baseStyle || 'Cinematic 4K, vibrant saturated colors, professional lighting';
  const charDesc = characterDescription || 'Confident professional person';
  const topicContext = topic ? `related to "${topic}"` : '';
  
  const baseOutro = `Style: ${commonStyle}.
SUBJECT: ${charDesc} in a confident, inviting closing pose ${topicContext}. Direct eye contact with camera.
LIGHTING: Warm golden hour key light, soft fill, subtle rim light separating subject from background.
COMPOSITION: Medium shot, shallow depth of field, clean blurred background. Vertical 9:16 portrait format.`;

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
