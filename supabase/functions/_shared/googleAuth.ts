// Mints a Google Cloud OAuth2 access token from a service-account JSON
// stored in the GOOGLE_CLOUD_SERVICE_ACCOUNT secret.
let cached: { token: string; exp: number } | null = null;

function b64url(input: ArrayBuffer | Uint8Array | string): string {
  let bytes: Uint8Array;
  if (typeof input === 'string') bytes = new TextEncoder().encode(input);
  else if (input instanceof ArrayBuffer) bytes = new Uint8Array(input);
  else bytes = input;
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function pemToDer(pem: string): ArrayBuffer {
  const b64 = pem.replace(/-----BEGIN [^-]+-----/g, '')
    .replace(/-----END [^-]+-----/g, '')
    .replace(/\s+/g, '');
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes.buffer;
}

export async function getGoogleAccessToken(scope = 'https://www.googleapis.com/auth/cloud-platform'): Promise<string> {
  if (cached && cached.exp - 60 > Math.floor(Date.now() / 1000)) return cached.token;

  const raw = Deno.env.get('GOOGLE_CLOUD_SERVICE_ACCOUNT');
  if (!raw) throw new Error('GOOGLE_CLOUD_SERVICE_ACCOUNT not set');
  const sa = JSON.parse(raw);
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const payload = {
    iss: sa.client_email,
    scope,
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  };
  const signingInput = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(payload))}`;
  const key = await crypto.subtle.importKey(
    'pkcs8',
    pemToDer(sa.private_key),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(signingInput));
  const jwt = `${signingInput}.${b64url(sig)}`;

  const resp = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });
  if (!resp.ok) throw new Error(`Google OAuth failed (${resp.status}): ${await resp.text()}`);
  const data = await resp.json();
  cached = { token: data.access_token, exp: now + (data.expires_in || 3600) };
  return cached.token;
}
