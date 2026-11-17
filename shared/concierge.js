// "Nata" — the nightlife concierge's local brain.
// Pure JavaScript, shared by the server (/api/event-chat) and the browser
// (offline fallback in the chat widget). It understands city, date, vibe,
// budget and artist/venue names in Albanian and English — with or without ë/ç —
// and ALWAYS produces a friendly answer. It never talks about errors.

import { CITIES } from './constants.js';

// ---------------------------------------------------------------------------
// Text helpers
// ---------------------------------------------------------------------------
export function norm(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9€\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Short words must match exactly; longer ones may be a prefix ("fundjav" -> "fundjaven").
const has = (text, words) =>
  words.some((w) => new RegExp(w.length <= 4 ? `(^|\\s)${w}(\\s|$)` : `(^|\\s)${w}`).test(text));

// ---------------------------------------------------------------------------
// Dates (Europe/Tirane, "tonight" lasts until 05:00)
// ---------------------------------------------------------------------------
function tiranaNow() {
  const f = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Tirane',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hourCycle: 'h23',
  });
  const p = Object.fromEntries(f.formatToParts(new Date()).map((x) => [x.type, x.value]));
  return { ymd: `${p.year}-${p.month}-${p.day}`, hour: Number(p.hour) };
}
export function addDays(ymd, n) {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}
function weekday(ymd) {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}
export function tonightYMD() {
  const { ymd, hour } = tiranaNow();
  return hour < 5 ? addDays(ymd, -1) : ymd;
}

const DAYS_SQ = ['e diel', 'e hene', 'e marte', 'e merkure', 'e enjte', 'e premte', 'e shtune'];
const DAYS_SQ_SHORT = ['Diel', 'Hën', 'Mar', 'Mër', 'Enj', 'Pre', 'Sht'];
const DAYS_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS_SQ = ['Jan', 'Shk', 'Mar', 'Pri', 'Maj', 'Qer', 'Kor', 'Gus', 'Sht', 'Tet', 'Nën', 'Dhj'];
const MONTHS_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function dayLabel(ymd, lang, tonight = tonightYMD()) {
  if (ymd === tonight) return lang === 'en' ? 'tonight' : 'sonte';
  if (ymd === addDays(tonight, 1)) return lang === 'en' ? 'tomorrow' : 'nesër';
  const [, m, d] = ymd.split('-').map(Number);
  const wd = weekday(ymd);
  return lang === 'en' ? `${DAYS_EN[wd]} ${MONTHS_EN[m - 1]} ${d}` : `${DAYS_SQ_SHORT[wd]} ${d} ${MONTHS_SQ[m - 1]}`;
}

// ---------------------------------------------------------------------------
// Understanding the message
// ---------------------------------------------------------------------------
const CITY_ALIASES = {
  'Tiranë': ['tirane', 'tirana', 'tiran', 'tr', 'blloku', 'bllok'],
  'Durrës': ['durres', 'durresi', 'durazzo', 'golem'],
  'Vlorë': ['vlore', 'vlora', 'valona', 'radhime', 'orikum'],
  'Sarandë': ['sarande', 'saranda'],
  'Ksamil': ['ksamil'],
  'Dhërmi': ['dhermi', 'drymades', 'jale'],
  'Himarë': ['himare', 'himara'],
  'Shkodër': ['shkoder', 'shkodra', 'scutari'],
  'Korçë': ['korce', 'korca'],
  'Elbasan': ['elbasan', 'elbasani'],
  'Fier': ['fier', 'fieri'],
  'Berat': ['berat', 'berati'],
  'Pogradec': ['pogradec', 'pogradeci'],
  'Shëngjin': ['shengjin', 'shengjini'],
};

const VIBES = {
  'Techno/House': ['techno', 'tekno', 'house', 'edm', 'electronic', 'elektronik', 'dj set', 'rave', 'afro house', 'deep'],
  'Hip Hop / R&B': ['hip hop', 'hiphop', 'rap', 'trap', 'rnb', 'r b', 'drill'],
  'Live Music': ['live', 'band', 'koncert', 'concert', 'jazz', 'akustik', 'acoustic', 'blues'],
  Albanian: ['shqip', 'popullore', 'albanian', 'kenge shqip', 'muzike shqip', 'tallava', 'dasme'],
  Latino: ['latino', 'latin', 'reggaeton', 'regeton', 'salsa', 'bachata', 'kizomba'],
  'Beach Party': ['beach', 'plazh', 'buz detit', 'det', 'pool', 'pishin', 'sunset'],
  'Chill / Lounge': ['chill', 'lounge', 'qete', 'relax', 'koktej', 'cocktail', 'wine', 'vere', 'rooftop', 'terrace'],
  Rock: ['rock', 'metal', 'punk', 'alternative'],
  Karaoke: ['karaoke'],
};

