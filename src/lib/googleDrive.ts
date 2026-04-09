// Google Drive upload helper using Google Identity Services (GIS)

const SCOPES = 'https://www.googleapis.com/auth/drive.file';

let tokenClient: any = null;
let accessToken: string | null = null;

declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient: (config: {
            client_id: string;
            scope: string;
            callback: (response: { access_token?: string; error?: string }) => void;
          }) => { requestAccessToken: () => void };
        };
      };
    };
  }
}

function getClientId(): string {
  const id = import.meta.env.VITE_GOOGLE_DRIVE_CLIENT_ID;
  if (!id) throw new Error('VITE_GOOGLE_DRIVE_CLIENT_ID is not configured');
  return id;
}

export function requestDriveAccess(): Promise<string> {
  return new Promise((resolve, reject) => {
    if (accessToken) {
      resolve(accessToken);
      return;
    }

    if (!window.google?.accounts?.oauth2) {
      reject(new Error('Google Identity Services not loaded'));
      return;
    }

    tokenClient = window.google.accounts.oauth2.initTokenClient({
      client_id: getClientId(),
      scope: SCOPES,
      callback: (response) => {
        if (response.error) {
          reject(new Error(response.error));
          return;
        }
        accessToken = response.access_token ?? null;
        if (accessToken) resolve(accessToken);
        else reject(new Error('No access token received'));
      },
    });

    tokenClient.requestAccessToken();
  });
}

export async function uploadToDrive(
  videoUrl: string,
  fileName: string,
  onProgress?: (pct: number) => void,
): Promise<string> {
  const token = await requestDriveAccess();

  onProgress?.(5);

  // Fetch video blob
  const res = await fetch(videoUrl);
  const blob = await res.blob();
  onProgress?.(30);

  // Metadata
  const metadata = {
    name: fileName.endsWith('.mp4') ? fileName : `${fileName}.mp4`,
    mimeType: 'video/mp4',
  };

  // Build multipart body
  const boundary = '----LoopAIDriveBoundary';
  const delimiter = `\r\n--${boundary}\r\n`;
  const closeDelimiter = `\r\n--${boundary}--`;

  const metadataPart =
    delimiter +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    JSON.stringify(metadata);

  const arrayBuf = await blob.arrayBuffer();
  onProgress?.(50);

  // Combine parts
  const encoder = new TextEncoder();
  const metaBytes = encoder.encode(metadataPart + delimiter + 'Content-Type: video/mp4\r\n\r\n');
  const closeBytes = encoder.encode(closeDelimiter);
  const body = new Uint8Array(metaBytes.length + arrayBuf.byteLength + closeBytes.length);
  body.set(metaBytes, 0);
  body.set(new Uint8Array(arrayBuf), metaBytes.length);
  body.set(closeBytes, metaBytes.length + arrayBuf.byteLength);

  onProgress?.(60);

  const uploadRes = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body: body,
    },
  );

  onProgress?.(90);

  if (!uploadRes.ok) {
    const errText = await uploadRes.text();
    // Reset token on auth error
    if (uploadRes.status === 401) accessToken = null;
    throw new Error(`Drive upload failed: ${errText}`);
  }

  const result = await uploadRes.json();
  onProgress?.(95);

  // Make file viewable by anyone with link
  await fetch(`https://www.googleapis.com/drive/v3/files/${result.id}/permissions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ role: 'reader', type: 'anyone' }),
  });

  onProgress?.(100);

  return result.webViewLink || `https://drive.google.com/file/d/${result.id}/view`;
}

export function clearDriveToken() {
  accessToken = null;
}
