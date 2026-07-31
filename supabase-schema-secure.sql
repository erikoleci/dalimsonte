-- ============================================================
-- SECURITY FIX — run this AFTER supabase-schema.sql, in the
-- Supabase SQL Editor. It replaces the "Anyone can update/delete"
-- policies (which let ANY visitor with the public anon key edit
-- or delete any event, and read/overwrite the admin password)
-- with policies that only the server (service_role key) can
-- use for writes/moderation. The app's /api/admin-* endpoints
-- now do all of that server-side.
-- ============================================================

-- ---------- events ----------

-- Public can still see approved... actually keep "select true" since the
-- app also needs to show pending events to the admin panel via the
-- server-side service role (service role bypasses RLS entirely, so this
-- select policy only affects anonymous/public browser reads).
drop policy if exists "Anyone can view events" on events;
create policy "Anyone can view events"
on events for select
using (true);

-- Public submission form still works: anyone can INSERT a new event...
drop policy if exists "Anyone can insert events" on events;
create policy "Anyone can insert new pending events"
on events for insert
with check (status is null or status = 'pending');   -- can't insert as pre-approved

-- ...but can no longer UPDATE or DELETE existing events. Only service_role
-- (used exclusively by /api/admin-actions.js, after verifying the admin
-- session token) can do that — service_role bypasses RLS by design, so we
-- simply remove the public policies instead of writing a "using (false)" no-op.
drop policy if exists "Anyone can update events" on events;
drop policy if exists "Anyone can delete events" on events;

-- Belt-and-suspenders: force every new row to start as 'pending' and
-- unpromoted, even if the client tries to send something else.
create or replace function force_pending_on_insert()
returns trigger as $$
begin
  new.status := 'pending';
  new.is_promoted := false;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_force_pending on events;
create trigger trg_force_pending
before insert on events
for each row execute function force_pending_on_insert();

-- ---------- app_settings (admin password etc.) ----------
-- This table is no longer readable or writable by the browser/anon key at
-- all. Only the server (service_role, via /api/admin-login.js and
-- /api/admin-actions.js) touches it now.
drop policy if exists "Anyone can view settings" on app_settings;
drop policy if exists "Anyone can upsert settings" on app_settings;
drop policy if exists "Anyone can update settings" on app_settings;
-- (no replacement policies — zero anon/public access; service_role bypasses RLS)

-- ---------- one-time cleanup ----------
-- The default admin password ('admin123') has been sitting in a
-- publicly-readable table and is now also visible in git history on a
-- public GitHub repo. Rotate it immediately after running this file:
--   1. Set ADMIN_PASSWORD in your Vercel env vars to a new strong password
--   2. Log in to /admin with it once
--   3. Immediately use "Change Password" in the admin panel to store a
--      fresh one in app_settings (now safely server-only)
