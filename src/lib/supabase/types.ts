/**
 * Hand-maintained description of the CareerPilot PostgreSQL schema.
 *
 * It mirrors `supabase/migrations/*.sql` exactly and gives `supabase-js` full
 * type inference on every query. When you change a migration, change this file
 * in the same commit (or regenerate it with
 * `npx supabase gen types typescript --project-id <ref> > src/lib/supabase/types.ts`).
 *
 * Timestamps arrive as ISO strings over PostgREST; JSONB arrives already parsed.
 */

export type AppRoleRow = "candidate" | "admin" | "recruiter";

export type JobStatusRow = "draft" | "published" | "archived";

export type JobOriginRow =
  | "platform"
  | "import"
  | "api"
  | "user-submitted"
  | "sample";

export type SourceKindRow = "manual" | "csv" | "json" | "api" | "user-submitted";

export type WorkModeRow = "remote" | "hybrid" | "onsite";

export type EmploymentTypeRow =
  | "full-time"
  | "part-time"
  | "contract"
  | "internship"
  | "temporary";

export type SeniorityRow =
  | "intern"
  | "junior"
  | "mid"
  | "senior"
  | "lead"
  | "principal";

export type ApplicationStatusRow =
  | "interested"
  | "saved"
  | "applied"
  | "screening"
  | "interview"
  | "assessment"
  | "offer"
  | "rejected"
  | "withdrawn";

export type DifficultyRow = "beginner" | "intermediate" | "advanced";

interface Table<Row, Insert, Update> {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: [];
}

/** `created_at` / `updated_at` are database defaults; ids default to uuid. */
type Generated = "id" | "created_at" | "updated_at";

/** Column keys whose values may be `null`. */
type NullableKeys<T> = {
  [K in keyof T]-?: null extends T[K] ? K : never;
}[keyof T];

/**
 * Insert payload for a table.
 *
 * Generated columns and columns that may be `null` are optional, so a caller
 * never has to spell out `salary_min: null` for a value the database will leave
 * NULL anyway. `TOptional` covers non-nullable columns that nonetheless have a
 * database DEFAULT — `applications.history` defaults to `'[]'`.
 */
export type TableInsert<
  TRow,
  TOptional extends keyof TRow & string = never,
> = Omit<
  TRow,
  TOptional | NullableKeys<TRow> | (keyof TRow & Generated)
> &
  Partial<Pick<TRow, TOptional | NullableKeys<TRow> | (keyof TRow & Generated)>>;

export type ProfileRow = {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  headline: string | null;
  location: string | null;
  bio: string | null;
  phone: string | null;
  website_url: string | null;
  linkedin_url: string | null;
  github_url: string | null;
  onboarded: boolean;
  created_at: string;
  updated_at: string;
};

export type UserRoleRow = {
  id: string;
  user_id: string;
  role: AppRoleRow;
  granted_by: string | null;
  granted_at: string;
};

export type CandidatePreferencesRow = {
  user_id: string;
  desired_job_titles: string[];
  preferred_locations: string[];
  employment_types: EmploymentTypeRow[];
  work_modes: WorkModeRow[];
  minimum_salary: number | null;
  salary_currency: string | null;
  preferred_industries: string[];
  seniority: SeniorityRow | null;
  weekly_study_hours: number | null;
  created_at: string;
  updated_at: string;
};

export type SkillRow = {
  id: string;
  name: string;
  slug: string;
  category: string | null;
  created_at: string;
};

export type CandidateSkillRow = {
  user_id: string;
  skill_id: string;
  proficiency_level: number | null;
  years_of_experience: number | null;
  created_at: string;
};

