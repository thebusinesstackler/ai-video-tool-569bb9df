

# Plan: Product Image Variations Generator

## What You Get
A "Generate Variations" button on the product detail page that takes any uploaded product image and generates alternative versions (different angles, backgrounds, lifestyle settings, flat lay, etc.) using AI image generation. One click to create multiple creative variations of your product photos.

## Changes

### 1. Add "Generate Variations" UI to Product Detail (`src/pages/ProductLibrary.tsx`)
- Add a "Generate Variations" button on each gallery image (in the hover overlay and in the image viewer dialog)
- When clicked, show a small preset picker with variation styles: "Lifestyle Setting", "White Background", "In-Hand UGC", "Flat Lay", "Nature/Outdoor", "Studio Dramatic"
- Show a generating state with spinner, then auto-add the new images to the product gallery
- Also add a "Generate All Variations" bulk button that creates multiple styles at once

### 2. Create `generate-product-variations` Edge Function
- Accepts: `imageUrl`, `productName`, `productDescription`, `variationStyle` (or array of styles)
- Uses the Lovable AI Gateway (`google/gemini-3.1-flash-image-preview`) for image editing/generation
- For each style, sends the original product image with an editing prompt like:
  - **Lifestyle**: "Place this product in a cozy home setting with warm natural lighting"
  - **White BG**: "Place this product on a clean white background, studio product photography"
  - **In-Hand UGC**: "Show someone casually holding this product, iPhone selfie style"
  - **Flat Lay**: "Arrange this product in a flat lay composition with complementary props"
  - **Nature**: "Place this product in a natural outdoor setting with greenery"
  - **Studio**: "Dramatic studio lighting on dark background, luxury product shot"
- Uploads generated images to `project-files` storage bucket
- Returns the new image URLs

### 3. Wire Up to Gallery
- Generated variations are automatically inserted into `product_gallery` with a label like "Lifestyle Variation" 
- The product name and description from the DB are passed to the edge function for context-aware prompts

## Technical Details
- Uses `google/gemini-3.1-flash-image-preview` model via Lovable AI Gateway for image editing (no extra API keys needed)
- New edge function: `supabase/functions/generate-product-variations/index.ts`
- Modified file: `src/pages/ProductLibrary.tsx` (add variation UI + generation logic)
- No database changes needed -- reuses existing `product_gallery` table

