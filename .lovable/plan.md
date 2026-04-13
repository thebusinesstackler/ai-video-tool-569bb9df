

## YouTube Searcher — Plan

### What we're building
A new "YouTube Search" page under the **AI Tools** nav group that lets users search YouTube videos by keyword, with filters for duration, upload date, and sort order. Results show thumbnails, titles, channel names, view counts, and durations — with a button to send a video URL directly to Vizard or Chatcut AI for processing.

### API Approach
We'll use the **YouTube Data API v3** (`search.list` + `videos.list` for duration/stats). This requires a Google API key.

- Create a backend function `youtube-search` that proxies requests to YouTube Data API
- Need a `YOUTUBE_API_KEY` secret (free tier gives 10,000 quota units/day)

### Steps

1. **Add secret**: Request `YOUTUBE_API_KEY` from user
2. **Create Edge Function** (`supabase/functions/youtube-search/index.ts`):
   - Accepts `query`, `duration` (short/medium/long/any), `order` (relevance/date/viewCount), `pageToken`, `maxResults`
   - Calls YouTube Data API `search.list` (type=video) then `videos.list` for contentDetails (duration) and statistics
   - Returns formatted results with pagination token
3. **Create page** (`src/pages/YouTubeSearch.tsx`):
   - Search bar with keyword input
   - Filter row: duration dropdown (Any, Short <4min, Medium 4-20min, Long >20min), sort dropdown (Relevance, Upload Date, View Count)
   - Results grid with video thumbnails, title, channel, views, duration badge
   - "Load More" pagination
   - Action buttons on each result: "Open in Vizard", "Open in Chatcut AI" (navigates with video URL)
4. **Add route** in `App.tsx`: `/youtube-search` → protected
5. **Add nav item** in `Navigation.tsx` under AI Tools group with `Search` icon

### Technical Details
- YouTube duration filter maps to `videoDuration` param: `any`, `short`, `medium`, `long`
- ISO 8601 duration (PT12M34S) parsed to human-readable format
- Results cached in React Query to avoid redundant API calls
- 25 results per page

