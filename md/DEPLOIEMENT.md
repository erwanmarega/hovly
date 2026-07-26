# Déploiement — Railway + Supabase

Une image Docker, deux services Railway. Le scraping tourne dans le service web
(Chromium déjà chaud) ; le service cron ne fait que déclencher les endpoints.

```
Railway
├── web    Dockerfile        Nuxt SSR + API + Playwright, HTTPS public
└── cron   Dockerfile.cron   alpine + curl, planifié, réseau privé
```

## 1. Bases Supabase

Deux projets, car le local ne doit pas écrire dans les données de production.

| Environnement | Projet | Utilisé par |
| --- | --- | --- |
| prod | projet existant (contient les données) | Railway |
| dev | `hovly-dev` (à créer, vide) | `npm run dev` |

Sur le projet dev : rejouer `supabase/schema.sql` dans le SQL Editor. Le fichier
est idempotent.

**Le free tier autorise 2 projets actifs par organisation.** Un projet free se met
en pause après ~7 jours d'inactivité ; il se réveille en un clic.

### Authentication → URL Configuration

À faire dans **chaque** projet, sinon les emails de confirmation pointent vers la
mauvaise URL et personne ne peut créer de compte.

| Projet | Site URL | Redirect URLs |
| --- | --- | --- |
| dev | `http://localhost:3000` | `http://localhost:3000/confirm` |
| prod | `https://<app>.up.railway.app` | `https://<app>.up.railway.app/confirm` |

## 2. Service `web`

| Réglage | Valeur |
| --- | --- |
| Builder | Dockerfile |
| Dockerfile Path | `Dockerfile` |
| Port | `3000` (détecté via `EXPOSE`) |

Image : **628 Mo**, base `node:24-bookworm-slim` + Chromium installé par
`playwright install --with-deps`. L'image officielle
`mcr.microsoft.com/playwright` serait plus rapide à construire mais pèse 4,23 Go
— elle embarque Firefox et WebKit, inutiles ici.

`HOST=::` est déjà dans le Dockerfile. **Ne pas le remplacer par `0.0.0.0`** : le
réseau privé Railway est en IPv6 uniquement, un serveur qui n'écoute qu'en IPv4
y est injoignable et le service cron échouerait en boucle.

### Variables — attention au préfixe `NUXT_`

**C'est le piège principal.** `@nuxtjs/supabase` et `runtimeConfig` lisent
`SUPABASE_URL` & co. **au moment du build**. Dans une image Docker, le build n'a
pas ces variables : les valeurs sont donc vides, et le site renvoie 500 avec
« Your project's URL and Key are required to create a Supabase client! » — sans
rien écrire dans les logs.

Pour surcharger `runtimeConfig` au démarrage, Nuxt impose le préfixe `NUXT_`.
Les trois variables Supabase doivent donc être nommées ainsi sur Railway :

```
NUXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NUXT_PUBLIC_SUPABASE_KEY=<clé anon>
NUXT_SUPABASE_SERVICE_KEY=<clé service_role>
```

Les autres sont lues par `process.env` directement dans le code : elles gardent
leur nom d'origine.

```
RESEND_API_KEY, RESEND_FROM
CRON_SECRET
SCRAPINGBEE_API_KEY
VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT
ORS_API_KEY
SITE_URL=https://<app>.up.railway.app
```

`SITE_URL` pilote les liens des emails de veille — le laisser sur `localhost`
envoie des emails avec des liens morts.

En local rien ne change : `npm run dev` lit `.env` au démarrage, les noms sans
préfixe fonctionnent.

## 3. Service `cron`

Même repo, autre Dockerfile.

| Réglage | Valeur |
| --- | --- |
| Builder | Dockerfile |
| Dockerfile Path | `Dockerfile.cron` |
| Cron Schedule | `0 * * * *` (toutes les heures) |

### Variables

```
CRON_SECRET=<identique au service web>
WEB_INTERNAL_URL=http://<nom-du-service-web>.railway.internal:3000
CRON_TIMEOUT=900   # optionnel, 15 min par défaut
```

Le réseau privé évite le proxy public, qui coupe les requêtes longues : un scan
de 25 veilles peut durer plusieurs minutes.

`cron.sh` appelle les trois endpoints à la suite et sort en code 1 si l'un
échoue, pour que l'erreur soit visible dans les logs Railway.

## 4. Vérifications après le premier déploiement

1. La page d'accueil répond en HTTPS.
2. Connexion : créer un compte, recevoir l'email, cliquer le lien.
3. **Scan d'une veille depuis Railway.** C'est le vrai test : si le résultat est
   une erreur 423 (« bloquée par un anti-bot »), l'IP datacenter de Railway est
   filtrée par le site et tout le scraping retombe sur ScrapingBee. Voir plus bas.
4. Attendre un passage du cron, vérifier les logs du service `cron`.
5. Notifications push : les autoriser depuis le profil, déclencher un scan.

## Si l'IP Railway est bloquée

Les sites immobiliers filtrent les plages datacenter plus durement que les IP
résidentielles. Signature : `423` systématique là où le même code fonctionne en
local.

Palliatifs, du moins au plus coûteux :

1. Baisser la fréquence des veilles (3 h au lieu de 1 h) et
   `MAX_RECHERCHES_PAR_RUN` dans `server/api/cron/veille.post.ts`.
2. Ajouter les sites concernés à `SITES_PROTEGES` (dans `scrape/index.ts` **et**
   `scrape/liste.ts`) pour router directement vers ScrapingBee, sans perdre un
   aller-retour Playwright à chaque fois.
3. Surveiller la consommation de crédits ScrapingBee : `stealth_proxy` +
   `render_js` est leur tarif haut.

## Coût attendu

| Poste | Coût |
| --- | --- |
| Railway Hobby (5 $ de crédits inclus) | ~4–5 $/mois d'usage estimé |
| Supabase, 2 projets free | 0 € |
| Resend, ORS, Transitous, api-adresse | 0 € |
| ScrapingBee | abonnement existant |

Railway facture à l'usage réel (10 $/Go de RAM/mois, 20 $/vCPU/mois, au prorata
des minutes), pas au dimensionnement. À confirmer sur le dashboard après une
semaine.

## Changements de schéma

`supabase/schema.sql` est la seule source de vérité — ne pas modifier le schéma
via l'UI Supabase. Toujours l'appliquer sur dev, puis sur prod juste avant le
déploiement.

`create table if not exists` ne sait pas faire évoluer une table existante. Le
jour où il faudra renommer ou supprimer une colonne avec de vrais utilisateurs
en base, passer au CLI Supabase et à des migrations versionnées.
