-- =====================================================================
--  KU DALIM SONTE? — Supabase schema (SECURE VERSION)
--  Run the WHOLE file in Supabase → SQL Editor. Safe to re-run any time:
--  it only ever tightens permissions, never opens them.
--
--  Security model:
--    • The browser (public "publishable"/anon key) can ONLY read approved events.
--    • Every write (submit, approve, edit, delete, analytics, admin password)
--      goes through /api/* on Vercel, which uses the service_role key.
--    • service_role bypasses RLS by design, so no write policies are needed.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. EVENTS
-- ---------------------------------------------------------------------
create table if not exists events (
  id text primary key,
  name text not null,
  venue text,
  city text,
  date text,
  type text,
  description text,
  price text,
  image text,
  gallery_urls text[] default '{}',
  phone text,
  status text default 'pending',
  is_promoted boolean default false,
  created_at timestamp with time zone default now()
);

alter table events add column if not exists gallery_urls text[] default '{}';
alter table events add column if not exists views integer default 0;
alter table events add column if not exists clicks integer default 0;
alter table events add column if not exists time text;              -- "22:00"
alter table events add column if not exists instagram text;         -- handle without @
alter table events add column if not exists artists text;           -- line-up: singers / DJs
alter table events add column if not exists lat double precision;   -- venue pin on the map
alter table events add column if not exists lng double precision;
alter table events add column if not exists address text;           -- short hint, e.g. "Blloku, pranë Piramidës"
alter table events add column if not exists wants_promotion boolean default false; -- venue asked for Premium

create index if not exists events_status_date_idx on events (status, date);
create index if not exists events_city_date_idx on events (city, date);

alter table events enable row level security;

-- Remove EVERY old public policy (including the dangerous update/delete ones)
drop policy if exists "Anyone can view events" on events;
drop policy if exists "Anyone can insert events" on events;
drop policy if exists "Anyone can insert new pending events" on events;
drop policy if exists "Anyone can update events" on events;
drop policy if exists "Anyone can delete events" on events;
drop policy if exists "Public Read" on events;
drop policy if exists "Public Insert" on events;
drop policy if exists "Public Update" on events;
drop policy if exists "Public Delete" on events;
drop policy if exists "Public can view approved events" on events;

-- The public can only see APPROVED events. Pending submissions (and their phone
-- numbers) are visible only to the admin, through /api/admin-actions.
create policy "Public can view approved events"
on events for select
to anon, authenticated
using (status = 'approved');

-- No insert/update/delete policies for anon on purpose.
-- Belt-and-suspenders: even if someone re-adds an insert policy by mistake,
-- rows inserted by non-service clients are forced to pending + not promoted.
create or replace function force_pending_on_insert()
returns trigger as $$
begin
  if coalesce(auth.role(), 'anon') <> 'service_role' then
    new.status := 'pending';
    new.is_promoted := false;
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_force_pending on events;
create trigger trg_force_pending
before insert on events
for each row execute function force_pending_on_insert();

-- ---------------------------------------------------------------------
-- 2. ANALYTICS (called only by /api/track with service_role)
-- ---------------------------------------------------------------------
create or replace function increment_event_views(event_id text)
returns void as $$
begin
  update events set views = coalesce(views, 0) + 1 where id = event_id and status = 'approved';
end;
$$ language plpgsql security definer set search_path = public;

create or replace function increment_event_clicks(event_id text)
returns void as $$
begin
  update events set clicks = coalesce(clicks, 0) + 1 where id = event_id and status = 'approved';
end;
$$ language plpgsql security definer set search_path = public;

-- The browser can no longer inflate the numbers directly.
revoke execute on function increment_event_views(text) from public, anon, authenticated;
revoke execute on function increment_event_clicks(text) from public, anon, authenticated;
grant execute on function increment_event_views(text) to service_role;
grant execute on function increment_event_clicks(text) to service_role;

-- "Po shkoj" counter (called only by /api/track with service_role)
alter table events add column if not exists going integer default 0;

create or replace function increment_event_going(event_id text)
returns void as $$
begin
  update events set going = coalesce(going, 0) + 1 where id = event_id and status = 'approved';
end;
$$ language plpgsql security definer set search_path = public;

create or replace function decrement_event_going(event_id text)
returns void as $$
begin
  update events set going = greatest(coalesce(going, 0) - 1, 0) where id = event_id;
end;
$$ language plpgsql security definer set search_path = public;

revoke execute on function increment_event_going(text) from public, anon, authenticated;
revoke execute on function decrement_event_going(text) from public, anon, authenticated;
grant execute on function increment_event_going(text) to service_role;
grant execute on function decrement_event_going(text) to service_role;

-- ---------------------------------------------------------------------
-- 2b. "SHKOJMË BASHKË" — group votes (server-only, via /api/poll)
-- ---------------------------------------------------------------------
create table if not exists polls (
  id text primary key,
  title text,
  event_ids text[] not null,
  created_at timestamp with time zone default now()
);
alter table polls enable row level security;

create table if not exists poll_votes (
  poll_id text not null references polls(id) on delete cascade,
  voter text not null,          -- hash of a random per-browser token, not personal data
  event_id text not null,
  name text,                    -- optional first name typed by the voter
  created_at timestamp with time zone default now(),
  primary key (poll_id, voter)
);
alter table poll_votes enable row level security;
-- (no public policies: only the server reads/writes polls)

-- ---------------------------------------------------------------------
-- 3. APP SETTINGS (admin password hash) — server-only, zero public access
-- ---------------------------------------------------------------------
create table if not exists app_settings (
  key text primary key,
  value text not null,
  updated_at timestamp with time zone default now()
);

alter table app_settings enable row level security;

drop policy if exists "Anyone can view settings" on app_settings;
drop policy if exists "Anyone can upsert settings" on app_settings;
drop policy if exists "Anyone can update settings" on app_settings;
-- (no replacement policies on purpose)

-- ---------------------------------------------------------------------
-- 4. STORAGE: event photos
-- ---------------------------------------------------------------------
-- Public bucket, images only, max 5 MB per file.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('event-images', 'event-images', true, 5242880,
        array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = true,
      file_size_limit = 5242880,
      allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'];

drop policy if exists "Public Read Access for event-images" on storage.objects;
create policy "Public Read Access for event-images"
on storage.objects for select
using (bucket_id = 'event-images');

-- Anyone may upload a NEW image (needed by the venue form), but only into this
-- bucket, only image files at the top level, and never overwrite/delete.
drop policy if exists "Public Upload Access for event-images" on storage.objects;
create policy "Public Upload Access for event-images"
on storage.objects for insert
to anon, authenticated
with check (
  bucket_id = 'event-images'
  and lower(storage.extension(name)) in ('jpg', 'jpeg', 'png', 'webp')
  and position('/' in name) = 0
);

drop policy if exists "Public Update Access for event-images" on storage.objects;
drop policy if exists "Public Delete Access for event-images" on storage.objects;

-- ---------------------------------------------------------------------
-- 5. REALTIME — only approved rows are broadcast (RLS above applies)
-- ---------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'events'
  ) then
    alter publication supabase_realtime add table events;
  end if;
exception when others then
  raise notice 'Realtime publication not changed: %', sqlerrm;
end $$;

-- =====================================================================
-- AFTER RUNNING THIS FILE (one time):
--   1. Vercel → Settings → Environment Variables, set:
--        ADMIN_SESSION_SECRET = (openssl rand -hex 32)
--        ADMIN_PASSWORD       = a NEW strong password (the old 'admin123' is public)
--        service_role         = Supabase → Settings → API → service_role key
--   2. Delete the old plaintext password so ADMIN_PASSWORD is used:
--        delete from app_settings where key = 'admin_password';
--   3. Redeploy, log in to /#admin, then change the password in the panel
--      (it is stored as a scrypt hash from now on).
-- =====================================================================
