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
    description: 'Single AI Twin delivering an authentic product experience',
    twinCount: 1,
    segments: [
      {
        type: 'twin-speaking',
        script: "Six months ago, I was drowning in spreadsheets and manual processes. My team was frustrated, deadlines were slipping, and I honestly did not know how much longer we could keep going. Then a colleague introduced me to this platform. Within the first week, we cut our processing time in half. Now my team actually looks forward to Monday mornings. That is not something I ever thought I would say.",
        duration: 20,
        transition: 'fade-in',
        status: 'pending'
      }
    ]
  },
  {
    id: 'testimonial-broll',
    name: 'Testimonial + B-Roll',
    description: 'Personal story with visual proof while the narrative continues',
    twinCount: 1,
    segments: [
      {
        type: 'twin-speaking',
        script: "I remember the exact moment everything changed for my business. I was sitting at my desk at two in the morning, exhausted, wondering if I should just give up on my dream entirely. That is when I decided to try something different.",
        duration: 15,
        transition: 'fade-in',
        status: 'pending'
      },
      {
        type: 'broll-voice-continue',
        brollPrompts: ['Entrepreneur working late at night with laptop, soft desk lamp lighting, determined expression, cozy home office with city lights visible through window'],
        brollImages: [],
        duration: 6,
        transition: 'crossfade',
        status: 'pending'
      },
      {
        type: 'twin-speaking',
        script: "Fast forward to today, and I have tripled my revenue, hired three new team members, and for the first time in years, I actually take weekends off. This platform did not just save my business. It gave me my life back.",
        duration: 18,
        transition: 'cut',
        status: 'pending'
      }
    ]
  },
  {
    id: 'multi-twin',
    name: 'Multi-Twin Commercial',
    description: 'Two perspectives building a compelling case together',
    twinCount: 2,
    segments: [
      {
        type: 'twin-speaking',
        script: "As a startup founder, I have tried every productivity tool on the market. Most of them promise the world and deliver nothing but frustration. When my co-founder suggested we try this one, I rolled my eyes. But here is what surprised me: within forty-eight hours, our entire workflow transformed. We shipped our product two months ahead of schedule.",
        duration: 22,
        transition: 'fade-in',
        status: 'pending'
      },
      {
        type: 'broll-voice-continue',
        brollPrompts: ['Modern tech startup office with team collaborating around a standing desk, whiteboards with product roadmaps, energetic atmosphere, natural sunlight'],
        brollImages: [],
        duration: 5,
        transition: 'crossfade',
        status: 'pending'
      },
      {
        type: 'twin-speaking',
        script: "What really sets them apart is the support. I had a critical issue at eleven PM on a Sunday night before our biggest launch ever. Real humans got back to me in ten minutes. Ten minutes. That kind of dedication is rare, and it is why we are customers for life.",
        duration: 20,
        transition: 'fade-in',
        status: 'pending'
      }
    ]
  },
  {
    id: 'full-production',
    name: 'Full Production',
    description: 'Cinematic commercial with multiple testimonials, B-roll, and closing montage',
    twinCount: 2,
    segments: [
      {
        type: 'twin-speaking',
        script: "I still remember telling my husband that our small bakery was not going to make it through the year. We were doing everything by hand, losing orders, missing deliveries. Then I discovered this platform and honestly, it felt like hiring an entire team overnight.",
        duration: 18,
        transition: 'fade-in',
        status: 'pending'
      },
      {
        type: 'broll-voice-continue',
        brollPrompts: ['Artisan bakery interior with fresh bread and pastries, warm golden lighting, flour dusted surfaces, cozy neighborhood shop atmosphere'],
        brollImages: [],
        duration: 5,
        transition: 'crossfade',
        status: 'pending'
      },
      {
        type: 'twin-speaking',
        script: "Running a restaurant means dealing with chaos every single day. Inventory, staffing, customer complaints, you name it. Since switching to this system, my managers handle ninety percent of what used to land on my desk. Last month, I actually went on vacation. First one in three years.",
        duration: 20,
        transition: 'fade-in',
        status: 'pending'
      },
      {
        type: 'broll-montage',
        voiceoverText: "Join over fifty thousand businesses who transformed their operations and reclaimed their time. Start your free thirty-day trial today. No credit card required, no complicated setup, just results. Your future self will thank you.",
        brollPrompts: [
          'Diverse small business owners smiling confidently outside their storefronts, warm afternoon light, authentic and approachable',
          'Dashboard analytics showing upward growth trends on a sleek tablet, hands holding device, modern office background',
          'Team celebrating success with high-fives in a bright collaborative workspace, genuine joy and camaraderie',
          'Simple call-to-action: Start Free Trial button on clean interface, inviting and professional design'
        ],
        brollImages: [],
        duration: 15,
        transition: 'crossfade',
        status: 'pending'
      }
    ]
  }
];
