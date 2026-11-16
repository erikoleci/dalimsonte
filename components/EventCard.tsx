import React from 'react';
import type { AppEvent } from '../types';
import { categoryIcon, useI18n } from '../lib/i18n';
import { dateParts, tonightYMD, addDays } from '../lib/dates';
import { Icon } from './ui';

export const FALLBACK_IMAGE =
  'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&w=1000&q=70';

interface Props {
  event: AppEvent;
  saved: boolean;
  onOpen: (e: AppEvent) => void;
  onToggleSave: (e: AppEvent) => void;
  index?: number;
}

export function priceLabel(price: string, freeLabel: string) {
  const p = (price || '').trim();
  if (!p || /^(free|falas|0|0 ?(lek|all|€))$/i.test(p)) return freeLabel;
  return p;
}

export const EventCard: React.FC<Props> = ({ event, saved, onOpen, onToggleSave, index = 0 }) => {
  const { t, cat, lang } = useI18n();
  const tonight = tonightYMD();
  const isTonight = event.date === tonight;
  const isTomorrow = event.date === addDays(tonight, 1);
  const p = dateParts(event.date, lang);

  return (
    <article
      onClick={() => onOpen(event)}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), onOpen(event))}
      role="button"
      tabIndex={0}
      aria-label={`${event.name}, ${event.venue}`}
      style={{ animationDelay: `${Math.min(index, 8) * 45}ms` }}
      className={`group relative aspect-[4/5] cursor-pointer overflow-hidden rounded-[28px] bg-night-card animate-fade-in-up transition duration-300 hover:-translate-y-1 active:scale-[0.985] ${
        event.isPromoted ? 'shadow-gold ring-1 ring-night-gold/50' : 'ring-1 ring-white/[0.06] hover:ring-white/20'
      }`}
    >
      <img
        src={event.image || FALLBACK_IMAGE}
        alt=""
        loading={index < 3 ? 'eager' : 'lazy'}
        decoding="async"
        onError={(e) => ((e.currentTarget as HTMLImageElement).src = FALLBACK_IMAGE)}
        className="absolute inset-0 h-full w-full object-cover transition duration-[900ms] ease-out group-hover:scale-[1.06]"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-black/10" />

      {/* Date stub */}
      <div className="absolute left-3.5 top-3.5 flex items-center gap-2">
        {isTonight || isTomorrow ? (
          <span
            className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-extrabold uppercase tracking-wider ${
              isTonight ? 'bg-night-accent text-white' : 'bg-white text-night-bg'
            }`}
          >
            {isTonight && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />}
            {isTonight ? t('date.tonight') : t('date.tomorrow')}
          </span>
        ) : (
          <span className="flex flex-col items-center rounded-2xl bg-white px-2.5 py-1.5 leading-none text-night-bg">
            <span className="text-[10px] font-bold uppercase tracking-wider text-night-accent">{p.weekday}</span>
            <span className="font-display text-lg font-bold">{p.day}</span>
            <span className="text-[10px] font-semibold uppercase">{p.month}</span>
          </span>
        )}
        {event.isPromoted && (
          <span className="rounded-full bg-gradient-to-r from-night-gold to-amber-500 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wider text-black">
            ★ {t('card.premium')}
          </span>
        )}
      </div>

      <button
        onClick={(e) => {
          e.stopPropagation();
          onToggleSave(event);
        }}
        aria-label={t('nav.saved')}
        aria-pressed={saved}
        className={`absolute right-3.5 top-3.5 flex h-10 w-10 items-center justify-center rounded-full backdrop-blur-md transition active:scale-90 ${
          saved ? 'bg-night-accent text-white' : 'bg-black/35 text-white hover:bg-black/55'
        }`}
      >
        <Icon.Heart filled={saved} className="h-[18px] w-[18px]" />
      </button>

      {/* Bottom content */}
      <div className="absolute inset-x-0 bottom-0 p-5">
        <div className="mb-2.5 flex flex-wrap items-center gap-1.5">
          <span className="rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-semibold text-white backdrop-blur-md">
            {categoryIcon(event.type)} {cat(event.type)}
          </span>
          <span className="rounded-full bg-black/40 px-2.5 py-1 text-[11px] font-bold text-white backdrop-blur-md">
            {priceLabel(event.price, t('card.free'))}
          </span>
        </div>
        <h3 className="font-display text-[22px] font-bold leading-[1.1] text-white [text-wrap:balance] line-clamp-2">
          {event.name}
        </h3>
        {event.artists && <p className="mt-1.5 truncate text-[13px] font-semibold text-night-accent">🎤 {event.artists}</p>}
        <div className="mt-2 flex items-center gap-3 text-[13px] text-white/75">
          <span className="flex min-w-0 items-center gap-1">
            <Icon.Pin className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">
              {event.venue} · {event.city}
            </span>
          </span>
          {event.time && (
            <span className="flex shrink-0 items-center gap-1">
              <Icon.Clock className="h-3.5 w-3.5" />
              {event.time}
            </span>
          )}
        </div>
      </div>
    </article>
  );
};

export const EventCardSkeleton = () => <div className="skeleton aspect-[4/5] rounded-[28px]" />;
