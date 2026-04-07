

# Replace Logo with New Image

The uploaded image has a transparent/white background and works as a single logo for both themes. It will replace both `logo-light.png` and `logo-dark.png` in `src/assets/`.

## Steps

1. **Copy the uploaded logo** to `src/assets/logo-light.png` and `src/assets/logo-dark.png` (same file for both, since the new logo works on both backgrounds)

2. **No code changes needed** — the existing imports in `Navigation.tsx`, `Auth.tsx`, and `Landing.tsx` already reference these filenames and will pick up the new images automatically.

