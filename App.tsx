import React, { Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react';
import type { AppEvent, AppNotification } from './types';
import { db, readCachedEvents } from './services/supabase';
import { I18nProvider, useI18n } from './lib/i18n';
import { addDays, tonightYMD } from './lib/dates';
import { Navbar, Footer } from './components/Navbar';
import { HomeView } from './components/HomeView';
import { EventCard } from './components/EventCard';
// Loaded on demand: most visitors never open the form or the admin panel.
const EventDetails = lazy(() => import('./components/EventDetails').then((m) => ({ default: m.EventDetails })));
const VenueForm = lazy(() => import('./components/VenueForm').then((m) => ({ default: m.VenueForm })));
const TogetherBuilder = lazy(() => import('./components/Together').then((m) => ({ default: m.TogetherBuilder })));
const PollPage = lazy(() => import('./components/Together').then((m) => ({ default: m.PollPage })));
const CollectionPage = lazy(() => import('./components/CollectionPage').then((m) => ({ default: m.CollectionPage })));
const AdminPanel = lazy(() => import('./components/AdminPanel').then((m) => ({ default: m.AdminPanel })));
const EventChatWidget = lazy(() => import('./components/EventChatWidget').then((m) => ({ default: m.EventChatWidget })));
import { ErrorBoundary, Icon, Toasts } from './components/ui';

type View = 'home' | 'saved' | 'venue' | 'admin' | 'collection' | 'poll';
type Collection = { kind: 'venue' | 'artist'; name: string } | null;

// Simple hash routing: #/te-ruajturat, #/publiko, #/admin, #/lokali/<emri>, #/artist/<emri>
function routeFromHash(): { view: View; collection: Collection; pollId?: string } {
  const h = window.location.hash.replace(/^#\/?/, '');
  const pm = /^bashke\/([A-Za-z0-9_-]{6,16})$/.exec(h);
  if (pm) return { view: 'poll', collection: null, pollId: pm[1] };
  const m = /^(lokali|artist)\/(.+)$/.exec(h);
  if (m) {
    let name = m[2];
    try {
      name = decodeURIComponent(name);
    } catch {}
    return { view: 'collection', collection: { kind: m[1] === 'lokali' ? 'venue' : 'artist', name } };
  }
  if (h === 'saved' || h === 'te-ruajturat') return { view: 'saved', collection: null };
  if (h === 'publiko' || h === 'publish') return { view: 'venue', collection: null };
  if (h === 'admin') return { view: 'admin', collection: null };
  return { view: 'home', collection: null };
}
const HASH: Record<Exclude<View, 'collection' | 'poll'>, string> = { home: '', saved: '#/te-ruajturat', venue: '#/publiko', admin: '#/admin' };

function loadSet(key: string): Set<string> {
  try {
    const raw = localStorage.getItem(key);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}
function saveSet(key: string, s: Set<string>) {
  try {
    localStorage.setItem(key, JSON.stringify(Array.from(s)));
  } catch {}
}

function AppInner() {
  const { t } = useI18n();
  const [view, setViewState] = useState<View>(() => routeFromHash().view);
  const [collection, setCollection] = useState<Collection>(() => routeFromHash().collection);
  const [pollId, setPollId] = useState<string | undefined>(() => routeFromHash().pollId);
  const [togetherSeed, setTogetherSeed] = useState<AppEvent | null>(null);
  const [goingIds, setGoingIds] = useState<Set<string>>(() => loadSet('kudalim_going'));
  const [cached] = useState(() => readCachedEvents());
  const [events, setEvents] = useState<AppEvent[]>(() => cached || []);
  const [loading, setLoading] = useState(!cached);
  const [loadError, setLoadError] = useState(false);
  const [selected, setSelected] = useState<AppEvent | null>(null);
  const [savedIds, setSavedIds] = useState<Set<string>>(() => loadSet('kudalim_favorites'));
  const [subscriptions, setSubscriptions] = useState<Set<string>>(() => loadSet('kudalim_subscriptions'));
  const [toasts, setToasts] = useState<AppNotification[]>([]);
  const [installPrompt, setInstallPrompt] = useState<any>(null);
  const firstLoad = useRef(true);

  const notify = useCallback((message: string, type: AppNotification['type'] = 'success') => {
    const id = crypto.randomUUID();
    setToasts((prev) => [...prev.slice(-2), { id, message, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((n) => n.id !== id)), 3500);
  }, []);

  const setView = (v: Exclude<View, 'collection' | 'poll'>) => {
    setSelected(null);
    setViewState(v);
    setCollection(null);
    const url = new URL(window.location.href);
    url.hash = HASH[v];
    url.searchParams.delete('event');
    window.history.pushState({}, '', url.toString());
    window.scrollTo({ top: 0 });
  };

  useEffect(() => {
    const onPop = () => {
      const route = routeFromHash();
      setViewState(route.view);
      setCollection(route.collection);
      setPollId(route.pollId);
      const id = new URLSearchParams(window.location.search).get('event');
      setSelected((cur) => (id ? cur : null));
    };
    window.addEventListener('popstate', onPop);
    window.addEventListener('hashchange', onPop);
    return () => {
      window.removeEventListener('popstate', onPop);
      window.removeEventListener('hashchange', onPop);
    };
  }, []);

  // ---- Data ----
  const knownIds = useRef<Set<string> | null>(cached ? new Set(cached.map((e) => e.id)) : null);
  const fetchEvents = useCallback(async () => {
    try {
      const list = await db.getEvents(addDays(tonightYMD(), -1));
      const prev = knownIds.current;
      if (prev && !firstLoad.current && list.some((e) => !prev.has(e.id))) notify(t('toast.newEvents'), 'info');
      knownIds.current = new Set(list.map((e) => e.id));
      setEvents(list);
      setLoadError(false);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
      firstLoad.current = false;
    }
  }, [t, notify]);

  useEffect(() => {
    fetchEvents();
    const unsubscribe = db.subscribeToEvents(fetchEvents);
    return () => unsubscribe?.();
  }, []);

  // Deep link: ?event=ID
  const deepLinked = useRef(false);
  useEffect(() => {
    if (deepLinked.current || !events.length) return;
    const id = new URLSearchParams(window.location.search).get('event');
    const found = id && events.find((e) => e.id === id);
    if (found) {
      deepLinked.current = true;
      setSelected(found);
    } else if (!loading) deepLinked.current = true;
  }, [events, loading]);

  const openEvent = (e: AppEvent) => {
    setSelected(e);
    const url = new URL(window.location.href);
    url.searchParams.set('event', e.id);
    window.history.pushState({}, '', url.toString());
  };
  const closeEvent = () => {
    const url = new URL(window.location.href);
    if (url.searchParams.has('event')) {
      url.searchParams.delete('event');
      window.history.replaceState({}, '', url.toString());
    }
    setSelected(null);
  };

  const openCollection = (kind: 'venue' | 'artist', name: string) => {
    setSelected(null);
    setCollection({ kind, name });
    setViewState('collection');
    const url = new URL(window.location.href);
    url.searchParams.delete('event');
    url.searchParams.delete('q');
    url.hash = `#/${kind === 'venue' ? 'lokali' : 'artist'}/${encodeURIComponent(name)}`;
    window.history.pushState({}, '', url.toString());
    window.scrollTo({ top: 0 });
  };

  const openPoll = (id: string) => {
    setTogetherSeed(null);
    setSelected(null);
    setPollId(id);
    setViewState('poll');
    const url = new URL(window.location.href);
    url.searchParams.delete('event');
    url.hash = `#/bashke/${id}`;
    window.history.pushState({}, '', url.toString());
    window.scrollTo({ top: 0 });
  };

  const toggleGoing = (e: AppEvent) => {
    const on = !goingIds.has(e.id);
    setGoingIds((prev) => {
      const next = new Set(prev);
      if (on) next.add(e.id);
      else next.delete(e.id);
      saveSet('kudalim_going', next);
      return next;
    });
    const bump = (x: AppEvent) => (x.id === e.id ? { ...x, going: Math.max(0, (x.going || 0) + (on ? 1 : -1)) } : x);
    setEvents((list) => list.map(bump));
    setSelected((cur) => (cur ? bump(cur) : cur));
    db.track(e.id, on ? 'going' : 'ungoing');
    if (on) {
      notify(t('going.toast'));
      // Going implies interest: save it too
      if (!savedIds.has(e.id)) {
        setSavedIds((prev) => {
          const next = new Set(prev);
          next.add(e.id);
          saveSet('kudalim_favorites', next);
          return next;
        });
      }
    }
  };

  // ---- Favorites / subscriptions ----
  const toggleSave = (e: AppEvent) => {
    setSavedIds((prev) => {
      const next = new Set(prev);
      if (next.has(e.id)) {
        next.delete(e.id);
        notify(t('toast.unsaved'), 'info');
      } else {
        next.add(e.id);
        notify(t('toast.saved'), 'success');
      }
      saveSet('kudalim_favorites', next);
      return next;
    });
  };

  const toggleSubscription = (city: string) => {
    setSubscriptions((prev) => {
      const next = new Set(prev);
      if (next.has(city)) {
        next.delete(city);
        notify(t('toast.subOff', { city }), 'info');
      } else {
        next.add(city);
        notify(t('toast.subOn', { city }), 'success');
      }
      saveSet('kudalim_subscriptions', next);
      return next;
    });
  };

  // ---- PWA install ----
  useEffect(() => {
    const handler = (e: any) => {
      e.preventDefault();
      setInstallPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);
  const install = async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === 'accepted') setInstallPrompt(null);
  };

  const savedEvents = events.filter((e) => savedIds.has(e.id));

  return (
    <div className="min-h-screen bg-night-bg">
      <Toasts items={toasts} />
      <Navbar
        view={view}
        savedCount={savedIds.size}
        onHome={() => setView('home')}
        onSaved={() => setView('saved')}
        onPublish={() => setView('venue')}
        installPrompt={installPrompt}
        onInstall={install}
      />

      <ErrorBoundary resetKey={`${view}:${collection?.name || ''}:${pollId || ''}`}>
      <main>
        {view === 'home' && (
          <>
            {loadError && (
              <div className="fixed inset-x-4 bottom-24 z-40 mx-auto max-w-md rounded-2xl border border-amber-400/30 bg-night-surface px-4 py-3 text-center text-sm text-amber-200">
                ⚠️ Nuk u ngarkuan eventet. <button onClick={fetchEvents} className="font-bold underline">Provo përsëri</button>
              </div>
            )}
            <HomeView
              events={events}
              loading={loading}
              savedIds={savedIds}
              onOpen={openEvent}
              onToggleSave={toggleSave}
              onPublish={() => setView('venue')}
              subscriptions={subscriptions}
              onToggleSubscription={toggleSubscription}
              onOpenCollection={openCollection}
            />
          </>
        )}

        {view === 'saved' && (
          <div className="mx-auto min-h-[80vh] max-w-6xl px-5 pb-24 pt-24 md:px-8">
            <div className="mb-8 flex items-center gap-3">
              <h1 className="font-display text-3xl font-bold text-white">{t('saved.title')}</h1>
              <span className="rounded-full bg-night-accent px-3 py-1 text-sm font-bold text-white">{savedEvents.length}</span>
            </div>
            {savedEvents.length === 0 ? (
              <div className="rounded-[28px] border border-dashed border-night-line bg-night-surface/60 px-6 py-20 text-center">
                <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-night-accent/10 text-night-accent">
                  <Icon.Heart className="h-8 w-8" />
                </div>
                <h2 className="font-display text-xl font-bold text-white">{t('saved.empty')}</h2>
                <p className="mx-auto mt-2 max-w-xs text-night-muted">{t('saved.emptySub')}</p>
                <button onClick={() => setView('home')} className="chip chip-active mt-6">
                  {t('saved.browse')}
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {savedEvents.map((e, i) => (
                  <EventCard key={e.id} event={e} index={i} saved onOpen={openEvent} onToggleSave={toggleSave} />
                ))}
              </div>
            )}
          </div>
        )}

        <Suspense fallback={<div className="min-h-[100svh]" />}>
          {view === 'venue' && <VenueForm onCancel={() => setView('home')} />}
          {view === 'poll' && pollId && <PollPage id={pollId} onOpenEvent={openEvent} onHome={() => setView('home')} notify={notify} />}
          {view === 'collection' && collection && (
            <CollectionPage
              kind={collection.kind}
              name={collection.name}
              events={events}
              savedIds={savedIds}
              onOpen={openEvent}
              onToggleSave={toggleSave}
              onBack={() => (window.history.length > 1 ? window.history.back() : setView('home'))}
              notify={notify}
            />
          )}
          {view === 'admin' && <AdminPanel onExit={() => setView('home')} notify={notify} />}
        </Suspense>
      </main>
      </ErrorBoundary>

      {view !== 'admin' && <Footer onPublish={() => setView('venue')} />}

      <Suspense fallback={selected ? <div className="fixed inset-0 z-[90] bg-night-bg" /> : null}>
        {selected && <EventDetails event={selected} saved={savedIds.has(selected.id)} onClose={closeEvent} onToggleSave={toggleSave} notify={notify} onOpenCollection={openCollection} going={goingIds.has(selected.id)} onToggleGoing={toggleGoing} onGoTogether={(e) => setTogetherSeed(e)} />}
        {togetherSeed && <TogetherBuilder seed={togetherSeed} events={events} onClose={() => setTogetherSeed(null)} onOpenPoll={openPoll} notify={notify} />}
        {(view === 'home' || view === 'saved' || view === 'collection') && !selected && !togetherSeed && <EventChatWidget position="right" />}
      </Suspense>
    </div>
  );
}

export default function App() {
  return (
    <I18nProvider>
      <AppInner />
    </I18nProvider>
  );
}
