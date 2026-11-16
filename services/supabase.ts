import type { AppEvent } from '../types';

// --- Public (browser) Supabase config ---
// The publishable key is MEANT to be public: with the RLS in supabase-schema.sql
// it can only read approved events and upload new images. Every write goes
// through /api/* on the server.
// We talk to Supabase's REST API with plain fetch instead of shipping the whole
// supabase-js library (~110 KB gzipped less JavaScript → much faster first load).
const SUPABASE_URL = ((import.meta.env.VITE_SUPABASE_URL as string) || 'https://ytfemeqepmffxckjeehg.supabase.co').replace(/\/+$/, '');
const SUPABASE_KEY =
  (import.meta.env.VITE_SUPABASE_ANON_KEY as string) || 'sb_publishable_JhQVaiJFTKfWGUdVd_u7rw_Q91S5QcO';

export const SUPABASE_PROJECT_REF = new URL(SUPABASE_URL).hostname.split('.')[0];

const publicHeaders = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` };

function mapRow(e: any): AppEvent {
  return {
    ...e,
    time: e.time || undefined,
    instagram: e.instagram || undefined,
    artists: e.artists || undefined,
    lat: typeof e.lat === 'number' ? e.lat : undefined,
    lng: typeof e.lng === 'number' ? e.lng : undefined,
    address: e.address || undefined,
    isPromoted: !!e.is_promoted,
    gallery: Array.isArray(e.gallery_urls) ? e.gallery_urls : [],
  };
}

// Last successful list, so returning visitors see events instantly.
const CACHE_KEY = 'kudalim_events_cache_v1';
export function readCachedEvents(): AppEvent[] | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const { ts, events } = JSON.parse(raw);
    if (Date.now() - ts > 1000 * 60 * 60 * 24) return null;
    return Array.isArray(events) ? events : null;
  } catch {
    return null;
  }
}
function writeCachedEvents(events: AppEvent[]) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), events }));
  } catch {}
}

// ---------------------------------------------------------------------------
// Images: resized + converted to WebP in the browser before upload.
// A 6 MB phone photo becomes ~200–400 KB → faster uploads, faster site.
// ---------------------------------------------------------------------------
async function compressImage(file: File, maxSize = 1600, quality = 0.82): Promise<Blob> {
  if (!file.type.startsWith('image/')) throw new Error('Not an image');
  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) return file;
  const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return file;
  ctx.drawImage(bitmap, 0, 0, w, h);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/webp', quality));
  return blob && blob.size < file.size ? blob : file;
}

export async function uploadEventImage(file: File): Promise<string> {
  const blob = await compressImage(file);
  const type = blob.type || 'image/jpeg';
  const ext = type === 'image/webp' ? 'webp' : type === 'image/png' ? 'png' : 'jpg';
  const fileName = `${crypto.randomUUID()}.${ext}`;
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/event-images/${fileName}`, {
    method: 'POST',
    headers: { ...publicHeaders, 'Content-Type': type, 'cache-control': 'max-age=31536000', 'x-upsert': 'false' },
    body: blob,
  });
  if (!res.ok) throw new Error(`Upload failed (${res.status})`);
  return `${SUPABASE_URL}/storage/v1/object/public/event-images/${fileName}`;
}

export async function uploadEventImages(files: File[]): Promise<string[]> {
  return Promise.all(files.slice(0, 3).map(uploadEventImage));
}

