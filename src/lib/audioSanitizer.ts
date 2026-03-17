/**
 * Central TTS text sanitizer.
 * Cleans script text before it reaches ANY TTS engine to prevent
 * awkward pauses, 4-second silences, and unnatural delivery.
 *
 * Rules enforced:
 *  - Em dashes (—), en dashes (–), double hyphens (--) → comma + space
 *  - Excessive ellipses reduced to max 1 per passage; extras → period
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

  // 3. Reduce excessive ellipses — keep max 1, convert rest to periods
  // First convert unicode ellipsis to dots
  cleaned = cleaned.replace(/…/g, '...');
  // Now limit: keep the first "..." as a brief pause, replace all subsequent with "."
  let ellipsisCount = 0;
  cleaned = cleaned.replace(/\.{3}/g, () => {
    ellipsisCount++;
    if (ellipsisCount <= 1) return ','; // First ellipsis becomes a brief comma pause
    return '.'; // All others become clean sentence breaks
  });
  // Clean up any remaining multi-dots
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
export const SANITIZER_VERSION = '1.1.0';
