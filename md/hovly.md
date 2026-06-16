# 🏠 Hovly — Agrégateur de biens immobiliers

> Centralise toutes tes annonces en un seul endroit. Compare, suis les prix, prends ta décision.

---

## Le problème

Quand on cherche un appartement, on jongle entre SeLoger, Leboncoin, PAP, Logic-Immo... Les favoris restent sur chaque site séparément. Pour comparer deux biens, il faut ouvrir 4 onglets, retrouver les annonces, et souvent elles ont disparu.

**Hovly résout ça** : tu colles une URL, l'app extrait tout automatiquement et l'ajoute à ton tableau de bord personnel. Un seul endroit pour tous tes biens, peu importe la source.

---

## Ce qu'on veut construire

### Expérience utilisateur cible

```
1. Tu tombes sur une annonce qui t'intéresse sur SeLoger
2. Tu copies l'URL
3. Tu la colles dans Hovly
4. L'app extrait automatiquement : prix, surface, pièces, photos, quartier, DPE
5. Le bien apparaît dans ton tableau avec tous les autres
6. Tu compares, tu notes, tu suis les prix
```
  
### Ce que l'utilisateur voit

Un tableau de bord avec tous ses biens :

| Bien | Prix | m² | €/m² | Pièces | DPE | Statut | Ma note |
|---|---|---|---|---|---|---|---|
| Rue de la Paix, Paris 2e | 1 200 €/mois | 38 m² | 31 €/m² | 2p | C | À visiter | Quartier top |
| Av. Victor Hugo, Lyon 6e | 850 €/mois | 52 m² | 16 €/m² | 3p | D | Visité ✅ | Trop sombre |
| Bd Voltaire, Paris 11e | 1 100 €/mois | 45 m² | 24 €/m² | 2p | B | Éliminé ❌ | — |

---

## Fonctionnalités

### V1 — MVP

- **Ajout par URL** : colle une URL d'annonce, l'app scrape et extrait les données
- **Tableau comparatif** : prix, surface, €/m², pièces, étage, DPE, photos
- **Statuts** : À visiter / Visite planifiée / Visité / Éliminé / Coup de cœur
- **Notes personnelles** : champ libre par bien
- **Tri et filtres** : par prix, surface, statut, date d'ajout
- **Authentification** : connexion par email ou Google (chaque utilisateur a sa propre liste)
- **Sources supportées** : SeLoger, Leboncoin, PAP, Logic-Immo, BienIci

### V2 — Alertes et suivi

- **Alerte baisse de prix** : notification email si une annonce baisse
- **Détection de suppression** : alerte si une annonce disparaît (bien loué/vendu)
- **Historique des prix** : graphique d'évolution du prix d'une annonce
- **Re-scraping automatique** : vérification quotidienne de chaque annonce

### V3 — Intelligence

- **Analyse IA** : synthèse Claude sur chaque bien (points forts, points faibles, cohérence du prix)
- **Comparaison DVF** : croisement avec les données de ventes réelles du quartier
- **Extension Chrome** : bouton "Ajouter à Hovly" directement sur l'annonce
- **Partage de liste** : partager sa sélection avec un coloc ou un partenaire

---

## Stack technique

### Vue d'ensemble

```
Nuxt 3 (frontend + API routes)
        ↓
Playwright sur Railway (scraping des annonces)
        ↓
Supabase (base de données + auth + cron)
        ↓
Resend (notifications email)
```

### Détail par brique

#### Frontend & Backend — Nuxt 3
- **Pourquoi** : stack unifiée, server routes intégrées, Vue 3 + Composition API, déploiement Vercel simple
- **UI** : Tailwind CSS
- **Pages** : `/` (dashboard), `/bien/[id]` (fiche détaillée), `/ajouter` (ajout par URL)
- **Server routes** : `/api/scrape`, `/api/biens`, `/api/alertes`

#### Scraping — Playwright (Node.js)
- **Pourquoi Playwright plutôt que Cheerio** : pilote un vrai navigateur Chromium, passe les protections anti-bot basiques, exécute le JavaScript des pages
- **Déployé sur Railway** : Vercel a un timeout de 10s, trop court pour le scraping. Railway supporte les processus longs
- **Stratégie** : délais aléatoires entre requêtes, rotation de user-agents, pas de scraping massif
- **Données extraites** : titre, prix, surface, pièces, étage, charges, DPE, adresse, photos[], description, date de publication

#### Base de données — Supabase (PostgreSQL)
- **Pourquoi** : auth intégrée (Google + email), SDK Nuxt officiel, gratuit jusqu'à 500MB, Realtime pour les mises à jour live
- **Schéma** :

