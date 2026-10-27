# Authentification, rôles et permissions (RBAC)

> Ce document décrit **qui a le droit de faire quoi**, comment c'est appliqué, et
> pourquoi. La source de vérité du code est `src/lib/auth/roles.ts` ; la source de
> vérité de la base est `supabase/migrations/20260101000001_rls.sql`.

## 1. Principes

1. **Refus par défaut.** Aucun rôle n'est implicite. Un appelant sans dossier de
   rôle (`user_roles`) est traité comme `candidate`, jamais comme administrateur.
2. **Deux couches, les mêmes règles.** Chaque opération protégée est vérifiée
   *côté serveur* (`requirePermission`) **et** *dans la base* (RLS). Cacher un
   bouton n'est jamais une autorisation.
3. **Pas d'auto-promotion.** Un utilisateur ne peut jamais modifier ses propres
   rôles, même administrateur.
4. **Le rôle `admin` ne s'obtient que par un chemin serveur de confiance**
   (`scripts/create-admin.mjs`, clé service role + ligne d'audit). Il n'existe
   aucun point d'entrée HTTP pour l'accorder.
5. **Les administrateurs ne lisent pas la vie privée.** Ils gèrent la plateforme
   (catalogue, sources, comptes, télémétrie), pas les CV ni les conversations des
   candidats.

## 2. Les rôles

| Rôle | État | Description |
| --- | --- | --- |
| `candidate` | **actif**, rôle par défaut | Espace personnel : profil, préférences, compétences, CV, candidatures, favoris, statistiques, assistant. |
| `admin` | **actif** | Tout ce que fait un candidat, **plus** l'administration. |
| `recruiter` | prévu, **non activé** | Réservé à une évolution future (publication d'offres par les entreprises). Aucune administration, aucune publication dans cette version. |

Rôles **auto-attribuables** à l'inscription : `candidate` uniquement
(`SELF_ASSIGNABLE_ROLES`). Rôles **privilégiés** : `admin`, `recruiter`
(`isPrivilegedRole`) — refusés par l'inscription et par la mise à jour de profil.

## 3. Matrice des permissions

Chaque permission est nommée `ressource:action[:portée]`. La portée `own`
signifie toujours « les lignes dont l'utilisateur authentifié est propriétaire » ;
elle est appliquée par une vérification de propriété **et** par RLS.

### Espace candidat (privé)

| Permission | `candidate` | `admin` | `recruiter` |
| --- | :---: | :---: | :---: |
| `profile:read:own` | ✅ | ✅ | ✅ |
| `profile:write:own` | ✅ | ✅ | ✅ |
| `profile:delete:own` | ✅ | ✅ | ✗ |
| `preferences:read:own` / `:write:own` | ✅ | ✅ | ✗ |
| `skills:write:own` | ✅ | ✅ | ✗ |
| `cv:read:own` / `:write:own` / `:delete:own` | ✅ | ✅ | ✗ |
| `applications:read:own` / `:write:own` / `:delete:own` | ✅ | ✅ | ✗ |
| `analytics:read:own` | ✅ | ✅ | ✗ |
| `data:export:own` | ✅ | ✅ | ✗ |

### Catalogue partagé

| Permission | `candidate` | `admin` | `recruiter` |
| --- | :---: | :---: | :---: |
| `jobs:read` | ✅ | ✅ | ✅ |
| `jobs:save` / `jobs:unsave` | ✅ | ✅ | ✗ |
| `jobs:submit` | ✅ | ✅ | ✗ |
| `assistant:use` | ✅ | ✅ | ✗ |

### Administration (jamais accordée à un candidat)

| Permission | `candidate` | `admin` | `recruiter` |
| --- | :---: | :---: | :---: |
| `admin:dashboard:read` | ✗ | ✅ | ✗ |
| `admin:jobs:read` / `:write` / `:delete` | ✗ | ✅ | ✗ |
| `admin:sources:read` / `:write` | ✗ | ✅ | ✗ |
| `admin:imports:write` | ✗ | ✅ | ✗ |
| `admin:users:read` | ✗ | ✅ | ✗ |
| `admin:roles:write` | ✗ | ✅ | ✗ |
| `admin:usage:read` | ✗ | ✅ | ✗ |
| `admin:audit:read` | ✗ | ✅ | ✗ |

> Les administrateurs conservent **toutes** les permissions candidat : gagner un
> rôle ne doit pas coûter son propre espace de travail.

## 4. Garde-fous anti-escalade

`evaluateRoleChange({ actorId, actorRoles, targetId, role })` refuse :

1. **l'auto-modification** — `actorId === targetId`, même pour un administrateur
   (ainsi l'auteur d'un changement est toujours distinct de la cible, ce qui rend
   la piste d'audit exploitable) ;
2. **tout acteur non administrateur** ;
3. **un rôle non actif** (le futur `recruiter` n'est pas distribuable tant que la
   fonctionnalité n'existe pas).

Les tests correspondants vivent dans `src/lib/auth/roles.test.ts`.

## 5. Où la vérification est appliquée

| Couche | Fichier | Rôle |
| --- | --- | --- |
| Pages applicatives | `src/app/(app)/layout.tsx` | Redirige vers `/login` si non authentifié **en mode cloud**. En mode démo local, laisse passer (pas de compte). |
| Pages d'administration | `src/app/(app)/admin/*/page.tsx` | `await requirePermission("admin:…")` **avant** de toucher aux données. |
| Routes API | `src/app/api/**/route.ts` | `getPrincipal()` puis contrôle de permission ; enveloppe d'erreur uniforme. |
| Outils de l'assistant | `src/lib/ai/tools.ts` | Chaque outil déclare sa `permission` ; `executeTool` refuse sans elle. L'assistant **adapte son invite système et ses suggestions au rôle** (`assistantSystemFor`), mais cette présentation n'accorde rien : la décision reste `can()` côté serveur. |
| Base de données | `supabase/migrations/20260101000001_rls.sql` | Rejoue les mêmes règles pour chaque requête. |
| Script serveur | `scripts/create-admin.mjs` | Seul moyen d'accorder `admin` (clé service role + audit). |

## 6. Row Level Security — résumé

RLS est **activée sur toutes les tables** ; une politique n'existe que là où un
accès légitime et borné est possible.

| Table | Politique | Qui |
| --- | --- | --- |
| `profiles` | `profiles_select_own_or_admin`, `profiles_insert_self`, `profiles_update_self` | soi-même (lecture aussi par un admin) |
| `user_roles` | `user_roles_select_own_or_admin` **uniquement** | lecture de ses propres rôles (ou admin) — **aucune écriture client** |
| `candidate_preferences`, `candidate_skills`, `saved_jobs`, `applications`, `cv_profiles`, `learning_goals` | `*_all_own` | propriétaire uniquement |
| `skills` | `skills_select_all` | catalogue partagé en lecture |
| `jobs` | `jobs_select_published` (+ `jobs_select_admin`) | offres publiées pour tous ; écriture réservée admin |
| `job_sources`, `job_import_batches` | `*_admin_all` | administrateurs |
| `ai_conversations`, `ai_messages` | `*_own` | propriétaire uniquement |
| `ai_usage_logs` | `ai_usage_logs_select_own_or_admin`, `ai_usage_logs_insert_own` | soi-même (lecture admin) |
| `admin_audit_logs` | `admin_audit_logs_select_admin`, `admin_audit_logs_insert_admin` | administrateurs |
| stockage `cv_files` | `cv_files_*_own` | propriétaire (URL signées) |

Deux invariants à retenir :

1. `user_roles` n'a **aucune** politique d'écriture : un client ne peut pas
   s'attribuer un rôle, quoi qu'il envoie.
2. Aucune politique ne permet à un administrateur de lire `cv_profiles`,
   `ai_conversations` ou `ai_messages`.

Les helpers `has_role(uid, role)` et `is_admin(uid)` sont `security definer`
(sinon une politique sur `user_roles` interrogeant `user_roles` récurserait), et
ne renvoient qu'un booléen.

## 7. Le parcours d'authentification

1. **Inscription** (`/register`) → Supabase Auth crée le compte ; le rôle
   `candidate` est attribué (par défaut en base / par le déclencheur).
2. **Vérification e-mail** (si activée) → le lien passe par `/auth/callback`, qui
   échange le code PKCE ou le `token_hash` contre une session.
3. **Connexion** (`/login`) → session conservée par cookies httpOnly ;
   redirection vers `/dashboard` (ou vers `?next=` interne).
4. **Session serveur** → `getSession()` utilise `auth.getUser()` (vérifie le JWT
   auprès du serveur Auth), jamais un simple décodage de cookie.
5. **Déconnexion** (`POST /auth/signout`) → supprime la session, redirige vers
   `/login`.

## 8. Modes de données

| Mode | Comptes | `getSession().isAuthenticated` | Rôles d'un visiteur |
| --- | --- | --- | --- |
| `cloud` (Supabase configuré) | réels | `true` si connecté | `[]` pour un visiteur anonyme |
| `local` (démo navigateur) | aucun | `false` | `["candidate"]` (capacité locale, **pas** une authentification) |

En mode local, `isAuthenticated` reste **faux**, aucune permission
d'administration n'est jamais accordée, et `requireAuthenticatedUser()` lève
`not_configured` : une opération qui exige réellement une identité (écrire une
ligne liée à un utilisateur) ne peut pas s'exécuter silencieusement.

### 8.1 Conséquence sur l'assistant

L'assistant reçoit les rôles de la session (`assistantSystemFor`) pour ajuster son
ton, ses suggestions et ses sujets. En mode local, il ne reçoit que `candidate` —
le rôle `admin` n'existe pas dans ce mode — et ses outils restent bornés par les
mêmes vérifications de permission, qui refusent tout ce qui exige une identité
réelle.
