// Centralized development bypass logic
// Auto-enables dashboard access on Lovable preview domains when auth backend is unavailable

export const isDevPreview = typeof window !== 'undefined' && 
  window.location.hostname.includes('lovableproject.com');

export const getDevBypassStatus = () => ({
  active: isDevPreview,
  reason: isDevPreview ? 'Lovable preview domain detected' : null,
});
