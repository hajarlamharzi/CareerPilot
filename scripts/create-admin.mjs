#!/usr/bin/env node
/**
 * CareerPilot — administrator bootstrap.
 * =============================================================================
 * Grants the `admin` role to an account. This is the ONLY supported way to
 * create an administrator, and it is deliberately a command you run yourself:
 *
 *   * there is no HTTP endpoint that can grant a role;
 *   * `user_roles` has no client-writable RLS policy (migration 0002);
 *   * public registration hard-codes `candidate`;
 *   * no administrator password is ever stored in this repository.
 *
 * Usage
 * -----
 *   # 1. Register the account normally at /register (recommended).
 *   # 2. Grant the role:
 *   node --env-file=.env.local scripts/create-admin.mjs you@example.com
 *
 *   # Or let the script create the account as well. The password is read from
 *   # the environment and printed ONLY once, never stored:
 *   $env:ADMIN_PASSWORD="..."   # PowerShell
 *   node --env-file=.env.local scripts/create-admin.mjs you@example.com --create
 *
 * Required environment: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from "@supabase/supabase-js";
import { randomBytes } from "node:crypto";
import { createInterface } from "node:readline/promises";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const SERVICE_KEY = (
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  process.env.SUPABASE_SECRET_KEY ??
  ""
).trim();

function fail(message) {
  console.error(`\n✗ ${message}\n`);
  process.exit(1);
}

if (!SUPABASE_URL) {
  fail(
    "NEXT_PUBLIC_SUPABASE_URL is not set. Run with --env-file=.env.local or export it first.",
  );
}

if (!SERVICE_KEY) {
  fail(
    "SUPABASE_SERVICE_ROLE_KEY is not set. This script needs the service-role key " +
      "(it bypasses RLS by design). Never expose it to the browser.",
  );
}

const emailArg = process.argv[2];
const shouldCreate = process.argv.includes("--create");

if (!emailArg || !emailArg.includes("@")) {
  fail(
    "Pass the account email as the first argument, e.g. node --env-file=.env.local scripts/create-admin.mjs you@example.com",
  );
}

const email = emailArg.trim().toLowerCase();

const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

/** Look the account up through the Admin API (paginated, email-filtered). */
async function findUserByEmail(target) {
  let page = 1;
  for (;;) {
    const { data, error } = await admin.auth.admin.listUsers({
      page,
      perPage: 200,
    });
    if (error) fail(`Could not list users: ${error.message}`);
    const match = data.users.find(
      (user) => user.email?.toLowerCase() === target,
    );
    if (match) return match;
    if (data.users.length < 200) return null;
    page += 1;
  }
}

async function ensureUser() {
  const existing = await findUserByEmail(email);
  if (existing) {
    console.log(`• Compte trouvé : ${email} (${existing.id})`);
    return existing;
  }

  if (!shouldCreate) {
    fail(
      `Aucun compte pour ${email}. Enregistrez-le d'abord sur /register, ` +
        "ou relancez avec --create et la variable ADMIN_PASSWORD définie.",
    );
  }

  let password = process.env.ADMIN_PASSWORD?.trim();
  let generated = false;
  if (!password) {
    password = randomBytes(24).toString("base64url");
    generated = true;
  }
  if (password.length < 12) {
    fail("ADMIN_PASSWORD doit contenir au moins 12 caractères.");
  }

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: "Administrateur" },
  });
  if (error) fail(`Could not create the account: ${error.message}`);

  console.log(`• Compte créé : ${email} (${data.user.id})`);
  if (generated) {
    console.log(
      "\n  ⚠  Mot de passe généré — notez-le maintenant, il ne sera plus affiché :\n" +
        `     ${password}\n`,
    );
    await createInterface({ input: process.stdin, output: process.stdout })
      .question("  Appuyez sur Entrée une fois le mot de passe noté…")
      .finally(() => process.stdin.pause());
  }
  return data.user;
}

async function ensureProfile(user) {
  const { error } = await admin
    .from("profiles")
    .upsert(
      { id: user.id, full_name: "Administrateur" },
      { onConflict: "id", ignoreDuplicates: true },
    );
  if (error) {
    console.warn(
      `  (avertissement) profil non créé : ${error.message} — le trigger aurait dû le faire.`,
    );
  }
}

async function grantAdmin(user) {
  const { data: existing, error: readError } = await admin
    .from("user_roles")
    .select("id")
    .eq("user_id", user.id)
    .eq("role", "admin")
    .maybeSingle();

  if (readError) fail(`Could not read user_roles: ${readError.message}`);

  if (existing) {
    console.log("• Ce compte est déjà administrateur. Rien à faire.");
  } else {
    const { error } = await admin
      .from("user_roles")
      .insert({ user_id: user.id, role: "admin", granted_by: null });
    if (error) fail(`Could not grant the admin role: ${error.message}`);
    console.log("• Rôle « admin » attribué.");
  }

  // Audit trail. The service key writes it because `admin_audit_logs` requires
  // the actor to be an authenticated administrator.
  await admin.from("admin_audit_logs").insert({
    actor_id: user.id,
    action: "role.grant",
    entity_type: "user_roles",
    entity_id: user.id,
    summary: `Rôle « admin » attribué via le script de bootstrap.`,
    metadata: { method: "scripts/create-admin.mjs", email },
  });
}

async function main() {
  console.log(`\nCareerPilot — bootstrap administrateur\n${"─".repeat(46)}`);
  const user = await ensureUser();
  await ensureProfile(user);
  await grantAdmin(user);
  console.log(
    "\n✓ Terminé. Connectez-vous sur /login, l'espace /admin est désormais accessible.\n" +
      "  Vérifiez ensuite dans Supabase Studio :\n" +
      "    select * from public.user_roles where role = 'admin';\n",
  );
}

main().catch((error) => {
  fail(error instanceof Error ? error.message : String(error));
});
