// Validation + mapping for event rows. Server-side only.
import { CITIES, CATEGORY_VALUES, LIMITS } from '../../shared/constants.js';
import { cleanString, isValidHttpsUrl, supabaseUrl } from './security.js';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const PHONE_RE = /^\+?[0-9 ()-]{6,25}$/;
const IG_RE = /^[A-Za-z0-9._]{1,30}$/;

// Only images in our own public storage bucket are accepted from the public form.
export function isOwnStorageUrl(url) {
  return (
    typeof url === 'string' &&
    url.startsWith(`${supabaseUrl()}/storage/v1/object/public/event-images/`) &&
    isValidHttpsUrl(url)
  );
}

function normalizeInstagram(v) {
  const s = cleanString(v, 80)
    .replace(/^https?:\/\/(www\.)?instagram\.com\//i, '')
    .replace(/^@/, '')
    .replace(/\/.*$/, '');
  return s && IG_RE.test(s) ? s : '';
}

/**
 * Validates user-provided event fields and returns a DB row (snake_case).
 * @param {object} input
 * @param {{partial?: boolean, trustedImages?: boolean}} opts
 *   partial: only validate fields present (admin edit)
 *   trustedImages: allow any https image URL (admin only)
 * @returns {{ row?: object, error?: string }}
 */
export function validateEventInput(input = {}, { partial = false, trustedImages = false } = {}) {
  const row = {};
  const has = (k) => Object.prototype.hasOwnProperty.call(input, k);
  const need = (k) => !partial || has(k);

  if (need('name')) {
    row.name = cleanString(input.name, LIMITS.name);
    if (!row.name) return { error: 'Emri i eventit mungon' };
  }
  if (need('venue')) {
    row.venue = cleanString(input.venue, LIMITS.venue);
    if (!row.venue) return { error: 'Emri i lokalit mungon' };
  }
  if (need('city')) {
    if (!CITIES.includes(input.city)) return { error: 'Qytet i pavlefshëm' };
    row.city = input.city;
  }
  if (need('date')) {
    if (!DATE_RE.test(String(input.date || ''))) return { error: 'Data e pavlefshme' };
    row.date = input.date;
  }
  if (has('time') && input.time) {
    if (!TIME_RE.test(String(input.time))) return { error: 'Ora e pavlefshme' };
    row.time = input.time;
  } else if (has('time')) {
    row.time = null;
  }
  if (need('type')) {
    if (!CATEGORY_VALUES.includes(input.type)) return { error: 'Kategori e pavlefshme' };
    row.type = input.type;
  }
  if (need('description')) {
    row.description = cleanString(input.description, LIMITS.description);
    if (!row.description) return { error: 'Përshkrimi mungon' };
  }
  if (has('price') || !partial) {
    row.price = cleanString(input.price, LIMITS.price) || 'Falas';
  }
  if (need('phone')) {
    const phone = cleanString(input.phone, LIMITS.phone);
    if (!PHONE_RE.test(phone)) return { error: 'Numri i telefonit nuk është i saktë' };
    row.phone = phone;
  }
  if (has('instagram')) row.instagram = normalizeInstagram(input.instagram) || null;

  // Admin may keep legacy base64 images from old submissions, or use any https URL.
  const imageOk = (u) => (trustedImages ? isValidHttpsUrl(u) || /^data:image\/(png|jpe?g|webp);base64,/.test(u) : isOwnStorageUrl(u));
  if (has('gallery')) {
    const gallery = Array.isArray(input.gallery) ? input.gallery.slice(0, LIMITS.maxPhotos) : [];
    if (!gallery.every(imageOk)) return { error: 'Foto e pavlefshme' };
    row.gallery_urls = gallery;
  }
  if (has('image') && input.image) {
    if (!imageOk(input.image)) return { error: 'Foto e pavlefshme' };
    row.image = input.image;
  }
  return { row };
}

// DB row -> shape used by the frontend
export function toAppEvent(e) {
  return {
    id: e.id,
    name: e.name,
    venue: e.venue,
    city: e.city,
    date: e.date,
    time: e.time || undefined,
    type: e.type,
    description: e.description,
    price: e.price,
    image: e.image,
    gallery: Array.isArray(e.gallery_urls) ? e.gallery_urls : [],
    phone: e.phone,
    instagram: e.instagram || undefined,
    status: e.status,
    isPromoted: !!e.is_promoted,
    wantsPromotion: !!e.wants_promotion,
    views: e.views || 0,
    clicks: e.clicks || 0,
    createdAt: e.created_at,
  };
}
