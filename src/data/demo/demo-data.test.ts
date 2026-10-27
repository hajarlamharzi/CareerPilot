import { describe, expect, it } from "vitest";

import { loadDemoDataset, buildDemoWorkspace, buildEmptyWorkspace } from "./index";

describe("demo dataset", () => {
  const dataset = loadDemoDataset();

  it("validates against the domain schemas", () => {
    // `loadDemoDataset` throws if any asset fails validation, so simply getting
    // here means every JSON file is schema-valid.
    expect(dataset.jobs.length).toBeGreaterThanOrEqual(20);
    expect(dataset.applications.length).toBeGreaterThanOrEqual(8);
  });

  it("uses unique ids for every record", () => {
    for (const [name, records] of Object.entries({
      jobs: dataset.jobs,
      applications: dataset.applications,
      matches: dataset.matches,
      interviews: dataset.interviews,
      activity: dataset.activity,
      companies: dataset.companies,
    })) {
      const ids = records.map((record) => record.id);
      expect(new Set(ids).size, `${name} has duplicate ids`).toBe(ids.length);
    }
  });

  it("references real jobs from applications and matches", () => {
    const jobIds = new Set(dataset.jobs.map((job) => job.id));
    for (const application of dataset.applications) {
      if (application.jobId) {
        expect(jobIds.has(application.jobId), application.jobId).toBe(true);
      }
    }
    for (const match of dataset.matches) {
      expect(jobIds.has(match.jobId), match.jobId).toBe(true);
    }
  });

  it("covers several application stages including a terminal outcome", () => {
    const statuses = new Set(dataset.applications.map((a) => a.status));
    expect(statuses.has("offer") || statuses.has("rejected")).toBe(true);
    expect(statuses.size).toBeGreaterThanOrEqual(5);
  });

  it("marks all seeded records as demo origin", () => {
    for (const job of dataset.jobs) expect(job.origin).toBe("demo");
    for (const app of dataset.applications) expect(app.origin).toBe("demo");
  });

  it("produces a complete demo workspace", () => {
    const workspace = buildDemoWorkspace("2026-01-01T00:00:00.000Z");
    expect(workspace.meta.workspaceMode).toBe("demo");
    expect(workspace.meta.seededAt).toBe("2026-01-01T00:00:00.000Z");
    expect(workspace.jobs.length).toBe(dataset.jobs.length);
    expect(workspace.preferences.theme).toBe("system");
  });

  it("produces an empty personal workspace with a starter profile", () => {
    const workspace = buildEmptyWorkspace("2026-01-01T00:00:00.000Z");
    expect(workspace.meta.workspaceMode).toBe("personal");
    expect(workspace.jobs).toHaveLength(0);
    expect(workspace.applications).toHaveLength(0);
    expect(workspace.profile.id).toBe("profile-local");
    expect(workspace.cv.documents).toHaveLength(0);
  });
});
