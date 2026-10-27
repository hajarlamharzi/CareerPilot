# CareerPilot

Plateforme de recherche d'emploi assistée par IA : catalogue d'offres, CV, suivi
de candidatures, préparation d'entretiens, statistiques et un assistant
conversationnel — avec des comptes réels (Supabase + PostgreSQL + RLS), une
gestion des rôles (RBAC) et une administration, ou **sans aucun compte** en mode
démo local dans le navigateur.

> Ce document décrit **chaque page de l'application, son rôle, et comment
> l'utiliser étape par étape**. Il explique aussi comment configurer Supabase et
> un fournisseur d'IA, et ce qui se passe quand ils ne sont pas configurés.

---

## Sommaire

1. [Ce que fait l'application](#1-ce-que-fait-lapplication)
2. [Les deux modes : cloud et démo local](#2-les-deux-modes--cloud-et-démo-local)
3. [Démarrage rapide (sans configuration)](#3-démarrage-rapide-sans-configuration)
4. [Configuration complète](#4-configuration-complète)
   - [4.1 Supabase (comptes, base de données, RLS)](#41-supabase-comptes-base-de-données-rls)
   - [4.2 Fournisseur d'IA (Gemini ou OpenRouter)](#42-fournisseur-dia-gemini-ou-openrouter)
   - [4.3 Variables d'environnement](#43-variables-denvironnement)
   - [4.4 Créer un administrateur](#44-créer-un-administrateur)
5. [Rôles et permissions (RBAC)](#5-rôles-et-permissions-rbac)
6. [Guide des pages, étape par étape](#6-guide-des-pages-étape-par-étape)
7. [Les routes API](#7-les-routes-api)
8. [Sécurité](#8-sécurité)
9. [Tests et vérifications](#9-tests-et-vérifications)
10. [Déploiement (Vercel)](#10-déploiement-vercel)
11. [Structure du projet](#11-structure-du-projet)
12. [Limites connues](#12-limites-connues)

---

## 1. Ce que fait l'application

- **Chercher de vraies offres** : le catalogue local (filtrable, trié, paginé)
  **plus** une **recherche en direct** dans des sources d'offres publiques
  configurées (Adzuna, Jobicy) — avec provenance, crédit et lien d'origine.
- **Gérer un CV** : importer un CV existant (texte/PDF) ou le construire dans un
  éditeur structuré, puis comparer un CV à une offre (**adéquation**).
- **Suivre ses candidatures** : pipeline (favoris, postulé, entretien…), notes,
  historique de statut, relances.
- **Préparer ses entretiens** : banque de questions, réponses, mode entraînement.
- **Analyser sa recherche** : statistiques calculées uniquement à partir de vos
  propres données (taux de réponse, entonnoir, délais).
- **Assistant IA adaptatif selon le rôle** conversationnel qui interroge les
  **mêmes sources d'offres** que vous, lit votre profil/CV, analyse un écart de
  compétences, et **propose** des actions (enregistrer une offre, créer une
  candidature) — toujours derrière une confirmation explicite. Le ton et les
  suggestions changent selon le rôle (`candidate` / `admin`) ; les permissions,
  elles, sont vérifiées côté serveur.
- **Administration** : vue d'ensemble, comptes et rôles, catalogue, sources
  d'offres, usage de l'IA, journal d'audit — réservée au rôle `admin`.

Aucune annonce n'est inventée : le catalogue ne contient que ce qui y a été
réellement enregistré, les lignes de démonstration sont explicitement étiquetées
« Donnée d'exemple », et une offre « en direct » porte toujours le nom de sa
source et un lien vers sa page d'origine.

### 1.1 Sources d'offres en direct

| Source | Clé requise | Couverture | Filtre pays |
| --- | --- | --- | --- |
| **Adzuna** | `ADZUNA_APP_ID` + `ADZUNA_APP_KEY` (serveur) | 19 marchés documentés (dont FR, GB, DE, ES, IT, US…) | **strict** (marché dans l'URL) |
| **Jobicy** | aucune | télétravail uniquement, ~7 jours, zones documentées | **indicatif** |

**Honnêteté assumée :** ni Adzuna ni Jobicy ne documentent le Maroc. Une
recherche « Maroc » **saute** ces sources avec un message explicite — elle ne
renvoie jamais les offres d'un autre pays à la place. Le filtre pays de Jobicy
est *indicatif* : il renvoie aussi des offres multi-pays, ce que l'interface
affiche noir sur blanc pour chaque source.

Sans `ADZUNA_*`, la source est simplement **désactivée** avec la liste exacte
des variables à renseigner ; Jobicy reste utilisable sans aucune clé. Rien n'est
simulé et aucune offre de remplacement n'est fabriquée.

---

## 2. Les deux modes : cloud et démo local

L'application choisit automatiquement son mode de fonctionnement au démarrage.

| | **Mode démo local** (par défaut) | **Mode cloud** |
| --- | --- | --- |
| Déclencheur | aucune variable Supabase | `NEXT_PUBLIC_SUPABASE_URL` + clés définies |
| Comptes | aucun | comptes Supabase réels (e-mail + mot de passe) |
| Données de l'espace de travail (CV, candidatures, offres locales, entretiens) | stockées **dans votre navigateur** | idem (l'espace de travail reste navigateur) |
| Profil et préférences | dans le navigateur | dans PostgreSQL, protégés par RLS |
| Favoris / candidatures créés par l'assistant IA | appliqués localement par le navigateur | écrits dans PostgreSQL, liés à **votre** compte |
| Administration (`/admin`) | désactivée | réservée au rôle `admin` |
| Assistant IA | fonctionne **si** une clé IA est présente ; sinon explique quoi configurer | idem |
| Recherche d'offres en direct | fonctionne **si** Adzuna est configurée ; Jobicy fonctionne sans clé | idem |
| Rôle de l'assistant (suggestions, ton) | `candidate` | vos rôles réels (`candidate` / `admin`) |

> **Important.** En mode démo local, il n'y a **pas d'authentification** : les
> pages applicatives sont accessibles directement et l'interface l'indique
> (« mode démo local »). Ce n'est pas une fausse connexion : c'est un espace de
> travail mono-utilisateur dans le navigateur. L'administration y est toujours
> refusée.

Dans les deux modes, l'assistant et les fonctions IA **échouent proprement**
avec un message clair si aucune clé n'est configurée, au lieu de prétendre
répondre.

---

## 3. Démarrage rapide (sans configuration)

Prérequis : **Node.js 20+** et npm.

```bash
npm install
npm run dev
```

Ouvrez l'URL affichée par Next.js (par défaut `http://localhost:3000` ; si le port
est occupé, Next.js en choisit un autre et l'affiche).

Vous pouvez immédiatement :

1. visiter la **page d'accueil** `/` ;
2. entrer dans l'**espace de travail** (`/dashboard`) : pas de compte requis en
   mode démo local ;
3. **ajouter une offre** (`/jobs/new`), **importer un CV** (`/cv`), **créer une
   candidature** (`/applications`), tout est conservé dans votre navigateur.

Pour activer les **comptes réels**, l'**administration** et l'**IA en ligne**,
passez à la section 4.

---

## 4. Configuration complète

### 4.1 Supabase (comptes, base de données, RLS)

1. **Créer un projet** sur [supabase.com](https://supabase.com) et noter :
   - l'URL du projet (`Project URL`) ;
   - la clé **publique** : `sb_publishable_…` (projets récents) ou la clé
     `anon` (projets plus anciens). Les deux conviennent.
2. **Appliquer les migrations.** Le schéma et les politiques RLS sont dans
   `supabase/migrations/` :
   - `20260101000000_init.sql` — tables, index, contraintes, stockage CV privé ;
   - `20260101000001_rls.sql` — activation de RLS et politiques.

   Le plus simple : copiez le contenu de ces fichiers dans l'éditeur SQL du
   tableau de bord Supabase, dans l'ordre. Ou, avec la CLI Supabase :

   ```bash
   supabase link --project-ref <votre-ref>
   supabase db push
   ```

3. **(Optionnel) Charger des exemples.** `supabase/seed.sql` insère quelques
   offres **explicitement marquées** `is_sample = true` / `source_type = 'sample'`
   (badge « Donnée d'exemple » dans l'interface). Ne l'exécutez pas si vous ne
   voulez pas de données de démonstration.

4. **Configurer l'authentification.** Dans Supabase → *Authentication* :
   - activez le fournisseur **Email** ;
   - ajoutez vos URLs de redirection :
     `http://localhost:3000/auth/callback` (et l'URL de production équivalente) ;
   - décidez si la **confirmation d'e-mail** est requise (recommandé). Si elle
     l'est, l'utilisateur doit cliquer le lien reçu avant de pouvoir se connecter.

5. **Renseigner `.env.local`** (voir [4.3](#43-variables-denvironnement)). Au
   redémarrage, l'application passe automatiquement en **mode cloud**.

6. **(Recommandé) Générer un secret de signature** pour les confirmations
   d'actions IA :

   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
   ```

   Placez la valeur dans `ACTION_SIGNING_SECRET`.

### 4.2 Sources d'offres en direct (Adzuna + Jobicy)

La recherche d'offres en direct est **optionnelle** : sans configuration, elle
signale honnêtement que la source est désactivée.

**Adzuna** (marchés nationaux, dont la France) :

1. Créez une application sur [developer.adzuna.com](https://developer.adzuna.com/).
2. Dans `.env.local` :

   ```env
   ADZUNA_APP_ID=votre-app-id
   ADZUNA_APP_KEY=votre-app-key
   ```

   Ces deux variables sont **serveur uniquement** : elles ne doivent jamais être
   préfixées par `NEXT_PUBLIC_`. Le plan gratuit d'Adzuna est limité en débit :
   en cas de `429`, l'interface affiche « limite atteinte » pour cette source et
   les autres continuent de fonctionner.

**Jobicy** (télétravail, sans clé) : rien à configurer. Le crédit « Jobicy » et
le lien d'origine sont affichés avec chaque offre, comme l'exigent leurs
conditions. La fenêtre de publication est d'environ 7 jours ; quelques
caractères de remplacement (`�`) présents dans leur flux sont nettoyés à
l'affichage, sans jamais deviner le caractère d'origine.

**Couverture géographique — à lire avant de promettre quoi que ce soit :**

- Adzuna documente **19 marchés** : AT, AU, BE, BR, CA, CH, DE, ES, FR, GB, IN,
  IT, MX, NL, NZ, PL, SG, US, ZA. **Le Maroc n'en fait pas partie.**
- Jobicy n'expose **aucun** filtre `geo` pour le Maroc.
- Une recherche sur un pays non couvert **n'interroge pas** ces sources : elle
  l'indique explicitement au lieu d'afficher les offres d'un autre pays.
- Le filtre pays de Jobicy est **indicatif** (offres multi-pays possibles) ;
  celui d'Adzuna est **strict** (marché encodé dans l'URL de l'API).

Les résultats sont mis en cache **5 minutes** en mémoire (borné à 80 entrées) et
dédupliqués par URL canonique. Les offres en direct reçoivent un identifiant
préfixé `live:{source}:{id}` : elles ne peuvent donc jamais être confondues avec
une entrée du catalogue.

### 4.3 Fournisseur d'IA (Gemini ou OpenRouter)

Les clés IA ne sont **jamais** exposées au navigateur : tous les appels partent
du serveur. Le fournisseur se choisit avec `AI_PROVIDER` (`gemini` ou
`openrouter`) et la clé se place dans `AI_API_KEY`.

**Option A — Google Gemini**

1. Créez une clé API sur [Google AI Studio](https://aistudio.google.com/app/apikey).
2. Dans `.env.local` :

   ```env
   AI_PROVIDER=gemini
   AI_API_KEY=votre-cle
   AI_MODEL=
   ```

**Option B — OpenRouter**

1. Créez une clé sur [openrouter.ai/keys](https://openrouter.ai/keys).
2. Dans `.env.local` :

   ```env
   AI_PROVIDER=openrouter
   AI_API_KEY=votre-cle
   AI_MODEL=google/gemini-2.0-flash-001
   ```

`AI_MODEL` est facultatif : laissez-le vide pour utiliser le modèle par défaut du
fournisseur (voir `src/lib/ai/providers.ts`). `AI_APP_URL` sert à l'attribution
OpenRouter (par défaut `http://localhost:3000`).

Sans clé, l'application reste utilisable : les pages IA et l'assistant affichent
un message expliquant qu'aucun fournisseur n'est configuré.

### 4.4 Variables d'environnement

Copiez `.env.example` vers `.env.local` (PowerShell : `Copy-Item .env.example
.env.local`) et renseignez ce dont vous avez besoin. Tout est optionnel : sans
variables, l'application tourne en **mode démo local**.

| Variable | Rôle | Requis |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | URL du projet Supabase | pour le mode cloud |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Clé publique Supabase (nouveaux projets, `sb_publishable_…`) | pour le mode cloud |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Clé publique Supabase (anciens projets) — utilisée si la précédente est absente | alternative |
| `SUPABASE_SERVICE_ROLE_KEY` | Clé serveur **secrète** (script admin, imports) | pour créer un admin |
| `AI_PROVIDER` | `gemini` ou `openrouter` | pour l'IA |
| `ADZUNA_APP_ID` | Identifiant d'application Adzuna (**serveur uniquement**) | pour la source Adzuna |
| `ADZUNA_APP_KEY` | Clé d'application Adzuna (**serveur uniquement**) | pour la source Adzuna |
| `AI_API_KEY` | Clé du fournisseur IA (serveur uniquement) | pour l'IA |
| `AI_MODEL` | Identifiant de modèle (vide = défaut du fournisseur) | facultatif |
| `AI_APP_URL` | Origine de l'application (attribution OpenRouter, liens hors requête) | facultatif |
| `AI_RATE_LIMIT_MAX` | Nombre d'appels IA par fenêtre et par utilisateur (défaut 20) | facultatif |
| `AI_RATE_LIMIT_WINDOW_SECONDS` | Durée de la fenêtre de limitation (défaut 300) | facultatif |
| `ACTION_SIGNING_SECRET` | Signature des confirmations d'actions IA | recommandé en production |

Il n'y a **pas** de variable d'URL publique dédiée : les liens de confirmation
dérivent de l'en-tête `Host` de la requête, avec `AI_APP_URL` comme repli.

> ⚠️ `SUPABASE_SERVICE_ROLE_KEY` contourne RLS. Ne la mettez **jamais** dans une
> variable `NEXT_PUBLIC_*` et ne l'utilisez que dans un script serveur.

### 4.5 Créer un administrateur

Le rôle `admin` **ne peut jamais** être choisi à l'inscription. Il s'attribue
uniquement par une opération serveur de confiance, ici un script :

```bash
npm run create-admin -- vous@example.com
```

> Le script lit `.env.local` (variable `SUPABASE_SERVICE_ROLE_KEY` incluse). Le
> fichier doit donc exister. Pour créer le compte au passage :
> `npm run create-admin -- vous@example.com --create`.

Le script utilise la clé service role, écrit une ligne d'audit et refuse de
modifier vos propres rôles depuis l'interface (voir la règle « pas
d'auto-promotion » en section 5). Une fois le rôle accordé, reconnectez-vous :
le lien **Administration** apparaît dans la barre latérale.

---

## 5. Rôles et permissions (RBAC)

La source de vérité unique est `src/lib/auth/roles.ts`. Aucun autre fichier ne
définit de contrôle de rôle : les pages appellent `requirePermission(...)` côté
serveur, et **PostgreSQL applique les mêmes règles** via RLS.

| Rôle | État | Peut faire |
| --- | --- | --- |
| `candidate` | **actif** (rôle par défaut) | tout l'espace de travail personnel : profil, préférences, CV, candidatures, favoris, statistiques, assistant |
| `admin` | **actif** | tout ce que fait un candidat **plus** l'administration : comptes, rôles, catalogue, sources, usage IA, audit |
| `recruiter` | prévu, **non activé** | rôle réservé à une évolution future ; ne peut ni publier ni administrer |

Règles structurantes :

- **Refus par défaut** : un appelant sans le rôle requis est refusé (jamais
  « autorisé par omission »).
- **Pas d'auto-promotion** : un utilisateur ne peut jamais modifier ses propres
  rôles, même administrateur (`evaluateRoleChange`), ce qui garantit que l'auteur
  d'un changement est toujours distinct de la cible.
- **Portée « own »** : les permissions de type `…:own` s'accompagnent toujours
  d'une vérification de propriété côté serveur *et* d'une politique RLS.
- **Cacher un bouton n'est pas autoriser** : masquer un lien n'est que de la
  présentation ; l'accès est refusé au niveau serveur. L'assistant adapte ses
  suggestions au rôle, mais son **outillage reste autorisé par `can()`** dans
  `executeTool` : un rôle ne peut pas être « emprunté » via l'interface.

Détail complet : [`docs/AUTH-AND-RBAC.md`](docs/AUTH-AND-RBAC.md).

---

## 6. Guide des pages, étape par étape

### 6.1 Pages publiques

#### `/` — Accueil (page marketing)

- **Rôle** : présenter le produit à un visiteur non connecté.
- **Ce que vous y faites** :
  1. lisez la promesse et les fonctionnalités clés ;
  2. parcourez « Comment ça marche » et l'encart de confidentialité ;
  3. cliquez **Créer un compte** ou **Se connecter**.

#### `/privacy` — Confidentialité

- **Rôle** : expliquer où vivent les données (navigateur vs Supabase) et ce que
  l'IA peut voir.
- **Ce que vous y faites** : lire la politique et les garanties, puis revenir à
  l'accueil ou à l'application.

### 6.2 Authentification (mode cloud)

Ces pages n'ont d'effet que lorsque Supabase est configuré. En mode démo local,
elles affichent un encart expliquant que l'authentification n'est pas configurée.

#### `/login` — Connexion

- **Rôle** : ouvrir une session.
- **Étapes** :
  1. saisissez votre e-mail et votre mot de passe ;
  2. validez ;
  3. si un paramètre `?next=/chemin` est présent, vous êtes redirigé vers cette
     page interne (uniquement après vérification que le chemin est interne) ;
     sinon vers `/dashboard` ;
  4. si vous êtes déjà connecté, vous êtes renvoyé vers `/dashboard`.
- **Liens** : *Mot de passe oublié ?* et *Créer un compte*.

#### `/register` — Créer un compte

- **Rôle** : créer un compte candidat.
- **Étapes** :
  1. renseignez e-mail + mot de passe (règles de robustesse appliquées) ;
  2. validez ;
  3. un e-mail de vérification peut être envoyé selon votre configuration ;
  4. le rôle attribué est **toujours** `candidate` : aucun rôle privilégié ne peut
     être demandé ici.

#### `/forgot-password` — Mot de passe oublié

- **Rôle** : demander un lien de réinitialisation.
- **Étapes** : saisissez votre e-mail, validez, puis ouvrez le lien reçu.
  (La réponse ne révèle jamais si l'adresse existe ou non.)

#### `/reset-password` — Nouveau mot de passe

- **Rôle** : définir un nouveau mot de passe depuis le lien de réinitialisation.
- **Étapes** : saisissez le nouveau mot de passe (et sa confirmation), validez,
  puis connectez-vous.

### 6.3 Espace de travail (connecté, ou démo locale)

Toutes ces pages sont accessibles à un utilisateur connecté (mode cloud) ou
directement en **mode démo local**. Le shell affiche la navigation, la barre
supérieure et, en mode démo, un badge explicite.

#### `/dashboard` — Tableau de bord

- **Rôle** : point d'entrée, résumé de votre recherche.
- **Ce que vous y faites** :
  1. lisez les indicateurs clés (candidatures, relances, entretiens à venir) ;
  2. repérez les actions suggérées ;
  3. naviguez vers les offres, le CV ou l'assistant.

#### `/assistant` — Assistant IA

- **Rôle** : interagir en langage naturel avec vos données et les sources
  d'offres réelles. L'assistant est **adapté à votre rôle** : le badge affiché et
  les suggestions proposées changent (candidat ou administrateur). Le ton
  s'adapte, **les permissions non** : chaque outil est autorisé côté serveur.
- **Ce que vous y faites** :
  1. posez une question (« trouve-moi des offres React à Lyon ») ou choisissez une
     suggestion ;
  2. lisez la réponse, les fiches d'offres et les actions proposées ;
  3. **arrêtez** une réponse en cours, **réessayez** la dernière question,
     **copiez** une réponse ou **effacez** la conversation selon vos besoins ;
  4. lorsqu'une action écrit des données (créer une candidature…), **validez la
     confirmation** affichée — rien n'est enregistré avant votre accord ;
  5. ajustez ou posez une question de suivi.
- **Sécurité et honnêteté** : l'assistant interroge le catalogue **et** les
  sources en direct configurées (il précise lesquelles et leur statut), ne
  génère jamais d'offre, d'entreprise, de salaire ni de lien de candidature, et
  n'exécute aucune action destructive. Le rendu du texte est volontairement
  limité (gras, code, listes) : aucun HTML ni lien du modèle n'est transformé en
  balise cliquable — les seuls liens cliquables sont les fiches d'offres
  validées.

#### `/find-jobs` — Trouver des offres (recherche en direct)

- **Rôle** : interroger en direct les sources d'offres publiques configurées.
- **Étapes** :
  1. vérifiez l'état des sources (configurée / désactivée, et pourquoi) ;
  2. saisissez mots-clés, pays, ville, télétravail, type de contrat, ancienneté,
     salaire minimum, ancienneté de publication ;
  3. lancez la recherche : chaque source est rapportée individuellement (résultat,
     erreur, source sautée, cache) ;
  4. ouvrez l'offre **sur son site d'origine**, enregistrez-la dans votre espace
     de travail ou ajoutez-la directement à vos candidatures ;
  5. activez éventuellement le **score d'adéquation local** (calculé dans le
     navigateur, à partir de votre CV — rien n'est envoyé aux fournisseurs
     d'offres).
- **Honnêteté** : les offres viennent réellement des API interrogées et peuvent
  avoir été pourvues entre-temps ; le nombre de doublons et de résultats hors
  sujet écartés est affiché.

#### `/saved-jobs` — Offres enregistrées

- **Rôle** : retrouver tout ce que vous avez délibérément gardé (favoris et
  présélections), quelle que soit la provenance.
- **Étapes** :
  1. filtrez par titre, entreprise, lieu ou compétence ;
  2. ouvrez la fiche interne ou la source d'origine ;
  3. ajoutez l'offre à vos candidatures (les doublons sont détectés) ;
  4. retirez une offre de vos enregistrements (« Retirer » l'archive).

#### `/onboarding` — Premiers pas

- **Rôle** : checklist guidée de mise en route, avec progression réelle.
- **Étapes** : renseignez le profil → ajoutez un CV → lancez une recherche
  d'offres → enregistrez et suivez une candidature → essayez l'assistant. Chaque
  étape se coche **d'elle-même** dès que la donnée existe. La page rappelle aussi
  ce qui est synchronisé avec le compte (identité, rôle) et ce qui reste dans le
  navigateur (CV, offres, candidatures).

#### `/jobs` — Offres

- **Rôle** : parcourir et organiser le catalogue.
- **Étapes** :
  1. filtrez par mot-clé, intitulé, lieu, entreprise, type de contrat, mode de
     travail, date de publication, salaire minimum ;
  2. triez (pertinence, récence, salaire, entreprise) ;
  3. parcourez les résultats paginés ;
  4. ouvrez une offre, enregistrez-la en favori ou créez une candidature.
- **Provenance** : chaque annonce indique sa source ; les lignes de démonstration
  portent le badge « Donnée d'exemple ».

#### `/jobs/new` — Ajouter une offre

- **Rôle** : enregistrer une annonce que vous avez trouvée ailleurs.
- **Étapes** : renseignez le poste et l'entreprise (obligatoires), plus lieu,
  contrat, salaire, description, compétences et lien de la source ; validez.
  Les doublons évidents sont détectés par une empreinte (titre + entreprise +
  lieu).

#### `/jobs/[id]` — Détail d'une offre

- **Rôle** : lire une annonce et agir dessus.
- **Ce que vous y faites** : consulter la description complète, la provenance, le
  lien d'origine ; adapter votre CV, lancer l'analyse d'adéquation, enregistrer
  l'offre, créer une candidature, ou supprimer l'annonce (avec confirmation).

#### `/match` — Adéquation (CV ↔ offre)

- **Rôle** : mesurer la correspondance entre un CV et une offre.
- **Étapes** :
  1. choisissez un CV et une offre ;
  2. lancez l'analyse ;
  3. lisez le **score détaillé** (couverture des compétences requises, manquantes,
     mots-clés, écarts) — jamais une « probabilité d'embauche » ;
  4. utilisez les recommandations pour améliorer le CV ou cibler des compétences.

#### `/cv` — Mes CV

- **Rôle** : importer et gérer vos CV.
- **Étapes** :
  1. importez un CV (ou partez d'un modèle) ;
  2. laissez le parseur en extraire les sections quand c'est possible ;
  3. ouvrez un CV dans l'éditeur pour l'ajuster ;
  4. définissez le CV **actif** (utilisé par l'adéquation et l'assistant) ;
  5. supprimez un CV si nécessaire (confirmation demandée).

#### `/cv/builder` — Éditeur de CV

- **Rôle** : rédiger un CV structuré et lisible par les ATS.
- **Étapes** : renseignez l'identité, le résumé, l'expérience, les groupes de
  compétences, la formation, les projets, les certifications, les langues et les
  distinctions ; prévisualisez le rendu ; enregistrez.

#### `/applications` — Candidatures

- **Rôle** : suivre chaque candidature.
- **Étapes** :
  1. créez une candidature (ou depuis une offre) ;
  2. déplacez-la dans le pipeline et changez son statut ;
  3. ajoutez des notes et planifiez des relances ;
  4. ouvrez une candidature pour voir son historique complet.

#### `/applications/[id]` — Détail d'une candidature

- **Rôle** : consulter et mettre à jour une candidature précise.
- **Ce que vous y faites** : lire/écrire les notes, changer le statut (l'historique
  est conservé), éditer les coordonnées de contact, enregistrer ou supprimer la
  candidature (confirmation demandée).

#### `/interviews` — Entretiens

- **Rôle** : préparer et s'entraîner.
- **Étapes** : générez ou ajoutez des questions, rédigez vos réponses, marquez-les
  comme travaillées, et révisez la banque de questions.

#### `/analytics` — Statistiques

- **Rôle** : comprendre votre recherche à partir de **vos** données.
- **Ce que vous y faites** : lire l'entonnoir (candidatures → réponses →
  entretiens → offres), les taux de réponse et les délais. Aucune donnée n'est
  inventée : tout est calculé depuis votre espace de travail, et une note de
  méthode explique chaque indicateur.

#### `/profile` — Profil

- **Rôle** : renseigner vos coordonnées et vos préférences de recherche.
- **Étapes** :
  1. en mode cloud, mettez à jour votre profil (stocké dans PostgreSQL, protégé
     par RLS) ;
  2. en mode démo local, renseignez le profil local ;
  3. consultez les cartes « compte » et « confidentialité ».

#### `/settings` — Paramètres

- **Rôle** : configurer l'application.
- **Ce que vous y faites** : préférences, état de l'IA et des sources d'offres,
  stockage local (exporter/importer/vider l'espace de travail).

#### `/settings/account` — Compte et sécurité

- **Rôle** : gérer le **compte** (identité, rôles, mot de passe), par opposition
  aux données de l'espace de travail.
- **Ce que vous y faites** :
  1. consultez l'adresse e-mail et son statut de vérification ;
  2. lisez vos rôles et ce que chacun permet ;
  3. définissez un nouveau mot de passe (la session en cours est déjà vérifiée) ;
  4. vous déconnectez ;
  5. en mode démo local, la page explique à la place quelles variables activent
     les comptes réels.

### 6.4 Administration (rôle `admin` uniquement)

Accès refusé en mode démo local et pour tout compte non administrateur. Chaque
page revérifie la permission côté serveur ; la mise en page affiche un message de
refus en français en cas de manque de droits.

#### `/admin` — Vue d'ensemble

- **Rôle** : indicateurs de la plateforme.
- **Ce que vous y faites** : lire les compteurs (comptes, offres, appels IA) et
  naviguer vers les sections.

#### `/admin/accounts` — Comptes et rôles

- **Rôle** : lister les comptes et leurs rôles (permission `admin:users:read`).
- **Ce que vous y faites** : consulter les comptes. L'attribution du rôle `admin`
  passe par le script serveur, jamais par auto-promotion.

#### `/admin/jobs` — Offres

- **Rôle** : parcourir le catalogue côté administration (`admin:jobs:read`).

#### `/admin/usage` — Usage IA

- **Rôle** : suivre les appels au fournisseur d'IA (`admin:usage:read`).

#### `/admin/audit` — Journal d'audit

- **Rôle** : consulter les actions sensibles enregistrées (`admin:audit:read`).

### 6.5 Pages système

| Chemin | Rôle |
| --- | --- |
| `/auth/callback` | Échange le code (PKCE) ou le `token_hash` d'un e-mail Supabase contre une session, puis redirige vers l'application. |
| `/auth/signout` | Déconnexion (POST), puis redirection vers `/login`. |
| `/not-found` | Page 404 personnalisée. |
| `/error` et `/global-error` | Pages d'erreur applicatives, avec possibilité de réessayer. |

---

## 7. Les routes API

Les traitements serveur sont des **Route Handlers** (aucun secret exposé au client).

| Méthode & chemin | Rôle |
| --- | --- |
| `POST /api/assistant` | Un tour de conversation avec l'assistant : valide la requête, applique les limites de débit, exécute l'outil demandé côté serveur, renvoie la réponse et les actions proposées. |
| `GET /api/assistant?conversations=1` | Liste vos conversations (mode cloud). Sans le paramètre, renvoie seulement l'état de configuration (`configured`, fournisseur, modèle). |
| `POST /api/assistant/confirm` | Exécute une action précédemment proposée **après** vérification du jeton de confirmation signé (HMAC, lié à l'utilisateur, expirant). |
| `POST /api/ai/[feature]` | Fonctions IA ponctuelles : `cv-coach`, `cover-letter`, `interview`, `skill-gap`, `roadmap`, `application-email`. Les diagnostics sont calculés par du code déterministe ; le modèle ne fait que les expliquer. |
| `GET /api/jobs/search` | Recherche d'offres **en direct** dans les sources configurées. Paramètres validés par Zod (`q`, `country`, `location`, `remote`, `types`, `seniority`, `minSalary`, `withinDays`, `page`, `pageSize`, `source`), limite de débit **30 req/min**, sans aucun appel IA. Renvoie les offres, l'état détaillé de **chaque** source, le nombre de doublons et de résultats hors sujet écartés. |
| `GET /api/jobs/providers` | État des sources d'offres (configurée ou non, variables requises, marchés couverts, type de filtre pays, note de couverture) et état du fournisseur d'IA. Aucune clé n'est renvoyée. |
| `GET /auth/callback`, `POST /auth/signout` | Rappel d'authentification et déconnexion (voir 6.5). |

Format d'erreur uniforme :

```json
{ "error": { "code": "forbidden", "message": "…", "details": { } } }
```

Codes possibles : `unauthenticated` (401), `forbidden` (403), `not_found` (404),
`invalid_input` (400), `conflict` (409), `rate_limited` (429),
`not_configured` (503), `provider_error` (502), `internal` (500).

---

## 8. Sécurité

- **Autorisation côté serveur** partout : chaque page protégée et chaque route
  appelle `requirePermission` / `requireAuthenticatedUser` avant de toucher aux
  données.
- **RLS PostgreSQL** : les mêmes règles sont réappliquées par la base, y compris
  pour les lectures faites par les outils IA (client lié à la session).
- **Portée et propriété** : les permissions `…:own` s'accompagnent d'un filtre de
  propriété explicite (la « double ceinture »), pour qu'une ligne d'un autre
  compte ne soit jamais lue ni modifiée.
- **Jeton de confirmation signé (HMAC)** pour les actions IA qui écrivent : le
  modèle ne peut pas autoriser une action, seulement la proposer. Le jeton est lié
  à l'utilisateur et aux arguments, et expire après 10 minutes.
- **Pas de SSRF possible par construction** : aucun outil n'exécute de code, ne
  fait de SQL libre, ni n'appelle une URL fournie par le modèle. Le contenu
  utilisateur est traité comme non fiable (délimité, borné).
- **Anti-injection de prompt** : le contenu externe est encadré et les signaux
  suspects sont remontés à l'interface.
- **Limites de débit** et **plafonds de jetons** sur les routes IA.
- **Aucun secret dans le bundle navigateur** : la clé service role n'est utilisée
  que par un script serveur ; les clés IA (**et** `ADZUNA_APP_ID` /
  `ADZUNA_APP_KEY`, lues depuis `src/lib/env.server.ts`) restent côté serveur.
- **Liens externes jamais rendus aveuglément** : les URL d'offres passent par
  `safeExternalUrl` (seuls `http`/`https`, sans identifiants dans l'URL, avec un
  hôte réel) ; le texte de l'assistant n'est **pas** converti en HTML et les liens
  qu'il contient ne deviennent pas cliquables.
- **Honnêteté des sources** : les offres en direct portent un identifiant
  `live:{source}:{id}`, le nom de la source et un lien d'origine ; une source
  indisponible ou non couverte est rapportée comme telle — jamais remplacée par
  des résultats inventés ou d'un autre marché.

---

## 9. Tests et vérifications

```bash
npm run lint        # ESLint
npm run typecheck   # next typegen + tsc --noEmit
npm test            # Vitest (unitaires)
npm run build       # build de production
```

Couverture notable des tests unitaires :

- **RBAC** (`src/lib/auth/roles.test.ts`) : refus par défaut, pas d'auto-promotion,
  rôle `admin` jamais auto-attribuable, `recruiter` non activé.
- **Erreurs HTTP** (`src/lib/auth/errors.test.ts`) : correspondance code → statut,
  aucune fuite d'information dans les 500.
- **Assistant — outils** (`src/lib/ai/tools.test.ts`) : outil inconnu refusé,
  permission manquante refusée, arguments invalides rejetés, aucune donnée d'un
  autre compte, confirmation obligatoire avant écriture, absence d'outil
  dangereux (SQL/URL/exécution).
- **Jetons de confirmation** (`src/lib/ai/confirmations.test.ts`) : signature,
  falsification, rejeu inter-utilisateur, expiration.
- **Validation des requêtes** (`src/lib/ai/request.test.ts`) : bornes, énumérations,
  suppression des champs inattendus, extraction de mots-clés.
- **Pipeline d'offres** (`src/lib/jobs/pipeline.test.ts`, `text.test.ts`) :
  filtrage, salaire, dates, tri, pagination, facettes, empreinte anti-doublon.
- **Sources en direct** (`src/lib/jobs/live/*.test.ts`, 51 tests) :
  - normalisation défensive : schémas d'URL dangereux rejetés, HTML réduit à du
    texte, caractères de remplacement nettoyés, mappages sans invention,
    résolution de pays qui n'invente jamais un code ;
  - adaptateurs : requêtes correctes (`tag`, `geo`), filtre `geo` omis pour un
    marché non documenté, erreurs HTTP typées, charge utile malformée ignorée,
    crédit Jobicy conservé ;
  - orchestration : source désactivée rapportée avec les variables exactes, une
    source cassée n'affecte pas les autres, marché non couvert **sauté** et non
    remplacé, filtre pays indicatif annoncé, déduplication par URL canonique,
    retrait des résultats hors sujet, cache par requête, statut de timeout.

  **Aucun appel réseau ni appel payant** : les `fetch` sont simulés et les
  adaptateurs sont remplacés par des doubles ; le fan-out réel est désactivé
  quand `NODE_ENV=test`.

```bash
npx vitest run src/lib/jobs/live   # les 51 tests des sources en direct
```

---

## 10. Déploiement (Vercel)

1. Poussez le dépôt sur Git et importez-le dans Vercel.
2. Ajoutez les variables d'environnement (section 4.3) dans les *Settings* du
   projet Vercel.
3. Ajoutez l'URL de production à `AI_APP_URL` et ajoutez
   `https://votre-domaine/auth/callback` aux **URLs de redirection** Supabase.
4. Déployez. Pensez à définir `ACTION_SIGNING_SECRET` : sans lui, les
   confirmations d'actions IA sont signées par une clé aléatoire par instance et
   échouent après un redéploiement ou sur une autre instance.

---

## 11. Structure du projet

```
src/
  app/
    (marketing)/        page d'accueil, confidentialité
    (auth)/             connexion, inscription, mot de passe
    (app)/              espace de travail + administration
    api/                assistant, confirmation, fonctions IA
    auth/               callback et déconnexion
  components/           UI (ui/, layout/, jobs/, assistant/, admin/, shared/)
  features/             logique métier par domaine (auth, profile, jobs, cv, …)
  lib/
    ai/                 fournisseurs, outils, agent, confirmations, sécurité
    auth/               rôles, permissions, session, erreurs
    jobs/               filtres, pipeline, ranking, mapping, recherche
      live/             sources en direct : adaptateurs, normalisation, orchestration
    supabase/           clients navigateur/serveur/admin, types
    storage/            espace de travail navigateur (mode démo local)
  test/                 fixtures et utilitaires de test
supabase/
  migrations/           schéma + politiques RLS
  seed.sql              exemples étiquetés
scripts/
  create-admin.mjs      attribution serveur du rôle admin
docs/
  ARCHITECTURE.md       architecture détaillée
  AUTH-AND-RBAC.md      matrice de rôles et justification
```

---

## 12. Limites connues

- **Sources d'offres en direct.** Adzuna exige des identifiants (gratuits) et
  **ne couvre pas le Maroc** ; Jobicy ne liste que du télétravail sur ~7 jours et
  son filtre pays est **indicatif**. Aucune source ne couvre le Maroc sur site :
  une telle recherche est signalée comme non couverte, jamais remplacée par des
  offres d'un autre marché.
- **Cache d'offres.** Le cache de recherche vit **en mémoire, par instance**
  (5 min, 80 entrées). Sur Vercel, deux instances peuvent interroger la source
  séparément ; c'est acceptable vis-à-vis des quotas mais pas un cache global.
- **Score d'adéquation en direct.** Le score affiché dans « Trouver des offres »
  est calculé **localement dans le navigateur** (opt-in) sur les données de
  l'offre ; il est présenté comme une estimation, pas comme une évaluation.
- **Espace de travail navigateur.** Les pages CV, candidatures, entretiens,
  statistiques et catalogue local stockent leurs données dans le navigateur, même
  en mode cloud. La synchronisation complète de cet espace vers PostgreSQL reste à
  brancher (les conversions `src/lib/jobs/mappers.ts` sont prêtes).
- **Recherche plein-texte.** La recherche de mots-clés des offres est une
  correspondance par sous-chaîne (insensible aux accents), pas encore une recherche
  plein-texte PostgreSQL. Un index GIN `to_tsvector(...)` est déjà prévu dans le
  schéma pour la suite.
- **Limites de débit en mémoire.** Le limiteur est par instance ; un déploiement
  multi-instances devrait s'appuyer sur un stockage partagé.
- **Rôle `recruiter`.** Présent dans le modèle, non activé : aucune fonctionnalité
  de recruteur n'existe dans cette version.
- **Vérification de bout en bout.** Sans projet Supabase configuré, les parcours
  cloud (comptes, RLS, administration, écritures serveur) sont couverts par des
  tests unitaires et des garde-fous serveur, mais pas encore par des tests
  d'intégration contre un vrai projet.
