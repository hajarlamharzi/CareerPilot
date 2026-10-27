import { describe, expect, it } from "vitest";

import type { Principal } from "@/lib/auth/session";
import { makeJob } from "@/test/fixtures";

import { verifyConfirmationToken } from "./confirmations";
import {
  TOOL_DEFINITIONS,
  TOOL_NAMES,
  executeTool,
  isMutatingTool,
  toolRequiresConfirmation,
  type ToolContext,
  type WorkspaceSnapshot,
} from "./tools";

/**
 * The tool layer is the assistant's entire exposure to the outside world: no
 * shell, no SQL, no outbound HTTP. These tests pin the security properties a
 * reviewer cannot see by reading one function — the refusals.
 */

const LOCAL_CANDIDATE: Principal = {
  mode: "local",
  userId: null,
  roles: ["candidate"],
  email: null,
  isAuthenticated: false,
  isAdmin: false,
};

const CLOUD_CANDIDATE: Principal = {
  mode: "cloud",
  userId: "user-1",
  roles: ["candidate"],
  email: "alex@example.test",
  isAuthenticated: true,
  isAdmin: false,
};

function makeSnapshot(overrides: Partial<WorkspaceSnapshot> = {}): WorkspaceSnapshot {
  return {
    profile: {
      fullName: "Alex Moreau",
      headline: "Développeur front-end",
      location: "Lyon",
      summary: "Cinq ans d'expérience React.",
    },
    skills: ["React", "TypeScript"],
    preferences: {
      targetTitles: ["Frontend Developer"],
      locations: ["Lyon"],
      workModes: ["remote"],
      employmentTypes: ["full-time"],
      seniorities: ["mid"],
      minimumSalary: 45_000,
      currency: "EUR",
    },
    jobs: [
      makeJob({
        id: "job-1",
        title: "Frontend Developer",
        company: "Acme",
        location: "Lyon",
        workMode: "remote",
        requiredSkills: ["React", "TypeScript"],
        preferredSkills: ["Tailwind"],
      }),
      makeJob({
        id: "job-2",
        title: "Data Engineer",
        company: "Globex",
        location: "Paris",
        workMode: "hybrid",
        requiredSkills: ["Python", "SQL"],
        description: "Build the data platform.",
      }),
    ],
    applications: [],
    savedJobIds: ["job-1"],
    cv: null,
    ...overrides,
  };
}

function localContext(snapshot: WorkspaceSnapshot | null = makeSnapshot()): ToolContext {
  return { principal: LOCAL_CANDIDATE, supabase: null, snapshot, keywords: [] };
}

describe("tool registry", () => {
  it("declares exactly the tools it exposes", () => {
    expect(TOOL_NAMES).toEqual(TOOL_DEFINITIONS.map((definition) => definition.name));
    expect(TOOL_NAMES.length).toBeGreaterThan(0);
  });

  it("has no tool that could run code, fetch a URL or send mail", () => {
    // SSRF and remote code execution are impossible *by construction*: there is
    // no such tool to call.
    const forbidden = [
      "run_sql",
      "fetch_url",
      "exec",
      "shell",
      "send_email",
      "http_request",
      "read_file",
      "write_file",
    ];
    for (const name of TOOL_NAMES) {
      expect(forbidden).not.toContain(name);
    }
  });
});

describe("mutating tools and confirmation policy", () => {
  it("executes the reversible favourites tools without a confirmation", () => {
    expect(isMutatingTool("save_job")).toBe(true);
    expect(toolRequiresConfirmation("save_job")).toBe(false);
    expect(isMutatingTool("unsave_job")).toBe(true);
    expect(toolRequiresConfirmation("unsave_job")).toBe(false);
  });

  it("requires a confirmation before writing the application tracker", () => {
    expect(isMutatingTool("create_application")).toBe(true);
    expect(toolRequiresConfirmation("create_application")).toBe(true);
    expect(isMutatingTool("update_application_status")).toBe(true);
    expect(toolRequiresConfirmation("update_application_status")).toBe(true);
  });

  it("treats reads as non-mutating", () => {
    expect(isMutatingTool("search_jobs")).toBe(false);
    expect(isMutatingTool("get_job_details")).toBe(false);
    expect(isMutatingTool("get_candidate_profile")).toBe(false);
    expect(isMutatingTool("does_not_exist")).toBe(false);
    expect(toolRequiresConfirmation("does_not_exist")).toBe(false);
  });
});

