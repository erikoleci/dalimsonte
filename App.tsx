import React, { useState, useRef, useEffect } from 'react';
import { db, uploadEventImages } from './services/supabase';
import { AppEvent, AppNotification } from './types';

const CITIES = ['Tiranë', 'Durrës', 'Vlorë', 'Shkodër', 'Sarandë', 'Korçë'];
const CATEGORIES = ['All Vibe', 'Live Music', 'Techno/House', 'Hip Hop / R&B', 'Latino', 'Chill / Lounge', 'Rock'];

// Helper to get today's date in YYYY-MM-DD format
const getTodayString = () => {
  return new Date().toISOString().split('T')[0];
};

const INITIAL_EVENTS: AppEvent[] = [
  {
    id: '1',
    name: 'Grand Opening Party',
    venue: 'Rooftop Tirana',
    city: 'Tiranë',
    date: getTodayString(),
    type: 'Techno/House',
    description: 'The hottest night of the year with DJ Tiesto (Tribute). Free cocktails for ladies until 11:00 PM.',
    price: '10€',
    image: 'https://images.unsplash.com/photo-1570125909232-eb263c188f7e?ixlib=rb-4.0.3&auto=format&fit=crop&w=1000&q=80',
    phone: '+355691234567',
    status: 'approved',
    isPromoted: true 
  },
  {
    id: '2',
    name: 'Jazz Night & Wine',
    venue: 'Hemingway Bar',
    city: 'Tiranë',
    date: getTodayString(),
    type: 'Chill / Lounge',
    description: 'Live jazz music from a local band. A relaxed night for wine lovers.',
    price: 'Free',
    image: 'https://images.unsplash.com/photo-1514525253440-b393452e8d26?ixlib=rb-4.0.3&auto=format&fit=crop&w=1000&q=80',
    phone: '+355692223333',
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
             <p className="font-bold text-sm text-white">{n.type === 'success' ? 'Success' : n.type === 'warning' ? 'Warning' : 'Notification'}</p>
             <p className="text-sm text-gray-300 leading-tight">{n.message}</p>
           </div>
        </div>
      ))}
    </div>
  );
};

// Builds a WhatsApp link from the phone number, stripping spaces/symbols
const getWhatsAppReserveUrl = (event: AppEvent) => {
  const digitsOnly = (event.phone || '').replace(/[^0-9]/g, '');
  const text = encodeURIComponent(`Hello! I would like to reserve for "${event.name}" (${event.date}) at ${event.venue}.`);
  return `https://wa.me/${digitsOnly}?text=${text}`;
};

