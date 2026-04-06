

## Transfer Gallery Uploads and Product Images to carl@lifecykel.com

### Summary
Create an edge function that duplicates 52 gallery uploads and 5 product images from your account to Carl's account. The image files already live in storage with public URLs, so only database records need to be copied — the URLs remain valid.

### Data to Transfer
- **52 gallery uploads** (`generated_images` where `source = 'upload'`, user `fb981dfa-...`)
- **5 product images** (`product_images`, user `fb981dfa-...`)
- **Target user**: `carl@lifecykel.com` (`9163de93-bf46-4ca4-8479-6b82374d5a7e`)

### Implementation

**Step 1: Create edge function `transfer-user-data`**
- Accepts source and target user IDs
- Queries `generated_images` where `user_id = source` and `source = 'upload'`
- Queries `product_images` where `user_id = source`
- Inserts copies of each row with the target user's ID (new UUIDs, same image URLs)
- Returns count of transferred records

**Step 2: Invoke the function**
- Call the edge function with the source user ID (`fb981dfa-df6c-42dc-9650-00489ffb756b`) and target user ID (`9163de93-bf46-4ca4-8479-6b82374d5a7e`)
- Verify the records appear under Carl's account

### Technical Notes
- Image URLs point to the public `reels` storage bucket — no file copying needed, just DB record duplication
- RLS won't block the edge function since it uses the service role key
- The function will be a one-time utility; can be removed after use

