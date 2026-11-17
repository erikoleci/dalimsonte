// ============ "NATA" — NIGHTLIFE CONCIERGE CHAT ============
// Recommends real events from Supabase. Two brains:
//   1. shared/concierge.js — understands city/date/vibe/budget/artist locally and
//      always has a friendly answer (works even without Gemini).
//   2. Gemini — writes a more natural reply on top of the same data.
// Whatever happens (no events, Gemini down, timeout, bad key) the visitor gets a
// helpful answer with HTTP 200. The chat NEVER talks about errors.
//
// Env vars: GEMINI_API_KEY (optional — without it the local brain answers)

import { getClientIp, rateLimit, supabaseUrl } from './_lib/security.js';
import { findEvents, localReply, tonightYMD, addDays, dayLabel } from '../shared/concierge.js';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-flash-latest';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_KEY || 'sb_publishable_JhQVaiJFTKfWGUdVd_u7rw_Q91S5QcO';

async function fetchUpcomingEvents() {
  try {
    const from = tonightYMD();
    const res = await fetch(
      `${supabaseUrl()}/rest/v1/events?select=*&status=eq.approved&date=gte.${from}&order=date.asc&limit=200`,
      { headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` } }
    );
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch (e) {
    console.warn('event-chat: could not load events', e);
    return [];
  }
}

const SYSTEM_PROMPT = ({ today, todayLabel, tomorrow, eventsText, hints, totalUpcoming }) => `
Ti je "Nata" 🌙, guida e natës e "Ku Dalim Sonte?" — platforma ku lokalet në Shqipëri publikojnë festa, koncerte dhe evente.
Personaliteti: si një shok/shoqe që e njeh mirë natën në Shqipëri — i ngrohtë, i shpejtë, pak lozonjar, kurrë robotik.

DATA: sot/sonte = ${today} (${todayLabel}); nesër = ${tomorrow}. "Sonte" vlen deri në 05:00 të mëngjesit.

EVENTET E ARDHSHME (${totalUpcoming} gjithsej) — ky është i vetmi burim i së vërtetës:
${eventsText}

SINJAL NGA KËRKIMI LOKAL (çfarë kuptoi sistemi nga mesazhi):
${hints}

RREGULLA:
1. Rekomando 1–4 evente VETËM nga lista më sipër. Për secilin: emri, lokali, qyteti, kur (sonte/nesër/dita), ora nëse ka, çmimi. Mos shpik kurrë evente, lokale, çmime, DJ, oferta, numra telefoni apo linke.
2. Nëse për kërkesën e saktë nuk ka evente: thuaje shkurt dhe pozitivisht ("Për latino në Vlorë s'ka ende gjë") dhe menjëherë sugjero alternativat më të afërta nga lista (data tjetër, qytet afër, vibe i ngjashëm). Asnjëherë mos e mbyll bisedën bosh.
3. Nëse lista është krejt bosh: thuaj me ngrohtësi që ende s'ka evente të publikuara, që lokalet shtojnë evente gjatë ditës, sugjero të shtypë 🔔 "Më njofto" te qyteti, dhe nëse ka lokal, ta publikojë eventin falas te butoni +. Mos thuaj asgjë tjetër.
4. MOS përmend KURRË: gabime, error, probleme teknike, databazë, sistem, API, "nuk kam qasje", "si AI", apo kufizimet e tua. Ti thjesht di çfarë ka në listë.
5. Preferoji pak eventet ⭐ Premium kur përputhen me kërkesën, por mos i fut me zor.
6. Për rezervim: thuaj "prek eventin dhe shtyp Rezervo në WhatsApp". Mos jep numra.
7. Përgjigju në gjuhën e vizitorit (shqip si parazgjedhje; anglisht, italisht etj. nëse shkruan ashtu). Shqip i natyrshëm, jo i përkthyer.
8. Shkurt: maksimumi ~70 fjalë, 1–2 emoji. Përdor "•" për listat. Pa markdown me yje (**).
9. Pyetje jashtë temës (moti, politika, detyra shkolle…): kthe me humor te nata ("Unë di vetëm ku dalim sonte 😄 — në cilin qytet je?").
10. Në rreshtin e FUNDIT shkruaj vetëm: PICKS: id1,id2 (ID-të e eventeve që rekomandove, ose PICKS: none). Ky rresht nuk i shfaqet vizitorit.

SHEMBUJ:
Vizitori: "cfare ka sonte ne tirane"
Nata: "Sonte në Tiranë ka shumë qejf 🔥
• ⭐ Grand Opening — Rooftop Tirana · 23:00 · 1000 LEK
• Jazz Night — Hemingway Bar · 21:30 · Falas
Për techno shko te Rooftop, për diçka më chill te Hemingway. Prek eventin për rezervim!
PICKS: id_a,id_b"

Vizitori: "latino ne vlore"
Nata: "Për latino në Vlorë s'ka ende gjë këtë javë 💃 Më afër ke:
• Salsa Night — Havana, Durrës · e shtunë 22:00 · 500 LEK
Apo të sugjeroj diçka tjetër në Vlorë?
PICKS: id_c"

Vizitori: "hi"
Nata: "Hey! 🌙 Which city are you in and what's your vibe tonight — techno, latino, chill or live music?
PICKS: none"
`.trim();

async function callGemini(contents, systemInstruction) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 9000);
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`, {
      method: 'POST',
      signal: ctrl.signal,
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': GEMINI_API_KEY },
      body: JSON.stringify({
        contents,
        system_instruction: { parts: [{ text: systemInstruction }] },
        generationConfig: { temperature: 0.6, maxOutputTokens: 600 },
      }),
    });
    const data = await res.json();
    if (data.error) throw new Error(JSON.stringify(data.error).slice(0, 300));
    return data.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('') || '';
  } finally {
    clearTimeout(timer);
  }
}

// Remove the PICKS line, stray markdown, and anything that sounds like an error.
function cleanReply(text, validIds) {
  let picks = [];
  const m = text.match(/PICKS:\s*([^\n]*)\s*$/i);
  if (m) {
    picks = m[1]
      .split(/[,\s]+/)
      .map((x) => x.replace(/^id[:_]?/i, '').trim())
      .filter((x) => validIds.has(x));
    text = text.slice(0, m.index);
  }
  text = text
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\[id:[^\]]*\]\s*/gi, '')
    .replace(/^\s*[-*]\s+/gm, '• ')
    .trim();
  const badWords = /\b(error|gabim|teknik|database|databaz|api\b|server|si ai|as an ai|nuk kam qasje|i don'?t have access)/i;
  if (!text || badWords.test(text)) return null;
  return { reply: text, picks: Array.from(new Set(picks)).slice(0, 4) };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ reply: '' });

  // Friendly even when rate-limited (15 messages / minute / IP)
  const { allowed } = await rateLimit(`event-chat:${getClientIp(req)}`, { windowMs: 60 * 1000, max: 15 });
  if (!allowed) return res.status(200).json({ reply: 'Ngadalë, ngadalë 😄 Më jep një minutë dhe më shkruaj përsëri!', picks: [] });

  const { message, history = [] } = req.body || {};
  const text = typeof message === 'string' ? message.trim().slice(0, 500) : '';
  if (!text) return res.status(200).json({ reply: 'Më shkruaj qytetin dhe vibe-in që do, dhe të gjej ku të dalësh sonte 🌙', picks: [] });

  const events = await fetchUpcomingEvents();
  const local = localReply(events, text); // always available

  // No key, or nothing published: the local brain answers (no risk of invented events).
  if (!GEMINI_API_KEY || events.length === 0) return res.status(200).json(local);

  try {
    const today = tonightYMD();
    const found = findEvents(events, text, { tonight: today });
    const eventsText = events.length
      ? events
          .slice(0, 80)
          .map(
            (e) =>
              `- id=${e.id} | ${e.is_promoted ? '⭐ ' : ''}${e.name} | ${e.venue}, ${e.city} | ${dayLabel(e.date, 'sq', today)} (${e.date})${
                e.time ? ` ${e.time}` : ''
              } | ${e.type}${e.artists ? ` | artistë: ${e.artists}` : ''} | ${e.price || 'Falas'}${
                e.going ? ` | ${e.going} po shkojnë` : ''
              }${e.description ? ` | ${String(e.description).slice(0, 120).replace(/\s+/g, ' ')}` : ''}`
          )
          .join('\n')
      : '(BOSH — nuk ka asnjë event të publikuar për momentin)';
    const q = found.q;
    const hints = [
      `gjuha: ${q.lang === 'en' ? 'anglisht' : 'shqip'}`,
      q.city ? `qyteti: ${q.city}` : null,
      q.range ? `data: ${q.range[0]}${q.range[1] !== q.range[0] ? ` deri ${q.range[1]}` : ''}` : null,
      q.vibe ? `vibe: ${q.vibe}` : null,
      q.budget !== null ? `buxheti max: ${q.budget} lekë` : null,
      found.picks.length
        ? `${found.exact ? 'përputhje të sakta' : `s'ka përputhje të sakta (u lirua: ${found.relaxed.join(', ')}); alternativat më të afërta`}: ${found.picks
            .map((e) => e.id)
            .join(', ')}`
        : 'asnjë event i përshtatshëm',
    ]
      .filter(Boolean)
      .join('\n');

    const safeHistory = (Array.isArray(history) ? history : [])
      .filter((h) => h && (h.role === 'user' || h.role === 'model') && typeof h.text === 'string')
      .slice(-8)
      .map((h) => ({ role: h.role, parts: [{ text: h.text.slice(0, 1500) }] }));
    while (safeHistory.length && safeHistory[0].role !== 'user') safeHistory.shift();

    const raw = await callGemini([...safeHistory, { role: 'user', parts: [{ text }] }], SYSTEM_PROMPT({
      today,
      todayLabel: new Intl.DateTimeFormat('sq-AL', { weekday: 'long', timeZone: 'Europe/Tirane' }).format(new Date()),
      tomorrow: addDays(today, 1),
      eventsText,
      hints,
      totalUpcoming: events.length,
    }));

    const cleaned = cleanReply(raw, new Set(events.map((e) => e.id)));
    if (!cleaned) return res.status(200).json(local);
    // If Gemini forgot the PICKS line, fall back to the local picks
    if (!cleaned.picks.length && local.picks.length && events.length) cleaned.picks = local.picks;
    return res.status(200).json(cleaned);
  } catch (err) {
    console.warn('event-chat: Gemini unavailable, using local brain:', String(err?.message || err).slice(0, 200));
    return res.status(200).json(local);
  }
}
