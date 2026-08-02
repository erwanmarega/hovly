-- Distingue les annonces de location des annonces d'achat (vente).
-- L'app était historiquement location-only : le défaut 'location' est donc
-- correct pour toutes les lignes existantes. La détection (motifs d'URL par
-- source, repli sur le prix) est faite au scraping ; le champ reste
-- modifiable à la main via PATCH /api/biens/[id].

alter table public.biens
  add column if not exists transaction text not null default 'location'
    check (transaction in ('location', 'achat'));
