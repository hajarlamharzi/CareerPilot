import type {
  CvDocument,
  InterviewCategory,
  InterviewDifficulty,
  InterviewQuestion,
  InterviewType,
  Job,
  MatchReport,
} from "@/types";

/**
 * Local interview-question generation.
 *
 * Every question is derived from data the user already stores — job skills,
 * responsibilities, the CV's own history, and the gaps a match report found. The
 * generator never invents an achievement, employer or skill: guidance text tells
 * the candidate *how* to structure an answer and explicitly tells them to be
 * honest where the evidence is thin.
 *
 * The output is pure data, which keeps it unit-testable without a browser.
 */

/** A question that has not yet been persisted. */
export type InterviewQuestionDraft = Omit<
  InterviewQuestion,
  "id" | "origin" | "createdAt" | "updatedAt"
>;

export type QuestionSource = "job" | "cv" | "skill-gap" | "questions-to-ask";

export const QUESTION_SOURCES: {
  value: QuestionSource;
  label: string;
  description: string;
  /** False when the workspace has nothing to generate this source from. */
  requires: "job" | "cv" | "match" | null;
}[] = [
  {
    value: "job",
    label: "À partir de l'offre d'emploi",
    description:
      "Une question par compétence requise et souhaitée, plus les responsabilités listées.",
    requires: "job",
  },
  {
    value: "skill-gap",
    label: "À partir de vos lacunes de correspondance",
    description:
      "Des questions sur les compétences demandées par l'offre que votre CV ne démontre pas encore.",
    requires: "match",
  },
  {
    value: "cv",
    label: "À partir de votre CV",
    description:
      "Des questions sur vos postes et projets les plus récents, construites à partir du CV que vous avez enregistré.",
    requires: "cv",
  },
  {
    value: "questions-to-ask",
    label: "Questions pour le recruteur",
    description:
      "Des pistes pour évaluer le poste plutôt que répéter une réponse.",
    requires: "job",
  },
];

// ---------------------------------------------------------------------------
// Sources
// ---------------------------------------------------------------------------

interface Candidate {
  category: InterviewCategory;
  difficulty: InterviewDifficulty;
  type: InterviewType;
  question: string;
  guidance: string;
}

const STAR_HINT =
  "Répondez avec la méthode STAR : Situation (le contexte et les enjeux), Tâche (ce dont vous étiez responsable), Action (ce que vous avez fait concrètement, avec les décisions et les compromis), Résultat (le résultat mesurable, et ce que vous changeriez).";

function trimTrailing(value: string): string {
  return value.trim().replace(/[.\s]+$/, "");
}

/** Questions derived from the skills and responsibilities in the advert. */
function jobQuestions(job: Job): Candidate[] {
  const out: Candidate[] = [];

  for (const skill of job.requiredSkills) {
    out.push({
      category: "technical",
      difficulty: job.seniority === "senior" || job.seniority === "lead" ? "hard" : "medium",
      type: "technical",
      question: `${job.company} mentionne ${skill} comme une exigence pour ce poste. Décrivez le problème le plus exigeant que vous avez résolu avec ${skill}, et ce que vous avez choisi de ne pas faire.`,
      guidance: `Ne généralisez pas sur ${skill} — choisissez un projet concret et restez-y. ${STAR_HINT} Si votre expérience de ${skill} est limitée, dites-le clairement et décrivez comment vous monteriez en compétence.`,
    });
  }

  for (const skill of job.preferredSkills) {
    out.push({
      category: "role-specific",
      difficulty: "medium",
      type: "technical",
      question: `Lequel de vos projets démontre l'usage le plus abouti de ${skill}, et comment sauriez-vous que votre approche était bonne et pas simplement fonctionnelle ?`,
      guidance: `Nommez le projet, la contrainte qui l'a façonné et les preuves que vous avez utilisées (tests, métriques, retours de revue). ${STAR_HINT}`,
    });
  }

  for (const responsibility of job.responsibilities.slice(0, 4)) {
    out.push({
      category: "role-specific",
      difficulty: "medium",
      type:
        job.seniority === "lead" || job.seniority === "principal"
          ? "system-design"
          : "technical",
      question: `L'offre liste cette responsabilité : "${trimTrailing(responsibility)}". Comment l'aborderiez-vous durant vos trois premiers mois ?`,
      guidance:
        "Répondez sous forme de plan, pas de récit : ce que vous examineriez d'abord, à qui vous parleriez, ce que vous laisseriez volontairement de côté, et comment vous sauriez que cela s'améliore. Citez un travail comparable que vous avez réellement mené, et indiquez clairement ce que vous auriez à apprendre.",
    });
  }

  return out;
}