function detectLang(text) {
  const t = norm(text);
  const en = (t.match(/\b(the|what|where|tonight|party|any|is|are|events?|please|weekend|cheap|free|show|me|in|for|with|today|tomorrow|best|hi|hello)\b/g) || []).length;
  const sq = (t.match(/\b(ku|cfare|ka|sonte|neser|fundjave|nje|ndonje|per|me|eshte|jane|dua|dalim|lire|falas|ne|te|pershendetje|si|qytet|mire)\b/g) || []).length;
  if (/[ëç]/i.test(text)) return 'sq';
  return en > sq ? 'en' : 'sq';
}

function parsePriceLek(price) {
  const p = norm(price);
  if (!p || /(falas|free|pa pagese|gratis)/.test(p) || /^0\s*(lek|all|€|eur)?$/.test(p)) return 0;
  const m = p.match(/(\d+[\d\s]*)/);
  if (!m) return null;
  const n = Number(m[1].replace(/\s/g, ''));
  if (/€|eur/.test(p)) return n * 100;
  return n;
}

export function understand(message, { tonight = tonightYMD() } = {}) {
  const t = norm(message);
  const out = { lang: detectLang(message), city: null, range: null, vibe: null, budget: null, words: [], greeting: false };

  for (const [city, aliases] of Object.entries(CITY_ALIASES)) {
    if (aliases.some((a) => new RegExp(`(^|\\s)${a}(\\s|$)`).test(t))) {
      out.city = city;
      break;
    }
  }

  if (has(t, ['sonte', 'sot', 'tonight', 'today', 'tani', 'now'])) out.range = [tonight, tonight];
  else if (has(t, ['neser', 'tomorrow'])) out.range = [addDays(tonight, 1), addDays(tonight, 1)];
  else if (has(t, ['fundjav', 'weekend', 'vikend', 'week end'])) {
    const wd = weekday(tonight);
    out.range = wd === 0 ? [tonight, tonight] : wd >= 5 ? [tonight, addDays(tonight, 7 - wd)] : [addDays(tonight, 5 - wd), addDays(tonight, 7 - wd)];
  } else if (has(t, ['kete jave', 'this week', 'javen'])) out.range = [tonight, addDays(tonight, 6)];
  else {
    const enDays = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const sqDays = ['diel', 'hene', 'marte', 'merkure', 'enjte', 'premte', 'shtune'];
    for (let i = 0; i < 7; i++) {
      if (has(t, [sqDays[i], enDays[i]])) {
        const diff = (i - weekday(tonight) + 7) % 7;
        out.range = [addDays(tonight, diff), addDays(tonight, diff)];
        break;
      }
    }
  }

  for (const [vibe, words] of Object.entries(VIBES)) {
    if (has(t, words)) {
      out.vibe = vibe;
      break;
    }
  }

  if (has(t, ['falas', 'free', 'pa pagese', 'gratis'])) out.budget = 0;
  else if (has(t, ['lire', 'lir', 'cheap', 'budget', 'buxhet', 'ekonomik'])) out.budget = 1000;
  const maxM = t.match(/(?:nen|deri|max|under|below)\s*(\d{2,5})/);
  if (maxM) out.budget = Number(maxM[1]) * (/€|eur/.test(t) ? 100 : 1);

  out.greeting = /^(hej|hey|hi|hello|pershendetje|tung|cka ka|si je|mirembrema|miremengjes|ciao|yo)\b/.test(t) && t.split(' ').length <= 4;

  const STOP = new Set(
    'ku cfare ka sonte neser per me ne te nje dhe the what where is are any party event events eventi evente dua do dalim shkoj shkojme a apo ose ndonje pak shume me mire best good nice tonight today tomorrow weekend fundjave in at for of and or some show tell me please faleminderit thanks'.split(
      ' '
    )
  );
  out.words = t.split(' ').filter((w) => w.length >= 3 && !STOP.has(w) && !Object.values(CITY_ALIASES).flat().includes(w));
  return out;
}

// ---------------------------------------------------------------------------
// Matching
// ---------------------------------------------------------------------------
function eventText(e) {
  return norm(`${e.name} ${e.artists || ''} ${e.venue} ${e.description || ''}`);
}

