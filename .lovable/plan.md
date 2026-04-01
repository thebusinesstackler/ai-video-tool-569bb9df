
# Video Production Toolkit Enhancement

## 1. Product Shot Generator 🎬
- **One-click cinematic B-roll** from a product photo: auto-generate "product on table", "lifestyle shot", "spinning product", "product close-up" scenes
- Uses the existing `product_images` table + `edit-scene-image` function
- Generates 3-4 product B-roll variants and lets user pick which to insert between scenes
- Adds a "Generate Product B-Roll" button in the scene editor

## 2. B-Roll Library & Quick Insert 📚
- Searchable B-roll generator: type a keyword (e.g. "coffee pouring", "city skyline") 
- AI generates a quick scene image, then converts to video
- "Insert Before" / "Insert After" buttons on each scene card to drop B-roll between talking scenes
- Recently generated B-roll is cached for reuse

## 3. One-Click Product Overlay 🏷️
- Instead of regenerating a scene, overlay the product image as a picture-in-picture (PIP) on any existing video
- Choose overlay position: bottom-right, bottom-left, center
- Uses canvas compositing during stitch — no re-generation needed
- Quick "Add Product PIP" button on each scene card

## 4. Scene Reorder & Visual Timeline 🎞️
- Drag-and-drop scene reordering with visual thumbnails
- Trim/extend scene duration controls
- Insert points between scenes for B-roll drops
- "Preview Assembly" button that plays all clips in order before final stitch
- "Re-stitch" button after reordering

## Implementation Order
1. **Scene Reorder & Timeline** (foundation — other features insert into this)
2. **B-Roll Library & Insert** (uses timeline insert points)
3. **Product Shot Generator** (specialized B-roll generation)
4. **Product Overlay** (canvas compositing enhancement)
