// Venue profile (#/lokali/<name>) and artist page (#/artist/<name>).
import React, { useEffect, useMemo, useState } from 'react';
import type { AppEvent } from '../types';
import { useI18n } from '../lib/i18n';
import { tonightYMD } from '../lib/dates';
import { normalize, splitArtists } from '../lib/text';
import { posterColor } from '../lib/visuals';
import { EventCard, FALLBACK_IMAGE } from './EventCard';
import { Icon } from './ui';

interface Props {
  kind: 'venue' | 'artist';
  name: string;
  events: AppEvent[];
  savedIds: Set<string>;
  onOpen: (e: AppEvent) => void;
  onToggleSave: (e: AppEvent) => void;
  onBack: () => void;
  notify: (m: string, t?: 'success' | 'info' | 'warning') => void;
}

export const CollectionPage: React.FC<Props> = ({ kind, name, events, savedIds, onOpen, onToggleSave, onBack, notify }) => {
  const { t } = useI18n();
  const key = normalize(name);
  const tonight = tonightYMD();

  const list = useMemo(
    () =>
      events
        .filter((e) => e.date >= tonight)
        .filter((e) => (kind === 'venue' ? normalize(e.venue) === key : splitArtists(e.artists).some((a) => normalize(a) === key)))
        .sort((a, b) => a.date.localeCompare(b.date) || (a.time || '22:00').localeCompare(b.time || '22:00')),
    [events, kind, key, tonight]
  );

  // Use the nicest casing we can find in the data
  const displayName = useMemo(() => {
    for (const e of events) {
      if (kind === 'venue' && normalize(e.venue) === key) return e.venue;
      if (kind === 'artist') for (const a of splitArtists(e.artists)) if (normalize(a) === key) return a;
    }
    return name;
  }, [events, kind, key, name]);

  const cover = list[0]?.image || events.find((e) => (kind === 'venue' ? normalize(e.venue) === key : false))?.image || FALLBACK_IMAGE;
  const instagram = kind === 'venue' ? list.find((e) => e.instagram)?.instagram : undefined;
  const cities = Array.from(new Set(list.map((e) => e.city)));
  const [accent, setAccent] = useState('255, 61, 127');

  useEffect(() => {
    posterColor(cover).then(setAccent);
    document.title = `${displayName} — Ku Dalim Sonte?`;
    return () => {
      document.title = 'Ku Dalim Sonte? — Evente, festa dhe koncerte sonte në Shqipëri';
    };
  }, [cover, displayName]);

  const share = async () => {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({ title: displayName, url });
        return;
      } catch (e: any) {
        if (e?.name === 'AbortError') return;
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      notify(t('details.copied'));
    } catch {}
  };

  return (
    <div className="min-h-[100svh]">
      <div className="relative overflow-hidden pb-10 pt-24">
        <img src={cover} alt="" className="absolute inset-0 h-full w-full scale-110 object-cover opacity-40 blur-2xl" />
        <div className="absolute inset-0 bg-gradient-to-b from-night-bg/40 via-night-bg/70 to-night-bg" />
        <div className="absolute inset-0" style={{ background: `radial-gradient(80% 60% at 20% 30%, rgba(${accent}, .25), transparent 70%)` }} />

        <div className="relative mx-auto max-w-6xl px-5 md:px-8">
          <button onClick={onBack} className="mb-6 flex items-center gap-1 text-sm text-white/70 hover:text-white">
            <Icon.Back className="h-4 w-4" /> {t('details.back')}
          </button>
          <div className="flex flex-col gap-6 md:flex-row md:items-end">
            <div className="w-fit self-start rounded-full p-[3px] md:self-auto" style={{ background: `linear-gradient(135deg, rgb(${accent}), #7c5cff)` }}>
              <img src={cover} alt="" className="h-28 w-28 rounded-full border-4 border-night-bg object-cover md:h-36 md:w-36" />
            </div>
            <div className="flex-1">
              <div className="text-xs font-bold uppercase tracking-[0.16em]" style={{ color: `rgb(${accent})` }}>
                {kind === 'venue' ? `📍 ${t('col.venue')}` : `🎤 ${t('col.artist')}`}
              </div>
              <h1 className="mt-1 font-display text-4xl font-extrabold leading-none text-white [text-wrap:balance] md:text-6xl">{displayName}</h1>
              <p className="mt-3 text-night-muted">
                <span className="font-bold text-white">{list.length}</span> {list.length === 1 ? t('col.upcoming1') : t('col.upcoming')}
                {cities.length > 0 && ` · ${cities.join(', ')}`}
              </p>
            </div>
            <div className="flex gap-2">
              {instagram && (
                <a href={`https://instagram.com/${instagram}`} target="_blank" rel="noopener noreferrer" className="chip chip-active">
                  <Icon.Instagram className="h-4 w-4" /> {t('col.follow')}
                </a>
              )}
              <button onClick={share} className="chip">
                <Icon.Share className="h-4 w-4" /> {t('col.share')}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-5 pb-24 md:px-8">
        {list.length === 0 ? (
          <div className="rounded-[28px] border border-dashed border-night-line px-6 py-16 text-center text-night-muted">🌙 {t('col.empty')}</div>
        ) : (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {list.map((e, i) => (
              <EventCard key={e.id} event={e} index={i} saved={savedIds.has(e.id)} onOpen={onOpen} onToggleSave={onToggleSave} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
