import { MATCH_THRESHOLDS } from "@/config/app";
import { canonicalSkill } from "@/lib/matching/skill-alias";
import type { Job, Seniority } from "@/types";
import { fold, tokenOverlap, tokenize } from "./text";
import type {
  CandidateContext,
  JobRank,
  RankBreakdownEntry,
  RankDimension,
} from "./types";

/**
 * Transparent job↔candidate scoring.
 *
 * Design rules, on purpose:
 *
 *  * Every dimension is a plain 0–1 ratio with a sentence explaining it. There is
 *    no hidden model, no learned weight, nothing a reviewer cannot reproduce by
 *    hand from the breakdown shown in the UI.
 *  * A dimension with no data is **excluded and its weight redistributed**,
 *    rather than silently scored zero. An advert without a salary must not be
 *    punished for it.
 *  * The output is described as *fit*, and the caveats say explicitly that it is
 *    not a probability of being hired.
 *
 * `weight` values always sum to 1 across the full dimension set.
 */

export const RANK_WEIGHTS: Record<RankDimension, number> = {
  title: 0.24,
  requiredSkills: 0.3,
  preferredSkills: 0.08,
  experience: 0.1,
  location: 0.1,
  workMode: 0.06,
  employmentType: 0.06,
  salary: 0.06,
};

export const RANK_DIMENSION_LABELS: Record<RankDimension, string> = {
  title: "Correspondance du poste",
  requiredSkills: "Compétences requises",
  preferredSkills: "Compétences appréciées",
  experience: "Niveau d'expérience",
  location: "Localisation",
  workMode: "Mode de travail",
  employmentType: "Type de contrat",
  salary: "Prétention salariale",
};

/** Order in which dimensions appear in the UI. */
const DIMENSION_ORDER: RankDimension[] = [
  "title",
  "requiredSkills",
  "preferredSkills",
  "experience",
  "location",
  "workMode",
  "employmentType",
  "salary",
];

const SENIORITY_STEPS: readonly string[] = [
  "intern",
  "junior",
  "mid",
  "senior",
  "lead",
  "principal",
];

interface DimensionResult {
  score: number;
  evidence: string;
}

type DimensionOutcome = DimensionResult | null;

/** Canonical token for a skill, so "js" and "JavaScript" compare equal. */
function skillKey(skill: string): string {
  return canonicalSkill(skill) ?? fold(skill);
}

function matchSkills(
  jobSkills: readonly string[],
  candidateSkills: readonly string[],
): { matched: string[]; missing: string[] } {
  const owned = new Set(candidateSkills.map(skillKey));
  const matched: string[] = [];
  const missing: string[] = [];
  for (const skill of jobSkills) {
    if (owned.has(skillKey(skill))) matched.push(skill);
    else missing.push(skill);
  }
  return { matched, missing };
}

function scoreTitle(
  job: Job,
  context: CandidateContext,
): DimensionOutcome {
  const targets = [
    ...context.targetTitles,
    ...context.keywords.filter((keyword) => keyword.trim().split(" ").length > 1),
  ].filter((value) => value.trim().length > 0);

  if (targets.length === 0) return null;

  let best = 0;
  let bestTarget = targets[0];
  for (const target of targets) {
    const overlap = tokenOverlap(job.title, tokenize(target));
    if (overlap > best) {
      best = overlap;
      bestTarget = target;
    }
  }
  // A short target such as "data" that appears verbatim in the title is a full
  // match; a long one such as "ingénieur data engineer senior" must share most
  // of its words to score the same.
  if (best === 0) {
    const foldedTitle = fold(job.title);
    for (const target of targets) {
      if (foldedTitle.includes(fold(target))) {
        best = 0.8;
        bestTarget = target;
        break;
      }
    }
  }

  return {
    score: best,
    evidence:
      best === 0
        ? `Le titre « ${job.title} » ne partage aucun mot-clé avec vos objectifs (${targets.slice(0, 4).join(", ")}).`
        : `Le titre « ${job.title} » correspond à « ${bestTarget} » (${Math.round(best * 100)} % de recouvrement).`,
  };
}

