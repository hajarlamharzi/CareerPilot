# CareerPilot — Architecture

> Document de référence de l'architecture *réelle* du dépôt. Il remplace la note
> de conception « Phase 1 » qui décrivait un projet encore vide.
>
> Voir aussi [`AUTH-AND-RBAC.md`](./AUTH-AND-RBAC.md) (rôles, permissions, RLS) et
> le [`README.md`](../README.md) (guide des pages).

## 1. Vue d'ensemble

Application **Next.js 16 (App Router) + React 19 + TypeScript strict + Tailwind 4
+ shadcn/ui**. Les Server Components et les Route Handlers portent la logique
serveur ; les composants clients portent l'interaction. Aucun secret n'est exposé
au navigateur.

Deux modes de données, choisis automatiquement au démarrage :

| | `local` (démo navigateur) | `cloud` |
| --- | --- | --- |
| Déclencheur | aucune variable Supabase | `NEXT_PUBLIC_SUPABASE_URL` + clés |
| Comptes | aucun | Supabase Auth (e-mail + mot de passe) |
| Espace de travail (CV, candidatures, entretiens, stats, catalogue local) | `localStorage` + IndexedDB | idem |
| Profil / préférences | navigateur | PostgreSQL + RLS |
| Écritures IA (favoris, candidatures) | appliquées par le navigateur | PostgreSQL, liées au compte |
| Administration | désactivée | rôle `admin` requis |

```
Browser (React client components de l'espace de travail)
  ├─ Storage navigateur → localStorage (enregistrements) + IndexedDB (CV binaires)
  ├─ Traitement local → PDF.js / Mammoth.js, jsPDF, moteur d'adéquation déterministe
  └─ Requêtes serveur → /api/assistant, /api/ai/[feature], /api/jobs/*

Serveur (Next.js Route Handlers — runtime Node.js)
  ├─ Auth/RBAC → src/lib/auth/*           (session, rôles, permissions, erreurs)
  ├─ IA        → src/lib/ai/*             (fournisseurs, outils, agent, confirmations)
  ├─ Jobs      → src/lib/jobs/*           (filtres, pipeline, ranking, mapping)
  ├─ Live      → src/lib/jobs/live/*      (adaptateurs Adzuna/Jobicy, cache, dédup)
  ├─ Admin     → src/lib/admin/queries.ts (lectures PostgreSQL)
  └─ Données   → src/lib/supabase/*       (clients navigateur/serveur/admin)
                      │
                      ▼
             Supabase : Auth + PostgreSQL (RLS) + Storage privé

Sources externes (appelées uniquement côté serveur, jamais depuis le navigateur)
  └─ Adzuna API (ADZUNA_APP_ID/KEY) · Jobicy API (publique, crédit requis)
```

## 2. Spécificités Next.js 16

Vérifié contre `node_modules/next/dist/docs/` :

- **Turbopack** par défaut pour `next dev` et `next build`.
- `params` et `searchParams` sont des **Promises** dans les pages/layouts.
- `PageProps<'/route'>` / `LayoutProps<'/route'>` sont des globaux générés par
  `next dev` / `next build` / `next typegen` — d'où le script
  `npm run typecheck` = `next typegen && tsc --noEmit`.
- `next lint` est **supprimé** ; le lint passe par ESLint (`eslint`).
- `middleware` est renommé **`proxy`** (`src/proxy.ts`) ; pas d'Edge runtime.
- `next.config.ts` fixe `cacheComponents: false` et une règle CSS Turbopack —
  à ne pas retirer.

`src/proxy.ts` rafraîchit la session et redirige les visiteurs anonymes. Ce n'est
qu'un confort : **l'autorisation est revérifiée côté serveur** dans chaque page,
chaque route et chaque outil.

## 3. Carte des routes