function sortEvents(list) {
  return [...list].sort(
    (a, b) =>
      a.date.localeCompare(b.date) ||
      Number(!!(b.isPromoted ?? b.is_promoted)) - Number(!!(a.isPromoted ?? a.is_promoted)) ||
      (a.time || '22:00').localeCompare(b.time || '22:00')
  );
}

function filterBy(events, q, { city = true, range = true, vibe = true, budget = true, words = true } = {}) {
  return events.filter((e) => {
    if (city && q.city && e.city !== q.city) return false;
    if (range && q.range && (e.date < q.range[0] || e.date > q.range[1])) return false;
    if (vibe && q.vibe && e.type !== q.vibe) return false;
    if (budget && q.budget !== null) {
      const p = parsePriceLek(e.price);
      if (p === null || p > q.budget) return false;
    }
    if (words && q.words.length) {
      const txt = eventText(e);
      if (!q.words.some((w) => txt.includes(w))) return false;
    }
    return true;
  });
}

/**
 * Finds the best events for a message. Relaxes the filters step by step so
 * there is always something useful to say.
 * @returns {{ q, picks: any[], exact: boolean, relaxed: string[] }}
 */
export function findEvents(allEvents, message, { tonight = tonightYMD() } = {}) {
  const q = understand(message, { tonight });
  const upcoming = sortEvents(allEvents.filter((e) => e.date >= tonight));
  // Only filter by free-text words if they actually match something (artist/venue search)
  const wordsHit = q.words.length && upcoming.some((e) => q.words.some((w) => eventText(e).includes(w)));
  const useWords = !!wordsHit;

  const attempts = [
    { opts: { words: useWords }, relaxed: [] },
    { opts: { words: useWords, vibe: false }, relaxed: ['vibe'] },
    { opts: { words: useWords, vibe: false, budget: false }, relaxed: ['vibe', 'budget'] },
    { opts: { words: false, vibe: false, budget: false }, relaxed: ['vibe', 'budget', 'words'] },
    { opts: { words: false, vibe: false, budget: false, range: false }, relaxed: ['vibe', 'budget', 'words', 'date'] },
    { opts: { words: false, vibe: false, budget: false, city: false }, relaxed: ['vibe', 'budget', 'words', 'city'] },
    { opts: { words: false, vibe: false, budget: false, city: false, range: false }, relaxed: ['all'] },
  ];
  for (const a of attempts) {
    const res = filterBy(upcoming, { ...q, words: useWords ? q.words : [] }, { ...a.opts, words: !!a.opts.words });
    if (res.length) {
      const relaxed = a.relaxed.filter((r) =>
        r === 'vibe' ? !!q.vibe : r === 'budget' ? q.budget !== null : r === 'words' ? useWords : r === 'date' ? !!q.range : r === 'city' ? !!q.city : true
      );
      return { q, picks: res.slice(0, 4), exact: relaxed.length === 0, relaxed, total: upcoming.length };
    }
  }
  return { q, picks: [], exact: false, relaxed: ['all'], total: upcoming.length };
}

// ---------------------------------------------------------------------------
// Writing the answer (no AI needed)
// ---------------------------------------------------------------------------
const VIBE_LABEL = {
  sq: { 'Techno/House': 'techno/house', 'Hip Hop / R&B': 'hip hop', 'Live Music': 'muzikë live', Albanian: 'muzikë shqip', Latino: 'latino', 'Beach Party': 'beach party', 'Chill / Lounge': 'chill', Rock: 'rock', Karaoke: 'karaoke' },
  en: { 'Techno/House': 'techno/house', 'Hip Hop / R&B': 'hip hop', 'Live Music': 'live music', Albanian: 'Albanian music', Latino: 'latino', 'Beach Party': 'beach party', 'Chill / Lounge': 'chill', Rock: 'rock', Karaoke: 'karaoke' },
};

function line(e, lang, tonight) {
  const premium = e.isPromoted ?? e.is_promoted;
  const when = `${dayLabel(e.date, lang, tonight)}${e.time ? ` ${e.time}` : ''}`;
  return `• ${premium ? '⭐ ' : ''}${e.name} — ${e.venue}, ${e.city} · ${when} · ${e.price || (lang === 'en' ? 'Free' : 'Falas')}`;
}

