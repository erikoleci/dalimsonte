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

alter table events enable row level security;

drop policy if exists "Anyone can view events" on events;
create policy "Anyone can view events"
on events for select
using (true);

drop policy if exists "Anyone can insert events" on events;
create policy "Anyone can insert events"
on events for insert
with check (true);

drop policy if exists "Anyone can update events" on events;
create policy "Anyone can update events"
on events for update
using (true);

drop policy if exists "Anyone can delete events" on events;
create policy "Anyone can delete events"
on events for delete
using (true);

-- Tabela e settings (p.sh. fjalëkalimi i adminit) — e njëjtë për çdo pajisje
create table if not exists app_settings (
  key text primary key,
  value text not null,
  updated_at timestamp with time zone default now()
);

alter table app_settings enable row level security;

drop policy if exists "Anyone can view settings" on app_settings;
create policy "Anyone can view settings"
on app_settings for select
using (true);

drop policy if exists "Anyone can upsert settings" on app_settings;
create policy "Anyone can upsert settings"
on app_settings for insert
with check (true);

drop policy if exists "Anyone can update settings" on app_settings;
create policy "Anyone can update settings"
on app_settings for update
using (true);

-- Storage bucket për foto eventesh (KRITIKE — pa këtë, upload i fotove dështon
-- dhe bie automatikisht te Base64, që ngadalëson databazën)
insert into storage.buckets (id, name, public)
values ('event-images', 'event-images', true)
on conflict (id) do nothing;

drop policy if exists "Public Read Access for event-images" on storage.objects;
create policy "Public Read Access for event-images"
on storage.objects for select
using (bucket_id = 'event-images');

drop policy if exists "Public Upload Access for event-images" on storage.objects;
create policy "Public Upload Access for event-images"
on storage.objects for insert
with check (bucket_id = 'event-images');
