// ============ SHARED SERVER-SIDE SECURITY HELPERS ============
// Used by every /api/*.js endpoint. Nothing in this file is ever sent to the browser.

import crypto from 'crypto';

// ---------- Rate limiting (in-memory, per serverless instance) ----------
// NOTE: on Vercel this resets on cold starts and is per-instance, not global.
// It still blocks the vast majority of scripted abuse/brute-force for a solo/small app.
// For real scale, swap this Map for Upstash Redis (a few lines, see comment below).
const hits = new Map(); // key -> [timestamps]

export function rateLimit(key, { windowMs, max }) {
  const now = Date.now();
  const arr = (hits.get(key) || []).filter((t) => now - t < windowMs);
  arr.push(now);
  hits.set(key, arr);
  // Cheap cleanup so the Map doesn't grow forever on a long-lived instance
  if (hits.size > 5000) {
    for (const [k, v] of hits) {
      if (!v.length || now - v[v.length - 1] > windowMs) hits.delete(k);
    }
  }
  return { allowed: arr.length <= max, remaining: Math.max(0, max - arr.length) };
}

export function getClientIp(req) {
  const fwd = req.headers['x-forwarded-for'];
  if (fwd) return String(fwd).split(',')[0].trim();
  return req.socket?.remoteAddress || 'unknown';
}

// Call this first in every handler. Sends a 429 itself if the limit is hit.
export function enforceRateLimit(req, res, { windowMs, max, bucket }) {
  const ip = getClientIp(req);
  const { allowed, remaining } = rateLimit(`${bucket}:${ip}`, { windowMs, max });
  res.setHeader('X-RateLimit-Remaining', String(remaining));
  if (!allowed) {
    res.status(429).json({ error: 'Too many requests. Try again in a bit.' });
    return false;
  }
  return true;
}

// ---------- Signed, expiring admin session tokens (HMAC, no external deps) ----------
// Replaces storing/reading the admin password from a public, anon-writable Supabase table.
const SECRET = process.env.ADMIN_SESSION_SECRET;

function b64url(input) {
  return Buffer.from(input).toString('base64url');
}

export function signAdminToken(ttlMs = 1000 * 60 * 60 * 6) {
  if (!SECRET) throw new Error('ADMIN_SESSION_SECRET is not set');
  const payload = JSON.stringify({ exp: Date.now() + ttlMs });
  const body = b64url(payload);
  const sig = crypto.createHmac('sha256', SECRET).update(body).digest('base64url');
  return `${body}.${sig}`;
}

export function verifyAdminToken(token) {
  if (!SECRET || !token || typeof token !== 'string' || !token.includes('.')) return false;
  const [body, sig] = token.split('.');
  const expected = crypto.createHmac('sha256', SECRET).update(body).digest('base64url');
  // Constant-time comparison to avoid timing attacks
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return false;
  try {
    const { exp } = JSON.parse(Buffer.from(body, 'base64url').toString());
    return typeof exp === 'number' && Date.now() < exp;
  } catch {
    return false;
  }
}

export function requireAdmin(req, res) {
  const token = req.headers['x-admin-token'] || req.body?.token;
  if (!verifyAdminToken(token)) {
    res.status(401).json({ error: 'Not authenticated as admin' });
    return false;
  }
  return true;
}

// ---------- Service-role Supabase access (server-only, bypasses RLS) ----------
// SUPABASE_SERVICE_ROLE_KEY must NEVER be prefixed with VITE_ (that would ship it to the browser).
export function supabaseServiceHeaders() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set');
  return { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' };
}

export function supabaseUrl() {
  return (process.env.VITE_SUPABASE_URL || 'https://ytfemeqepmffxckjeehg.supabase.co').replace(/\/+$/, '');
}