describe("executeTool — refusals", () => {
  it("returns an error outcome for an unknown tool instead of throwing", async () => {
    const outcome = await executeTool("run_sql", { sql: "drop table profiles" }, localContext());
    expect(outcome).toMatchObject({ kind: "error", code: "unknown_tool" });
    if (outcome.kind !== "error") return;
    expect(outcome.message).toContain("search_jobs");
  });

  it("denies a caller whose role set does not hold the permission", async () => {
    const anonymous: Principal = { ...LOCAL_CANDIDATE, roles: [] };
    const outcome = await executeTool("search_jobs", {}, {
      ...localContext(),
      principal: anonymous,
    });
    expect(outcome).toMatchObject({ kind: "error", code: "forbidden" });
  });

  it("rejects missing and out-of-range arguments", async () => {
    const missing = await executeTool("save_job", {}, localContext());
    expect(missing).toMatchObject({ kind: "error", code: "invalid_arguments" });

    const oversized = await executeTool("save_job", { jobId: "x".repeat(200) }, localContext());
    expect(oversized).toMatchObject({ kind: "error", code: "invalid_arguments" });
  });

  it("reports an invisible listing rather than inventing one", async () => {
    const outcome = await executeTool("get_job_details", { jobId: "job-404" }, localContext());
    expect(outcome).toMatchObject({ kind: "error", code: "job_not_found" });
  });

  it("refuses to attach a listing the caller cannot see", async () => {
    const outcome = await executeTool(
      "create_application",
      { jobId: "job-404", companyName: "Acme", jobTitle: "Front-end" },
      localContext(),
      { confirmed: true },
    );
    expect(outcome).toMatchObject({ kind: "error", code: "job_not_found" });
  });
});

describe("executeTool — reads", () => {
  it("searches the catalogue and reports which live sources it consulted", async () => {
    const outcome = await executeTool("search_jobs", { query: "frontend" }, localContext());
    expect(outcome.kind).toBe("data");
    if (outcome.kind !== "data") return;

    const data = outcome.data as {
      totalMatching: number;
      jobs: { id: string; alreadySaved: boolean }[];
      searchedScope: string;
      liveSources: { source: string; status: string }[];
      liveUnavailable: string | null;
    };
    // Offline (test) environment: catalogue results only, no live fan-out.
    expect(data.jobs.map((job) => job.id)).toEqual(["job-1"]);
    expect(data.jobs[0]?.alreadySaved).toBe(true);
    expect(data.searchedScope).toContain("sources en direct");
    expect(data.searchedScope).toContain("Aucune offre n'est inventée");
    expect(data.liveUnavailable).toBeNull();
    expect(data.liveSources).toEqual([]);
  });

  it("returns at most the requested number of listings", async () => {
    const outcome = await executeTool("search_jobs", { limit: 1 }, localContext());
    expect(outcome.kind).toBe("data");
    if (outcome.kind !== "data") return;
    const data = outcome.data as { jobs: unknown[]; totalMatching: number };
    expect(data.jobs).toHaveLength(1);
    expect(data.totalMatching).toBe(2);
  });

  it("exposes no contact details in the candidate profile", async () => {
    const outcome = await executeTool("get_candidate_profile", {}, localContext());
    expect(outcome.kind).toBe("data");
    if (outcome.kind !== "data") return;

    // Pinning the exact key set is deliberate: it means adding an e-mail or a
    // phone number to this payload would break the test, not slip through.
    expect(Object.keys(outcome.data).sort()).toEqual([
      "currency",
      "employmentTypes",
      "locations",
      "minimumSalary",
      "seniorities",
      "skillCount",
      "targetTitles",
      "workModes",
    ]);
    expect(JSON.stringify(outcome.data)).not.toContain("@");
  });

  it("reports declared skills with a canonical form", async () => {
    const outcome = await executeTool("get_candidate_skills", {}, localContext());
    expect(outcome.kind).toBe("data");
    if (outcome.kind !== "data") return;
    expect(outcome.data.skills).toEqual(["React", "TypeScript"]);
  });
});

