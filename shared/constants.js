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
  time: 5,
  maxPhotos: 3,
};

// Admin contact shown after a venue submits an event.
export const ADMIN_CONTACT = {
  display: '068 81 55 866',
  whatsapp: '355688155866',
};
