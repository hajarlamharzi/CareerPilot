import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowLeft,
  BadgeCheck,
  CircleAlert,
  KeyRound,
  LogOut,
  Mail,
  ShieldCheck,
  UserRound,
} from "lucide-react";

import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { LocalModeNotice } from "@/features/auth/components/local-mode-notice";
import { ResetPasswordForm } from "@/features/auth/components/reset-password-form";
import { signOutAction } from "@/features/auth/actions";
import { getSession } from "@/lib/auth/session";
import { ROLE_DESCRIPTIONS, ROLE_LABELS } from "@/lib/auth/roles";

export const metadata: Metadata = { title: "Compte et sécurité" };

/**
 * Account settings.
 *
 * This page is deliberately about the *account* (identity, roles, credentials).
 * Workspace data — CV, jobs, applications — lives in the browser and is managed
 * from `/settings`; the distinction is repeated here because "why is my CV not
 * on my phone?" is the question this page exists to answer honestly.
 */
export default async function AccountSettingsPage() {
  const session = await getSession();
  const user = session.user;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Compte et sécurité"
        description="Identité, rôles et mot de passe. L'espace de travail (CV, offres, candidatures) est géré séparément dans les paramètres."
        actions={
          <Button asChild variant="outline">
            <Link href="/settings">
              <ArrowLeft className="size-4" aria-hidden />
              Paramètres
            </Link>
          </Button>
        }
      />

      {session.mode === "local" || !user ? (
        <>
          <LocalModeNotice />
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <CircleAlert className="size-4 text-amber-600" aria-hidden />
                Aucun compte sur ce déploiement
              </CardTitle>
              <CardDescription>
                Vous utilisez le mode démo local : toutes les données restent
                dans ce navigateur et aucune identité n&apos;est vérifiée.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              <p>
                Cette page s&apos;active automatiquement dès que le projet
                Supabase est renseigné :
              </p>
              <ul className="list-disc space-y-1 pl-5">
                <li>
                  <code>NEXT_PUBLIC_SUPABASE_URL</code> — URL du projet ;
                </li>
                <li>
                  <code>NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY</code> (ou{" "}
                  <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code>) — clé publique.
                </li>
              </ul>
              <p>
                Consultez <code>.env.example</code> pour la liste complète et{" "}
                <code>docs/AUTH-AND-RBAC.md</code> pour les rôles.
              </p>
            </CardContent>
          </Card>
        </>
      ) : (
        <>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <UserRound className="size-4 text-primary" aria-hidden />
                Identité
              </CardTitle>
              <CardDescription>
                Ces informations proviennent de Supabase Auth, pas du stockage
                local du navigateur.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/70 p-3">
                <span className="inline-flex items-center gap-2 text-muted-foreground">
                  <Mail className="size-4" aria-hidden />
                  Adresse e-mail
                </span>
                <span className="flex items-center gap-2 font-medium">
                  {user.email ?? "—"}
                  {user.emailVerified ? (
                    <Badge variant="secondary" className="gap-1">
                      <BadgeCheck className="size-3.5" aria-hidden />
                      Vérifiée
                    </Badge>
                  ) : (
                    <Badge variant="outline">Non vérifiée</Badge>
                  )}
                </span>
              </div>

              {user.fullName ? (
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/70 p-3">
                  <span className="text-muted-foreground">Nom affiché</span>
                  <span className="font-medium">{user.fullName}</span>
                </div>
              ) : null}

              <p className="text-xs text-muted-foreground">
                Identifiant de compte : <code>{user.id}</code>
              </p>
              {!user.emailVerified ? (
                <p className="rounded-md border border-amber-600/30 bg-amber-500/[0.06] p-3 text-xs text-amber-800 dark:text-amber-300">
                  Votre adresse n&apos;est pas encore vérifiée. Ouvrez le lien
                  reçu par e-mail ; certaines fonctions peuvent être limitées en
                  attendant.
                </p>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <ShieldCheck className="size-4 text-primary" aria-hidden />
                Rôles et permissions
              </CardTitle>
              <CardDescription>
                Les rôles sont attribués côté serveur. Les permissions sont
                contrôlées à chaque action, pas seulement en masquant des boutons.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {user.roles.map((role) => (
                <div
                  key={role}
                  className="rounded-lg border border-border/70 p-3 text-sm"
                >
                  <div className="flex items-center gap-2 font-medium">
                    <Badge variant={role === "admin" ? "default" : "secondary"}>
                      {ROLE_LABELS[role]}
                    </Badge>
                  </div>
                  <p className="mt-1 text-muted-foreground">
                    {ROLE_DESCRIPTIONS[role]}
                  </p>
                </div>
              ))}
              <p className="text-xs text-muted-foreground">
                Un changement de rôle ne peut pas être demandé depuis cette page :
                il passe par un administrateur (ou une opération serveur de
                confiance), et la base applique les mêmes règles via RLS.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <KeyRound className="size-4 text-primary" aria-hidden />
                Mot de passe
              </CardTitle>
              <CardDescription>
                Définir un nouveau mot de passe pour ce compte. Votre session
                actuelle est déjà vérifiée ; aucun ancien mot de passe n&apos;est
                redemandé.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ResetPasswordForm />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <LogOut className="size-4 text-primary" aria-hidden />
                Session
              </CardTitle>
              <CardDescription>
                La déconnexion révoque la session Supabase sur cet appareil. Vos
                données de navigateur restent sur cet appareil.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form action={signOutAction}>
                <Button type="submit" variant="outline">
                  <LogOut className="size-4" aria-hidden />
                  Se déconnecter
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card className="border-dashed">
            <CardContent className="pt-6 text-sm text-muted-foreground">
              <p>
                <span className="font-medium text-foreground">
                  Données de l&apos;espace de travail :
                </span>{" "}
                CV, offres importées, candidatures et entretiens sont stockés
                dans ce navigateur (IndexedDB), pas dans votre compte. Ils ne
                suivent donc pas d&apos;un appareil à l&apos;autre. Exportez vos
                données depuis{" "}
                <Link
                  href="/settings"
                  className="font-medium text-foreground underline underline-offset-2"
                >
                  Paramètres
                </Link>{" "}
                avant de changer d&apos;appareil.
              </p>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
