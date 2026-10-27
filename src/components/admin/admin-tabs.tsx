"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

/** Sections of the administration area. Order is the reading order. */
const TABS = [
  { href: "/admin", label: "Vue d'ensemble" },
  { href: "/admin/accounts", label: "Comptes et rôles" },
  { href: "/admin/jobs", label: "Offres" },
  { href: "/admin/usage", label: "Usage IA" },
  { href: "/admin/audit", label: "Journal d'audit" },
] as const;

export function AdminTabs() {
  const pathname = usePathname() ?? "";

  return (
    <nav
      aria-label="Sections d'administration"
      className="flex flex-wrap gap-1 rounded-lg border border-border bg-card p-1"
    >
      {TABS.map((tab) => {
        // `/admin` must not stay highlighted on `/admin/accounts`.
        const active =
          tab.href === "/admin"
            ? pathname === "/admin"
            : pathname === tab.href || pathname.startsWith(`${tab.href}/`);

        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              active
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-accent hover:text-foreground",
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
