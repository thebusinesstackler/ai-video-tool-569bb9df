import { CommercialSegment, SegmentReadiness, ReadinessCheck, SegmentStatus } from '@/types/testimonialCommercial';

export function getSegmentReadiness(segment: CommercialSegment): SegmentReadiness {
  const checks: ReadinessCheck[] = [];
  const missingRequired: string[] = [];

  if (segment.type === 'twin-speaking') {
    // Required: Twin selected
    const hasTwin = !!segment.twinId;
    checks.push({
      id: 'twin',
      label: 'AI Twin selected',
      isComplete: hasTwin,
      isRequired: true,
      hint: 'Select an AI Twin to speak this segment'
    });
    if (!hasTwin) missingRequired.push('Select AI Twin');

    // Required: Script entered
    const hasScript = !!segment.script?.trim();
    checks.push({
      id: 'script',
      label: 'Script entered',
      isComplete: hasScript,
      isRequired: true,
      hint: 'Enter what this person will say'
    });
    if (!hasScript) missingRequired.push('Enter script');

    // Optional: A-roll images generated
    const hasArollImages = (segment.arollVariations?.some(v => v.imageUrl)) ?? false;
    checks.push({
      id: 'aroll',
      label: 'A-roll images generated',
      isComplete: hasArollImages,
      isRequired: false,
      hint: 'Generate camera angle variations'
    });
  } else if (segment.type === 'broll-voice-continue') {
    // Required: Has either an image or a prompt ready
    const hasImage = (segment.brollImages?.length ?? 0) > 0 || (segment.brollSlots?.some(s => s.imageUrl) ?? false);
    const hasPrompt = (segment.brollPrompts?.length ?? 0) > 0 || (segment.brollSlots?.some(s => s.prompt?.trim()) ?? false);
    
    checks.push({
      id: 'broll',
      label: 'B-roll image or prompt ready',
      isComplete: hasImage || hasPrompt,
      isRequired: true,
      hint: 'Upload an image or enter a prompt'
    });
    if (!hasImage && !hasPrompt) missingRequired.push('Add B-roll image or prompt');

  } else if (segment.type === 'broll-montage') {
    // Required: Voiceover twin selected
    const hasVoiceTwin = !!segment.voiceoverId;
    checks.push({
      id: 'voiceTwin',
      label: 'Voice selected',
      isComplete: hasVoiceTwin,
      isRequired: true,
      hint: 'Select whose voice will narrate'
    });
    if (!hasVoiceTwin) missingRequired.push('Select voice');

    // Required: Voiceover text entered
    const hasVoiceoverText = !!segment.voiceoverText?.trim();
    checks.push({
      id: 'voiceoverText',
      label: 'Voiceover text entered',
      isComplete: hasVoiceoverText,
      isRequired: true,
      hint: 'Enter the narration script'
    });
    if (!hasVoiceoverText) missingRequired.push('Enter voiceover text');

    // Optional: B-roll prompts/images ready
    const hasBrollContent = (segment.brollPrompts?.length ?? 0) > 0 || 
      (segment.brollSlots?.some(s => s.prompt?.trim() || s.imageUrl) ?? false);
    checks.push({
      id: 'brollContent',
      label: 'B-roll prompts or images added',
      isComplete: hasBrollContent,
      isRequired: false,
      hint: 'Add descriptions for B-roll footage'
    });
  }

  return {
    isReady: missingRequired.length === 0,
    checks,
    missingRequired
  };
}

export function getSegmentStatus(segment: CommercialSegment): SegmentStatus {
  // Check explicit status first
  if (segment.status === 'generating') return 'generating';
  if (segment.status === 'complete' && segment.videoUrl) return 'complete';
  if (segment.status === 'error') return 'error';

  // Check readiness
  const readiness = getSegmentReadiness(segment);
  if (!readiness.isReady) return 'incomplete';

  // Has everything needed but not yet generated
  return 'ready';
}
