import React, { createContext, useContext, useEffect, useState } from 'react';
import { CATEGORIES } from '../shared/constants.js';

export type Lang = 'sq' | 'en';

const dict = {
  // nav
  'nav.saved': { sq: 'Të ruajturat', en: 'Saved' },
  'nav.publish': { sq: 'Publiko event', en: 'Post an event' },
  'nav.publishShort': { sq: 'Publiko', en: 'Post' },
  'nav.install': { sq: 'Instalo', en: 'Install' },

  // hero
  'hero.badge': { sq: 'Nata jote fillon këtu', en: 'Your night starts here' },
  'hero.title1': { sq: 'Mos rri në shtëpi.', en: "Don't stay home." },
  'hero.title2': { sq: 'Gjej ku dalim sonte.', en: 'Find where to go tonight.' },
  'hero.sub': {
    sq: 'Festa, koncerte dhe evente të postuara direkt nga lokalet në qytetin tënd. Zgjidh vibe-in, rezervo me një mesazh.',
    en: 'Parties, concerts and events posted directly by venues in your city. Pick a vibe, reserve with one message.',
  },
  'hero.cta': { sq: 'Shiko çfarë ka sonte', en: "See what's on tonight" },
  'hero.organizer': { sq: 'Ke lokal? Publiko falas', en: 'Own a venue? Post for free' },
  'hero.liveCount': { sq: 'evente sonte', en: 'events tonight' },
  'hero.cities': { sq: 'qytete', en: 'cities' },

  // feed
  'feed.title': { sq: 'Çfarë ka', en: "What's on" },
  'feed.allTitle': { sq: 'Të gjitha eventet', en: 'All upcoming events' },
  'date.tonight': { sq: 'Sonte', en: 'Tonight' },
  'date.tomorrow': { sq: 'Nesër', en: 'Tomorrow' },
  'date.weekend': { sq: 'Fundjavë', en: 'Weekend' },
  'date.week': { sq: 'Këtë javë', en: 'This week' },
  'date.all': { sq: 'Të gjitha', en: 'All' },
  'date.pick': { sq: 'Zgjidh datën', en: 'Pick a date' },
  'city.all': { sq: 'Gjithë Shqipëria', en: 'All of Albania' },
  'vibe.all': { sq: 'Çdo vibe', en: 'Any vibe' },
  'feed.search': { sq: 'Kërko këngëtar, DJ, event, lokal…', en: 'Search artist, DJ, event, venue…' },
  'feed.searchTitle': { sq: 'Rezultatet për', en: 'Results for' },
  'feed.searchAllDates': { sq: 'Kërkimi përfshin të gjitha datat', en: 'Search covers all upcoming dates' },
  'feed.clear': { sq: 'Pastro', en: 'Clear' },
  'hero.searchPh': { sq: 'Kërko këngëtar, DJ, lokal…', en: 'Search artist, DJ, venue…' },
  'hero.search': { sq: 'Kërko', en: 'Search' },
  'venue.artists': { sq: 'Këngëtarët / DJ (opsionale)', en: 'Artists / DJs (optional)' },
  'venue.artistsPh': { sq: 'p.sh. Noizy, DJ Gimi O', en: 'e.g. Noizy, DJ Gimi O' },
  'details.lineup': { sq: 'Line-up', en: 'Line-up' },
  'stories.title': { sq: 'Sonte', en: 'Tonight' },
  'stories.next': { sq: 'Së shpejti', en: 'Coming up' },
  'stories.open': { sq: 'Shiko detajet', en: 'See details' },
  'stories.reserve': { sq: 'Rezervo', en: 'Reserve' },
  'trending.title': { sq: 'Më të kërkuarat tani', en: 'Trending now' },
  'trending.views': { sq: 'e panë', en: 'views' },
  'trending.seen': { sq: 'veta e kanë parë', en: 'people viewed this' },
  'story.share': { sq: 'Ndaj në Story', en: 'Share to Story' },
  'story.making': { sq: 'Duke krijuar…', en: 'Creating…' },
  'story.saved': { sq: 'Imazhi u shkarkua — postoje në Story! 📸', en: 'Image downloaded — post it to your Story! 📸' },
  'story.cta': { sq: 'Rezervo te', en: 'Reserve at' },
  'col.venue': { sq: 'Lokal', en: 'Venue' },
  'col.artist': { sq: 'Artist / DJ', en: 'Artist / DJ' },
  'col.upcoming': { sq: 'evente të ardhshme', en: 'upcoming events' },
  'col.upcoming1': { sq: 'event i ardhshëm', en: 'upcoming event' },
  'col.empty': { sq: 'Asnjë event i ardhshëm për momentin.', en: 'No upcoming events right now.' },
  'col.follow': { sq: 'Ndiq në Instagram', en: 'Follow on Instagram' },
  'col.share': { sq: 'Shpërndaj faqen', en: 'Share page' },
  'search.artists': { sq: 'Artistë', en: 'Artists' },
  'search.venues': { sq: 'Lokale', en: 'Venues' },
  'map.list': { sq: 'Listë', en: 'List' },
  'map.map': { sq: 'Hartë', en: 'Map' },
  'map.none': { sq: 'Asnjë nga këto evente nuk ka ende vendndodhje në hartë.', en: 'None of these events has a map location yet.' },
  'map.withoutPin': { sq: 'evente pa vendndodhje nuk shfaqen në hartë', en: 'events without a location are not shown' },
  'map.pickTitle': { sq: 'Ku ndodhet lokali?', en: 'Where is the venue?' },
  'map.pickHint': { sq: 'Prek hartën ose tërhiq pin-in te hyrja e lokalit.', en: 'Tap the map or drag the pin to the venue entrance.' },
  'map.useMine': { sq: 'Jam te lokali tani', en: "I'm at the venue now" },
  'map.locating': { sq: 'Duke gjetur…', en: 'Locating…' },
  'map.geoError': { sq: 'Nuk u gjet vendndodhja. Vendose pin-in me dorë.', en: "Couldn't get your location. Place the pin manually." },
  'map.clear': { sq: 'Hiq pin-in', en: 'Remove pin' },
  'map.set': { sq: '✓ Vendndodhja u vendos', en: '✓ Location set' },
  'map.address': { sq: 'Shënim për adresën (opsionale)', en: 'Address hint (optional)' },
  'map.addressPh': { sq: 'p.sh. Blloku, pranë Piramidës', en: 'e.g. Blloku, next to the Pyramid' },
  'map.directions': { sq: 'Udhëzime', en: 'Directions' },
  'going.btn': { sq: 'Po shkoj', en: "I'm going" },
  'going.on': { sq: 'Po shkon ✓', en: "You're going ✓" },
  'going.count': { sq: 'po shkojnë', en: 'going' },
  'going.count1': { sq: 'po shkon', en: 'going' },
  'going.first': { sq: 'Bëhu i pari që shkon!', en: 'Be the first to go!' },
  'going.toast': { sq: 'Super! Shihemi atje 🙌', en: 'Awesome! See you there 🙌' },
  'together.btn': { sq: 'Shkojmë bashkë', en: 'Go together' },
  'together.title': { sq: 'Shkojmë bashkë 👯', en: 'Go together 👯' },
  'together.sub': {
    sq: 'Zgjidh 2–3 evente dhe dërgoja shokëve. Ata votojnë, dhe fiton ai me më shumë vota.',
    en: 'Pick 2–3 events and send them to friends. They vote and the most popular wins.',
  },
  'together.pick': { sq: 'Shto edhe 1–2 evente', en: 'Add 1–2 more events' },
  'together.question': { sq: 'Pyetja (opsionale)', en: 'Question (optional)' },
  'together.questionPh': { sq: 'p.sh. Ku dalim të shtunën?', en: 'e.g. Where are we going Saturday?' },
  'together.create': { sq: 'Krijo dhe dërgo në WhatsApp', en: 'Create & send on WhatsApp' },
  'together.creating': { sq: 'Duke krijuar…', en: 'Creating…' },
  'together.need': { sq: 'Zgjidh të paktën 2 evente', en: 'Pick at least 2 events' },
  'together.waText': { sq: '🗳️ Ku dalim? Voto këtu:', en: '🗳️ Where are we going? Vote here:' },
  'poll.default': { sq: 'Ku dalim?', en: 'Where are we going?' },
  'poll.votes': { sq: 'vota', en: 'votes' },
  'poll.vote1': { sq: 'votë', en: 'vote' },
  'poll.yourName': { sq: 'Emri yt (që ta dinë shokët)', en: 'Your name (so friends know)' },
  'poll.tap': { sq: 'Prek eventin ku do të shkosh', en: 'Tap the event you want' },
  'poll.yourVote': { sq: 'Vota jote', en: 'Your vote' },
  'poll.leading': { sq: 'Po fiton', en: 'Leading' },
  'poll.share': { sq: 'Ftoji edhe të tjerët', en: 'Invite more friends' },
  'poll.new': { sq: 'Krijo votimin tënd', en: 'Create your own vote' },
  'poll.notFound': { sq: 'Ky votim nuk ekziston më.', en: 'This vote no longer exists.' },
  'poll.open': { sq: 'Hap', en: 'Open' },
  'poll.copied': { sq: 'Linku u kopjua — ngjite në grup!', en: 'Link copied — paste it in your group!' },
  'surprise.btn': { sq: 'Më surprizo', en: 'Surprise me' },
  'surprise.title': { sq: 'Sonte shkon te…', en: "Tonight you're going to…" },
  'surprise.again': { sq: 'Provo përsëri 🎲', en: 'Spin again 🎲' },
  'surprise.go': { sq: 'Hap eventin', en: 'Open event' },
  'surprise.none': { sq: 'Nuk ka evente për këtë zgjedhje. Ndrysho filtrat!', en: 'No events for this selection. Change the filters!' },
  'summer.badge': { sq: '☀️ Sezoni i verës', en: '☀️ Summer season' },
  'feed.results': { sq: 'evente', en: 'events' },
  'feed.result': { sq: 'event', en: 'event' },
  'feed.empty.title': { sq: 'Asgjë për këtë zgjedhje', en: 'Nothing for this selection' },
  'feed.empty.sub': { sq: 'Provo një datë tjetër ose një qytet tjetër.', en: 'Try another date or city.' },
  'feed.empty.next': { sq: 'Ja çfarë vjen së shpejti', en: "Here's what's coming up" },
  'feed.empty.reset': { sq: 'Shiko të gjitha eventet', en: 'See all events' },
  'feed.loading': { sq: 'Duke ngarkuar…', en: 'Loading…' },
  'feed.notify': { sq: 'Më njofto', en: 'Notify me' },
  'feed.notifyOn': { sq: 'Do të njoftohesh', en: "You'll be notified" },

  // card / details
  'card.premium': { sq: 'Premium', en: 'Featured' },
  'card.free': { sq: 'Falas', en: 'Free' },
  'details.about': { sq: 'Rreth eventit', en: 'About the event' },
  'details.date': { sq: 'Data', en: 'Date' },
  'details.time': { sq: 'Ora', en: 'Time' },
  'details.timeDefault': { sq: 'Nga ora 22:00', en: 'From 22:00' },
  'details.age': { sq: 'Mosha', en: 'Age' },
  'details.contact': { sq: 'Rezervime', en: 'Reservations' },
  'details.price': { sq: 'Hyrja', en: 'Entry' },
  'details.reserve': { sq: 'Rezervo në WhatsApp', en: 'Reserve on WhatsApp' },
  'details.call': { sq: 'Telefono', en: 'Call' },
  'details.map': { sq: 'Hap në hartë', en: 'Open in maps' },
  'details.calendar': { sq: 'Shto në kalendar', en: 'Add to calendar' },
  'details.share': { sq: 'Shpërndaj', en: 'Share' },
  'details.copied': { sq: 'Linku u kopjua!', en: 'Link copied!' },
  'details.back': { sq: 'Mbrapa', en: 'Back' },
  'details.more': { sq: 'Më shumë në', en: 'More at' },
  'details.reserveMsg': {
    sq: 'Përshëndetje! Dua të rezervoj për "{name}" më {date}. E gjeta në Ku Dalim Sonte?',
    en: 'Hi! I would like to reserve for "{name}" on {date}. Found it on Ku Dalim Sonte?',
  },

  // saved
  'saved.title': { sq: 'Eventet e ruajtura', en: 'Saved events' },
  'saved.empty': { sq: 'Ende asnjë event i ruajtur', en: 'No saved events yet' },
  'saved.emptySub': { sq: 'Shtyp zemrën te një event për ta ruajtur këtu.', en: 'Tap the heart on an event to save it here.' },
  'saved.browse': { sq: 'Shfleto eventet', en: 'Browse events' },
  'toast.saved': { sq: 'U ruajt te të preferuarat ❤️', en: 'Saved to favorites ❤️' },
  'toast.unsaved': { sq: 'U hoq nga të preferuarat', en: 'Removed from favorites' },
  'toast.subOn': { sq: 'Do të të njoftojmë për evente të reja në {city}', en: "We'll let you know about new events in {city}" },
  'toast.subOff': { sq: 'Njoftimet për {city} u çaktivizuan', en: 'Notifications for {city} turned off' },
  'toast.newEvents': { sq: 'Evente të reja u shtuan ✨', en: 'New events just added ✨' },

  // venue form
  'venue.title': { sq: 'Publiko eventin tënd', en: 'Post your event' },
  'venue.sub': {
    sq: 'Falas. Eventi shfaqet pasi e aprovojmë (zakonisht brenda pak orësh).',
    en: 'Free. Your event goes live once we approve it (usually within a few hours).',
  },
  'venue.venueName': { sq: 'Emri i lokalit', en: 'Venue name' },
  'venue.eventName': { sq: 'Emri i eventit', en: 'Event name' },
  'venue.city': { sq: 'Qyteti', en: 'City' },
  'venue.date': { sq: 'Data', en: 'Date' },
  'venue.time': { sq: 'Ora e fillimit', en: 'Start time' },
  'venue.type': { sq: 'Vibe / Kategoria', en: 'Vibe / Category' },
  'venue.price': { sq: 'Çmimi i hyrjes', en: 'Entry price' },
  'venue.phone': { sq: 'Numri për rezervime (WhatsApp)', en: 'Reservations number (WhatsApp)' },
  'venue.instagram': { sq: 'Instagram i lokalit (opsionale)', en: 'Venue Instagram (optional)' },
  'venue.photos': { sq: 'Posteri / foto (deri në 3)', en: 'Poster / photos (up to 3)' },
  'venue.addPhotos': { sq: 'Shto foto', en: 'Add photos' },
  'venue.maxPhotos': { sq: 'Maksimumi 3 foto', en: 'Maximum 3 photos' },
  'venue.description': { sq: 'Përshkrimi', en: 'Description' },
  'venue.descPh': { sq: 'DJ, atmosfera, dress code, oferta…', en: 'DJ, atmosphere, dress code, offers…' },
  'venue.premiumTitle': { sq: 'Bëje Premium', en: 'Make it Featured' },
  'venue.premiumSub': {
    sq: 'Shfaqet i pari, me shenjën Premium dhe merr deri në 3x më shumë rezervime.',
    en: 'Shown first, with a Featured badge — up to 3x more reservations.',
  },
  'venue.premiumPrice': { sq: '1000 LEK / event', en: '1000 LEK / event' },
  'venue.recommended': { sq: 'REKOMANDOHET', en: 'RECOMMENDED' },
  'venue.terms': { sq: 'Pranoj', en: 'I accept the' },
  'venue.termsLink': { sq: 'politikën e privatësisë', en: 'privacy policy' },
  'venue.termsRest': {
    sq: 'dhe konfirmoj që kam të drejtë ta publikoj këtë event.',
    en: 'and confirm I have the right to publish this event.',
  },
  'venue.submit': { sq: 'Dërgo për aprovim', en: 'Submit for approval' },
  'venue.uploading': { sq: 'Duke ngarkuar fotot…', en: 'Uploading photos…' },
  'venue.sending': { sq: 'Duke dërguar…', en: 'Sending…' },
  'venue.successTitle': { sq: 'U dërgua me sukses!', en: 'Submitted!' },
  'venue.successSub': {
    sq: 'Eventi "{name}" do të dalë live sapo ta aprovojmë.',
    en: '"{name}" will go live as soon as we approve it.',
  },
  'venue.successPremium': {
    sq: 'Kërkove Premium — na shkruaj në WhatsApp për pagesën dhe aktivizimin e menjëhershëm.',
    en: "You requested Featured — message us on WhatsApp for payment and instant activation.",
  },
  'venue.adminContact': { sq: 'Kontakti ynë', en: 'Contact us' },
  'venue.backHome': { sq: '← Kthehu në faqen kryesore', en: '← Back to home' },
  'venue.another': { sq: 'Publiko një event tjetër', en: 'Post another event' },
  'venue.cancel': { sq: 'Anulo', en: 'Cancel' },
  'venue.required': { sq: 'Plotëso fushat e detyrueshme', en: 'Fill in the required fields' },
  'venue.photoError': { sq: 'Fotot nuk u ngarkuan. Provo përsëri ose me foto më të vogla.', en: "Photos couldn't upload. Try again or use smaller photos." },

  // footer
  'footer.privacy': { sq: 'Privatësia', en: 'Privacy' },
  'footer.forVenues': { sq: 'Për lokalet', en: 'For venues' },
  'footer.made': { sq: 'Bërë me ❤️ në Shqipëri', en: 'Made with ❤️ in Albania' },

  // chat
  'chat.title': { sq: 'Nata · guida jote e natës', en: 'Nata · your nightlife guide' },
  'chat.status': { sq: 'AI · të dhëna live', en: 'AI · live event data' },
  'chat.hello': {
    sq: 'Hej, jam Nata 🌙 Më thuaj qytetin, vibe-in ose këngëtarin që do të shohësh dhe të gjej ku të dalësh.',
    en: "Hey, I'm Nata 🌙 Tell me your city, your vibe or the artist you want to see and I'll find where to go.",
  },
  'chat.s1': { sq: 'Çfarë ka sonte në Tiranë?', en: "What's on tonight in Tirana?" },
  'chat.s2': { sq: 'Diçka falas këtë fundjavë?', en: 'Anything free this weekend?' },
  'chat.s3': { sq: 'Techno sonte?', en: 'Techno tonight?' },
  'chat.placeholder': { sq: 'Pyet për eventet e sontme…', en: "Ask about tonight's events…" },
  'chat.error': { sq: 'Nuk u lidha dot me asistentin. Provo pas pak! 🙏', en: "Couldn't reach the assistant. Try again in a bit! 🙏" },
  'chat.open': { sq: 'Hap asistentin e natës', en: 'Open the nightlife assistant' },
} as const;

