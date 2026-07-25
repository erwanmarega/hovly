-- Visites : date planifiée, compte-rendu et checklist remplie sur place.
-- `rappel_envoye_le` évite qu'un rappel J-1 parte deux fois si le cron repasse.

alter table public.biens
  add column if not exists visite_le        timestamptz,
  add column if not exists compte_rendu     text,
  add column if not exists checklist        jsonb not null default '{}'::jsonb,
  add column if not exists rappel_envoye_le timestamptz;

-- Sert au balayage du cron de rappels : peu de biens ont une visite planifiée.
create index if not exists biens_visite_le_idx
  on public.biens (visite_le)
  where visite_le is not null;
