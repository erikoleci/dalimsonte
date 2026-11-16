// Admin panel — Albanian only (internal tool).
import React, { useEffect, useMemo, useState } from 'react';
import type { AppEvent } from '../types';
import { CATEGORIES, CITIES } from '../shared/constants.js';
import { admin, AdminAuthError, SUPABASE_PROJECT_REF } from '../services/supabase';
import { tonightYMD } from '../lib/dates';
import { FALLBACK_IMAGE } from './EventCard';
import { Icon } from './ui';

type Tab = 'pending' | 'live' | 'past' | 'all';

export const AdminPanel: React.FC<{ onExit: () => void; notify: (m: string, t?: 'success' | 'info' | 'warning') => void }> = ({ onExit, notify }) => {
  const [authed, setAuthed] = useState(admin.isLoggedIn());
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loggingIn, setLoggingIn] = useState(false);
  const [events, setEvents] = useState<AppEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<Tab>('pending');
  const [editing, setEditing] = useState<AppEvent | null>(null);
  const [showPw, setShowPw] = useState(false);

  const handleAuthError = (e: unknown) => {
    if (e instanceof AdminAuthError) {
      setAuthed(false);
      setLoginError(e.message);
      return true;
    }
    notify((e as Error)?.message || 'Gabim', 'warning');
    return false;
  };

  const load = async () => {
    setLoading(true);
    try {
      setEvents(await admin.listEvents());
    } catch (e) {
      handleAuthError(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (authed) load();
  }, [authed]);

  const login = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoggingIn(true);
    const r = await admin.login(password);
    setLoggingIn(false);
    if (r.ok) {
      setPassword('');
      setLoginError('');
      setAuthed(true);
    } else setLoginError(r.error || 'Hyrja dështoi');
  };

  const run = async (fn: () => Promise<any>, msg: string) => {
    try {
      await fn();
      notify(msg, 'success');
      await load();
    } catch (e) {
      handleAuthError(e);
    }
  };

  const today = tonightYMD();
  const counts = useMemo(
    () => ({
      pending: events.filter((e) => e.status === 'pending').length,
      live: events.filter((e) => e.status === 'approved' && e.date >= today).length,
      past: events.filter((e) => e.date < today).length,
      all: events.length,
    }),
    [events, today]
  );

  const list = useMemo(() => {
    const f = events.filter((e) =>
      tab === 'pending' ? e.status === 'pending' : tab === 'live' ? e.status === 'approved' && e.date >= today : tab === 'past' ? e.date < today : true
    );
    return [...f].sort((a, b) => (tab === 'past' ? b.date.localeCompare(a.date) : a.date.localeCompare(b.date)));
  }, [events, tab, today]);

  const totals = useMemo(() => {
    const views = events.reduce((s, e) => s + (e.views || 0), 0);
    const clicks = events.reduce((s, e) => s + (e.clicks || 0), 0);
    return { views, clicks, conv: views ? `${((clicks / views) * 100).toFixed(1)}%` : '—' };
  }, [events]);

  const top = useMemo(() => [...events].filter((e) => (e.views || 0) > 0).sort((a, b) => (b.views || 0) - (a.views || 0)).slice(0, 5), [events]);
  const maxViews = Math.max(1, ...top.map((e) => e.views || 0));

  if (!authed) {
    return (
      <div className="flex min-h-[100svh] items-center justify-center px-5 pt-16">
        <form onSubmit={login} className="w-full max-w-sm rounded-[28px] border border-night-line bg-night-surface p-7 animate-scale-in">
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-night-accent/15 text-2xl">🔒</div>
          <h1 className="text-center font-display text-2xl font-bold text-white">Paneli i adminit</h1>
          <p className="mb-6 mt-1 text-center text-sm text-night-muted">Vetëm për stafin</p>
          <label className="label">Fjalëkalimi</label>
          <input type="password" autoFocus autoComplete="current-password" className="field" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••••••" />
          {loginError && <p className="mt-3 text-center text-sm text-red-400">{loginError}</p>}
          <button disabled={!password || loggingIn} className="btn-primary mt-5 w-full">
            {loggingIn ? 'Duke hyrë…' : 'Hyr'}
          </button>
          <button type="button" onClick={onExit} className="mt-4 w-full text-sm text-night-muted hover:text-white">
            ← Kthehu te faqja
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 pb-24 pt-24 md:px-8">
      <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <h1 className="font-display text-3xl font-bold text-white">Paneli</h1>
          <p className="mt-1 flex items-center gap-2 font-mono text-xs text-night-muted">
            <span className="h-2 w-2 rounded-full bg-night-live" /> Supabase: {SUPABASE_PROJECT_REF}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={load} className="chip">↻ Rifresko</button>
          <button
            onClick={() => confirm('Fshi eventet që kanë mbaruar më shumë se 30 ditë më parë?') && run(admin.purgePast, 'Eventet e vjetra u fshinë')}
            className="chip"
          >
            🧹 Pastro të vjetrat
          </button>
          <button onClick={() => setShowPw(true)} className="chip">🔑 Fjalëkalimi</button>
          <button
            onClick={() => {
              admin.logout();
              setAuthed(false);
              onExit();
            }}
            className="chip"
          >
            Dil
          </button>
        </div>
      </div>

      <div className="mb-8 grid grid-cols-2 gap-3 md:grid-cols-5">
        <Stat label="Në pritje" value={counts.pending} tone="text-amber-400" />
        <Stat label="Live" value={counts.live} tone="text-night-live" />
        <Stat label="Kërkesa Premium" value={events.filter((e) => e.wantsPromotion && !e.isPromoted).length} tone="text-night-gold" />
        <Stat label="Shikime" value={totals.views.toLocaleString()} tone="text-night-accent2" />
        <Stat label="Klikime rezervimi" value={`${totals.clicks.toLocaleString()} · ${totals.conv}`} tone="text-night-accent" />
      </div>

      {top.length > 0 && (
        <div className="mb-8 rounded-3xl border border-night-line bg-night-surface p-5">
          <h2 className="label">Top evente sipas shikimeve</h2>
          <div className="space-y-3">
            {top.map((e) => (
              <div key={e.id}>
                <div className="mb-1 flex justify-between text-sm">
                  <span className="truncate pr-2 text-white">{e.name}</span>
                  <span className="whitespace-nowrap font-mono text-xs text-night-muted">
                    👁 {e.views} · 💬 {e.clicks}
                  </span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-white/5">
                  <div className="h-full rounded-full bg-gradient-to-r from-night-accent2 to-night-accent" style={{ width: `${Math.max(4, ((e.views || 0) / maxViews) * 100)}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="no-scrollbar mb-5 flex gap-2 overflow-x-auto">
        {(
          [
            ['pending', 'Në pritje'],
            ['live', 'Live'],
            ['past', 'Të kaluara'],
            ['all', 'Të gjitha'],
          ] as [Tab, string][]
        ).map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} className={`chip ${tab === k ? 'chip-active' : ''}`}>
            {l} <span className="opacity-60">{counts[k]}</span>
          </button>
        ))}
      </div>

      {loading && !events.length ? (
        <p className="py-16 text-center text-night-muted">Duke ngarkuar…</p>
      ) : list.length === 0 ? (
        <p className="rounded-3xl border border-dashed border-night-line py-16 text-center text-night-muted">Asnjë event këtu.</p>
      ) : (
        <div className="grid gap-3">
          {list.map((e) => (
            <div key={e.id} className={`flex flex-col gap-4 rounded-3xl border p-4 md:flex-row md:items-center ${e.status === 'pending' ? 'border-amber-400/25 bg-amber-400/[0.04]' : 'border-night-line bg-night-surface'}`}>
              <img src={e.image || FALLBACK_IMAGE} alt="" className="h-20 w-full rounded-2xl object-cover md:h-16 md:w-16" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-bold text-white">{e.name}</span>
                  {e.status === 'pending' ? (
                    <span className="rounded-full bg-amber-400/15 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-300">Në pritje</span>
                  ) : (
                    <span className="rounded-full bg-night-live/15 px-2 py-0.5 text-[10px] font-bold uppercase text-night-live">Live</span>
                  )}
                  {e.isPromoted && <span className="rounded-full bg-night-gold/15 px-2 py-0.5 text-[10px] font-bold uppercase text-night-gold">★ Premium</span>}
                  {e.wantsPromotion && !e.isPromoted && <span className="rounded-full border border-night-gold/40 px-2 py-0.5 text-[10px] font-bold uppercase text-night-gold">Kërkon Premium</span>}
                </div>
                <div className="mt-1 text-sm text-night-muted">
                  {e.venue} · {e.city} · {e.date} {e.time || ''} · {e.price}
                </div>
                <div className="mt-0.5 font-mono text-xs text-night-muted">
                  📞 {e.phone} {e.instagram && `· @${e.instagram}`} · 👁 {e.views || 0} · 💬 {e.clicks || 0}
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {e.status === 'pending' ? (
                  <>
                    <button onClick={() => run(() => admin.approve(e.id, false), 'Eventi u aprovua — tani është LIVE')} className="rounded-xl bg-night-live px-4 py-2 text-sm font-bold text-black">
                      Aprovo
                    </button>
                    <button onClick={() => run(() => admin.approve(e.id, true), 'U aprovua si Premium ★')} className="rounded-xl bg-night-gold px-4 py-2 text-sm font-bold text-black">
                      ★ Premium
                    </button>
                  </>
                ) : (
                  <button onClick={() => run(() => admin.setPromoted(e.id, !e.isPromoted), e.isPromoted ? 'Premium u hoq' : 'U bë Premium ★')} className="rounded-xl border border-night-gold/40 px-3 py-2 text-sm font-bold text-night-gold">
                    {e.isPromoted ? 'Hiq ★' : '★'}
                  </button>
                )}
                <button onClick={() => setEditing(e)} className="rounded-xl border border-night-line px-3 py-2 text-sm text-white">
                  ✏️
                </button>
                <button onClick={() => confirm(`Fshi "${e.name}"?`) && run(() => admin.remove(e.id), 'Eventi u fshi')} className="rounded-xl border border-red-500/30 px-3 py-2 text-sm text-red-400">
                  🗑️
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <EditModal
          event={editing}
          onClose={() => setEditing(null)}
          onSave={async (updates) => {
            await run(() => admin.update(editing.id, updates), 'Ndryshimet u ruajtën');
            setEditing(null);
          }}
        />
      )}
      {showPw && <PasswordModal onClose={() => setShowPw(false)} onDone={() => { setShowPw(false); setAuthed(false); setLoginError('Fjalëkalimi u ndryshua. Hyr me fjalëkalimin e ri.'); admin.logout(); }} />}
    </div>
  );
};

const Stat = ({ label, value, tone }: { label: string; value: React.ReactNode; tone: string }) => (
  <div className="rounded-3xl border border-night-line bg-night-surface p-4">
    <div className="text-xs font-semibold text-night-muted">{label}</div>
    <div className={`mt-1 font-display text-2xl font-bold ${tone}`}>{value}</div>
  </div>
);

const Modal: React.FC<{ title: string; onClose: () => void; children: React.ReactNode }> = ({ title, onClose, children }) => (
  <div className="fixed inset-0 z-[120] flex items-start justify-center overflow-y-auto bg-black/80 p-4 backdrop-blur-md md:items-center" onClick={onClose}>
    <div className="my-8 w-full max-w-lg rounded-[28px] border border-night-line bg-night-surface p-6 animate-scale-in" onClick={(e) => e.stopPropagation()}>
      <div className="mb-5 flex items-center justify-between">
        <h3 className="font-display text-lg font-bold text-white">{title}</h3>
        <button onClick={onClose} className="text-night-muted hover:text-white" aria-label="Mbyll">
          <Icon.Close />
        </button>
      </div>
      {children}
    </div>
  </div>
);

const EditModal: React.FC<{ event: AppEvent; onClose: () => void; onSave: (u: Partial<AppEvent>) => Promise<void> }> = ({ event, onClose, onSave }) => {
  const [e, setE] = useState({ ...event, gallery: event.gallery?.length ? event.gallery : event.image ? [event.image] : [] });
  const [saving, setSaving] = useState(false);
  const set = (k: keyof AppEvent, v: any) => setE((x) => ({ ...x, [k]: v }));
  return (
    <Modal title="✏️ Ndrysho eventin" onClose={onClose}>
      <div className="space-y-3">
        <input className="field" value={e.name} onChange={(x) => set('name', x.target.value)} placeholder="Emri" />
        <div className="grid grid-cols-2 gap-3">
          <input className="field" value={e.venue} onChange={(x) => set('venue', x.target.value)} placeholder="Lokali" />
          <select className="field" value={e.city} onChange={(x) => set('city', x.target.value)}>
            {CITIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <input type="date" className="field col-span-2" value={e.date} onChange={(x) => set('date', x.target.value)} />
          <input type="time" className="field" value={e.time || ''} onChange={(x) => set('time', x.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <select className="field" value={e.type} onChange={(x) => set('type', x.target.value)}>
            {CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.sq}
              </option>
            ))}
          </select>
          <input className="field" value={e.price} onChange={(x) => set('price', x.target.value)} placeholder="Çmimi" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <input className="field" value={e.phone} onChange={(x) => set('phone', x.target.value)} placeholder="Telefoni" />
          <input className="field" value={e.instagram || ''} onChange={(x) => set('instagram', x.target.value)} placeholder="Instagram" />
        </div>
        <input className="field" value={e.gallery[0] || ''} onChange={(x) => set('gallery', [x.target.value, ...e.gallery.slice(1)].filter(Boolean))} placeholder="URL e fotos kryesore (https://…)" />
        <textarea rows={4} className="field" value={e.description} onChange={(x) => set('description', x.target.value)} placeholder="Përshkrimi" />
        <div className="flex gap-2 pt-2">
          <button onClick={onClose} className="btn-ghost flex-1 !py-3">Anulo</button>
          <button
            disabled={saving}
            onClick={async () => {
              setSaving(true);
              await onSave({
                name: e.name,
                venue: e.venue,
                city: e.city,
                date: e.date,
                time: e.time,
                type: e.type,
                price: e.price,
                phone: e.phone,
                instagram: e.instagram,
                description: e.description,
                gallery: e.gallery,
                image: e.gallery[0] || e.image,
              });
              setSaving(false);
            }}
            className="btn-primary flex-1 !py-3"
          >
            {saving ? 'Duke ruajtur…' : 'Ruaj'}
          </button>
        </div>
      </div>
    </Modal>
  );
};

const PasswordModal: React.FC<{ onClose: () => void; onDone: () => void }> = ({ onClose, onDone }) => {
  const [cur, setCur] = useState('');
  const [next, setNext] = useState('');
  const [conf, setConf] = useState('');
  const [msg, setMsg] = useState('');
  const save = async () => {
    if (next.length < 12) return setMsg('Fjalëkalimi i ri duhet të ketë të paktën 12 karaktere.');
    if (next !== conf) return setMsg('Fjalëkalimet e reja nuk përputhen.');
    try {
      await admin.changePassword(cur, next);
      onDone();
    } catch (e) {
      setMsg((e as Error).message);
    }
  };
  return (
    <Modal title="🔑 Ndrysho fjalëkalimin" onClose={onClose}>
      <div className="space-y-3">
        <input type="password" autoComplete="current-password" className="field" placeholder="Fjalëkalimi aktual" value={cur} onChange={(e) => setCur(e.target.value)} />
        <input type="password" autoComplete="new-password" className="field" placeholder="I ri (min. 12 karaktere)" value={next} onChange={(e) => setNext(e.target.value)} />
        <input type="password" autoComplete="new-password" className="field" placeholder="Përsërit të riun" value={conf} onChange={(e) => setConf(e.target.value)} />
        {msg && <p className="text-sm text-red-400">{msg}</p>}
        <button onClick={save} className="btn-primary w-full !py-3">Ruaj</button>
      </div>
    </Modal>
  );
};
