// ============ ADMIN LOGIN ============
// Replaces the old flow of comparing against `app_settings` read directly by the
// browser with the anon key. That table was (and no longer is) readable/writable
// by anyone — see supabase-schema-secure.sql.
//
// Env vars needed:
//   ADMIN_SESSION_SECRET       -> any long random string, e.g. `openssl rand -hex 32`
//   ADMIN_PASSWORD             -> initial/fallback admin password (change it after first login)
//   service_role  -> from Supabase dashboard -> Settings -> API (service_role, secret)
//   VITE_SUPABASE_URL

import { enforceRateLimit, signAdminToken, supabaseServiceHeaders, supabaseUrl } from './_lib/security.js';

async function getStoredPassword() {
  try {
    const res = await fetch(`${supabaseUrl()}/rest/v1/app_settings?select=value&key=eq.admin_password`, {
      headers: supabaseServiceHeaders(),
    });
    const data = await res.json();
    return Array.isArray(data) && data[0]?.value ? data[0].value : null;
  } catch {
    return null;
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  // Brute-force protection: 5 attempts per 15 minutes per IP.
  if (!enforceRateLimit(req, res, { windowMs: 15 * 60 * 1000, max: 5, bucket: 'admin-login' })) return;

  try {
    const { password } = req.body || {};
    if (!password) {
      res.status(400).json({ error: 'Missing password' });
      return;
    }

    const stored = (await getStoredPassword()) || process.env.ADMIN_PASSWORD;
    if (!stored) {
      res.status(500).json({ error: 'Admin password is not configured on the server' });
      return;
    }

    if (password !== stored) {
      res.status(401).json({ error: 'Incorrect password' });
      return;
    }

    const token = signAdminToken();
    res.status(200).json({ token, expiresInMs: 1000 * 60 * 60 * 6 });
  } catch (err) {
    console.error('admin-login error:', err);
    res.status(500).json({ error: 'Server error' });
  }
}
