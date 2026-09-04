# Hovly

Agrégateur de biens immobiliers. Nuxt 3 + Supabase + Tailwind v4.
Colle une URL d'annonce → scrape → compare, suit les prix, décide.

## Conventions

### Nommage du code : anglais (nouveau code uniquement)

**Toute fonction, méthode, variable, type/interface ou nom de fichier de code
nouvellement écrit est en anglais.** Règle permanente à partir de maintenant.

- S'applique au code applicatif (JS/TS : composables, composants, routes API,
  utils, tests) — nouveaux identifiants uniquement.
- Le code existant a été traduit intégralement lors d'un chantier dédié
  (branche `refacto-code`) : identifiants et noms de fichiers sont désormais
  en anglais partout dans `app/` et `server/`, à l'exception des cas listés
  ci-dessous. Pour du nouveau code touchant un fichier déjà traduit, poursuivre
  cette convention plutôt que d'introduire de nouveaux identifiants français.
- La base de données Supabase (tables/colonnes : `biens`, `recherches`,
  `prix_historique`...) **reste en français** — hors périmètre de cette règle
  (renommer des colonnes en prod est une opération à risque, traitée à part
  si un jour décidée).
- Les commentaires et tout texte visible par l'utilisateur final (labels,
  messages d'erreur, UI) restent en français — l'app est en français pour
  ses utilisateurs, seul le code source change de langue.
- Dans un fichier existant qu'on modifie pour une autre raison : le code
  ajouté suit la règle (anglais), le code français alentour n'est pas touché.

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

### Pas de doublon (règle stricte)

**On ne crée pas une nouvelle fonction / composant / composable s'il en existe
déjà un qui couvre le besoin.** Avant d'écrire quoi que ce soit de nouveau,
chercher l'existant (`app/components/`, `app/composables/`, `server/utils/`) et
le réutiliser ou l'étendre plutôt que de le redupliquer.

- Un besoin proche mais pas identique → étendre l'existant (prop optionnelle,
  paramètre) plutôt que copier-coller et adapter.
- Si l'existant ne convient vraiment pas, l'expliquer avant de créer du neuf.
- Vaut aussi pour les petites fonctions utilitaires (formatage, calculs) : pas
  de `const eur = (n) => ...` local si un helper partagé fait déjà le travail
  (ex. `formatPrice`/`formatNumber` dans `app/utils/price.ts`).

### Exceptions au renommage anglais

Quelques identifiants restent volontairement en français malgré le chantier
de traduction, pour des raisons de risque/coût plutôt que de règle :

- `bien` / `biens` (prop, variable, ou fragment de nom composé comme
  `bienId`) : le mot est aussi une prose française ordinaire très fréquente
  dans les templates (« Le bien reste consultable... »), et il est threadé
  dans 15+ composants. Un renommage risquait de casser du texte UI (déjà
  arrivé plusieurs fois pendant le chantier) pour un gain cosmétique modeste.
  Skip décidé explicitement pour ce mot précis — ne pas l'étendre par défaut
  à d'autres mots français sans la même analyse coût/risque.
- Le prop/emit `survole` (id du bien survolé, ou `null`) : même famille que
  `bien`/`biens`, threadé entre `PropertyGrid`, `PropertyMap` et les pages
  qui les orchestrent (`dashboard.vue`).
- Les valeurs littérales d'enum persistées en base ou dans un blob JSON
  (`statut`: `'a_visiter'|'planifie'|...`, `dpe`, `type_bien`, `mode` de
  trajet, `type` d'alerte, ids de critères de visite comme `luminosite`,
  `bruit`...) restent en français — seul le nom du type TypeScript autour
  change. Renommer une valeur persistée est un problème de migration, pas de
  nommage de code.
- Les tables/colonnes Supabase (voir plus haut) et les chemins de route
  (`server/api/*`, `app/pages/*`) restent inchangés — contrat d'URL et de
  schéma, hors périmètre d'un renommage de code.

### Composants partagés actuels

- `TheNavbar` — navbar unique, s'adapte à l'état auth (déconnecté / connecté).
  Prop `width` (aligne le container), `show-links` (ancres landing). Utilisée sur toutes les pages.
- `HovlyLink` — logo/lien home (dashboard si connecté, sinon `/`).
- `BadgeDPE` — pastille DPE colorée (prop `dpe`).
- `StatusBadge` — badge de statut d'un bien.
- `ScoreBadge` — badge score compact (prop `score: Score`). Colonne dashboard, entêtes.
- `ScoreBreakdown` — carte détaillée du score avec barres par critère (prop `score: Score`).
- `PriceHistory` — graphe historique de prix (prop `points`).
- `PropertyGrid` — grille de `PropertyCard` + pagination. Prop `compact` (colonne
  unique) pour la sidebar de la vue carte ; sans, colonnes standard de la vue
  grille. Émet `survole` (id du bien survolé ou `null`), consommé par
  `PropertyMap` pour agrandir le marqueur correspondant.
- `WatchCard` — une recherche sauvegardée : critères, dernier scan, actions. Slot = résultats.
- `ResultCard` — une annonce trouvée par une veille, avec Garder / Ignorer.
- `WatchForm` — création d'une veille depuis une URL de page de résultats.
- `ShareModal` — modale de création d'un lien de partage (titre optionnel →
  lien copiable). Utilisée depuis le dashboard et `comparer.vue`.
- `SharedPropertyCard` — carte de bien en lecture seule pour la page de partage
  publique (prop `bien: SharedProperty`, jamais `Property` en entier).

### Composables

- `useProperties` — état + CRUD des biens, helpers `monthlyPrice` / `pricePerSqm`.
- `useAlerts` — état alertes (`useState` partagé), `unread`, refresh, `checkNow`,
  `markRead(id)` pour un marquage individuel (en plus du `markAllRead` global).
