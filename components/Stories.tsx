import React, { useEffect, useRef, useState } from 'react';
import type { AppEvent } from '../types';
import { useI18n, categoryIcon } from '../lib/i18n';
import { liveStatus, relativeLabel } from '../lib/dates';
import { db } from '../services/supabase';
import { FALLBACK_IMAGE, priceLabel } from './EventCard';
import { Icon, LiveBadge, useLockBody } from './ui';

const SEEN_KEY = 'kudalim_stories_seen';
const DURATION = 5500;

function loadSeen(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(SEEN_KEY) || '[]'));
  } catch {
    return new Set();
  }
}

interface BarProps {
  events: AppEvent[];
  title: string;
  onOpenEvent: (e: AppEvent) => void;
}

/** Instagram-style circles: one per event tonight. */
export const StoriesBar: React.FC<BarProps> = ({ events, title, onOpenEvent }) => {
  const [seen, setSeen] = useState(loadSeen);
  const [openAt, setOpenAt] = useState<number | null>(null);

  if (!events.length) return null;

  const markSeen = (id: string) =>
    setSeen((prev) => {
      if (prev.has(id)) return prev;
      const next = new Set(prev);
      next.add(id);
      try {
        localStorage.setItem(SEEN_KEY, JSON.stringify(Array.from(next).slice(-300)));
      } catch {}
      return next;
    });

  return (
    <div className="mx-auto max-w-6xl px-5 pt-6 md:px-8">
      <div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-night-muted">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-night-accent" />
        {title}
      </div>
      <div className="no-scrollbar -mx-5 flex gap-4 overflow-x-auto px-5 pb-2 md:mx-0 md:px-0">
        {events.map((e, i) => {
          const isSeen = seen.has(e.id);
          return (
            <button key={e.id} onClick={() => setOpenAt(i)} className="group flex w-[76px] shrink-0 flex-col items-center gap-2 animate-fade-in-up" style={{ animationDelay: `${i * 40}ms` }}>
              <span
                className={`rounded-full p-[3px] transition group-active:scale-95 ${
                  isSeen
                    ? 'bg-white/15'
                    : e.isPromoted
                      ? 'bg-gradient-to-tr from-night-gold via-amber-400 to-[#ff8a5b]'
                      : 'bg-gradient-to-tr from-night-accent via-[#ff8a5b] to-night-accent2'
                }`}
              >
                <span className="block rounded-full bg-night-bg p-[2px]">
                  <img src={e.image || FALLBACK_IMAGE} alt="" loading="lazy" className="h-[66px] w-[66px] rounded-full object-cover" />
                </span>
              </span>
              <span className={`w-full truncate text-center text-[11px] font-medium ${isSeen ? 'text-night-muted' : 'text-white'}`}>{e.venue}</span>
            </button>
          );
        })}
      </div>

      {openAt !== null && (
        <StoryViewer
          events={events}
          start={openAt}
          onSeen={markSeen}
          onClose={() => setOpenAt(null)}
          onOpenEvent={(e) => {
            setOpenAt(null);
            onOpenEvent(e);
          }}
        />
      )}
    </div>
  );
};

interface ViewerProps {
  events: AppEvent[];
  start: number;
  onClose: () => void;
  onSeen: (id: string) => void;
  onOpenEvent: (e: AppEvent) => void;
}

