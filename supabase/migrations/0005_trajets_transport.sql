-- Ajoute les transports en commun aux modes de trajet.

alter table public.trajets
  drop constraint if exists trajets_mode_check;

alter table public.trajets
  add constraint trajets_mode_check
  check (mode in ('voiture', 'velo', 'marche', 'transport'));
