import type { Metadata } from "next";
import {
  Briefcase,
  Database,
  FileText,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react";

import { ErrorState } from "@/components/shared/error-state";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getAdminOverview } from "@/lib/admin/queries";
import { requirePermission } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Administration" };
export const dynamic = "force-dynamic";

export default async function AdminOverviewPage() {
  // The control, not the layout. Everything below reads data on this basis.
  await requirePermission("admin:dashboard:read");

  let overview: Awaited<ReturnType<typeof getAdminOverview>> | null = null;
  let failure: string | null = null;

  try {
    overview = await getAdminOverview();
  } catch (error) {
    failure = error instanceof Error ? error.message : "Erreur inconnue.";
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Vue d'ensemble"
        description="État de la plateforme : comptes, catalogue d'offres, candidatures et appels à l'IA."
      />

      {failure ? (
        <ErrorState
          title="Données indisponibles"
          description={failure}
          action={
            <p className="text-sm text-muted-foreground">
              Vérifiez que les migrations ont bien été appliquées et que votre
              compte porte le rôle administrateur.
            </p>
          }
        />
      ) : overview ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="Comptes"
              value={overview.users}
              icon={Users}
              hint="Profils enregistrés"
            />
            <StatCard
              label="Offres au catalogue"
              value={overview.jobs}
              icon={Briefcase}
              hint={
                overview.sampleJobs > 0
                  ? `dont ${overview.sampleJobs} donnée(s) d'exemple`
                  : "aucune donnée d'exemple"
              }
            />
            <StatCard
              label="Candidatures suivies"
              value={overview.applications}
              icon={FileText}
              hint="Toutes personnes confondues"
            />
            <StatCard
              label="Appels IA (24 h)"
              value={overview.aiCalls24h}
              icon={Sparkles}
              hint={
                overview.aiErrors24h > 0
                  ? `${overview.aiErrors24h} en erreur`
                  : "aucune erreur"
              }
            />
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Ce que ce tableau ne montre pas</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              <p className="flex items-start gap-2">
                <Database className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                Les journaux d&apos;usage IA ne contiennent ni invite, ni texte de
                CV, ni corps de message, ni e-mail : ils ne conservent que la
                fonction appelée, le fournisseur, le modèle, la durée et le code
                d&apos;erreur. Ce tableau ne peut donc pas devenir une porte
                dérobée vers le contenu des utilisateurs.
              </p>
              <p className="flex items-start gap-2">
                <ShieldCheck className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                {overview.auditEntries} entrée(s) au journal d&apos;audit
                administratif. Chaque attribution de rôle y est inscrite.
              </p>
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  );
}
