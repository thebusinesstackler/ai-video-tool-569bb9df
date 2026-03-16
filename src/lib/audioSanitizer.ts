/**
 * Central TTS text sanitizer.
 * Cleans script text before it reaches ANY TTS engine to prevent
 * awkward pauses, 4-second silences, and unnatural delivery.
 *
 * Rules enforced (from project memory):
 *  - Em dashes (—), en dashes (–), double hyphens (--) → comma + space
 *  - Ellipses (… or ...) → period
 *  - Smart quotes → straight quotes
 *  - Stage directions in parens/brackets/asterisks removed
 *  - Repeated words collapsed
 *  - Only commas and periods allowed for rhythm/pauses
 */

export function sanitizeForTTS(text: string): string {
  if (!text) return '';

  let cleaned = text;

  // 1. Remove stage directions: (sighs), [emotion], *pauses*
  cleaned = cleaned.replace(/\([^)]*\)/g, '');
  cleaned = cleaned.replace(/\[[^\]]*\]/g, '');
  cleaned = cleaned.replace(/\*[^*]*\*/g, '');

  // 2. Replace em dashes, en dashes, double hyphens with comma
  cleaned = cleaned.replace(/—/g, ', ');
  cleaned = cleaned.replace(/–/g, ', ');
  cleaned = cleaned.replace(/--/g, ', ');

  // 3. Replace ellipses with period
  cleaned = cleaned.replace(/…/g, '.');
  cleaned = cleaned.replace(/\.{2,}/g, '.');

  // 4. Smart quotes → straight quotes
  cleaned = cleaned.replace(/[""]/g, '"');
  cleaned = cleaned.replace(/['']/g, "'");

  // 5. Remove semicolons and colons mid-sentence (replace with comma)
  cleaned = cleaned.replace(/;/g, ',');
  cleaned = cleaned.replace(/:(?!\d)/g, ','); // keep time formats like 3:00

  // 6. Collapse repeated words (e.g., "the the" → "the")
  cleaned = cleaned.replace(/(\b\w+\b)\s+\1\b/gi, '$1');

  // 7. Fix missing space after comma
  cleaned = cleaned.replace(/,([A-Za-z])/g, ', $1');

  // 8. Collapse multiple commas/periods
  cleaned = cleaned.replace(/,{2,}/g, ',');
  cleaned = cleaned.replace(/\.{2,}/g, '.');
  cleaned = cleaned.replace(/,\s*\./g, '.');

  // 9. Remove character name prefixes at start of lines: "CHARACTER: text"
  cleaned = cleaned
    .split('\n')
    .map(line => line.replace(/^[A-Z][A-Z\s]*:\s*/i, ''))
    .join(' ');

  // 10. Normalize whitespace
  cleaned = cleaned.replace(/\s+/g, ' ').trim();

  // 11. Remove leading/trailing commas or periods from result
  cleaned = cleaned.replace(/^[,.\s]+/, '').replace(/[,\s]+$/, '');

  return cleaned;
}

/**
 * Lightweight sanitizer for edge functions (Deno).
 * Same logic as sanitizeForTTS but exported as a standalone string
 * so it can be copy-pasted into edge functions without module imports.
 */
export const SANITIZER_VERSION = '1.0.0';
