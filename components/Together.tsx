// "Shkojmë bashkë": build a 2–3 event vote and the page where friends vote.
import React, { useEffect, useMemo, useState } from 'react';
import type { AppEvent, PollData } from '../types';
import { useI18n } from '../lib/i18n';
import { relativeLabel, tonightYMD } from '../lib/dates';
import { normalize } from '../lib/text';
import { polls } from '../services/supabase';
import { FALLBACK_IMAGE, priceLabel } from './EventCard';
import { burstConfetti, Icon, useLockBody } from './ui';

const pollUrl = (id: string) => `${window.location.origin}/v/${id}`;

// ---------------------------------------------------------------------------
// Builder (bottom sheet)
// ---------------------------------------------------------------------------
interface BuilderProps {
  seed: AppEvent;
  events: AppEvent[];
  onClose: () => void;
  onOpenPoll: (id: string) => void;
  notify: (m: string, t?: 'success' | 'info' | 'warning') => void;
}

export const TogetherBuilder: React.FC<BuilderProps> = ({ seed, events, onClose, onOpenPoll, notify }) => {
  const { t, lang } = useI18n();
  const [picked, setPicked] = useState<string[]>([seed.id]);
  const [title, setTitle] = useState('');
  const [q, setQ] = useState('');
  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState<string | null>(null);
  const [error, setError] = useState('');
  useLockBody(true);

  const candidates = useMemo(() => {
    const today = tonightYMD();
    const nq = normalize(q);
    return events
      .filter((e) => e.id !== seed.id && e.date >= today)
      .filter((e) => !nq || normalize(`${e.name} ${e.venue} ${e.artists || ''} ${e.city}`).includes(nq))
      .sort(
        (a, b) =>
          Number(b.date === seed.date) - Number(a.date === seed.date) ||
          Number(b.city === seed.city) - Number(a.city === seed.city) ||
          a.date.localeCompare(b.date)
      )
      .slice(0, 30);
  }, [events, seed, q]);

  const toggle = (id: string) =>
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : p.length >= 3 ? p : [...p, id]));

  const create = async () => {
    if (picked.length < 2) return setError(t('together.need'));
    setCreating(true);
    setError('');
    try {
      const { id } = await polls.create(picked, title.trim() || undefined);
      setCreated(id);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setCreating(false);
    }
  };

  const waText = created ? `${title.trim() ? `🗳️ ${title.trim()}` : t('together.waText')}\n${pollUrl(created)}` : '';

  return (
    <div className="fixed inset-0 z-[160] flex items-end justify-center bg-black/70 backdrop-blur-sm md:items-center" onClick={onClose}>
      <div
        className="flex max-h-[92svh] w-full max-w-lg flex-col overflow-hidden rounded-t-[28px] border border-night-line bg-night-surface animate-slide-up md:rounded-[28px]"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={t('together.title')}
      >
        <div className="flex items-start justify-between gap-4 p-5 pb-3">
          <div>
            <h2 className="font-display text-xl font-bold text-white">{t('together.title')}</h2>
            <p className="mt-1 text-sm text-night-muted">{t('together.sub')}</p>
          </div>
          <button onClick={onClose} className="text-night-muted hover:text-white" aria-label="Close">
            <Icon.Close />
          </button>
        </div>

        {created ? (
          <div className="p-5 pt-2 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-night-live/15 text-3xl">🗳️</div>
            <p className="break-all rounded-2xl border border-night-line bg-black/30 px-4 py-3 font-mono text-sm text-white">{pollUrl(created)}</p>
            <a
              href={`https://wa.me/?text=${encodeURIComponent(waText)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 flex h-14 items-center justify-center gap-2 rounded-2xl bg-[#25D366] font-bold text-[#062b16]"
            >
              <Icon.WhatsApp /> WhatsApp
            </a>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <button
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(waText);
                    notify(t('poll.copied'));
                  } catch {}
                }}
                className="btn-ghost !py-3"
              >
                📋 Copy
              </button>
              <button onClick={() => onOpenPoll(created)} className="btn-ghost !py-3">
                {t('poll.open')} →
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="px-5">
              <input className="field" maxLength={60} value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t('together.questionPh')} aria-label={t('together.question')} />
              <div className="mt-4 flex items-center justify-between">
                <span className="label !mb-0">{t('together.pick')}</span>
                <span className="text-xs font-bold text-night-muted">{picked.length}/3</span>
              </div>
              <div className="relative mt-2">
                <Icon.Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-night-muted" />
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('feed.search')} className="w-full rounded-full border border-night-line bg-white/[0.04] py-2.5 pl-10 pr-4 text-sm text-white outline-none focus:border-night-accent/60" />
              </div>
            </div>

            <div className="mt-3 flex-1 space-y-2 overflow-y-auto px-5 pb-3">
              {[seed, ...candidates].map((e) => {
                const on = picked.includes(e.id);
                const locked = e.id === seed.id;
                return (
                  <button
                    key={e.id}
                    disabled={locked || (!on && picked.length >= 3)}
                    onClick={() => toggle(e.id)}
                    className={`flex w-full items-center gap-3 rounded-2xl border p-2.5 text-left transition disabled:cursor-default ${
                      on ? 'border-night-accent/60 bg-night-accent/10' : 'border-night-line bg-white/[0.02] hover:bg-white/[0.05] disabled:opacity-40'
                    }`}
                  >
                    <img src={e.image || FALLBACK_IMAGE} alt="" className="h-14 w-12 shrink-0 rounded-xl object-cover" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold text-white">{e.name}</span>
                      <span className="block truncate text-xs text-night-muted">
                        {e.venue} · {e.city} · {relativeLabel(e.date, lang)}
                      </span>
                    </span>
                    <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs font-bold ${on ? 'border-night-accent bg-night-accent text-white' : 'border-white/25'}`}>
                      {on ? picked.indexOf(e.id) + 1 : ''}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="border-t border-night-line p-5 pb-safe">
              {error && <p className="mb-2 text-sm text-red-400">{error}</p>}
              <button onClick={create} disabled={creating || picked.length < 2} className="btn-primary w-full">
                {creating ? t('together.creating') : `🗳️ ${t('together.create')}`}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Vote page (#/bashke/<id>)
// ---------------------------------------------------------------------------
interface PollPageProps {
  id: string;
  onOpenEvent: (e: AppEvent) => void;
  onHome: () => void;
  notify: (m: string, t?: 'success' | 'info' | 'warning') => void;
}

export const PollPage: React.FC<PollPageProps> = ({ id, onOpenEvent, onHome, notify }) => {
  const { t, lang } = useI18n();
  const [data, setData] = useState<PollData | null>(null);
  const [error, setError] = useState('');
  const [name, setName] = useState(() => {
    try {
      return localStorage.getItem('kudalim_name') || '';
    } catch {
      return '';
    }
  });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    const load = () =>
      polls
        .get(id)
        .then((d) => alive && setData(d))
        .catch((e) => alive && setError(e.message));
    load();
    const iv = setInterval(() => document.visibilityState === 'visible' && load(), 15000);
    return () => {
      alive = false;
      clearInterval(iv);
    };
  }, [id]);

  const vote = async (eventId: string, ev: React.MouseEvent) => {
    if (busy || !data) return;
    try {
      localStorage.setItem('kudalim_name', name.trim());
    } catch {}
    const firstVote = !data.mine;
    // optimistic
    const prev = data;
    const results = JSON.parse(JSON.stringify(data.results));
    if (data.mine && results[data.mine]) results[data.mine].count--;
    results[eventId].count++;
    setData({ ...data, results, mine: eventId, total: data.total + (firstVote ? 1 : 0) });
    if (firstVote) burstConfetti(ev.clientX, ev.clientY);
    setBusy(true);
    try {
      setData(await polls.vote(id, eventId, name.trim() || undefined));
    } catch (e) {
      setData(prev);
      notify((e as Error).message, 'warning');
    } finally {
      setBusy(false);
    }
  };

  const share = async () => {
    const url = pollUrl(id);
    const text = `${data?.poll.title ? `🗳️ ${data.poll.title}` : t('together.waText')}\n${url}`;
    if (navigator.share) {
      try {
        await navigator.share({ text, url });
        return;
      } catch (e: any) {
        if (e?.name === 'AbortError') return;
      }
    }
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
  };

  if (error) {
    return (
      <div className="mx-auto max-w-md px-5 pt-32 text-center">
        <div className="mb-4 text-5xl">🗳️</div>
        <p className="text-night-muted">{t('poll.notFound')}</p>
        <button onClick={onHome} className="chip chip-active mt-6">
          {t('saved.browse')}
        </button>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="mx-auto max-w-lg space-y-3 px-5 pt-28">
        <div className="skeleton h-10 w-2/3 rounded-xl" />
        {[0, 1, 2].map((i) => (
          <div key={i} className="skeleton h-28 rounded-3xl" />
        ))}
      </div>
    );
  }

  const max = Math.max(0, ...Object.values(data.results).map((r) => r.count));

  return (
    <div className="mx-auto max-w-lg px-5 pb-24 pt-24 animate-fade-in-up">
      <div className="mb-1 text-xs font-bold uppercase tracking-[0.16em] text-night-accent">🗳️ {t('together.btn')}</div>
      <h1 className="font-display text-3xl font-extrabold leading-tight text-white [text-wrap:balance]">{data.poll.title || t('poll.default')}</h1>
      <p className="mt-2 text-sm text-night-muted">
        {data.total} {data.total === 1 ? t('poll.vote1') : t('poll.votes')} · {t('poll.tap')}
      </p>

      <input
        className="field mt-5"
        maxLength={20}
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder={t('poll.yourName')}
        aria-label={t('poll.yourName')}
      />

      <div className="mt-5 space-y-3">
        {data.events.map((e) => {
          const r = data.results[e.id] || { count: 0, names: [] };
          const pct = data.total ? Math.round((r.count / data.total) * 100) : 0;
          const mine = data.mine === e.id;
          const leading = r.count > 0 && r.count === max;
          return (
            <div
              key={e.id}
              className={`relative overflow-hidden rounded-3xl border transition ${mine ? 'border-night-accent shadow-glow' : 'border-night-line'} bg-night-surface`}
            >
              {/* result bar */}
              <div
                className={`absolute inset-y-0 left-0 transition-all duration-700 ${mine ? 'bg-night-accent/20' : 'bg-white/[0.05]'}`}
                style={{ width: `${data.mine ? pct : 0}%` }}
              />
              <button onClick={(ev) => vote(e.id, ev)} className="relative flex w-full items-center gap-3 p-3 text-left active:scale-[0.99]">
                <img src={e.image || FALLBACK_IMAGE} alt="" className="h-20 w-16 shrink-0 rounded-2xl object-cover" />
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-1.5">
                    {leading && data.mine && <span className="rounded-full bg-night-gold px-2 py-0.5 text-[10px] font-extrabold uppercase text-black">👑 {t('poll.leading')}</span>}
                    {mine && <span className="rounded-full bg-night-accent px-2 py-0.5 text-[10px] font-extrabold uppercase text-white">✓ {t('poll.yourVote')}</span>}
                  </span>
                  <span className="mt-1 block truncate font-display text-lg font-bold text-white">{e.name}</span>
                  <span className="block truncate text-xs text-night-muted">
                    {e.venue} · {relativeLabel(e.date, lang)}
                    {e.time ? ` · ${e.time}` : ''} · {priceLabel(e.price, t('card.free'))}
                  </span>
                  {data.mine && r.names.length > 0 && <span className="mt-1 block truncate text-xs text-white/70">{r.names.join(', ')}</span>}
                </span>
                {data.mine && <span className="shrink-0 font-display text-xl font-bold text-white">{pct}%</span>}
              </button>
              <button onClick={() => onOpenEvent(e)} className="relative w-full border-t border-night-line px-4 py-2 text-left text-xs font-semibold text-night-muted hover:text-white">
                {t('poll.open')} {e.name} →
              </button>
            </div>
          );
        })}
      </div>

      <button onClick={share} className="btn-primary mt-6 w-full">
        <Icon.WhatsApp /> {t('poll.share')}
      </button>
      <button onClick={onHome} className="mt-3 w-full text-sm text-night-muted hover:text-white">
        {t('poll.new')} →
      </button>
    </div>
  );
};
