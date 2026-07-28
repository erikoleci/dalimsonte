import { createClient } from '@supabase/supabase-js';
import { AppEvent } from '../types';

// --- DATABASE CONFIGURATION ---

const SUPABASE_URL = 'https://ytfemeqepmffxckjeehg.supabase.co';

// Key provided by the user
const USER_PROVIDED_KEY = 'sb_publishable_JhQVaiJFTKfWGUdVd_u7rw_Q91S5QcO';

const ENV_KEY = process.env.SUPABASE_KEY;
const LOCAL_KEY = localStorage.getItem('kudalim_supabase_key');

// Use the available key (Env > Local > Hardcoded)
const SUPABASE_KEY = ENV_KEY || LOCAL_KEY || USER_PROVIDED_KEY;

let supabase: any = null;
let isConnected = false;
let tableMissing = false; // Track if table is missing

// Helper function to avoid [object Object]
const getErrorText = (error: any): string => {
    if (!error) return 'Unknown error';
    if (typeof error === 'string') return error;
    if (error.message) return error.message;
    return JSON.stringify(error, null, 2);
};

// Check if error is related to missing table
const isTableMissingError = (error: any) => {
    const msg = getErrorText(error);
    return msg.includes('Could not find the table') || msg.includes('relation "public.events" does not exist');
};

if (SUPABASE_URL && SUPABASE_KEY) {
    try {
        supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
        isConnected = true;
    } catch (e) {
        console.error("Supabase init error:", getErrorText(e));
        isConnected = false;
    }
} else {
    console.warn("⚠️ SUPABASE_KEY is missing! The app is running locally.");
}

const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
};

