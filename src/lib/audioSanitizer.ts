/**
 * Lightweight TTS text sanitizer.
 * Only fixes actual TTS-breaking issues — preserves the writer's voice and style.
 *
 * Fixes:
 *  - Em dashes (—) and double hyphens (--) → comma (causes long silences)
 *  - Excessive ellipses → single period (causes unnatural pauses)
 *  - Stage directions in parens/brackets removed
 *  - Smart quotes → straight quotes
 *  - Whitespace cleanup
 */

export function sanitizeForTTS(text: string): string {
  if (!text) return '';

  let cleaned = text;

  // 1. Remove stage directions: (sighs), [emotion], *pauses*
  cleaned = cleaned.replace(/\([^)]*\)/g, '');
  cleaned = cleaned.replace(/\[[^\]]*\]/g, '');
  cleaned = cleaned.replace(/\*[^*]*\*/g, '');

  // 2. Replace em dashes and double hyphens (cause 4-second silences in TTS)
  cleaned = cleaned.replace(/—/g, ', ');
  cleaned = cleaned.replace(/–/g, ', ');
  cleaned = cleaned.replace(/--/g, ', ');

  // 3. Reduce excessive ellipses only (3+ dots → single period)
  cleaned = cleaned.replace(/…/g, '...');
  cleaned = cleaned.replace(/\.{3,}/g, '.');

  // 4. Smart quotes → straight quotes
  cleaned = cleaned.replace(/[""]/g, '"');
  cleaned = cleaned.replace(/['']/g, "'");

  // 5. Remove character name prefixes: "CHARACTER: text"
  cleaned = cleaned
    .split('\n')
    .map(line => line.replace(/^[A-Z][A-Z\s]*:\s*/i, ''))
    .join(' ');

  // 6. Normalize whitespace
  cleaned = cleaned.replace(/\s+/g, ' ').trim();

  return cleaned;
}

export const SANITIZER_VERSION = '2.0.0';
