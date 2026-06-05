# ð Marco AI - Motion Graphics Placement Quick Reference

## ð¬ Teaching Marco Better Placement

When Marco's graphics aren't landing in the right spot, use these prompts:

### â GOOD Commands (What to Say):

```
"Place graphics away from my face"
"Use the opposite side from where I'm standing"
"Fix the overlays - they're covering me"
"Spread graphics across the canvas, not all bottom"
"Sync the timing to my words"
"Make it platform-safe for TikTok"
"Redo the graphics - keep only 3-4 hero moments"
"Too cluttered - remove the weak ones"
```

### â BAD Commands (Avoid These):

```
"Make it look good" (too vague)
"Add more graphics" (leads to clutter)
"Put text here" without explanation (Marco needs context)
```

---

## ð Marco's Placement Rules

Marco now follows these enhanced rules for every graphic:

### 1. **Vision-First Logic**
- **Reads where your face is** before placing graphics
- **Uses opposite-side rule**: Face left â graphic right, Face right â graphic left
- **Never covers you** unless you ask for center takeover (end-frame CTA only)

### 2. **Smart Zone Selection**

| Your Position | Marco Places Graphic | Zone Used |
|---------------|---------------------|-----------|
| Left side of frame | Right side | right_panel (x: 75-85) |
| Right side of frame | Left side | left_panel (x: 15-25) |
| Centered | Top or bottom | top_banner (y: 14) or lower_third (y: 78) |
| Close-up (face fills frame) | Top only | top_banner or tiny corner note |
| Wide shot | Side panels | left_panel or right_panel |

### 3. **Timing Precision**
- Graphics **sync to your words** (within 0.15s when timings available)
- Minimum duration: **2.5s** (3s for lists)
- Minimum gap between graphics: **1.5s** of clean video

### 4. **Platform-Aware Safe Zones**

#### TikTok / Reels (9:16):
```
TOP: y = 12-22 â (avoid status bar)
BOTTOM: y = 70-82 â (avoid caption bar)
RIGHT DANGER: x > 85 â (UI buttons overlap)
```

#### YouTube Horizontal (16:9):
```
Full canvas available
Prefer side panels for stats/lists
```

### 5. **Treatment Selection**

Marco picks the right visual style based on what you're saying:

| What You Say | Marco Uses | Where |
|--------------|------------|-------|
| "97% absorption" | stat_card (big number) | Side panel |
| "Here are 3 benefits..." | side_notes (bullet list) | Side panel |
| Direct quote | quote_pop | Center (brief) |
| "Shop now" | cta_lockup | Center (end only) |
| One-word emphasis | bold_outline | Top banner |
| Speaker name/title | lower_third_pro | Bottom |

---

## ð¬ How to Debug Bad Placements

### Problem: "Graphics cover my face"

**Say this to Marco:**
```
"Fix placement - graphics are covering my face"
```

**Marco will:**
1. Read face detection at each graphic timestamp
2. Move graphics to opposite side or top/bottom
3. Explain: "Moved stat to right since your face is on the left ð¯"

---

### Problem: "Everything is stuck at the bottom"

**Say this to Marco:**
```
"Spread graphics across the canvas - use top, sides, corners"
```

**Marco will:**
1. Audit current placement zones
2. Redistribute: hook â top, stat â right, list â left, CTA â center
3. Explain: "Redistributed - hook at top, stat on right, CTA at end"

---

### Problem: "Text appears too early/late"

**Say this to Marco:**
```
"Sync graphics to exactly when I say the words"
```

**Marco will:**
1. Parse word-level timing from transcript
2. Align graphic start to first word of text
3. Explain: "Synced 'Absorbs in 3 seconds' to 4.2s when you say 'absorbs'"

---

### Problem: "Too many graphics - feels cluttered"

**Say this to Marco:**
```
"Too cluttered - keep only 3-4 hero moments"
```

**Marco will:**
1. Audit all graphics
2. Remove non-essential ones (paraphrased text, too short, covers face)
3. Keep only: hook + 1-2 mid-video moments + end CTA
4. Explain: "Removed 5 graphics. Kept hook stat at 2s, benefit at 12s, and end CTA ð§¹"

---

### Problem: "Graphics cut off on mobile"

**Say this to Marco:**
```
"Make it TikTok-safe - nothing cut off"
```

**Marco will:**
1. Apply TikTok safe zones
2. Pull graphics away from edges (x: 15-85, y: 15-82)
3. Move right-side graphics to x â¤ 78 (avoid UI buttons)
4. Explain: "Adjusted for TikTok - pulled everything inside safe zones"

---

## ð Pro Tips for Better Results

### 1. **Give Marco Vision Context**
Instead of:
```
"Add a stat card"
```

Say:
```
"Add a stat card on the right at 5s since I'm on the left"
```

### 2. **Reference Your Words**
Instead of:
```
"Add some text about the benefits"
```

Say:
```
"When I say 'absorbs in 3 seconds' at 4s, show that as a stat"
```

### 3. **Specify Zone When Needed**
```
"Put it in the top-right corner"
"Place it beside me on the left"
"Float it in the bottom-right"
"Keep it at the top to avoid my face"
```

### 4. **Batch Corrections**
Instead of fixing one-by-one:
```
"Audit all graphics - fix placement, timing, and remove weak ones"
```

