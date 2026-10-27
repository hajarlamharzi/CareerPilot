"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";
import { can, type Role } from "@/lib/auth/roles";
import type { NavItem } from "@/components/navigation/nav-types";
import {
  ACCOUNT_NAV_ITEMS,
  ADMIN_NAV_ITEM,
  NAV_SECTIONS,
  SETTINGS_NAV_ITEM,
} from "@/components/navigation/nav-config";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useViewer } from "./viewer-context";

function isActive(pathname: string, href: string): boolean {
  if (href === "/dashboard") return pathname === href;
  // /cv/builder must not light up /cv, and vice versa: exact-or-child match.
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * A link is shown when the viewer holds every role it lists.
 *
 * This is presentation only. The corresponding page performs the real check with
 * `requirePermission`, so hiding a link and denying access cannot drift apart in
 * the direction that matters (a hidden link that still works).
 */
function visibleTo(item: NavItem, roles: readonly Role[]): boolean {
  if (!item.roles || item.roles.length === 0) return true;
  return item.roles.some((role) => roles.includes(role));
}

interface SidebarNavProps {
  collapsed?: boolean;
  /** Called after a navigation happens (used to close the mobile drawer). */
  onNavigate?: () => void;
}

export function SidebarNav({ collapsed = false, onNavigate }: SidebarNavProps) {
  const pathname = usePathname() ?? "";
  const { roles } = useViewer();

  const showAdmin = can([...roles], "admin:dashboard:read");

  const sections = NAV_SECTIONS.map((section) => ({
    ...section,
    items: section.items.filter((item) => visibleTo(item, roles)),
  })).filter((section) => section.items.length > 0);

  const trailing: NavItem[] = [
    ...ACCOUNT_NAV_ITEMS.map((item) => ({ ...item })),
    ...(showAdmin ? [ADMIN_NAV_ITEM as NavItem] : []),
    { ...SETTINGS_NAV_ITEM },
  ];

  const renderLink = (item: NavItem, current: boolean) => {
    const link = (
      <Link
        href={item.href}
        onClick={onNavigate}
        aria-current={current ? "page" : undefined}
        className={cn(
          "group flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
          current
            ? "bg-sidebar-accent text-sidebar-accent-foreground"
            : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
          collapsed && "justify-center px-0",
        )}
      >
        <item.icon className="size-4 shrink-0" aria-hidden="true" />
        {!collapsed ? <span>{item.label}</span> : null}
        {collapsed ? <span className="sr-only">{item.label}</span> : null}
      </Link>
    );

    return collapsed ? (
      <Tooltip>
        <TooltipTrigger asChild>{link}</TooltipTrigger>
        <TooltipContent side="right">{item.label}</TooltipContent>
      </Tooltip>
    ) : (
      link
    );
  };

  return (
    <nav aria-label="Navigation principale" className="flex flex-1 flex-col gap-6">
      {sections.map((section) => (
        <div key={section.title} className="space-y-1">
          {!collapsed ? (
            <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              {section.title}
            </p>
          ) : (
            <div className="mx-auto h-px w-6 bg-border" aria-hidden="true" />
          )}
          <ul className="space-y-0.5">
            {section.items.map((item) => (
              <li key={item.href}>{renderLink(item, isActive(pathname, item.href))}</li>
            ))}
          </ul>
        </div>
      ))}

      <div className="space-y-0.5 border-t border-sidebar-border pt-4">
        {trailing.map((item) => (
          <div key={item.href}>{renderLink(item, isActive(pathname, item.href))}</div>
        ))}
      </div>
    </nav>
  );
}
