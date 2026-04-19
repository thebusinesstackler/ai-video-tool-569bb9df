import { Camera, Film, GraduationCap, BookOpen, Headphones, Zap, Sparkles, Wand2 } from 'lucide-react';

export type ContentArchetypeId =
  | 'auto'
  | 'documentary'
  | 'ugc'
  | 'cinematic'
  | 'educational'
  | 'story'
  | 'asmr'
  | 'contrarian';

export interface ContentArchetype {
  id: ContentArchetypeId;
  label: string;
  vibe: string;
  useCase: string;
  icon: React.ComponentType<{ className?: string }>;
  // 6 prompt dimensions
  scriptStructure: string;
  voiceRules: string;
  cameraDirection: string;
  actingDirection: string;
  productIntegration: string;
  bannedPatterns: string;
  // overrides
  disableHookBank?: boolean;
  disableCTA?: boolean;
  noDialogue?: boolean;
  forceThreeScene?: boolean;
}

export const CONTENT_ARCHETYPES: Record<ContentArchetypeId, ContentArchetype> = {
  auto: {
    id: 'auto',
    label: 'Auto',
    vibe: 'Marco picks the best fit',
    useCase: 'Let the AI choose the right archetype for your product + intent',
    icon: Wand2,
    scriptStructure: 'Pick the most appropriate archetype below based on the product, intent, and reference. Name your choice in the Reference Analysis section ("ARCHETYPE: [name]") then write fully to that archetype\'s rules.',
    voiceRules: '(determined by chosen archetype)',
    cameraDirection: '(determined by chosen archetype)',
    actingDirection: '(determined by chosen archetype)',
    productIntegration: '(determined by chosen archetype)',
    bannedPatterns: 'Do not default to "problem → product → benefit → CTA" unless the chosen archetype explicitly requires it.',
  },
  documentary: {
    id: 'documentary',
    label: 'Documentary',
    vibe: 'Real, raw, slow, emotional',
    useCase: 'Trust building. Feels like a real story, not an ad.',
    icon: Film,
    scriptStructure: 'NO HOOK. Start mid-thought, as if catching the speaker mid-sentence ("...and that\'s when I noticed it"). NO CTA, or at most one quiet closing line — never a call to action. Three soft beats: observation → reflection → quiet realization.',
    voiceRules: 'Real-person diction with audible breaths, mid-sentence pauses, one self-correction ("I mean — it wasn\'t even…"), and contractions. Max 11 words per spoken sentence. BANNED words: revitalize, transform, unleash, supercharge, game-changer, life-changing, "completely," "utterly," "simply amazing," "you have to try."',
    cameraDirection: 'Locked-off or near-locked tripod, 35mm lens feel, soft natural window light, no movement except micro-sway. One cut MAX. No push-ins. No music swells.',
    actingDirection: 'BREATH: soft exhale before first line. EYES: drift away from camera on reflective beats, return softly. HANDS: still, occasional small gesture. POSTURE: relaxed, slightly forward. MICRO-EXPRESSION: small honest half-smile, never a grin. PACING: slow with real pauses. EMOTIONAL ARC: contemplative throughout — no big reveal.',
    productIntegration: 'Product appears almost incidentally — held casually, not presented to camera. NEVER hold the label toward the lens. Never say the product name in a brand-voice tone — use it like a real person would mention something on their counter.',
    bannedPatterns: 'NO hook. NO CTA. NO ad language. NO "this changed my life." NO product reveal moment. NO voiceover music sting.',
    disableHookBank: true,
    disableCTA: true,
  },
  ugc: {
    id: 'ugc',
    label: 'UGC Native',
    vibe: 'Casual, fast, slightly messy',
    useCase: 'TikTok/Reels native. Scroll-stopping engagement.',
    icon: Camera,
    scriptStructure: 'Strong hook in first 1.5s ("Wait — why is nobody talking about this?"). Casual middle, fast pace. Soft CTA at end if any. Allow interruptions and self-corrections.',
    voiceRules: 'How a real creator talks to phone camera: contractions, filler beats ("honestly," "kind of," "wait"), one mid-sentence pivot allowed. Max 12 words per spoken sentence. BANNED: revitalize, transform, supercharge, "amazing results," "you won\'t believe."',
    cameraDirection: 'Handheld phone selfie energy — micro-sway, slight wobble, never tripod-locked. One or two jump cuts allowed. Slight reframes mid-sentence okay.',
    actingDirection: 'BREATH: starts mid-action, no formal setup. EYES: direct to camera, occasional natural blink-away. HANDS: gesture freely with phone-holding hand visible if natural. POSTURE: leaning in, casual. MICRO-EXPRESSION: animated eyebrows, real reactions. PACING: fast with one excited beat. EMOTIONAL ARC: curious → invested → "you should try this."',
    productIntegration: 'Product held casually in hand, shown mid-sentence rather than in a hero shot. Quick flip to label is fine, never a slow rotating product beauty shot.',
    bannedPatterns: 'NO cinematic slow-mo. NO orchestral music. NO formal narrator voice. NO tripod stillness.',
  },
  cinematic: {
    id: 'cinematic',
    label: 'Cinematic',
    vibe: 'Apple / Nike / luxury brand film',
    useCase: 'Brand authority. Emotion over explanation.',
    icon: Sparkles,
    scriptStructure: 'Minimal dialogue OR voiceover only — 1-2 short poetic lines maximum (e.g. "Clarity isn\'t found. It\'s built."). NO direct selling. Image and sound carry the meaning. End on a single product moment, no CTA voiceover.',
    voiceRules: 'If voiceover is used: low, intimate register, max 6 words per line, 2 lines total for the entire piece. If no VO: leave space for sound design — breath, ambient texture, single musical note.',
    cameraDirection: 'Slow camera moves: dolly push-in, slider, gimbal arc. Slow-motion (60–120fps look) on key beats. Shallow depth, dramatic side-light or backlight, color-graded warm-teal. Multiple angles, but each held long enough to breathe.',
    actingDirection: 'BREATH: visible, deliberate. EYES: contemplative, often looking past the lens. HANDS: precise, slow, intentional. POSTURE: composed, statuesque. MICRO-EXPRESSION: minimal — one small change across the whole piece. PACING: slow, every action holds. EMOTIONAL ARC: still → felt → resolved.',
    productIntegration: 'Product is FELT before it is shown. One hero macro shot, lit like jewelry, no hands grabbing it for the lens. Treat it like a luxury watch ad.',
    bannedPatterns: 'NO talking-head selling. NO handheld shake. NO upbeat pop music. NO on-screen sale text. NO "buy now."',
    noDialogue: false,
  },
  educational: {
    id: 'educational',
    label: 'Educational',
    vibe: 'Smart, informative, credible',
    useCase: 'Conversion through trust and authority.',
    icon: GraduationCap,
    scriptStructure: 'Hook = curiosity gap or counter-intuitive fact ("Most people don\'t have low energy — they have unstable energy"). Body = ONE clear teachable insight. Product appears ONLY in the final third as a tool that applies the insight.',
    voiceRules: 'Confident, measured, expert register. Contractions allowed but minimal filler. Max 14 words per sentence. BANNED: hype words (amazing, game-changing, revolutionary). Use specifics: numbers, mechanisms, real terms.',
    cameraDirection: 'Steady locked or very slight tracking. Clean composition, even daylight or soft key. One supporting B-roll cutaway tied to the teaching point. Optional on-screen text labels for the key fact.',
    actingDirection: 'BREATH: composed. EYES: steady on lens during the teaching, brief glance away when illustrating. HANDS: clean, deliberate gestures TIED to the explanation (not random). POSTURE: upright, grounded. MICRO-EXPRESSION: confident neutral, small nod on the key insight. PACING: even, with one deliberate pause before the teachable line. EMOTIONAL ARC: curious → clarifying → confident.',
    productIntegration: 'Product appears in the LAST THIRD only, framed as the practical application of the teaching. Never opens or centers the video.',
    bannedPatterns: 'NO emotional testimonial language. NO before/after. NO "I used to feel…" opener. NO product in first 60% of video.',
  },
  story: {
    id: 'story',
    label: 'Mini Story',
    vibe: 'Feels like a mini movie',
    useCase: 'Emotional engagement, no direct selling.',
    icon: BookOpen,
    scriptStructure: 'THREE-SCENE STRUCTURE (mandatory): Scene 1 = struggle moment (no words or 1 ambient line). Scene 2 = discovery/turning point (product introduced as the pivot). Scene 3 = transformation (a different feeling, shown not told). No talking-head allowed. No direct CTA.',
    voiceRules: 'Diegetic only — natural ambient dialogue if any (someone offscreen, a phone notification). NO narrator voiceover. NO direct-to-camera lines.',
    cameraDirection: 'Each scene = one continuous shot or two quiet cuts. Scene 1: cool tones, low energy framing. Scene 2: warmer, push-in on the product moment. Scene 3: open frame, natural light, breathing room. Match-cut between scenes if possible.',
    actingDirection: 'Subject never addresses camera. Body language carries the arc: Scene 1 = closed/slumped, Scene 2 = leaning in/curious, Scene 3 = open/relaxed/quiet smile. EMOTIONAL ARC: drained → curious → settled.',
    productIntegration: 'Product is the TURNING POINT object of Scene 2. Held, opened, used naturally. Never hero-shot. The transformation in Scene 3 implies the result without naming it.',
    bannedPatterns: 'NO talking-head. NO voiceover narration. NO on-screen sale text. NO direct CTA. NO "buy now" frames.',
    forceThreeScene: true,
    disableCTA: true,
  },
  asmr: {
    id: 'asmr',
    label: 'ASMR / Sensory',
    vibe: 'Satisfying, hypnotic, sound-driven',
    useCase: 'Retention + visual appeal.',
    icon: Headphones,
    scriptStructure: 'NO DIALOGUE. NO voiceover. The video is built around sound and texture. Beats: anticipation → action (drops, pour, click) → satisfying resolution. Optional single 3-word on-screen text at the end.',
    voiceRules: 'NO spoken words at all. Audio = isolated sound design: glass clink, dropper squeeze, liquid pour, soft ambient room tone, very subtle low ambient pad if any.',
    cameraDirection: 'Macro shots only. Locked-off or extremely slow micro-push. Shallow focus, soft top light, dark or muted background. Slow motion on the sensory action moments.',
    actingDirection: 'No actor face. Hands only — slow, deliberate, manicured-feel motion. Each action drawn out for sensory impact.',
    productIntegration: 'Product IS the hero — every shot is the product or its action (label macro, dropper squeeze, liquid hitting glass). Treat each shot like a product film.',
    bannedPatterns: 'NO talking. NO music with vocals. NO fast cuts. NO actor face. NO on-screen sale copy beyond the optional 3-word closer.',
    noDialogue: true,
    disableHookBank: true,
  },
  contrarian: {
    id: 'contrarian',
    label: 'Contrarian',
    vibe: 'Bold, disruptive, pattern-interrupt',
    useCase: 'High CTR. Breaks expectations.',
    icon: Zap,
    scriptStructure: 'OPEN with a contrarian statement that rejects the category norm ("Most supplements don\'t work. Here\'s what actually does."). Then the explanation. Then the product as the proof. Hard, confident close.',
    voiceRules: 'Confident, slightly clipped, declarative. Contractions fine. Max 12 words per sentence. BANNED openers: gentle/empathetic ("I used to feel…", "We\'ve all been there", "Have you ever…"). Required: a strong opinion in line 1.',
    cameraDirection: 'Steady, locked or slight handheld. Tight medium shot, even key light, neutral background. Minimal movement — let the words land. One cut MAX, on the pivot.',
    actingDirection: 'BREATH: starts already mid-energy, no warmup. EYES: intense, steady, locked on lens — almost no looking away. HANDS: minimal, one decisive gesture on the contrarian beat. POSTURE: squared-up, grounded. MICRO-EXPRESSION: serious confidence, no smile until the very end (if at all). PACING: deliberate with a hard pause after the opening line. EMOTIONAL ARC: certain → explanatory → uncompromising.',
    productIntegration: 'Product appears as the PROOF of the contrarian point, not as the hero. Held firmly, label visible briefly, never pampered.',
    bannedPatterns: 'NO empathetic opener. NO "I used to feel" hook. NO soft-warm tone. NO commercial smile. NO hesitation.',
  },
};

