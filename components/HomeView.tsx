import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { AppEvent, DateFilter } from '../types';
import { CATEGORIES, CITIES } from '../shared/constants.js';
import { useI18n } from '../lib/i18n';
import { dateRange, isSummerSeason, relativeLabel, tonightYMD } from '../lib/dates';
import { EventCard, EventCardSkeleton, FALLBACK_IMAGE as FALLBACK_IMG } from './EventCard';
import { Icon, useNow } from './ui';
import { StoriesBar } from './Stories';
import { normalize, splitArtists } from '../lib/text';

interface Props {
  events: AppEvent[];
  loading: boolean;
  savedIds: Set<string>;
  onOpen: (e: AppEvent) => void;
  onToggleSave: (e: AppEvent) => void;
  onPublish: () => void;
  subscriptions: Set<string>;
  onToggleSubscription: (city: string) => void;
  onOpenCollection: (kind: 'venue' | 'artist', name: string) => void;
}

const COASTAL = ['Sarandë', 'Ksamil', 'Dhërmi', 'Himarë', 'Vlorë', 'Durrës', 'Shëngjin'];



const ALL = '__all__';

function readPref(key: string, fallback: string) {
  try {
    return localStorage.getItem(key) || fallback;
  } catch {
    return fallback;
  }
}

function searchText(e: AppEvent) {
  return normalize(`${e.name} ${e.artists || ''} ${e.venue} ${e.city} ${e.instagram || ''} ${e.description}`);
}

function sortEvents(list: AppEvent[]) {
  return [...list].sort(
    (a, b) =>
      a.date.localeCompare(b.date) ||
      Number(!!b.isPromoted) - Number(!!a.isPromoted) ||
      (a.time || '22:00').localeCompare(b.time || '22:00')
  );
}

