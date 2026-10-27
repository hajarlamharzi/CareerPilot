import Link from "next/link";
import type { ReactNode } from "react";

import { Logo } from "@/components/layout/logo";
import { APP_NAME } from "@/config/app";

/**
 * Layout for the account screens.
 *
 * Deliberately outside the `(app)` shell: someone who is not yet signed in has
 * no navigation to be shown, and a protected shell would only flash before the
 * proxy redirected them.
 */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-muted/20">
      <header className="flex h-16 items-center px-4 lg:px-8">
        <Link href="/" aria-label={`Retour à l'accueil ${APP_NAME}`}>
          <Logo />
        </Link>
      </header>

      <main
        id="main-content"
        className="flex flex-1 items-start justify-center px-4 py-10 sm:items-center"
      >
        <div className="w-full max-w-md">{children}</div>
      </main>

      <footer className="px-4 pb-6 text-center text-xs text-muted-foreground lg:px-8">
        {APP_NAME} — vos données vous appartiennent.
      </footer>
    </div>
  );
}
