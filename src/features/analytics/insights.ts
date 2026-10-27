import {
  APPLICATION_STATUS_LABELS,
  FUNNEL_STAGES,
  INTERVIEW_CATEGORY_LABELS,
  INTERVIEW_DIFFICULTIES,
  INTERVIEW_DIFFICULTY_LABELS,
  PIPELINE_PROGRESS,
  RESPONSE_APPLICATION_STATUSES,
  TERMINAL_APPLICATION_STATUSES,
} from "@/config/constants";
import type {
  Application,
  ApplicationVelocity,
  FunnelInsight,
  FunnelStep,
  InterviewPrepStats,
  InterviewQuestion,
} from "@/types";

/**
 * Analytics beyond the headline summary.
 *
 * Two rules govern everything here:
 *  1. Only stored records are counted — nothing is inferred from outside data.
 *  2. Every derivation has a definition the UI can show the user verbatim, so a
 *     number is never a black box.
 *
 * The functions are pure: same input, same output, no clocks and no browser.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

/** Position of a status in the pipeline, or `null` for outcomes. */
function stageRank(status: string): number | null {
  const index = (PIPELINE_PROGRESS as readonly string[]).indexOf(status);
  return index === -1 ? null : index;
}

/**
 * Furthest pipeline stage an application is known to have reached, taken from
 * the current status *and* every recorded history transition. `rejected` and
 * `withdrawn` carry no rank of their own, so an application rejected after an
 * interview still counts as having reached interview.
 */
function furthestStageRank(application: Application): number | null {
  let rank = stageRank(application.status);
  for (const entry of application.history) {
    const candidate = stageRank(entry.to);
    if (candidate === null) continue;
    if (rank === null || candidate > rank) rank = candidate;
  }
  return rank;
}

function round(value: number, places = 1): number {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}

/**
 * Build the applications funnel.
 *
 * Definition shown to the user: an application counts at a stage if its furthest
 * recorded stage is that stage or a later one. Applications that were never
 * submitted (`interested`, `saved`) are excluded from the funnel and reported
 * separately.
 */
export function computeFunnel(applications: Application[]): FunnelInsight {
  const appliedRank = stageRank("applied");
  const ranks = applications
    .map((application) => furthestStageRank(application))
    .filter((rank): rank is number => rank !== null);

  const submitted = ranks.filter(
    (rank) => appliedRank !== null && rank >= appliedRank,
  );
  const notApplied = ranks.filter(
    (rank) => appliedRank !== null && rank < appliedRank,
  ).length;
  const closed = applications.filter(
    (application) =>
      application.status === "rejected" || application.status === "withdrawn",
  ).length;

  const firstCount = submitted.length;

  const steps: FunnelStep[] = FUNNEL_STAGES.map((stage) => {
    const rank = stageRank(stage);
    const reached =
      rank === null
        ? 0
        : submitted.filter((value) => value >= rank).length;
    return {
      stage,
      label: APPLICATION_STATUS_LABELS[stage],
      reached,
      percentage:
        firstCount > 0 ? round((reached / firstCount) * 100) : 0,
      lost: 0,
      dropOff: 0,
    } satisfies FunnelStep;
  });

  // Drop-off is only meaningful between two consecutive steps.
  for (let i = 1; i < steps.length; i++) {
    const previous = steps[i - 1];
    const lost = Math.max(0, previous.reached - steps[i].reached);
    steps[i] = {
      ...steps[i],
      lost,
      dropOff:
        previous.reached > 0
          ? round((lost / previous.reached) * 100)
          : 0,
    };
  }

  const offers = steps.find((step) => step.stage === "offer")?.reached ?? 0;

  return {
    steps,
    notApplied,
    closed,
    appliedToOfferRate: submitted.length > 0 ? round((offers / submitted.length) * 100) : 0,
  };
}

