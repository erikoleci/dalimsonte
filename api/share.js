// ============ SHARE LINKS WITH RICH PREVIEWS ============
// /e/<id>  (rewritten here by vercel.json)
// WhatsApp / Instagram / Facebook / Telegram don't run JavaScript, so a plain
// SPA link always shows the generic logo. This endpoint returns a tiny HTML page
// with the event's own title, photo and date in the Open Graph tags, then
// sends real visitors straight to the app.

import { sb } from './_lib/security.js';

const ID_RE = /^[A-Za-z0-9-]{1,64}$/;

function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const MONTHS = ['Jan', 'Shk', 'Mar', 'Pri', 'Maj', 'Qer', 'Kor', 'Gus', 'Sht', 'Tet', 'Nën', 'Dhj'];
function prettyDate(d) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d || '');
  return m ? `${Number(m[3])} ${MONTHS[Number(m[2]) - 1]}` : '';
}

const POLL_RE = /^[A-Za-z0-9_-]{6,16}$/;

// /v/<pollId> — "Shkojmë bashkë" vote links
async function pollPreview(req, res) {
  const pollId = String(req.query?.poll || '');
  const origin = `https://${req.headers['x-forwarded-host'] || req.headers.host}`;
  const appUrl = POLL_RE.test(pollId) ? `${origin}/#/bashke/${pollId}` : `${origin}/`;
  let names = [];
  let image = `${origin}/icon-512.png`;
  let title = '🗳️ Ku dalim sonte? Voto!';
  if (POLL_RE.test(pollId)) {
    try {
      const rows = await sb(`polls?select=title,event_ids&id=eq.${encodeURIComponent(pollId)}&limit=1`);
      const poll = Array.isArray(rows) ? rows[0] : null;
      const ids = (poll?.event_ids || []).filter((x) => ID_RE.test(x));
      if (poll?.title) title = `🗳️ ${poll.title}`;
      if (ids.length) {
        const evs = await sb(`events?select=id,name,venue,image&id=in.(${ids.join(',')})`);
        const ordered = ids.map((x) => (evs || []).find((e) => e.id === x)).filter(Boolean);
        names = ordered.map((e) => `${e.name} (${e.venue})`);
        const withImg = ordered.find((e) => /^https:\/\//.test(e.image || ''));
        if (withImg) image = withImg.image;
      }
    } catch {
      /* generic preview */
    }
  }
  const desc = names.length ? `Zgjidh: ${names.join(' · ')}` : 'Voto ku do të dalim sonte!';
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'public, s-maxage=120, stale-while-revalidate=600');
  res.status(200).send(`<!doctype html><html lang="sq"><head><meta charset="utf-8">
<title>${esc(title)}</title>
<meta property="og:type" content="website"><meta property="og:site_name" content="Ku Dalim Sonte?">
<meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(desc)}">
<meta property="og:image" content="${esc(image)}"><meta property="og:url" content="${esc(appUrl)}">
<meta name="twitter:card" content="summary_large_image">
<meta http-equiv="refresh" content="0; url=${esc(appUrl)}"></head>
<body style="background:#07060d;color:#fff;font-family:sans-serif"><a href="${esc(appUrl)}" style="color:#ff3d7f">Voto →</a></body></html>`);
}

export default async function handler(req, res) {
  if (req.query?.poll) return pollPreview(req, res);
  const id = String(req.query?.id || '');
  const origin = `https://${req.headers['x-forwarded-host'] || req.headers.host}`;
  const appUrl = ID_RE.test(id) ? `${origin}/?event=${encodeURIComponent(id)}` : `${origin}/`;

  let event = null;
  if (ID_RE.test(id)) {
    try {
      const rows = await sb(
        `events?select=*&id=eq.${encodeURIComponent(id)}&status=eq.approved&limit=1`
      );
      event = Array.isArray(rows) ? rows[0] : null;
    } catch {
      /* show generic preview */
    }
  }

  const title = event ? `${event.name} · ${event.venue}` : 'Ku Dalim Sonte? — Nata jote në Shqipëri';
  const when = event ? [prettyDate(event.date), event.time, event.city, event.price].filter(Boolean).join(' · ') : '';
  const desc = event
    ? `${when}. ${String(event.description || '').slice(0, 140)}`
    : 'Evente, koncerte dhe festa sonte në qytetin tënd.';
  const image = event?.image && /^https:\/\//.test(event.image) ? event.image : `${origin}/icon-512.png`;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
  res.status(200).send(`<!doctype html>
<html lang="sq"><head>
<meta charset="utf-8">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Ku Dalim Sonte?">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:image" content="${esc(image)}">
<meta property="og:url" content="${esc(appUrl)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(desc)}">
<meta name="twitter:image" content="${esc(image)}">
<meta http-equiv="refresh" content="0; url=${esc(appUrl)}">
<link rel="canonical" href="${esc(appUrl)}">
</head><body style="background:#07060d;color:#fff;font-family:sans-serif">
<a href="${esc(appUrl)}" style="color:#ff3d7f">Hap eventin →</a>
</body></html>`);
}