/** Questions about the gaps a match report identified. */
function skillGapQuestions(job: Job, report: MatchReport): Candidate[] {
  const seen = new Set<string>();
  const gaps = [
    ...report.missingRequiredSkills.map((skill) => ({ skill, required: true })),
    ...report.missingPreferredSkills.map((skill) => ({ skill, required: false })),
  ];
  const out: Candidate[] = [];

  for (const gap of gaps) {
    const key = gap.skill.trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push({
      category: "skill-gap",
      difficulty: gap.required ? "hard" : "medium",
      type: "technical",
      question: gap.required
        ? `Le rapport de correspondance n'a trouvé aucune preuve de ${gap.skill} dans votre CV, mais ${job.company} l'indique comme requise. Comment y répondriez-vous honnêtement ?`
        : `Ce poste préfère ${gap.skill} et votre CV ne le montre pas actuellement. Quelle est votre expérience la plus proche ?`,
      guidance: `Ne revendiquez pas une expérience de ${gap.skill} que vous n'avez pas — les recruteurs le testent ensuite et cela peut vous coûter le poste. À la place : indiquez votre niveau actuel, nommez la compétence la plus proche que vous possédez, décrivez un plan concret pour combler l'écart (un projet, une formation, un mentor), et donnez un délai réaliste.`,
    });
  }

  return out;
}

/** Questions derived from the CV's own roles and projects. */
function cvQuestions(cv: CvDocument): Candidate[] {
  const out: Candidate[] = [];

  for (const entry of cv.sections.experience.slice(0, 3)) {
    out.push({
      category: "cv-based",
      difficulty: entry.current ? "medium" : "easy",
      type: "behavioral",
      question: `Votre CV indique que vous étiez ${entry.role} chez ${entry.company}. Quel a été le compromis le plus difficile que vous avez dû faire ?`,
      guidance: `Choisissez une décision réelle parmi ces responsabilités : ${
        entry.highlights.length > 0
          ? entry.highlights.map(trimTrailing).join("; ")
          : trimTrailing(entry.description) || "le travail décrit sur votre CV"
      }. ${STAR_HINT} Nommez ce à quoi vous avez renoncé et pourquoi.`,
    });
  }

  for (const project of cv.sections.projects.slice(0, 2)) {
    out.push({
      category: "cv-based",
      difficulty: "medium",
      type: "technical",
      question: `Pour "${project.name}" sur votre CV, que feriez-vous différemment aujourd'hui, et pourquoi ?`,
      guidance: `Appuyez-vous sur la description du projet lui-même comme point d'ancrage${project.skills.length > 0 ? ` (${project.skills.join(", ")})` : ""}. Faites preuve de jugement : ce que vous avez appris ensuite, quelle était la contrainte à l'époque, et ce que vous changeriez maintenant. ${STAR_HINT}`,
    });
  }

  if (cv.sections.skillGroups.length > 0) {
    const skills = cv.sections.skillGroups
      .flatMap((group) => group.skills)
      .slice(0, 6);
    if (skills.length > 0) {
      out.push({
        category: "cv-based",
        difficulty: "easy",
        type: "phone-screen",
        question: `Votre CV regroupe vos compétences ainsi : ${cv.sections.skillGroups
          .map((group) => group.label)
          .join(", ")}. Classez ${skills.join(", ")} selon votre confiance à les utiliser d'emblée, sans préparation, dès le premier jour.`,
        guidance:
          "Se classer à voix haute est un test de crédibilité. Ordonnez-les, donnez une phrase de preuve pour les deux premiers, et soyez explicite sur celles que vous auriez besoin de rafraîchir. Refuser de vous classer paraît évasif.",
      });
    }
  }

  return out;
}

