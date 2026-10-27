import type { LucideIcon } from "lucide-react";

import type { Role } from "@/lib/auth/roles";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Short description used by the mobile drawer. */
  description?: string;
  /**
   * Roles allowed to *see* the link. Omitted means "everyone".
   *
   * Hiding a link is a courtesy, never a control: `/admin` re-checks the
   * permission server-side on every request. A candidate who types the URL gets
   * a 403 page, not a dashboard.
   */
  roles?: Role[];
}

export interface NavSection {
  title: string;
  items: NavItem[];
}
