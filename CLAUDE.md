# Hovly

Agrégateur de biens immobiliers. Nuxt 3 + Supabase + Tailwind v4.
Colle une URL d'annonce → scrape → compare, suit les prix, décide.

## Conventions

### Composants réutilisables (règle principale)

**On extrait au maximum en composants réutilisables.** C'est une des conventions
centrales de Vue.js et la règle par défaut de ce projet.

- Tout bloc d'UI répété OU susceptible d'être réutilisé sur une autre page →
  composant dans `app/components/` (auto-importés par Nuxt, pas d'import manuel).
- Une page ne doit pas contenir de gros blocs de markup inline réutilisables :
  navbar, badges, cartes, listes d'items → composant dédié.
- Un composant = une responsabilité. Props typées avec `defineProps<{...}>()`.
- Logique partagée (calculs, fetch, état) → composable `app/composables/use*.ts`
  (aussi auto-importés). Le composant reste présentation ; la logique vit dans le composable.
- Avant d'écrire du markup dans une page, vérifier si un composant existe déjà
  (`app/components/`) ou mérite d'être créé.

### Composants partagés actuels

- `TheNavbar` — navbar unique, s'adapte à l'état auth (déconnecté / connecté).
  Prop `width` (aligne le container), `show-links` (ancres landing). Utilisée sur toutes les pages.
- `HovlyLink` — logo/lien home (dashboard si connecté, sinon `/`).
- `BadgeDPE` — pastille DPE colorée (prop `dpe`).
- `BadgeStatut` — badge de statut d'un bien.
- `ScoreBien` — badge score compact (prop `score: Score`). Colonne dashboard, entêtes.
- `ScoreBreakdown` — carte détaillée du score avec barres par critère (prop `score: Score`).
- `PrixHistorique` — graphe historique de prix (prop `points`).
- `CarteVeille` — une recherche sauvegardée : critères, dernier scan, actions. Slot = résultats.
- `CarteResultat` — une annonce trouvée par une veille, avec Garder / Ignorer.
- `FormulaireVeille` — création d'une veille depuis une URL de page de résultats.

### Composables

- `useBiens` — état + CRUD des biens, helpers `prixMensuel` / `prixM2`.
- `useAlertes` — état alertes (`useState` partagé), `nonVues`, refresh, vérif.
- `useScore` — `scoreBien(bien, contexte)` : score rule-based /100
  (prix/m² vs médiane ville 50pts, DPE 30pts, charges 20pts). Type `Score` exporté.
- `useVeilles` — recherches sauvegardées : CRUD, scan manuel, garder/ignorer un résultat.
  Les filtres de prix sont en centimes comme `biens.prix` (`enCentimes` / `enEuros`).

### Veille (recherches sauvegardées)

L'utilisateur colle l'URL d'une **page de résultats** (pas une annonce) ; le cron
`POST /api/cron/veille` la rescanne et empile les nouveautés dans une file à valider.

- `server/utils/scrape/liste.ts` — extrait les annonces d'une page de résultats.
  Trois couches fusionnées, de la plus fiable à la plus pauvre : `__NEXT_DATA__`
  (leboncoin), JSON-LD `ItemList`, puis les liens du DOM filtrés par `MOTIF_FICHE`.
- `server/utils/veille.ts` — filtres, dédup et planification. Le diff repose sur
  `unique (recherche_id, url)` : l'upsert `ignoreDuplicates` ne renvoie que les
  lignes réellement créées, donc pas de course entre deux scans.
- Une annonce dont on n'a pas su lire le prix ou la surface **passe** les filtres :
  mieux vaut une à écarter à la main qu'une perdue en silence.
- Backoff exponentiel sur échec, mise en pause automatique après 8 échecs d'affilée.