// ---------------------------------------------------------------------------
// Public data
// ---------------------------------------------------------------------------
export const db = {
  /** Approved events from (roughly) yesterday onwards. */
  getEvents: async (fromDate: string): Promise<AppEvent[]> => {
    const url =
      `${SUPABASE_URL}/rest/v1/events?select=*&status=eq.approved` +
      `&date=gte.${encodeURIComponent(fromDate)}&order=date.asc&limit=500`;
    const res = await fetch(url, { headers: publicHeaders });
    if (!res.ok) throw new Error(`Supabase ${res.status}`);
    const events = ((await res.json()) || []).map(mapRow);
    writeCachedEvents(events);
    return events;
  },

  /**
   * Keeps the list fresh: re-fetches every 2 minutes while the tab is visible
   * and immediately when the user comes back to the tab/app.
   * (Cheaper and lighter than a realtime websocket for a listings site.)
   */
  subscribeToEvents: (callback: () => void) => {
    const tick = () => document.visibilityState === 'visible' && callback();
    const interval = setInterval(tick, 2 * 60 * 1000);
    document.addEventListener('visibilitychange', tick);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', tick);
    };
  },

  submitEvent: async (
    event: Omit<AppEvent, 'id' | 'status' | 'image' | 'isPromoted'> & { wantsPromotion: boolean },
    extra: { captchaToken?: string; acceptedTerms: boolean; honeypot?: string }
  ): Promise<{ ok: boolean; error?: string }> => {
    try {
      const res = await fetch('/api/submit-event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event, ...extra }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return { ok: false, error: data?.error || 'Gabim gjatë dërgimit' };
      return { ok: true };
    } catch {
      return { ok: false, error: 'Nuk ka lidhje me internetin' };
    }
  },

  // Analytics: fire-and-forget, rate-limited server-side.
  track: (id: string, kind: 'view' | 'click') => {
    try {
      fetch('/api/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, kind }),
        keepalive: true,
      }).catch(() => {});
    } catch {}
  },
};

// ---------------------------------------------------------------------------
// Admin (server-verified). Token lives in sessionStorage: it disappears when
// the tab closes and expires server-side after 6h anyway.
// ---------------------------------------------------------------------------
const ADMIN_TOKEN_KEY = 'kudalim_admin_token';

const tokenStore = {
  get: () => {
    try {
      return sessionStorage.getItem(ADMIN_TOKEN_KEY) || '';
    } catch {
      return '';
    }
  },
  set: (v: string) => {
    try {
      sessionStorage.setItem(ADMIN_TOKEN_KEY, v);
    } catch {}
  },
  clear: () => {
    try {
      sessionStorage.removeItem(ADMIN_TOKEN_KEY);
      localStorage.removeItem(ADMIN_TOKEN_KEY); // old versions stored it here
    } catch {}
  },
};

export class AdminAuthError extends Error {}

async function callAdminApi<T = any>(action: string, payload: any = {}): Promise<T> {
  const res = await fetch('/api/admin-actions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-admin-token': tokenStore.get() },
    body: JSON.stringify({ action, payload }),
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401) {
    tokenStore.clear();
    throw new AdminAuthError(data?.error || 'Sesioni skadoi');
  }
  if (!res.ok) throw new Error(data?.error || `Veprimi "${action}" dështoi`);
  return data as T;
}

export const admin = {
  login: async (password: string): Promise<{ ok: boolean; error?: string }> => {
    try {
      const res = await fetch('/api/admin-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return { ok: false, error: data?.error || 'Hyrja dështoi' };
      tokenStore.set(data.token);
      return { ok: true };
    } catch {
      return { ok: false, error: 'Nuk ka lidhje me serverin' };
    }
  },
  isLoggedIn: () => !!tokenStore.get(),
  logout: () => tokenStore.clear(),
  listEvents: async () => (await callAdminApi<{ events: AppEvent[] }>('listEvents')).events,
  approve: (id: string, promote: boolean) => callAdminApi('approveEvent', { id, promote }),
  setPromoted: (id: string, promoted: boolean) => callAdminApi('setPromoted', { id, promoted }),
  update: (id: string, updates: Partial<AppEvent>) => callAdminApi('updateEvent', { id, updates }),
  remove: (id: string) => callAdminApi('deleteEvent', { id }),
  purgePast: () => callAdminApi('purgePastEvents'),
  changePassword: (currentPassword: string, newPassword: string) =>
    callAdminApi('changePassword', { currentPassword, newPassword }),
};
