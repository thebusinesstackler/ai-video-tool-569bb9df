// Commercial and short-form video templates with pre-configured scenes

export interface CommercialTemplate {
  id: string;
  name: string;
  category: 'awareness' | 'product' | 'service' | 'nonprofit' | 'brand' | 'testimonial';
  duration: '30sec' | '60sec' | '90sec' | '3min';
  description: string;
  emotionalArc: string;
  scenes: TemplateScene[];
}

export interface TemplateScene {
  title: string;
  duration: number; // seconds
  mood: string;
  cameraMovement: string;
  lighting: string;
  startFrameGuide: string;
  endFrameGuide: string;
  transitionGuide: string;
  dialogueGuide: string;
  musicGuide: string;
}

export const COMMERCIAL_TEMPLATES: CommercialTemplate[] = [
  {
    id: 'alzheimers-awareness',
    name: "Alzheimer's Awareness",
    category: 'awareness',
    duration: '3min',
    description: "A powerful 3-minute awareness commercial showing the emotional journey of Alzheimer's through memory loss and love.",
    emotionalArc: 'Nostalgic → Melancholic → Hopeful → Inspiring',
    scenes: [
      {
        title: 'Golden Memories',
        duration: 25,
        mood: 'nostalgic',
        cameraMovement: 'slow-dolly',
        lighting: 'golden-hour',
        startFrameGuide: 'Elderly hands holding a worn photo album, soft warm light',
        endFrameGuide: 'Close-up of a wedding photo from decades ago, slight blur at edges',
        transitionGuide: 'Gentle push-in as fingers trace the photograph',
        dialogueGuide: 'Voiceover: "I remember the day we met like it was yesterday..."',
        musicGuide: 'Soft piano, vintage music box undertones'
      },
      {
        title: 'The Forgetting',
        duration: 30,
        mood: 'melancholic',
        cameraMovement: 'static',
        lighting: 'overcast',
        startFrameGuide: 'Same elderly person looking confused at familiar objects',
        endFrameGuide: 'Face shows struggle to remember, loved one watching from doorway',
        transitionGuide: 'Static shot emphasizes the stillness of confusion',
        dialogueGuide: 'Silence, then softly: "What was I looking for?"',
        musicGuide: 'Minimal, sparse notes, underlying tension'
      },
      {
        title: 'Family Support',
        duration: 25,
        mood: 'peaceful',
        cameraMovement: 'tracking',
        lighting: 'natural',
        startFrameGuide: 'Adult child holding parent\'s hand, walking in garden',
        endFrameGuide: 'Both faces visible, a moment of connection despite the struggle',
        transitionGuide: 'Gentle tracking shot following their walk',
        dialogueGuide: 'Voiceover: "Even when the memories fade, love remains..."',
        musicGuide: 'Strings enter softly, hopeful undertones'
      },
      {
        title: 'Moments of Clarity',
        duration: 20,
        mood: 'romantic',
        cameraMovement: 'push-in',
        lighting: 'golden-hour',
        startFrameGuide: 'Elderly couple, one recognizes the other - eyes light up',
        endFrameGuide: 'Close-up of genuine smile, tears of joy',
        transitionGuide: 'Slow push-in to capture the emotional breakthrough',
        dialogueGuide: '"I know you... you\'re my everything."',
        musicGuide: 'Piano crescendo, emotionally moving'
      },
      {
        title: 'Community of Care',
        duration: 25,
        mood: 'inspiring',
        cameraMovement: 'crane-up',
        lighting: 'natural',
        startFrameGuide: 'Support group gathering, diverse faces of caregivers',
        endFrameGuide: 'Wide shot showing community connection, hands joined',
        transitionGuide: 'Crane up to reveal the scale of community',
        dialogueGuide: 'Voiceover: "You are not alone in this journey..."',
        musicGuide: 'Uplifting orchestra building'
      },
      {
        title: 'Research & Hope',
        duration: 20,
        mood: 'triumphant',
        cameraMovement: 'tracking',
        lighting: 'studio',
        startFrameGuide: 'Scientists working in lab, dedicated focus',
        endFrameGuide: 'Breakthrough moment - hopeful expression',
        transitionGuide: 'Dynamic tracking through the lab',
        dialogueGuide: 'Voiceover: "Every day, we get closer to a cure..."',
        musicGuide: 'Triumphant, building momentum'
      },
      {
        title: 'Call to Action',
        duration: 35,
        mood: 'inspiring',
        cameraMovement: 'static',
        lighting: 'golden-hour',
        startFrameGuide: 'Return to elderly couple, holding hands at sunset',
        endFrameGuide: 'Logo and donation information overlay on peaceful scene',
        transitionGuide: 'Fade to call-to-action',
        dialogueGuide: 'Voiceover: "Help us remember, so they never forget. Donate today."',
        musicGuide: 'Emotional climax, resolving peacefully'
      }
    ]
  },
  {
    id: 'product-launch',
    name: 'Product Launch',
    category: 'product',
    duration: '60sec',
    description: 'A dynamic 60-second product reveal with problem-solution storytelling.',
    emotionalArc: 'Frustration → Discovery → Amazement → Desire',
    scenes: [
      {
        title: 'The Problem',
        duration: 12,
        mood: 'tense',
        cameraMovement: 'handheld',
        lighting: 'harsh',
        startFrameGuide: 'Person struggling with everyday frustration',
        endFrameGuide: 'Exasperated expression, defeated posture',
        transitionGuide: 'Shaky handheld emphasizes chaos',
        dialogueGuide: 'Show don\'t tell - frustrated sighs',
        musicGuide: 'Tense, building anxiety'
      },
      {
        title: 'The Discovery',
        duration: 10,
        mood: 'mysterious',
        cameraMovement: 'push-in',
        lighting: 'rim-light',
        startFrameGuide: 'Product revealed in dramatic lighting',
        endFrameGuide: 'Hero shot of product, gleaming',
        transitionGuide: 'Dramatic reveal push-in',
        dialogueGuide: 'Sound effect: whoosh, reveal sting',
        musicGuide: 'Suspenseful pause, then revelation'
      },
      {
        title: 'Product in Action',
        duration: 20,
        mood: 'action',
        cameraMovement: 'tracking',
        lighting: 'studio',
        startFrameGuide: 'Product being used, elegant motion',
        endFrameGuide: 'Problem solved, smooth operation',
        transitionGuide: 'Dynamic tracking showing features',
        dialogueGuide: 'Voiceover highlighting key benefits',
        musicGuide: 'Energetic, confident, modern'
      },
      {
        title: 'Happy Customer',
        duration: 10,
        mood: 'triumphant',
        cameraMovement: 'static',
        lighting: 'golden-hour',
        startFrameGuide: 'Satisfied customer smile',
        endFrameGuide: 'Lifestyle shot with product integrated',
        transitionGuide: 'Smooth transition to lifestyle',
        dialogueGuide: '"I can\'t believe I lived without this."',
        musicGuide: 'Upbeat, victorious'
      },
      {
        title: 'Call to Action',
        duration: 8,
        mood: 'inspiring',
        cameraMovement: 'static',
        lighting: 'studio',
        startFrameGuide: 'Product beauty shot with price',
        endFrameGuide: 'Logo, website, call-to-action text',
        transitionGuide: 'Clean transition to CTA',
        dialogueGuide: '"Order now at [website]. Limited time offer."',
        musicGuide: 'Resolving, memorable jingle'
      }
    ]
  },
  {
    id: 'nonprofit-donation',
    name: 'Nonprofit Appeal',
    category: 'nonprofit',
    duration: '90sec',
    description: 'An emotional 90-second nonprofit appeal showing impact and urgency.',
    emotionalArc: 'Concern → Empathy → Hope → Action',
    scenes: [
      {
        title: 'The Challenge',
        duration: 20,
        mood: 'melancholic',
        cameraMovement: 'static',
        lighting: 'overcast',
        startFrameGuide: 'Wide shot of the issue/problem area',
        endFrameGuide: 'Individual affected - humanize the cause',
        transitionGuide: 'Slow zoom to personal level',
        dialogueGuide: 'Statistics overlay, then personal story begins',
        musicGuide: 'Somber, minimal, emotionally open'
      },
      {
        title: 'Personal Story',
        duration: 25,
        mood: 'peaceful',
        cameraMovement: 'tracking',
        lighting: 'natural',
        startFrameGuide: 'Beneficiary sharing their story',
        endFrameGuide: 'Close-up of genuine emotion',
        transitionGuide: 'Gentle tracking as they share',
        dialogueGuide: 'First-person account of struggle and hope',
        musicGuide: 'Gentle strings, building warmth'
      },
      {
        title: 'Your Impact',
        duration: 20,
        mood: 'inspiring',
        cameraMovement: 'crane-up',
        lighting: 'golden-hour',
        startFrameGuide: 'Organization workers making difference',
        endFrameGuide: 'Transformation - before/after comparison',
        transitionGuide: 'Dynamic reveal of positive change',
        dialogueGuide: '"Because of donors like you..."',
        musicGuide: 'Hopeful, building momentum'
      },
      {
        title: 'Call to Action',
        duration: 25,
        mood: 'triumphant',
        cameraMovement: 'static',
        lighting: 'studio',
        startFrameGuide: 'Return to beneficiary - now thriving',
        endFrameGuide: 'Donation info with emotional close',
        transitionGuide: 'Fade to call-to-action',
        dialogueGuide: '"Your gift today can change a life. Donate now."',
        musicGuide: 'Emotional peak, resolving to action'
      }
    ]
  },
  {
    id: 'brand-story',
    name: 'Brand Origin Story',
    category: 'brand',
    duration: '90sec',
    description: 'A compelling brand origin story showing values and mission.',
    emotionalArc: 'Curiosity → Connection → Trust → Loyalty',
    scenes: [
      {
        title: 'Humble Beginnings',
        duration: 20,
        mood: 'nostalgic',
        cameraMovement: 'slow-dolly',
        lighting: 'golden-hour',
        startFrameGuide: 'Founder in original workspace/garage',
        endFrameGuide: 'First product being crafted by hand',
        transitionGuide: 'Intimate dolly revealing the start',
        dialogueGuide: '"It all started with a simple idea..."',
        musicGuide: 'Acoustic, warm, authentic'
      },
      {
        title: 'The Vision',
        duration: 20,
        mood: 'inspiring',
        cameraMovement: 'push-in',
        lighting: 'natural',
        startFrameGuide: 'Founder explaining the why',
        endFrameGuide: 'Passion visible in expression',
        transitionGuide: 'Push-in to emphasize conviction',
        dialogueGuide: '"We believed there had to be a better way..."',
        musicGuide: 'Building inspiration'
      },
      {
        title: 'Growth & Values',
        duration: 25,
        mood: 'triumphant',
        cameraMovement: 'tracking',
        lighting: 'studio',
        startFrameGuide: 'Team working together, collaborative',
        endFrameGuide: 'Product quality check, attention to detail',
        transitionGuide: 'Dynamic tracking through operations',
        dialogueGuide: '"Every product carries our promise..."',
        musicGuide: 'Corporate but human, building'
      },
      {
        title: 'Community Impact',
        duration: 25,
        mood: 'peaceful',
        cameraMovement: 'crane-up',
        lighting: 'golden-hour',
        startFrameGuide: 'Happy customers using product',
        endFrameGuide: 'Wide shot of brand in community',
        transitionGuide: 'Crane revealing broader impact',
        dialogueGuide: '"Today, we\'re proud to serve millions..."',
        musicGuide: 'Warm, communal, uplifting'
      }
    ]
  },
  {
    id: 'testimonial-montage',
    name: 'Customer Testimonial',
    category: 'testimonial',
    duration: '60sec',
    description: 'A 60-second montage of authentic customer testimonials.',
    emotionalArc: 'Skepticism → Discovery → Satisfaction → Advocacy',
    scenes: [
      {
        title: 'First Testimonial',
        duration: 15,
        mood: 'peaceful',
        cameraMovement: 'static',
        lighting: 'natural',
        startFrameGuide: 'Customer in natural environment',
        endFrameGuide: 'Genuine smile while sharing experience',
        transitionGuide: 'Talking head with B-roll cutaways',
        dialogueGuide: '"I was skeptical at first, but..."',
        musicGuide: 'Light, conversational underscore'
      },
      {
        title: 'Second Testimonial',
        duration: 15,
        mood: 'inspiring',
        cameraMovement: 'slight-tracking',
        lighting: 'golden-hour',
        startFrameGuide: 'Different customer, different setting',
        endFrameGuide: 'Showing product in use',
        transitionGuide: 'Gentle movement adds energy',
        dialogueGuide: '"This completely changed how I..."',
        musicGuide: 'Building positivity'
      },
      {
        title: 'Third Testimonial',
        duration: 15,
        mood: 'triumphant',
        cameraMovement: 'static',
        lighting: 'studio',
        startFrameGuide: 'Third customer, professional setting',
        endFrameGuide: 'Confident recommendation',
        transitionGuide: 'Clean, professional framing',
        dialogueGuide: '"I recommend this to everyone..."',
        musicGuide: 'Confident, trustworthy'
      },
      {
        title: 'Closing & CTA',
        duration: 15,
        mood: 'inspiring',
        cameraMovement: 'push-in',
        lighting: 'studio',
        startFrameGuide: 'Quick montage of all testimonials',
        endFrameGuide: 'Product hero shot with call-to-action',
        transitionGuide: 'Quick cuts to energy, then settle',
        dialogueGuide: '"Join thousands of satisfied customers."',
        musicGuide: 'Resolving, memorable ending'
      }
    ]
  },
  {
    id: 'service-explainer',
    name: 'Service Explainer',
    category: 'service',
    duration: '60sec',
    description: 'A clear 60-second explainer video for a service offering.',
    emotionalArc: 'Confusion → Clarity → Confidence → Action',
    scenes: [
      {
        title: 'The Pain Point',
        duration: 12,
        mood: 'tense',
        cameraMovement: 'handheld',
        lighting: 'harsh',
        startFrameGuide: 'Person overwhelmed by complexity',
        endFrameGuide: 'Visual representation of the problem',
        transitionGuide: 'Quick cuts showing frustration',
        dialogueGuide: '"Tired of dealing with...?"',
        musicGuide: 'Tense, modern, building'
      },
      {
        title: 'Introducing Solution',
        duration: 15,
        mood: 'mysterious',
        cameraMovement: 'push-in',
        lighting: 'studio',
        startFrameGuide: 'Service brand/logo reveal',
        endFrameGuide: 'Clean interface or service representation',
        transitionGuide: 'Smooth reveal transition',
        dialogueGuide: '"Introducing [Service Name]..."',
        musicGuide: 'Resolution, clarity'
      },
      {
        title: 'How It Works',
        duration: 20,
        mood: 'peaceful',
        cameraMovement: 'tracking',
        lighting: 'natural',
        startFrameGuide: 'Step 1 visualization',
        endFrameGuide: 'Step 3 - complete process shown',
        transitionGuide: 'Smooth transitions between steps',
        dialogueGuide: '"Simply 1, 2, 3..."',
        musicGuide: 'Light, explanatory, clear'
      },
      {
        title: 'Call to Action',
        duration: 13,
        mood: 'inspiring',
        cameraMovement: 'static',
        lighting: 'studio',
        startFrameGuide: 'Happy customer result',
        endFrameGuide: 'Sign-up info, website, phone',
        transitionGuide: 'Clean transition to CTA',
        dialogueGuide: '"Get started today. Visit..."',
        musicGuide: 'Upbeat, action-oriented ending'
      }
    ]
  }
];

export const getTemplatesByCategory = (category: CommercialTemplate['category']) => {
  return COMMERCIAL_TEMPLATES.filter(t => t.category === category);
};

export const getTemplateById = (id: string) => {
  return COMMERCIAL_TEMPLATES.find(t => t.id === id);
};
