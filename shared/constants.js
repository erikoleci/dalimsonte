// Shared between the frontend (Vite) and the serverless API (/api).
// Category `value`s are what's stored in the database — don't rename them,
// only the labels.

export const CITIES = [
  'Tiranë',
  'Durrës',
  'Vlorë',
  'Sarandë',
  'Ksamil',
  'Dhërmi',
  'Himarë',
  'Shkodër',
  'Korçë',
  'Elbasan',
  'Fier',
  'Berat',
  'Pogradec',
  'Shëngjin',
];

export const CATEGORIES = [
  { value: 'Techno/House', sq: 'Techno / House', en: 'Techno / House', icon: '🎧' },
  { value: 'Hip Hop / R&B', sq: 'Hip Hop / R&B', en: 'Hip Hop / R&B', icon: '🎤' },
  { value: 'Live Music', sq: 'Muzikë live', en: 'Live music', icon: '🎸' },
  { value: 'Albanian', sq: 'Muzikë shqip', en: 'Albanian music', icon: '🇦🇱' },
  { value: 'Latino', sq: 'Latino', en: 'Latino', icon: '💃' },
  { value: 'Beach Party', sq: 'Beach party', en: 'Beach party', icon: '🏖️' },
  { value: 'Chill / Lounge', sq: 'Chill / Lounge', en: 'Chill / Lounge', icon: '🍸' },
  { value: 'Rock', sq: 'Rock', en: 'Rock', icon: '🤘' },
  { value: 'Karaoke', sq: 'Karaoke', en: 'Karaoke', icon: '🎙️' },
  { value: 'Other', sq: 'Tjetër', en: 'Other', icon: '✨' },
];

export const CATEGORY_VALUES = CATEGORIES.map((c) => c.value);

export const LIMITS = {
  name: 80,
  venue: 80,
  description: 1500,
  price: 40,
  phone: 25,
  instagram: 40,
  artists: 150,
  address: 120,
  time: 5,
  maxPhotos: 3,
};

// Admin contact shown after a venue submits an event.
export const ADMIN_CONTACT = {
  display: '068 81 55 866',
  whatsapp: '355688155866',
};

// Map centre for each city [lat, lng]
export const CITY_COORDS = {
  'Tiranë': [41.3245, 19.8187],
  'Durrës': [41.3149, 19.4458],
  'Vlorë': [40.4613, 19.4836],
  'Sarandë': [39.8756, 20.0053],
  'Ksamil': [39.7716, 20.0006],
  'Dhërmi': [40.1531, 19.6347],
  'Himarë': [40.1013, 19.7450],
  'Shkodër': [42.0683, 19.5126],
  'Korçë': [40.6186, 20.7808],
  'Elbasan': [41.1125, 20.0822],
  'Fier': [40.7239, 19.5561],
  'Berat': [40.7058, 19.9522],
  'Pogradec': [40.9025, 20.6525],
  'Shëngjin': [41.8136, 19.5939],
};

// Rough bounding box around Albania (with a margin) — pins outside are rejected.
export const MAP_BOUNDS = { minLat: 39.5, maxLat: 42.8, minLng: 18.9, maxLng: 21.2 };
