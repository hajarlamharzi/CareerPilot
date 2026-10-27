import type { Job } from "@/types";
import { canonicalSkill } from "@/lib/matching/skill-alias";
import { hasCuratedResources, resourcesForSkill } from "./resources";
import { fold } from "./text";

/**
 * Skill-gap analysis.
 *
 * Deliberately **not** AI-generated. Comparing two lists is a pure function; a
 * language model adds nothing but a chance of error, and the classifier below is
 * unit-testable. The AI's role is downstream: turning this trustworthy diff into
 * a readable plan, a roadmap and suggested projects.
 */

export interface SkillGapCoveredItem {
  /** Canonical name as it will be displayed. */
  skill: string;
  /** How the candidate's own skill list spelled it. */
  asDeclared: string;
  /** `true` when the advert marked it as required rather than desirable. */
  required: boolean;
}

export interface SkillGapMissingItem {
  skill: string;
  required: boolean;
  /** Free, reliable references — empty when we have none and say so. */
  resources: { label: string; url: string; kind: "docs" | "course" | "practice" }[];
}

export interface SkillGapReport {
  covered: SkillGapCoveredItem[];
  /** Required skills the candidate lacks. Highest priority. */
  missingRequired: SkillGapMissingItem[];
  /** Desirable skills the candidate lacks. Secondary priority. */
  missingPreferred: SkillGapMissingItem[];
  /** Required skills the advert listed that we could not classify at all. */
  unclassified: string[];
  /** 0–100 coverage of the *required* set. `null` when the advert lists none. */
  requiredCoverage: number | null;
  /** 0–100 coverage of the required + desirable set. */
  overallCoverage: number | null;
  /** Honest notes about the limits of this comparison. */
  caveats: string[];
  /** A short, ordered learning order: required gaps first. */
  suggestedOrder: string[];
}

/** Canonical key for a skill, tolerating aliases on both sides. */
function key(skill: string): string {
  return canonicalSkill(skill) ?? fold(skill);
}

function indexSkills(skills: readonly string[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const skill of skills) {
    const trimmed = skill.trim();
    if (!trimmed) continue;
    const k = key(trimmed);
    if (!map.has(k)) map.set(k, trimmed);
  }
  return map;
}

export function analyseSkillGap(
  candidateSkills: readonly string[],
  job: Pick<Job, "requiredSkills" | "preferredSkills" | "title" | "company">,
): SkillGapReport {
  const owned = indexSkills(candidateSkills);

  const covered: SkillGapCoveredItem[] = [];
  const missingRequired: SkillGapMissingItem[] = [];
  const missingPreferred: SkillGapMissingItem[] = [];
  const unclassified: string[] = [];

  const classify = (skill: string, required: boolean): void => {
    const trimmed = skill.trim();
    if (!trimmed) return;
    const declared = owned.get(key(trimmed));
    if (declared) {
      covered.push({ skill: trimmed, asDeclared: declared, required });
      return;
    }
    if (!hasCuratedResources(trimmed) && trimmed.split(/\s+/).length > 2) {
      // A long, unclassifiable phrase is very likely a responsibility rather
      // than a skill ("participer aux revues de code"). Flag it instead of
      // pretending it is a learnable competency.
      unclassified.push(trimmed);
      return;
    }
    const item: SkillGapMissingItem = {
      skill: trimmed,
      required,
      resources: resourcesForSkill(trimmed),
    };
    if (required) missingRequired.push(item);
    else missingPreferred.push(item);
  };

  for (const skill of job.requiredSkills) classify(skill, true);
  for (const skill of job.preferredSkills) classify(skill, false);

  const requiredTotal = job.requiredSkills.length - unclassified.filter((value) =>
    job.requiredSkills.includes(value),
  ).length;
  const coveredRequired = covered.filter((item) => item.required).length;
  const coveredAny = covered.length;
  const totalAny = requiredTotal + job.preferredSkills.length;

  const suggestedOrder = [
    ...missingRequired.map((item) => item.skill),
    ...missingPreferred.map((item) => item.skill),
  ];

  const caveats: string[] = [
    "Cette comparaison utilise uniquement les compétences que vous avez déclarées et celles listées dans l'annonce.",
  ];
  if (job.requiredSkills.length === 0) {
    caveats.push(
      "L'annonce ne liste aucune compétence requise : impossible de calculer un taux de couverture.",
    );
  }
  if (unclassified.length > 0) {
    caveats.push(
      `${unclassified.length} élément(s) de l'annonce ressemblent à des missions plutôt qu'à des compétences et ont été exclus du calcul.`,
    );
  }
  if (missingRequired.some((item) => item.resources.length === 0)) {
    caveats.push(
      "Pour certaines compétences manquantes, nous n'avons pas de ressource vérifiée : aucune n'est proposée plutôt qu'un lien inventé.",
    );
  }

  return {
    covered,
    missingRequired,
    missingPreferred,
    unclassified,
    requiredCoverage:
      requiredTotal > 0 ? Math.round((coveredRequired / requiredTotal) * 100) : null,
    overallCoverage:
      totalAny > 0 ? Math.round((coveredAny / totalAny) * 100) : null,
    caveats,
    suggestedOrder,
  };
}

/**
 * Suggest one concrete practice project per skill gap.
 *
 * Templates, not invented facts: each returns a project the candidate builds
 * themselves, so nothing here claims experience they do not have.
 */
export function suggestProjects(skills: readonly string[], maxProjects = 4): string[] {
  const suggestions: string[] = [];
  for (const skill of skills.slice(0, maxProjects)) {
    suggestions.push(
      `Construisez un petit projet public qui utilise ${skill} de bout en bout (dépôt GitHub + README expliquant vos choix techniques), puis décrivez-le dans la section « Projets » de votre CV.`,
    );
  }
  return suggestions;
}
