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

<<<<<<< HEAD
<<<<<<< HEAD
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on public.patches to authenticated;

alter table public.patches
  add column if not exists is_public boolean not null default false;

-- Additiv zur bestehenden patches_select_own: öffentliche Patches sind
-- für JEDEN sichtbar, auch nicht eingeloggte Besucher.
create policy "patches_select_public" on public.patches
  for select using (is_public = true);

-- anon braucht jetzt ebenfalls Lesezugriff auf die Tabelle selbst,
-- sonst greift die Policy nicht (Grant-Ebene vor RLS, wie wir mehrfach
-- gelernt haben).
grant select on public.patches to anon;

alter table public.patches
  add constraint patches_user_id_profiles_fkey


  -- Bucket anlegen, public = true macht die Dateien über eine feste URL
=======
-- Bucket anlegen, public = true macht die Dateien über eine feste URL
>>>>>>> da5526c (fix build errors)
-- ohne Auth lesbar (wie ein normales <img src="...">).
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

-- Lesen: für JEDEN offen, auch ohne Login — analog zur profiles-Tabelle.
create policy "avatars_read_all"
on storage.objects for select
using (bucket_id = 'avatars');

-- Hochladen: nur eingeloggte Nutzer, und nur in ihren EIGENEN Ordner.
-- Erwartet einen Dateipfad wie "avatars/<user_id>/irgendeinname.png" —
-- die Ordner-Konvention ist der Schlüssel zur Absicherung.
create policy "avatars_insert_own"
on storage.objects for insert
with check (
  bucket_id = 'avatars'
  and auth.uid()::text = (storage.foldername(name))[1]
);

-- Ersetzen/Überschreiben eines eigenen Bildes.
create policy "avatars_update_own"
on storage.objects for update
using (
  bucket_id = 'avatars'
  and auth.uid()::text = (storage.foldername(name))[1]
);

-- Löschen des eigenen Bildes.
create policy "avatars_delete_own"
on storage.objects for delete
using (
  bucket_id = 'avatars'
  and auth.uid()::text = (storage.foldername(name))[1]
);
grant update on public.profiles to authenticated;


alter table public.patches
  add column if not exists description text;