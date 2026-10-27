import Link from "next/link";

import { APP_NAME, APP_REPO_URL } from "@/config/app";
import { Logo } from "@/components/layout/logo";

const FOOTER_LINKS: { title: string; links: { href: string; label: string }[] }[] =
  [
    {
      title: "Product",
      links: [
        { href: "/#features", label: "Features" },
        { href: "/#how-it-works", label: "How it works" },
        { href: "/dashboard", label: "Open the app" },
      ],
    },
    {
      title: "Workspace",
      links: [
        { href: "/jobs", label: "Jobs" },
        { href: "/cv", label: "CV library" },
        { href: "/applications", label: "Applications" },
      ],
    },
    {
      title: "Trust",
      links: [
        { href: "/privacy", label: "Privacy" },
        { href: "/settings", label: "Settings" },
        { href: APP_REPO_URL, label: "Source code" },
      ],
    },
  ];

export function MarketingFooter() {
  return (
    <footer className="border-t border-border bg-muted/30">
      <div className="mx-auto w-full max-w-6xl px-4 py-12 lg:px-6">
        <div className="grid gap-10 md:grid-cols-[1.4fr_repeat(3,1fr)]">
          <div className="space-y-3">
            <Logo />
            <p className="max-w-xs text-sm text-muted-foreground">
              A privacy-first job search workspace. Your data stays in your
              browser unless you explicitly send it to an AI provider you
              configure.
            </p>
          </div>

          {FOOTER_LINKS.map((group) => (
            <div key={group.title} className="space-y-3">
              <p className="text-sm font-semibold">{group.title}</p>
              <ul className="space-y-2 text-sm text-muted-foreground">
                {group.links.map((link) => (
                  <li key={link.label}>
                    {link.href.startsWith("http") ? (
                      <a
                        href={link.href}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="transition-colors hover:text-foreground"
                      >
                        {link.label}
                      </a>
                    ) : (
                      <Link
                        href={link.href}
                        className="transition-colors hover:text-foreground"
                      >
                        {link.label}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-10 flex flex-col gap-3 border-t border-border pt-6 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {new Date().getFullYear()} {APP_NAME}. A demonstration project —
            not affiliated with any employer or job board.
          </p>
          <p>
            Demo listings and sample CVs are fictional and clearly labelled.
          </p>
        </div>
      </div>
    </footer>
  );
}
