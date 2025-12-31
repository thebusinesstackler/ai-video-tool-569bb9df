import { CommercialSegment } from '@/types/testimonialCommercial';

export interface CommercialTemplate {
  id: string;
  name: string;
  description: string;
  segments: Omit<CommercialSegment, 'id' | 'twinId' | 'voiceoverId'>[];
  twinCount: number; // How many unique twins this template uses
}

export const testimonialExamples: CommercialTemplate[] = [
  {
    id: 'simple-testimonial',
    name: 'Simple Testimonial',
    description: 'Single AI Twin speaking about a product',
    twinCount: 1,
    segments: [
      {
        type: 'twin-speaking',
        script: "I have been using this product for 3 months now and I have to say, it completely changed how I work. The results speak for themselves and I could not be happier with my decision.",
        duration: 10,
        transition: 'fade-in',
        status: 'pending'
      }
    ]
  },
  {
    id: 'testimonial-broll',
    name: 'Testimonial + B-Roll',
    description: 'AI Twin with B-roll overlay while voice continues',
    twinCount: 1,
    segments: [
      {
        type: 'twin-speaking',
        script: "Let me tell you about my experience with this amazing service. When I first signed up, I was skeptical...",
        duration: 6,
        transition: 'fade-in',
        status: 'pending'
      },
      {
        type: 'broll-voice-continue',
        brollPrompts: ['Modern office workspace with laptop and coffee, professional setting, natural lighting, clean desk aesthetic'],
        brollImages: [],
        duration: 4,
        transition: 'cut',
        status: 'pending'
      },
      {
        type: 'twin-speaking',
        script: "...but now I use it every single day. That is why I recommend it to everyone I know.",
        duration: 5,
        transition: 'cut',
        status: 'pending'
      }
    ]
  },
  {
    id: 'multi-twin',
    name: 'Multi-Twin Commercial',
    description: 'Two different AI Twins each giving testimonials',
    twinCount: 2,
    segments: [
      {
        type: 'twin-speaking',
        script: "As a business owner, finding the right tools is everything. This solution saved me hours every week and helped me focus on what matters most.",
        duration: 8,
        transition: 'fade-in',
        status: 'pending'
      },
      {
        type: 'twin-speaking',
        script: "I agree completely. The customer support alone is worth it. They are always there when you need them, day or night.",
        duration: 7,
        transition: 'fade-in',
        status: 'pending'
      }
    ]
  },
  {
    id: 'full-production',
    name: 'Full Production',
    description: 'Complete commercial with twins, B-roll, and ending montage',
    twinCount: 2,
    segments: [
      {
        type: 'twin-speaking',
        script: "When I first discovered this product, I was skeptical. But now, I cannot imagine my day without it.",
        duration: 6,
        transition: 'fade-in',
        status: 'pending'
      },
      {
        type: 'broll-voice-continue',
        brollPrompts: ['Hands typing on modern keyboard, close-up of productivity app on screen, bright office environment'],
        brollImages: [],
        duration: 4,
        transition: 'cut',
        status: 'pending'
      },
      {
        type: 'twin-speaking',
        script: "The quality is outstanding and the price is unbeatable. I tell all my friends about it.",
        duration: 5,
        transition: 'fade-in',
        status: 'pending'
      },
      {
        type: 'broll-montage',
        voiceoverText: "Join thousands of satisfied customers today. Start your free trial now and see the difference for yourself.",
        brollPrompts: [
          'Happy customers smiling at camera, diverse group, professional setting',
          'Product packaging with elegant design, studio lighting',
          'Five star review on phone screen, close-up shot',
          'Call to action button, subscribe now, vibrant colors'
        ],
        brollImages: [],
        duration: 10,
        transition: 'cut',
        status: 'pending'
      }
    ]
  }
];
