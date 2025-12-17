import React, { useState, useRef, useEffect } from 'react';
import { generatePromoDescription } from './services/geminiService';
import { AppEvent, AppNotification } from './types';
import ReactMarkdown from 'react-markdown';

const CITIES = ['Tiranë', 'Durrës', 'Vlorë', 'Shkodër', 'Sarandë', 'Korçë'];
const CATEGORIES = ['All Vibe', 'Live Music', 'Techno/House', 'Hip Hop / R&B', 'Latino', 'Chill / Lounge', 'Rock'];

// Helper to get today's date in YYYY-MM-DD format
const getTodayString = () => {
  return new Date().toISOString().split('T')[0];
};

// Mock Data - Used only if LocalStorage is empty
const INITIAL_EVENTS: AppEvent[] = [
  {
    id: '1',
    name: 'Grand Opening Party',
    venue: 'Rooftop Tirana',
    city: 'Tiranë',
    date: getTodayString(),
    type: 'Techno/House',
    description: 'Nata më e zjarrtë e vitit me DJ Tiesto (Tribute). Kokteile falas për vajzat deri në orën 23:00.',
    price: '10€',
    image: 'https://images.unsplash.com/photo-1570125909232-eb263c188f7e?ixlib=rb-4.0.3&auto=format&fit=crop&w=1000&q=80',
    phone: '+355691234567',
    status: 'approved',
    isPromoted: true // Premium event example
  },
  {
    id: '2',
    name: 'Jazz Night & Wine',
    venue: 'Hemingway Bar',
    city: 'Tiranë',
    date: getTodayString(),
    type: 'Chill / Lounge',
    description: 'Muzikë Jazz live nga banda lokale. Një natë e qetë për adhuruesit e verës.',
    price: 'Falas',
    image: 'https://images.unsplash.com/photo-1514525253440-b393452e8d26?ixlib=rb-4.0.3&auto=format&fit=crop&w=1000&q=80',
    phone: '+355692223333',
    status: 'approved'
  },
  {
    id: '3',
    name: 'Summer Vibes - Vlora',
    venue: 'Coco Bongo',
    city: 'Vlorë',
    date: getTodayString(),
    type: 'Latino',
    description: 'Festa buzë detit fillon sonte! Reggaeton dhe Latino gjithë natën.',
    price: '500 LEK',
    image: 'https://images.unsplash.com/photo-1533174072545-e8d4aa97edf9?ixlib=rb-4.0.3&auto=format&fit=crop&w=1000&q=80',
    phone: '+355694445555',
    status: 'approved'
  }
];

type ViewState = 'landing' | 'search' | 'venue' | 'admin' | 'saved';

// Notification Component
const NotificationToast = ({ notifications }: { notifications: AppNotification[] }) => {
  if (notifications.length === 0) return null;
  return (
    <div className="fixed top-24 left-1/2 transform -translate-x-1/2 z-[100] flex flex-col gap-2 w-full max-w-sm px-4 pointer-events-none">
      {notifications.map(n => (
        <div key={n.id} className="bg-night-card/95 backdrop-blur-xl border border-white/10 text-white px-5 py-4 rounded-2xl shadow-2xl shadow-black/50 flex items-center gap-4 animate-bounce-in pointer-events-auto">
           <span className="text-2xl">{n.type === 'success' ? '✅' : n.type === 'warning' ? '⚠️' : '🔔'}</span>
           <div className="flex-1">
             <p className="font-bold text-sm text-white">{n.type === 'success' ? 'Sukses' : n.type === 'warning' ? 'Kujdes' : 'Njoftim'}</p>
             <p className="text-sm text-gray-300 leading-tight">{n.message}</p>
           </div>
        </div>
      ))}
    </div>
  );
};

