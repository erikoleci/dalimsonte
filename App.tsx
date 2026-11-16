import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { AppEvent, AppNotification } from './types';
import { db } from './services/supabase';
import { I18nProvider, useI18n } from './lib/i18n';
import { addDays, tonightYMD } from './lib/dates';
import { Navbar, Footer } from './components/Navbar';
import { HomeView } from './components/HomeView';
import { EventCard } from './components/EventCard';
import { EventDetails } from './components/EventDetails';
import { VenueForm } from './components/VenueForm';
import { AdminPanel } from './components/AdminPanel';
import { EventChatWidget } from './components/EventChatWidget';
import { Icon, Toasts } from './components/ui';

type View = 'home' | 'saved' | 'venue' | 'admin';

// Simple hash routing: #/saved, #/publiko, #/admin
function viewFromHash(): View {
  const h = window.location.hash.replace(/^#\/?/, '');
  if (h === 'saved' || h === 'te-ruajturat') return 'saved';
  if (h === 'publiko' || h === 'publish') return 'venue';
  if (h === 'admin') return 'admin';
  return 'home';
}
const HASH: Record<View, string> = { home: '', saved: '#/te-ruajturat', venue: '#/publiko', admin: '#/admin' };

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
  const [view, setViewState] = useState<View>(viewFromHash);
  const [events, setEvents] = useState<AppEvent[]>([]);
  const [loading, setLoading] = useState(true);
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

  const setView = (v: View) => {
    setSelected(null);
    setViewState(v);
    const url = new URL(window.location.href);
    url.hash = HASH[v];
    url.searchParams.delete('event');
    window.history.pushState({}, '', url.toString());
    window.scrollTo({ top: 0 });
  };

  useEffect(() => {
    const onPop = () => {
      setViewState(viewFromHash());
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
  const fetchEvents = useCallback(async () => {
    try {
      const list = await db.getEvents(addDays(tonightYMD(), -1));
      setEvents(list);
      setLoadError(false);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEvents();
    let timer: any;
    const unsubscribe = db.subscribeToEvents(() => {
      // Debounce bursts of changes
      clearTimeout(timer);
      timer = setTimeout(async () => {
        await fetchEvents();
        if (!firstLoad.current) notify(t('toast.newEvents'), 'info');
      }, 800);
    });
    const tm = setTimeout(() => (firstLoad.current = false), 3000);
    return () => {
      unsubscribe?.();
      clearTimeout(timer);
      clearTimeout(tm);
    };
  }, []);

  // Deep link: ?event=ID
  useEffect(() => {
    if (loading) return;
    const id = new URLSearchParams(window.location.search).get('event');
    if (id) {
      const found = events.find((e) => e.id === id);
      if (found) setSelected(found);
    }
  }, [loading]);

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

        {view === 'venue' && <VenueForm onCancel={() => setView('home')} />}
        {view === 'admin' && <AdminPanel onExit={() => setView('home')} notify={notify} />}
      </main>

      {view !== 'admin' && <Footer onPublish={() => setView('venue')} />}

      {selected && <EventDetails event={selected} saved={savedIds.has(selected.id)} onClose={closeEvent} onToggleSave={toggleSave} notify={notify} />}
      {(view === 'home' || view === 'saved') && !selected && <EventChatWidget position="right" />}
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
