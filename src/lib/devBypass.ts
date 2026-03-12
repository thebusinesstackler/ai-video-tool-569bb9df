// Centralized development bypass logic
// Auto-enables dashboard access on Lovable preview domains when auth backend is unavailable

export const isDevPreview = false;

export const getDevBypassStatus = () => ({
  active: isDevPreview,
  reason: isDevPreview ? 'Lovable preview domain detected' : null,
});
