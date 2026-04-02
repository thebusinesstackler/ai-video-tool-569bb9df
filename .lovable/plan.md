

## Plan: Remove Hardcoded Values and Make Captions Appear in Final Video

### Problems Found

1. **Creatomate stitch resolution hardcoded to 1080x1920** — ignores the user's selected video size (1:1, 16:9, 4:5)
2. **Caption font/color/size hardcoded in Creatomate stitch** — Montserrat 700, white, 5.5vmin — user's caption style/background choices from CaptionStyleSelector are ignored
3. **Caption settings not fully passed to stitch** — only `captionStyle` (position) is sent; animation style (karaoke, wordPop, etc.) and background style (glass, solid, neon, etc.) are not sent
4. **No font/color customization UI** — CaptionStyleSelector has animation + background style but no font family, font size, or text color picker
5. **Thumbnail uses Lovable AI gateway** — the `generateThumbnail` function calls the `ai` edge function with `google/gemini-3.1-flash-image-preview` instead of using OpenAI as requested previously
6. **`CaptionSettings` type missing font/color fields** — needs `fontSize`, `fontFamily`, `fontColor` properties

### Changes

#### 1. Extend `CaptionSettings` type (`src/components/KaraokeCaption.tsx`)
- Add `fontSize`, `fontFamily`, `fontColor` fields to the `CaptionSettings` interface and defaults

#### 2. Add font/color controls to `CaptionStyleSelector` (`src/components/CaptionStyleSelector.tsx`)
- Add font size slider (small/medium/large/extra-large)
- Add font color picker (white, yellow, cyan, pink, green + custom)
- Add font family selector (Montserrat, Inter, Poppins, Oswald, Bebas Neue)

#### 3. Pass full caption settings to Creatomate stitch (`src/pages/Reels.tsx`)
- Send `captionFont`, `captionFontSize`, `captionFontColor`, `captionBackground`, `captionAnimation` in the stitch request body alongside existing `captionStyle` (position)

#### 4. Use caption settings in Creatomate stitch (`supabase/functions/creatomate-stitch/index.ts`)
- Accept new caption customization fields in `StitchRequest`
- Replace hardcoded Montserrat/white/5.5vmin with the user's selections
- Map background styles (glass → semi-transparent bg, solid → black bg, neon → glow effect, etc.) to Creatomate text element properties
- Pass the user's selected `width`/`height` instead of hardcoded 1080x1920

#### 5. Fix thumbnail to use OpenAI (`src/pages/Reels.tsx`)
- Change `generateThumbnail` to call `generate-scene-image` edge function (which already uses OpenAI `gpt-image-1`) instead of the `ai` gateway

#### 6. Deploy updated edge function
- Re-deploy `creatomate-stitch` with the new caption customization support

### Technical Notes
- Creatomate text elements support `fill_color`, `font_family`, `font_size`, `font_weight`, `background_color`, `stroke_color`, `shadow_color` — all currently hardcoded
- The `width`/`height` in the Creatomate source JSON must match the user's `selectedVideoSize` — this requires passing it from the client
- Caption animation styles (karaoke word-by-word highlighting) are client-side only (React component); in Creatomate, captions render as static text overlays per scene. To approximate karaoke in the final video, we can split narration into shorter phrase chunks per scene.

