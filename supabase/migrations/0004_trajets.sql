-- Temps de trajet entre un bien et un point d'ancrage (boulot, école, gare…).
-- Les ancres vivent dans les préférences utilisateur (user_metadata) : ici on ne
-- garde que le résultat du calcul, pour ne pas rappeler l'API de routage à chaque
-- affichage. `ancre_lat`/`ancre_lon` servent à détecter qu'une ancre a bougé.

create table if not exists public.trajets (
  id         uuid primary key default gen_random_uuid(),
  bien_id    uuid not null references public.biens (id) on delete cascade,
  ancre      text not null,
  mode       text not null check (mode in ('voiture', 'velo', 'marche')),
  ancre_lat  double precision not null,
  ancre_lon  double precision not null,
  duree_s    integer,
  distance_m integer,
  calcule_le timestamptz not null default now(),
  unique (bien_id, ancre, mode)
);

create index if not exists trajets_bien_id_idx on public.trajets (bien_id);

alter table public.trajets enable row level security;

drop policy if exists "trajets_own" on public.trajets;
create policy "trajets_own" on public.trajets
  for all using (
    exists (select 1 from public.biens b where b.id = bien_id and b.user_id = auth.uid())
  );
