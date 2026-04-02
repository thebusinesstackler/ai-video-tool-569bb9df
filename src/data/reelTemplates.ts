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
    description: 'Bold follow prompt with your handle featured prominently',
    duration: 3,
    visualPrompt: 'Professional dark gradient background, large bold "@HANDLE" text centered, glowing follow button below with pulse ring effect, subtle floating social media icons (Instagram, TikTok) in background, premium neon accent lighting, clean modern typography, 9:16 vertical format',
    textPlaceholder: '@yourhandle — Follow for more',
    category: 'social'
  },
  {
    id: 'cta-follow-animated',
    name: 'Animated Follow',
    description: 'Follow button with hearts, likes, and engagement animations',
    duration: 4,
    visualPrompt: 'Cinematic dark background with floating glowing hearts, like icons, and notification bells animating upward, large centered follow button with pulsing glow ring, "@HANDLE" text above in bold modern font, warm gradient accents (pink to orange), professional motion graphics style, 9:16 vertical format',
    textPlaceholder: 'Tap Follow — Don\'t miss the next one!',
    category: 'social'
  },
  {
    id: 'cta-subscribe',
    name: 'Subscribe CTA',
    description: 'YouTube-style subscribe with bell notification',
    duration: 3,
    visualPrompt: 'Professional subscribe card, large red subscribe button with white text centered, golden bell notification icon with "ON" indicator, dark cinematic background with subtle light rays, channel name in bold modern typography above, clean professional layout, 9:16 vertical format',
    textPlaceholder: 'Subscribe & Hit the Bell 🔔',
    category: 'social'
  },
  {
    id: 'cta-like-subscribe',
    name: 'Like & Subscribe',
    description: 'Dual-action CTA with thumbs up and subscribe',
    duration: 4,
    visualPrompt: 'Split-screen professional CTA card, left side: glowing thumbs-up icon with "LIKE" label, right side: red subscribe button with bell icon, creator handle centered below in bold typography, dark premium background with subtle gradient, engagement counter animations, clean modern design, 9:16 vertical format',
    textPlaceholder: '👍 Like & Subscribe for more!',
    category: 'social'
  },
  {
    id: 'cta-all-socials',
    name: 'Social Links Hub',
    description: 'Professional multi-platform social card with all handles',
    duration: 5,
    visualPrompt: 'Premium social media link card, dark elegant background with subtle texture, vertically stacked social icons (Instagram, TikTok, YouTube, Twitter/X) each with glowing brand-colored icon and "@handle" text beside it, thin separator lines between each, professional business-card aesthetic, subtle animated glow on each icon, modern sans-serif typography, 9:16 vertical format',
    textPlaceholder: '@yourhandle on all platforms',
    category: 'social'
  },
  {
    id: 'cta-comment',
    name: 'Comment Prompt',
    description: 'Engaging question that drives comments and discussion',
    duration: 3,
    visualPrompt: 'Eye-catching discussion prompt card, large bold question text centered, speech bubble icons and comment notification graphics floating around, vibrant accent color (electric blue or hot pink) on dark background, "DROP A COMMENT" call-out at bottom with arrow pointing down, modern clean typography, 9:16 vertical format',
    textPlaceholder: 'What\'s YOUR take? Drop it in the comments 👇',
    category: 'social'
  },
  {
    id: 'cta-share',
    name: 'Share CTA',
    description: 'Encourage sharing with viral growth visuals',
    duration: 3,
    visualPrompt: 'Viral sharing visualization, glowing share/forward arrow icon centered on dark cinematic background, expanding network connection lines radiating outward, "SHARE THIS" in bold modern typography, subtle gradient from deep purple to electric blue, professional motion-graphic aesthetic, 9:16 vertical format',
    textPlaceholder: 'Tag someone who needs to see this 🔥',
    category: 'social'
  },
  {
    id: 'cta-duet-stitch',
    name: 'Duet / Stitch',
    description: 'Invite duets and stitches for maximum reach',
    duration: 3,
    visualPrompt: 'TikTok-style duet invitation card, split-screen preview mockup with glowing border, "DUET THIS" or "STITCH THIS" in bold neon text, dark background with vibrant pink and cyan accent lights, creator handle below, engaging modern layout, 9:16 vertical format',
    textPlaceholder: 'Duet this with your reaction! 🎬',
    category: 'social'
  },
  
  // Engagement Outros
  {
    id: 'teaser-next',
    name: 'Coming Next',
    description: 'Build anticipation for your next drop',
    duration: 4,
    visualPrompt: 'Cinematic teaser card, blurred preview frame with large centered play button, "PART 2" in bold stacked typography with glowing edges, "COMING TOMORROW" subtitle, dark moody background with light leaks, suspense-building aesthetic, countdown timer visual, 9:16 vertical format',
    textPlaceholder: 'Part 2 drops tomorrow — Turn on notifications 🔔',
    category: 'engagement'
  },
  {
    id: 'question-poll',
    name: 'Poll Question',
    description: 'Interactive poll that drives comments and saves',
    duration: 4,
    visualPrompt: 'Interactive poll card with two large option buttons (Option A vs Option B), percentage bars partially filled, vibrant contrasting colors (blue vs orange), dark background, bold question text at top, "VOTE IN COMMENTS" at bottom, clean modern UI design, 9:16 vertical format',
    textPlaceholder: 'Which do you prefer? Comment A or B 👇',
    category: 'engagement'
  },
  {
    id: 'quote-end',
    name: 'Ending Quote',
    description: 'Memorable quote that gets saved and shared',
    duration: 4,
    visualPrompt: 'Premium quote card, large elegant quotation marks, serif typography for the quote text, creator name and handle below in sans-serif, dark textured background with subtle gold or warm accent lighting, bookmark/save icon hint in corner, sophisticated editorial design, 9:16 vertical format',
    textPlaceholder: '"Your powerful closing quote here"',
    category: 'engagement'
  },
  {
    id: 'recap-highlights',
    name: 'Quick Recap',
    description: 'Key takeaways card that viewers screenshot',
    duration: 4,
    visualPrompt: 'Clean takeaways card, numbered list (1-3) with bold key points, each with a small icon, dark background with accent-colored highlight boxes, "SAVE THIS" watermark in corner, professional infographic style, modern typography, 9:16 vertical format',
    textPlaceholder: '📌 Save this — Key Takeaways:',
    category: 'engagement'
  },
  {
    id: 'challenge-cta',
    name: 'Challenge',
    description: 'Dare viewers to take action and tag you',
    duration: 3,
    visualPrompt: 'Bold challenge card, "CHALLENGE" text with fire/spark effects, energetic gradient background (red to orange), bold dare text centered, "TAG ME IN YOUR RESULTS" at bottom with @ handle, high-energy action-oriented design, 9:16 vertical format',
    textPlaceholder: 'Try this for 7 days and tag me 🔥',
    category: 'engagement'
  },
  
  // Professional Endings
  {
    id: 'thank-you',
    name: 'Thank You',
    description: 'Warm professional sign-off with branding',
    duration: 3,
    visualPrompt: 'Elegant thank you card, "THANK YOU" in large warm gold typography, creator name and handle below, dark premium background with subtle warm gradient, small social icons row at bottom, heartfelt yet professional, 9:16 vertical format',
    textPlaceholder: 'Thank you for watching! 🙏',
    category: 'professional'
  },
  {
    id: 'contact-info',
    name: 'Contact Card',
    description: 'Professional business card with contact details',
    duration: 4,
    visualPrompt: 'Premium digital business card, dark matte background, name in bold large text, email icon with address, globe icon with website URL, phone icon with number, clean vertical layout with thin gold separator lines, professional corporate design, 9:16 vertical format',
    textPlaceholder: 'hello@yourbrand.com | yourwebsite.com',
    category: 'professional'
  },
  {
    id: 'website-cta',
    name: 'Visit Website',
    description: 'Drive traffic with a clear URL call-to-action',
    duration: 3,
    visualPrompt: 'Website CTA card, large bold URL text centered, browser mockup preview showing the site, glowing "VISIT NOW" button below with cursor icon, dark cinematic background with subtle blue accent light, professional marketing design, 9:16 vertical format',
    textPlaceholder: '🌐 yourwebsite.com — Link in bio',
    category: 'professional'
  },
  {
    id: 'credits-roll',
    name: 'Credits',
    description: 'Cinematic credits with branding',
    duration: 5,
    visualPrompt: 'Movie-style credits card, creator name in elegant serif font, role titles in smaller sans-serif below, dark background with subtle film grain texture, "Follow for more" with social icons at bottom, cinematic professional closing, 9:16 vertical format',
    textPlaceholder: 'Created by: Your Name\n@yourhandle',
    category: 'professional'
  },
  {
    id: 'book-call',
    name: 'Book a Call',
    description: 'Convert viewers into leads with a booking CTA',
    duration: 4,
    visualPrompt: 'Premium booking CTA card, large "BOOK YOUR FREE CALL" text, calendar icon with available date slots visual, glowing CTA button below, dark elegant background with professional blue accent, trust badges or testimonial snippet, conversion-focused layout, 9:16 vertical format',
    textPlaceholder: '📅 Book your free strategy call — Link in bio',
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
