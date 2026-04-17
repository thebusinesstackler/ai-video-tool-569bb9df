
Yes — this can be added through their API, and I’d handle it in two parts inside the existing Podcast page.

1. Re-enable AI Voice Cloning
- Update `src/components/ai-twin/VoiceCloner.tsx`
- Remove the Beta badge and unavailable banner
- Re-enable the clone button
- Keep the UI label as `AI Voice Cloning` everywhere
- Replace visible `Speechify` wording in toasts/messages with neutral wording like `AI voice cloned successfully`

2. Add “Turn Into Podcast” inside the existing Podcast page
- Extend `src/pages/Podcast.tsx` with a second mode/section on the page
- Inputs:
  - Paste text
  - Paste a URL
  - Upload a PDF
- Output:
  - Generated podcast audio
  - Audio player
  - Download button
  - Transcript/summary panel
- Since you chose to keep it on the Podcast page, I’d make this feel like a native workflow there rather than a separate tool

3. Add the backend API integration
- Create a new backend function for the Speechify podcast-generation flow using the existing `SPEECHIFY_API_KEY`
- Validate auth and request payloads
- Normalize inputs:
  - text: send directly
  - URL: fetch/extract readable text first
  - PDF: extract text, then send
- Call the correct Speechify podcast endpoint/flow and map the response into a stable app response shape
- Keep provider-specific naming hidden from the frontend UI

4. Connect the result back into your current workflow
- Show the generated podcast immediately on the Podcast page
- Add a simple handoff so the generated script/transcript can be reused in the existing talking-head flow
- If useful, also allow “Use this for talking head” so the podcast content can become a video next

5. Technical notes
- Existing code already gives us a strong base:
  - `src/components/ai-twin/VoiceCloner.tsx` is already wired to `clone-voice-speechify`
  - `src/pages/Podcast.tsx` already exists and is the right place for this
  - `src/components/PodcastAIDirector.tsx` already provides chat/script help for podcast workflows
  - `SPEECHIFY_API_KEY` is already configured
- I do not expect a database schema change for the first version unless you want persistent podcast history
- During implementation I’ll confirm the exact Speechify podcast endpoint/response format and wire it to the UI accordingly

Files likely involved
- `src/components/ai-twin/VoiceCloner.tsx`
- `src/pages/Podcast.tsx`
- `src/components/PodcastAIDirector.tsx` (only if we add handoff/chat helpers)
- `supabase/functions/clone-voice-speechify/index.ts` (only for wording/error cleanup if needed)
- new backend function for podcast generation

If approved, I’ll implement the un-beta voice cloning first, then add the new “Turn Into Podcast” flow inside the Podcast page.
