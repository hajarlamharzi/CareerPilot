import Link from "next/link";
import { ArrowRight, Info } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

/**
 * Shown *instead of* the sign-in / sign-up form when the deployment has no
 * Supabase project configured.
 *
 * Rendering a working-looking form that can never succeed is the worst version
 * of this state: the user types a name, an e-mail and a password, submits, and
 * then learns nothing was possible. This screen states the situation up front
 * and offers the one action that genuinely works — the local demo workspace.
 *
 * It is explicitly labelled as local: no account is created, no identity is
 * verified, and everything stays in this browser.
 */
export function LocalModePanel({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Info className="size-4 text-amber-600 dark:text-amber-400" aria-hidden />
            Comptes désactivés sur ce déploiement
          </CardTitle>
          <CardDescription>
            {title} nécessite un projet Supabase. Ce déploiement n&apos;en a pas,
            donc aucun compte ne peut être créé ni vérifié.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">{description}</p>

          <div className="flex flex-col gap-2">
            <Button asChild size="lg">
              <Link href="/dashboard">
                Continuer en mode démo local
                <ArrowRight className="size-4" aria-hidden />
              </Link>
            </Button>
          </div>

          <p className="text-xs text-muted-foreground">
            En mode démo local, votre profil, vos CV et vos candidatures restent
            dans ce navigateur. Aucune donnée ne quitte votre appareil et aucune
            identité n&apos;est vérifiée.
          </p>
        </CardContent>
      </Card>

      <Card className="bg-muted/30">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">
            Pour activer les vrais comptes
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-xs text-muted-foreground">
          <p>
            Créez un projet gratuit sur{" "}
            <a
              href="https://supabase.com"
              target="_blank"
              rel="noreferrer noopener"
              className="font-medium text-foreground underline underline-offset-2"
            >
              supabase.com
            </a>
            , puis renseignez ces deux variables dans{" "}
            <code className="text-[0.7rem]">.env.local</code> (voir{" "}
            <code className="text-[0.7rem]">.env.example</code>) :
          </p>
          <pre className="overflow-x-auto rounded-md border bg-background p-3 text-[0.7rem] leading-relaxed">
            <code>
              {"NEXT_PUBLIC_SUPABASE_URL=https://votre-projet.supabase.co\n"}
              {"NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_..."}
            </code>
          </pre>
          <p>
            Ensuite, appliquez les migrations de{" "}
            <code className="text-[0.7rem]">supabase/migrations/</code> puis
            redémarrez le serveur. Les rôles et la sécurité par ligne (RLS) sont
            documentés dans{" "}
            <Link
              href="/privacy"
              className="font-medium text-foreground underline underline-offset-2"
            >
              la politique de confidentialité
            </Link>
            .
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
