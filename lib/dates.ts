// All dates are calculated in Albania's time zone, not UTC.
// (The old code used `toISOString()`, which is UTC — between 00:00 and 01:00/02:00
// in Albania it returned *yesterday*.)
import type { DateFilter } from '../types';
import type { Lang } from './i18n';

const TZ = 'Europe/Tirane';

function partsInTirana(d: Date) {
  const f = new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hourCycle: 'h23',
  });
  const p = Object.fromEntries(f.formatToParts(d).map((x) => [x.type, x.value]));
  return { ymd: `${p.year}-${p.month}-${p.day}`, hour: Number(p.hour) };
}

export function addDays(ymd: string, n: number): string {
  const [y, m, d] = ymd.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  return dt.toISOString().slice(0, 10);
}

export function weekday(ymd: string): number {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0 = Sunday
}

/** Today's calendar date in Albania. */
export function todayYMD(): string {
  return partsInTirana(new Date()).ymd;
}

/**
 * "Tonight" for nightlife: until 05:00 in the morning, last night's events are
 * still tonight's events (a party on Saturday is still on at 02:00 Sunday).
 */
export function tonightYMD(): string {
  const { ymd, hour } = partsInTirana(new Date());
  return hour < 5 ? addDays(ymd, -1) : ymd;
}

export function dateRange(filter: DateFilter, custom?: string): [string, string] | null {
  const t = tonightYMD();
  switch (filter) {
    case 'tonight':
      return [t, t];
    case 'tomorrow':
      return [addDays(t, 1), addDays(t, 1)];
    case 'weekend': {
      const wd = weekday(t); // Fri=5 Sat=6 Sun=0
      if (wd === 0) return [t, t];
      if (wd === 5 || wd === 6) return [t, addDays(t, 7 - wd)];
      return [addDays(t, 5 - wd), addDays(t, 7 - wd)];
    }
    case 'week':
      return [t, addDays(t, 6)];
    case 'custom':
      return custom ? [custom, custom] : null;
    default:
      return [t, '9999-12-31'];
  }
}

const MONTHS = {
  sq: ['Jan', 'Shk', 'Mar', 'Pri', 'Maj', 'Qer', 'Kor', 'Gus', 'Sht', 'Tet', 'Nën', 'Dhj'],
  en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
};
const DAYS = {
  sq: ['Diel', 'Hën', 'Mar', 'Mër', 'Enj', 'Pre', 'Sht'],
  en: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
};
const DAYS_LONG = {
  sq: ['e Diel', 'e Hënë', 'e Martë', 'e Mërkurë', 'e Enjte', 'e Premte', 'e Shtunë'],
  en: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
};

export function dateParts(ymd: string, lang: Lang) {
  const [, m, d] = ymd.split('-').map(Number);
  return { day: d, month: MONTHS[lang][m - 1], weekday: DAYS[lang][weekday(ymd)], weekdayLong: DAYS_LONG[lang][weekday(ymd)] };
}

/** "Sonte", "Nesër", or "Sht 22 Nën" */
export function relativeLabel(ymd: string, lang: Lang): string {
  const t = tonightYMD();
  if (ymd === t) return lang === 'sq' ? 'Sonte' : 'Tonight';
  if (ymd === addDays(t, 1)) return lang === 'sq' ? 'Nesër' : 'Tomorrow';
  const p = dateParts(ymd, lang);
  return `${p.weekday} ${p.day} ${p.month}`;
}

export function longDate(ymd: string, lang: Lang): string {
  const p = dateParts(ymd, lang);
  return lang === 'sq' ? `${p.weekdayLong}, ${p.day} ${p.month}` : `${p.weekdayLong}, ${p.month} ${p.day}`;
}

/** Downloadable .ics so people can add the event to their phone's calendar. */
export function buildICS(e: { id: string; name: string; venue: string; city: string; date: string; time?: string; description?: string }, url: string): string {
  const d = e.date.replace(/-/g, '');
  const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');
  let start: string;
  let end: string;
  if (e.time) {
    const hm = e.time.replace(':', '') + '00';
    start = `DTSTART;TZID=Europe/Tirane:${d}T${hm}`;
    const [h, m] = e.time.split(':').map(Number);
    const endH = (h + 4) % 24;
    const endDate = h + 4 >= 24 ? addDays(e.date, 1).replace(/-/g, '') : d;
    end = `DTEND;TZID=Europe/Tirane:${endDate}T${String(endH).padStart(2, '0')}${String(m).padStart(2, '0')}00`;
  } else {
    start = `DTSTART;VALUE=DATE:${d}`;
    end = `DTEND;VALUE=DATE:${addDays(e.date, 1).replace(/-/g, '')}`;
  }
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//KuDalimSonte//SQ',
    'BEGIN:VEVENT',
    `UID:${e.id}@kudalimsonte`,
    `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').slice(0, 15)}Z`,
    start,
    end,
    `SUMMARY:${esc(e.name)}`,
    `LOCATION:${esc(`${e.venue}, ${e.city}`)}`,
    `DESCRIPTION:${esc((e.description || '').slice(0, 500) + '\n' + url)}`,
    `URL:${url}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');
}

// ---------------------------------------------------------------------------
// Live countdown helpers
// ---------------------------------------------------------------------------
function nowInTirana() {
  const f = new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });
  const p = Object.fromEntries(f.formatToParts(new Date()).map((x) => [x.type, x.value]));
  return { ymd: `${p.year}-${p.month}-${p.day}`, minutes: Number(p.hour) * 60 + Number(p.minute) };
}

function dayIndex(ymd: string) {
  const [y, m, d] = ymd.split('-').map(Number);
  return Date.UTC(y, m - 1, d) / 86400000;
}

/** Minutes from now until the event starts (negative = already started). Default start 22:00. */
export function minutesUntil(date: string, time?: string): number {
  const now = nowInTirana();
  const [h, m] = (time || '22:00').split(':').map(Number);
  return (dayIndex(date) - dayIndex(now.ymd)) * 1440 + (h * 60 + m) - now.minutes;
}

export type LiveStatus = { kind: 'soon'; label: string } | { kind: 'live'; label: string } | null;

/** "Fillon për 2o 15m" within 12h, "Po ndodh tani" for ~5h after the start. */
export function liveStatus(date: string, time: string | undefined, lang: Lang): LiveStatus {
  const mins = minutesUntil(date, time);
  if (mins <= 0 && mins > -300) return { kind: 'live', label: lang === 'sq' ? 'Po ndodh tani' : 'Happening now' };
  if (mins > 0 && mins <= 12 * 60) {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    const txt =
      lang === 'sq'
        ? h ? `${h} orë${m ? ` ${m} min` : ''}` : `${m} min`
        : h ? `${h}h${m ? ` ${m}m` : ''}` : `${m} min`;
    return { kind: 'soon', label: lang === 'sq' ? `Fillon për ${txt}` : `Starts in ${txt}` };
  }
  return null;
}

export function isSummerSeason(): boolean {
  const m = Number(todayYMD().slice(5, 7));
  return m >= 6 && m <= 9;
}
