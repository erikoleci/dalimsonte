// ============ SHARED SERVER-SIDE SECURITY HELPERS ============
// Used by every /api/*.js endpoint. Nothing in this file is ever sent to the browser.

import crypto from 'crypto';

// ---------------------------------------------------------------------------
// Client IP
// ---------------------------------------------------------------------------
// On Vercel, `x-real-ip` / `x-vercel-forwarded-for` are set by the platform and
// cannot be spoofed by the client. `x-forwarded-for` CAN be spoofed (a client
// can prepend any value), so it is only used as a last resort, taking the
// right-most entry (the one added by the proxy closest to us).
export function getClientIp(req) {
  const h = req.headers || {};
  const vercel = h['x-vercel-forwarded-for'] || h['x-real-ip'];
  if (vercel) return String(vercel).split(',')[0].trim();
  const fwd = h['x-forwarded-for'];
  if (fwd) {
    const parts = String(fwd).split(',').map((s) => s.trim()).filter(Boolean);
    if (parts.length) return parts[parts.length - 1];
  }
  return req.socket?.remoteAddress || 'unknown';
}

// ---------------------------------------------------------------------------
// Rate limiting
// ---------------------------------------------------------------------------
// If UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN are set (free tier on
// upstash.com), limits are global across all serverless instances.
// Otherwise falls back to an in-memory map (per instance, resets on cold start).
const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const hits = new Map(); // key -> [timestamps]

function memoryRateLimit(key, windowMs, max) {
  const now = Date.now();
  const arr = (hits.get(key) || []).filter((t) => now - t < windowMs);
  arr.push(now);
  hits.set(key, arr);
  if (hits.size > 5000) {
    for (const [k, v] of hits) {
      if (!v.length || now - v[v.length - 1] > windowMs) hits.delete(k);
    }
  }
  return { allowed: arr.length <= max, remaining: Math.max(0, max - arr.length) };
}

async function upstashRateLimit(key, windowMs, max) {
  // Fixed-window counter: INCR + PEXPIRE NX in one pipeline call.
  const windowKey = `rl:${key}:${Math.floor(Date.now() / windowMs)}`;
  const res = await fetch(`${UPSTASH_URL}/pipeline`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${UPSTASH_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify([
      ['INCR', windowKey],
      ['PEXPIRE', windowKey, String(windowMs), 'NX'],
    ]),
  });
  const data = await res.json();
  const count = Number(data?.[0]?.result || 0);
  return { allowed: count <= max, remaining: Math.max(0, max - count) };
}

export async function rateLimit(key, { windowMs, max }) {
  if (UPSTASH_URL && UPSTASH_TOKEN) {
    try {
      return await upstashRateLimit(key, windowMs, max);
    } catch (e) {
      console.warn('Upstash rate limit failed, using memory fallback');
    }
  }
  return memoryRateLimit(key, windowMs, max);
}

// Call this first in every handler. Sends a 429 itself if the limit is hit.
export async function enforceRateLimit(req, res, { windowMs, max, bucket }) {
  const ip = getClientIp(req);
  const { allowed, remaining } = await rateLimit(`${bucket}:${ip}`, { windowMs, max });
  res.setHeader('X-RateLimit-Remaining', String(remaining));
  if (!allowed) {
    res.status(429).json({ error: 'Shumë kërkesa. Provo përsëri pas pak.' });
    return false;
  }
  return true;
}

// ---------------------------------------------------------------------------
// Password hashing (scrypt, built into Node — no extra dependency)
// Stored format:  scrypt$<saltHex>$<hashHex>
// ---------------------------------------------------------------------------
export function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(String(password), salt, 64);
  return `scrypt$${salt.toString('hex')}$${hash.toString('hex')}`;
}

export function safeEqual(a, b) {
  const ba = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  if (ba.length !== bb.length) {
    // Still do a comparison so timing doesn't reveal the length difference much
    crypto.timingSafeEqual(ba, ba);
    return false;
  }
  return crypto.timingSafeEqual(ba, bb);
}

export function isHashed(stored) {
  return typeof stored === 'string' && stored.startsWith('scrypt$');
}

export function verifyPassword(password, stored) {
  if (!stored || typeof password !== 'string') return false;
  if (!isHashed(stored)) {
    // Legacy plaintext value — compare in constant time (caller migrates it to a hash).
    return safeEqual(password, stored);
  }
  const [, saltHex, hashHex] = stored.split('$');
  const expected = Buffer.from(hashHex, 'hex');
  const actual = crypto.scryptSync(password, Buffer.from(saltHex, 'hex'), expected.length);
  return crypto.timingSafeEqual(actual, expected);
}

// A short fingerprint of the stored password. It goes inside the session token,
// so changing the password immediately invalidates every existing session.
export function passwordVersion(stored) {
  return crypto.createHash('sha256').update(String(stored || '')).digest('base64url').slice(0, 16);
}