describe("executeTool — writes", () => {
  it("saves a visible job as a reversible client action, with no confirmation", async () => {
    const outcome = await executeTool("save_job", { jobId: "job-2" }, localContext());
    expect(outcome).toMatchObject({ kind: "client_action", action: "save_job" });
    if (outcome.kind !== "client_action") return;
    expect(outcome.payload).toEqual({ jobId: "job-2" });
  });

  it("asks for confirmation before creating an application (local demo)", async () => {
    const outcome = await executeTool(
      "create_application",
      { companyName: "Acme", jobTitle: "Front-end" },
      localContext(),
    );
    expect(outcome).toMatchObject({
      kind: "confirmation_required",
      tool: "create_application",
    });
    if (outcome.kind !== "confirmation_required") return;
    // No verified identity in demo mode ⇒ no signed token can be bound.
    expect(outcome.confirmationId).toBe("");
    expect(outcome.expiresAt).toBe(0);
    expect(outcome.summary).toContain("Front-end");
  });

  it("mints a signed, user-bound token for a verified caller", async () => {
    const outcome = await executeTool(
      "create_application",
      { companyName: "Acme", jobTitle: "Front-end" },
      { ...localContext(), principal: CLOUD_CANDIDATE },
    );
    expect(outcome.kind).toBe("confirmation_required");
    if (outcome.kind !== "confirmation_required") return;

    expect(outcome.confirmationId).not.toBe("");
    expect(outcome.expiresAt).toBeGreaterThan(Date.now());

    // The arguments the user approves live *inside* the signature, so the model
    // cannot swap them after the dialog appears.
    const action = verifyConfirmationToken(outcome.confirmationId, "user-1");
    expect(action.args).toMatchObject({ companyName: "Acme", jobTitle: "Front-end" });
    expect(() =>
      verifyConfirmationToken(outcome.confirmationId, "another-user"),
    ).toThrow();
  });

  it("only writes once the confirmation is presented", async () => {
    const args = { companyName: "Acme", jobTitle: "Front-end" };

    const blocked = await executeTool("create_application", args, localContext());
    expect(blocked.kind).toBe("confirmation_required");

    const confirmed = await executeTool("create_application", args, localContext(), {
      confirmed: true,
    });
    expect(confirmed).toMatchObject({
      kind: "client_action",
      action: "create_application",
    });
  });

  it("requires confirmation to change an application status", async () => {
    const outcome = await executeTool(
      "update_application_status",
      { applicationId: "app-1", status: "interview" },
      localContext(),
    );
    expect(outcome).toMatchObject({
      kind: "confirmation_required",
      tool: "update_application_status",
    });
  });

  it("refuses a caller without the write permission, confirmed or not", async () => {
    const anonymous: Principal = { ...LOCAL_CANDIDATE, roles: [] };
    const context: ToolContext = { ...localContext(), principal: anonymous };

    const unconfirmed = await executeTool(
      "create_application",
      { companyName: "Acme", jobTitle: "X" },
      context,
    );
    expect(unconfirmed).toMatchObject({ kind: "error", code: "forbidden" });

    const confirmed = await executeTool(
      "create_application",
      { companyName: "Acme", jobTitle: "X" },
      context,
      { confirmed: true },
    );
    expect(confirmed).toMatchObject({ kind: "error", code: "forbidden" });
  });
});