| Route | Accès | Rôle |
| --- | --- | --- |
| `/` | public | Page marketing |
| `/privacy` | public | Flux de données et confidentialité |
| `/login` `/register` `/forgot-password` `/reset-password` | public | Authentification (cloud) |
| `/auth/callback` (`GET`) | public | Échange PKCE / `token_hash` → session |
| `/auth/signout` (`POST`) | connecté | Déconnexion |
| `/dashboard` | app | Vue d'ensemble |
| `/assistant` | app | Assistant IA (adaptatif selon le rôle) |
| `/onboarding` | app | Checklist de démarrage |
| `/jobs` `/jobs/new` `/jobs/[id]` | app | Catalogue, création, détail |
| `/find-jobs` | app | Recherche en direct (Adzuna, Jobicy) |
| `/saved-jobs` | app | Favoris et offres importées |
| `/match` | app | Adéquation CV ↔ offre |
| `/cv` `/cv/builder` | app | Bibliothèque et éditeur de CV |
| `/applications` `/applications/[id]` | app | Suivi et détail |
| `/interviews` | app | Préparation d'entretiens |
| `/analytics` | app | Statistiques (données locales) |
| `/profile` | app | Profil et préférences |
| `/settings` | app | Préférences, IA, sources, stockage |
| `/settings/account` | app | Identité, rôles, mot de passe, déconnexion |
| `/admin` `/admin/accounts` `/admin/jobs` `/admin/usage` `/admin/audit` | **admin** | Administration (voir RBAC) |