function App() {
  const [view, setView] = useState<ViewState>('landing');
  
  // --- State Initialization ---
  const [allEvents, setAllEvents] = useState<AppEvent[]>([]);
  const [dataLoaded, setDataLoaded] = useState(false);
  const [isTableMissing, setIsTableMissing] = useState(false);

  // Load Saved Favorites
  const [savedEventIds, setSavedEventIds] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem('kudalim_favorites');
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch (e) {
      return new Set();
    }
  });

  // Load Subscriptions
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
  const [installPrompt, setInstallPrompt] = useState<any>(null);

  // Admin State
  const [adminPass, setAdminPass] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [oldPass, setOldPass] = useState('');
  const [newPass, setNewPass] = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  const [changePassMsg, setChangePassMsg] = useState('');
  const [editingEvent, setEditingEvent] = useState<AppEvent | null>(null);

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
    price: 'Free',
    phone: '',
    files: [] as File[],
    wantPromotion: false
  });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [submitting, setSubmitting] = useState(false);
  
  // --- Effects ---

  // Main Fetch Function
  const fetchEvents = async (silent = false) => {
    const events = await db.getEvents();
    
    // Check missing table state from DB service
    setIsTableMissing(db.isTableMissing());

    if (events.length === 0 && !db.isConnected()) {
        setAllEvents(INITIAL_EVENTS);
    } else {
        // We do NOT filter by date here completely, so Admin can see old ones if needed, 
        // but for performance we might want to. For now, let's keep all.
        setAllEvents(events);
    }
    if (!silent) setDataLoaded(true);
  };

  // Initial Fetch & Real-time Subscription
  useEffect(() => {
    fetchEvents();

    // Subscribe to real-time changes
    const channel = db.subscribeToEvents(() => {
        addNotification("New data found! Refreshing...", "info");
        fetchEvents(true);
    });

    return () => {
        if (channel && typeof channel.unsubscribe === 'function') {
            channel.unsubscribe();
        }
    };
  }, []);

  // Deep-link: if the URL has ?event=ID, automatically open that event after loading
  useEffect(() => {
    if (!dataLoaded) return;
    const params = new URLSearchParams(window.location.search);
    const eventId = params.get('event');
    if (eventId) {
      const found = allEvents.find(e => e.id === eventId);
      if (found) setSelectedEvent(found);
    }
  }, [dataLoaded]);

  // Update the URL when an event opens/closes, so it's shareable
  useEffect(() => {
    setGalleryIndex(0);
    const url = new URL(window.location.href);
    if (selectedEvent) {
      url.searchParams.set('event', selectedEvent.id);
    } else {
      url.searchParams.delete('event');
    }
    window.history.replaceState({}, '', url.toString());
  }, [selectedEvent]);

  // Persist Favorites & Subs
  useEffect(() => {
    localStorage.setItem('kudalim_favorites', JSON.stringify(Array.from(savedEventIds)));
  }, [savedEventIds]);

  useEffect(() => {
    localStorage.setItem('kudalim_subscriptions', JSON.stringify(Array.from(subscriptions)));
  }, [subscriptions]);

  // PWA
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
        addNotification(`Event removed from favorites.`, 'info');
    } else {
        newSet.add(event.id);
        addNotification(`Event saved! We'll notify you 2 hours before it starts.`, 'success');
    }
    setSavedEventIds(newSet);
  };

  const toggleSubscription = () => {
    const key = `${searchParams.city}-${searchParams.category}`;
    const newSubs = new Set(subscriptions);
    if (newSubs.has(key)) {
        newSubs.delete(key);
        addNotification(`Notifications for ${searchParams.category} in ${searchParams.city} disabled.`, 'info');
    } else {
        newSubs.add(key);
        addNotification(`Subscribed! You'll get notified when there are new ${searchParams.category} events.`, 'success');
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
      results.sort((a, b) => (b.isPromoted ? 1 : 0) - (a.isPromoted ? 1 : 0));
      setSearchResults(results);
      setLoading(false);
    }, 500);
  };

  const handleSubmitEvent = async () => {
    let imageUrl = 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?ixlib=rb-4.0.3&auto=format&fit=crop&w=1000&q=80';
    let gallery: string[] = [];

    if (venueForm.files.length > 0) {
      setSubmitting(true);
      try {
        gallery = await uploadEventImages(venueForm.files);
        if (gallery.length > 0) imageUrl = gallery[0];
      } catch (e) {
        console.error('Error uploading photos:', e);
      }
      setSubmitting(false);
    }

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
      image: imageUrl,
      gallery,
      status: 'pending',
      isPromoted: venueForm.wantPromotion
    };

    // Optimistic Update is risky with cross-device if not connected, 
    // but useful for immediate feedback on current device.
    setAllEvents(prev => [newEvent, ...prev]);
    
    const success = await db.addEvent(newEvent);
    if(success) {
        setVenueStep('success');
    }
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
        price: 'Free',
        phone: '',
        files: [],
        wantPromotion: false
      });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const newFiles = Array.from(e.target.files);
      setVenueForm(prev => ({ ...prev, files: [...prev.files, ...newFiles].slice(0, 3) }));
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleRemoveFile = (index: number) => {
    setVenueForm(prev => ({ ...prev, files: prev.files.filter((_, i) => i !== index) }));
  };

  const handleShareEvent = async (event: AppEvent) => {
    const shareUrl = `${window.location.origin}${window.location.pathname}?event=${event.id}`;
    const shareText = `${event.name} @ ${event.venue}, ${event.city} — ${event.date}`;

    if (navigator.share) {
      try {
        await navigator.share({ title: event.name, text: shareText, url: shareUrl });
        return;
      } catch (e) {
        // User cancelled or error — continue to fallback
      }
    }

    // Fallback: open WhatsApp directly with the link
    const waText = encodeURIComponent(`${shareText}\n${shareUrl}`);
    window.open(`https://wa.me/?text=${waText}`, '_blank');
  };

  const handleAdminLogin = async () => {
    const storedPassword = await db.getSetting('admin_password', 'admin123');
    if (adminPass === storedPassword) {
      setIsAuthenticated(true);
      setLoginError('');
      // Fetch immediate to be sure
      fetchEvents();
    } else {
      setLoginError('Incorrect password');
    }
  };

  const handleDeleteEvent = async (id: string) => {
    if (confirm('Are you sure you want to delete this event?')) {
      // Optimistic delete
      setAllEvents(prev => prev.filter(e => e.id !== id));
      await db.deleteEvent(id);
      addNotification('Event deleted.', 'info');
    }
  };

  const handleUpdateEvent = async () => {
    if (!editingEvent) return;
    setAllEvents(prev => prev.map(e => e.id === editingEvent.id ? editingEvent : e));
    await db.updateEvent(editingEvent.id, editingEvent);
    addNotification('Event updated.', 'success');
    setEditingEvent(null);
  };

  const handleApproveEvent = async (id: string, promote = false) => {
    // Optimistic update
    setAllEvents(prev => prev.map(e => {
        if (e.id === id) {
            return { ...e, status: 'approved', isPromoted: promote ? true : e.isPromoted };
        }
        return e;
    }));
    await db.updateEventStatus(id, 'approved', promote);
    addNotification(promote ? 'Event approved and SPONSORED!' : 'Event approved and is now LIVE!', 'success');
  };

  const handleAdminLogout = () => {
      setIsAuthenticated(false);
      setAdminPass('');
      setView('landing');
  };

  const handleChangePassword = async () => {
    const storedPassword = await db.getSetting('admin_password', 'admin123');
    if (oldPass !== storedPassword) {
      setChangePassMsg('error:Current password is incorrect.');
      return;
    }
    if (newPass.length < 4) {
      setChangePassMsg('error:New password must be at least 4 characters.');
      return;
    }
    if (newPass !== confirmPass) {
      setChangePassMsg('error:New passwords don\'t match.');
      return;
    }
    await db.setSetting('admin_password', newPass);
    setChangePassMsg('success:Changed successfully!');
    setOldPass(''); setNewPass(''); setConfirmPass('');
    setTimeout(() => { setShowChangePassword(false); setChangePassMsg(''); }, 1500);
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
              📲 Install
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
            <span>➕</span> <span className="hidden xs:inline">Publish</span>
            </button>
        )}
      </div>
    </nav>
  );

  const [galleryIndex, setGalleryIndex] = useState(0);

  const renderEventDetails = () => {
    if (!selectedEvent) return null;
    const isSaved = savedEventIds.has(selectedEvent.id);
    const photos = selectedEvent.gallery && selectedEvent.gallery.length > 0 ? selectedEvent.gallery : [selectedEvent.image];

    return (
        <div className="fixed inset-0 z-[60] bg-night-bg overflow-y-auto animate-fade-in">
             {/* Hero Image / Gallery */}
             <div className="relative h-[40vh] md:h-[50vh] w-full">
                <img src={photos[galleryIndex] || photos[0]} alt={selectedEvent.name} className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-night-bg via-night-bg/50 to-transparent"></div>

                {photos.length > 1 && (
                  <>
                    <button
                      onClick={() => setGalleryIndex(i => (i - 1 + photos.length) % photos.length)}
                      className="absolute left-2 top-1/2 -translate-y-1/2 w-9 h-9 bg-black/50 backdrop-blur rounded-full flex items-center justify-center text-white z-20"
                    >‹</button>
                    <button
                      onClick={() => setGalleryIndex(i => (i + 1) % photos.length)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 bg-black/50 backdrop-blur rounded-full flex items-center justify-center text-white z-20"
                    >›</button>
                    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5 z-20">
                      {photos.map((_, i) => (
                        <span key={i} className={`w-2 h-2 rounded-full ${i === galleryIndex ? 'bg-white' : 'bg-white/40'}`} />
                      ))}
                    </div>
                  </>
                )}

                <button 
                    onClick={() => { setSelectedEvent(null); setGalleryIndex(0); }}
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
                <button
                    onClick={() => handleShareEvent(selectedEvent)}
                    className="absolute top-4 right-20 md:top-6 md:right-24 w-12 h-12 rounded-full flex items-center justify-center border bg-black/40 border-white/20 text-white hover:bg-black/60 transition z-20 backdrop-blur-md active:scale-90 shadow-xl"
                    title="Share the event"
                >
                    <span className="text-xl">📤</span>
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
                         {selectedEvent.status === 'pending' && <span className="text-yellow-400 bg-yellow-400/10 px-2 py-0.5 rounded text-xs border border-yellow-400/20">Under Review</span>}
                    </div>
                </div>
             </div>

             {/* Content */}
             <div className="px-6 py-8 md:px-10 max-w-4xl mx-auto pb-32">
                 <div className="flex flex-col md:flex-row gap-8">
                     <div className="flex-1">
                        <h3 className="text-xl font-bold text-white mb-4">About the Event</h3>
                        <p className="text-gray-300 leading-relaxed text-lg whitespace-pre-wrap">
                            {selectedEvent.description}
                        </p>
                        
                        <div className="mt-8 p-6 bg-night-card rounded-2xl border border-white/5">
                            <h4 className="font-bold text-white mb-4 border-b border-white/5 pb-2">Information</h4>
                            <div className="space-y-3">
                                <div className="flex justify-between">
                                    <span className="text-gray-400">Date</span>
                                    <span className="text-white font-mono">{selectedEvent.date}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-400">Time</span>
                                    <span className="text-white font-mono">22:00 (Standard)</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-400">Age limit</span>
                                    <span className="text-white">18+</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-gray-400">Contact (Reservations)</span>
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
                        <div className="text-xs text-gray-400 uppercase">Entry Price</div>
                        <div className="text-2xl font-bold text-night-accent">{selectedEvent.price}</div>
                    </div>
                    <a 
                        href={getWhatsAppReserveUrl(selectedEvent)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 bg-white text-night-bg font-bold py-3.5 rounded-xl hover:bg-gray-200 transition active:scale-[0.98] shadow-lg flex items-center justify-center gap-2"
                    >
                        Reserve Now 💬
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
          The #1 Nightlife Platform
        </div>
        
        <h1 className="text-4xl sm:text-5xl md:text-7xl font-extrabold text-white mb-6 md:mb-8 leading-tight drop-shadow-2xl">
          Don't Stay Home.<br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-rose-500 via-purple-500 to-indigo-500 animate-gradient-x">
            Discover Your Night.
          </span>
        </h1>
        
        <p className="text-base md:text-xl text-gray-300 mb-8 md:mb-10 max-w-2xl mx-auto leading-relaxed">
          Find the best events posted directly by venues in your city.
          Pick the date, find the vibe, and go out.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 w-full sm:w-auto">
          <button 
            onClick={() => setView('search')}
            className="w-full sm:w-auto px-8 py-4 bg-night-accent hover:bg-rose-700 text-white text-lg font-bold rounded-2xl shadow-xl shadow-rose-900/40 transform transition hover:scale-[1.02] active:scale-[0.98]"
          >
            Find Where to Go 🚀
          </button>
          
           {installPrompt ? (
            <button 
             onClick={handleInstallClick}
             className="w-full sm:w-auto px-8 py-4 bg-white text-night-bg hover:bg-gray-200 text-lg font-bold rounded-2xl transition active:scale-[0.98] animate-bounce"
            >
              📲 Install the App
            </button>
           ) : (
            <button 
                onClick={() => setView('venue')}
                className="w-full sm:w-auto px-8 py-4 bg-night-card hover:bg-slate-800 border border-white/10 text-white text-lg font-semibold rounded-2xl transition active:scale-[0.98]"
            >
                Are You an Organizer?
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
                            💎 Sponsored
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
                        View Details
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
        ← Back
      </button>

      <div className="bg-night-card rounded-3xl p-6 md:p-8 shadow-2xl border border-white/5">
        <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl md:text-3xl font-bold text-white">Filter Your Night</h2>
            <button 
                onClick={toggleSubscription}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl border transition ${isSubscribed ? 'bg-night-accent/10 border-night-accent text-night-accent' : 'border-gray-700 text-gray-400 hover:text-white'}`}
            >
                <span>{isSubscribed ? '🔕' : '🔔'}</span>
                <span className="text-sm font-bold hidden sm:inline">{isSubscribed ? 'Subscribed' : 'Notify Me'}</span>
            </button>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="space-y-2">
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">City</label>
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
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Date</label>
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
          {loading ? <span className="flex items-center gap-2 animate-pulse">Searching...</span> : <><span>🔍</span> Find Events</>}
        </button>
      </div>

      {hasSearched && (
        <div className="mt-10 animate-fade-in">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-2">
            <h3 className="text-2xl font-bold text-white">Results ({searchResults.length})</h3>
            <span className="text-xs sm:text-sm text-gray-400 bg-white/5 px-3 py-1 rounded-full">{searchParams.city} • {searchParams.date}</span>
          </div>

          {searchResults.length === 0 ? (
             <div className="text-center py-20 bg-night-card rounded-2xl border border-white/5 border-dashed">
                <div className="text-4xl mb-4">😔</div>
                <h3 className="text-xl font-bold text-white">No events found</h3>
                <p className="text-gray-400 mt-2 px-4">Try changing the category or date.</p>
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
                ← Back
            </button>
            <div className="flex items-center gap-3 mb-8">
                <h2 className="text-3xl font-bold text-white">Saved Events</h2>
                <span className="bg-night-accent text-white px-3 py-1 rounded-full text-sm font-bold">{savedEvents.length}</span>
            </div>

            {savedEvents.length === 0 ? (
                 <div className="text-center py-24 bg-night-card rounded-3xl border border-white/5 border-dashed">
                    <div className="text-5xl mb-6 opacity-50">❤️</div>
                    <h3 className="text-xl font-bold text-white">No favorite events yet</h3>
                    <p className="text-gray-400 mt-2 px-4 mb-6">Save events you like by clicking the heart.</p>
                    <button onClick={() => setView('search')} className="bg-white/10 hover:bg-white/20 text-white px-6 py-3 rounded-xl font-bold transition">
                        Find Events
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
        ← Cancel
      </button>

      <div className="bg-night-card rounded-3xl overflow-hidden border border-white/5 shadow-2xl">
        <div className="bg-slate-800/50 p-4 flex items-center justify-center gap-4 border-b border-white/5">
           <div className={`flex items-center gap-2 ${venueStep === 'details' ? 'text-night-accent font-bold' : 'text-gray-400'}`}>
             <span className="w-6 h-6 rounded-full border border-current flex items-center justify-center text-xs">1</span>
             <span className="text-sm">Details</span>
           </div>
           <div className="w-8 h-[1px] bg-gray-600"></div>
           <div className={`flex items-center gap-2 ${venueStep === 'success' ? 'text-night-accent font-bold' : 'text-gray-400'}`}>
             <span className="w-6 h-6 rounded-full border border-current flex items-center justify-center text-xs">2</span>
             <span className="text-sm">Submission</span>
           </div>
        </div>

        {venueStep === 'details' ? (
          <div className="p-6 md:p-8 space-y-6">
             <div className="text-center mb-6">
               <h2 className="text-2xl font-bold text-white mb-2">Publish the Event</h2>
               <p className="text-gray-400 text-sm">Add the event to our database.</p>
             </div>
             <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">Venue Name</label>
                        <input type="text" value={venueForm.venueName} onChange={(e) => setVenueForm({...venueForm, venueName: e.target.value})} className="w-full bg-night-bg border border-gray-700 rounded-xl p-3 text-white focus:ring-2 focus:ring-night-accent outline-none text-base" placeholder="e.g. Rooftop Tirana" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">Event Name</label>
                        <input type="text" value={venueForm.eventName} onChange={(e) => setVenueForm({...venueForm, eventName: e.target.value})} className="w-full bg-night-bg border border-gray-700 rounded-xl p-3 text-white focus:ring-2 focus:ring-night-accent outline-none text-base" placeholder="e.g. Saturday Night" />
                    </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                   <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">City</label>
                    <select value={venueForm.city} onChange={(e) => setVenueForm({...venueForm, city: e.target.value})} className="w-full bg-night-bg border border-gray-700 rounded-xl p-3 text-white focus:ring-2 focus:ring-night-accent outline-none text-base">
                      {CITIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                   </div>
                   <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Date</label>
                    <input type="date" value={venueForm.date} onChange={(e) => setVenueForm({...venueForm, date: e.target.value})} className="w-full bg-night-bg border border-gray-700 rounded-xl p-3 text-white focus:ring-2 focus:ring-night-accent outline-none text-base" />
                   </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                   <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Category</label>
                    <select value={venueForm.type} onChange={(e) => setVenueForm({...venueForm, type: e.target.value})} className="w-full bg-night-bg border border-gray-700 rounded-xl p-3 text-white focus:ring-2 focus:ring-night-accent outline-none text-base">
                      {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                   </div>
                   <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">Price</label>
                      <input type="text" value={venueForm.price} onChange={(e) => setVenueForm({...venueForm, price: e.target.value})} className="w-full bg-night-bg border border-gray-700 rounded-xl p-3 text-white focus:ring-2 focus:ring-night-accent outline-none text-base" placeholder="e.g. 500 LEK" />
                   </div>
                </div>
                <div>
                     <label className="block text-sm font-medium text-gray-300 mb-2">Phone Number (Reservations)</label>
                     <input 
                        type="tel" 
                        value={venueForm.phone} 
                        onChange={(e) => setVenueForm({...venueForm, phone: e.target.value})} 
                        className="w-full bg-night-bg border border-gray-700 rounded-xl p-3 text-white focus:ring-2 focus:ring-night-accent outline-none text-base" 
                        placeholder="e.g. 069 12 34 567" 
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Poster / Photos (up to 3)</label>
                      <input type="file" ref={fileInputRef} multiple accept="image/*" onChange={handleFileChange} className="hidden" disabled={venueForm.files.length >= 3} />
                      <button onClick={() => fileInputRef.current?.click()} disabled={venueForm.files.length >= 3} className="w-full bg-night-bg border border-dashed border-gray-600 hover:border-night-accent rounded-xl p-3 text-gray-400 hover:text-white transition text-sm flex items-center justify-center gap-2 active:bg-white/5 disabled:opacity-40 disabled:cursor-not-allowed">
                        📷 {venueForm.files.length >= 3 ? 'Maximum 3 photos' : `Upload Photos (${venueForm.files.length}/3)`}
                      </button>
                      {venueForm.files.length > 0 && (
                        <div className="flex gap-2 flex-wrap mt-3">
                          {venueForm.files.map((f, i) => (
                            <div key={i} className="relative w-16 h-16 rounded-lg overflow-hidden border border-white/10 group">
                              <img src={URL.createObjectURL(f)} className="w-full h-full object-cover" alt="" />
                              <button onClick={() => handleRemoveFile(i)} className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-lg transition">✕</button>
                            </div>
                          ))}
                        </div>
                      )}
                </div>
                
                {/* Enhanced Monetization Feature UI */}
                <div className="bg-gradient-to-r from-yellow-500/10 to-orange-500/10 border border-yellow-500/30 p-4 rounded-xl relative overflow-hidden group hover:border-yellow-500/50 transition-colors">
                    <div className="absolute top-0 right-0 bg-yellow-500 text-black text-[10px] font-bold px-2 py-1 rounded-bl-lg shadow-sm">
                        RECOMMENDED 🚀
                    </div>
                    <label className="flex items-center space-x-4 cursor-pointer relative z-10">
                        <div className="relative">
                            <input 
                                type="checkbox" 
                                checked={venueForm.wantPromotion}
                                onChange={(e) => setVenueForm({...venueForm, wantPromotion: e.target.checked})}
                                className="peer sr-only"
                            />
                            <div className="w-6 h-6 border-2 border-yellow-500 rounded bg-transparent peer-checked:bg-yellow-500 transition-all flex items-center justify-center">
                                <span className="text-black font-bold text-sm opacity-0 peer-checked:opacity-100">✓</span>
                            </div>
                        </div>
                        <div className="flex-1">
                            <span className="font-bold text-yellow-400 text-lg block mb-0.5">Sponsor the Event (Premium)</span>
                            <span className="text-xs text-gray-300 block leading-tight">
                                Show the event at the top, tag it as "Premium" and get 3x more reservations.
                                <span className="block mt-1 font-bold text-yellow-500">+1000 LEK / Event</span>
                            </span>
                        </div>
                    </label>
                </div>

                <div>
                   <label className="block text-sm font-medium text-gray-300 mb-2">Description</label>
                   <textarea rows={4} value={venueForm.description} onChange={(e) => setVenueForm({...venueForm, description: e.target.value})} className="w-full bg-night-bg border border-gray-700 rounded-xl p-3 text-white focus:ring-2 focus:ring-night-accent outline-none text-base" placeholder="Describe the atmosphere..." />
                </div>
             </div>
             <button onClick={handleSubmitEvent} disabled={submitting || !venueForm.venueName || !venueForm.description || !venueForm.phone} className="w-full bg-night-accent hover:bg-rose-700 text-white font-bold py-4 rounded-xl transition disabled:opacity-50 active:scale-[0.98]">{submitting ? 'Uploading photos...' : 'Submit for Approval 🚀'}</button>
          </div>
        ) : (
          <div className="p-10 md:p-12 text-center flex flex-col items-center">
             <div className="w-20 h-20 bg-green-500/20 text-green-500 rounded-full flex items-center justify-center text-4xl mb-6 animate-bounce">
                ✓
             </div>
             <h2 className="text-3xl font-bold text-white mb-4">Successfully Submitted!</h2>
             <p className="text-gray-300 mb-8 max-w-md leading-relaxed">
                Your event <span className="text-white font-bold">"{venueForm.eventName}"</span> has been saved in the system.
                <br /><br />
                {venueForm.wantPromotion ? (
                    <span className="block bg-yellow-500/10 p-4 rounded-xl text-yellow-400 text-sm mt-2 border border-yellow-500/20 shadow-lg shadow-yellow-900/10">
                        💎 <strong>Premium Request!</strong><br/>
                        Please transfer the payment and contact the admin for immediate activation.
                    </span>
                ) : (
                    "To go LIVE, please wait for admin approval."
                )}
             </p>
             
             <div className="bg-white/5 border border-white/10 rounded-xl p-6 w-full max-w-sm mb-8">
                 <p className="text-xs text-gray-400 uppercase font-bold mb-2">Admin Contact</p>
                 <div className="text-xl text-white font-bold mb-1">068 81 55 866</div>
                 <div className="text-sm text-green-400">WhatsApp / Phone</div>
             </div>

             <button onClick={resetVenueForm} className="text-gray-400 hover:text-white underline text-sm">
                Publish another event
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
                     <p className="text-gray-400 text-center mb-8 text-sm">Staff login only</p>
                     
                     <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Password</label>
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
                        Log In to Panel
                    </button>
                    <button 
                        onClick={() => setView('landing')}
                        className="w-full mt-4 text-gray-500 hover:text-white text-sm"
                    >
                        ← Back
                    </button>
                </div>
            </div>
        ) : (
            <div className="max-w-6xl mx-auto">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                     <div>
                         <h2 className="text-2xl md:text-3xl font-bold text-white">Dashboard</h2>
                         <p className="text-gray-400 text-sm mt-1">
                            {db.isConnected() ? (
                                <span className="text-green-400 flex items-center gap-1 font-mono">
                                    🟢 Online <span className="text-gray-600">|</span> ID: {db.getProjectID().substring(0,6)}...
                                </span>
                            ) : (
                                <span className="text-orange-400 flex items-center gap-1">
                                    🟠 Offline (Local) <span className="text-gray-500 text-xs">- Missing API Key in .env</span>
                                </span>
                            )}
                         </p>
                     </div>
                     <div className="flex items-center gap-2">
                     <button 
                        onClick={() => setShowChangePassword(true)} 
                        className="bg-gray-800 hover:bg-gray-700 text-white px-6 py-2 rounded-xl font-medium border border-white/10 transition active:scale-95 text-sm"
                     >
                        🔒 Password
                     </button>
                     <button 
                        onClick={handleAdminLogout} 
                        className="bg-gray-800 hover:bg-gray-700 text-white px-6 py-2 rounded-xl font-medium border border-white/10 transition active:scale-95 text-sm"
                     >
                        Log Out
                     </button>
                     </div>
                </div>

                {showChangePassword && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
                        <div className="bg-gray-900 rounded-2xl max-w-sm w-full p-6 border border-white/10">
                            <h3 className="text-lg font-bold text-white mb-4">Change Password</h3>
                            <div className="space-y-3">
                                <input type="password" placeholder="Current password" value={oldPass} onChange={(e) => setOldPass(e.target.value)} className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-pink-500" />
                                <input type="password" placeholder="New password" value={newPass} onChange={(e) => setNewPass(e.target.value)} className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-pink-500" />
                                <input type="password" placeholder="Confirm new password" value={confirmPass} onChange={(e) => setConfirmPass(e.target.value)} className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-pink-500" />
                                {changePassMsg && (
                                    <p className={`text-xs font-semibold ${changePassMsg.startsWith('error') ? 'text-red-400' : 'text-green-400'}`}>
                                        {changePassMsg.split(':')[1]}
                                    </p>
                                )}
                                <div className="flex gap-2 pt-2">
                                    <button onClick={() => { setShowChangePassword(false); setChangePassMsg(''); setOldPass(''); setNewPass(''); setConfirmPass(''); }} className="flex-1 py-2.5 rounded-full bg-gray-800 hover:bg-gray-700 text-white font-bold text-xs uppercase">Cancel</button>
                                    <button onClick={handleChangePassword} className="flex-1 py-2.5 rounded-full bg-pink-600 hover:bg-pink-500 text-white font-bold text-xs uppercase">Save</button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {editingEvent && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md overflow-y-auto">
                        <div className="bg-gray-900 rounded-2xl max-w-lg w-full p-6 border border-white/10 my-8">
                            <h3 className="text-lg font-bold text-white mb-4">✏️ Edit Event</h3>
                            <div className="space-y-3">
                                <input type="text" placeholder="Event name" value={editingEvent.name} onChange={(e) => setEditingEvent({ ...editingEvent, name: e.target.value })} className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-night-accent" />
                                <div className="grid grid-cols-2 gap-3">
                                    <input type="text" placeholder="Venue" value={editingEvent.venue} onChange={(e) => setEditingEvent({ ...editingEvent, venue: e.target.value })} className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-night-accent" />
                                    <select value={editingEvent.city} onChange={(e) => setEditingEvent({ ...editingEvent, city: e.target.value })} className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-night-accent">
                                        {CITIES.map(c => <option key={c} value={c}>{c}</option>)}
                                    </select>
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <input type="date" value={editingEvent.date} onChange={(e) => setEditingEvent({ ...editingEvent, date: e.target.value })} className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-night-accent" />
                                    <select value={editingEvent.type} onChange={(e) => setEditingEvent({ ...editingEvent, type: e.target.value })} className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-night-accent">
                                        {CATEGORIES.filter(c => c !== 'All Vibe').map(c => <option key={c} value={c}>{c}</option>)}
                                    </select>
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <input type="text" placeholder="Price" value={editingEvent.price} onChange={(e) => setEditingEvent({ ...editingEvent, price: e.target.value })} className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-night-accent" />
                                    <input type="text" placeholder="Phone" value={editingEvent.phone} onChange={(e) => setEditingEvent({ ...editingEvent, phone: e.target.value })} className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-night-accent" />
                                </div>
                                <input type="text" placeholder="Photo URL" value={editingEvent.image} onChange={(e) => setEditingEvent({ ...editingEvent, image: e.target.value })} className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-night-accent" />
                                <textarea rows={3} placeholder="Description" value={editingEvent.description} onChange={(e) => setEditingEvent({ ...editingEvent, description: e.target.value })} className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-night-accent" />

                                <div className="flex gap-2 pt-2">
                                    <button onClick={() => setEditingEvent(null)} className="flex-1 py-2.5 rounded-full bg-gray-800 hover:bg-gray-700 text-white font-bold text-xs uppercase">Cancel</button>
                                    <button onClick={handleUpdateEvent} className="flex-1 py-2.5 rounded-full bg-night-accent hover:bg-rose-700 text-white font-bold text-xs uppercase">Save Changes</button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* --- HELP BOX IF TABLE IS MISSING --- */}
                {isTableMissing && (
                    <div className="bg-red-500/10 border border-red-500/30 p-6 rounded-2xl mb-8 animate-pulse-slow">
                        <div className="flex items-start gap-4">
                            <span className="text-3xl">🛠️</span>
                            <div className="flex-1">
                                <h3 className="text-xl font-bold text-red-400 mb-2">Attention: Database is not configured!</h3>
                                <p className="text-gray-300 text-sm mb-4">
                                    The <code>events</code> table doesn't exist in Supabase. The app is running locally (Offline Mode).
                                    To sync the data, go to <strong>Supabase Dashboard &gt; SQL Editor</strong> and run the following code:
                                </p>
                                <div className="bg-black/50 p-4 rounded-lg border border-white/10 font-mono text-xs md:text-sm text-green-400 overflow-x-auto select-all">
                                    <pre>{`CREATE TABLE events (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    venue TEXT NOT NULL,
    city TEXT NOT NULL,
    date TEXT NOT NULL,
    type TEXT NOT NULL,
    description TEXT,
    price TEXT,
    image TEXT,
    phone TEXT,
    status TEXT DEFAULT 'pending',
    is_promoted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

ALTER TABLE events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public Read" ON events FOR SELECT USING (true);
CREATE POLICY "Public Insert" ON events FOR INSERT WITH CHECK (true);
CREATE POLICY "Public Update" ON events FOR UPDATE USING (true);
CREATE POLICY "Public Delete" ON events FOR DELETE USING (true);`}</pre>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Quick Stats */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 md:gap-6 mb-10">
                    <div className="bg-night-card p-6 rounded-2xl border border-white/5">
                        <div className="text-gray-400 mb-1 text-sm font-medium">Pending</div>
                        <div className="text-3xl md:text-4xl font-bold text-yellow-500">
                             {allEvents.filter(e => e.status === 'pending').length}
                        </div>
                    </div>
                    <div className="bg-night-card p-6 rounded-2xl border border-white/5 relative overflow-hidden">
                         <div className="absolute top-0 right-0 p-4 opacity-10 text-6xl">💰</div>
                        <div className="text-gray-400 mb-1 text-sm font-medium">Expected Earnings</div>
                        <div className="text-3xl md:text-4xl font-bold text-green-500">
                             {allEvents.filter(e => e.isPromoted).length * 1000} LEK
                        </div>
                        <div className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full bg-green-500"></span>
                            {allEvents.filter(e => e.isPromoted && e.status === 'approved').length} paid events
                        </div>
                    </div>
                    <div className="bg-night-card p-6 rounded-2xl border border-white/5">
                         <div className="text-gray-400 mb-1 text-sm font-medium">Total Events</div>
                         <div className="text-3xl md:text-4xl font-bold text-white">{allEvents.length}</div>
                    </div>
                </div>

                <div className="bg-night-card rounded-3xl p-4 md:p-8 border border-white/5 shadow-2xl overflow-hidden">
                    <h3 className="text-xl font-bold text-white mb-6">Events List</h3>
                    
                    {/* Desktop View Table */}
                    <div className="hidden md:block overflow-x-auto -mx-4 md:mx-0 px-4 md:px-0">
                        <table className="w-full text-left border-collapse min-w-[800px]">
                            <thead>
                                <tr className="border-b border-gray-700 text-gray-500 text-xs uppercase tracking-wider">
                                    <th className="py-4 px-4">Status</th>
                                    <th className="py-4 px-4">Event</th>
                                    <th className="py-4 px-4">Venue</th>
                                    <th className="py-4 px-4">Date</th>
                                    <th className="py-4 px-4">Contact</th>
                                    <th className="py-4 px-4 text-right">Actions (Payment)</th>
                                </tr>
                            </thead>
                            <tbody>
                                {allEvents.length === 0 ? (
                                    <tr><td colSpan={6} className="py-12 text-center text-gray-500 italic">No events in the system.</td></tr>
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
                                                                title="Confirm Simply"
                                                            >
                                                                Ok
                                                            </button>
                                                            <button 
                                                                onClick={() => handleApproveEvent(event.id, true)}
                                                                className="bg-yellow-600 hover:bg-yellow-500 text-white px-3 py-2 rounded-lg text-xs font-bold transition shadow-lg border border-yellow-400/50"
                                                                title="Confirm as Premium (Paid)"
                                                            >
                                                                💎 Ok
                                                            </button>
                                                        </>
                                                    )}
                                                    <button 
                                                        onClick={() => setEditingEvent(event)}
                                                        className="bg-blue-500/10 hover:bg-blue-500 text-blue-400 hover:text-white px-3 py-2 rounded-lg text-xs font-bold transition duration-300 border border-blue-500/30"
                                                        title="Edit"
                                                    >
                                                        ✏️
                                                    </button>
                                                    <button 
                                                        onClick={() => handleDeleteEvent(event.id)}
                                                        className="bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white px-3 py-2 rounded-lg text-xs font-bold transition duration-300 border border-red-500/30"
                                                        title="Reject / Withdraw"
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

                    {/* Mobile View Cards */}
                    <div className="md:hidden flex flex-col gap-4">
                        {allEvents.length === 0 ? (
                            <div className="py-8 text-center text-gray-500 italic">No events in the system.</div>
                        ) : (
                            allEvents.sort((a,b) => (a.status === 'pending' ? -1 : 1)).map(event => (
                                <div key={event.id} className={`p-4 rounded-xl border border-white/5 flex flex-col gap-3 ${event.status === 'pending' ? 'bg-yellow-500/5' : 'bg-white/5'}`}>
                                    <div className="flex justify-between items-start">
                                        <div className="flex items-center gap-3">
                                            <img src={event.image} className="w-12 h-12 rounded-lg object-cover bg-gray-700" alt="" />
                                            <div>
                                                <h4 className="text-white font-bold text-sm">{event.name}</h4>
                                                <div className="text-xs text-gray-400">{event.venue}</div>
                                            </div>
                                        </div>
                                        {event.status === 'pending' ? (
                                            <span className="bg-yellow-500/20 text-yellow-400 px-2 py-0.5 rounded text-[10px] font-bold border border-yellow-500/30 uppercase">
                                                Pending
                                            </span>
                                        ) : (
                                            <span className="bg-green-500/20 text-green-400 px-2 py-0.5 rounded text-[10px] font-bold border border-green-500/30 uppercase">
                                                Live
                                            </span>
                                        )}
                                    </div>
                                    
                                    <div className="grid grid-cols-2 gap-2 text-xs text-gray-400">
                                        <div>📅 {event.date}</div>
                                        <div>📞 {event.phone}</div>
                                        <div className="col-span-2">💰 {event.price}</div>
                                    </div>

                                    {event.isPromoted && (
                                        <div className="text-[10px] text-yellow-500 font-bold uppercase tracking-wider border border-yellow-500/20 bg-yellow-500/5 px-2 py-1 rounded w-fit">
                                            💎 Premium Request
                                        </div>
                                    )}

                                    <div className="flex gap-2 pt-2 border-t border-white/5 mt-1">
                                         {event.status === 'pending' && (
                                            <>
                                                <button 
                                                    onClick={() => handleApproveEvent(event.id, false)}
                                                    className="flex-1 bg-green-600 text-white py-2 rounded-lg text-xs font-bold"
                                                >
                                                    Ok
                                                </button>
                                                <button 
                                                    onClick={() => handleApproveEvent(event.id, true)}
                                                    className="flex-1 bg-yellow-600 text-white py-2 rounded-lg text-xs font-bold"
                                                >
                                                    💎 Ok
                                                </button>
                                            </>
                                        )}
                                        <button 
                                            onClick={() => setEditingEvent(event)}
                                            className="px-4 bg-blue-500/20 text-blue-400 py-2 rounded-lg text-xs font-bold"
                                        >
                                            ✏️
                                        </button>
                                        <button 
                                            onClick={() => handleDeleteEvent(event.id)}
                                            className="px-4 bg-red-500/20 text-red-500 py-2 rounded-lg text-xs font-bold"
                                        >
                                            🗑️
                                        </button>
                                    </div>
                                </div>
                            ))
                        )}
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