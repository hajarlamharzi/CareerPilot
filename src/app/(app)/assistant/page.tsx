import type { Metadata } from "next";

import { PageHeader } from "@/components/shared/page-header";
import { AssistantChat } from "@/features/assistant/components/assistant-chat";
import { getSession } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Assistant" };

/**
 * The AI assistant.
 *
 * The page itself is a shell: the chat component calls `/api/assistant`, which
 * decides whether the deployment has a provider configured and, in cloud mode,
 * whether the caller is allowed in. Rendering the status there rather than here
 * keeps a single source of truth and avoids duplicating the "not configured"
 * explanation.
 *
 * Roles are read on the server and passed down for *presentation only* — the
 * suggested prompts and the role badge. Every tool call is still authorised by
 * `can()` inside the route; a crafted request cannot borrow the UI's role.
 */
export default async function AssistantPage() {
  const session = await getSession();
  const roles = session.user?.roles ?? ["candidate"];
  const isAdmin = roles.includes("admin");

  return (
    <>
      <PageHeader
        title="Assistant"
        description={
          isAdmin
            ? "Recherchez des offres réelles, inspectez les sources configurées et préparez des actions d'administration. L'assistant n'invente ni offre ni chiffre."
            : "Recherchez des offres réelles, analysez votre CV et préparez vos candidatures en langage naturel."
        }
      />
      <AssistantChat roles={roles} />
    </>
  );
}
