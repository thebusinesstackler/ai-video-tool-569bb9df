// Camera angle definitions with visual descriptions for Reels

export type CameraCategory = 'static' | 'framing' | 'character' | 'movement';

export interface CameraAngle {
  id: string;
  name: string;
  category: CameraCategory;
  description: string;
  visualExample: string; // Description for preview image generation
  promptModifier: string; // Text to add to AI image prompts
}

export const CAMERA_CATEGORIES = [
  { id: 'static', name: 'Static Shots', description: 'Fixed camera positions' },
  { id: 'framing', name: 'Framing', description: 'Subject size in frame' },
  { id: 'character', name: 'Character Shots', description: 'Subject-focused angles' },
  { id: 'movement', name: 'Movement', description: 'Dynamic camera motion' },
];

export const CAMERA_ANGLES: CameraAngle[] = [
  // Static Shots
  {
    id: 'eye-level',
    name: 'Eye Level',
    category: 'static',
    description: 'Camera at subject\'s eye height. Natural, relatable perspective.',
    visualExample: 'Person standing at eye level, camera at neutral height, balanced composition, natural everyday perspective',
    promptModifier: 'shot at eye level, neutral camera angle, straight-on perspective'
  },
  {
    id: 'low-angle',
    name: 'Low Angle',
    category: 'static',
    description: 'Camera below subject looking up. Makes subject appear powerful.',
    visualExample: 'Person shot from below looking up, heroic stance, sky visible behind, powerful imposing presence',
    promptModifier: 'low angle shot looking up, heroic perspective, powerful presence'
  },
  {
    id: 'high-angle',
    name: 'High Angle',
    category: 'static',
    description: 'Camera above subject looking down. Makes subject appear smaller.',
    visualExample: 'Person shot from above looking down, vulnerable appearance, floor visible, diminished perspective',
    promptModifier: 'high angle shot looking down, overhead perspective'
  },
  {
    id: 'birds-eye',
    name: 'Bird\'s Eye',
    category: 'static',
    description: 'Directly overhead view. Shows spatial relationships.',
    visualExample: 'Top-down view directly above, aerial perspective, pattern-like composition, map-like view',
    promptModifier: 'bird\'s eye view, top-down aerial shot, directly overhead'
  },
  {
    id: 'worms-eye',
    name: 'Worm\'s Eye',
    category: 'static',
    description: 'Extreme low angle from ground. Dramatic and imposing.',
    visualExample: 'Extreme low shot from ground level, towering perspective, sky dramatic, larger than life feeling',
    promptModifier: 'worm\'s eye view, extreme low angle from ground, looking up dramatically'
  },
  {
    id: 'dutch-angle',
    name: 'Dutch Angle',
    category: 'static',
    description: 'Tilted camera creates unease and tension.',
    visualExample: 'Tilted frame at 15-30 degrees, uneasy atmosphere, dynamic diagonal lines, tension and drama',
    promptModifier: 'dutch angle, tilted camera, canted frame, dramatic tension'
  },
  
  // Framing Shots
  {
    id: 'extreme-closeup',
    name: 'Extreme Close-Up',
    category: 'framing',
    description: 'Focus on specific detail like eyes or lips.',
    visualExample: 'Extreme close-up of eyes only, intense detail, emotional depth, intimate revealing shot',
    promptModifier: 'extreme close-up shot, tight frame on detail, macro perspective'
  },
  {
    id: 'closeup',
    name: 'Close-Up',
    category: 'framing',
    description: 'Head and shoulders. Shows emotion and detail.',
    visualExample: 'Close-up portrait, head and shoulders visible, emotional expression, intimate framing',
    promptModifier: 'close-up shot, head and shoulders, intimate framing'
  },
  {
    id: 'medium-closeup',
    name: 'Medium Close-Up',
    category: 'framing',
    description: 'From chest up. Balance of detail and context.',
    visualExample: 'Medium close-up from chest up, conversational distance, balanced composition, talk show style',
    promptModifier: 'medium close-up, chest and head visible, conversational framing'
  },
  {
    id: 'medium-shot',
    name: 'Medium Shot',
    category: 'framing',
    description: 'From waist up. Standard conversational framing.',
    visualExample: 'Medium shot from waist up, standard framing, body language visible, natural composition',
    promptModifier: 'medium shot, waist up, standard framing'
  },
  {
    id: 'medium-long',
    name: 'Medium Long Shot',
    category: 'framing',
    description: 'From knees up. Shows body language and environment.',
    visualExample: 'Medium long shot from knees up, full body language, environment context, balanced scene',
    promptModifier: 'medium long shot, three-quarter body, knees up'
  },
  {
    id: 'long-shot',
    name: 'Long Shot',
    category: 'framing',
    description: 'Full body visible. Subject in environment.',
    visualExample: 'Long shot with full body visible, environment prominent, establishing context, wide framing',
    promptModifier: 'long shot, full body, establishing shot'
  },
  {
    id: 'extreme-long',
    name: 'Extreme Long Shot',
    category: 'framing',
    description: 'Wide establishing shot. Subject small in vast scene.',
    visualExample: 'Extreme wide shot, vast landscape, tiny figure, epic scale, cinematic establishing',
    promptModifier: 'extreme long shot, wide establishing, vast landscape, epic scale'
  },
  
  // Character Shots
  {
    id: 'over-shoulder',
    name: 'Over-the-Shoulder',
    category: 'character',
    description: 'View showing back of subject looking at something.',
    visualExample: 'Back of person visible, looking at scene ahead, shoulder and head from behind',
    promptModifier: 'shot from behind showing the back of the subject, their shoulder and head visible from behind, looking at something in the distance'
  },
  {
    id: 'two-shot',
    name: 'Two Shot',
    category: 'character',
    description: 'Subject with their reflection or mirror.',
    visualExample: 'Person with their mirror reflection, dual subject shot',
    promptModifier: 'shot with person and their mirror reflection visible, showing subject from two angles'
  },
  {
    id: 'pov-shot',
    name: 'POV Shot',
    category: 'character',
    description: 'First-person view with hands visible.',
    visualExample: 'First-person view, hands visible at bottom, subjective perspective, immersive viewpoint',
    promptModifier: 'POV shot showing the subject\'s hands reaching forward, first-person perspective'
  },
  {
    id: 'reaction-shot',
    name: 'Reaction Shot',
    category: 'character',
    description: 'Focus on character\'s emotional reaction.',
    visualExample: 'Close-up of surprised face, emotional reaction, expressive features, response captured',
    promptModifier: 'close-up reaction shot showing expressive emotional response, clear facial expression'
  },
  {
    id: 'profile-shot',
    name: 'Profile Shot',
    category: 'character',
    description: 'Side view of subject. Dramatic silhouette potential.',
    visualExample: 'Side profile view, dramatic lighting, silhouette potential, classic portrait angle',
    promptModifier: 'side profile view, subject facing left or right, showing face from the side, dramatic lighting'
  },
  {
    id: 'three-quarter',
    name: 'Three-Quarter View',
    category: 'character',
    description: 'Subject turned 45° from camera. Depth and dimension.',
    visualExample: 'Three-quarter angle portrait, 45-degree turn, dimensional depth, classic portraiture',
    promptModifier: 'three-quarter view portrait, subject turned 45 degrees from camera, showing depth and dimension'
  },
  
  // Movement Shots
  {
    id: 'dolly-in',
    name: 'Dolly In',
    category: 'movement',
    description: 'Camera moves toward subject. Building intensity.',
    visualExample: 'Camera pushing in toward subject, increasing intensity, focusing attention, dramatic approach',
    promptModifier: 'dolly in shot, camera moving toward subject, intensifying focus'
  },
  {
    id: 'dolly-out',
    name: 'Dolly Out',
    category: 'movement',
    description: 'Camera moves away from subject. Reveals context.',
    visualExample: 'Camera pulling back, revealing more environment, contextual reveal, expanding view',
    promptModifier: 'dolly out shot, camera moving away, revealing context'
  },
  {
    id: 'tracking-shot',
    name: 'Tracking Shot',
    category: 'movement',
    description: 'Camera follows subject horizontally.',
    visualExample: 'Camera following alongside walking subject, lateral movement, smooth tracking, motion blur',
    promptModifier: 'tracking shot, camera following subject, lateral movement'
  },
  {
    id: 'crane-shot',
    name: 'Crane Shot',
    category: 'movement',
    description: 'Sweeping vertical movement. Reveals scope.',
    visualExample: 'Camera rising up to reveal vast scene, sweeping vertical motion, epic reveal, crane perspective',
    promptModifier: 'crane shot, sweeping vertical movement, epic reveal'
  },
  {
    id: 'pan',
    name: 'Pan',
    category: 'movement',
    description: 'Camera pivots horizontally. Follows action or reveals scene.',
    visualExample: 'Camera panning across landscape, horizontal sweep, scenic reveal, panoramic motion',
    promptModifier: 'panning shot, horizontal camera pivot, scenic sweep'
  },
  {
    id: 'tilt',
    name: 'Tilt',
    category: 'movement',
    description: 'Camera pivots vertically. Reveals height or drama.',
    visualExample: 'Camera tilting up tall building, vertical reveal, height emphasis, dramatic ascent',
    promptModifier: 'tilt shot, vertical camera pivot, dramatic reveal'
  },
  {
    id: 'zoom',
    name: 'Zoom',
    category: 'movement',
    description: 'Lens zooms in or out. Quick focus change.',
    visualExample: 'Zooming in on subject, lens compression effect, focus shift, emphasis zoom',
    promptModifier: 'zoom shot, lens zoom, compression effect'
  },
  {
    id: 'whip-pan',
    name: 'Whip Pan',
    category: 'movement',
    description: 'Fast horizontal blur between scenes.',
    visualExample: 'Fast horizontal blur transition, motion smear, energetic whip movement, dynamic transition',
    promptModifier: 'whip pan, fast motion blur, dynamic transition'
  },
  {
    id: 'arc-shot',
    name: 'Arc Shot',
    category: 'movement',
    description: 'Camera moves in circular arc around subject.',
    visualExample: 'Camera circling around subject, orbital movement, 360 perspective, dramatic reveal',
    promptModifier: 'arc shot, circular camera movement, orbital perspective'
  },
  {
    id: 'dolly-zoom',
    name: 'Dolly Zoom',
    category: 'movement',
    description: 'Vertigo effect. Background stretches while subject stays same.',
    visualExample: 'Dolly zoom vertigo effect, background stretching, disorienting perspective, Hitchcock style',
    promptModifier: 'dolly zoom, vertigo effect, perspective distortion'
  },
  {
    id: 'handheld',
    name: 'Handheld',
    category: 'movement',
    description: 'Natural shaky camera. Raw, documentary feel.',
    visualExample: 'Handheld shaky camera, raw documentary style, natural movement, authentic feel',
    promptModifier: 'handheld shot, natural camera shake, documentary style'
  },
  {
    id: 'steadicam',
    name: 'Steadicam',
    category: 'movement',
    description: 'Smooth following shot. Fluid movement through space.',
    visualExample: 'Smooth steadicam following shot, gliding through space, fluid movement, professional polish',
    promptModifier: 'steadicam shot, smooth gliding movement, fluid tracking'
  },
];

export function getCameraAngle(id: string): CameraAngle | undefined {
  return CAMERA_ANGLES.find(a => a.id === id);
}

export function getCameraAnglesByCategory(category: CameraCategory): CameraAngle[] {
  return CAMERA_ANGLES.filter(a => a.category === category);
}

export function getAllCameraAngles(): CameraAngle[] {
  return CAMERA_ANGLES;
}
