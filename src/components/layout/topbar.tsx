"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";
import {
  HelpCircle,
  LogIn,
  LogOut,
  Search,
  Settings,
  Shield,
  User,
} from "lucide-react";

import { can } from "@/lib/auth/roles";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { MobileNav } from "./mobile-nav";
import { initialsFor, useViewer } from "./viewer-context";

/** Global search: hands the query to the jobs list, which owns the filtering. */
function GlobalSearch() {
  const router = useRouter();
  const [value, setValue] = React.useState("");

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const query = value.trim();
    router.push(query ? `/jobs?q=${encodeURIComponent(query)}` : "/jobs");
  }

  return (
    <form
      role="search"
      onSubmit={onSubmit}
      className="relative hidden w-full max-w-sm sm:block"
    >
      <Search
        className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden="true"
      />
      <label htmlFor="global-search" className="sr-only">
        Rechercher une offre
      </label>
      <Input
        id="global-search"
        type="search"
        // Browser extensions add attributes (e.g. data-has-listeners) to this
        // input before hydration; ignore those without hiding real mismatches.
        suppressHydrationWarning
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder="Rechercher une offre, une entreprise, une compétence…"
        className="pl-9"
      />
    </form>
  );
}

export function Topbar() {
  const viewer = useViewer();
  const showAdmin = can([...viewer.roles], "admin:dashboard:read");

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border bg-background/80 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/60 lg:px-6">
      <MobileNav />
      <div className="md:hidden">
        <span className="text-sm font-semibold">CareerPilot</span>
      </div>
      <div className="hidden flex-1 md:block">
        <GlobalSearch />
      </div>
      <div className="ml-auto flex items-center gap-1">
        <ThemeToggle />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full"
              aria-label="Ouvrir le menu du compte"
            >
              <Avatar className="size-8">
                <AvatarFallback>{initialsFor(viewer)}</AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-60">
            <DropdownMenuLabel className="flex flex-col gap-0.5">
              {viewer.isAuthenticated ? (
                <>
                  <span className="truncate text-sm font-medium">
                    {viewer.fullName ?? "Compte connecté"}
                  </span>
                  <span className="truncate text-xs font-normal text-muted-foreground">
                    {viewer.email}
                  </span>
                </>
              ) : (
                <>
                  <span className="text-sm font-medium">Mode démo local</span>
                  <span className="text-xs font-normal text-muted-foreground">
                    Données non synchronisées
                  </span>
                </>
              )}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />

            <DropdownMenuItem asChild>
              <Link href="/profile">
                <User className="size-4" />
                <span>Profil</span>
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/settings">
                <Settings className="size-4" />
                <span>Paramètres</span>
              </Link>
            </DropdownMenuItem>
            {showAdmin ? (
              <DropdownMenuItem asChild>
                <Link href="/admin">
                  <Shield className="size-4" />
                  <span>Administration</span>
                </Link>
              </DropdownMenuItem>
            ) : null}
            <DropdownMenuItem asChild>
              <Link href="/privacy">
                <HelpCircle className="size-4" />
                <span>Confidentialité</span>
              </Link>
            </DropdownMenuItem>

            <DropdownMenuSeparator />

            {viewer.isAuthenticated ? (
              /*
               * A plain HTML POST, not a fetch: it works with JavaScript
               * unavailable, and the route handler clears the session cookie on
               * the server side of `@supabase/ssr` — the only side that can.
               */
              <form action="/auth/signout" method="post">
                <DropdownMenuItem asChild>
                  <button type="submit" className="w-full cursor-pointer">
                    <LogOut className="size-4" />
                    <span>Se déconnecter</span>
                  </button>
                </DropdownMenuItem>
              </form>
            ) : (
              <DropdownMenuItem asChild>
                <Link href="/login">
                  <LogIn className="size-4" />
                  <span>Se connecter</span>
                </Link>
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