export type TKey = keyof typeof dict;

interface I18nCtx {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: TKey, vars?: Record<string, string | number>) => string;
  cat: (value: string) => string;
}

const Ctx = createContext<I18nCtx | null>(null);

function initialLang(): Lang {
  try {
    const saved = localStorage.getItem('kudalim_lang');
    if (saved === 'sq' || saved === 'en') return saved;
  } catch {}
  // Default to Albanian; tourists with a non-Albanian browser get English.
  const nav = typeof navigator !== 'undefined' ? navigator.language || '' : '';
  return nav && !nav.toLowerCase().startsWith('sq') && !nav.toLowerCase().startsWith('it') ? 'en' : 'sq';
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>(initialLang);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const setLang = (l: Lang) => {
    setLangState(l);
    try {
      localStorage.setItem('kudalim_lang', l);
    } catch {}
  };

  const t = (key: TKey, vars?: Record<string, string | number>) => {
    let s: string = dict[key]?.[lang] ?? key;
    if (vars) for (const [k, v] of Object.entries(vars)) s = s.replace(`{${k}}`, String(v));
    return s;
  };

  const cat = (value: string) => {
    const c = CATEGORIES.find((x) => x.value === value);
    return c ? c[lang] : value;
  };

  return <Ctx.Provider value={{ lang, setLang, t, cat }}>{children}</Ctx.Provider>;
}

export function useI18n() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useI18n outside provider');
  return v;
}

export function categoryIcon(value: string) {
  return CATEGORIES.find((x) => x.value === value)?.icon || '✨';
}
