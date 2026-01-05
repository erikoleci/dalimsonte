import { createClient } from '@supabase/supabase-js';
import { AppEvent } from '../types';

// --- KONFIGURIMI I DATABAZËS ---

const SUPABASE_URL = 'https://ytfemeqepmffxckjeehg.supabase.co';

// Çelësi i dhënë nga përdoruesi
const USER_PROVIDED_KEY = 'sb_publishable_JhQVaiJFTKfWGUdVd_u7rw_Q91S5QcO';

const ENV_KEY = process.env.SUPABASE_KEY;
const LOCAL_KEY = localStorage.getItem('kudalim_supabase_key');

// Përdorim çelësin e disponueshëm (Env > Local > Hardcoded)
const SUPABASE_KEY = ENV_KEY || LOCAL_KEY || USER_PROVIDED_KEY;

let supabase: any = null;
let isConnected = false;
let tableMissing = false; // Track if table is missing

// Funksion ndihmës për të shmangur [object Object]
const getErrorText = (error: any): string => {
    if (!error) return 'Gabim i panjohur';
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
    console.warn("⚠️ Mungon SUPABASE_KEY! Aplikacioni po punon lokalisht.");
}

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
                    console.log('Ndryshim në DB u detektua!', payload);
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
        // Përpiqu të marrësh nga DB
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
                        console.warn("Tabela 'events' mungon. Duke kaluar në Local Storage.");
                    }
                    // Mos kthe error, vazhdo te Local Storage fallback
                } else if (data) {
                    tableMissing = false;
                    return data.map((e: any) => ({
                        ...e,
                        isPromoted: e.is_promoted 
                    }));
                }
            } catch (e) {
                console.error("Network error fetching events:", getErrorText(e));
            }
        }
        
        // Fallback: Local Storage (përdoret nëse DB dështon ose tabela mungon)
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
                    phone: event.phone,
                    status: event.status,
                    is_promoted: event.isPromoted || false
                }]);
                
                if (error) {
                    if (isTableMissingError(error)) {
                        tableMissing = true;
                        console.warn("Tabela mungon, po ruajmë lokalisht.");
                    } else {
                        const errorMsg = getErrorText(error);
                        console.error("DB Insert Error:", errorMsg);
                        alert("Gabim gjatë ruajtjes në database: " + errorMsg);
                        return false; 
                    }
                } else {
                    savedToDb = true;
                    tableMissing = false;
                }
            } catch (e: any) {
                console.error("Network error adding event:", getErrorText(e));
                // Vazhdojmë me local storage
            }
        }

        // Nëse nuk u ruajt në DB (ose tabela mungon), ruaj në Local Storage
        if (!savedToDb) {
            const events = await db.getEvents(); // Kjo merr local events nëse db fail
            // Evito duplikimet nëse getEvents ktheu nga DB por insert dështoi (edge case)
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
    }
};