export type JobRow = {
  id: string;
  title: string;
  company_name: string;
  description: string | null;
  location: string | null;
  work_mode: WorkModeRow | null;
  employment_type: EmploymentTypeRow | null;
  seniority: SeniorityRow | null;
  salary_min: number | null;
  salary_max: number | null;
  currency: string | null;
  required_skills: string[];
  preferred_skills: string[];
  experience_years: number | null;
  source_name: string | null;
  source_url: string | null;
  source_type: JobOriginRow;
  external_id: string | null;
  fingerprint: string;
  published_at: string | null;
  expires_at: string | null;
  status: JobStatusRow;
  is_sample: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type JobSourceRow = {
  id: string;
  name: string;
  base_url: string | null;
  source_type: SourceKindRow;
  enabled: boolean;
  configuration: Record<string, unknown>;
  last_synced_at: string | null;
  last_error: string | null;
  created_at: string;
  updated_at: string;
};

export type SavedJobRow = {
  id: string;
  user_id: string;
  job_id: string;
  created_at: string;
};

export type ApplicationRow = {
  id: string;
  user_id: string;
  job_id: string | null;
  company_name: string;
  job_title: string;
  status: ApplicationStatusRow;
  applied_at: string | null;
  follow_up_at: string | null;
  interview_at: string | null;
  source_url: string | null;
  notes: string | null;
  salary_min: number | null;
  salary_max: number | null;
  currency: string | null;
  history: unknown[];
  created_at: string;
  updated_at: string;
};

export type CvProfileRow = {
  id: string;
  user_id: string;
  name: string;
  template: string;
  structured_content: Record<string, unknown>;
  source_text: string | null;
  original_file_path: string | null;
  created_at: string;
  updated_at: string;
};

export type AiConversationRow = {
  id: string;
  user_id: string;
  title: string;
  created_at: string;
  updated_at: string;
};

export type AiMessageRow = {
  id: string;
  conversation_id: string;
  user_id: string;
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

export type AiUsageLogRow = {
  id: string;
  user_id: string | null;
  provider: string | null;
  model: string | null;
  feature: string;
  status: "success" | "error" | "rate_limited" | "not_configured";
  duration_ms: number | null;
  error_code: string | null;
  created_at: string;
};

export type AdminAuditLogRow = {
  id: string;
  actor_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  summary: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

export type JobImportBatchRow = {
  id: string;
  created_by: string | null;
  source_id: string | null;
  source_name: string;
  format: "csv" | "json" | "paste" | "url";
  total_rows: number;
  inserted: number;
  updated: number;
  duplicates: number;
  failed: number;
  errors: unknown[];
  created_at: string;
};

export type LearningGoalRow = {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  skill_name: string | null;
  week_number: number | null;
  target_date: string | null;
  status: "todo" | "in-progress" | "done";
  difficulty: DifficultyRow | null;
  resources: unknown[];
  created_at: string;
  updated_at: string;
};

export interface Database {
  public: {
    Tables: {
      profiles: Table<
        ProfileRow,
        Omit<ProfileRow, Generated> & Partial<Pick<ProfileRow, "id">>,
        Partial<Omit<ProfileRow, "id" | "created_at">>
      >;
      user_roles: Table<
        UserRoleRow,
        Omit<UserRoleRow, "id" | "granted_at"> & Partial<Pick<UserRoleRow, "id">>,
        Partial<Omit<UserRoleRow, "id">>
      >;
      candidate_preferences: Table<
        CandidatePreferencesRow,
        Omit<CandidatePreferencesRow, "created_at" | "updated_at"> &
          Partial<CandidatePreferencesRow>,
        Partial<Omit<CandidatePreferencesRow, "created_at">>
      >;
      skills: Table<
        SkillRow,
        Omit<SkillRow, "id" | "created_at" | "slug"> &
          Partial<Pick<SkillRow, "id" | "slug">>,
        Partial<Omit<SkillRow, "id" | "created_at">>
      >;
      candidate_skills: Table<
        CandidateSkillRow,
        Omit<CandidateSkillRow, "created_at">,
        Partial<CandidateSkillRow>
      >;
      jobs: Table<
        JobRow,
        Omit<JobRow, Generated | "fingerprint"> &
          Partial<Pick<JobRow, "fingerprint" | "id">>,
        Partial<Omit<JobRow, "id" | "created_at" | "fingerprint">>
      >;
      job_sources: Table<
        JobSourceRow,
        Omit<JobSourceRow, Generated> & Partial<Pick<JobSourceRow, "id">>,
        Partial<Omit<JobSourceRow, "id" | "created_at">>
      >;
      saved_jobs: Table<
        SavedJobRow,
        Omit<SavedJobRow, "id" | "created_at"> & Partial<Pick<SavedJobRow, "id">>,
        never
      >;
      applications: Table<
        ApplicationRow,
        TableInsert<ApplicationRow, "history">,
        Partial<Omit<ApplicationRow, "id" | "created_at">>
      >;
      cv_profiles: Table<
        CvProfileRow,
        Partial<CvProfileRow> & Pick<CvProfileRow, "user_id">,
        Partial<Omit<CvProfileRow, "id" | "created_at">>
      >;
      ai_conversations: Table<
        AiConversationRow,
        Partial<AiConversationRow> & Pick<AiConversationRow, "user_id">,
        Partial<Omit<AiConversationRow, "id" | "created_at">>
      >;
      ai_messages: Table<
        AiMessageRow,
        Partial<AiMessageRow> &
          Pick<AiMessageRow, "conversation_id" | "user_id" | "role" | "content">,
        never
      >;
      ai_usage_logs: Table<
        AiUsageLogRow,
        Partial<AiUsageLogRow> & Pick<AiUsageLogRow, "feature" | "status">,
        never
      >;
      admin_audit_logs: Table<
        AdminAuditLogRow,
        Partial<AdminAuditLogRow> &
          Pick<AdminAuditLogRow, "action" | "entity_type" | "summary">,
        never
      >;
      job_import_batches: Table<
        JobImportBatchRow,
        Partial<JobImportBatchRow> &
          Pick<JobImportBatchRow, "source_name" | "format">,
        never
      >;
      learning_goals: Table<
        LearningGoalRow,
        Partial<LearningGoalRow> &
          Pick<LearningGoalRow, "user_id" | "title">,
        Partial<Omit<LearningGoalRow, "id" | "created_at">>
      >;
    };
    Views: Record<never, never>;
    Functions: {
      has_role: {
        Args: { uid: string; role_name: AppRoleRow };
        Returns: boolean;
      };
      is_admin: {
        Args: { uid: string };
        Returns: boolean;
      };
    };
    Enums: {
      app_role: AppRoleRow;
      job_status: JobStatusRow;
      work_mode: WorkModeRow;
      employment_type: EmploymentTypeRow;
      seniority: SeniorityRow;
      application_status: ApplicationStatusRow;
      job_origin: JobOriginRow;
      source_kind: SourceKindRow;
      difficulty_level: DifficultyRow;
      goal_status: "todo" | "in-progress" | "done";
      ai_usage_status: "success" | "error" | "rate_limited" | "not_configured";
    };
    CompositeTypes: Record<never, never>;
  };
}

export type Tables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"];

export type TablesInsert<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Insert"];

export type TablesUpdate<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Update"];
