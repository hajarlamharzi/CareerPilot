import "server-only";

import { toRoles, type Role } from "@/lib/auth/roles";
import { createServerSupabase } from "@/lib/supabase/server";
import type { AdminAuditLogRow, AiUsageLogRow } from "@/lib/supabase/types";

/**
 * Read-only queries for the administration area.
 *
 * Two rules hold for everything in this file:
 *
 *  * `server-only` makes a client import a *build* error, not a code-review
 *    finding. The admin dashboard must never be able to run in a browser.
 *  * every caller has already passed `requirePermission` / `requireAdmin`
 *    immediately before calling. These functions do not re-authorise — they
 *    query. The gate is the page, and keeping it there means one place to audit.
 *
 * Queries rely on row-level security for the real boundary: an authenticated
 * non-admin signing in and hitting `/admin` is refused by the layout long before
 * this, and would still only see their own rows if they somehow got here.
 */

export const ADMIN_PAGE_SIZE = 50;

async function db() {
  const supabase = await createServerSupabase();
  if (!supabase) {
    throw new Error(
      "Supabase n'est pas configuré : l'administration nécessite une base de données, des comptes et des rôles.",
    );
  }
  return supabase;
}

const count = (result: { count: number | null }): number => result.count ?? 0;

export interface AdminOverview {
  users: number;
  jobs: number;
  sampleJobs: number;
  applications: number;
  aiCalls24h: number;
  aiErrors24h: number;
  auditEntries: number;
}

/** Headline counters. Seven `count` queries is cheaper than seven full scans. */
export async function getAdminOverview(): Promise<AdminOverview> {
  const supabase = await db();
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const [users, jobs, sampleJobs, applications, aiCalls, aiErrors, auditEntries] =
    await Promise.all([
      supabase.from("profiles").select("id", { count: "exact", head: true }),
      supabase.from("jobs").select("id", { count: "exact", head: true }),
      supabase
        .from("jobs")
        .select("id", { count: "exact", head: true })
        .eq("is_sample", true),
      supabase.from("applications").select("id", { count: "exact", head: true }),
      supabase
        .from("ai_usage_logs")
        .select("id", { count: "exact", head: true })
        .gte("created_at", since),
      supabase
        .from("ai_usage_logs")
        .select("id", { count: "exact", head: true })
        .gte("created_at", since)
        .eq("status", "error"),
      supabase.from("admin_audit_logs").select("id", { count: "exact", head: true }),
    ]);

  return {
    users: count(users),
    jobs: count(jobs),
    sampleJobs: count(sampleJobs),
    applications: count(applications),
    aiCalls24h: count(aiCalls),
    aiErrors24h: count(aiErrors),
    auditEntries: count(auditEntries),
  };
}

export interface AdminAccount {
  userId: string;
  fullName: string | null;
  headline: string | null;
  onboarded: boolean;
  createdAt: string;
  roles: Role[];
}

/**
 * Accounts with their granted roles.
 *
 * Two round-trips rather than one joined view: roles live in `user_roles`, and a
 * nested select would pull the whole role history just to render a badge.
 */
export async function listAccounts(limit = ADMIN_PAGE_SIZE): Promise<AdminAccount[]> {
  const supabase = await db();

  const { data: profiles, error } = await supabase
    .from("profiles")
    .select("id, full_name, headline, onboarded, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);

  const rows = profiles ?? [];
  const rolesByUser = new Map<string, string[]>();

  if (rows.length > 0) {
    const { data: roleRows } = await supabase
      .from("user_roles")
      .select("user_id, role")
      .in(
        "user_id",
        rows.map((row) => row.id),
      );

    for (const row of roleRows ?? []) {
      const list = rolesByUser.get(row.user_id) ?? [];
      list.push(row.role);
      rolesByUser.set(row.user_id, list);
    }
  }

  return rows.map((row) => ({
    userId: row.id,
    fullName: row.full_name,
    headline: row.headline,
    onboarded: row.onboarded,
    createdAt: row.created_at,
    roles: toRoles(rolesByUser.get(row.id) ?? []),
  }));
}

export interface AdminJob {
  id: string;
  title: string;
  companyName: string;
  location: string | null;
  status: string;
  sourceType: string;
  isSample: boolean;
  createdAt: string;
}

export async function listAdminJobs(limit = ADMIN_PAGE_SIZE): Promise<AdminJob[]> {
  const supabase = await db();

  const { data, error } = await supabase
    .from("jobs")
    .select(
      "id, title, company_name, location, status, source_type, is_sample, created_at",
    )
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => ({
    id: row.id,
    title: row.title,
    companyName: row.company_name,
    location: row.location,
    status: row.status,
    sourceType: row.source_type,
    isSample: row.is_sample,
    createdAt: row.created_at,
  }));
}

export async function listAuditEntries(
  limit = ADMIN_PAGE_SIZE,
): Promise<AdminAuditLogRow[]> {
  const supabase = await db();

  const { data, error } = await supabase
    .from("admin_audit_logs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);
  return data ?? [];
}

export interface AdminUsage {
  total: number;
  errors: number;
  rateLimited: number;
  /** Most recent calls, newest first. */
  recent: AiUsageLogRow[];
  /** Counts across `recent` only — the page says so rather than implying a total. */
  byFeature: { feature: string; count: number }[];
}

/**
 * AI usage.
 *
 * Deliberately shows counts and error codes only. `ai_usage_logs` holds no prompt,
 * no CV text, no message body and no e-mail — so this dashboard cannot become an
 * accidental back door into users' content.
 */
export async function getAdminUsage(limit = ADMIN_PAGE_SIZE): Promise<AdminUsage> {
  const supabase = await db();

  const [total, errors, rateLimited, recent] = await Promise.all([
    supabase.from("ai_usage_logs").select("id", { count: "exact", head: true }),
    supabase
      .from("ai_usage_logs")
      .select("id", { count: "exact", head: true })
      .eq("status", "error"),
    supabase
      .from("ai_usage_logs")
      .select("id", { count: "exact", head: true })
      .eq("status", "rate_limited"),
    supabase
      .from("ai_usage_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit),
  ]);

  const rows = recent.data ?? [];
  const counts = new Map<string, number>();
  for (const row of rows) {
    counts.set(row.feature, (counts.get(row.feature) ?? 0) + 1);
  }

  return {
    total: count(total),
    errors: count(errors),
    rateLimited: count(rateLimited),
    recent: rows,
    byFeature: [...counts.entries()]
      .map(([feature, featureCount]) => ({ feature, count: featureCount }))
      .sort((a, b) => b.count - a.count),
  };
}
