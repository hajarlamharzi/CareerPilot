import { describe, expect, it } from "vitest";

import {
  ACTIVE_ROLES,
  PERMISSIONS,
  ROLES,
  ROLE_PERMISSIONS,
  SELF_ASSIGNABLE_ROLES,
  can,
  evaluateRoleChange,
  isAdmin,
  isPrivilegedRole,
  isRole,
  permissionsOf,
  roleHasPermission,
  toRoles,
} from "./roles";

/**
 * The permission matrix is the single definition of "who may do what". These
 * tests pin the *negative* cases: the ones a reviewer would otherwise have to
 * take on trust.
 */

describe("permission matrix", () => {
  it("denies by default: an empty role set holds nothing", () => {
    for (const permission of PERMISSIONS) {
      expect(can([], permission)).toBe(false);
    }
  });

  it("never grants an administration permission to a candidate", () => {
    const adminOnly = PERMISSIONS.filter((permission) => permission.startsWith("admin:"));
    // Guard against the list being empty, which would make the loop vacuous.
    expect(adminOnly.length).toBeGreaterThan(0);
    for (const permission of adminOnly) {
      expect(can(["candidate"], permission)).toBe(false);
    }
  });

  it("keeps the full candidate capability set for administrators", () => {
    // Admins are users too: gaining administration must not cost them their own
    // workspace.
    expect(permissionsOf(["admin"])).toEqual(
      expect.arrayContaining(permissionsOf(["candidate"])),
    );
  });

  it("grants no administration permission to the future recruiter role", () => {
    const adminOnly = PERMISSIONS.filter((permission) => permission.startsWith("admin:"));
    for (const permission of adminOnly) {
      expect(roleHasPermission("recruiter", permission)).toBe(false);
    }
  });

  it("only ever lists permissions that exist in the catalogue", () => {
    const known = new Set<string>(PERMISSIONS);
    for (const role of ROLES) {
      for (const permission of ROLE_PERMISSIONS[role]) {
        expect(known.has(permission)).toBe(true);
      }
    }
  });

  it("reserves the admin dashboard for administrators", () => {
    expect(can(["admin"], "admin:dashboard:read")).toBe(true);
    expect(can(["candidate"], "admin:dashboard:read")).toBe(false);
    expect(can(["candidate", "admin"], "admin:dashboard:read")).toBe(true);
  });

  it("is additive across roles", () => {
    expect(can(["candidate"], "jobs:save")).toBe(true);
    expect(can(["recruiter"], "jobs:save")).toBe(false);
    expect(can(["recruiter", "candidate"], "jobs:save")).toBe(true);
  });
});

describe("administrator detection", () => {
  it("recognises the role anywhere in the set", () => {
    expect(isAdmin(["admin"])).toBe(true);
    expect(isAdmin(["candidate", "admin"])).toBe(true);
  });

  it("does not mistake another role for an administrator", () => {
    expect(isAdmin([])).toBe(false);
    expect(isAdmin(["candidate"])).toBe(false);
    expect(isAdmin(["recruiter"])).toBe(false);
  });
});

describe("self-assignable roles", () => {
  it("only allows candidate at registration", () => {
    expect([...SELF_ASSIGNABLE_ROLES]).toEqual(["candidate"]);
  });

  it("classifies every non-candidate MVP role as privileged", () => {
    expect(isPrivilegedRole("admin")).toBe(true);
    expect(isPrivilegedRole("recruiter")).toBe(true);
    expect(isPrivilegedRole("candidate")).toBe(false);
  });
});

describe("role parsing from untrusted input", () => {
  it("keeps known roles and silently drops everything else", () => {
    expect(toRoles(["admin", "root", null, undefined, "", "candidate"])).toEqual([
      "admin",
      "candidate",
    ]);
  });

  it("de-duplicates", () => {
    expect(toRoles(["candidate", "candidate"])).toEqual(["candidate"]);
  });

  it("returns an empty list for junk", () => {
    expect(toRoles([null, undefined, "superadmin", 42 as unknown as string])).toEqual([]);
  });

  it("narrows arbitrary values with isRole", () => {
    expect(isRole("admin")).toBe(true);
    expect(isRole("candidate")).toBe(true);
    expect(isRole("superadmin")).toBe(false);
    expect(isRole(null)).toBe(false);
    expect(isRole(undefined)).toBe(false);
    expect(isRole(3)).toBe(false);
  });
});

describe("evaluateRoleChange", () => {
  it("refuses self-modification even when the actor is an administrator", () => {
    const decision = evaluateRoleChange({
      actorId: "user-1",
      actorRoles: ["admin"],
      targetId: "user-1",
      role: "admin",
    });
    expect(decision.allowed).toBe(false);
    if (decision.allowed) return;
    expect(decision.reason).toContain("ses propres rôles");
  });

  it("refuses a non-administrator before anything else", () => {
    const decision = evaluateRoleChange({
      actorId: "user-1",
      actorRoles: ["candidate"],
      targetId: "user-2",
      role: "admin",
    });
    expect(decision.allowed).toBe(false);
    if (decision.allowed) return;
    expect(decision.reason).toContain("administrateur");
  });

  it("refuses the not-yet-active recruiter role", () => {
    expect(ACTIVE_ROLES).not.toContain("recruiter");
    const decision = evaluateRoleChange({
      actorId: "user-1",
      actorRoles: ["admin"],
      targetId: "user-2",
      role: "recruiter",
    });
    expect(decision.allowed).toBe(false);
    if (decision.allowed) return;
    expect(decision.reason).toContain("pas encore activé");
  });

  it("allows an administrator to grant an active role to somebody else", () => {
    expect(
      evaluateRoleChange({
        actorId: "user-1",
        actorRoles: ["admin"],
        targetId: "user-2",
        role: "candidate",
      }),
    ).toEqual({ allowed: true });
  });
});
