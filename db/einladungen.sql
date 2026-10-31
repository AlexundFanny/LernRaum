-- ===========================================================================
-- LernRaum Protokoll — Einladungen für neue Lernkräfte
-- ===========================================================================
-- Im Supabase SQL Editor ausführen. Kann gefahrlos mehrfach ausgeführt
-- werden und ändert keine Daten, nur Zugriffsregeln.
--
-- Hintergrund: security_policies.sql hat das Lesen von teacher_invites auf
-- Admins beschränkt. Regeln zum Anlegen und Zurückziehen von Einladungen
-- sind dort nicht festgehalten. Dieses Skript legt sie ausdrücklich an,
-- damit "Einladen" und "Zurückziehen" im Team-Tab sicher funktionieren.
-- Die Registrierung selbst braucht KEINE Leseregel für Nicht-Angemeldete:
-- Der Trigger handle_new_user läuft mit erhöhten Rechten (security definer).
-- ===========================================================================

alter table public.teacher_invites enable row level security;

drop policy if exists "invites_admin_insert" on public.teacher_invites;
create policy "invites_admin_insert" on public.teacher_invites
  for insert to authenticated
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin));

drop policy if exists "invites_admin_delete" on public.teacher_invites;
create policy "invites_admin_delete" on public.teacher_invites
  for delete to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin));


-- --- Kontrolle -------------------------------------------------------------
-- 1) Ist der Registrierungs-Trigger an auth.users angehängt?
--    Erwartet: eine Zeile mit handle_new_user.
select tgname, tgenabled
from pg_trigger
where tgrelid = 'auth.users'::regclass
  and tgfoid = 'public.handle_new_user'::regproc;

-- 2) Offene Einladungen (used = false). Steht die gewünschte Adresse hier?
select id, email, name, used, invited_at
from public.teacher_invites
order by invited_at desc;
