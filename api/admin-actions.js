// ============ ADMIN ACTIONS ============
// Every moderation write goes through here, with the service_role key, and only
// after verifying the admin session token. The browser's public key can only
// read approved events.

import {
  enforceRateLimit,
  getStoredPassword,
  hashPassword,
  requireAdmin,
  requirePost,
  sb,
  sbWriteTolerant,
  setStoredPassword,
  verifyPassword,
} from './_lib/security.js';
import { toAppEvent, validateEventInput } from './_lib/events.js';

const ID_RE = /^[A-Za-z0-9-]{1,64}$/;

export default async function handler(req, res) {
  if (!requirePost(req, res)) return;
  if (!(await enforceRateLimit(req, res, { windowMs: 60 * 1000, max: 60, bucket: 'admin-actions' }))) return;
  if (!(await requireAdmin(req, res))) return;

  try {
    const { action, payload = {} } = req.body || {};
    const id = payload.id;
    if (['approveEvent', 'updateEvent', 'deleteEvent', 'setPromoted'].includes(action) && !ID_RE.test(String(id || ''))) {
      return res.status(400).json({ error: 'ID e pavlefshme' });
    }
    const byId = `events?id=eq.${encodeURIComponent(id)}`;

    switch (action) {
      case 'listEvents': {
        const rows = await sb('events?select=*&order=created_at.desc&limit=500');
        return res.status(200).json({ events: (rows || []).map(toAppEvent) });
      }

      case 'approveEvent': {
        await sb(byId, {
          method: 'PATCH',
          headers: { Prefer: 'return=minimal' },
          body: JSON.stringify({ status: 'approved', is_promoted: payload.promote === true }),
        });
        return res.status(200).json({ ok: true });
      }

      case 'setPromoted': {
        await sb(byId, {
          method: 'PATCH',
          headers: { Prefer: 'return=minimal' },
          body: JSON.stringify({ is_promoted: payload.promoted === true }),
        });
        return res.status(200).json({ ok: true });
      }

      case 'updateEvent': {
        // Whitelisted fields only — views/clicks/status/id can't be overwritten here.
        const { row, error } = validateEventInput(payload.updates || {}, { partial: true, trustedImages: true });
        if (error) return res.status(400).json({ error });
        if (!Object.keys(row).length) return res.status(400).json({ error: 'Asgjë për të ndryshuar' });
        await sbWriteTolerant(byId, 'PATCH', row);
        return res.status(200).json({ ok: true });
      }

      case 'deleteEvent': {
        await sb(byId, { method: 'DELETE', headers: { Prefer: 'return=minimal' } });
        return res.status(200).json({ ok: true });
      }

      case 'purgePastEvents': {
        // Delete events that ended more than 30 days ago.
        const cutoff = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString().slice(0, 10);
        await sb(`events?date=lt.${cutoff}`, { method: 'DELETE', headers: { Prefer: 'return=minimal' } });
        const pollCutoff = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();
        await sb(`polls?created_at=lt.${encodeURIComponent(pollCutoff)}`, { method: 'DELETE', headers: { Prefer: 'return=minimal' } }).catch(() => {});
        return res.status(200).json({ ok: true });
      }

      case 'changePassword': {
        const { currentPassword, newPassword } = payload;
        const stored = await getStoredPassword();
        if (!verifyPassword(String(currentPassword || ''), stored)) {
          return res.status(400).json({ error: 'Fjalëkalimi aktual është i gabuar' });
        }
        if (typeof newPassword !== 'string' || newPassword.length < 12 || newPassword.length > 200) {
          return res.status(400).json({ error: 'Fjalëkalimi i ri duhet të ketë të paktën 12 karaktere' });
        }
        await setStoredPassword(hashPassword(newPassword));
        // All existing sessions (including this one) are now invalid — the client logs in again.
        return res.status(200).json({ ok: true });
      }

      default:
        return res.status(400).json({ error: 'Veprim i panjohur' });
    }
  } catch (err) {
    console.error('admin-actions error:', err);
    return res.status(500).json({ error: 'Gabim në server' });
  }
}
