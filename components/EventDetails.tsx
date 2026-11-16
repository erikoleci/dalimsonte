import React, { useEffect, useRef, useState } from 'react';
import type { AppEvent } from '../types';
import { categoryIcon, useI18n } from '../lib/i18n';
import { buildICS, longDate, relativeLabel } from '../lib/dates';
import { db } from '../services/supabase';
import { FALLBACK_IMAGE, priceLabel } from './EventCard';
import { Icon, useLockBody } from './ui';

interface Props {
  event: AppEvent;
  saved: boolean;
  onClose: () => void;
  onToggleSave: (e: AppEvent) => void;
  notify: (msg: string, type?: 'success' | 'info' | 'warning') => void;
}

export function shareUrlFor(event: AppEvent) {
  return `${window.location.origin}/e/${encodeURIComponent(event.id)}`;
}

function whatsappNumber(phone: string) {
  let d = (phone || '').replace(/[^0-9]/g, '');
  if (d.startsWith('00')) d = d.slice(2);
  // Albanian local mobile format 06X XXX XXXX → 3556X XXX XXXX
  if (d.startsWith('0') && d.length === 10) d = '355' + d.slice(1);
  return d;
}

export const EventDetails: React.FC<Props> = ({ event, saved, onClose, onToggleSave, notify }) => {
  const { t, cat, lang } = useI18n();
  const photos = event.gallery && event.gallery.length > 0 ? event.gallery : [event.image || FALLBACK_IMAGE];
  const [idx, setIdx] = useState(0);
  const scroller = useRef<HTMLDivElement>(null);
  useLockBody(true);

  useEffect(() => {
    db.track(event.id, 'view');
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [event.id]);

  const goTo = (i: number) => {
    const el = scroller.current;
    if (!el) return;
    el.scrollTo({ left: i * el.clientWidth, behavior: 'smooth' });
  };

  const url = shareUrlFor(event);
  const reserveText = t('details.reserveMsg', { name: event.name, date: longDate(event.date, lang) });
  const waNumber = whatsappNumber(event.phone);
  const waUrl = `https://wa.me/${waNumber}?text=${encodeURIComponent(reserveText)}`;
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${event.venue}, ${event.city}, Albania`)}`;

  const share = async () => {
    const text = `${event.name} @ ${event.venue}, ${event.city} — ${relativeLabel(event.date, lang)}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: event.name, text, url });
        return;
      } catch (e: any) {
        if (e?.name === 'AbortError') return;
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      notify(t('details.copied'), 'success');
    } catch {
      window.open(`https://wa.me/?text=${encodeURIComponent(`${text}\n${url}`)}`, '_blank', 'noopener');
    }
  };

  const addToCalendar = () => {
    const ics = buildICS(event, url);
    const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${event.name.replace(/[^\p{L}\p{N}]+/gu, '-').slice(0, 40) || 'event'}.ics`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };

  return (
    <div className="fixed inset-0 z-[90] overflow-y-auto bg-night-bg animate-scale-in" role="dialog" aria-modal="true" aria-label={event.name}>
      {/* Gallery */}
      <div className="relative h-[58vh] min-h-[360px] w-full md:h-[64vh]">
        <div
          ref={scroller}
          onScroll={(e) => {
            const el = e.currentTarget;
            setIdx(Math.round(el.scrollLeft / el.clientWidth));
          }}
          className="no-scrollbar flex h-full w-full snap-x snap-mandatory overflow-x-auto"
        >
          {photos.map((src, i) => (
            <img
              key={i}
              src={src}
              alt={i === 0 ? event.name : ''}
              onError={(e) => ((e.currentTarget as HTMLImageElement).src = FALLBACK_IMAGE)}
              className="h-full w-full shrink-0 snap-center object-cover"
            />
          ))}
        </div>
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-night-bg via-night-bg/30 to-black/40" />

        <div className="absolute inset-x-0 top-0 flex items-center justify-between p-4 pt-[max(1rem,env(safe-area-inset-top))] md:p-6">
          <button onClick={onClose} aria-label={t('details.back')} className="flex h-11 w-11 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-md transition active:scale-90">
            <Icon.Back />
          </button>
          <div className="flex gap-2">
            <button onClick={share} aria-label={t('details.share')} className="flex h-11 w-11 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-md transition active:scale-90">
              <Icon.Share />
            </button>
            <button
              onClick={() => onToggleSave(event)}
              aria-pressed={saved}
              aria-label={t('nav.saved')}
              className={`flex h-11 w-11 items-center justify-center rounded-full backdrop-blur-md transition active:scale-90 ${saved ? 'bg-night-accent text-white' : 'bg-black/40 text-white'}`}
            >
              <Icon.Heart filled={saved} />
            </button>
          </div>
        </div>

        {photos.length > 1 && (
          <>
            <button onClick={() => goTo((idx - 1 + photos.length) % photos.length)} aria-label="‹" className="absolute left-3 top-1/2 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur md:flex">
              ‹
            </button>
            <button onClick={() => goTo((idx + 1) % photos.length)} aria-label="›" className="absolute right-3 top-1/2 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur md:flex">
              ›
            </button>
            <div className="absolute inset-x-0 bottom-36 flex justify-center gap-1.5 md:bottom-44">
              {photos.map((_, i) => (
                <span key={i} className={`h-1.5 rounded-full transition-all ${i === idx ? 'w-6 bg-white' : 'w-1.5 bg-white/40'}`} />
              ))}
            </div>
          </>
        )}

        <div className="absolute inset-x-0 bottom-0 mx-auto max-w-3xl px-5 pb-6 md:px-8">
          <div className="mb-3 flex flex-wrap gap-2">
            <span className="rounded-full bg-night-accent px-3 py-1 text-xs font-bold uppercase tracking-wide text-white">
              {relativeLabel(event.date, lang)}
            </span>
            <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-semibold text-white backdrop-blur">
              {categoryIcon(event.type)} {cat(event.type)}
            </span>
            {event.isPromoted && (
              <span className="rounded-full bg-gradient-to-r from-night-gold to-amber-500 px-3 py-1 text-xs font-extrabold uppercase text-black">
                ★ {t('card.premium')}
              </span>
            )}
          </div>
          <h1 className="font-display text-3xl font-bold leading-[1.05] text-white [text-wrap:balance] md:text-5xl">{event.name}</h1>
          <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex items-center gap-1.5 text-white/80 hover:text-white">
            <Icon.Pin /> {event.venue}, {event.city}
          </a>
        </div>
      </div>

      {/* Body */}
      <div className="mx-auto max-w-3xl px-5 pb-40 pt-4 md:px-8">
        <div className="grid grid-cols-3 gap-2.5">
          <InfoTile label={t('details.date')} value={longDate(event.date, lang)} />
          <InfoTile label={t('details.time')} value={event.time || t('details.timeDefault')} />
          <InfoTile label={t('details.price')} value={priceLabel(event.price, t('card.free'))} accent />
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2.5">
          <ActionBtn onClick={() => window.open(mapsUrl, '_blank', 'noopener')} icon={<Icon.Pin className="h-5 w-5" />} label={t('details.map')} />
          <ActionBtn onClick={addToCalendar} icon={<Icon.Calendar className="h-5 w-5" />} label={t('details.calendar')} />
          <ActionBtn onClick={share} icon={<Icon.Share />} label={t('details.share')} />
        </div>

        <section className="mt-8">
          <h2 className="label">{t('details.about')}</h2>
          <p className="whitespace-pre-wrap text-[17px] leading-relaxed text-white/85">{event.description}</p>
        </section>

        <section className="mt-8 flex flex-col gap-2.5 rounded-3xl border border-night-line bg-night-surface p-5">
          <div className="flex items-center justify-between">
            <span className="text-night-muted">{t('details.contact')}</span>
            <a href={`tel:${event.phone.replace(/\s/g, '')}`} onClick={() => db.track(event.id, 'click')} className="font-semibold text-white hover:text-night-accent">
              {event.phone}
            </a>
          </div>
          {event.instagram && (
            <div className="flex items-center justify-between">
              <span className="text-night-muted">Instagram</span>
              <a href={`https://instagram.com/${event.instagram}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 font-semibold text-white hover:text-night-accent">
                <Icon.Instagram className="h-4 w-4" /> @{event.instagram}
              </a>
            </div>
          )}
          <div className="flex items-center justify-between">
            <span className="text-night-muted">{t('details.age')}</span>
            <span className="font-semibold text-white">18+</span>
          </div>
        </section>
      </div>

      {/* Sticky reserve bar */}
      <div className="glass fixed inset-x-0 bottom-0 z-[95] border-x-0 border-b-0 px-4 pt-3 pb-safe">
        <div className="mx-auto flex max-w-3xl items-center gap-3">
          <a
            href={`tel:${event.phone.replace(/\s/g, '')}`}
            onClick={() => db.track(event.id, 'click')}
            aria-label={t('details.call')}
            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-night-line bg-white/[0.05] text-white transition active:scale-95"
          >
            <Icon.Phone />
          </a>
          <a
            href={waUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => db.track(event.id, 'click')}
            className="flex h-14 flex-1 items-center justify-center gap-2 rounded-2xl bg-[#25D366] text-base font-bold text-[#062b16] shadow-[0_10px_40px_-10px_rgba(37,211,102,.6)] transition hover:brightness-105 active:scale-[0.98]"
          >
            <Icon.WhatsApp /> {t('details.reserve')}
          </a>
        </div>
      </div>
    </div>
  );
};

const InfoTile = ({ label, value, accent }: { label: string; value: string; accent?: boolean }) => (
  <div className="rounded-2xl border border-night-line bg-night-surface px-3.5 py-3">
    <div className="text-[11px] font-semibold uppercase tracking-wider text-night-muted">{label}</div>
    <div className={`mt-1 text-sm font-bold leading-snug ${accent ? 'text-night-accent' : 'text-white'}`}>{value}</div>
  </div>
);

const ActionBtn = ({ onClick, icon, label }: { onClick: () => void; icon: React.ReactNode; label: string }) => (
  <button onClick={onClick} className="flex flex-col items-center gap-1.5 rounded-2xl border border-night-line bg-white/[0.03] px-2 py-3.5 text-xs font-semibold text-white/85 transition hover:bg-white/[0.07] active:scale-95">
    {icon}
    {label}
  </button>
);
