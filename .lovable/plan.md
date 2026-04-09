

# Export to Google Drive

## The Challenge
There's no Google Drive connector available in the standard connectors catalog, so we need to implement Google Drive integration using the Google Picker/OAuth flow directly in the browser — no edge function needed for the upload itself.

## Approach: Google Drive API via Browser OAuth

Use the **Google Identity Services (GIS)** library to let users sign in with their Google account and upload videos directly to their Drive from the browser. This avoids needing server-side credentials for the upload.

### How It Works
1. User clicks "Export to Drive" button on the Chatcut AI page (or video player)
2. A Google OAuth popup asks them to grant Drive file upload permission
3. The video is fetched as a blob and uploaded to their Google Drive via the Drive API v3
4. User gets a shareable Google Drive link back

### Implementation

**Step 1 — Add Google API script to `index.html`**
- Add the Google Identity Services script tag

**Step 2 — Create `src/lib/googleDrive.ts`**
- Helper module that handles:
  - Initializing Google OAuth with `drive.file` scope (minimal — only access files the app creates)
  - `uploadToDrive(videoUrl, fileName)` — fetches the video blob and uploads via `POST https://www.googleapis.com/upload/drive/v3/files`
  - Returns a shareable link

**Step 3 — Create `src/components/ExportToDriveButton.tsx`**
- Button component with Google Drive icon
- Shows auth popup on first use, then uploads
- Progress indicator during upload
- Copies shareable link to clipboard on success

**Step 4 — Add the button to Chatcut AI**
- Place an "Export to Drive" button next to the existing download/save controls on the video preview area
- Only visible when a video is loaded

### Google OAuth Client ID
Since this needs a Google OAuth Client ID with Drive scope, we have two options:
- **Option A**: Use a project-level secret for a Google OAuth Client ID (user provides their own from Google Cloud Console)
- **Option B**: Use the existing Lovable Cloud Google OAuth but request additional Drive scopes

We'll go with **Option A** — store the Google Client ID as a `VITE_` env variable (it's a public/publishable key) so it's available client-side.

### Files
| File | Change |
|------|--------|
| `index.html` | Add Google Identity Services script |
| `src/lib/googleDrive.ts` | New — Google auth + Drive upload helper |
| `src/components/ExportToDriveButton.tsx` | New — UI button with upload flow |
| `src/pages/ChatcutAI.tsx` | Add ExportToDriveButton to video area |

### Security
- Uses `drive.file` scope (most restrictive — only files created by the app)
- OAuth token stays in browser memory, never stored
- No server-side credentials needed

