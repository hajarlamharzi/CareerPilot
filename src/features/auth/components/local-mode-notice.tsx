import Link from "next/link";

/**
 * Shown on every account screen when Supabase is not configured.
 *
 * Local demo mode is legitimate, but a login form that silently does nothing is
 * not: this states exactly what is missing and how to keep working.
 */
export function LocalModeNotice() {
  return (
    <div
      role="status"
      className="mb-4 rounded-md border border-amber-300/60 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-500/30 dark:bg-amber-950/40 dark:text-amber-200"
    >
      <p className="font-semibold">Authentification non configurée</p>
      <p className="mt-1">
        Ce déploiement tourne en <strong>mode démo local</strong> : Supabase
        n&apos;est pas configuré, donc les comptes sont désactivés. Renseignez{" "}
        <code>NEXT_PUBLIC_SUPABASE_URL</code> et{" "}
        <code>NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY</code> pour activer la
        connexion.
      </p>
      <p className="mt-2">
        <Link href="/dashboard" className="font-medium underline underline-offset-2">
          Continuer en mode démo local
        </Link>
      </p>
    </div>
  );
}
