/**
 * Centralised Role-Based Access Control.
 *
 * This is the single source of truth for *who may do what*. Nothing else in the
 * codebase is allowed to invent its own role check: every protected operation
 * calls `can(...)` / `assertCan(...)` (server-side) and the database enforces the
 * same rules again through Row Level Security. Hiding a button is never treated
 * as authorisation.
 *
 * See `docs/AUTH-AND-RBAC.md` for the full matrix and the rationale.
 */

/** Roles the platform understands. */
export const ROLES = ["candidate", "admin", "recruiter"] as const;

export type Role = (typeof ROLES)[number];

/**
 * Roles that public registration may produce. Administrator can never be
 * self-assigned; it is granted only by a trusted server-side operation.
 */
export const SELF_ASSIGNABLE_ROLES = ["candidate"] as const satisfies readonly Role[];

/** Roles that are actually usable in the current MVP. */
export const ACTIVE_ROLES = ["candidate", "admin"] as const satisfies readonly Role[];

/** French display labels. The interface is French by default. */
export const ROLE_LABELS: Record<Role, string> = {
  candidate: "Candidat",
  admin: "Administrateur",
  recruiter: "Recruteur",
};

export const ROLE_DESCRIPTIONS: Record<Role, string> = {
  candidate:
    "Utilise son propre espace de recherche d'emploi : profil, CV, candidatures, assistant IA.",
  admin:
    "Administre la plateforme : sources d'offres, catalogue, comptes, statistiques d'usage.",
  recruiter:
    "Rôle prévu pour une évolution future (publication d'offres par les entreprises). Non activé dans cette version.",
};

/**
 * Every permission the platform recognises, grouped by resource.
 *
 * Read as `resource:action[:scope]`. The `own` scope always means "the rows the
 * authenticated user owns", and must be enforced by both a server-side
 * ownership check and an RLS policy.
 */
export const PERMISSIONS = [
  // --- Own candidate workspace ---------------------------------------------
  "profile:read:own",
  "profile:write:own",
  "profile:delete:own",
  "preferences:read:own",
  "preferences:write:own",
  "skills:write:own",
  "cv:read:own",
  "cv:write:own",
  "cv:delete:own",
  "applications:read:own",
  "applications:write:own",
  "applications:delete:own",
  "analytics:read:own",
  "data:export:own",

  // --- Shared catalogue ----------------------------------------------------
  "jobs:read",
  "jobs:save",
  "jobs:unsave",
  "jobs:submit",
  "assistant:use",

  // --- Administration ------------------------------------------------------
  "admin:dashboard:read",
  "admin:jobs:read",
  "admin:jobs:write",
  "admin:jobs:delete",
  "admin:sources:read",
  "admin:sources:write",
  "admin:imports:write",
  "admin:users:read",
  "admin:roles:write",
  "admin:usage:read",
  "admin:audit:read",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

const CANDIDATE_PERMISSIONS: readonly Permission[] = [
  "profile:read:own",
  "profile:write:own",
  "profile:delete:own",
  "preferences:read:own",
  "preferences:write:own",
  "skills:write:own",
  "cv:read:own",
  "cv:write:own",
  "cv:delete:own",
  "applications:read:own",
  "applications:write:own",
  "applications:delete:own",
  "analytics:read:own",
  "data:export:own",
  "jobs:read",
  "jobs:save",
  "jobs:unsave",
  "jobs:submit",
  "assistant:use",
];

const ADMIN_PERMISSIONS: readonly Permission[] = [
  // Administrators keep the full candidate capability set: they are users too.
  ...CANDIDATE_PERMISSIONS,
  "admin:dashboard:read",
  "admin:jobs:read",
  "admin:jobs:write",
  "admin:jobs:delete",
  "admin:sources:read",
  "admin:sources:write",
  "admin:imports:write",
  "admin:users:read",
  "admin:roles:write",
  "admin:usage:read",
  "admin:audit:read",
];

/**
 * The permission matrix.
 *
 * `recruiter` is defined so the architecture can grow, but it is deliberately
 * *not* granted any platform-wide administration permission and cannot publish
 * anything yet — the empty set is honest about the fact that the feature does
 * not exist.
 */
export const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  candidate: CANDIDATE_PERMISSIONS,
  admin: ADMIN_PERMISSIONS,
  recruiter: ["jobs:read", "profile:read:own", "profile:write:own"],
};

/** `true` when `role` holds `permission`. */
export function roleHasPermission(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}

/** `true` when *any* of `roles` holds `permission`. */
export function can(roles: readonly Role[], permission: Permission): boolean {
  return roles.some((role) => roleHasPermission(role, permission));
}

/** Every permission the union of `roles` grants. */
export function permissionsOf(roles: readonly Role[]): Permission[] {
  const granted = new Set<Permission>();
  for (const role of roles) {
    for (const permission of ROLE_PERMISSIONS[role]) granted.add(permission);
  }
  return [...granted];
}

/** `true` when the role set includes an administrator. */
export function isAdmin(roles: readonly Role[]): boolean {
  return roles.includes("admin");
}

/** Narrow an arbitrary string to a known `Role`. */
export function isRole(value: unknown): value is Role {
  return typeof value === "string" && (ROLES as readonly string[]).includes(value);
}

/** Keep only values that are real roles. Used when loading rows from the DB. */
export function toRoles(values: readonly (string | null | undefined)[]): Role[] {
  const roles = new Set<Role>();
  for (const value of values) {
    if (isRole(value)) roles.add(value);
  }
  return [...roles];
}

// ---------------------------------------------------------------------------
// Privilege-escalation guards
// ---------------------------------------------------------------------------

export interface RoleChangeRequest {
  /** The acting user's id. */
  actorId: string;
  /** The acting user's roles. */
  actorRoles: readonly Role[];
  /** The account being modified. */
  targetId: string;
  /** The role the actor wants to add or remove. */
  role: Role;
}

export type RoleChangeDecision =
  | { allowed: true }
  | { allowed: false; reason: string };

/**
 * Decide whether a role grant/revoke may proceed.
 *
 * Rules enforced here (and again in the database):
 *  - Users may never change their own roles, even administrators. This removes
 *    the single most common privilege-escalation path and guarantees that an
 *    audit trail always has a different actor than the target.
 *  - Only administrators may change roles at all.
 *  - `admin` may only be granted or revoked by a server-side operation holding
 *    the privileged key, so `assertCanGrantRole` is checked in addition to this
 *    function.
 */
export function evaluateRoleChange(request: RoleChangeRequest): RoleChangeDecision {
  const { actorId, actorRoles, targetId, role } = request;

  if (actorId === targetId) {
    return {
      allowed: false,
      reason:
        "Un utilisateur ne peut jamais modifier ses propres rôles, même administrateur.",
    };
  }

  if (!isAdmin(actorRoles)) {
    return {
      allowed: false,
      reason: "Seul un administrateur peut modifier les rôles.",
    };
  }

  // Refuse anything that is not an active MVP role, so the future `recruiter`
  // role cannot be handed out before the feature exists.
  if (!(ACTIVE_ROLES as readonly string[]).includes(role)) {
    return {
      allowed: false,
      reason: `Le rôle « ${ROLE_LABELS[role]} » n'est pas encore activé sur la plateforme.`,
    };
  }

  return { allowed: true };
}

/**
 * Roles a candidate can never obtain by themselves. Public registration and
 * profile updates reject any attempt to send one of these.
 */
export function isPrivilegedRole(role: Role): boolean {
  return role === "admin" || role === "recruiter";
}
