import type {
  Application,
  CvDocument,
  InterviewQuestion,
  Job,
  MatchReport,
  StatusHistoryEntry,
} from "@/types";

/**
 * Small, explicit test fixtures. Tests build records from these so each case
 * states only the fields it actually exercises.
 */

export function historyEntry(
  to: string,
  at: string,
  from: string | null = null,
): StatusHistoryEntry {
  return { id: `hist-${to}-${at}`, from, to, at, note: null };
}

export function makeApplication(
  input: Pick<Application, "id" | "status"> & {
    appliedAt?: string | null;
    history?: StatusHistoryEntry[];
    company?: string;
  },
): Application {
  const { id, status, appliedAt = null, history = [], company = "Acme" } = input;
  return {
    id,
    jobId: null,
    company,
    position: "Frontend Developer",
    status,
    appliedAt,
    sourceUrl: null,
    sourceName: null,
    contact: { name: null, email: null, phone: null, role: null },
    notes: [],
    followUpAt: null,
    interviewAt: null,
    salary: null,
    history,
    origin: "user",
    createdAt: appliedAt ?? "2026-01-01T00:00:00.000Z",
    updatedAt: appliedAt ?? "2026-01-01T00:00:00.000Z",
  };
}

export function makeJob(overrides: Partial<Job> = {}): Job {
  return {
    id: "job-1",
    title: "Frontend Developer",
    company: "Acme",
    companyWebsite: null,
    companyLogo: null,
    location: "Remote",
    workMode: "remote",
    employmentType: "full-time",
    seniority: "mid",
    salary: null,
    description: "Build the customer portal.",
    responsibilities: ["Own the design system", "Review pull requests"],
    requiredSkills: ["React", "TypeScript"],
    preferredSkills: ["Recharts"],
    experienceYears: 3,
    education: null,
    sourceUrl: null,
    sourceName: null,
    publishedAt: null,
    deadline: null,
    addedAt: "2026-01-01T00:00:00.000Z",
    status: "saved",
    notes: null,
    tags: [],
    origin: "user",
    ...overrides,
  };
}

export function makeCv(overrides: Partial<CvDocument> = {}): CvDocument {
  return {
    id: "cv-1",
    name: "Alex Moreau — Frontend CV",
    template: "classic",
    contact: {
      fullName: "Alex Moreau",
      email: null,
      phone: null,
      location: null,
      website: null,
      linkedin: null,
      github: null,
    },
    title: "Frontend Developer",
    sections: {
      summary: "Frontend developer.",
      skillGroups: [{ id: "sg-1", label: "Languages", skills: ["TypeScript", "CSS"] }],
      experience: [
        {
          id: "exp-1",
          role: "Junior Frontend Developer",
          company: "Harborview Digital",
          location: null,
          startDate: "2024-03",
          endDate: null,
          current: true,
          description: "Built accessible UI.",
          highlights: ["Shipped the design system"],
          skills: ["React"],
        },
      ],
      education: [],
      projects: [
        {
          id: "prj-1",
          name: "Portal rewrite",
          description: "Rebuilt the customer portal.",
          url: null,
          startDate: null,
          endDate: null,
          highlights: [],
          skills: ["React"],
        },
      ],
      certifications: [],
      languages: [],
      achievements: [],
    },
    sourceText: null,
    sourceFileName: null,
    origin: "demo",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

export function makeMatchReport(overrides: Partial<MatchReport> = {}): MatchReport {
  return {
    id: "match-1",
    jobId: "job-1",
    cvId: "cv-1",
    mode: "baseline",
    score: 62,
    category: "moderate",
    breakdown: [],
    matchedSkills: [],
    missingRequiredSkills: ["GraphQL"],
    missingPreferredSkills: ["Recharts"],
    findings: [],
    keywordsToConsider: [],
    qualificationGaps: [],
    learningPriorities: [],
    cvImprovements: [],
    confidence: 0.8,
    aiAssessment: null,
    providerId: null,
    modelId: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

export function makeQuestion(
  overrides: Partial<InterviewQuestion> = {},
): InterviewQuestion {
  return {
    id: "q-1",
    jobId: null,
    applicationId: null,
    category: "behavioral",
    difficulty: "easy",
    type: "behavioral",
    question: "Tell me about a conflict you resolved.",
    guidance: null,
    userAnswer: "",
    practiced: false,
    origin: "user",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}
