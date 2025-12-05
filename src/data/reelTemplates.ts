// Intro and Outro template definitions for Reels

export interface IntroTemplate {
  id: string;
  name: string;
  description: string;
  duration: number;
  visualPrompt: string;
  textPlaceholder: string;
}

export interface OutroTemplate {
  id: string;
  name: string;
  description: string;
  duration: number;
  visualPrompt: string;
  textPlaceholder: string;
}

export const INTRO_TEMPLATES: IntroTemplate[] = [
  {
    id: 'none',
    name: 'No Intro',
    description: 'Jump straight into the content',
    duration: 0,
    visualPrompt: '',
    textPlaceholder: ''
  },
  {
    id: 'hook-text',
    name: 'Hook Text',
    description: 'Bold attention-grabbing text overlay',
    duration: 3,
    visualPrompt: 'Dynamic gradient background with bold kinetic typography, eye-catching colors, modern social media style',
    textPlaceholder: 'Wait for it...'
  },
  {
    id: 'topic-title',
    name: 'Topic Title',
    description: 'Clean title card with topic',
    duration: 3,
    visualPrompt: 'Sleek minimal title card with elegant typography, subtle animated background, professional look',
    textPlaceholder: ''
  },
  {
    id: 'question-hook',
    name: 'Question Hook',
    description: 'Provocative question to engage viewers',
    duration: 3,
    visualPrompt: 'Thought-provoking visual with question mark motifs, intriguing atmosphere, curiosity-inducing design',
    textPlaceholder: 'Did you know...?'
  },
  {
    id: 'countdown',
    name: 'Countdown',
    description: 'Countdown to build anticipation',
    duration: 3,
    visualPrompt: 'Energetic countdown animation style, bold numbers, exciting buildup atmosphere, vibrant colors',
    textPlaceholder: '3 Things You Need to Know'
  }
];

export const OUTRO_TEMPLATES: OutroTemplate[] = [
  {
    id: 'none',
    name: 'No Outro',
    description: 'End with the last scene',
    duration: 0,
    visualPrompt: '',
    textPlaceholder: ''
  },
  {
    id: 'cta-follow',
    name: 'Follow CTA',
    description: 'Call to action to follow',
    duration: 3,
    visualPrompt: 'Engaging call-to-action design with follow button imagery, social media icons, arrow pointing, vibrant and friendly',
    textPlaceholder: 'Follow for more!'
  },
  {
    id: 'cta-subscribe',
    name: 'Subscribe CTA',
    description: 'Encourage subscription',
    duration: 3,
    visualPrompt: 'Subscribe button animation style, notification bell icon, exciting teaser atmosphere, part 2 coming soon vibes',
    textPlaceholder: 'Subscribe for Part 2!'
  },
  {
    id: 'cta-comment',
    name: 'Comment Prompt',
    description: 'Ask viewers to comment',
    duration: 3,
    visualPrompt: 'Interactive comment bubble design, question marks, community engagement vibes, friendly and inviting',
    textPlaceholder: 'What do you think? Comment below!'
  },
  {
    id: 'cta-share',
    name: 'Share CTA',
    description: 'Encourage sharing',
    duration: 3,
    visualPrompt: 'Share arrow icons, viral growth visualization, spreading network design, energetic and shareable',
    textPlaceholder: 'Share this with a friend!'
  }
];

export function getIntroTemplate(id: string): IntroTemplate | undefined {
  return INTRO_TEMPLATES.find(t => t.id === id);
}

export function getOutroTemplate(id: string): OutroTemplate | undefined {
  return OUTRO_TEMPLATES.find(t => t.id === id);
}
