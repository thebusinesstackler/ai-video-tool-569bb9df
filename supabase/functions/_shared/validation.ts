export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Maximum lengths for different input types
export const MAX_LENGTHS = {
  prompt: 2000,
  text: 10000,
  description: 1000,
  movieIdea: 2000,
  message: 5000,
  url: 2048,
};

// Allowed values for specific parameters
export const ALLOWED_VALUES = {
  aspectRatio: ['16:9', '9:16'],
  duration: { min: 5, max: 10 },
  speed: { min: 0.5, max: 2.0 },
  resolution: ['480p', '720p', '1080p'],
};

/**
 * Validate that a string is within max length
 */
export function validateStringLength(value: string | undefined, maxLength: number, fieldName: string): string | null {
  if (!value) return null;
  if (typeof value !== 'string') {
    return `${fieldName} must be a string`;
  }
  if (value.length > maxLength) {
    return `${fieldName} exceeds maximum length of ${maxLength} characters`;
  }
  return null;
}

/**
 * Validate a URL string format
 */
export function validateUrl(url: string | undefined, fieldName: string): string | null {
  if (!url) return null;
  if (typeof url !== 'string') {
    return `${fieldName} must be a string`;
  }
  if (url.length > MAX_LENGTHS.url) {
    return `${fieldName} URL exceeds maximum length`;
  }
  try {
    const parsed = new URL(url);
    if (!['http:', 'https:', 'data:'].includes(parsed.protocol)) {
      return `${fieldName} must use http, https, or data protocol`;
    }
  } catch {
    return `${fieldName} is not a valid URL`;
  }
  return null;
}

/**
 * Validate a number is within range
 */
export function validateNumberRange(
  value: number | undefined, 
  min: number, 
  max: number, 
  fieldName: string
): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'number' || isNaN(value)) {
    return `${fieldName} must be a number`;
  }
  if (value < min || value > max) {
    return `${fieldName} must be between ${min} and ${max}`;
  }
  return null;
}

/**
 * Validate a value is in allowed list
 */
export function validateAllowedValue<T>(
  value: T | undefined,
  allowed: T[],
  fieldName: string
): string | null {
  if (value === undefined || value === null) return null;
  if (!allowed.includes(value)) {
    return `${fieldName} must be one of: ${allowed.join(', ')}`;
  }
  return null;
}

/**
 * Validate an array of URLs
 */
export function validateUrlArray(urls: string[] | undefined, fieldName: string, maxCount: number = 10): string | null {
  if (!urls) return null;
  if (!Array.isArray(urls)) {
    return `${fieldName} must be an array`;
  }
  if (urls.length > maxCount) {
    return `${fieldName} can have at most ${maxCount} items`;
  }
  for (let i = 0; i < urls.length; i++) {
    const error = validateUrl(urls[i], `${fieldName}[${i}]`);
    if (error) return error;
  }
  return null;
}

/**
 * Create a validation error response
 */
export function validationErrorResponse(message: string): Response {
  return new Response(
    JSON.stringify({ error: message }),
    { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

/**
 * Sanitize a string for use in AI prompts (remove potential injection)
 */
export function sanitizeForPrompt(text: string): string {
  if (!text) return '';
  // Remove any control characters and limit to printable ASCII + common unicode
  return text
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '') // Remove control chars except \n, \r, \t
    .trim();
}
