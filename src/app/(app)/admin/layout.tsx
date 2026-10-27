import type { ReactNode } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { ShieldAlert } from "lucide-react";

import { AdminTabs } from "@/components/admin/admin-tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { can, ROLE_LABELS, type Role } from "@/lib/auth/roles";
import { getPrincipal } from "@/lib/auth/session";
import type { DataMode } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: "Administration",
  description: "Comptes, rôles, offres, usage de l'IA et journal d'audit.",
};

/**
 * The administration gate.
 *
 * This renders a clear refusal instead of throwing. A visitor landing on
 * `/admin` without the role is an ordinary, expected case — not an exception —
 * and answering it with a 500 (the error boundary) would be both unhelpful and
 * misleading about what happened.
 *
 * The check is *not* the only one: each page below calls `requirePermission`
 * itself before touching data. Duplication is the point — the layout is the
 * user-facing answer, the page is the control, and a mistake in the presentation
 * layer cannot become a data leak.
 */
export default async function AdminLayout({ children }: { children: ReactNode }) {
  const principal = await getPrincipal();

  if (!can(principal.roles, "admin:dashboard:read")) {
    return <AdminDenied mode={principal.mode} roles={principal.roles} />;
  }

  return (
    <div className="space-y-6">
      <AdminTabs />
      {children}
    </div>
  );
}

function AdminDenied({ mode, roles }: { mode: DataMode; roles: readonly Role[] }) {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <ShieldAlert className="size-5 text-destructive" aria-hidden="true" />
            Accès refusé
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          {mode === "local" ? (
            <p>
              L&apos;administration est désactivée en mode démo local. Elle suppose
              des comptes vérifiés et des rôles stockés en base : configurez
              Supabase, appliquez les migrations, puis attribuez le rôle{" "}
              <code className="rounded bg-muted px-1">admin</code> avec{" "}
              <code className="rounded bg-muted px-1">
                node scripts/create-admin.mjs
              </code>
              .
            </p>
          ) : (
            <>
              <p>
                Votre compte ne dispose pas de la permission{" "}
                <code className="rounded bg-muted px-1">admin:dashboard:read</code>.
              </p>
              <p>
                Rôles actuels :{" "}
                {roles.length > 0
                  ? roles.map((role) => ROLE_LABELS[role]).join(", ")
                  : "aucun rôle attribué"}
                .
              </p>
            </>
          )}
          <p>
            Un rôle ne peut jamais être choisi à l&apos;inscription ni depuis cette
            interface : il est accordé côté serveur par un administrateur existant,
            et chaque attribution est inscrite au journal d&apos;audit.
          </p>
        </CardContent>
      </Card>
      <p className="text-sm text-muted-foreground">
        Votre espace de travail reste accessible :{" "}
        <Link href="/dashboard" className="font-medium text-foreground underline">
          retour au tableau de bord
        </Link>
        .
      </p>
    </div>
  );
}
