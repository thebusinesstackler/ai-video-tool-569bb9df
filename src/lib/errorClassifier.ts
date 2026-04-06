/**
 * Centralized error classifier for AI/edge function errors.
 * Converts technical error messages into user-friendly notifications.
 */
export function getFriendlyError(error: any): { title: string; description: string } {
  const msg = (error?.message || error?.toString() || '').toLowerCase();

  if (msg.includes('billing') || msg.includes('quota') || msg.includes('credit') || msg.includes('insufficient')) {
    return {
      title: 'Service Temporarily Unavailable',
      description: 'Our AI services are at capacity. Please try this feature again later.',
    };
  }
  if (msg.includes('rate limit') || msg.includes('429') || msg.includes('too many requests')) {
    return {
      title: 'Too Many Requests',
      description: 'Please wait a moment and try again.',
    };
  }
  if (msg.includes('timeout') || msg.includes('timed out')) {
    return {
      title: 'Request Timed Out',
      description: 'This is taking longer than expected. Please try again.',
    };
  }
  if (msg.includes('overloaded') || msg.includes('529') || msg.includes('503')) {
    return {
      title: 'Service Busy',
      description: 'Our AI services are experiencing high demand. Please try again in a few minutes.',
    };
  }
  return {
    title: 'Something Went Wrong',
    description: 'Please try this feature again later. If the issue persists, contact support.',
  };
}
