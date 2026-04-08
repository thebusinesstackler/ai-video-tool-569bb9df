

# Redesign Chatcut AI to Match Reference Layout

## Overview
Update the Chatcut AI page to match the professional NLE (non-linear editor) design shown in the reference images, with multi-track timeline, richer transport controls, and proper media categorization.

## Changes

### 1. Enhanced Transport Controls (`src/pages/ChatcutAI.tsx`)
- Add scissors (split at playhead), magnet (snap), play/pause, zoom +/-, aspect ratio toggle, closed captions, and fullscreen buttons
- Style the playhead and time display with amber/gold accent color
- Show time as `00:06.13 / 02:33.00` format

### 2. Multi-Track Timeline
- **V1** track: main video clip with thumbnail frames background
- **V2** track: overlay/motion graphics clips (pink/magenta blocks with diamond markers)
- **A1** track: audio waveform track (teal/cyan color)
- Each track gets visibility (eye), volume, and delete controls
- Amber playhead spanning all tracks with triangle marker at top
- Time ruler with `00:00`, `00:30`, `01:00` labels

### 3. Media Panel Redesign (Right Sidebar)
- Section headers: **Videos**, **Audios**, **Motion Graphics** with count badges
- Video thumbnails with duration overlays
- Audio items shown with waveform icon/thumbnail
- Motion graphics items section
- `+` button at top to add media

### 4. Styling & Color
- Dark background for video preview area (already present)
- Amber/gold accent for playhead, export button highlight
- Export button styled as prominent red/orange CTA at top-right
- Card-style backgrounds for panels matching the dark editor aesthetic

### Files Modified
- `src/pages/ChatcutAI.tsx` — full redesign of transport bar, timeline (multi-track V1/V2/A1), media panel sections, and transport controls

