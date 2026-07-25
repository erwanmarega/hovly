-- Notifications push (Web Push / VAPID).
-- Un utilisateur = N abonnements (un par navigateur/appareil).
-- L'endpoint est l'identité de l'abonnement côté service de push : il est unique.

create table if not exists public.push_abonnements (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users (id) on delete cascade,
  endpoint        text not null unique,
  p256dh          text not null,
  auth            text not null,
  agent           text,
  cree_le         timestamptz not null default now(),
  derniere_erreur text
);

create index if not exists push_abonnements_user_id_idx
  on public.push_abonnements (user_id);

alter table public.push_abonnements enable row level security;

drop policy if exists "push_abonnements_own" on public.push_abonnements;
create policy "push_abonnements_own" on public.push_abonnements
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
