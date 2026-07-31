// ============ ADMIN ACTIONS (approve / edit / delete event, change password) ============
// All writes that used to happen client-side with the anon key now happen here,
// server-side, with the service_role key — and only after verifying the admin token.
// The anon key can no longer write to `events` beyond a fresh pending submission,
// and can no longer touch `app_settings` at all (see supabase-schema-secure.sql).

import { enforceRateLimit, requireAdmin, supabaseServiceHeaders, supabaseUrl } from './_lib/security.js';

async function sb(path, options = {}) {
  const res = await fetch(`${supabaseUrl()}/rest/v1/${path}`, {
    ...options,
    headers: { ...supabaseServiceHeaders(), ...(options.headers || {}) },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Supabase ${res.status}: ${text}`);
  }
  return res.status === 204 ? null : res.json();
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  if (!enforceRateLimit(req, res, { windowMs: 60 * 1000, max: 30, bucket: 'admin-actions' })) return;
  if (!requireAdmin(req, res)) return;

  try {
    const { action, payload = {} } = req.body || {};

    switch (action) {
      case 'approveEvent': {
        const { id, promote } = payload;
        if (!id) return res.status(400).json({ error: 'Missing id' });
        await sb(`events?id=eq.${encodeURIComponent(id)}`, {
          method: 'PATCH',
          headers: { Prefer: 'return=minimal' },
          body: JSON.stringify({ status: 'approved', is_promoted: !!promote }),
        });
        return res.status(200).json({ ok: true });
      }

      case 'updateEvent': {
        const { id, updates } = payload;
        if (!id || !updates) return res.status(400).json({ error: 'Missing id/updates' });
        const clean = { ...updates };
        delete clean.id;
        // Map camelCase app fields to the DB's snake_case columns
        if ('isPromoted' in clean) { clean.is_promoted = clean.isPromoted; delete clean.isPromoted; }
        if ('gallery' in clean) { clean.gallery_urls = clean.gallery; delete clean.gallery; }
        await sb(`events?id=eq.${encodeURIComponent(id)}`, {
          method: 'PATCH',
          headers: { Prefer: 'return=minimal' },
          body: JSON.stringify(clean),
        });
        return res.status(200).json({ ok: true });
      }

      case 'deleteEvent': {
        const { id } = payload;
        if (!id) return res.status(400).json({ error: 'Missing id' });
        await sb(`events?id=eq.${encodeURIComponent(id)}`, {
          method: 'DELETE',
          headers: { Prefer: 'return=minimal' },
        });
        return res.status(200).json({ ok: true });
      }

      case 'changePassword': {
        const { newPassword } = payload;
        if (!newPassword || newPassword.length < 4) {
          return res.status(400).json({ error: 'Password too short (min 4 chars)' });
        }
        await sb('app_settings', {
          method: 'POST',
          headers: { Prefer: 'resolution=merge-duplicates' },
          body: JSON.stringify({ key: 'admin_password', value: newPassword }),
        });
        return res.status(200).json({ ok: true });
      }

      default:
        return res.status(400).json({ error: 'Unknown action' });
    }
  } catch (err) {
    console.error('admin-actions error:', err);
    res.status(500).json({ error: 'Server error', debug: String(err?.message || err) });
  }
}
