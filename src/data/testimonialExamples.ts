import { CommercialSegment } from '@/types/testimonialCommercial';

export interface CommercialTemplate {
  id: string;
  name: string;
  description: string;
  segments: Omit<CommercialSegment, 'id'>[];
  twinCount: number;
}

export const testimonialExamples: CommercialTemplate[] = [
  {
    id: 'simple-testimonial',
    name: 'Simple Testimonial',
    description: 'Single actor speaking about a product',
    twinCount: 1,
    segments: [
      {
        type: 'speaking',
        script: "I have been using this product for 3 months now and I have to say, it completely changed how I work. The results speak for themselves.",
        duration: 10,
        transition: 'fade-in',
        status: 'pending'
      }
    ]
  },
  {
    id: 'testimonial-broll',
    name: 'Testimonial + B-Roll',
    description: 'Actor with B-roll cutaway',
    twinCount: 1,
    segments: [
      {
        type: 'speaking',
        script: "Let me tell you about my experience with this amazing service. When I first signed up, I was skeptical...",
        duration: 8,
        transition: 'fade-in',
        status: 'pending'
      },
      {
        type: 'broll',
        brollPrompts: ['Modern office workspace with laptop and coffee, professional setting, natural lighting'],
        brollImages: [],
        voiceoverText: '',
        duration: 5,
        transition: 'cut',
        status: 'pending'
      },
      {
        type: 'speaking',
        script: "...but now I use it every single day. That is why I recommend it to everyone I know.",
        duration: 8,
        transition: 'cut',
        status: 'pending'
      }
    ]
  },
  {
    id: 'multi-actor',
    name: 'Multi-Actor Commercial',
    description: 'Two different actors giving testimonials',
    twinCount: 2,
    segments: [
      {
        type: 'speaking',
        script: "As a business owner, finding the right tools is everything. This solution saved me hours every week.",
        duration: 8,
        transition: 'fade-in',
        status: 'pending'
      },
      {
        type: 'speaking',
        script: "I agree completely. The customer support alone is worth it. They are always there when you need them.",
        duration: 8,
        transition: 'fade-in',
        status: 'pending'
      }
    ]
  },
  {
    id: 'full-production',
    name: 'Full Production',
    description: 'Complete commercial with actors, B-roll, and montage',
    twinCount: 2,
    segments: [
      {
        type: 'speaking',
        script: "When I first discovered this product, I was skeptical. But now, I cannot imagine my day without it.",
        duration: 8,
        transition: 'fade-in',
        status: 'pending'
      },
      {
        type: 'broll',
        brollPrompts: ['Hands typing on modern keyboard, close-up of productivity app, bright office'],
        brollImages: [],
        voiceoverText: '',
        duration: 5,
        transition: 'cut',
        status: 'pending'
      },
      {
        type: 'speaking',
        script: "The quality is outstanding and the price is unbeatable. I tell all my friends about it.",
        duration: 8,
        transition: 'fade-in',
        status: 'pending'
      },
      {
        type: 'broll',
        brollPrompts: ['Happy customers smiling, product packaging, five star reviews on phone'],
        brollImages: [],
        voiceoverText: 'Join thousands of satisfied customers today.',
        duration: 8,
        transition: 'cut',
        status: 'pending'
      }
    ]
  }
];