/** Mean of a non-empty list, rounded to one decimal. */
function mean(values: number[]): number | null {
  if (values.length === 0) return null;
  return round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? round((sorted[middle - 1] + sorted[middle]) / 2)
    : round(sorted[middle]);
}

/** Days between two ISO strings, or `null` when either is missing/unparseable. */
function daysBetween(from: string, to: string): number | null {
  const start = Date.parse(from);
  const end = Date.parse(to);
  if (Number.isNaN(start) || Number.isNaN(end) || end < start) return null;
  return (end - start) / DAY_MS;
}

/**
 * How long employers take to respond, measured only where an application has an
 * `appliedAt` date *and* a recorded transition into a response stage. An
 * unrecorded employer simply does not contribute.
 */
export function computeApplicationVelocity(
  applications: Application[],
): ApplicationVelocity {
  const responseDurations: number[] = [];
  const offerDurations: number[] = [];
  let awaitingResponse = 0;
  let sampleSize = 0;

  for (const application of applications) {
    if (!application.appliedAt) continue;
    const transitions = [...application.history]
      .filter((entry) => typeof entry.at === "string")
      .sort((a, b) => Date.parse(a.at) - Date.parse(b.at));

    const response = transitions.find((entry) =>
      (RESPONSE_APPLICATION_STATUSES as readonly string[]).includes(entry.to),
    );
    const offer = transitions.find((entry) => entry.to === "offer");

    if (!response) {
      const status = application.status;
      const responded = (RESPONSE_APPLICATION_STATUSES as readonly string[]).includes(
        status,
      );
      const closed =
        (TERMINAL_APPLICATION_STATUSES as readonly string[]).includes(status);
      if (!responded && !closed) awaitingResponse += 1;
      continue;
    }

    const duration = daysBetween(application.appliedAt, response.at);
    if (duration === null) continue;
    sampleSize += 1;
    responseDurations.push(duration);

    if (offer) {
      const toOffer = daysBetween(application.appliedAt, offer.at);
      if (toOffer !== null) offerDurations.push(toOffer);
    }
  }

  return {
    sampleSize,
    meanDaysToResponse: mean(responseDurations),
    medianDaysToResponse: median(responseDurations),
    fastestResponseDays:
      responseDurations.length > 0 ? round(Math.min(...responseDurations)) : null,
    slowestResponseDays:
      responseDurations.length > 0 ? round(Math.max(...responseDurations)) : null,
    meanDaysToOffer: mean(offerDurations),
    awaitingResponse,
  };
}

/**
 * Interview preparation coverage. "Answered" means the user wrote something,
 * "practised" is their own rehearsal flag, so the two are reported separately
 * rather than collapsed into one score.
 */
export function computeInterviewPrepStats(
  questions: InterviewQuestion[],
): InterviewPrepStats {
  const total = questions.length;
  const practiced = questions.filter((question) => question.practiced).length;
  const answered = questions.filter(
    (question) => question.userAnswer.trim().length > 0,
  ).length;

  const byCategory = (
    Object.keys(INTERVIEW_CATEGORY_LABELS) as (keyof typeof INTERVIEW_CATEGORY_LABELS)[]
  ).map((category) => {
    const group = questions.filter((question) => question.category === category);
    return {
      category,
      label: INTERVIEW_CATEGORY_LABELS[category],
      total: group.length,
      practiced: group.filter((question) => question.practiced).length,
      answered: group.filter((question) => question.userAnswer.trim().length > 0)
        .length,
    };
  });

  const byDifficulty = INTERVIEW_DIFFICULTIES.map((difficulty) => {
    const group = questions.filter(
      (question) => question.difficulty === difficulty,
    );
    return {
      difficulty,
      label: INTERVIEW_DIFFICULTY_LABELS[difficulty],
      total: group.length,
      practiced: group.filter((question) => question.practiced).length,
    };
  });

  return {
    total,
    practiced,
    answered,
    practicedRate: total > 0 ? round((practiced / total) * 100) : 0,
    byCategory,
    byDifficulty,
  };
}
