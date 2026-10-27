import type { Metadata } from "next";
import { ScrollText } from "lucide-react";

import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ADMIN_PAGE_SIZE, listAuditEntries } from "@/lib/admin/queries";
import { requirePermission } from "@/lib/auth/session";
import { formatDateShort } from "@/lib/format";
import type { AdminAuditLogRow } from "@/lib/supabase/types";

export const metadata: Metadata = { title: "Journal d'audit" };
export const dynamic = "force-dynamic";

export default async function AdminAuditPage() {
  await requirePermission("admin:audit:read");

  let entries: AdminAuditLogRow[] = [];
  let failure: string | null = null;

  try {
    entries = await listAuditEntries();
  } catch (error) {
    failure = error instanceof Error ? error.message : "Erreur inconnue.";
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Journal d'audit"
        description={`Les ${ADMIN_PAGE_SIZE} dernières actions d'administration. Un journal en lecture seule : rien ne peut le modifier depuis l'application.`}
      />

      {failure ? (
        <ErrorState title="Journal indisponible" description={failure} />
      ) : entries.length === 0 ? (
        <EmptyState
          icon={ScrollText}
          title="Journal vide"
          description="Aucune action d'administration enregistrée. Les attributions de rôle effectuées par script y sont inscrites automatiquement."
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Action</TableHead>
                  <TableHead>Entité</TableHead>
                  <TableHead>Résumé</TableHead>
                  <TableHead>Auteur</TableHead>
                  <TableHead className="text-right">Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell className="font-medium">{entry.action}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {entry.entity_type}
                      {entry.entity_id ? (
                        <span className="block font-mono text-xs">
                          {entry.entity_id}
                        </span>
                      ) : null}
                    </TableCell>
                    <TableCell className="max-w-md text-sm">{entry.summary}</TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {entry.actor_id ?? "système"}
                    </TableCell>
                    <TableCell className="text-right text-sm text-muted-foreground">
                      {formatDateShort(entry.created_at)}
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
