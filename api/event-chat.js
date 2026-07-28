// ============ EVENT RECOMMENDATION CHATBOT ============
// AI assistant that recommends events, venues and prices to visitors,
// based on the live "events" table in Supabase (Ku Dalim Sonte?).
//
// Env vars needed on Vercel (Settings -> Environment Variables):
//   GEMINI_API_KEY          -> from aistudio.google.com/api-keys
//   VITE_SUPABASE_URL       -> same one the frontend uses
//   VITE_SUPABASE_ANON_KEY  -> same one the frontend uses (publishable key, safe to reuse)

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = 'gemini-2.5-flash'; // check ai.google.dev/gemini-api/docs/models if this changes
const SUPABASE_URL = (process.env.VITE_SUPABASE_URL || 'https://ytfemeqepmffxckjeehg.supabase.co')
  .replace(/\/rest\/v1\/?$/, '')
  .replace(/\/+$/, '');
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_JhQVaiJFTKfWGUdVd_u7rw_Q91S5QcO';

// ---------- Fetch live, approved events from Supabase ----------
async function fetchApprovedEvents() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return [];
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/events?select=id,name,venue,city,date,type,price,description,is_promoted&status=eq.approved&order=date.asc`,
      { headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` } }
    );
    const data = await res.json();
    if (!Array.isArray(data)) return [];

    // Keep only today-or-future events, cap the list so the prompt stays small
    const today = new Date().toISOString().split('T')[0];
    return data
      .filter((e) => !e.date || e.date >= today)
      .slice(0, 60);
  } catch (e) {
    console.warn('event-chat: failed to fetch events', e);
    return [];
  }
}

async function callGemini(contents, systemInstruction) {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // New "AQ." Auth keys from AI Studio (issued since mid-2026) must be sent
        // via this header — the old `?key=` query param no longer works for them.
        'x-goog-api-key': GEMINI_API_KEY,
      },
      body: JSON.stringify({
        contents,
        system_instruction: { parts: [{ text: systemInstruction }] },
        generationConfig: { temperature: 0.7, maxOutputTokens: 500 },
      }),
    }
  );
  const data = await res.json();
  if (data.error) throw new Error('Gemini error: ' + JSON.stringify(data.error));
  return data.candidates?.[0]?.content?.parts?.find((p) => p.text)?.text || '';
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const { message, history = [] } = req.body || {};
    if (!message) {
      res.status(400).json({ error: 'Missing message' });
      return;
    }
    if (!GEMINI_API_KEY) {
      res.status(200).json({
        reply:
          "The recommendation assistant isn't fully set up yet (missing GEMINI_API_KEY). Meanwhile, try the search page to filter events by city, date and vibe!",
      });
      return;
    }

    const events = await fetchApprovedEvents();
    const eventsListText = events.length
      ? events
          .map(
            (e) =>
              `- [id:${e.id}] "${e.name}" @ ${e.venue}, ${e.city} — ${e.date} — ${e.type} — ${e.price}${
                e.is_promoted ? ' (⭐ Premium/Sponsored)' : ''
              }${e.description ? ' — ' + e.description.slice(0, 140) : ''}`
          )
          .join('\n')
      : 'No approved events are currently in the system.';

    const today = new Date().toISOString().split('T')[0];

    const systemInstruction = `You are the friendly nightlife concierge for "Ku Dalim Sonte?" (Where To Go Tonight), a platform listing real events, parties and concerts posted directly by venues across Albania.

Today's date: ${today}

Here is the LIVE list of currently approved, upcoming events (this is your ONLY source of truth — never invent events, venues or prices that aren't in this list):
${eventsListText}

Your job:
1. Understand what the visitor wants: city, date/day, vibe/genre (e.g. techno, latino, live music, rooftop, chill), and budget if mentioned.
2. Recommend 2-4 specific events FROM THE LIST ABOVE that best match — always mention the event name, venue, city, date and price.
3. Slightly favor "⭐ Premium/Sponsored" events when they genuinely fit the request (don't force irrelevant ones).
4. If nothing in the list matches their city/date, say so honestly and suggest the closest alternative from the list, or suggest they check the search page for more filters.
5. If they ask about price ranges, budget nights, or "what's cheap tonight", filter and answer using the real price field.
6. Keep replies short, warm and conversational — like a friend who knows the scene, not a formal assistant. Use 1-2 emojis max, not more.
7. Reply in the same language the visitor writes in (English, Albanian, Italian, etc.) — match their language naturally.
8. Never make up ticket links, phone numbers or discounts that aren't in the data. If they want to reserve, tell them to open the event on the site and use the "Reserve Now" button.`;

    const contents = [
      ...history.slice(-8).map((h) => ({ role: h.role, parts: [{ text: h.text }] })),
      { role: 'user', parts: [{ text: message }] },
    ];

    const replyText = await callGemini(contents, systemInstruction);

    res.status(200).json({
      reply: replyText || "Hmm, I couldn't come up with a suggestion just now — try rephrasing, or check the search page directly! 🌙",
    });
  } catch (err) {
    console.error('event-chat error:', err);
    res.status(500).json({
      reply: 'Something went wrong on my end. Try again in a moment, or use the search page to find events. 🙏',
      debug: String(err && err.message ? err.message : err),
    });
  }
}
