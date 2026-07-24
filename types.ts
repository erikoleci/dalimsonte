export interface SearchParams {
  city: string;
  date: string;
  category: string;
}

export interface GroundingChunk {
  web?: {
    uri: string;
    title: string;
  };
  maps?: {
    uri: string;
    title: string;
    placeId?: string;
  };
}

export interface SearchResponse {
  text: string;
  groundingChunks: GroundingChunk[];
}

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
  gallery?: string[]; // deri në 3 foto
  phone: string; // Contact number for reservations
  status: 'pending' | 'approved'; // New field for approval workflow
  isPromoted?: boolean; // New field for monetization (Premium events)
}

// For the UI simulation of "Venue Accounts"
export interface VenuePackage {
  id: string;
  name: string;
  price: string;
  features: string[];
}

export interface AppNotification {
  id: string;
  message: string;
  type: 'success' | 'info' | 'warning';
}