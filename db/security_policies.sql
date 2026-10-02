-- ===========================================================================
-- LernRaum Protokoll — Absicherung der Row-Level-Security (RLS)
-- ===========================================================================
-- Bereits im Supabase SQL Editor ausgeführt (Oktober 2026).
-- Hier zur Nachvollziehbarkeit abgelegt. In Abschnitten nacheinander
-- ausführbar. Ändert nur Zugriffsregeln, Trigger und zwei Spaltenwerte —
-- keine echten Daten (Schüler, Protokolle, Einheiten) werden gelöscht.
--
-- Hintergrund: Mehrere Tabellen waren ohne Login lesbar, Mitteilungen ganz
-- offen, und über die Registrierung konnte man sich selbst zum Admin machen.
-- Da echte Daten von Minderjährigen (Geburtsdatum, Adresse) betroffen sind,
-- wurde dies vorrangig geschlossen.
-- ===========================================================================


-- --- Abschnitt 1: Super-Admins setzen ------------------------------------
update public.profiles
set is_admin = true, is_super_admin = true
where email in ('stephanw19@yahoo.de', 'sialexander458@gmail.com', 'fyschirren@gmail.com');


-- --- Abschnitt 2: Registrierung absichern --------------------------------
-- Neue Konten werden nie automatisch Admin und kommen nur mit gültiger,
-- unbenutzter Einladung durch. Die Einladung wird sofort als benutzt markiert.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
declare
  invite record;
begin
  select * into invite
  from public.teacher_invites
  where lower(email) = lower(new.email) and used = false
  limit 1;

  if invite is null then
    raise exception 'Keine gültige Einladung für diese E-Mail-Adresse.';
  end if;

  insert into public.profiles (id, email, name, is_admin, is_super_admin)
  values (new.id, new.email, coalesce(invite.name, split_part(new.email, '@', 1)), false, false);

  update public.teacher_invites set used = true where id = invite.id;

  return new;
end;
$$;


-- --- Abschnitt 3: Profile absichern --------------------------------------
drop policy if exists "Public profiles are viewable by everyone" on public.profiles;
drop policy if exists "Profiles sind öffentlich lesbar" on public.profiles;
drop policy if exists "Neues Profil bei Registrierung" on public.profiles;
drop policy if exists "User kann eigenes Profil bearbeiten" on public.profiles;
drop policy if exists "Super admins can update profiles" on public.profiles;
drop policy if exists "Users can update own profile" on public.profiles;

create policy "profiles_select" on public.profiles
  for select to authenticated using (true);

-- Eigenes Profil bearbeiten, aber NICHT die eigenen Admin-Felder.
create policy "profiles_update_self" on public.profiles
  for update to authenticated
  using (auth.uid() = id)
  with check (
    auth.uid() = id
    and is_admin = (select p.is_admin from public.profiles p where p.id = auth.uid())
    and is_super_admin = (select p.is_super_admin from public.profiles p where p.id = auth.uid())
  );

-- Nur Super-Admins vergeben/entziehen Rechte.
create policy "profiles_update_superadmin" on public.profiles
  for update to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_super_admin))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_super_admin));


-- --- Abschnitt 4: Mitteilungen absichern ---------------------------------
alter table public.messages enable row level security;

create policy "messages_select" on public.messages
  for select to authenticated using (true);

create policy "messages_admin_write" on public.messages
  for all to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin));

-- Ungenutzte Tabelle vollständig zusperren (keine Policy = kein Zugriff).
alter table public.announcements enable row level security;


-- --- Abschnitt 5: Einladungen absichern ----------------------------------
drop policy if exists "Invites readable by all" on public.teacher_invites;
drop policy if exists "Anyone can update invites" on public.teacher_invites;

create policy "invites_admin_select" on public.teacher_invites
  for select to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin));


-- --- Abschnitt 6: Vertretungsbörse absichern -----------------------------
drop policy if exists "Authentifizierte dürfen löschen" on public.substitution_requests;

create policy "subs_delete_own" on public.substitution_requests
  for delete to authenticated
  using (auth.uid() = original_teacher_id);
