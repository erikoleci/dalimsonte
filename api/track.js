// ============ ANALYTICS: views / reserve clicks ============
// Replaces calling the increment RPCs straight from the browser (anyone could
// inflate the numbers in a loop). Now: rate-limited per IP + per event.

import { enforceRateLimit, getClientIp, rateLimit, requirePost, sb } from './_lib/security.js';

const ID_RE = /^[A-Za-z0-9-]{1,64}$/;

export default async function handler(req, res) {
  if (!requirePost(req, res)) return;
  if (!(await enforceRateLimit(req, res, { windowMs: 60 * 1000, max: 60, bucket: 'track' }))) return;

  try {
    const { id, kind } = req.body || {};
    if (!ID_RE.test(String(id || '')) || !['view', 'click', 'going', 'ungoing'].includes(kind)) {
      return res.status(400).json({ error: 'Bad request' });
    }
    // Views/clicks: each IP counts once per event every 30 min.
    // "Po shkoj": each IP can add/remove at most 3 times per event per 12h.
    const isGoing = kind === 'going' || kind === 'ungoing';
    const { allowed } = await rateLimit(`track:${kind}:${id}:${getClientIp(req)}`, {
      windowMs: isGoing ? 12 * 3600 * 1000 : 30 * 60 * 1000,
      max: isGoing ? 3 : 1,
    });
    const fn = {
      view: 'increment_event_views',
      click: 'increment_event_clicks',
      going: 'increment_event_going',
      ungoing: 'decrement_event_going',
    }[kind];
    if (allowed) {
      await sb(`rpc/${fn}`, { method: 'POST', body: JSON.stringify({ event_id: id }) });
    }
    return res.status(204).end();
  } catch (err) {
    console.error('track error:', err);
    return res.status(204).end(); // analytics must never break the UI
  }
}