export const HomeView: React.FC<Props> = ({ events, loading, savedIds, onOpen, onToggleSave, onPublish, subscriptions, onToggleSubscription, onOpenCollection }) => {
  const { t, lang } = useI18n();
  useNow(30000); // keeps "Fillon për…" countdowns live
  const summer = isSummerSeason();
  const cityOptions = summer ? [...COASTAL, ...CITIES.filter((c) => !COASTAL.includes(c))] : CITIES;
  const [dateFilter, setDateFilter] = useState<DateFilter>('tonight');
  const [customDate, setCustomDate] = useState('');
  const [city, setCity] = useState(() => readPref('kudalim_city', ALL));
  const [vibe, setVibe] = useState(ALL);
  const [query, setQueryState] = useState(() => new URLSearchParams(window.location.search).get('q') || '');
  const [heroQuery, setHeroQuery] = useState('');
  const setQuery = (q: string) => {
    setQueryState(q);
    const url = new URL(window.location.href);
    if (q.trim()) url.searchParams.set('q', q.trim());
    else url.searchParams.delete('q');
    window.history.replaceState({}, '', url.toString());
  };
  const feedRef = useRef<HTMLDivElement>(null);
  const dateInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      localStorage.setItem('kudalim_city', city);
    } catch {}
  }, [city]);

  const tonight = tonightYMD();
  const tonightCount = events.filter((e) => e.date === tonight).length;

  const searching = normalize(query).length > 0;
  const indexed = useMemo(() => events.map((e) => [e, searchText(e)] as const), [events]);

  const filtered = useMemo(() => {
    // While searching, look across ALL upcoming dates — people search for an
    // artist without knowing which night they play.
    const range = searching ? null : dateRange(dateFilter, customDate);
    const terms = normalize(query).split(' ').filter(Boolean);
    return sortEvents(
      indexed
        .filter(([e, text]) => {
          if (range && (e.date < range[0] || e.date > range[1])) return false;
          if (!range && e.date < tonight) return false;
          if (city !== ALL && e.city !== city) return false;
          if (vibe !== ALL && e.type !== vibe) return false;
          if (terms.length && !terms.every((t) => text.includes(t))) return false;
          return true;
        })
        .map(([e]) => e)
    );
  }, [indexed, dateFilter, customDate, city, vibe, query, tonight, searching]);

  // When nothing matches, suggest what's coming next (same city first)
  const upcoming = useMemo(() => {
    if (filtered.length) return [];
    const future = sortEvents(events.filter((e) => e.date >= tonight));
    const sameCity = city !== ALL ? future.filter((e) => e.city === city) : [];
    return (sameCity.length ? sameCity : future).slice(0, 6);
  }, [filtered, events, city, tonight]);

  // Stories: tonight's events (Premium first); if none, what's coming next.
  const storyEvents = useMemo(() => {
    const pool = events.filter((e) => (city === ALL || e.city === city) && e.date >= tonight);
    const tonightList = pool.filter((e) => e.date === tonight);
    const list = tonightList.length ? tonightList : pool;
    return { list: sortEvents(list).slice(0, 15), isTonight: tonightList.length > 0 };
  }, [events, city, tonight]);

  const trending = useMemo(
    () =>
      events
        .filter((e) => e.date >= tonight && (e.views || 0) >= 5)
        .sort((a, b) => (b.views || 0) - (a.views || 0))
        .slice(0, 8),
    [events, tonight]
  );

  // While searching: suggest artist / venue pages that match
  const suggestions = useMemo(() => {
    const q = normalize(query);
    if (q.length < 2) return { artists: [] as string[], venues: [] as string[] };
    const artists = new Map<string, string>();
    const venues = new Map<string, string>();
    for (const e of events) {
      for (const a of splitArtists(e.artists)) if (normalize(a).includes(q)) artists.set(normalize(a), a);
      if (normalize(e.venue).includes(q)) venues.set(normalize(e.venue), e.venue);
    }
    return { artists: Array.from(artists.values()).slice(0, 6), venues: Array.from(venues.values()).slice(0, 6) };
  }, [events, query]);

  const groups = useMemo(() => {
    const m = new Map<string, AppEvent[]>();
    for (const e of filtered) m.set(e.date, [...(m.get(e.date) || []), e]);
    return Array.from(m.entries());
  }, [filtered]);

  const scrollToFeed = () => feedRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  // Opened from a shared search link (?q=...) → jump straight to the results
  useEffect(() => {
    if (query) setTimeout(() => feedRef.current?.scrollIntoView({ block: 'start' }), 50);
  }, []);

  const dateChips: { key: DateFilter; label: string }[] = [
    { key: 'tonight', label: t('date.tonight') },
    { key: 'tomorrow', label: t('date.tomorrow') },
    { key: 'weekend', label: t('date.weekend') },
    { key: 'week', label: t('date.week') },
    { key: 'all', label: t('date.all') },
  ];

  const subscribed = city !== ALL && subscriptions.has(city);
  let cardIndex = 0;

  return (
    <div>
      {/* ---------------- HERO ---------------- */}
      <section className="grain relative flex min-h-[78svh] items-end overflow-hidden pb-14 pt-28 md:min-h-[86svh] md:items-center md:pb-0">
        <div className="pointer-events-none absolute inset-0">
          <video
            autoPlay
            muted
            loop
            playsInline
            preload="metadata"
            poster="/video/hero-poster.jpg"
            className="absolute inset-0 h-full w-full scale-105 object-cover opacity-50"
            aria-hidden="true"
          >
            <source src="/video/hero-bg.mp4" type="video/mp4" />
          </video>
          <div className="absolute -left-32 top-10 h-[420px] w-[420px] rounded-full bg-night-accent/30 blur-[120px] animate-blob" />
          <div className="absolute -right-24 bottom-0 h-[380px] w-[380px] rounded-full bg-night-accent2/30 blur-[120px] animate-blob [animation-delay:-6s]" />
          <div className="absolute inset-0 bg-gradient-to-b from-night-bg/70 via-night-bg/30 to-night-bg" />
        </div>

        <div className="relative z-10 mx-auto w-full max-w-6xl px-5 md:px-8">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.06] px-3.5 py-1.5 text-xs font-semibold text-white/85 backdrop-blur animate-fade-in-up">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-night-live opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-night-live" />
            </span>
            {loading ? t('hero.badge') : `${tonightCount} ${t('hero.liveCount')} · ${CITIES.length} ${t('hero.cities')}`}
          </div>
          {summer && (
            <div className="mb-6 ml-2 inline-flex items-center rounded-full border border-amber-300/30 bg-amber-300/10 px-3.5 py-1.5 text-xs font-semibold text-amber-200 backdrop-blur animate-fade-in-up">
              {t('summer.badge')}
            </div>
          )}

          <h1 className="font-display text-[42px] font-extrabold leading-[0.98] tracking-tight text-white [text-wrap:balance] animate-fade-in-up sm:text-6xl md:text-[88px]">
            {t('hero.title1')}
            <br />
            <span className="bg-gradient-to-r from-night-accent via-[#ff8a5b] to-night-accent2 bg-clip-text text-transparent">{t('hero.title2')}</span>
          </h1>

          <p className="mt-6 max-w-xl text-base leading-relaxed text-white/70 animate-fade-in-up [animation-delay:80ms] md:text-lg">{t('hero.sub')}</p>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              setQuery(heroQuery);
              scrollToFeed();
            }}
            className="mt-7 flex max-w-xl items-center gap-2 rounded-2xl border border-white/15 bg-white/[0.07] p-1.5 pl-4 backdrop-blur-xl animate-fade-in-up [animation-delay:110ms] focus-within:border-night-accent/60"
            role="search"
          >
            <Icon.Search className="h-5 w-5 shrink-0 text-white/60" />
            <input
              value={heroQuery}
              onChange={(e) => setHeroQuery(e.target.value)}
              placeholder={t('hero.searchPh')}
              enterKeyHint="search"
              className="min-w-0 flex-1 bg-transparent py-2.5 text-base text-white placeholder:text-white/50 outline-none"
              aria-label={t('hero.searchPh')}
            />
            <button className="rounded-xl bg-white px-4 py-2.5 text-sm font-bold text-night-bg transition active:scale-95">{t('hero.search')}</button>
          </form>

          <div className="mt-4 flex flex-col gap-3 animate-fade-in-up [animation-delay:140ms] sm:flex-row">
            <button onClick={scrollToFeed} className="btn-primary text-lg">
              {t('hero.cta')} <span aria-hidden>↓</span>
            </button>
            <button onClick={onPublish} className="btn-ghost">
              <Icon.Plus /> {t('hero.organizer')}
            </button>
          </div>
        </div>
      </section>

      {/* ---------------- STORIES ---------------- */}
      {!loading && (
        <StoriesBar
          events={storyEvents.list}
          title={storyEvents.isTonight ? `${t('stories.title')}${city !== ALL ? ` · ${city}` : ''}` : t('stories.next')}
          onOpenEvent={onOpen}
        />
      )}

      {/* ---------------- FEED ---------------- */}
      <section ref={feedRef} className="relative scroll-mt-16">
        {/* Sticky filters */}
        <div className="sticky top-16 z-30 border-b border-night-line bg-night-bg/85 backdrop-blur-xl">
          <div className="mx-auto max-w-6xl space-y-2.5 px-5 py-3 md:px-8">
            <div className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5 md:mx-0 md:px-0">
              {dateChips.map((c) => (
                <button key={c.key} onClick={() => { setDateFilter(c.key); if (searching) setQuery(''); }} className={`chip ${dateFilter === c.key && !searching ? 'chip-active' : ''}`}>
                  {c.key === 'tonight' && dateFilter !== 'tonight' && <span className="h-1.5 w-1.5 rounded-full bg-night-accent" />}
                  {c.label}
                </button>
              ))}
              <button
                onClick={() => (dateInput.current as any)?.showPicker?.() ?? dateInput.current?.click()}
                className={`chip relative ${dateFilter === 'custom' ? 'chip-active' : ''}`}
              >
                <Icon.Calendar />
                {dateFilter === 'custom' && customDate ? relativeLabel(customDate, lang) : t('date.pick')}
                <input
                  ref={dateInput}
                  type="date"
                  min={tonight}
                  value={customDate}
                  onChange={(e) => {
                    setCustomDate(e.target.value);
                    setDateFilter(e.target.value ? 'custom' : 'tonight');
                  }}
                  className="absolute inset-0 cursor-pointer opacity-0"
                  aria-label={t('date.pick')}
                />
              </button>
            </div>

            <div className="flex gap-2">
              <div className="relative">
                <select
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="chip h-full appearance-none pr-9 text-white"
                  aria-label={t('venue.city')}
                >
                  <option value={ALL}>📍 {t('city.all')}</option>
                  {cityOptions.map((c) => (
                    <option key={c} value={c}>
                      {summer && COASTAL.includes(c) ? '☀️' : '📍'} {c}
                    </option>
                  ))}
                </select>
                <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-xs text-night-muted">▾</span>
              </div>
              <label className="relative flex-1">
                <Icon.Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-night-muted" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={t('feed.search')}
                  type="search"
                  enterKeyHint="search"
                  className="h-full w-full rounded-full border border-night-line bg-white/[0.04] py-2 pl-10 pr-9 text-sm text-white placeholder:text-night-muted/70 outline-none focus:border-night-accent/60 [&::-webkit-search-cancel-button]:hidden"
                />
                {query && (
                  <button type="button" onClick={() => setQuery('')} aria-label={t('feed.clear')} className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-full p-1 text-night-muted hover:text-white">
                    <Icon.Close className="h-4 w-4" />
                  </button>
                )}
              </label>
            </div>

            <div className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5 md:mx-0 md:flex-wrap md:px-0">
              <button onClick={() => setVibe(ALL)} className={`chip !py-1.5 text-[13px] ${vibe === ALL ? 'chip-active' : ''}`}>
                {t('vibe.all')}
              </button>
              {CATEGORIES.map((c) => (
                <button key={c.value} onClick={() => setVibe(vibe === c.value ? ALL : c.value)} className={`chip !py-1.5 text-[13px] ${vibe === c.value ? 'chip-active' : ''}`}>
                  {c.icon} {c[lang]}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="mx-auto min-h-[60vh] max-w-6xl px-5 pb-24 pt-8 md:px-8">
          <div className="mb-6 flex items-end justify-between gap-4">
            <div>
              <h2 className="font-display text-2xl font-bold text-white md:text-3xl">
                {searching
                  ? `${t('feed.searchTitle')} “${query.trim()}”`
                  : dateFilter === 'all'
                  ? t('feed.allTitle')
                  : dateFilter === 'custom' && customDate
                    ? `${t('feed.title')} · ${relativeLabel(customDate, lang)}`
                    : `${t('feed.title')} ${(dateChips.find((c) => c.key === dateFilter)?.label || '').toLowerCase()}`}
                {city !== ALL && <span className="text-night-accent"> · {city}</span>}
              </h2>
              {!loading && (
                <p className="mt-1 text-sm text-night-muted">
                  {filtered.length} {filtered.length === 1 ? t('feed.result') : t('feed.results')}
                  {searching && ` · ${t('feed.searchAllDates').toLowerCase()}`}
                </p>
              )}
            </div>
            {city !== ALL && (
              <button
                onClick={() => onToggleSubscription(city)}
                className={`chip ${subscribed ? 'border-night-accent/50 bg-night-accent/10 text-night-accent' : ''}`}
              >
                <Icon.Bell /> <span className="hidden sm:inline">{subscribed ? t('feed.notifyOn') : t('feed.notify')}</span>
              </button>
            )}
          </div>

          {searching && (suggestions.artists.length > 0 || suggestions.venues.length > 0) && (
            <div className="mb-8 flex flex-wrap items-center gap-2">
              {suggestions.artists.map((a) => (
                <button key={`a-${a}`} onClick={() => onOpenCollection('artist', a)} className="chip border-night-accent/40 text-white">
                  🎤 {a} <span className="text-night-muted">→</span>
                </button>
              ))}
              {suggestions.venues.map((v) => (
                <button key={`v-${v}`} onClick={() => onOpenCollection('venue', v)} className="chip text-white">
                  📍 {v} <span className="text-night-muted">→</span>
                </button>
              ))}
            </div>
          )}

          {loading ? (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <EventCardSkeleton key={i} />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div>
              <div className="rounded-[28px] border border-dashed border-night-line bg-night-surface/60 px-6 py-14 text-center">
                <div className="mb-4 text-5xl">🌙</div>
                <h3 className="font-display text-xl font-bold text-white">{t('feed.empty.title')}</h3>
                <p className="mx-auto mt-2 max-w-sm text-night-muted">{t('feed.empty.sub')}</p>
                <div className="mt-6 flex flex-wrap justify-center gap-2">
                  <button
                    onClick={() => {
                      setDateFilter('all');
                      setVibe(ALL);
                      setQuery('');
                    }}
                    className="chip chip-active"
                  >
                    {t('feed.empty.reset')}
                  </button>
                  <button onClick={onPublish} className="chip">
                    <Icon.Plus /> {t('nav.publish')}
                  </button>
                </div>
              </div>
              {upcoming.length > 0 && (
                <div className="mt-12">
                  <h3 className="mb-5 font-display text-xl font-bold text-white">{t('feed.empty.next')}</h3>
                  <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                    {upcoming.map((e, i) => (
                      <EventCard key={e.id} event={e} index={i} saved={savedIds.has(e.id)} onOpen={onOpen} onToggleSave={onToggleSave} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-12">
              {groups.map(([date, list]) => (
                <div key={date}>
                  {groups.length > 1 && (
                    <h3 className="mb-4 flex items-center gap-3 text-sm font-bold uppercase tracking-[0.14em] text-night-muted">
                      {relativeLabel(date, lang)}
                      <span className="h-px flex-1 bg-night-line" />
                    </h3>
                  )}
                  <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                    {list.map((e) => (
                      <EventCard key={e.id} event={e} index={cardIndex++} saved={savedIds.has(e.id)} onOpen={onOpen} onToggleSave={onToggleSave} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {!searching && !loading && trending.length > 2 && (
            <div className="mt-16">
              <h3 className="mb-5 font-display text-xl font-bold text-white">🔥 {t('trending.title')}</h3>
              <div className="no-scrollbar -mx-5 flex snap-x gap-4 overflow-x-auto px-5 pb-2 md:mx-0 md:px-0">
                {trending.map((e, i) => (
                  <button key={e.id} onClick={() => onOpen(e)} className="group relative aspect-[3/4] w-[200px] shrink-0 snap-start overflow-hidden rounded-3xl text-left ring-1 ring-white/10">
                    <img src={e.image || FALLBACK_IMG} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover transition duration-700 group-hover:scale-105" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black via-black/30 to-transparent" />
                    <span className="absolute left-3 top-3 font-display text-4xl font-extrabold text-white/90 drop-shadow-lg">{i + 1}</span>
                    <div className="absolute inset-x-0 bottom-0 p-3.5">
                      <div className="line-clamp-2 font-display text-base font-bold leading-tight text-white">{e.name}</div>
                      <div className="mt-1 truncate text-xs text-white/70">
                        {e.venue} · {relativeLabel(e.date, lang)}
                      </div>
                      <div className="mt-1.5 text-[11px] font-bold text-night-accent">
                        🔥 {e.views} {t('trending.views')}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
};
