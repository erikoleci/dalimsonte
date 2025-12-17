import { createClient } from '@supabase/supabase-js';
import { AppEvent } from '../types';

// --- KONFIGURIMI I DATABAZËS ---

// URL-ja e projektit tënd në Supabase
const SUPABASE_URL = 'https://ytfemeqepmffxckjeehg.supabase.co';

// KUJDES: Sigurohu që ke krijuar një file .env në root me:
// VITE_SUPABASE_KEY=vendos_ketu_anon_public_key_tende
const SUPABASE_KEY = process.env.SUPABASE_KEY;

let supabase: any = null;
let isConnected = false;

if (SUPABASE_URL && SUPABASE_KEY) {
    try {
        supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
        isConnected = true;
    } catch (e) {
        console.error("Supabase init error:", e);
    }
} else {
    // Kjo shfaqet nëse harron të vendosësh çelësin.
    // Pa këtë, sinkronizimi PC <-> Celular NUK PUNON.
    console.warn("⚠️ Mungon SUPABASE_KEY! Aplikacioni po punon lokalisht dhe nuk do sinkronizohet.");
}

export const db = {
    isConnected: () => isConnected,
    
    getProjectID: () => 'ytfemeqepmffxckjeehg',

    // --- REAL-TIME LISTENER ---
    // Kjo funksion bën magjinë. Dëgjon çdo ndryshim në tabelën 'events'.
    subscribeToEvents: (callback: () => void) => {
        if (!isConnected) return null;

        const channel = supabase.channel('custom-all-channel')
        .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'events' },
            (payload: any) => {
                console.log('Ndryshim në DB u detektua!', payload);
                callback(); // I themi App.tsx të rifreskojë të dhënat
            }
        )
        .subscribe();

        return channel;
    },

    getEvents: async (): Promise<AppEvent[]> => {
        if (isConnected) {
            // Marrim eventet më të reja së pari
            const { data, error } = await supabase
                .from('events')
                .select('*')
                .order('date', { ascending: true }); // Ose false për më të rejat lart

            if (!error && data) {
                return data.map((e: any) => ({
                    ...e,
                    isPromoted: e.is_promoted // Map DB column to Typescript interface
                }));
            } else {
                console.error("Error fetching events:", error);
            }
        }
        
        // Fallback vetëm nëse s'ka internet ose key
        const local = localStorage.getItem('kudalim_events');
        return local ? JSON.parse(local) : [];
    },

    addEvent: async (event: AppEvent) => {
        if (isConnected) {
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
        } else {
            // Ruajtje lokale (nuk del në celular)
            const events = await db.getEvents();
            const newEvents = [event, ...events];
            localStorage.setItem('kudalim_events', JSON.stringify(newEvents));
            return true;
        }
    },

    updateEventStatus: async (id: string, status: 'pending' | 'approved', isPromoted: boolean) => {
        if (isConnected) {
            await supabase.from('events').update({ status, is_promoted: isPromoted }).eq('id', id);
        } else {
            const events = await db.getEvents();
            const newEvents = events.map(e => e.id === id ? { ...e, status, isPromoted } : e);
            localStorage.setItem('kudalim_events', JSON.stringify(newEvents));
        }
    },

    deleteEvent: async (id: string) => {
        if (isConnected) {
            await supabase.from('events').delete().eq('id', id);
        } else {
            const events = await db.getEvents();
            const newEvents = events.filter(e => e.id !== id);
            localStorage.setItem('kudalim_events', JSON.stringify(newEvents));
        }
    }
};