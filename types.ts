export interface AppEvent {
  id: string;
  name: string;
  venue: string;
  city: string;
  date: string; // YYYY-MM-DD
  time?: string; // HH:MM
  type: string; // category value (see shared/constants.js)
  description: string;
  price: string;
  image: string;
  gallery?: string[]; // up to 3 photos
  phone: string; // reservations (WhatsApp)
  instagram?: string; // handle without @
  artists?: string; // line-up: singers / DJs, comma separated
  lat?: number; // venue pin
  lng?: number;
  address?: string; // short hint, e.g. "Blloku, pranë Piramidës"
  status: 'pending' | 'approved';
  isPromoted?: boolean; // Premium (approved + paid)
  wantsPromotion?: boolean; // venue asked for Premium when submitting
  views?: number;
  clicks?: number;
  createdAt?: string;
}

export interface AppNotification {
  id: string;
  message: string;
  type: 'success' | 'info' | 'warning';
}

export type DateFilter = 'tonight' | 'tomorrow' | 'weekend' | 'week' | 'all' | 'custom';
