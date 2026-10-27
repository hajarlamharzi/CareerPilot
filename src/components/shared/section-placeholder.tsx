import type { LucideIcon } from "lucide-react";
import { Construction } from "lucide-react";

import { PageHeader } from "@/components/shared/page-header";
import { InlineAlert } from "@/components/shared/error-state";

interface SectionPlaceholderProps {
  title: string;
  description: string;
  icon?: LucideIcon;
  phase: string;
  children?: React.ReactNode;
}

/**
 * Temporary scaffold used while a section is still being built. It is replaced
 * by the real feature in its roadmap phase; it exists so no navigation link is
 * ever dead during development.
 */
export function SectionPlaceholder({
  title,
  description,
  icon: Icon = Construction,
  phase,
  children,
}: SectionPlaceholderProps) {
  return (
    <div className="space-y-6">
      <PageHeader title={title} description={description} />
      <InlineAlert variant="info" icon={Icon} title="Coming up">
        This section is implemented in {phase}. The workspace shell, navigation,
        storage layer and demo data are already in place.
      </InlineAlert>
      {children}
    </div>
  );
}