export const ARCHETYPE_LIST: ContentArchetype[] = [
  CONTENT_ARCHETYPES.auto,
  CONTENT_ARCHETYPES.documentary,
  CONTENT_ARCHETYPES.ugc,
  CONTENT_ARCHETYPES.cinematic,
  CONTENT_ARCHETYPES.educational,
  CONTENT_ARCHETYPES.story,
  CONTENT_ARCHETYPES.asmr,
  CONTENT_ARCHETYPES.contrarian,
];

export function buildArchetypeBlock(id: ContentArchetypeId): string {
  const a = CONTENT_ARCHETYPES[id];
  if (id === 'auto') {
    return `\n\n**🎬 ARCHETYPE LOCK — AUTO MODE:**
${a.scriptStructure}

After picking, follow the chosen archetype's 6-dimension rules below (Documentary, UGC Native, Cinematic, Educational, Mini Story, ASMR/Sensory, or Contrarian). Do NOT default to a generic "problem → product → benefit → CTA" ad structure.`;
  }
  return `\n\n**🎬 ARCHETYPE LOCK: ${a.label.toUpperCase()} (${a.vibe})**
This is a ${a.label} piece — NOT a generic ad. The archetype rules below OVERRIDE any default ad-structure instincts. If the rules conflict with "problem → product → benefit → CTA," the archetype wins.

• SCRIPT STRUCTURE: ${a.scriptStructure}
• VOICE & DIALOGUE RULES: ${a.voiceRules}
• CAMERA DIRECTION: ${a.cameraDirection}
• ACTING / PERFORMANCE: ${a.actingDirection}
• PRODUCT INTEGRATION: ${a.productIntegration}
• BANNED PATTERNS: ${a.bannedPatterns}
${a.disableHookBank ? '• HOOK BANK: DISABLED — do not write a "scroll-stopping hook." Follow the archetype\'s opening rule instead.' : ''}
${a.disableCTA ? '• CTA: DISABLED — do not write a call-to-action or on-screen CTA text.' : ''}
${a.noDialogue ? '• DIALOGUE: DISABLED — there is NO spoken script. Replace the script section with a SOUND DESIGN MANIFEST (list every sound + timing).' : ''}
${a.forceThreeScene ? '• STRUCTURE: MUST be a 3-scene mini-story (struggle / discovery / transformation). NO talking-head scenes.' : ''}`;
}
