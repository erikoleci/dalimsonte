// ============ PUBLIC EVENT SUBMISSION ============
// Venues submit events here (not directly to Supabase). The server:
//   - rate-limits per IP (5 submissions / hour)
//   - verifies a Cloudflare Turnstile captcha (if TURNSTILE_SECRET_KEY is set)
//   - validates every field and only accepts photos from our own storage bucket
//   - generates the id itself and always inserts as `pending`, never promoted
//
// Env vars: service_role (or SUPABASE_SERVICE_ROLE_KEY), TURNSTILE_SECRET_KEY (optional but recommended)

import crypto from 'crypto';
import { enforceRateLimit, getClientIp, requirePost, sbWriteTolerant } from './_lib/security.js';
import { validateEventInput } from './_lib/events.js';

async function verifyTurnstile(token, ip) {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return true; // captcha not configured yet — rate limit still applies
  if (!token || typeof token !== 'string') return false;
  try {
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ secret, response: token, remoteip: ip }),
    });
    const data = await res.json();
    return data.success === true;
  } catch {
    return false;
  }
}

export default async function handler(req, res) {
  if (!requirePost(req, res)) return;
  if (!(await enforceRateLimit(req, res, { windowMs: 60 * 60 * 1000, max: 5, bucket: 'submit-event' }))) return;

  try {
    const { event = {}, captchaToken, acceptedTerms, honeypot } = req.body || {};

    // Bots fill hidden fields; humans don't.
    if (honeypot) return res.status(200).json({ ok: true });

    if (acceptedTerms !== true) {
      return res.status(400).json({ error: 'Duhet të pranosh kushtet dhe politikën e privatësisë' });
    }
    if (!(await verifyTurnstile(captchaToken, getClientIp(req)))) {
      return res.status(400).json({ error: 'Verifikimi anti-bot dështoi. Rifresko faqen dhe provo përsëri.' });
    }

    const { row, error } = validateEventInput(event);
    if (error) return res.status(400).json({ error });

    const today = new Date().toISOString().slice(0, 10);
    if (row.date < today) return res.status(400).json({ error: 'Data nuk mund të jetë në të kaluarën' });

    const gallery = row.gallery_urls || [];
    const insert = {
      ...row,
      id: crypto.randomUUID(),
      image: gallery[0] || null,
      gallery_urls: gallery,
      status: 'pending',
      is_promoted: false,
      wants_promotion: event.wantsPromotion === true,
    };

    await sbWriteTolerant('events', 'POST', insert);

    return res.status(200).json({ ok: true, id: insert.id });
  } catch (err) {
    console.error('submit-event error:', err);
    return res.status(500).json({ error: 'Gabim në server. Provo përsëri.' });
  }
}
