import type { Metadata } from "next";
import { Users } from "lucide-react";

import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ADMIN_PAGE_SIZE, listAccounts, type AdminAccount } from "@/lib/admin/queries";
import { ROLE_LABELS } from "@/lib/auth/roles";
import { requirePermission } from "@/lib/auth/session";
import { formatDateShort } from "@/lib/format";

export const metadata: Metadata = { title: "Comptes et rôles" };
export const dynamic = "force-dynamic";

export default async function AdminAccountsPage() {
  await requirePermission("admin:users:read");

  let accounts: AdminAccount[] = [];
  let failure: string | null = null;

  try {
    accounts = await listAccounts();
  } catch (error) {
    failure = error instanceof Error ? error.message : "Erreur inconnue.";
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Comptes et rôles"
        description={`Les ${ADMIN_PAGE_SIZE} comptes les plus récents. Les rôles sont accordés côté serveur — cette page est en lecture seule.`}
      />

      {failure ? (
        <ErrorState title="Comptes indisponibles" description={failure} />
      ) : accounts.length === 0 ? (
        <EmptyState
          icon={Users}
          title="Aucun compte"
          description="Aucun profil n'a encore été créé. Les comptes apparaissent ici après leur première connexion."
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Compte</TableHead>
                  <TableHead>Rôles</TableHead>
                  <TableHead>Profil</TableHead>
                  <TableHead className="text-right">Inscription</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {accounts.map((account) => (
                  <TableRow key={account.userId}>
                    <TableCell>
                      <div className="space-y-0.5">
                        <p className="font-medium">
                          {account.fullName ?? "Sans nom"}
                        </p>
                        <p className="font-mono text-xs text-muted-foreground">
                          {account.userId}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      {account.roles.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {account.roles.map((role) => (
                            <Badge
                              key={role}
                              variant={role === "admin" ? "default" : "secondary"}
                            >
                              {ROLE_LABELS[role]}
                            </Badge>
                          ))}
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          Aucun rôle
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {account.headline ?? "—"}
                      {account.onboarded ? null : (
                        <span className="ml-2 text-xs">(accueil non terminé)</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right text-sm text-muted-foreground">
                      {formatDateShort(account.createdAt)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