---

## ð§  What Marco Checks (Behind the Scenes)

Before placing EVERY graphic, Marco now:

1. â Reads vision data (where is your face?)
2. â Checks existing overlays (any conflicts?)
3. â Verifies timing (synced to words?)
4. â Validates duration (â¥ 2.5s?)
5. â Checks platform safe zones (TikTok/YouTube/Square)
6. â Picks treatment based on content (stat vs list vs quote)
7. â Applies opposite-side rule (avoids face)
8. â Ensures 1.5s gap before next graphic

If ANY check fails, Marco either fixes it or skips the graphic entirely.

---

## ð Platform-Specific Layouts

### TikTok/Reels (9:16) - Marco's Default Zones:

```
ââââââââââââââ
â  TOP (14)   â â Hook, one-word emphasis
ââââââââââââââ
âLâ      âRâ    â L = benefit list (x: 22)
âEâ  YOU âIâ    â R = stat card (x: 70, NOT 85+)
âFâ      âGâ    â 
âTâ      âHâ    â
ââââââââââââââ
â BOTTOM (78) â â Lower third, CTA (end only)
ââââââââââââââ
```

### YouTube Horizontal (16:9) - Full Canvas:

```
ââââââââââââââââââââââââââââââ
â          TOP (16)            â â Hook, title
ââââââââââââââââââââââââââââââ
âââ           âââ              âââ
â L â   YOU   â R â             â L: benefit (x: 22)
âââ           âââ              â R: stat (x: 78)
ââââââââââââââââââââââââââââââ
â       BOTTOM (82)            â â Lower third, CTA
ââââââââââââââââââââââââââââââ
```

---

## ð Example Conversations

### Example 1: First Video with Marco

**You:**
```
"Edit this video for TikTok - add hook graphic and 2-3 key moments"
```

**Marco:** (internal checks)
- Reads video, detects you're centered in most frames
- Identifies hook phrase: "3 secrets nobody tells you"
- Finds 2 stats: "97% absorption" at 8s, "works in 20 minutes" at 15s
- Picks end CTA: "Shop Now" at 27s

**Marco replies:**
```
Done! Added 4 graphics ð¬

â Hook "3 SECRETS" at top (0.8s) - face-centered so went top banner
â Stat "97%" on the right (8.2s) - you shift left here
â Stat "20 minutes" on the left (15.1s) - you shift right here  
â CTA "Shop Now" center takeover (27s) - end frame

All synced to your words. Want to adjust any?
```

---

### Example 2: Fixing Bad Placement

**You:**
```
"The graphics are covering my face - fix it"
```

**Marco:** (internal audit)
- Checks currentMotionGraphics: 3 graphics
- Finds 2 graphics at x: 50 (center) covering face at those timestamps
- Vision shows face centered in both frames

**Marco replies:**
```
Found 2 graphics covering you ð¬

Moved:
â Stat to right panel (x: 78) - your face is centered
â Benefit list to top banner (y: 14) - tight close-up, only top is safe

Kept the end CTA center since it's supposed to take over.

Check it now!
```

---

### Example 3: Platform Migration

**You:**
```
"Redo this for YouTube horizontal instead of TikTok"
```

**Marco:** (internal adjustments)
- Switches from 9:16 safe zones to 16:9
- More horizontal space available
- Right-side danger zone (x > 85) no longer applies

**Marco replies:**
```
Adjusted for YouTube horizontal ð¥ï¸

â Moved side graphics further out (x: 22 and x: 82) - more space now
â Kept hook at top - still looks great
â End CTA stays centered

Wider canvas lets the graphics breathe. Looking good?
```

---

## ð§° Advanced: Manual Coordinate Control

If you need pixel-perfect placement, give Marco exact coordinates:

```
"Place the stat at x: 78, y: 40"
"Move it to top-right corner: x: 82, y: 16"
"Bottom-left: x: 18, y: 82"
```

**Coordinate system:**
- `x: 0` = left edge, `x: 100` = right edge
- `y: 0` = top edge, `y: 100` = bottom edge
- Origin (0,0) is top-left corner

**Safe zones to remember:**
- TikTok: x: 15-78, y: 12-82
- YouTube: x: 10-90, y: 10-90
- Square: x: 15-85, y: 15-85

---

## ð Summary: The Marco Placement Mantra

**For EVERY graphic, Marco now:**
1. ð **Reads** where your face is
2. ðº **Picks** the opposite side or top/bottom
3. â± **Syncs** to your spoken words
4. ð± **Adapts** to platform safe zones
5. ð **Explains** the logic to you

**Result:** Graphics that feel like a pro editor placed them - never covering you, perfectly timed, platform-optimized.

---

## ð Need Help?

**If Marco still isn't getting it right:**

1. **Be specific:** "Face on left at 5s, put stat on right"
2. **Show examples:** "Like MrBeast - big text at top"
3. **Ask for audit:** "Check all graphics and explain placement"
4. **Batch fix:** "Fix all overlays - timing, placement, and clutter"

**Marco will:**
- Explain what he sees in the frame
- Show his placement logic
- Offer alternatives if the ideal zone is blocked
- Ask clarifying questions when ambiguous

---

*This guide reflects Marco's enhanced placement intelligence as of the latest update.*
