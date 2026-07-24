-- Öffentliches Profil, getrennt von den privaten Auth-Daten.
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
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