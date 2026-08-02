-- Cache des statistiques de marché DVF par maille géographique (~1 km).
-- Les ventes (DGFiP, via api.cquest.org) bougent lentement : on garde le
-- résultat 30 jours pour ne pas solliciter l'API publique à chaque affichage.
-- `donnees` vaut null quand l'échantillon est insuffisant ou l'API en panne ;
-- on retente alors au bout de 3 jours (TTL géré par /api/dvf).
-- Données de référence publiques, partagées entre utilisateurs : lecture et
-- écriture côté serveur avec la clé service, d'où l'absence de policy.

create table if not exists public.marche_quartier (
  cle        text primary key,          -- maille "lat,lon" arrondie à 0,01°
  donnees    jsonb,                     -- statistiques MarcheQuartier
  calcule_le timestamptz not null default now()
);

alter table public.marche_quartier enable row level security;
