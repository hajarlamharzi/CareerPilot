import {
  BarChart3,
  FileText,
  KanbanSquare,
  LayoutDashboard,
  MessagesSquare,
  Settings,
  Shield,
  Sparkles,
  Target,
  UserRound,
  Briefcase,
  Bookmark,
  Bot,
  Globe2,
} from "lucide-react";

import type { NavSection } from "./nav-types";

/**
 * Navigation, in French.
 *
 * Section order follows the job-seeker's path: find work, produce documents,
 * follow up, then personalisation. `settings` and `profile` deliberately sit
 * apart — they configure the workspace rather than constituting work.
 */
export const NAV_SECTIONS: NavSection[] = [
  {
    title: "Espace de travail",
    items: [
      {
        href: "/dashboard",
        label: "Tableau de bord",
        icon: LayoutDashboard,
        description: "Votre recherche en un coup d'œil",
      },
      {
        href: "/assistant",
        label: "Assistant",
        icon: Bot,
        description: "Posez une question, cherchez, enregistrez",
      },
      {
        href: "/jobs",
        label: "Offres",
        icon: Briefcase,
        description: "Découvrir et organiser les opportunités",
      },
      {
        href: "/find-jobs",
        label: "Trouver des offres",
        icon: Globe2,
        description: "Recherche en direct (Adzuna, Jobicy)",
      },
      {
        href: "/saved-jobs",
        label: "Offres enregistrées",
        icon: Bookmark,
        description: "Favoris, offres importées et candidatures à venir",
      },
      {
        href: "/match",
        label: "Adéquation",
        icon: Target,
        description: "Comparer votre CV à une offre",
      },
    ],
  },
  {
    title: "Documents",
    items: [
      {
        href: "/cv",
        label: "Mes CV",
        icon: FileText,
        description: "Importer et gérer vos CV",
      },
      {
        href: "/cv/builder",
        label: "Éditeur de CV",
        icon: Sparkles,
        description: "Adapter un CV compatible ATS",
      },
    ],
  },
  {
    title: "Suivi",
    items: [
      {
        href: "/applications",
        label: "Candidatures",
        icon: KanbanSquare,
        description: "Suivre chaque candidature",
      },
      {
        href: "/interviews",
        label: "Entretiens",
        icon: MessagesSquare,
        description: "Préparer et s'entraîner",
      },
      {
        href: "/analytics",
        label: "Statistiques",
        icon: BarChart3,
        description: "Indicateurs issus de vos données",
      },
    ],
  },
];

/** Accessible to every signed-in user. */
export const ACCOUNT_NAV_ITEMS = [
  {
    href: "/profile",
    label: "Profil",
    icon: UserRound,
    description: "Coordonnées et préférences de recherche",
  },
  {
    href: "/settings/account",
    label: "Compte",
    icon: Shield,
    description: "Identité, rôles et mot de passe",
  },
] as const;

export const SETTINGS_NAV_ITEM = {
  href: "/settings",
  label: "Paramètres",
  icon: Settings,
  description: "Préférences, IA et stockage",
} as const;

/** Rendered only for holders of the `admin` role. */
export const ADMIN_NAV_ITEM = {
  href: "/admin",
  label: "Administration",
  icon: Shield,
  description: "Comptes, rôles et journal d'audit",
} as const;