Groupes de routes : `(marketing)` public, `(auth)` connexion, `(app)` espace
connecté (shell + `requirePermission` pour l'administration), `api/*` route
handlers, `auth/*` rappels.

## 4. Authentification et RBAC

- `src/lib/auth/session.ts` — `getSession()` (via `auth.getUser()`, sûr pour
  autoriser), `getPrincipal()`, `requireAuthenticatedUser()`,
  `requirePermission()`, `requireAdmin()`.
- `src/lib/auth/roles.ts` — **source de vérité** de la matrice de rôles
  (`candidate`, `admin`, `recruiter`) et des permissions, plus les garde-fous
  anti-escalade (`evaluateRoleChange`). Voir `AUTH-AND-RBAC.md`.
- Rôles attribuables à l'inscription : `candidate` uniquement. `admin` seulement
  via `scripts/create-admin.mjs` (clé service role + audit).
- RLS PostgreSQL rejoue les mêmes règles ; `user_roles` n'a **aucune** politique
  d'écriture client.

## 5. Schéma de base de données

Migrations versionnées dans `supabase/migrations/` :

- `20260101000000_init.sql` — tables : `profiles`, `user_roles`,
  `candidate_preferences`, `skills`, `candidate_skills`, `job_sources`, `jobs`
  (+ colonne d'empreinte anti-doublon), `saved_jobs`, `applications`,
  `cv_profiles`, `ai_conversations`, `ai_messages`, `ai_usage_logs`,
  `admin_audit_logs`, `job_import_batches`, `learning_goals` ; stockage privé
  `cv_files`.
- `20260101000001_rls.sql` — RLS sur toutes les tables, fonctions
  `has_role` / `is_admin` (`security definer`), politiques par table.

Conventions : les lignes sont en **snake_case**, les types de domaine en
**camelCase** (`src/types/`), la conversion se fait dans `src/lib/jobs/mappers.ts`.

## 6. Domaine « offres »

`src/lib/jobs/` :

- `types.ts` — `JobSearchFilters`, `DEFAULT_JOB_SEARCH_FILTERS`, provenance.
- `filters.ts` — parsing/formatage des paramètres d'URL (Zod).
- `text.ts` — `fold`, `tokenize`, `jobFingerprint` (empreinte de déduplication).
- `pipeline.ts` — `matchesFilters`, `buildResult`, `sortHits`, `buildFacets`,
  `searchLocalCatalogue`, `localProvenance`. **Fonctions pures** : le catalogue
  navigateur et le catalogue PostgreSQL produisent exactement le même résultat.
- `ranking.ts` — score d'adéquation **déterministe** avec décomposition
  (couverture requise, compétences manquantes, mots-clés…). Jamais de
  « probabilité d'embauche ».
- `skill-gap.ts` — analyse d'écart (couvertes / manquantes / ordre
  d'apprentissage).
- `mappers.ts` — conversions lignes ↔ domaine, provenance (`toProvenance`),
  contexte d'hydratation (`JobHydrationContext`).

Limite assumée : la recherche par mot-clé est une correspondance par sous-chaîne
(insensible aux accents), pas encore du plein-texte PostgreSQL. Un index GIN
`to_tsvector(...)` est déjà prévu dans le schéma.

### 6.1 Sources d'offres en direct (`src/lib/jobs/live/`)

Le catalogue local et les sources externes sont **deux chemins distincts** : le
second ne remplace jamais le premier et ne le corrompt jamais.

- `types.ts` — contrat `JobSourceAdapter` (`getSourceId`, `getCapabilities`,
  `isConfigured`, `requiredEnvVars`, `searchJobs`), `LiveJobQuery`,
  `SourceCapabilities` (dont `geoFilter: "strict" | "indicative" | "none"`),
  `SourceRunResult` (statut par source : `ok`, `error`, `timeout`, `skipped`,
  `disabled`).
- `normalizer.ts` — pur et défensif : `safeExternalUrl` (http/https seulement,
  sans identifiants, hôte réel), `stripHtml` (le texte n'est jamais ré-injecté
  comme HTML), `clampDescription`, mappages `employmentType`/`seniority`/
  `workMode` qui renvoient `null` plutôt que d'inventer, `buildSalary` (uniquement
  les valeurs publiées), `liveJobId` (`live:{source}:{extId}`), `canonicalUrl`
  (déduplication), `resolveCountryCode` (pays/ville → ISO, sans invention).
- `adzuna.ts` — 19 marchés documentés, devise locale par marché, filtres
  booléens documentés ; erreurs d'authentification / débit / HTTP typées.
  **Ne couvre pas le Maroc.**
- `jobicy.ts` — API publique sans clé, slugs `geo` officiels, crédit obligatoire ;
  **filtre pays indicatif** (vérifié le 2026-10-20 : `geo=france` renvoie aussi
  des offres multi-pays).
- `registry.ts` — la liste des adaptateurs, isolée pour que l'orchestrateur soit
  testable avec des doubles.
- `search-service.ts` — fan-out avec **timeout par source (9 s)**, cache mémoire
  borné (5 min / 80 entrées), déduplication par URL canonique, retrait des
  résultats sans aucun mot-clé demandé, classement transparent (mots-clés puis
  récence), `listProviders()`, `buildLiveQuery()`, `clearLiveSearchCache()`.

**Règles d'honnêteté, vérifiables dans le code :** aucune source désactivée n'est
présentée comme « 0 offre » ; un marché non documenté est **sauté** avec un
message, jamais remplacé par un autre pays ; un filtre pays indicatif est annoncé
comme tel ; une offre ne porte jamais de salaire, de date ou de compétence que la
source n'a pas publiés. Le fan-out est désactivé quand `NODE_ENV=test`.

## 7. Couche IA

`src/lib/ai/` — abstraction de fournisseur et exécution côté serveur :

- `index.ts` — `getAiStatus()` / sélection du fournisseur.
- `providers/gemini.ts`, `providers/openrouter.ts` — adaptateurs (clé côté
  serveur uniquement).
- `tools.ts` — registre d'outils. Chaque outil déclare sa **permission** et ses
  arguments (Zod). `executeTool` refuse un outil inconnu, une permission
  manquante ou des arguments invalides — **sans jamais lever d'exception** pour
  une erreur imputable au modèle.
- `agent.ts` — boucle de conversation (streaming, appels d'outils, journal).
- `confirmations.ts` — jetons signés **HMAC** pour les actions qui écrivent :
  le modèle *propose*, l'utilisateur *autorise*. Jeton lié à l'utilisateur et aux
  arguments, expiration 10 minutes.
- `safety.ts`, `request.ts` — validation des requêtes, bornes, traitement du
  contenu non fiable (encadré, taille limitée, signaux d'injection remontés).
- `rate-limit.ts`, `usage.ts`, `prompts.ts`, `conversations.ts`, `features.ts`.
- `prompts.ts` — `SCOPE_NOTE` (honnêteté : ce que les sources couvrent ou non) et
  `assistantSystemFor(roles)`, qui produit une **invite système adaptée au rôle**
  (candidat / administrateur / recruteur non activé). L'adaptation porte sur le
  ton, les suggestions et les sujets privilégiés — **jamais** sur les permissions :
  celles-ci sont vérifiées par `can()` dans `executeTool`, côté serveur.

**Frontière de sécurité par construction** : aucun outil n'exécute de code, ne
fait de SQL libre, ni n'appelle une URL fournie par le modèle. Le SSRF est
impossible (il n'y a pas d'outil pour cela). Les outils mutables sans risque
(`save_job`, `unsave_job`) s'exécutent directement ; ceux qui écrivent dans le
suivi (`create_application`, `update_application_status`) exigent une
confirmation.

`search_jobs` est le seul outil qui atteint le réseau, et il le fait par le
**service d'offres en direct** (section 6.1) — jamais par une URL choisie par le
modèle : les hôtes sont codés dans les adaptateurs. Les cartes d'offres en direct
portent `kind: "api"`, `label: "Source externe en direct"` et un lien vers la page
d'origine ; le catalogue reste étiqueté séparément. Une panne d'une source
n'empêche pas le catalogue de répondre (le fan-out est isolé dans un `try`).

## 8. Routes API

| Route | Rôle |
| --- | --- |
| `POST /api/assistant` | Un tour de conversation ; limite de débit, exécution d'outil côté serveur, réponse + actions proposées. |
| `GET /api/assistant?conversations=1` | Liste des conversations (cloud) ; sinon, état de configuration seule. |
| `POST /api/assistant/confirm` | Exécute une action après vérification du jeton signé. |
| `GET /api/jobs/search` | Recherche en direct, paramètres validés par Zod, **30 req/min**, aucun appel IA. Renvoie les offres, le statut par source, les doublons et les résultats hors sujet écartés. |
| `GET /api/jobs/providers` | État des sources (configurée, variables requises, marchés, type de filtre pays) et de l'IA ; aucune clé renvoyée. |
| `POST /api/ai/[feature]` | Six fonctions ponctuelles (`cv-coach`, `cover-letter`, `interview`, `skill-gap`, `roadmap`, `application-email`), `allowTools: false`, diagnostics déterministes. |

Enveloppe d'erreur unique (`src/lib/auth/errors.ts`) :
`{ error: { code, message, details? } }` avec `unauthenticated`, `forbidden`,
`not_found`, `invalid_input`, `conflict`, `rate_limited`, `not_configured`,
`provider_error`, `internal`. Les erreurs inattendues sont journalisées côté
serveur et renvoyées en 500 **opaque** (aucune fuite de message, SQL ou clé).

## 9. Stockage navigateur (mode démo local)

Service centralisé `src/lib/storage/` (adaptateur + schémas Zod + migrations).
Aucun composant n'accède directement à `localStorage`.

```
careerpilot:v1:profile | jobs | applications | cv | preferences | interviews |
matches | activity | meta (schemaVersion, seededAt, workspaceMode)
```

- Chaque enregistrement est validé par Zod à la lecture ; le JSON invalide est mis
  en quarantaine, jamais fatal.
- Les binaires (CV importés) vont dans **IndexedDB** (`careerpilot` / `cvFiles`).
- Quota / stockage désactivé / navigation privée → états d'erreur récupérables.
- Synchronisation inter-onglets via l'événement `storage`.

Le snapshot envoyé à l'assistant en mode local est **revalidé par les mêmes
schémas Zod** (`src/lib/ai/request.ts`) : un navigateur ne peut pas injecter une
offre malformée ou un champ inattendu dans le contexte du modèle.

## 10. Composants

```
src/components/
  ui/         primitives shadcn (button, dialog, select, tabs, table, card, …)
  layout/     app-shell, sidebar(‑nav), topbar, mobile-nav, viewer-context
  shared/     page-header, empty-state, error-state, loading, confirm-dialog,
              stat-card, section-placeholder
  admin/ assistant/ analytics/ applications/ cv/ interviews/ jobs/ marketing/
  navigation/ nav-config, nav-types
```

La logique métier vit dans `src/features/<domaine>/` ; les composants restent au
maximum présentatiels.

## 11. Stratégie de tests

Vitest (jsdom) + Testing Library. `vitest.config.mts` aliase `server-only` vers un
module vide (le paquet jette hors graphe RSC).

| Fichier | Couvre |
| --- | --- |
| `src/lib/auth/roles.test.ts` | Matrice de permissions, refus par défaut, anti-escalade |
| `src/lib/auth/errors.test.ts` | Code → statut HTTP, 500 opaque |
| `src/lib/ai/tools.test.ts` | Frontière des outils : refus, propriété, confirmation, absence d'outil dangereux |
| `src/lib/ai/confirmations.test.ts` | Signature, falsification, rejeu inter-utilisateur, expiration |
| `src/lib/ai/request.test.ts` | Bornes, énumérations, champs inattendus, extraction de mots-clés |
| `src/lib/jobs/pipeline.test.ts`, `text.test.ts` | Filtres, salaire, dates, tri, pagination, facettes, déduplication |
| `src/lib/jobs/live/normalizer.test.ts` | URL dangereuses rejetées, HTML réduit à du texte, mappages sans invention, résolution de pays |
| `src/lib/jobs/live/adzuna.test.ts` | Normalisation Adzuna, devise du marché, rejet des liens non sûrs |
| `src/lib/jobs/live/jobicy.test.ts` | Requête (`tag`, `geo`), paiement optionnel du geo, erreurs HTTP, crédit |
| `src/lib/jobs/live/search-service.test.ts` | Fan-out, statuts par source, dédup, filtre hors sujet, cache, timeout |
| `src/features/**/*.test.ts` | Storage, analytics, parseur CV, banque de questions, candidatures |

Aucun appel payant : l'IA n'est pas testée en ligne, les `fetch` des sources
d'offres sont simulés, et le fan-out live est désactivé quand `NODE_ENV=test`.
Les parcours cloud/IA ne sont pas couverts par des tests d'intégration contre un
vrai projet Supabase.

## 12. Déploiement

- `npm run build` (Turbopack) doit réussir **sans** variable d'environnement : le
  mode démo local ne dépend de rien.
- Vercel : ajouter les variables (section 4.3 du README), `NEXT_PUBLIC_SITE_URL`,
  et l'URL de rappel `…/auth/callback` dans Supabase.
- Définir `ACTION_SIGNING_SECRET` en production, sinon les confirmations IA sont
  signées par une clé aléatoire par instance.
- Pas d'écriture sur le système de fichiers supposée. Limiteur de débit en
  mémoire, donc par instance.

## 13. Définitions analytiques (rappel)

- **Entonnoir.** Une candidature compte à une étape si son étape *la plus
  avancée* (maximum entre le statut courant et l'historique) atteint cette étape.
  `rejected`/`withdrawn` n'ont pas d'étape propre : une candidature refusée après
  un entretien compte comme ayant atteint l'entretien. Les candidatures jamais
  envoyées (`interested`, `saved`) sont exclues de l'entonnoir et comptées à part.
- **Délai de réponse.** Mesuré uniquement lorsque la candidature a une date
  `appliedAt` **et** une transition vers une étape de réponse. Une candidature
  clôturée sans transition de réponse n'est pas comptée « en attente ».

## 14. Limites connues

- L'espace de travail (CV, candidatures, entretiens, statistiques) reste stocké
  dans le navigateur même en mode cloud ; la synchronisation complète vers
  PostgreSQL reste à brancher (`JobHydrationContext` est prêt).
- Recherche par mot-clé par sous-chaîne (pas encore plein-texte PostgreSQL).
- Sources d'offres : Adzuna exige des identifiants et **ne couvre pas le Maroc** ;
  Jobicy se limite au télétravail (~7 jours) avec un filtre pays **indicatif**.
  Aucune source ne couvre le Maroc sur site — la recherche le dit au lieu de
  renvoyer un autre marché.
- Cache de recherche **en mémoire, par instance** (5 min / 80 entrées) : pas de
  cache partagé entre instances. Le score d'adéquation affiché dans « Trouver des
  offres » est calculé localement dans le navigateur (opt-in) et présenté comme
  une estimation.
- Limiteur de débit en mémoire, mono-instance.
- Rôle `recruiter` modélisé mais non activé.
- Parcours cloud non couverts par des tests d'intégration (aucun projet Supabase
  configuré). Les parcours IA sont validés par les garde-fous serveur et les tests
  unitaires des outils et des jetons, pas par des appels en ligne.