// ---------------------------------------------------------------------------
// Signed, expiring admin session tokens (HMAC-SHA256)
// ---------------------------------------------------------------------------
const SECRET = process.env.ADMIN_SESSION_SECRET;
export const ADMIN_TOKEN_TTL_MS = 1000 * 60 * 60 * 6; // 6h

function b64url(input) {
  return Buffer.from(input).toString('base64url');
}

export function signAdminToken(pwv, ttlMs = ADMIN_TOKEN_TTL_MS) {
  if (!SECRET) throw new Error('ADMIN_SESSION_SECRET is not set');
  if (SECRET.length < 32) console.warn('ADMIN_SESSION_SECRET is short — use at least 32 random characters');
  const payload = JSON.stringify({ exp: Date.now() + ttlMs, pwv });
  const body = b64url(payload);
  const sig = crypto.createHmac('sha256', SECRET).update(body).digest('base64url');
  return `${body}.${sig}`;
}

function decodeAdminToken(token) {
  if (!SECRET || !token || typeof token !== 'string' || !token.includes('.')) return null;
  const [body, sig] = token.split('.');
  const expected = crypto.createHmac('sha256', SECRET).update(body).digest('base64url');
  if (!safeEqual(sig, expected)) return null;
  try {
    const data = JSON.parse(Buffer.from(body, 'base64url').toString());
    if (typeof data.exp !== 'number' || Date.now() >= data.exp) return null;
    return data;
  } catch {
    return null;
  }
}

// Verifies signature + expiry + that the password hasn't changed since login.
export async function requireAdmin(req, res) {
  const token = req.headers['x-admin-token'];
  const data = decodeAdminToken(token);
  if (!data) {
    res.status(401).json({ error: 'Nuk je i identifikuar si admin' });
    return false;
  }
  const stored = await getStoredPassword();
  if (data.pwv !== passwordVersion(stored)) {
    res.status(401).json({ error: 'Sesioni ka skaduar, hyr përsëri' });
    return false;
  }
  return true;
}

// ---------------------------------------------------------------------------
// Service-role Supabase access (server-only, bypasses RLS)
// ---------------------------------------------------------------------------
// The env var is named "service_role" in Vercel. It must NEVER be prefixed with
// VITE_ (that would ship it to the browser). SUPABASE_SERVICE_ROLE_KEY also works.
export function supabaseServiceHeaders() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.service_role;
  if (!key) throw new Error('service_role env var is not set');
  return { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' };
}

export function supabaseUrl() {
  return (process.env.VITE_SUPABASE_URL || 'https://ytfemeqepmffxckjeehg.supabase.co')
    .replace(/\/rest\/v1\/?$/, '')
    .replace(/\/+$/, '');
}

export async function sb(path, options = {}) {
  const res = await fetch(`${supabaseUrl()}/rest/v1/${path}`, {
    ...options,
    headers: { ...supabaseServiceHeaders(), ...(options.headers || {}) },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Supabase ${res.status}: ${text}`);
  }
  if (res.status === 204) return null;
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

// Admin password: hashed value in app_settings, or ADMIN_PASSWORD env var as
// the initial value (before the first "change password").
export async function getStoredPassword() {
  try {
    const data = await sb('app_settings?select=value&key=eq.admin_password');
    if (Array.isArray(data) && data[0]?.value) return data[0].value;
  } catch {
    /* fall through */
  }
  return process.env.ADMIN_PASSWORD || null;
}

export async function setStoredPassword(value) {
  await sb('app_settings?on_conflict=key', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify({ key: 'admin_password', value, updated_at: new Date().toISOString() }),
  });
}

// ---------------------------------------------------------------------------
// Input helpers
// ---------------------------------------------------------------------------
export function cleanString(v, max) {
  if (v === undefined || v === null) return '';
  return String(v).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim().slice(0, max);
}

export function isValidHttpsUrl(v) {
  try {
    const u = new URL(v);
    return u.protocol === 'https:';
  } catch {
    return false;
  }
}

export function requirePost(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return false;
  }
  return true;
}

// Writes that keep working even if supabase-schema.sql hasn't been re-run yet:
// if PostgREST says a column doesn't exist, drop that field and retry.
export async function sbWriteTolerant(path, method, row, prefer = 'return=minimal') {
  const body = { ...row };
  for (let i = 0; i < 6; i++) {
    try {
      return await sb(path, { method, headers: { Prefer: prefer }, body: JSON.stringify(body) });
    } catch (e) {
      const m = /Could not find the '([a-z_]+)' column/.exec(String(e?.message || ''));
      if (!m || !(m[1] in body)) throw e;
      console.warn(`Column "${m[1]}" missing — run supabase-schema.sql. Retrying without it.`);
      delete body[m[1]];
    }
  }
  throw new Error('Too many missing columns');
}
