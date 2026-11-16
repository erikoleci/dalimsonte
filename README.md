# Ku Dalim Sonte? 🌙

Platforma e natës në Shqipëri: festa, koncerte dhe evente sonte në qytetin tënd, me rezervim me një klik në WhatsApp.

**Stack:** React 18 + Vite + Tailwind (frontend) · Vercel Serverless Functions (`/api`) · Supabase (databazë + foto) · Gemini (asistenti AI) · Cloudflare Turnstile (anti-bot).

---

## Struktura

```
App.tsx                  routing (#/, #/te-ruajturat, #/publiko, #/admin) + state
components/
  HomeView.tsx           hero + feed me filtra Sonte / Nesër / Fundjavë / qytet / vibe / kërkim
  EventCard.tsx          karta e eventit (stil poster)
  EventDetails.tsx       faqja e eventit: galeri, WhatsApp, hartë, kalendar, share
  VenueForm.tsx          formulari për lokalet (foto të kompresuara, captcha, pranim kushtesh)
  AdminPanel.tsx         paneli i adminit (aprovo, premium, edito, fshi, statistika)
  EventChatWidget.tsx    asistenti AI
lib/i18n.tsx             përkthimet shqip / anglisht
lib/dates.ts             datat në orën e Shqipërisë (Europe/Tirane)
services/supabase.ts     lexim publik + thirrjet te /api
shared/constants.js      qytetet, kategoritë, limitet (përdoren edhe nga serveri)
api/
  submit-event.js        dërgimi i eventeve (validim, captcha, rate limit)
  admin-login.js         hyrja e adminit (scrypt hash, rate limit)
  admin-actions.js       aprovo / edito / fshi / fjalëkalimi (vetëm me token)
  track.js               shikime / klikime (rate-limited)
  share.js               /e/<id> → link me foto & titull për WhatsApp/Instagram
  event-chat.js          asistenti AI
supabase-schema.sql      skema + RLS e sigurt (mund të rindizet pa rrezik)
vercel.json              header-at e sigurisë (CSP etj.) + rewrite për /e/<id>
```

## Konfigurimi (një herë)

### 1. Supabase
Supabase → **SQL Editor** → ngjit dhe ekzekuto të gjithë `supabase-schema.sql`.
Pastaj fshi fjalëkalimin e vjetër (ishte publik):
```sql
delete from app_settings where key = 'admin_password';
```

### 2. Vercel → Settings → Environment Variables

| Variabla | Ku e gjen | E detyrueshme |
|---|---|---|
| `service_role` (ose `SUPABASE_SERVICE_ROLE_KEY`) | Supabase → Settings → API → `service_role` | ✅ |
| `ADMIN_SESSION_SECRET` | `openssl rand -hex 32` (min. 32 karaktere) | ✅ |
| `ADMIN_PASSWORD` | një fjalëkalim i ri, i fortë | ✅ |
| `GEMINI_API_KEY` | aistudio.google.com/api-keys | për asistentin AI |
| `VITE_TURNSTILE_SITE_KEY` + `TURNSTILE_SECRET_KEY` | dash.cloudflare.com → Turnstile (falas) | rekomandohet |
| `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` | upstash.com (falas) | rekomandohet |
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` | Supabase → Settings → API | opsionale (ka vlera default) |

⚠️ **Asnjëherë** mos i vendos `VITE_` para `service_role` ose çelësave sekretë: çdo gjë me `VITE_` shkon në browser.

### 3. Admini
Pas deploy: hap `https://<domeni>/#/admin`, hyr me `ADMIN_PASSWORD`, pastaj ndrysho fjalëkalimin te 🔑 (min. 12 karaktere, ruhet si hash).

## Zhvillim lokal

```bash
npm install
npm run dev        # vetëm frontend
npx vercel dev     # frontend + /api
```

## Siguria në pak fjalë
- Browser-i lexon **vetëm** eventet e aprovuara; eventet në pritje dhe numrat e tyre nuk janë publikë.
- Çdo shkrim kalon nga `/api` me `service_role`, pas validimit dhe rate limit.
- Fjalëkalimi i adminit ruhet si scrypt hash; ndryshimi i tij nxjerr jashtë çdo sesion.
- Fotot: vetëm jpg/png/webp, maks. 5 MB, pa mbishkrim/fshirje nga publiku, kompresohen në browser.
- CSP + header-a sigurie te `vercel.json`.
