-- Type du bien (maison/appartement), détecté au scraping depuis le titre.
-- Nullable : les biens existants n'ont pas cette donnée tant qu'ils ne sont
-- pas rafraîchis ou édités manuellement. `server/utils/dvf.ts` traite
-- null comme 'appartement' (comportement historique, avant ce champ).

alter table public.biens
  add column if not exists type_bien text
    check (type_bien in ('maison', 'appartement'));