function scoreExperience(
  job: Job,
  context: CandidateContext,
): DimensionOutcome {
  const jobLevel: Seniority | null = job.seniority;
  if (!jobLevel) return null;

  const candidateLevels = context.seniorities.filter((level) =>
    SENIORITY_STEPS.includes(level),
  );
  if (candidateLevels.length === 0) return null;

  const jobIndex = SENIORITY_STEPS.indexOf(jobLevel);
  let bestScore = 0;
  let bestGap = Number.POSITIVE_INFINITY;
  for (const level of candidateLevels) {
    const gap = Math.abs(SENIORITY_STEPS.indexOf(level) - jobIndex);
    const score = gap === 0 ? 1 : gap === 1 ? 0.6 : 0.25;
    if (score > bestScore) {
      bestScore = score;
      bestGap = gap;
    }
  }

  const gapLabel =
    bestGap === 0
      ? "niveau identique"
      : `écart de ${bestGap} niveau${bestGap > 1 ? "x" : ""}`;

  return {
    score: bestScore,
    evidence: `L'offre est de niveau « ${jobLevel} », vos préférences indiquent « ${candidateLevels.join(", ")} » (${gapLabel}).`,
  };
}

function scoreLocation(job: Job, context: CandidateContext): DimensionOutcome {
  if (job.workMode === "remote") {
    return {
      score: 1,
      evidence:
        "Le poste est en télétravail complet : votre localisation n'est pas un obstacle.",
    };
  }
  const wanted = context.locations.filter((value) => value.trim().length > 0);
  if (wanted.length === 0) return null;
  if (!job.location) {
    return {
      score: 0.5,
      evidence:
        "L'offre ne précise pas de localisation : impossible de la comparer à vos préférences.",
    };
  }

  const jobLocation = fold(job.location);
  const hit = wanted.find((value) => {
    const target = fold(value);
    return jobLocation.includes(target) || target.includes(jobLocation);
  });

  return {
    score: hit ? 1 : 0,
    evidence: hit
      ? `« ${job.location} » correspond à votre préférence « ${hit} ».`
      : `« ${job.location} » ne figure pas dans vos localisations souhaitées (${wanted.slice(0, 3).join(", ")}).`,
  };
}

function scoreWorkMode(job: Job, context: CandidateContext): DimensionOutcome {
  if (!job.workMode) return null;
  if (context.workModes.length === 0) return null;
  const hit = context.workModes.includes(job.workMode);
  return {
    score: hit ? 1 : 0,
    evidence: hit
      ? `Le mode « ${job.workMode} » fait partie de vos préférences.`
      : `Le mode « ${job.workMode} » ne fait pas partie de vos préférences (${context.workModes.join(", ")}).`,
  };
}

function scoreEmploymentType(
  job: Job,
  context: CandidateContext,
): DimensionOutcome {
  if (!job.employmentType) return null;
  if (context.employmentTypes.length === 0) return null;
  const hit = context.employmentTypes.includes(job.employmentType);
  return {
    score: hit ? 1 : 0,
    evidence: hit
      ? `Le contrat « ${job.employmentType} » correspond à ce que vous recherchez.`
      : `Le contrat « ${job.employmentType} » ne correspond pas à vos types recherchés (${context.employmentTypes.join(", ")}).`,
  };
}

function scoreSalary(job: Job, context: CandidateContext): DimensionOutcome {
  if (context.minimumSalary === null) return null;

  const { salary } = job;
  if (!salary || (salary.min === null && salary.max === null)) {
    return {
      score: 0.5,
      evidence:
        "L'offre n'indique pas de salaire : impossible de vérifier votre prétention minimale.",
    };
  }
  if (salary.currency && context.currency && salary.currency !== context.currency) {
    return {
      score: 0.5,
      evidence: `Devises différentes (offre : ${salary.currency}, vous : ${context.currency}) : comparaison non concluante.`,
    };
  }

  const advertisedMax = salary.max ?? salary.min ?? 0;
  if (advertisedMax >= context.minimumSalary) {
    return {
      score: 1,
      evidence: `Le salaire annoncé (jusqu'à ${advertisedMax} ${salary.currency ?? ""}) atteint votre minimum de ${context.minimumSalary}.`.trim(),
    };
  }
  const ratio = advertisedMax / Math.max(context.minimumSalary, 1);
  return {
    score: Math.max(0, Math.min(1, ratio)),
    evidence: `Le salaire annoncé (jusqu'à ${advertisedMax} ${salary.currency ?? ""}) est inférieur à votre minimum de ${context.minimumSalary}.`,
  };
}