function describeAsk(q, lang, words = []) {
  const vibe = q.vibe ? VIBE_LABEL[lang][q.vibe] || q.vibe : '';
  const free = q.budget === 0;
  const rest = [];
  if (q.budget && q.budget > 0) rest.push(lang === 'en' ? `under ${q.budget} LEK` : `nën ${q.budget} lekë`);
  if (words.length) rest.push(lang === 'en' ? `with “${words.join(' ')}”` : `me “${words.join(' ')}”`);
  if (q.city) rest.push(lang === 'en' ? `in ${q.city}` : `në ${q.city}`);
  if (q.range) {
    const t = tonightYMD();
    rest.push(q.range[0] === q.range[1] ? dayLabel(q.range[0], lang, t) : lang === 'en' ? 'this weekend' : 'këtë fundjavë');
  }
  return { vibe, free, rest: rest.join(' '), any: !!(vibe || free || rest.length) };
}

function eventsPhrase(a, lang, n) {
  // sq: "eventet techno/house falas në Tiranë sonte"   en: "free techno/house events in Tirana tonight"
  if (lang === 'en') return [a.free ? 'free' : '', a.vibe, n === 1 ? 'event' : 'events', a.rest].filter(Boolean).join(' ');
  return [n === 1 ? 'eventi' : 'eventet', a.vibe, a.free ? 'falas' : '', a.rest].filter(Boolean).join(' ');
}

export function localReply(allEvents, message) {
  const tonight = tonightYMD();
  const r = findEvents(allEvents, message, { tonight });
  const { q } = r;
  const en = q.lang === 'en';
  const tonightCount = allEvents.filter((e) => e.date === tonight).length;

  // Small talk / greeting
  if (q.greeting && !q.city && !q.vibe && !q.range) {
    const reply = en
      ? `Hey! 🌙 ${tonightCount ? `There are ${tonightCount} events tonight.` : ''} Tell me your city and the vibe you're in (techno, latino, chill, live…) and I'll find you the best spot.`
      : `Hej! 🌙 ${tonightCount ? `Sonte ka ${tonightCount} evente.` : ''} Më thuaj qytetin dhe çfarë vibe do (techno, latino, chill, live…) dhe të gjej vendin më të mirë.`;
    return { reply: reply.replace(/\s+/g, ' ').trim(), picks: r.picks.filter((e) => e.date === tonight).slice(0, 3).map((e) => e.id) };
  }

  const matchedWords = r.exact && r.picks.length ? q.words.filter((w) => r.picks.some((e) => eventText(e).includes(w))) : [];
  const ask = describeAsk(q, q.lang, matchedWords);

  // Nothing published at all
  if (!r.picks.length) {
    const reply = en
      ? `No ${eventsPhrase(ask, 'en', 2)} are listed right now 🌙 Venues add new events throughout the day, so check back a bit later — or tap 🔔 "Notify me" on your city and we'll let you know. Own a venue? Post your event for free with the + button.`
      : `Për momentin nuk ka ende ${eventsPhrase(ask, 'sq', 2).replace(/^eventet/, 'evente')} 🌙 Lokalet shtojnë evente gjatë gjithë ditës, ndaj kthehu pak më vonë — ose shtyp 🔔 "Më njofto" te qyteti yt dhe të lajmërojmë ne. Ke lokal? Publiko eventin falas te butoni +.`;
    return { reply, picks: [] };
  }

  const list = r.picks.map((e) => line(e, q.lang, tonight)).join('\n');

  if (r.exact) {
    const n = r.picks.length;
    const intro = en
      ? ask.any
        ? `Here ${n === 1 ? 'is the' : 'are the'} ${eventsPhrase(ask, 'en', n)} 🔥`
        : 'Here are some great picks 🔥'
      : ask.any
        ? `Ja ${eventsPhrase(ask, 'sq', n)} 🔥`
        : 'Ja disa zgjedhje të mira 🔥';
    const outro = en ? 'Tap an event below to see details and reserve on WhatsApp.' : 'Prek një event më poshtë për detajet dhe rezervimin në WhatsApp.';
    return { reply: `${intro}\n${list}\n${outro}`, picks: r.picks.map((e) => e.id) };
  }

  // Close alternatives
  const askAll = describeAsk(q, q.lang, q.words.length && r.relaxed.includes('words') ? q.words : []);
  const intro = en
    ? `No ${eventsPhrase(askAll, 'en', 2)} yet, but here are the closest options 👇`
    : `Nuk ka ende ${eventsPhrase(askAll, 'sq', 2).replace(/^eventet/, 'evente')}, por ja alternativat më të afërta 👇`;
  const outro = en ? 'New events get added daily — check back later too!' : 'Evente të reja shtohen çdo ditë — kthehu edhe më vonë!';
  return { reply: `${intro}\n${list}\n${outro}`, picks: r.picks.map((e) => e.id) };
}

export { CITIES };
