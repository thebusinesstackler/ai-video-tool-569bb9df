// Intro and Outro template definitions for Reels

export interface IntroTemplate {
  id: string;
  name: string;
  description: string;
  duration: number;
  visualPrompt: string;
  textPlaceholder: string;
  category?: string;
}

export interface OutroTemplate {
  id: string;
  name: string;
  description: string;
  duration: number;
  visualPrompt: string;
  textPlaceholder: string;
  category: 'none' | 'brand' | 'social' | 'engagement' | 'professional';
  supportsLogo?: boolean;
}

export type LogoAnimation = 'fade' | 'zoom' | 'bounce' | 'glitch' | 'rotate' | 'scale-fade';

export interface LogoAnimationOption {
  id: LogoAnimation;
  name: string;
  description: string;
}

export const LOGO_ANIMATIONS: LogoAnimationOption[] = [
  { id: 'fade', name: 'Fade In', description: 'Elegant fade in effect' },
  { id: 'zoom', name: 'Zoom In', description: 'Zoom in from small to full size' },
  { id: 'bounce', name: 'Bounce', description: 'Playful bounce animation' },
  { id: 'glitch', name: 'Glitch', description: 'Modern digital glitch effect' },
  { id: 'rotate', name: 'Rotate In', description: 'Spin into view with style' },
  { id: 'scale-fade', name: 'Scale & Fade', description: 'Combined scale and fade effect' },
];

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
  // No Outro
  {
    id: 'none',
    name: 'No Outro',
    description: 'End with the last scene',
    duration: 0,
    visualPrompt: '',
    textPlaceholder: '',
    category: 'none'
  },
  
  // Brand/Logo Outros
  {
    id: 'logo-fade',
    name: 'Logo Fade',
    description: 'Your logo fades in elegantly on dark background',
    duration: 3,
    visualPrompt: 'Elegant dark background with subtle gradient, centered logo placement, premium professional look, cinematic quality',
    textPlaceholder: '',
    category: 'brand',
    supportsLogo: true
  },
  {
    id: 'logo-animate',
    name: 'Animated Logo',
    description: 'Logo with dynamic animation effect',
    duration: 4,
    visualPrompt: 'Dynamic animated logo reveal, modern motion graphics, sleek professional branding, energetic entrance',
    textPlaceholder: '',
    category: 'brand',
    supportsLogo: true
  },
  {
    id: 'logo-glitch',
    name: 'Glitch Logo',
    description: 'Modern glitch effect reveal',
    duration: 3,
    visualPrompt: 'Digital glitch effect logo reveal, cyberpunk aesthetic, RGB distortion, tech-forward modern style',
    textPlaceholder: '',
    category: 'brand',
    supportsLogo: true
  },
  {
    id: 'logo-neon',
    name: 'Neon Logo',
    description: 'Neon glow effect on dark background',
    duration: 3,
    visualPrompt: 'Neon sign effect logo, glowing edges, dark atmospheric background, vibrant color glow, retro-modern style',
    textPlaceholder: '',
    category: 'brand',
    supportsLogo: true
  },
  
  // Social CTAs
  {
    id: 'cta-follow',
    name: 'Follow CTA',
    description: 'Call to action to follow',
    duration: 3,
    visualPrompt: 'Engaging call-to-action design with follow button imagery, social media icons, arrow pointing, vibrant and friendly',
    textPlaceholder: 'Follow for more!',
    category: 'social'
  },
  {
    id: 'cta-follow-animated',
    name: 'Animated Follow',
    description: 'Follow button with pulse animation',
    duration: 4,
    visualPrompt: 'Animated follow button with pulsing effect, social media app style, floating hearts, engagement vibes',
    textPlaceholder: 'Hit that follow button!',
    category: 'social'
  },
  {
    id: 'cta-subscribe',
    name: 'Subscribe CTA',
    description: 'Encourage subscription',
    duration: 3,
    visualPrompt: 'Subscribe button animation style, notification bell icon, exciting teaser atmosphere, part 2 coming soon vibes',
    textPlaceholder: 'Subscribe for Part 2!',
    category: 'social'
  },
  {
    id: 'cta-like-subscribe',
    name: 'Like & Subscribe',
    description: 'YouTube-style dual CTA',
    duration: 4,
    visualPrompt: 'YouTube style like and subscribe buttons, thumbs up icon, bell notification, red accent colors, creator friendly',
    textPlaceholder: 'Like & Subscribe!',
    category: 'social'
  },
  {
    id: 'cta-all-socials',
    name: 'Social Links',
    description: 'All social media handles',
    duration: 4,
    visualPrompt: 'Social media handle card with multiple platform icons, Instagram TikTok YouTube Twitter, clean grid layout, modern design',
    textPlaceholder: '@yourhandle',
    category: 'social'
  },
  {
    id: 'cta-comment',
    name: 'Comment Prompt',
    description: 'Ask viewers to comment',
    duration: 3,
    visualPrompt: 'Interactive comment bubble design, question marks, community engagement vibes, friendly and inviting',
    textPlaceholder: 'What do you think? Comment below!',
    category: 'social'
  },
  {
    id: 'cta-share',
    name: 'Share CTA',
    description: 'Encourage sharing',
    duration: 3,
    visualPrompt: 'Share arrow icons, viral growth visualization, spreading network design, energetic and shareable',
    textPlaceholder: 'Share this with a friend!',
    category: 'social'
  },
  
  // Engagement Outros
  {
    id: 'teaser-next',
    name: 'Coming Next',
    description: 'Teaser preview of next video',
    duration: 4,
    visualPrompt: 'Teaser preview card, blurred background with play button, coming soon typography, mysterious anticipation',
    textPlaceholder: 'Part 2 drops tomorrow...',
    category: 'engagement'
  },
  {
    id: 'question-poll',
    name: 'Poll Question',
    description: 'Ask viewers to vote',
    duration: 4,
    visualPrompt: 'Interactive poll design with two options, voting buttons, engagement-focused, bright contrasting colors',
    textPlaceholder: 'Which do you prefer? A or B?',
    category: 'engagement'
  },
  {
    id: 'quote-end',
    name: 'Ending Quote',
    description: 'Inspirational quote closeout',
    duration: 4,
    visualPrompt: 'Elegant quote card, quotation marks, inspiring typography, subtle animated background, thoughtful atmosphere',
    textPlaceholder: '"Your inspirational quote here"',
    category: 'engagement'
  },
  {
    id: 'recap-highlights',
    name: 'Quick Recap',
    description: 'Summary of key points',
    duration: 4,
    visualPrompt: 'Bullet point recap design, numbered list style, clean minimal layout, key takeaways highlighted',
    textPlaceholder: 'Key Takeaways:',
    category: 'engagement'
  },
  {
    id: 'challenge-cta',
    name: 'Challenge',
    description: 'Challenge viewers to try something',
    duration: 3,
    visualPrompt: 'Bold challenge text, energetic flames or sparks, dare atmosphere, action-oriented design',
    textPlaceholder: 'I challenge you to try this!',
    category: 'engagement'
  },
  
  // Professional Endings
  {
    id: 'thank-you',
    name: 'Thank You',
    description: 'Elegant thank you message',
    duration: 3,
    visualPrompt: 'Elegant thank you typography, warm gradient background, appreciation vibes, heartfelt professional',
    textPlaceholder: 'Thank you for watching!',
    category: 'professional'
  },
  {
    id: 'contact-info',
    name: 'Contact Card',
    description: 'Business contact details',
    duration: 4,
    visualPrompt: 'Business card style design, email and website icons, professional layout, corporate clean aesthetic',
    textPlaceholder: 'contact@email.com',
    category: 'professional'
  },
  {
    id: 'website-cta',
    name: 'Visit Website',
    description: 'Website URL call to action',
    duration: 3,
    visualPrompt: 'Website URL display with browser mockup, cursor clicking animation style, modern web design preview',
    textPlaceholder: 'www.yourwebsite.com',
    category: 'professional'
  },
  {
    id: 'credits-roll',
    name: 'Credits',
    description: 'Simple credits scroll',
    duration: 5,
    visualPrompt: 'Movie credits style rolling text, dark background, elegant serif typography, cinematic closing',
    textPlaceholder: 'Created by: Your Name',
    category: 'professional'
  },
  {
    id: 'book-call',
    name: 'Book a Call',
    description: 'Schedule appointment CTA',
    duration: 4,
    visualPrompt: 'Calendar booking interface style, schedule button, availability slots visual, professional service',
    textPlaceholder: 'Book your free call today!',
    category: 'professional'
  }
];

export const OUTRO_CATEGORIES = [
  { id: 'brand', name: 'Brand/Logo', icon: 'Palette' },
  { id: 'social', name: 'Social CTAs', icon: 'Share2' },
  { id: 'engagement', name: 'Engagement', icon: 'MessageCircle' },
  { id: 'professional', name: 'Professional', icon: 'Briefcase' },
];

export function getIntroTemplate(id: string): IntroTemplate | undefined {
  return INTRO_TEMPLATES.find(t => t.id === id);
}

export function getOutroTemplate(id: string): OutroTemplate | undefined {
  return OUTRO_TEMPLATES.find(t => t.id === id);
}

export function getOutrosByCategory(category: string): OutroTemplate[] {
  if (category === 'all') return OUTRO_TEMPLATES.filter(t => t.id !== 'none');
  return OUTRO_TEMPLATES.filter(t => t.category === category);
}
