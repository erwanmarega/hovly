-- Géolocalisation des biens (carte).
-- lat / lon existaient déjà dans le schéma initial : on ajoute la qualité du
-- géocodage, pour distinguer un point d'adresse d'un centroïde de commune.

alter table public.biens
  add column if not exists geo_precision text,
  add column if not exists geocode_le    timestamptz;

alter table public.biens
  drop constraint if exists biens_geo_precision_check;

alter table public.biens
  add constraint biens_geo_precision_check
  check (geo_precision is null or geo_precision in ('exacte', 'rue', 'ville'));

create index if not exists biens_geo_idx
  on public.biens (lat, lon)
  where lat is not null and lon is not null;
