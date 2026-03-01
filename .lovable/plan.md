
# Migration Plan: Move to Your Own Supabase Project

## Overview
Migrate your database schema, edge functions, storage, and secrets from Lovable Cloud to your own Supabase project, then update the app to point at it.

---

## Step 1: Connect to GitHub
- Go to **Settings > Connectors > GitHub** in Lovable and create a repository
- This gives you full ownership of the source code

## Step 2: Migrate Database Schema
- Run all 24 migration SQL files (in `supabase/migrations/`) against your new Supabase project **in order**
- You can do this via the Supabase Dashboard SQL Editor or using the Supabase CLI:
  ```
  supabase db push --db-url postgresql://postgres:[password]@[host]:5432/postgres
  ```
- This recreates all tables, RLS policies, triggers, and functions

## Step 3: Deploy Edge Functions
- Install the [Supabase CLI](https://supabase.com/docs/guides/cli)
- Link your project: `supabase link --project-ref YOUR_PROJECT_REF`
- Deploy all 30+ edge functions at once:
  ```
  supabase functions deploy
  ```

## Step 4: Configure Secrets in Your Supabase Project
Set these secrets in your new Supabase project (Dashboard > Settings > Edge Functions > Secrets, or via CLI):
- `WAVESPEED_API_KEY`
- `GOOGLE_CLOUD_TTS_API_KEY`
- `GOOGLE_CLOUD_SERVICE_ACCOUNT`
- `SPEECHIFY_API_KEY`
- `CREATOMATE_API_KEY`
- `CHIRP3_API_KEY`
- `LOVABLE_API_KEY` (if using Lovable AI features -- these will need a replacement strategy since Lovable AI is tied to Lovable Cloud)

You can find the current secret values in your Lovable Cloud settings to copy them over.

## Step 5: Recreate Storage Buckets
- In your new Supabase Dashboard, create the same storage buckets (e.g., `reels`) with matching public/private settings and RLS policies

## Step 6: Migrate Data (Optional)
- Export data from Lovable Cloud (Cloud View > Database > Tables > Export)
- Import into your new Supabase project via CSV import or SQL inserts

## Step 7: Update Environment Variables for Deployment
In your hosting platform (Netlify, Vercel, etc.), set:
- `VITE_SUPABASE_URL` = your new Supabase project URL
- `VITE_SUPABASE_PUBLISHABLE_KEY` = your new Supabase anon key
- `VITE_SUPABASE_PROJECT_ID` = your new project ID

## Step 8: Deploy the App
- Connect your GitHub repo to Netlify or Vercel
- Build command: `npm run build`
- Output directory: `dist`
- Add the environment variables from Step 7
- Deploy

---

## What I Can Do For You (code changes)
Once you have your Supabase project URL and anon key, I can:
1. **Update edge function imports** if any need adjustments for standalone Supabase
2. **Add a configuration helper** so the app reads Supabase credentials from environment variables (it already does this, so minimal changes needed)
3. **Verify all edge functions** compile and have correct CORS headers for external hosting

## Important Notes
- **Lovable AI calls** (via the `ai` edge function using `LOVABLE_API_KEY`) are tied to Lovable Cloud. You'll need to replace these with direct OpenAI/Google API calls and add those API keys as secrets.
- **Lovable Cloud cannot be disconnected** from this project, but once deployed externally with your own Supabase credentials, the app will use your infrastructure entirely.
- The app code itself requires **zero changes** to work with a different Supabase project -- it's all driven by environment variables.
