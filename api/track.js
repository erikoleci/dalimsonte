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
    if (!ID_RE.test(String(id || '')) || !['view', 'click'].includes(kind)) {
      return res.status(400).json({ error: 'Bad request' });
    }
    // Count each IP at most once per event per kind every 30 minutes.
    const { allowed } = await rateLimit(`track:${kind}:${id}:${getClientIp(req)}`, { windowMs: 30 * 60 * 1000, max: 1 });
    if (allowed) {
      await sb(`rpc/${kind === 'view' ? 'increment_event_views' : 'increment_event_clicks'}`, {
        method: 'POST',
        body: JSON.stringify({ event_id: id }),
      });
    }
    return res.status(204).end();
  } catch (err) {
    console.error('track error:', err);
    return res.status(204).end(); // analytics must never break the UI
  }
}
