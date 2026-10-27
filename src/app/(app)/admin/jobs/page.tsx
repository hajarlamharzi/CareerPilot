import type { Metadata } from "next";
import { Briefcase } from "lucide-react";

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
import { ADMIN_PAGE_SIZE, listAdminJobs, type AdminJob } from "@/lib/admin/queries";
import { requirePermission } from "@/lib/auth/session";
import { formatDateShort } from "@/lib/format";

export const metadata: Metadata = { title: "Offres" };
export const dynamic = "force-dynamic";

/** Row enum → French label. Unknown values fall through unchanged, never hidden. */
const STATUS_LABELS: Record<string, string> = {
  draft: "Brouillon",
  published: "Publiée",
  archived: "Archivée",
};

const SOURCE_LABELS: Record<string, string> = {
  platform: "Plateforme",
  import: "Import",
  api: "API",
  "user-submitted": "Proposée par un utilisateur",
  sample: "Donnée d'exemple",
};

export default async function AdminJobsPage() {
  await requirePermission("admin:jobs:read");

  let jobs: AdminJob[] = [];
  let failure: string | null = null;

  try {
    jobs = await listAdminJobs();
  } catch (error) {
    failure = error instanceof Error ? error.message : "Erreur inconnue.";
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Offres"
        description={`Les ${ADMIN_PAGE_SIZE} offres les plus récentes, avec leur origine réelle. Une offre d'exemple porte toujours cette mention.`}
      />

      {failure ? (
        <ErrorState title="Offres indisponibles" description={failure} />
      ) : jobs.length === 0 ? (
        <EmptyState
          icon={Briefcase}
          title="Catalogue vide"
          description="Aucune offre au catalogue. Ajoutez-en depuis l'espace de travail, ou importez un jeu de démonstration avec supabase/seed.sql."
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Poste</TableHead>
                  <TableHead>Origine</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="text-right">Ajoutée le</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {jobs.map((job) => (
                  <TableRow key={job.id}>
                    <TableCell>
                      <div className="space-y-0.5">
                        <p className="font-medium">{job.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {job.companyName}
                          {job.location ? ` · ${job.location}` : ""}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={job.isSample ? "outline" : "secondary"}>
                        {SOURCE_LABELS[job.sourceType] ?? job.sourceType}
                        {job.isSample ? " · non réelle" : ""}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {STATUS_LABELS[job.status] ?? job.status}
                    </TableCell>
                    <TableCell className="text-right text-sm text-muted-foreground">
                      {formatDateShort(job.createdAt)}
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
