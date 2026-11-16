// ============ ADMIN LOGIN ============
// Env vars needed:
//   ADMIN_SESSION_SECRET  -> long random string (min 32 chars), e.g. `openssl rand -hex 32`
//   ADMIN_PASSWORD        -> initial password, used only until you change it in the panel
//   service_role          -> Supabase dashboard -> Settings -> API -> service_role (secret)

import {
  enforceRateLimit,
  getStoredPassword,
  hashPassword,
  isHashed,
  passwordVersion,
  requirePost,
  setStoredPassword,
  signAdminToken,
  verifyPassword,
  ADMIN_TOKEN_TTL_MS,
} from './_lib/security.js';

export default async function handler(req, res) {
  if (!requirePost(req, res)) return;

  // Brute-force protection: 5 attempts per 15 minutes per IP.
  if (!(await enforceRateLimit(req, res, { windowMs: 15 * 60 * 1000, max: 5, bucket: 'admin-login' }))) return;

  try {
    const { password } = req.body || {};
    if (!password || typeof password !== 'string' || password.length > 200) {
      return res.status(400).json({ error: 'Fjalëkalimi mungon' });
    }

    let stored = await getStoredPassword();
    if (!stored) return res.status(500).json({ error: 'Fjalëkalimi i adminit nuk është konfiguruar në server' });

    if (!verifyPassword(password, stored)) {
      return res.status(401).json({ error: 'Fjalëkalim i gabuar' });
    }

    // Legacy plaintext password (old app_settings value or ADMIN_PASSWORD env)?
    // Upgrade it to a scrypt hash on the first successful login.
    if (!isHashed(stored)) {
      try {
        stored = hashPassword(password);
        await setStoredPassword(stored);
      } catch (e) {
        console.warn('Could not migrate admin password to hash', e);
      }
    }

    const token = signAdminToken(passwordVersion(stored));
    return res.status(200).json({ token, expiresInMs: ADMIN_TOKEN_TTL_MS });
  } catch (err) {
    console.error('admin-login error:', err);
    return res.status(500).json({ error: 'Gabim në server' });
  }
}
