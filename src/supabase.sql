-- Öffentliches Profil, getrennt von den privaten Auth-Daten.
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  bio text,
  avatar_url text,
  website text,
  created_at timestamptz not null default now()
);

-- Lesen: für JEDEN offen (auch ohne Login) — das ist der Kern von "öffentlich".
alter table public.profiles enable row level security;

create policy "profiles_select_all" on public.profiles
  for select using (true);

-- Schreiben: nur der Owner darf sein eigenes Profil ändern.
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id);

-- Automatisch einen profiles-Eintrag anlegen, sobald sich jemand registriert.
create function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, split_part(new.email, '@', 1)); -- Platzhalter-Name aus der E-Mail
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

  create table if not exists public.patches (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users (id) on delete cascade,
  name           text not null,
  graph          jsonb not null,
  schema_version int  not null default 1,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

alter table public.patches enable row level security;

create policy "patches_select_own" on public.patches
  for select using (auth.uid() = user_id);

create policy "patches_insert_own" on public.patches
  for insert with check (auth.uid() = user_id);

create policy "patches_update_own" on public.patches
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "patches_delete_own" on public.patches
  for delete using (auth.uid() = user_id);

create index if not exists patches_user_updated
  on public.patches (user_id, updated_at desc);

grant usage on schema public to anon, authenticated;
grant select on public.profiles to anon, authenticated;

alter table public.patches
  add column if not exists is_public boolean not null default false;

-- Zusätzliche Lese-Policy: öffentliche Patches sind für JEDEN sichtbar,
-- unabhängig vom eigenen user_id. Die bestehende patches_select_own
-- bleibt unverändert für den privaten Fall.
create policy "patches_select_public" on public.patches
  for select using (is_public = true);

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on public.patches to authenticated;