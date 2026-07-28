export interface AppEvent {
  id: string;
  name: string;
  venue: string;
  city: string;
  date: string; // YYYY-MM-DD
  type: string;
  description: string;
  price: string;
  image: string;
  gallery?: string[]; // up to 3 photos
  phone: string; // Contact number for reservations
  status: 'pending' | 'approved'; // New field for approval workflow
  isPromoted?: boolean; // New field for monetization (Premium events)
  views?: number; // Analytics: how many times the event was opened
  clicks?: number; // Analytics: how many times "Reserve Now" was clicked
}

export interface AppNotification {
  id: string;
  message: string;
  type: 'success' | 'info' | 'warning';
}