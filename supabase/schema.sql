create extension if not exists "pgcrypto";

create table if not exists public.biens (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  url_source  text not null,
  site_source text,
  titre       text,
  prix        integer,
  surface     integer,
  nb_pieces   integer,
  etage       integer,
  charges     integer,
  dpe         char(1),
  adresse     text,
  ville       text,
  code_postal char(5),
  lat           double precision,
  lon           double precision,
  geo_precision text check (geo_precision is null or geo_precision in ('exacte', 'rue', 'ville')),
  geocode_le    timestamptz,
  photos      text[] default '{}',
  description text,
  statut      text not null default 'a_visiter',
  transaction text not null default 'location'
    check (transaction in ('location', 'achat')),
  note_perso  text,
  actif       boolean not null default true,
  visite_le        timestamptz,
  compte_rendu     text,
  checklist        jsonb not null default '{}'::jsonb,
  rappel_envoye_le timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists biens_user_id_idx on public.biens (user_id);
create index if not exists biens_created_at_idx on public.biens (created_at desc);
create index if not exists biens_visite_le_idx on public.biens (visite_le) where visite_le is not null;

create table if not exists public.prix_historique (
  id          uuid primary key default gen_random_uuid(),
  bien_id     uuid not null references public.biens (id) on delete cascade,
  prix        integer,
  controle_le timestamptz not null default now()
);

create index if not exists prix_historique_bien_id_idx on public.prix_historique (bien_id);

create table if not exists public.alertes (
  id           uuid primary key default gen_random_uuid(),
  bien_id      uuid not null references public.biens (id) on delete cascade,
  type         text,
  ancien_prix  integer,
  nouveau_prix integer,
  envoyee_le   timestamptz not null default now(),
  vue          boolean not null default false
);

create index if not exists alertes_bien_id_idx on public.alertes (bien_id);

create table if not exists public.trajets (
  id         uuid primary key default gen_random_uuid(),
  bien_id    uuid not null references public.biens (id) on delete cascade,
  ancre      text not null,
  mode       text not null check (mode in ('voiture', 'velo', 'marche', 'transport')),
  ancre_lat  double precision not null,
  ancre_lon  double precision not null,
  duree_s    integer,
  distance_m integer,
  calcule_le timestamptz not null default now(),
  unique (bien_id, ancre, mode)
);

create index if not exists trajets_bien_id_idx on public.trajets (bien_id);

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists biens_set_updated_at on public.biens;
create trigger biens_set_updated_at
  before update on public.biens
  for each row execute function public.set_updated_at();

alter table public.biens enable row level security;
alter table public.prix_historique enable row level security;
alter table public.alertes enable row level security;
alter table public.trajets enable row level security;

drop policy if exists "biens_select_own" on public.biens;
create policy "biens_select_own" on public.biens
  for select using (auth.uid() = user_id);

drop policy if exists "biens_insert_own" on public.biens;
create policy "biens_insert_own" on public.biens
  for insert with check (auth.uid() = user_id);

drop policy if exists "biens_update_own" on public.biens;
create policy "biens_update_own" on public.biens
  for update using (auth.uid() = user_id);

drop policy if exists "biens_delete_own" on public.biens;
create policy "biens_delete_own" on public.biens
  for delete using (auth.uid() = user_id);

drop policy if exists "prix_historique_own" on public.prix_historique;
create policy "prix_historique_own" on public.prix_historique
  for all using (
    exists (select 1 from public.biens b where b.id = bien_id and b.user_id = auth.uid())
  );

drop policy if exists "alertes_own" on public.alertes;
create policy "alertes_own" on public.alertes
  for all using (
    exists (select 1 from public.biens b where b.id = bien_id and b.user_id = auth.uid())
  );

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

drop policy if exists "trajets_own" on public.trajets;
create policy "trajets_own" on public.trajets
  for all using (
    exists (select 1 from public.biens b where b.id = bien_id and b.user_id = auth.uid())
  );

create table if not exists public.recherches (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  label       text not null,
  url         text not null,
  site_source text,
  active      boolean not null default true,
  prix_max    integer,
  prix_min    integer,
  surface_min integer,
  pieces_min  integer,
  frequence_min integer not null default 60,
  derniere_verif   timestamptz,
  derniere_erreur  text,
  echecs_consecutifs integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists recherches_user_id_idx on public.recherches (user_id);
create index if not exists recherches_a_verifier_idx
  on public.recherches (derniere_verif) where active;

drop trigger if exists recherches_set_updated_at on public.recherches;
create trigger recherches_set_updated_at
  before update on public.recherches
  for each row execute function public.set_updated_at();

create table if not exists public.recherche_resultats (
  id           uuid primary key default gen_random_uuid(),
  recherche_id uuid not null references public.recherches (id) on delete cascade,
  url          text not null,
  titre        text,
  prix         integer,
  surface      integer,
  nb_pieces    integer,
  photo        text,
  ville        text,
  code_postal  char(5),
  etat         text not null default 'nouveau'
    check (etat in ('nouveau', 'garde', 'ignore')),
  bien_id      uuid references public.biens (id) on delete set null,
  trouve_le    timestamptz not null default now(),
  unique (recherche_id, url)
);

create index if not exists recherche_resultats_recherche_idx
  on public.recherche_resultats (recherche_id, trouve_le desc);
create index if not exists recherche_resultats_nouveaux_idx
  on public.recherche_resultats (recherche_id) where etat = 'nouveau';

alter table public.recherches enable row level security;
alter table public.recherche_resultats enable row level security;

drop policy if exists "recherches_own" on public.recherches;
create policy "recherches_own" on public.recherches
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "recherche_resultats_own" on public.recherche_resultats;
create policy "recherche_resultats_own" on public.recherche_resultats
  for all using (
    exists (select 1 from public.recherches r where r.id = recherche_id and r.user_id = auth.uid())
  );

-- Cache des statistiques de marché DVF par maille géographique (~1 km).
-- Données de référence publiques partagées : accès serveur uniquement
-- (clé service), d'où l'absence de policy.

create table if not exists public.marche_quartier (
  cle        text primary key,
  donnees    jsonb,
  calcule_le timestamptz not null default now()
);

alter table public.marche_quartier enable row level security;
