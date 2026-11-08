-- Suivi après visite : historique des démarches d'un bien (dossier envoyé / offre
-- faite, contre-proposition, acceptation, refus). `montant` est en centimes,
-- comme `biens.prix`. Le statut courant du bien (`biens.statut`) est dérivé de
-- la dernière étape côté API.

create table if not exists public.demarches (
  id         uuid primary key default gen_random_uuid(),
  bien_id    uuid not null references public.biens (id) on delete cascade,
  type       text not null check (type in ('candidature', 'contre_offre', 'acceptation', 'refus')),
  montant    bigint check (montant is null or montant >= 0),
  note       text check (note is null or char_length(note) <= 1000),
  fait_le    timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists demarches_bien_id_idx on public.demarches (bien_id);

alter table public.demarches enable row level security;

drop policy if exists "demarches_own" on public.demarches;
create policy "demarches_own" on public.demarches
  for all using (
    exists (select 1 from public.biens b where b.id = bien_id and b.user_id = auth.uid())
  ) with check (
    exists (select 1 from public.biens b where b.id = bien_id and b.user_id = auth.uid())
  );
