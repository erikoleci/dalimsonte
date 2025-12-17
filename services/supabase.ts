import { createClient } from '@supabase/supabase-js';
import { AppEvent } from '../types';

// --- KONFIGURIMI I DATABAZËS ---

const SUPABASE_URL = 'https://ytfemeqepmffxckjeehg.supabase.co';

// Këtu vendosëm çelësin që dërgove ti
const USER_PROVIDED_KEY = 'sb_publishable_JhQVaiJFTKfWGUdVd_u7rw_Q91S5QcO';

const ENV_KEY = process.env.SUPABASE_KEY;
const LOCAL_KEY = localStorage.getItem('kudalim_supabase_key');

// Përdorim çelësin tënd si fallback kryesor që të mos dalë ekran i zi
const SUPABASE_KEY = ENV_KEY || LOCAL_KEY || USER_PROVIDED_KEY;

let supabase: any = null;
let isConnected = false;

// Initialization e sigurt që të mos bëjë crash app-in
if (SUPABASE_URL && SUPABASE_KEY) {
    try {
        supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
        isConnected = true;
    } catch (e) {
        console.error("Supabase init error (Key might be invalid):", e);
        isConnected = false; // Sigurohemi që app vazhdon punën offline
    }
} else {
    console.warn("⚠️ Mungon SUPABASE_KEY! Aplikacioni po punon lokalisht.");
}

export const db = {
    isConnected: () => isConnected,
    
    getProjectID: () => 'ytfemeqepmffxckjeehg',

    setManualKey: (key: string) => {
        if (!key) return;
        localStorage.setItem('kudalim_supabase_key', key.trim());
        window.location.reload();
    },

    subscribeToEvents: (callback: () => void) => {
        if (!isConnected || !supabase) return null;

        try {
            const channel = supabase.channel('custom-all-channel')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'events' },
                (payload: any) => {
                    console.log('Ndryshim në DB u detektua!', payload);
                    callback(); 
                }
            )
            .subscribe();
            return channel;
        } catch (e) {
            console.error("Subscription error:", e);
            return null;
        }
    },

    getEvents: async (): Promise<AppEvent[]> => {
        if (isConnected && supabase) {
            try {
                const { data, error } = await supabase
                    .from('events')
                    .select('*')
                    .order('date', { ascending: true });

                if (!error && data) {
                    return data.map((e: any) => ({
                        ...e,
                        isPromoted: e.is_promoted 
                    }));
                } else {
                    console.error("Error fetching events:", error);
                }
            } catch (e) {
                console.error("Network error fetching events:", e);
            }
        }
        
        const local = localStorage.getItem('kudalim_events');
        return local ? JSON.parse(local) : [];
    },

    addEvent: async (event: AppEvent) => {
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
                    phone: event.phone,
                    status: event.status,
                    is_promoted: event.isPromoted || false
                }]);
                
                if (error) {
                    console.error("DB Insert Error", error);
                    alert("Gabim gjatë ruajtjes në database: " + error.message);
                    return false;
                }
                return true;
            } catch (e) {
                console.error("Network error adding event:", e);
                return false;
            }
        } else {
            const events = await db.getEvents();
            const newEvents = [event, ...events];
            localStorage.setItem('kudalim_events', JSON.stringify(newEvents));
            return true;
        }
    },

    updateEventStatus: async (id: string, status: 'pending' | 'approved', isPromoted: boolean) => {
        if (isConnected && supabase) {
            await supabase.from('events').update({ status, is_promoted: isPromoted }).eq('id', id);
        } else {
            const events = await db.getEvents();
            const newEvents = events.map(e => e.id === id ? { ...e, status, isPromoted } : e);
            localStorage.setItem('kudalim_events', JSON.stringify(newEvents));
        }
    },

    deleteEvent: async (id: string) => {
        if (isConnected && supabase) {
            await supabase.from('events').delete().eq('id', id);
        } else {
            const events = await db.getEvents();
            const newEvents = events.filter(e => e.id !== id);
            localStorage.setItem('kudalim_events', JSON.stringify(newEvents));
        }
    }
};