// Uploads 1 photo to the 'event-images' bucket; if it fails (bucket missing, etc.), falls back to Base64
export const uploadEventImage = async (file: File): Promise<string> => {
    if (isConnected && supabase) {
        try {
            const fileExt = file.name.split('.').pop() || 'jpg';
            const fileName = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}.${fileExt}`;
            const { error } = await supabase.storage
                .from('event-images')
                .upload(fileName, file, { cacheControl: '3600', upsert: true });

            if (!error) {
                const { data } = supabase.storage.from('event-images').getPublicUrl(fileName);
                if (data?.publicUrl) return data.publicUrl;
            } else {
                console.warn('Storage upload failed, using Base64 fallback:', error.message);
            }
        } catch (e) {
            console.warn('Storage upload exception, using Base64 fallback:', e);
        }
    }
    return await fileToBase64(file);
};

// Uploads up to 3 photos and returns the URLs, in the given order
export const uploadEventImages = async (files: File[]): Promise<string[]> => {
    const limited = files.slice(0, 3);
    const urls: string[] = [];
    for (const file of limited) {
        urls.push(await uploadEventImage(file));
    }
    return urls;
};

export const db = {
    isConnected: () => isConnected,
    isTableMissing: () => tableMissing,
    
    getProjectID: () => 'ytfemeqepmffxckjeehg',

    setManualKey: (key: string) => {
        if (!key) return;
        localStorage.setItem('kudalim_supabase_key', key.trim());
        window.location.reload();
    },

    subscribeToEvents: (callback: () => void) => {
        if (!isConnected || !supabase || tableMissing) return null;

        try {
            const channel = supabase.channel('custom-all-channel')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'events' },
                (payload: any) => {
                    console.log('DB change detected!', payload);
                    callback(); 
                }
            )
            .subscribe();
            return channel;
        } catch (e) {
            console.error("Subscription error:", getErrorText(e));
            return null;
        }
    },

    getEvents: async (): Promise<AppEvent[]> => {
        // Try to fetch from DB
        if (isConnected && supabase) {
            try {
                const { data, error } = await supabase
                    .from('events')
                    .select('*')
                    .order('date', { ascending: true });

                if (error) {
                    console.error("Supabase Error:", getErrorText(error));
                    if (isTableMissingError(error)) {
                        tableMissing = true;
                        console.warn("The 'events' table is missing. Falling back to Local Storage.");
                    }
                    // Don't return the error, continue to Local Storage fallback
                } else if (data) {
                    tableMissing = false;
                    return data.map((e: any) => ({
                        ...e,
                        isPromoted: e.is_promoted,
                        gallery: Array.isArray(e.gallery_urls) ? e.gallery_urls : []
                    }));
                }
            } catch (e) {
                console.error("Network error fetching events:", getErrorText(e));
            }
        }
        
        // Fallback: Local Storage (used if the DB fails or the table is missing)
        const local = localStorage.getItem('kudalim_events');
        return local ? JSON.parse(local) : [];
    },

    addEvent: async (event: AppEvent) => {
        let savedToDb = false;

        if (isConnected && supabase) {
            try {
                const { error } = await supabase.from('events').insert([{
                    id: event.id,
                    name: event.name,
                    venue: event.venue,
                    city: event.city,
                    date: event.date,
                    type: event.type,
                    description: event.description,
                    price: event.price,
                    image: event.image,
                    gallery_urls: event.gallery || [],
                    phone: event.phone,
                    status: event.status,
                    is_promoted: event.isPromoted || false
                }]);
                
                if (error) {
                    if (isTableMissingError(error)) {
                        tableMissing = true;
                        console.warn("Table is missing, saving locally.");
                    } else {
                        const errorMsg = getErrorText(error);
                        console.error("DB Insert Error:", errorMsg);
                        alert("Error while saving to database: " + errorMsg);
                        return false; 
                    }
                } else {
                    savedToDb = true;
                    tableMissing = false;
                }
            } catch (e: any) {
                console.error("Network error adding event:", getErrorText(e));
                // Continue with local storage
            }
        }

        // If it wasn't saved to the DB (or the table is missing), save to Local Storage
        if (!savedToDb) {
            const events = await db.getEvents(); // This gets local events if the db call fails
            // Avoid duplicates if getEvents returned from DB but insert failed (edge case)
            const exists = events.some(e => e.id === event.id);
            if (!exists) {
                const newEvents = [event, ...events];
                localStorage.setItem('kudalim_events', JSON.stringify(newEvents));
            }
        }
        
        return true;
    },

    updateEventStatus: async (id: string, status: 'pending' | 'approved', isPromoted: boolean) => {
        let updatedDb = false;
        if (isConnected && supabase && !tableMissing) {
            try {
                const { error } = await supabase.from('events').update({ status, is_promoted: isPromoted }).eq('id', id);
                if (!error) updatedDb = true;
                else if (isTableMissingError(error)) tableMissing = true;
            } catch (e) {
                console.error("Network error updating event:", getErrorText(e));
            }
        } 
        
        // Always update local storage too/fallback
        const events = await db.getEvents();
        const newEvents = events.map(e => e.id === id ? { ...e, status, isPromoted } : e);
        localStorage.setItem('kudalim_events', JSON.stringify(newEvents));
    },

    // Full edit (when the admin makes a mistake and wants to fix the name, date, price, etc.)
    updateEvent: async (id: string, updates: Partial<AppEvent>) => {
        if (isConnected && supabase && !tableMissing) {
            try {
                const payload: any = { ...updates };
                if ('isPromoted' in payload) {
                    payload.is_promoted = payload.isPromoted;
                    delete payload.isPromoted;
                }
                if ('gallery' in payload) {
                    payload.gallery_urls = payload.gallery;
                    delete payload.gallery;
                }
                delete payload.id;
                const { error } = await supabase.from('events').update(payload).eq('id', id);
                if (error && isTableMissingError(error)) tableMissing = true;
            } catch (e) {
                console.error("Network error editing event:", getErrorText(e));
            }
        }

        const events = await db.getEvents();
        const newEvents = events.map(e => e.id === id ? { ...e, ...updates } : e);
        localStorage.setItem('kudalim_events', JSON.stringify(newEvents));
    },

    deleteEvent: async (id: string) => {
        if (isConnected && supabase && !tableMissing) {
            try {
               const { error } = await supabase.from('events').delete().eq('id', id);
               if (isTableMissingError(error)) tableMissing = true;
            } catch (e) {
               console.error("Network error deleting event:", getErrorText(e));
            }
        }

        const events = await db.getEvents();
        const newEvents = events.filter(e => e.id !== id);
        localStorage.setItem('kudalim_events', JSON.stringify(newEvents));
    },

    // --- App Settings (e.g. the admin password) — stored in the DB, not locally,
    // so they're the same for anyone who logs in, from any device.
    getSetting: async (key: string, fallback: string): Promise<string> => {
        if (isConnected && supabase) {
            try {
                const { data, error } = await supabase
                    .from('app_settings')
                    .select('value')
                    .eq('key', key)
                    .maybeSingle();
                if (!error && data?.value) return data.value;
            } catch (e) {
                console.error("Error fetching setting:", getErrorText(e));
            }
        }
        return localStorage.getItem(`kudalim_setting_${key}`) || fallback;
    },

    setSetting: async (key: string, value: string): Promise<boolean> => {
        localStorage.setItem(`kudalim_setting_${key}`, value); // always keep a local fallback
        if (isConnected && supabase) {
            try {
                const { error } = await supabase
                    .from('app_settings')
                    .upsert({ key, value }, { onConflict: 'key' });
                return !error;
            } catch (e) {
                console.error("Error saving setting:", getErrorText(e));
                return false;
            }
        }
        return true;
    },

    // --- Analytics: fire-and-forget view/click tracking (never blocks the UI) ---
    trackEventView: async (id: string) => {
        if (isConnected && supabase && !tableMissing) {
            try {
                await supabase.rpc('increment_event_views', { event_id: id });
            } catch (e) {
                console.warn("View tracking failed (non-critical):", getErrorText(e));
            }
        }
    },

    trackEventClick: async (id: string) => {
        if (isConnected && supabase && !tableMissing) {
            try {
                await supabase.rpc('increment_event_clicks', { event_id: id });
            } catch (e) {
                console.warn("Click tracking failed (non-critical):", getErrorText(e));
            }
        }
    }
};