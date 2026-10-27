import type { Metadata } from "next";
import { AlertTriangle, Gauge, Sparkles } from "lucide-react";

import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getAdminUsage, type AdminUsage } from "@/lib/admin/queries";
import { requirePermission } from "@/lib/auth/session";
import { formatDateShort } from "@/lib/format";

export const metadata: Metadata = { title: "Usage IA" };
export const dynamic = "force-dynamic";

const STATUS_LABELS: Record<string, string> = {
  success: "Succès",
  error: "Erreur",
  rate_limited: "Limité",
  not_configured: "Non configuré",
};

export default async function AdminUsagePage() {
  await requirePermission("admin:usage:read");

  let usage: AdminUsage | null = null;
  let failure: string | null = null;

  try {
    usage = await getAdminUsage();
  } catch (error) {
    failure = error instanceof Error ? error.message : "Erreur inconnue.";
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Usage IA"
        description="Volume, erreurs et latence des appels au fournisseur. Aucun contenu utilisateur n'est enregistré ici."
      />

      {failure ? (
        <ErrorState title="Journaux indisponibles" description={failure} />
      ) : usage ? (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard label="Appels enregistrés" value={usage.total} icon={Sparkles} />
            <StatCard
              label="En erreur"
              value={usage.errors}
              icon={AlertTriangle}
              hint={
                usage.total > 0
                  ? `${Math.round((usage.errors / usage.total) * 100)} % du total`
                  : undefined
              }
            />
            <StatCard
              label="Limités (quota)"
              value={usage.rateLimited}
              icon={Gauge}
              hint="Refusés par la limite de débit"
            />
          </div>

          {usage.recent.length === 0 ? (
            <EmptyState
              icon={Sparkles}
              title="Aucun appel enregistré"
              description="Les appels à l'assistant et aux outils IA apparaîtront ici dès qu'une clé de fournisseur sera configurée et utilisée."
            />
          ) : (
            <>
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">
                    Répartition par fonction
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-xs text-muted-foreground">
                    Calculée sur les {usage.recent.length} derniers appels
                    affichés, pas sur le total historique.
                  </p>
                  <ul className="space-y-2">
                    {usage.byFeature.map((entry) => {
                      const share = Math.round(
                        (entry.count / usage.recent.length) * 100,
                      );
                      return (
                        <li key={entry.feature} className="space-y-1">
                          <div className="flex items-center justify-between text-sm">
                            <span className="font-medium">{entry.feature}</span>
                            <span className="text-muted-foreground">
                              {entry.count} · {share} %
                            </span>
                          </div>
                          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                            <div
                              className="h-full rounded-full bg-primary"
                              style={{ width: `${share}%` }}
                            />
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Fonction</TableHead>
                        <TableHead>Statut</TableHead>
                        <TableHead>Fournisseur</TableHead>
                        <TableHead>Code d&apos;erreur</TableHead>
                        <TableHead className="text-right">Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {usage.recent.map((entry) => (
                        <TableRow key={entry.id}>
                          <TableCell className="font-medium">{entry.feature}</TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                entry.status === "success" ? "secondary" : "destructive"
                              }
                            >
                              {STATUS_LABELS[entry.status] ?? entry.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {entry.provider ?? "—"}
                            {entry.model ? ` · ${entry.model}` : ""}
                          </TableCell>
                          <TableCell className="font-mono text-xs text-muted-foreground">
                            {entry.error_code ?? "—"}
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
            </>
          )}
        </>
      ) : null}
    </div>
  );
}