/** Questions the candidate should ask, always tied to this specific advert. */
function questionsToAsk(job: Job): Candidate[] {
  const out: Candidate[] = [
    {
      category: "questions-to-ask",
      difficulty: "easy",
      type: "final",
      question: `What does success look like in this ${job.title} role after 90 days, and who judges it?`,
      guidance:
        "You are assessing the role, not performing. Listen for a concrete definition of success and for who owns it. A vague answer is itself information.",
    },
    {
      category: "questions-to-ask",
      difficulty: "easy",
      type: "final",
      question: `How is the work that this role owns delivered today, and what would you want to change about it?`,
      guidance: `Ask about the team's current delivery path. For ${job.company}, a good follow-up is: "What would have to be true for that change to happen?"`,
    },
    {
      category: "questions-to-ask",
      difficulty: "medium",
      type: "final",
      question: `Which decisions would I own in the first six months, and which would need sign-off?`,
      guidance:
        "This clarifies real autonomy without sounding demanding. Cross-check the answer against the responsibilities listed in the advert.",
    },
    {
      category: "questions-to-ask",
      difficulty: "medium",
      type: "final",
      question: `What is the team most worried about right now?`,
      guidance:
        "Risks are the fastest route to understanding a team. Note anything you could genuinely help with, and say so — briefly, once.",
    },
  ];

  if (job.seniority === "lead" || job.seniority === "principal") {
    out.push({
      category: "questions-to-ask",
      difficulty: "hard",
      type: "final",
      question:
        "How does technical leadership work here — is it a title, a set of responsibilities, or both?",
      guidance:
        "A senior answer needs to know the shape of the mandate before negotiating scope.",
    });
  }

  return out;
}

// ---------------------------------------------------------------------------
// Generation
// ---------------------------------------------------------------------------

export interface QuestionGenerationInput {
  job?: Job | null;
  cv?: CvDocument | null;
  matchReport?: MatchReport | null;
  sources: QuestionSource[];
  /** Maximum questions produced per source. */
  limitPerSource?: number;
  /** Questions already in the workspace, used to avoid duplicates. */
  existing?: InterviewQuestion[];
}

function normaliseQuestion(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

/**
 * Build questions deterministically. The same input always produces the same
 * questions, in the same order, with duplicates (against the workspace and
 * within the batch) removed.
 */
export function generateInterviewQuestions(
  input: QuestionGenerationInput,
): InterviewQuestionDraft[] {
  const { job, cv, matchReport } = input;
  const limit = input.limitPerSource ?? 6;
  const used = new Set(
    (input.existing ?? []).map((question) => normaliseQuestion(question.question)),
  );
  const drafts: InterviewQuestionDraft[] = [];

  for (const source of input.sources) {
    let candidates: Candidate[] = [];

    if (source === "job" && job) candidates = jobQuestions(job);
    if (source === "skill-gap" && job && matchReport)
      candidates = skillGapQuestions(job, matchReport);
    if (source === "cv" && cv) candidates = cvQuestions(cv);
    if (source === "questions-to-ask" && job) candidates = questionsToAsk(job);

    let added = 0;
    for (const candidate of candidates) {
      if (added >= limit) break;
      const key = normaliseQuestion(candidate.question);
      if (used.has(key)) continue;
      used.add(key);
      added += 1;
      drafts.push({
        jobId: job?.id ?? null,
        applicationId: null,
        category: candidate.category,
        difficulty: candidate.difficulty,
        type: candidate.type,
        question: candidate.question,
        guidance: candidate.guidance,
        userAnswer: "",
        practiced: false,
      });
    }
  }

  return drafts;
}

/** Which sources can actually produce questions from the given data. */
export function availableSources(input: {
  job?: Job | null;
  cv?: CvDocument | null;
  matchReport?: MatchReport | null;
}): QuestionSource[] {
  const out: QuestionSource[] = [];
  if (input.job) out.push("job", "questions-to-ask");
  if (input.matchReport) out.push("skill-gap");
  if (input.cv) out.push("cv");
  return out;
}