function caveatsFor(job: Job): string[] {
  const caveats = [
    "Score d'adéquation estimé à partir des informations disponibles. Il ne s'agit pas d'une probabilité d'être recruté.",
  ];
  if (job.origin === "demo") {
    caveats.push(
      "Cette offre fait partie des données d'exemple : ce n'est pas une vacance réelle et actuelle.",
    );
  }
  if (!job.requiredSkills.length && !job.preferredSkills.length) {
    caveats.push(
      "L'annonce ne liste aucune compétence : le score repose entièrement sur les autres critères.",
    );
  }
  if (!job.description || job.description.trim().length < 80) {
    caveats.push(
      "La description de l'offre est très courte : les compétences réellement attendues peuvent différer.",
    );
  }
  if (!job.sourceUrl) {
    caveats.push(
      "Aucun lien vers l'annonce d'origine n'est enregistré : vérifiez l'offre avant de postuler.",
    );
  }
  return caveats;
}

/**
 * Rank a single job against a candidate context.
 *
 * Pure. Safe to call per row after a bounded database query, which is why the
 * score can be recomputed on the server for every request without any cached
 * state.
 */
export function rankJob(job: Job, context: CandidateContext): JobRank {
  const required = matchSkills(job.requiredSkills, context.skills);
  const preferred = matchSkills(job.preferredSkills, context.skills);

  const outcomes: Record<RankDimension, DimensionOutcome> = {
    title: scoreTitle(job, context),
    requiredSkills:
      job.requiredSkills.length === 0
        ? null
        : {
            score: required.matched.length / job.requiredSkills.length,
            evidence:
              required.matched.length === job.requiredSkills.length
                ? `Toutes les compétences requises sont couvertes (${required.matched.join(", ")}).`
                : `${required.matched.length} compétence(s) requise(s) sur ${job.requiredSkills.length} couverte(s). Manquant : ${required.missing.join(", ") || "—"}.`,
          },
    preferredSkills:
      job.preferredSkills.length === 0
        ? null
        : {
            score: preferred.matched.length / job.preferredSkills.length,
            evidence:
              preferred.matched.length === 0
                ? `Aucune compétence appréciée couverte (${job.preferredSkills.join(", ")}).`
                : `${preferred.matched.length} compétence(s) appréciée(s) sur ${job.preferredSkills.length} : ${preferred.matched.join(", ")}.`,
          },
    experience: scoreExperience(job, context),
    location: scoreLocation(job, context),
    workMode: scoreWorkMode(job, context),
    employmentType: scoreEmploymentType(job, context),
    salary: scoreSalary(job, context),
  };

  const breakdown: RankBreakdownEntry[] = [];
  let weighted = 0;
  let totalWeight = 0;

  for (const dimension of DIMENSION_ORDER) {
    const outcome = outcomes[dimension];
    if (!outcome) continue;
    const weight = RANK_WEIGHTS[dimension];
    weighted += outcome.score * weight;
    totalWeight += weight;
    breakdown.push({
      dimension,
      label: RANK_DIMENSION_LABELS[dimension],
      score: round(outcome.score, 3),
      weight,
      evidence: outcome.evidence,
    });
  }

  const normalised = totalWeight > 0 ? weighted / totalWeight : 0;
  const score = Math.round(normalised * 100);

  return {
    score,
    category:
      score >= MATCH_THRESHOLDS.strong
        ? "strong"
        : score >= MATCH_THRESHOLDS.moderate
          ? "moderate"
          : "low",
    breakdown,
    matchedSkills: [...required.matched, ...preferred.matched],
    missingRequired: required.missing,
    missingPreferred: preferred.missing,
    caveats: caveatsFor(job),
  };
}

function round(value: number, digits: number): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

/** Ranking helper used purely for ordering a result list. */
export function compareRank(a: JobRank | null, b: JobRank | null): number {
  return (b?.score ?? 0) - (a?.score ?? 0);
}