function App() {
  const [view, setView] = useState<ViewState>('landing');
  
  // --- Persistent State Initialization ---

  // 1. Load Events
  const [allEvents, setAllEvents] = useState<AppEvent[]>(() => {
    try {
      const saved = localStorage.getItem('kudalim_events');
      return saved ? JSON.parse(saved) : INITIAL_EVENTS;
    } catch (e) {
      console.error("Error loading events", e);
      return INITIAL_EVENTS;
    }
  });

  // 2. Load Saved Favorites
  const [savedEventIds, setSavedEventIds] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem('kudalim_favorites');
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch (e) {
      return new Set();
    }
  });

  // 3. Load Subscriptions
  const [subscriptions, setSubscriptions] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem('kudalim_subscriptions');
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch (e) {
      return new Set();
    }
  });

  const [selectedEvent, setSelectedEvent] = useState<AppEvent | null>(null);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);

  // PWA Install Prompt State
  const [installPrompt, setInstallPrompt] = useState<any>(null);

  // Admin State
  const [adminPass, setAdminPass] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loginError, setLoginError] = useState('');

  // Search State
  const [searchParams, setSearchParams] = useState({
    city: 'Tiranë',
    date: getTodayString(),
    category: 'All Vibe'
  });
  const [searchResults, setSearchResults] = useState<AppEvent[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [loading, setLoading] = useState(false);

  // Venue State
  const [venueStep, setVenueStep] = useState<'details' | 'success'>('details');
  const [venueForm, setVenueForm] = useState({ 
    venueName: '',
    eventName: '',
    city: 'Tiranë',
    date: getTodayString(),
    type: 'Techno/House', 
    description: '',
    price: 'Falas',
    phone: '',
    files: [] as string[],
    wantPromotion: false
  });
  const [promoLoading, setPromoLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // --- Effects for Persistence ---

  // Save Events whenever they change
  useEffect(() => {
    localStorage.setItem('kudalim_events', JSON.stringify(allEvents));
  }, [allEvents]);

  // Save Favorites whenever they change
  useEffect(() => {
    localStorage.setItem('kudalim_favorites', JSON.stringify(Array.from(savedEventIds)));
  }, [savedEventIds]);

  // Save Subscriptions whenever they change
  useEffect(() => {
    localStorage.setItem('kudalim_subscriptions', JSON.stringify(Array.from(subscriptions)));
  }, [subscriptions]);

  // Automatic Cleanup Effect (runs on mount)
  useEffect(() => {
    // Automatically delete events where date < today
    const today = getTodayString();
    setAllEvents(prevEvents => prevEvents.filter(event => event.date >= today));
  }, []);

  // PWA Install Listener
  useEffect(() => {
    const handler = (e: any) => {
      e.preventDefault();
      setInstallPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstallClick = async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === 'accepted') {
      setInstallPrompt(null);
    }
  };

  // --- Notification Logic ---
  const addNotification = (message: string, type: 'success' | 'info' | 'warning' = 'success') => {
    const id = Math.random().toString(36).substr(2, 9);
    setNotifications(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
        setNotifications(prev => prev.filter(n => n.id !== id));
    }, 4000);
  };

  const toggleSaveEvent = (e: React.MouseEvent, event: AppEvent) => {
    e.stopPropagation();
    const newSet = new Set(savedEventIds);
    if (newSet.has(event.id)) {
        newSet.delete(event.id);
        addNotification(`Eventi u hoq nga të preferuarat.`, 'info');
    } else {
        newSet.add(event.id);
        addNotification(`Eventi u ruajt! Do t'ju njoftojmë 2 orë para fillimit.`, 'success');
    }
    setSavedEventIds(newSet);
  };

  const toggleSubscription = () => {
    const key = `${searchParams.city}-${searchParams.category}`;
    const newSubs = new Set(subscriptions);
    if (newSubs.has(key)) {
        newSubs.delete(key);
        addNotification(`Njoftimet për ${searchParams.category} në ${searchParams.city} u çaktivizuan.`, 'info');
    } else {
        newSubs.add(key);
        addNotification(`U abonuat! Do merrni njoftim kur të ketë evente të reja ${searchParams.category}.`, 'success');
    }
    setSubscriptions(newSubs);
  };

  // --- Handlers ---

  const handleSearch = () => {
    setLoading(true);
    setHasSearched(true);
    
    setTimeout(() => {
      const results = allEvents.filter(event => {
        const matchCity = event.city === searchParams.city;
        const matchDate = event.date === searchParams.date;
        const matchType = searchParams.category === 'All Vibe' || event.type === searchParams.category;
        const isApproved = event.status === 'approved';
        return matchCity && matchDate && matchType && isApproved;
      });
      // Sort: Promoted events first
      results.sort((a, b) => (b.isPromoted ? 1 : 0) - (a.isPromoted ? 1 : 0));
      setSearchResults(results);
      setLoading(false);
    }, 500);
  };

  const handleGeneratePromo = async () => {
    if (!venueForm.venueName) return;
    setPromoLoading(true);
    const desc = await generatePromoDescription(venueForm.venueName, `${venueForm.type} - ${venueForm.eventName}`);
    setVenueForm(prev => ({ ...prev, description: desc }));
    setPromoLoading(false);
  };

  const handleSubmitEvent = () => {
    const newEvent: AppEvent = {
      id: Math.random().toString(36).substr(2, 9),
      name: venueForm.eventName || 'Event Special',
      venue: venueForm.venueName,
      city: venueForm.city,
      date: venueForm.date,
      type: venueForm.type,
      description: venueForm.description,
      price: venueForm.price,
      phone: venueForm.phone || '+355 69 XX XX XXX',
      image: 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?ixlib=rb-4.0.3&auto=format&fit=crop&w=1000&q=80',
      status: 'pending', // Default status is pending
      isPromoted: venueForm.wantPromotion
    };

    setAllEvents(prev => [newEvent, ...prev]);
    setVenueStep('success'); // Go to success/info screen instead of payment
  };

  const resetVenueForm = () => {
      setVenueStep('details');
      setVenueForm({
        venueName: '',
        eventName: '',
        city: 'Tiranë',
        date: getTodayString(),
        type: 'Techno/House', 
        description: '',
        price: 'Falas',
        phone: '',
        files: [],
        wantPromotion: false
      });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const newFiles = Array.from(e.target.files).map((f: File) => f.name);
      setVenueForm(prev => ({ ...prev, files: [...prev.files, ...newFiles] }));
    }
  };

  const handleAdminLogin = () => {
    if (adminPass === 'admin123') {
      setIsAuthenticated(true);
      setLoginError('');
    } else {
      setLoginError('Fjalëkalimi i pasaktë');
    }
  };

  const handleDeleteEvent = (id: string) => {
    if (confirm('Je i sigurt që dëshiron të fshish këtë event?')) {
      setAllEvents(prev => prev.filter(e => e.id !== id));
      addNotification('Eventi u fshi.', 'info');
    }
  };

  const handleApproveEvent = (id: string, promote = false) => {
    setAllEvents(prev => prev.map(e => {
        if (e.id === id) {
            return { ...e, status: 'approved', isPromoted: promote ? true : e.isPromoted };
        }
        return e;
    }));
    addNotification(promote ? 'Eventi u miratua dhe u SPONSORIZUA!' : 'Eventi u miratua dhe është LIVE!', 'success');
  };

  const handleAdminLogout = () => {
      setIsAuthenticated(false);
      setAdminPass('');
      setView('landing');
  };

  // --- Render Functions ---

  const renderNavbar = () => (
    <nav className="fixed top-0 w-full z-50 px-4 py-3 md:px-6 md:py-4 flex justify-between items-center bg-night-bg/90 backdrop-blur-md border-b border-white/5 transition-all">
      <div 
        className="flex items-center gap-2 cursor-pointer group" 
        onClick={() => { setView('landing'); setSelectedEvent(null); }}
      >
        <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-gradient-to-tr from-rose-600 to-purple-600 flex items-center justify-center shadow-lg shadow-rose-500/30 group-hover:scale-110 transition-transform">
          <span className="text-lg md:text-xl">🌙</span>
        </div>
        <span className="font-bold text-lg md:text-xl tracking-tight text-white drop-shadow-md">
          Ku Dalim<span className="text-night-accent">Sonte?</span>
        </span>
      </div>
      
      <div className="flex items-center gap-2">
         {installPrompt && (
            <button
              onClick={handleInstallClick}
              className="bg-white/10 hover:bg-white/20 text-white px-3 py-2 rounded-xl text-sm font-bold border border-white/20 animate-pulse hidden sm:block"
            >
              📲 Instalo
            </button>
         )}

         {view !== 'admin' && (
             <button 
                onClick={() => setView('saved')}
                className={`relative w-10 h-10 rounded-full flex items-center justify-center transition hover:bg-white/10 ${view === 'saved' ? 'text-rose-500 bg-white/10' : 'text-gray-400'}`}
             >
                <span className="text-xl">❤️</span>
                {savedEventIds.size > 0 && (
                    <span className="absolute top-1 right-1 w-3 h-3 bg-rose-500 rounded-full border-2 border-night-bg"></span>
                )}
             </button>
         )}

         {view !== 'venue' && view !== 'admin' && !selectedEvent && (
            <button 
            onClick={() => setView('venue')}
            className="bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/20 text-white px-3 py-2 md:px-5 md:py-2.5 rounded-full font-semibold transition-all hover:scale-105 active:scale-95 flex items-center gap-2 text-sm md:text-base"
            >
            <span>➕</span> <span className="hidden xs:inline">Publiko</span>
            </button>
        )}
      </div>
    </nav>
  );

  const renderEventDetails = () => {
    if (!selectedEvent) return null;
    const isSaved = savedEventIds.has(selectedEvent.id);

    return (
        <div className="fixed inset-0 z-[60] bg-night-bg overflow-y-auto animate-fade-in">
             {/* Hero Image */}
             <div className="relative h-[40vh] md:h-[50vh] w-full">
                <img src={selectedEvent.image} alt={selectedEvent.name} className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-night-bg via-night-bg/50 to-transparent"></div>
                <button 
                    onClick={() => setSelectedEvent(null)}
                    className="absolute top-4 left-4 md:top-6 md:left-6 w-10 h-10 bg-black/50 backdrop-blur rounded-full flex items-center justify-center text-white border border-white/10 active:scale-90 transition z-20"
                >
                    ←
                </button>
                <button 
                    onClick={(e) => toggleSaveEvent(e, selectedEvent)}
                    className={`absolute top-4 right-4 md:top-6 md:right-6 w-12 h-12 rounded-full flex items-center justify-center border transition z-20 backdrop-blur-md active:scale-90 shadow-xl ${isSaved ? 'bg-rose-500 border-rose-500 text-white' : 'bg-black/40 border-white/20 text-white hover:bg-black/60'}`}
                >
                    <span className="text-2xl">{isSaved ? '❤️' : '🤍'}</span>
                </button>

                <div className="absolute bottom-0 left-0 p-6 md:p-10 w-full">
                    <div className="flex flex-wrap gap-2 mb-3">
                        <span className="inline-block px-3 py-1 bg-night-accent text-white text-xs font-bold rounded-full uppercase tracking-wide shadow-lg">
                            {selectedEvent.type}
                        </span>
                        {selectedEvent.isPromoted && (
                            <span className="inline-block px-3 py-1 bg-gradient-to-r from-yellow-400 to-orange-500 text-black text-xs font-bold rounded-full uppercase tracking-wide shadow-lg">
                                💎 Premium
                            </span>
                        )}
                    </div>
                    <h1 className="text-3xl md:text-5xl font-bold text-white leading-tight mb-2 shadow-black drop-shadow-lg">
                        {selectedEvent.name}
                    </h1>
                    <div className="flex items-center gap-2 text-gray-300 text-sm md:text-base">
                         <span>📍 {selectedEvent.venue}, {selectedEvent.city}</span>
                         {selectedEvent.status === 'pending' && <span className="text-yellow-400 bg-yellow-400/10 px-2 py-0.5 rounded text-xs border border-yellow-400/20">Në Shqyrtim</span>}
                    </div>
                </div>
             </div>

             {/* Content */}
             <div className="px-6 py-8 md:px-10 max-w-4xl mx-auto pb-32">
                 <div className="flex flex-col md:flex-row gap-8">
                     <div className="flex-1">
                        <h3 className="text-xl font-bold text-white mb-4">Rreth Eventit</h3>
                        <p className="text-gray-300 leading-relaxed text-lg whitespace-pre-wrap">
                            {selectedEvent.description}
                        </p>
                        
                        <div className="mt-8 p-6 bg-night-card rounded-2xl border border-white/5">
                            <h4 className="font-bold text-white mb-4 border-b border-white/5 pb-2">Informacion</h4>
                            <div className="space-y-3">
                                <div className="flex justify-between">
                                    <span className="text-gray-400">Data</span>
                                    <span className="text-white font-mono">{selectedEvent.date}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-400">Ora</span>
                                    <span className="text-white font-mono">22:00 (Standard)</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-400">Mosha e lejuar</span>
                                    <span className="text-white">18+</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-gray-400">Kontakt (Rezervime)</span>
                                    <a href={`tel:${selectedEvent.phone}`} className="text-night-accent font-bold hover:underline">{selectedEvent.phone}</a>
                                </div>
                            </div>
                        </div>
                     </div>
                 </div>
             </div>

             {/* Sticky Footer Action */}
             <div className="fixed bottom-0 left-0 w-full bg-night-card/90 backdrop-blur-lg border-t border-white/10 p-4 md:p-6 z-50">
                <div className="max-w-4xl mx-auto flex items-center justify-between gap-4">
                    <div>
                        <div className="text-xs text-gray-400 uppercase">Çmimi i Hyrjes</div>
                        <div className="text-2xl font-bold text-night-accent">{selectedEvent.price}</div>
                    </div>
                    <a 
                        href={`tel:${selectedEvent.phone}`}
                        className="flex-1 bg-white text-night-bg font-bold py-3.5 rounded-xl hover:bg-gray-200 transition active:scale-[0.98] shadow-lg flex items-center justify-center gap-2"
                    >
                        Rezervo Tani 📞
                    </a>
                </div>
             </div>
        </div>
    );
  };

  const renderLandingView = () => (
    <div className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden pt-20">
      <div className="absolute top-0 left-0 w-full h-full bg-night-bg pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[300px] md:w-[500px] h-[300px] md:h-[500px] bg-purple-600/30 rounded-full blur-[80px] md:blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[300px] md:w-[500px] h-[300px] md:h-[500px] bg-rose-600/20 rounded-full blur-[80px] md:blur-[120px]" />
      </div>

      <div className="relative z-10 max-w-5xl mx-auto px-6 text-center">
        <div className="inline-block mb-6 px-4 py-1.5 rounded-full border border-purple-500/30 bg-purple-500/10 text-purple-300 text-xs md:text-sm font-medium uppercase tracking-wider animate-fade-in">
          Platforma #1 e Jetës së Natës
        </div>
        
        <h1 className="text-4xl sm:text-5xl md:text-7xl font-extrabold text-white mb-6 md:mb-8 leading-tight drop-shadow-2xl">
          Mos Rri Në Shtëpi.<br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-rose-500 via-purple-500 to-indigo-500 animate-gradient-x">
            Zbulo Natën Tënde.
          </span>
        </h1>
        
        <p className="text-base md:text-xl text-gray-300 mb-8 md:mb-10 max-w-2xl mx-auto leading-relaxed">
          Gjej eventet më të mira të publikuara direkt nga lokalet në qytetin tënd.
          Zgjidh datën, gjej vibe-in, dhe dil.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 w-full sm:w-auto">
          <button 
            onClick={() => setView('search')}
            className="w-full sm:w-auto px-8 py-4 bg-night-accent hover:bg-rose-700 text-white text-lg font-bold rounded-2xl shadow-xl shadow-rose-900/40 transform transition hover:scale-[1.02] active:scale-[0.98]"
          >
            Gjej Ku Të Dalësh 🚀
          </button>
          
           {installPrompt ? (
            <button 
             onClick={handleInstallClick}
             className="w-full sm:w-auto px-8 py-4 bg-white text-night-bg hover:bg-gray-200 text-lg font-bold rounded-2xl transition active:scale-[0.98] animate-bounce"
            >
              📲 Instalo App-in
            </button>
           ) : (
            <button 
                onClick={() => setView('venue')}
                className="w-full sm:w-auto px-8 py-4 bg-night-card hover:bg-slate-800 border border-white/10 text-white text-lg font-semibold rounded-2xl transition active:scale-[0.98]"
            >
                Je Organizator?
            </button>
           )}
        </div>

        <div className="mt-16 md:mt-20 grid grid-cols-2 md:grid-cols-4 gap-4 opacity-80">
          {[
            { icon: '💎', label: 'Premium Events' },
            { icon: '💃', label: 'Latino' },
            { icon: '🎉', label: 'Party' },
            { icon: '🎧', label: 'Techno' }
          ].map((item, idx) => (
            <div key={idx} className="bg-white/5 backdrop-blur border border-white/5 p-4 rounded-xl flex flex-col items-center gap-2 hover:bg-white/10 transition cursor-default">
              <span className="text-2xl md:text-3xl">{item.icon}</span>
              <span className="text-xs md:text-sm font-medium text-gray-300">{item.label}</span>
            </div>
          ))}
        </div>
        
        {/* Secret Admin Trigger - Invisible Box in Bottom Right */}
        <div 
            onClick={() => setView('admin')} 
            className="fixed bottom-0 right-0 w-10 h-10 z-50 cursor-default"
            aria-hidden="true"
        />
      </div>
    </div>
  );

  const renderEventCard = (event: AppEvent) => {
    const isSaved = savedEventIds.has(event.id);
    return (
        <div 
        key={event.id} 
        onClick={() => setSelectedEvent(event)}
        className={`bg-night-card rounded-2xl overflow-hidden border shadow-xl hover:shadow-2xl transition group flex flex-col cursor-pointer active:scale-[0.98] relative ${event.isPromoted ? 'border-night-gold/50 shadow-night-gold/10' : 'border-white/5 hover:border-night-accent/30'}`}
        >
            <div className="h-48 overflow-hidden relative">
                <img src={event.image} alt={event.name} className="w-full h-full object-cover group-hover:scale-110 transition duration-700" />
                <div className="absolute top-4 right-4 bg-night-accent/90 backdrop-blur text-white text-xs font-bold px-3 py-1 rounded-full shadow-lg">
                    {event.price}
                </div>
                {event.status === 'pending' && (
                     <div className="absolute top-4 right-20 bg-yellow-500/90 backdrop-blur text-black text-xs font-bold px-3 py-1 rounded-full shadow-lg">
                     ⚠️ Pending
                 </div>
                )}
                {event.isPromoted && (
                    <div className="absolute top-0 left-0 w-full overflow-hidden">
                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-yellow-400 via-orange-500 to-yellow-400 animate-shine"></div>
                        <div className="absolute top-4 left-4 bg-gradient-to-r from-yellow-400 to-orange-500 text-black text-xs font-bold px-3 py-1 rounded-full shadow-lg flex items-center gap-1">
                            💎 Sponsorizuar
                        </div>
                    </div>
                )}
                {!event.isPromoted && (
                    <button 
                        onClick={(e) => toggleSaveEvent(e, event)}
                        className="absolute top-4 left-4 w-8 h-8 rounded-full bg-black/40 backdrop-blur flex items-center justify-center text-sm hover:bg-black/60 transition"
                    >
                        {isSaved ? '❤️' : '🤍'}
                    </button>
                )}
                 {event.isPromoted && (
                    <button 
                        onClick={(e) => toggleSaveEvent(e, event)}
                        className="absolute top-4 right-20 w-8 h-8 rounded-full bg-black/40 backdrop-blur flex items-center justify-center text-sm hover:bg-black/60 transition"
                    >
                        {isSaved ? '❤️' : '🤍'}
                    </button>
                )}
            </div>
            <div className={`p-6 flex-1 flex flex-col ${event.isPromoted ? 'bg-gradient-to-b from-night-gold/5 to-transparent' : ''}`}>
                <h4 className="text-xl font-bold text-white leading-tight mb-2">{event.name}</h4>
                <div className="flex items-center gap-2 text-night-accent text-sm font-semibold mb-3">
                    <span>📍 {event.venue}</span>
                </div>
                <p className="text-gray-400 text-sm line-clamp-3 mb-4 flex-1">{event.description}</p>
                <div className="flex items-center justify-between pt-4 border-t border-white/5">
                    <span className="text-xs text-gray-500 font-medium uppercase">{event.type}</span>
                    <button className={`px-4 py-2 rounded-lg text-sm font-medium transition active:scale-95 ${event.isPromoted ? 'bg-night-gold text-black hover:bg-yellow-300' : 'text-white bg-white/10 hover:bg-white/20'}`}>
                        Shiko Detajet
                    </button>
                </div>
            </div>
        </div>
    );
  };

  const renderSearchView = () => {
    const subKey = `${searchParams.city}-${searchParams.category}`;
    const isSubscribed = subscriptions.has(subKey);

    return (
    <div className="min-h-screen pt-24 px-4 pb-12 max-w-5xl mx-auto">
       <button onClick={() => setView('landing')} className="mb-4 md:mb-6 text-gray-400 hover:text-white flex items-center gap-2 transition active:scale-95">
        ← Kthehu
      </button>

      <div className="bg-night-card rounded-3xl p-6 md:p-8 shadow-2xl border border-white/5">
        <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl md:text-3xl font-bold text-white">Filtro Natën Tënde</h2>
            <button 
                onClick={toggleSubscription}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl border transition ${isSubscribed ? 'bg-night-accent/10 border-night-accent text-night-accent' : 'border-gray-700 text-gray-400 hover:text-white'}`}
            >
                <span>{isSubscribed ? '🔕' : '🔔'}</span>
                <span className="text-sm font-bold hidden sm:inline">{isSubscribed ? 'Abonuar' : 'Njoftomë'}</span>
            </button>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="space-y-2">
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Qyteti</label>
            <div className="relative">
              <select 
                value={searchParams.city}
                onChange={(e) => setSearchParams({...searchParams, city: e.target.value})}
                className="w-full bg-night-bg border border-gray-700 rounded-xl p-4 text-white appearance-none focus:ring-2 focus:ring-night-accent outline-none text-base"
              >
                {CITIES.map(city => <option key={city} value={city}>{city}</option>)}
              </select>
              <span className="absolute right-4 top-4 text-gray-400 pointer-events-none">▼</span>
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Data</label>
            <div className="relative">
              <input 
                type="date"
                value={searchParams.date}
                onChange={(e) => setSearchParams({...searchParams, date: e.target.value})}
                className="w-full bg-night-bg border border-gray-700 rounded-xl p-4 text-white focus:ring-2 focus:ring-night-accent outline-none text-base"
              />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Vibe</label>
            <div className="relative">
              <select 
                value={searchParams.category}
                onChange={(e) => setSearchParams({...searchParams, category: e.target.value})}
                className="w-full bg-night-bg border border-gray-700 rounded-xl p-4 text-white appearance-none focus:ring-2 focus:ring-night-accent outline-none text-base"
              >
                {CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
              </select>
              <span className="absolute right-4 top-4 text-gray-400 pointer-events-none">▼</span>
            </div>
          </div>
        </div>
        <button 
          onClick={handleSearch}
          disabled={loading}
          className="w-full mt-8 bg-gradient-to-r from-night-accent to-purple-600 hover:from-rose-600 hover:to-purple-700 text-white font-bold py-4 rounded-xl transition-all shadow-lg flex items-center justify-center gap-3 disabled:opacity-70 active:scale-[0.98]"
        >
          {loading ? <span className="flex items-center gap-2 animate-pulse">Duke kërkuar...</span> : <><span>🔍</span> Gjej Eventet</>}
        </button>
      </div>

      {hasSearched && (
        <div className="mt-10 animate-fade-in">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-2">
            <h3 className="text-2xl font-bold text-white">Rezultatet ({searchResults.length})</h3>
            <span className="text-xs sm:text-sm text-gray-400 bg-white/5 px-3 py-1 rounded-full">{searchParams.city} • {searchParams.date}</span>
          </div>

          {searchResults.length === 0 ? (
             <div className="text-center py-20 bg-night-card rounded-2xl border border-white/5 border-dashed">
                <div className="text-4xl mb-4">😔</div>
                <h3 className="text-xl font-bold text-white">Asnjë event nuk u gjet</h3>
                <p className="text-gray-400 mt-2 px-4">Provo të ndryshosh kategorinë ose datën.</p>
             </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
               {searchResults.map(renderEventCard)}
            </div>
          )}
        </div>
      )}
    </div>
    );
  };

  const renderSavedEventsView = () => {
    const savedEvents = allEvents.filter(e => savedEventIds.has(e.id));

    return (
        <div className="min-h-screen pt-24 px-4 pb-12 max-w-5xl mx-auto">
             <button onClick={() => setView('landing')} className="mb-4 md:mb-6 text-gray-400 hover:text-white flex items-center gap-2 transition active:scale-95">
                ← Kthehu
            </button>
            <div className="flex items-center gap-3 mb-8">
                <h2 className="text-3xl font-bold text-white">Eventet e Ruajtura</h2>
                <span className="bg-night-accent text-white px-3 py-1 rounded-full text-sm font-bold">{savedEvents.length}</span>
            </div>

            {savedEvents.length === 0 ? (
                 <div className="text-center py-24 bg-night-card rounded-3xl border border-white/5 border-dashed">
                    <div className="text-5xl mb-6 opacity-50">❤️</div>
                    <h3 className="text-xl font-bold text-white">Ende asnjë event i preferuar</h3>
                    <p className="text-gray-400 mt-2 px-4 mb-6">Ruani eventet që ju pëlqejnë duke klikuar zemrën.</p>
                    <button onClick={() => setView('search')} className="bg-white/10 hover:bg-white/20 text-white px-6 py-3 rounded-xl font-bold transition">
                        Gjej Evente
                    </button>
                 </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {savedEvents.map(renderEventCard)}
                </div>
            )}
        </div>
    );
  };

  const renderVenueView = () => (
    <div className="min-h-screen pt-24 px-4 pb-12 max-w-3xl mx-auto">
      <button onClick={() => setView('landing')} className="mb-6 text-gray-400 hover:text-white flex items-center gap-2 transition active:scale-95">
        ← Anulo
      </button>

      <div className="bg-night-card rounded-3xl overflow-hidden border border-white/5 shadow-2xl">
        <div className="bg-slate-800/50 p-4 flex items-center justify-center gap-4 border-b border-white/5">
           <div className={`flex items-center gap-2 ${venueStep === 'details' ? 'text-night-accent font-bold' : 'text-gray-400'}`}>
             <span className="w-6 h-6 rounded-full border border-current flex items-center justify-center text-xs">1</span>
             <span className="text-sm">Detajet</span>
           </div>
           <div className="w-8 h-[1px] bg-gray-600"></div>
           <div className={`flex items-center gap-2 ${venueStep === 'success' ? 'text-night-accent font-bold' : 'text-gray-400'}`}>
             <span className="w-6 h-6 rounded-full border border-current flex items-center justify-center text-xs">2</span>
             <span className="text-sm">Dërgimi</span>
           </div>
        </div>

        {venueStep === 'details' ? (
          <div className="p-6 md:p-8 space-y-6">
             <div className="text-center mb-6">
               <h2 className="text-2xl font-bold text-white mb-2">Publiko Eventin</h2>
               <p className="text-gray-400 text-sm">Shto eventin në databazën tonë.</p>
             </div>
             <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">Emri i Lokalit</label>
                        <input type="text" value={venueForm.venueName} onChange={(e) => setVenueForm({...venueForm, venueName: e.target.value})} className="w-full bg-night-bg border border-gray-700 rounded-xl p-3 text-white focus:ring-2 focus:ring-night-accent outline-none text-base" placeholder="psh. Rooftop Tirana" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">Emri i Eventit</label>
                        <input type="text" value={venueForm.eventName} onChange={(e) => setVenueForm({...venueForm, eventName: e.target.value})} className="w-full bg-night-bg border border-gray-700 rounded-xl p-3 text-white focus:ring-2 focus:ring-night-accent outline-none text-base" placeholder="psh. Saturday Night" />
                    </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                   <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Qyteti</label>
                    <select value={venueForm.city} onChange={(e) => setVenueForm({...venueForm, city: e.target.value})} className="w-full bg-night-bg border border-gray-700 rounded-xl p-3 text-white focus:ring-2 focus:ring-night-accent outline-none text-base">
                      {CITIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                   </div>
                   <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Data</label>
                    <input type="date" value={venueForm.date} onChange={(e) => setVenueForm({...venueForm, date: e.target.value})} className="w-full bg-night-bg border border-gray-700 rounded-xl p-3 text-white focus:ring-2 focus:ring-night-accent outline-none text-base" />
                   </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                   <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Kategoria</label>
                    <select value={venueForm.type} onChange={(e) => setVenueForm({...venueForm, type: e.target.value})} className="w-full bg-night-bg border border-gray-700 rounded-xl p-3 text-white focus:ring-2 focus:ring-night-accent outline-none text-base">
                      {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                   </div>
                   <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">Çmimi</label>
                      <input type="text" value={venueForm.price} onChange={(e) => setVenueForm({...venueForm, price: e.target.value})} className="w-full bg-night-bg border border-gray-700 rounded-xl p-3 text-white focus:ring-2 focus:ring-night-accent outline-none text-base" placeholder="psh. 500 LEK" />
                   </div>
                </div>
                <div>
                     <label className="block text-sm font-medium text-gray-300 mb-2">Numri i Telefonit (Rezervime)</label>
                     <input 
                        type="tel" 
                        value={venueForm.phone} 
                        onChange={(e) => setVenueForm({...venueForm, phone: e.target.value})} 
                        className="w-full bg-night-bg border border-gray-700 rounded-xl p-3 text-white focus:ring-2 focus:ring-night-accent outline-none text-base" 
                        placeholder="psh. 069 12 34 567" 
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Poster / Foto</label>
                      <input type="file" ref={fileInputRef} multiple onChange={handleFileChange} className="hidden" />
                      <button onClick={() => fileInputRef.current?.click()} className="w-full bg-night-bg border border-dashed border-gray-600 hover:border-night-accent rounded-xl p-3 text-gray-400 hover:text-white transition text-sm flex items-center justify-center gap-2 active:bg-white/5">📷 Ngarko Foto</button>
                      {venueForm.files.length > 0 && (
                        <div className="flex gap-2 flex-wrap mt-2">{venueForm.files.map((f, i) => (<span key={i} className="text-xs bg-slate-700 px-2 py-1 rounded text-gray-300">{f}</span>))}</div>
                        )}
                </div>
                
                {/* Monetization Feature in Form */}
                <div className="bg-gradient-to-r from-yellow-500/10 to-orange-500/10 border border-yellow-500/30 p-4 rounded-xl">
                    <label className="flex items-center space-x-3 cursor-pointer">
                        <input 
                            type="checkbox" 
                            checked={venueForm.wantPromotion}
                            onChange={(e) => setVenueForm({...venueForm, wantPromotion: e.target.checked})}
                            className="w-5 h-5 accent-yellow-500 rounded focus:ring-2 focus:ring-yellow-500"
                        />
                        <div>
                            <span className="font-bold text-yellow-500 text-sm block">🚀 Sponsorizo Eventin (Premium)</span>
                            <span className="text-xs text-gray-400">Eventi juaj do të shfaqet në krye dhe do të ketë etiketën "Premium". (+1000 LEK)</span>
                        </div>
                    </label>
                </div>

                <div>
                   <div className="flex justify-between items-center mb-2">
                     <label className="block text-sm font-medium text-gray-300">Përshkrimi</label>
                     <button onClick={handleGeneratePromo} disabled={promoLoading || !venueForm.venueName} className="text-xs text-purple-400 hover:text-purple-300 flex items-center gap-1 disabled:opacity-50">✨ AI Help</button>
                   </div>
                   <textarea rows={4} value={venueForm.description} onChange={(e) => setVenueForm({...venueForm, description: e.target.value})} className="w-full bg-night-bg border border-gray-700 rounded-xl p-3 text-white focus:ring-2 focus:ring-night-accent outline-none text-base" placeholder="Përshkruaj atmosferën..." />
                </div>
             </div>
             <button onClick={handleSubmitEvent} disabled={!venueForm.venueName || !venueForm.description || !venueForm.phone} className="w-full bg-night-accent hover:bg-rose-700 text-white font-bold py-4 rounded-xl transition disabled:opacity-50 active:scale-[0.98]">Dërgo për Miratim 🚀</button>
          </div>
        ) : (
          <div className="p-10 md:p-12 text-center flex flex-col items-center">
             <div className="w-20 h-20 bg-green-500/20 text-green-500 rounded-full flex items-center justify-center text-4xl mb-6 animate-bounce">
                ✓
             </div>
             <h2 className="text-3xl font-bold text-white mb-4">U Dërgua me Sukses!</h2>
             <p className="text-gray-300 mb-8 max-w-md leading-relaxed">
                Eventi juaj <span className="text-white font-bold">"{venueForm.eventName}"</span> u ruajt në sistem.
                <br /><br />
                {venueForm.wantPromotion ? (
                    <span className="block bg-yellow-500/10 p-2 rounded text-yellow-400 text-sm mt-2 border border-yellow-500/20">
                        Ke zgjedhur paketën Premium! Kontakto adminin për aktivizim të menjëhershëm.
                    </span>
                ) : (
                    "Për ta bërë LIVE, ju lutem prisni miratimin e adminit."
                )}
             </p>
             
             <div className="bg-white/5 border border-white/10 rounded-xl p-6 w-full max-w-sm mb-8">
                 <p className="text-xs text-gray-400 uppercase font-bold mb-2">Kontakt Admin</p>
                 <div className="text-xl text-white font-bold mb-1">068 81 55 866</div>
                 <div className="text-sm text-green-400">WhatsApp / Telefon</div>
             </div>

             <button onClick={resetVenueForm} className="text-gray-400 hover:text-white underline text-sm">
                Publiko një event tjetër
             </button>
          </div>
        )}
      </div>
    </div>
  );

  const renderAdminView = () => (
    <div className="min-h-screen pt-24 px-4 pb-12 bg-gray-900">
        {!isAuthenticated ? (
            <div className="min-h-[70vh] flex flex-col items-center justify-center">
                <div className="bg-night-card p-6 md:p-8 rounded-3xl shadow-2xl border border-white/10 max-w-md w-full">
                     <div className="flex justify-center mb-6">
                        <div className="w-16 h-16 rounded-full bg-night-accent/20 flex items-center justify-center text-3xl">🔒</div>
                     </div>
                     <h2 className="text-2xl font-bold text-white text-center mb-2">Administrator</h2>
                     <p className="text-gray-400 text-center mb-8 text-sm">Hyrje vetëm për stafin</p>
                     
                     <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Fjalëkalimi</label>
                     <input 
                        type="password" 
                        value={adminPass}
                        autoFocus
                        onChange={(e) => setAdminPass(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleAdminLogin()}
                        className="w-full bg-night-bg border border-gray-700 rounded-xl p-4 text-white focus:ring-2 focus:ring-night-accent outline-none mb-4 text-base"
                        placeholder="••••••••"
                    />
                    
                    {loginError && <p className="text-red-500 text-sm mb-4 text-center">{loginError}</p>}

                    <button 
                        onClick={handleAdminLogin}
                        className="w-full bg-night-accent hover:bg-rose-700 text-white font-bold py-4 rounded-xl transition shadow-lg shadow-rose-900/30 active:scale-[0.98]"
                    >
                        Hyr në Panel
                    </button>
                    <button 
                        onClick={() => setView('landing')}
                        className="w-full mt-4 text-gray-500 hover:text-white text-sm"
                    >
                        ← Kthehu
                    </button>
                </div>
            </div>
        ) : (
            <div className="max-w-6xl mx-auto">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                     <div>
                         <h2 className="text-2xl md:text-3xl font-bold text-white">Dashboard</h2>
                         <p className="text-gray-400 text-sm">Menaxhimi i Eventeve dhe Pagesave</p>
                     </div>
                     <button 
                        onClick={handleAdminLogout} 
                        className="bg-gray-800 hover:bg-gray-700 text-white px-6 py-2 rounded-xl font-medium border border-white/10 transition active:scale-95 text-sm"
                     >
                        Dalje
                     </button>
                </div>

                {/* Quick Stats */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 md:gap-6 mb-10">
                    <div className="bg-night-card p-6 rounded-2xl border border-white/5">
                        <div className="text-gray-400 mb-1 text-sm font-medium">Pending</div>
                        <div className="text-3xl md:text-4xl font-bold text-yellow-500">
                             {allEvents.filter(e => e.status === 'pending').length}
                        </div>
                    </div>
                    <div className="bg-night-card p-6 rounded-2xl border border-white/5">
                        <div className="text-gray-400 mb-1 text-sm font-medium">Fitimet (Sot)</div>
                        <div className="text-3xl md:text-4xl font-bold text-green-500">
                             {allEvents.filter(e => e.status === 'approved' && e.isPromoted).length * 10}€
                        </div>
                        <div className="text-xs text-gray-500 mt-1">*Bazuar në eventet premium</div>
                    </div>
                    <div className="bg-night-card p-6 rounded-2xl border border-white/5">
                         <div className="text-gray-400 mb-1 text-sm font-medium">Total Evente</div>
                         <div className="text-3xl md:text-4xl font-bold text-white">{allEvents.length}</div>
                    </div>
                </div>

                <div className="bg-night-card rounded-3xl p-4 md:p-8 border border-white/5 shadow-2xl overflow-hidden">
                    <h3 className="text-xl font-bold text-white mb-6">Lista e Eventeve</h3>
                    <div className="overflow-x-auto -mx-4 md:mx-0 px-4 md:px-0">
                        <table className="w-full text-left border-collapse min-w-[800px]">
                            <thead>
                                <tr className="border-b border-gray-700 text-gray-500 text-xs uppercase tracking-wider">
                                    <th className="py-4 px-4">Statusi</th>
                                    <th className="py-4 px-4">Eventi</th>
                                    <th className="py-4 px-4">Vendi</th>
                                    <th className="py-4 px-4">Data</th>
                                    <th className="py-4 px-4">Kontakt</th>
                                    <th className="py-4 px-4 text-right">Veprime (Pagesa)</th>
                                </tr>
                            </thead>
                            <tbody>
                                {allEvents.length === 0 ? (
                                    <tr><td colSpan={6} className="py-12 text-center text-gray-500 italic">Asnjë event nuk është në sistem.</td></tr>
                                ) : (
                                    allEvents.sort((a,b) => (a.status === 'pending' ? -1 : 1)).map(event => (
                                        <tr key={event.id} className={`border-b border-gray-800 transition group ${event.status === 'pending' ? 'bg-yellow-500/5 hover:bg-yellow-500/10' : 'hover:bg-white/5'}`}>
                                            <td className="py-4 px-4">
                                                {event.status === 'pending' ? (
                                                    <span className="bg-yellow-500/20 text-yellow-400 px-3 py-1 rounded-full text-xs font-bold border border-yellow-500/30 animate-pulse">
                                                        ⏳ Pending
                                                    </span>
                                                ) : (
                                                    <div className="flex flex-col gap-1">
                                                        <span className="bg-green-500/20 text-green-400 px-3 py-1 rounded-full text-xs font-bold border border-green-500/30 w-fit">
                                                            ✅ Live
                                                        </span>
                                                        {event.isPromoted && (
                                                            <span className="text-[10px] text-yellow-500 font-bold uppercase tracking-wider">💎 Premium</span>
                                                        )}
                                                    </div>
                                                )}
                                            </td>
                                            <td className="py-4 px-4">
                                                <div className="flex items-center gap-3">
                                                    <img src={event.image} className="w-10 h-10 rounded-lg object-cover bg-gray-700" alt="" />
                                                    <span className="font-bold text-white text-sm">
                                                        {event.name}
                                                        {event.isPromoted && event.status === 'pending' && <span className="text-yellow-500 ml-2">💎</span>}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="py-4 px-4">
                                                <div className="text-gray-300 text-sm">{event.venue}</div>
                                                <div className="text-xs text-gray-500">{event.city}</div>
                                            </td>
                                            <td className="py-4 px-4 text-gray-300 font-mono text-sm">{event.date}</td>
                                            <td className="py-4 px-4 text-gray-400 font-mono text-sm">{event.phone}</td>
                                            <td className="py-4 px-4 text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    {event.status === 'pending' && (
                                                        <>
                                                            <button 
                                                                onClick={() => handleApproveEvent(event.id, false)}
                                                                className="bg-green-600 hover:bg-green-500 text-white px-3 py-2 rounded-lg text-xs font-bold transition shadow-lg"
                                                                title="Konfirmo Thjesht"
                                                            >
                                                                Ok
                                                            </button>
                                                            <button 
                                                                onClick={() => handleApproveEvent(event.id, true)}
                                                                className="bg-yellow-600 hover:bg-yellow-500 text-white px-3 py-2 rounded-lg text-xs font-bold transition shadow-lg border border-yellow-400/50"
                                                                title="Konfirmo si Premium (Paguar)"
                                                            >
                                                                💎 Ok
                                                            </button>
                                                        </>
                                                    )}
                                                    <button 
                                                        onClick={() => handleDeleteEvent(event.id)}
                                                        className="bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white px-3 py-2 rounded-lg text-xs font-bold transition duration-300 border border-red-500/30"
                                                        title="Refuzo / Tërhiq"
                                                    >
                                                        🗑️
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        )}
    </div>
  );

  return (
    <div className="bg-night-bg text-night-text font-sans antialiased min-h-screen">
      <NotificationToast notifications={notifications} />
      {renderNavbar()}
      {view === 'landing' && renderLandingView()}
      {view === 'search' && renderSearchView()}
      {view === 'saved' && renderSavedEventsView()}
      {renderEventDetails()}
      {view === 'venue' && renderVenueView()}
      {view === 'admin' && renderAdminView()}
    </div>
  );
}

export default App;