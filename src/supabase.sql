-- =========================================================
-- Profiles
-- =========================================================
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  bio text,
  avatar_url text,
  website text,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "profiles_select_all" on public.profiles;
create policy "profiles_select_all" on public.profiles
  for select using (true);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id);

-- Automatisch einen profiles-Eintrag anlegen, sobald sich jemand registriert.
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, split_part(new.email, '@', 1)); -- Platzhalter-Name aus der E-Mail
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- =========================================================
-- Patches
-- =========================================================
create table if not exists public.patches (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users (id) on delete cascade,
  name           text not null,
  description    text,
  graph          jsonb not null,
  schema_version int  not null default 1,
  is_public      boolean not null default false,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- Falls Tabelle schon vorher ohne is_public existierte:
alter table public.patches
  add column if not exists is_public boolean not null default false;

alter table public.patches enable row level security;

drop policy if exists "patches_select_own" on public.patches;
create policy "patches_select_own" on public.patches
  for select using (auth.uid() = user_id);

drop policy if exists "patches_insert_own" on public.patches;
create policy "patches_insert_own" on public.patches
  for insert with check (auth.uid() = user_id);

drop policy if exists "patches_update_own" on public.patches;
create policy "patches_update_own" on public.patches
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "patches_delete_own" on public.patches;
create policy "patches_delete_own" on public.patches
  for delete using (auth.uid() = user_id);

-- Öffentliche Patches sind für JEDEN sichtbar, auch nicht eingeloggte Besucher.
drop policy if exists "patches_select_public" on public.patches;
create policy "patches_select_public" on public.patches
  for select using (is_public = true);

create index if not exists patches_user_updated
  on public.patches (user_id, updated_at desc);

-- FK auf profiles (zusätzlich zur bestehenden FK auf auth.users)
do $$
begin
  alter table public.patches
    add constraint patches_user_id_profiles_fkey
    foreign key (user_id) references public.profiles (id) on delete cascade;
exception
  when duplicate_object then null;
end $$;

-- =========================================================
-- Grants
-- =========================================================
grant usage on schema public to anon, authenticated;
grant select on public.profiles to anon, authenticated;
grant update on public.profiles to authenticated;

grant select, insert, update, delete on public.patches to authenticated;
-- anon braucht Lesezugriff auf die Tabelle selbst, sonst greift die
-- RLS-Policy "patches_select_public" nicht (Grant-Ebene vor RLS).
grant select on public.patches to anon;

-- =========================================================
-- Storage: Avatars-Bucket
-- =========================================================
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

drop policy if exists "avatars_read_all" on storage.objects;
create policy "avatars_read_all"
on storage.objects for select
using (bucket_id = 'avatars');

-- Erwartet Dateipfad wie "avatars/<user_id>/irgendeinname.png".
drop policy if exists "avatars_insert_own" on storage.objects;
create policy "avatars_insert_own"
on storage.objects for insert
with check (
  bucket_id = 'avatars'
  and auth.uid()::text = (storage.foldername(name))[1]
);

drop policy if exists "avatars_update_own" on storage.objects;
create policy "avatars_update_own"
on storage.objects for update
using (
  bucket_id = 'avatars'
  and auth.uid()::text = (storage.foldername(name))[1]
);

drop policy if exists "avatars_delete_own" on storage.objects;
create policy "avatars_delete_own"
on storage.objects for delete
using (
  bucket_id = 'avatars'
  and auth.uid()::text = (storage.foldername(name))[1]
);

-- other necessary changes 
alter table public.patches
  add column if not exists thumbnail_url text;

  insert into public.profiles (id, display_name)
select u.id, split_part(u.email, '@', 1)
from auth.users u
left join public.profiles p on p.id = u.id
where p.id is null;


drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own" on public.profiles
  for insert with check (auth.uid() = id);

-- =========================================================
-- Storage: Sampler-Recordings-Bucket
-- =========================================================
 
insert into storage.buckets (id, name, public)
values ('sampler-recordings', 'sampler-recordings', true)
on conflict (id) do nothing;
 
create policy "sampler_recordings_read_all"
on storage.objects for select
using (bucket_id = 'sampler-recordings');
 
create policy "sampler_recordings_insert_own"
on storage.objects for insert
with check (
  bucket_id = 'sampler-recordings'
  and auth.uid()::text = (storage.foldername(name))[1]
);
 
create policy "sampler_recordings_update_own"
on storage.objects for update
using (
  bucket_id = 'sampler-recordings'
  and auth.uid()::text = (storage.foldername(name))[1]
);
 
grant usage on schema storage to anon, authenticated;
grant select on storage.objects to anon, authenticated;
grant insert, update on storage.objects to authenticated;