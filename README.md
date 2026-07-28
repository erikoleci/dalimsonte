<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/1PVXtGAYDLx_MrMEGAD4uTsVdqaE9Y2s4

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

---

## New: Analytics + AI Nightlife Assistant

### 1. Analytics (views & reserve clicks per event)
Run the new part of `supabase-schema.sql` in Supabase → SQL Editor (it's additive,
safe to re-run). It adds `views`/`clicks` columns plus two RPC functions used to
increment them atomically. Results show up automatically in **Admin → Analytics**.

### 2. AI chatbot that recommends events (bottom-right "🌙" button)
Files added:
- `api/event-chat.js` — Vercel serverless function, reads live approved events from
  Supabase and asks Gemini to recommend the best matches.
- `components/EventChatWidget.tsx` — the floating chat button + panel, already wired
  into `App.tsx`.

**Required environment variable on Vercel** (Settings → Environment Variables):
```
GEMINI_API_KEY=<from aistudio.google.com/api-keys>
```
`VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` are optional — the function already
falls back to the same public Supabase project the frontend uses.

Without `GEMINI_API_KEY` set, the widget still opens and replies with a friendly
message pointing users to the search page instead of erroring out.