const StoryViewer: React.FC<ViewerProps> = ({ events, start, onClose, onSeen, onOpenEvent }) => {
  const { t, cat, lang } = useI18n();
  const [idx, setIdx] = useState(start);
  const [paused, setPaused] = useState(false);
  const elapsed = useRef(0);
  const last = useRef<number | null>(null);
  const [, force] = useState(0);
  const touch = useRef<{ x: number; y: number; t: number } | null>(null);
  useLockBody(true);

  const e = events[idx];
  const status = liveStatus(e.date, e.time, lang);

  useEffect(() => {
    onSeen(e.id);
    db.track(e.id, 'view');
    elapsed.current = 0;
    last.current = null;
    // Preload the next image
    const next = events[idx + 1];
    if (next?.image) new Image().src = next.image;
  }, [idx]);

  // Timer loop (pausable)
  useEffect(() => {
    let raf = 0;
    const loop = (now: number) => {
      if (!paused) {
        if (last.current !== null) elapsed.current += now - last.current;
        last.current = now;
        if (elapsed.current >= DURATION) {
          next();
          return;
        }
        force((n) => (n + 1) % 1000);
      } else last.current = null;
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [idx, paused]);

  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') onClose();
      if (ev.key === 'ArrowRight') next();
      if (ev.key === 'ArrowLeft') prev();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  function next() {
    if (idx < events.length - 1) setIdx(idx + 1);
    else onClose();
  }
  function prev() {
    if (idx > 0) setIdx(idx - 1);
    else elapsed.current = 0;
  }

  const progress = Math.min(1, elapsed.current / DURATION);

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black animate-scale-in" role="dialog" aria-modal="true" aria-label={e.name}>
      <div
        className="relative h-full w-full overflow-hidden md:h-[92vh] md:max-w-[440px] md:rounded-[28px]"
        onPointerDown={(ev) => {
          setPaused(true);
          touch.current = { x: ev.clientX, y: ev.clientY, t: Date.now() };
        }}
        onPointerUp={(ev) => {
          setPaused(false);
          const s = touch.current;
          touch.current = null;
          if (!s) return;
          const dx = ev.clientX - s.x;
          const dy = ev.clientY - s.y;
          if (dy > 90) return onClose(); // swipe down
          if (Math.abs(dx) > 60) return dx < 0 ? next() : prev(); // swipe
          if (Date.now() - s.t < 250) {
            const rect = (ev.currentTarget as HTMLElement).getBoundingClientRect();
            if (ev.clientX - rect.left < rect.width * 0.33) prev();
            else next();
          }
        }}
        onPointerCancel={() => setPaused(false)}
      >
        {/* blurred backdrop + main image with slow zoom */}
        <img src={e.image || FALLBACK_IMAGE} alt="" className="absolute inset-0 h-full w-full scale-110 object-cover opacity-60 blur-2xl" />
        <img
          key={e.id}
          src={e.image || FALLBACK_IMAGE}
          alt=""
          onError={(x) => ((x.currentTarget as HTMLImageElement).src = FALLBACK_IMAGE)}
          className="absolute inset-0 h-full w-full object-cover"
          style={{ animation: `kenburns ${DURATION}ms linear forwards`, animationPlayState: paused ? 'paused' : 'running' }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-transparent to-black/90" />

        {/* progress bars */}
        <div className="absolute inset-x-0 top-0 z-10 flex gap-1 p-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
          {events.map((_, i) => (
            <div key={i} className="h-[3px] flex-1 overflow-hidden rounded-full bg-white/25">
              <div className="h-full origin-left bg-white" style={{ transform: `scaleX(${i < idx ? 1 : i === idx ? progress : 0})` }} />
            </div>
          ))}
        </div>

        {/* header */}
        <div className="absolute inset-x-0 top-6 z-10 flex items-center gap-3 px-4 pt-[env(safe-area-inset-top)]">
          <img src={e.image || FALLBACK_IMAGE} alt="" className="h-9 w-9 rounded-full object-cover ring-2 ring-white/40" />
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-bold text-white">{e.venue}</div>
            <div className="text-xs text-white/70">
              {e.city} · {relativeLabel(e.date, lang)}
              {e.time ? ` · ${e.time}` : ''}
            </div>
          </div>
          <button
            onPointerDown={(x) => x.stopPropagation()}
            onPointerUp={(x) => x.stopPropagation()}
            onClick={onClose}
            aria-label="Close"
            className="flex h-10 w-10 items-center justify-center rounded-full text-white"
          >
            <Icon.Close />
          </button>
        </div>

        {/* content */}
        <div className="absolute inset-x-0 bottom-0 z-10 p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
          <div className="mb-3 flex flex-wrap gap-2">
            <LiveBadge status={status} />
            <span className="rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-semibold text-white backdrop-blur-md">
              {categoryIcon(e.type)} {cat(e.type)}
            </span>
            <span className="rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-bold text-white backdrop-blur-md">{priceLabel(e.price, t('card.free'))}</span>
          </div>
          <h2 className="font-display text-[34px] font-extrabold leading-[1.02] text-white [text-wrap:balance]">{e.name}</h2>
          {e.artists && <p className="mt-2 text-base font-semibold text-night-accent">🎤 {e.artists}</p>}
          <p className="mt-2 line-clamp-2 text-sm text-white/75">{e.description}</p>
          <div className="mt-5 flex gap-2" onPointerDown={(x) => x.stopPropagation()} onPointerUp={(x) => x.stopPropagation()}>
            <button onClick={() => onOpenEvent(e)} className="flex h-12 flex-1 items-center justify-center rounded-2xl bg-white font-bold text-night-bg active:scale-[0.98]">
              {t('stories.open')} ↑
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