- `useScore` — `scoreProperty(bien, contexte)` : score rule-based /100
  (prix/m² vs médiane ville 50pts, DPE 30pts, charges 20pts). Type `Score` exporté.
- `useWatches` — recherches sauvegardées : CRUD, scan manuel, garder/ignorer un résultat.
  Les filtres de prix sont en centimes comme `biens.prix` (`toCents` / `toEuros`).
- `useShares` — CRUD des liens de partage (`create`, `refresh`, `revoke`).
- `useMapZone` — état partagé de la zone dessinée sur `PropertyMap` (`zone`,
  `inZone(bien)`, `clear`), formule de distance en mètres sans dépendance.

### Veille (recherches sauvegardées)

L'utilisateur colle l'URL d'une **page de résultats** (pas une annonce) ; le cron
`POST /api/cron/veille` la rescanne et empile les nouveautés dans une file à valider.

- `server/utils/scrape/listing.ts` — extrait les annonces d'une page de résultats.
  Trois couches fusionnées, de la plus fiable à la plus pauvre : `__NEXT_DATA__`
  (leboncoin), JSON-LD `ItemList`, puis les liens du DOM filtrés par `LISTING_PATTERN`.
- `server/utils/veille.ts` — filtres, dédup et planification (`checkSearch`). Le diff
  repose sur `unique (recherche_id, url)` : l'upsert `ignoreDuplicates` ne renvoie que
  les lignes réellement créées, donc pas de course entre deux scans.
- Une annonce dont on n'a pas su lire le prix ou la surface **passe** les filtres :
  mieux vaut une à écarter à la main qu'une perdue en silence.
- Backoff exponentiel sur échec, mise en pause automatique après 8 échecs d'affilée.
- Les résultats traités (`garde`/`ignore`) de plus de 30 jours sont purgés par
  le cron (`purgeProcessedResults`, `server/utils/veille.ts`) : jamais réaffichés
  après traitement, pas de raison de les garder indéfiniment en base.

### Partage de liste

Un utilisateur peut partager une sélection de biens (`useComparator().selection`,
donc jusqu'à `MAX_COMPARISON` biens) via un **lien public en lecture seule** —
pas de compte requis côté destinataire.

- Token aléatoire (`randomBytes(18).toString('base64url')`), seule porte d'entrée
  publique : les tables `partages`/`partage_biens` n'ont **aucune policy RLS
  pour le rôle anonyme** (même idiome que `marche_quartier`) — l'accès public
  passe uniquement par `server/api/partages/[id].get.ts` (le fichier utilise le
  param `id` et non `token` : Nitro impose ce nom pour tout `/api/partages/:param`,
  quelle que soit la méthode HTTP du fichier qui le dessert), via le client
  service-role, avec un `select` explicite qui n'expose jamais `Property` en entier.
- `server/api/partages/index.post.ts` vérifie l'appartenance des biens via les
  policies RLS de `partage_biens` (jointure sur `biens.user_id`) ; en cas de
  refus, le partage tout juste créé est annulé plutôt que laissé à moitié rempli.
- Un token expiré ou inexistant renvoie la même 404 générique, pour ne pas
  confirmer à un attaquant qui bruteforce qu'un token a existé.

### Sécurité et rate limiting

Deux niveaux de protection côté serveur, implémentés en mémoire (store global au
processus Nuxt) :

1. **Rate limit global par IP** (`server/middleware/rate-limit.global.ts`) sur
   toutes les routes `/api/*`, sauf `/api/cron/*` : 120 requêtes / minute / IP.
2. **Rate limit par utilisateur authentifié** (`server/utils/rate-limit.ts`) sur
   les routes coûteuses (scraping, trajets, check). L'identifiant combine `userId`
   et IP pour limiter à la fois l'abus de session et les faux positifs en NAT.

| Route | Quota |
|---|---|
| `POST /api/scrape` | 10/min, 50/h |
| `POST /api/biens/:id/refresh` | 10/min, 50/h |
| `POST /api/recherches/:id/scan` | 5/min, 30/h |
| `POST /api/trajets/calculer` | 10/min, 100/h |
| `POST /api/check` | 5/min, 20/h |
| `PATCH /api/resultats/:id` | 10/min, 50/h |
| `POST /api/partages` | 10/min, 30/h |
| `POST /api/comparaison/pdf` | 5/min, 20/h |

Autres limites et validations :

- Maximum **10 veilles** par utilisateur (`MAX_SEARCHES`).
- Maximum **100 biens actifs** par utilisateur (`MAX_ACTIVE_PROPERTIES`).
- Les URLs sources sont validées (protocole HTTP/HTTPS, longueur ≤ 2048).
- Les corps de requête POST sont limités à 128 KiB.
- Des headers de sécurité basiques sont appliqués via `nitro.routeRules`.
- Protection SSRF sur le scraping : `detecterSource()` (`server/utils/scrape/source.ts`
  — nom conservé en français pour éviter toute collision d'auto-import avec le
  `detectSource` côté client de `useProperties.ts`) fait un match de domaine exact
  (pas de sous-chaîne), et `assertPublicHostname()` (`server/utils/validation.ts`)
  résout l'hostname et rejette toute IP privée/loopback/link-local (dont le endpoint
  de métadonnées cloud `169.254.169.254`) avant tout scraping — appelée dans
  `scrapeUrl()` et `scrapeListing()`, donc couvre création, refresh, scan manuel/cron
  et validation d'un résultat de veille.

En environnement serverless ou multi-instance, le store en mémoire se réinitialise
à chaque worker. Pour scale horizontalement, il faudra remplacer le store par Redis
ou un backend partagé.