```sql
-- Utilisateurs (géré par Supabase Auth)
users (id, email, created_at)

-- Biens immobiliers
biens (
  id uuid PRIMARY KEY,
  user_id uuid REFERENCES users,
  url_source text NOT NULL,           -- URL originale de l'annonce
  site_source text,                   -- 'seloger' | 'leboncoin' | 'pap' ...
  titre text,
  prix integer,                       -- en centimes pour éviter les flottants
  surface integer,                    -- en m²
  nb_pieces integer,
  etage integer,
  charges integer,
  dpe char(1),                        -- A B C D E F G
  adresse text,
  ville text,
  code_postal char(5),
  lat float,
  lon float,
  photos text[],                      -- tableau d'URLs
  description text,
  statut text DEFAULT 'a_visiter',    -- a_visiter | planifie | visite | elimine | coup_de_coeur
  note_perso text,
  actif boolean DEFAULT true,         -- false si annonce supprimée
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
)

-- Historique des prix (pour le graphique d'évolution)
prix_historique (
  id uuid PRIMARY KEY,
  bien_id uuid REFERENCES biens,
  prix integer,
  controle_le timestamptz DEFAULT now()
)

-- Alertes envoyées
alertes (
  id uuid PRIMARY KEY,
  bien_id uuid REFERENCES biens,
  type text,                          -- 'baisse_prix' | 'annonce_supprimee'
  ancien_prix integer,
  nouveau_prix integer,
  envoyee_le timestamptz DEFAULT now(),
  vue boolean DEFAULT false
)
```

#### Cron (vérification quotidienne) — Supabase pg_cron
- Tourne toutes les 24h
- Re-scrape chaque annonce active
- Compare le prix → insère dans `prix_historique`
- Si changement → insère dans `alertes` + déclenche email via Resend

#### Emails — Resend
- **Pourquoi** : API simple, 3000 emails/mois gratuits, templates React
- **Emails envoyés** :
  - Baisse de prix détectée
  - Annonce supprimée (bien probablement loué)
  - Récap hebdomadaire de ta liste

---

## Architecture des dossiers (Nuxt)

```
Hovly/
├── server/
│   └── api/
│       ├── scrape.post.ts        # Reçoit une URL, lance le scraping
│       ├── biens/
│       │   ├── index.get.ts      # Liste les biens de l'utilisateur
│       │   ├── index.post.ts     # Ajoute un bien
│       │   ├── [id].get.ts       # Détail d'un bien
│       │   ├── [id].patch.ts     # Met à jour statut/note
│       │   └── [id].delete.ts    # Supprime un bien
│       └── alertes/
│           └── index.get.ts      # Liste les alertes non vues
├── pages/
│   ├── index.vue                 # Dashboard / tableau comparatif
│   ├── ajouter.vue              # Page d'ajout par URL
│   └── bien/
│       └── [id].vue             # Fiche détaillée du bien
├── components/
│   ├── TableauBiens.vue         # Le tableau principal
│   ├── CarteWell.vue            # Vue carte d'un bien
│   ├── FicheBien.vue            # Détail complet
│   ├── BadgeDPE.vue             # Affichage coloré du DPE
│   ├── BadgeStatut.vue          # À visiter / Visité etc.
│   └── ModalAjout.vue           # Modal pour coller une URL
├── composables/
│   ├── useBiens.ts              # CRUD des biens
│   └── useAlertes.ts            # Gestion des alertes
├── types/
│   └── index.ts                 # Types TypeScript
├── nuxt.config.ts
└── .env.example
```

---

## Variables d'environnement

```bash
# Supabase
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_KEY=eyJ...       # Pour le cron côté serveur

# Resend
RESEND_API_KEY=re_...

# Optionnel : API Anthropic pour l'analyse IA (V3)
ANTHROPIC_API_KEY=sk-ant-...
```

---

## Hébergement et coûts

| Service | Usage | Coût mensuel |
|---|---|---|
| Vercel | Frontend Nuxt | Gratuit |
| Railway | Playwright scraper | ~5 $ |
| Supabase | BDD + Auth + Cron | Gratuit (< 500MB) |
| Resend | Emails | Gratuit (< 3000/mois) |
| **Total** | | **~5 €/mois** |

---

## Ordre de développement suggéré

### Étape 1 — Fondations (Semaine 1)
1. Init projet Nuxt 3 + Tailwind
2. Setup Supabase + schéma BDD
3. Auth (connexion Google via Supabase)

### Étape 2 — Scraping (Semaine 2)
4. Server route `/api/scrape` + Playwright
5. Scraper Leboncoin (le plus simple)
6. Scraper SeLoger
7. Scraper PAP

### Étape 3 — Interface (Semaine 3)
8. Dashboard avec tableau comparatif
9. Page d'ajout par URL
10. Fiche détaillée d'un bien
11. Statuts et notes

### Étape 4 — Alertes (Semaine 4)
12. Cron Supabase (re-scraping quotidien)
13. Détection de changement de prix
14. Emails Resend

---

## Ce que ce projet n'est pas

- **Pas un moteur de recherche** : on ne scrape pas des listes d'annonces, seulement les URLs que l'utilisateur fournit
- **Pas un CRM** : pas de gestion de contacts, de mandats ou de clients
- **Pas un estimateur de prix** : pas d'algorithme de valorisation (ça c'est pour l'outil agent immo)

---

## Risques et limites

| Risque | Mitigation |
|---|---|
| SeLoger bloque le scraping | Délais aléatoires, Playwright avec profil réaliste, fallback sur extraction manuelle |
| Annonce modifiée côté source | Re-scraping quotidien + historique des versions |
| Données manquantes selon les sites | Champs optionnels + saisie manuelle possible |
| Coûts Railway si trafic élevé | Mise en file d'attente des scrapes, rate limiting par utilisateur |
