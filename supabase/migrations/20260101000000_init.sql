-- =============================================================================
-- CareerPilot — 0001 · schema
-- =============================================================================
-- Normalised PostgreSQL schema for an AI-powered career platform.
--
-- Apply with the Supabase CLI:
--   supabase link --project-ref <your-ref>
--   supabase db push
-- or paste into Supabase Studio -> SQL Editor, in filename order.
--
-- Conventions used throughout:
--   * every table has `created_at` (and `updated_at` where rows are mutable);
--   * every foreign key is explicit and constrained;
--   * nothing is public by default — RLS is enabled in migration 0002;
--   * no secret is ever stored in a client-readable column.
-- =============================================================================

create extension if not exists "pgcrypto";

-- -----------------------------------------------------------------------------
-- Enumerated types
-- -----------------------------------------------------------------------------

do $$ begin
  create type public.app_role as enum ('candidate', 'admin', 'recruiter');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.job_status as enum ('draft', 'published', 'archived');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.work_mode as enum ('remote', 'hybrid', 'onsite');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.employment_type as enum
    ('full-time', 'part-time', 'contract', 'internship', 'temporary');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.seniority as enum
    ('intern', 'junior', 'mid', 'senior', 'lead', 'principal');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.application_status as enum
    ('interested', 'saved', 'applied', 'screening', 'interview',
     'assessment', 'offer', 'rejected', 'withdrawn');
exception when duplicate_object then null; end $$;

-- Provenance of a listing. `sample` is reserved for explicitly-labelled demo
-- rows; the interface must never present them as current vacancies.
do $$ begin
  create type public.job_origin as enum
    ('platform', 'import', 'api', 'user-submitted', 'sample');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.source_kind as enum
    ('manual', 'csv', 'json', 'api', 'user-submitted');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.difficulty_level as enum
    ('beginner', 'intermediate', 'advanced');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.goal_status as enum ('todo', 'in-progress', 'done');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.ai_usage_status as enum
    ('success', 'error', 'rate_limited', 'not_configured');
exception when duplicate_object then null; end $$;

-- -----------------------------------------------------------------------------
-- Shared trigger helpers
-- -----------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- profiles — one row per authenticated account
-- -----------------------------------------------------------------------------

create table if not exists public.profiles (
  id            uuid primary key references auth.users (id) on delete cascade,
  full_name     text check (char_length(full_name) between 1 and 160),
  avatar_url    text,
  headline      text check (char_length(headline) <= 200),
  location      text check (char_length(location) <= 160),
  bio           text check (char_length(bio) <= 2000),
  phone         text check (char_length(phone) <= 40),
  website_url   text,
  linkedin_url  text,
  github_url    text,
  onboarded     boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- user_roles — the RBAC source of truth
-- -----------------------------------------------------------------------------
-- Privileged rows. There is deliberately NO policy that lets a client insert,
-- update or delete here: role changes run through a trusted server operation
-- holding the service-role key, which also writes an audit entry.

create table if not exists public.user_roles (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  role       public.app_role not null,
  granted_by uuid references auth.users (id) on delete set null,
  granted_at timestamptz not null default now(),
  unique (user_id, role)
);

create index if not exists user_roles_user_id_idx on public.user_roles (user_id);

-- -----------------------------------------------------------------------------
-- candidate_preferences
-- -----------------------------------------------------------------------------

create table if not exists public.candidate_preferences (
  user_id              uuid primary key references auth.users (id) on delete cascade,
  desired_job_titles   text[] not null default '{}',
  preferred_locations  text[] not null default '{}',
  employment_types     public.employment_type[] not null default '{}',
  work_modes           public.work_mode[] not null default '{}',
  minimum_salary       integer check (minimum_salary >= 0),
  salary_currency      text not null default 'MAD',
  preferred_industries text[] not null default '{}',
  seniority            public.seniority,
  weekly_study_hours   smallint check (weekly_study_hours between 1 and 60),
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create trigger candidate_preferences_set_updated_at
  before update on public.candidate_preferences
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- skills / candidate_skills
-- -----------------------------------------------------------------------------

create table if not exists public.skills (
  id         uuid primary key default gen_random_uuid(),
  name       text not null unique,
  slug       text not null unique,
  category   text,
  created_at timestamptz not null default now()
);

create table if not exists public.candidate_skills (
  user_id             uuid not null references auth.users (id) on delete cascade,
  skill_id            uuid not null references public.skills (id) on delete cascade,
  proficiency_level   smallint check (proficiency_level between 1 and 5),
  years_of_experience numeric(4, 1) check (years_of_experience >= 0),
  created_at          timestamptz not null default now(),
  primary key (user_id, skill_id)
);

-- -----------------------------------------------------------------------------
-- job_sources
-- -----------------------------------------------------------------------------
-- Operational, administrator-managed list of places listings come from.
-- `configuration` holds non-secret settings only (delimiter, column map,
-- public feed id...). Credentials belong in server environment variables.

create table if not exists public.job_sources (
  id             uuid primary key default gen_random_uuid(),
  name           text not null unique,
  base_url       text,
  source_type    public.source_kind not null default 'manual',
  enabled        boolean not null default true,
  configuration  jsonb not null default '{}'::jsonb,
  last_synced_at timestamptz,
  last_error     text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create trigger job_sources_set_updated_at
  before update on public.job_sources
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- jobs
-- -----------------------------------------------------------------------------
-- `fingerprint` is a stored generated column so deduplication is enforced by
-- the database itself and cannot drift between code paths.

create table if not exists public.jobs (
  id               uuid primary key default gen_random_uuid(),
  title            text not null check (char_length(title) between 2 and 200),
  company_name     text not null check (char_length(company_name) between 1 and 160),
  description      text check (char_length(description) <= 20000),
  location         text,
  work_mode        public.work_mode,
  employment_type  public.employment_type,
  seniority        public.seniority,
  salary_min       integer check (salary_min >= 0),
  salary_max       integer check (salary_max >= 0),
  currency         text,
  required_skills  text[] not null default '{}',
  preferred_skills text[] not null default '{}',
  experience_years numeric(4, 1) check (experience_years >= 0),
  source_name      text,
  source_url       text,
  source_type      public.job_origin not null default 'platform',
  external_id      text,
  published_at     timestamptz,
  expires_at       timestamptz,
  status           public.job_status not null default 'published',
  is_sample        boolean not null default false,
  created_by       uuid references auth.users (id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  fingerprint      text generated always as (
                     md5(
                       lower(btrim(title)) || '|' ||
                       lower(btrim(company_name)) || '|' ||
                       lower(coalesce(btrim(location), ''))
                     )
                   ) stored,
  constraint jobs_salary_range check (
    salary_min is null or salary_max is null or salary_max >= salary_min
  )
);

create trigger jobs_set_updated_at
  before update on public.jobs
  for each row execute function public.set_updated_at();

-- Deduplication: identical title + company + location can only exist once.
create unique index if not exists jobs_fingerprint_key
  on public.jobs (fingerprint);

-- Deduplication of an imported listing against its upstream identifier.
create unique index if not exists jobs_source_external_key
  on public.jobs (source_name, external_id)
  where external_id is not null;

create index if not exists jobs_status_published_idx
  on public.jobs (status, published_at desc nulls last);

create index if not exists jobs_company_idx on public.jobs (lower(company_name));
create index if not exists jobs_location_idx on public.jobs (lower(location));
create index if not exists jobs_work_mode_idx on public.jobs (work_mode);
create index if not exists jobs_employment_type_idx on public.jobs (employment_type);

create index if not exists jobs_search_idx on public.jobs using gin (
  to_tsvector(
    'simple',
    coalesce(title, '') || ' ' || coalesce(company_name, '') || ' ' ||
    coalesce(description, '')
  )
);

-- -----------------------------------------------------------------------------
-- saved_jobs
-- -----------------------------------------------------------------------------

create table if not exists public.saved_jobs (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  job_id     uuid not null references public.jobs (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, job_id)
);

create index if not exists saved_jobs_user_idx on public.saved_jobs (user_id, created_at desc);

-- -----------------------------------------------------------------------------
-- applications — the user's own tracker
-- -----------------------------------------------------------------------------
-- `job_id` is nullable on purpose: users track external opportunities that are
-- not in the catalogue.

create table if not exists public.applications (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,
  job_id       uuid references public.jobs (id) on delete set null,
  company_name text not null check (char_length(company_name) between 1 and 160),
  job_title    text not null check (char_length(job_title) between 1 and 200),
  status       public.application_status not null default 'interested',
  applied_at   timestamptz,
  follow_up_at timestamptz,
  interview_at timestamptz,
  source_url   text,
  notes        text check (char_length(notes) <= 20000),
  salary_min   integer check (salary_min >= 0),
  salary_max   integer check (salary_max >= 0),
  currency     text,
  history      jsonb not null default '[]'::jsonb,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create trigger applications_set_updated_at
  before update on public.applications
  for each row execute function public.set_updated_at();

create index if not exists applications_user_status_idx
  on public.applications (user_id, status);
create index if not exists applications_user_updated_idx
  on public.applications (user_id, updated_at desc);
create index if not exists applications_job_idx on public.applications (job_id);

-- -----------------------------------------------------------------------------
-- cv_profiles — private by design
-- -----------------------------------------------------------------------------
-- `original_file_path` points at a PRIVATE storage bucket. Files are never
-- publicly readable; short-lived signed URLs are issued on demand.

create table if not exists public.cv_profiles (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references auth.users (id) on delete cascade,
  name               text not null default 'CV principal',
  template           text not null default 'classic',
  structured_content jsonb not null default '{}'::jsonb,
  source_text        text check (char_length(source_text) <= 200000),
  original_file_path text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create trigger cv_profiles_set_updated_at
  before update on public.cv_profiles
  for each row execute function public.set_updated_at();

create index if not exists cv_profiles_user_idx on public.cv_profiles (user_id, updated_at desc);

-- -----------------------------------------------------------------------------
-- AI conversations and messages
-- -----------------------------------------------------------------------------

create table if not exists public.ai_conversations (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  title      text not null default 'Nouvelle conversation'
               check (char_length(title) between 1 and 200),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger ai_conversations_set_updated_at
  before update on public.ai_conversations
  for each row execute function public.set_updated_at();

create index if not exists ai_conversations_user_idx
  on public.ai_conversations (user_id, updated_at desc);

create table if not exists public.ai_messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.ai_conversations (id) on delete cascade,
  user_id         uuid not null references auth.users (id) on delete cascade,
  role            text not null check (role in ('user', 'assistant', 'system', 'tool')),
  content         text not null check (char_length(content) <= 60000),
  metadata        jsonb,
  created_at      timestamptz not null default now()
);

create index if not exists ai_messages_conversation_idx
  on public.ai_messages (conversation_id, created_at);

-- -----------------------------------------------------------------------------
-- Operational telemetry
-- -----------------------------------------------------------------------------
-- Deliberately *not* containing prompt text, CV text or any personal content.

create table if not exists public.ai_usage_logs (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users (id) on delete set null,
  provider    text,
  model       text,
  feature     text not null,
  status      public.ai_usage_status not null,
  duration_ms integer check (duration_ms >= 0),
  error_code  text,
  created_at  timestamptz not null default now()
);

create index if not exists ai_usage_logs_created_idx on public.ai_usage_logs (created_at desc);
create index if not exists ai_usage_logs_user_idx on public.ai_usage_logs (user_id, created_at desc);

create table if not exists public.admin_audit_logs (
  id          uuid primary key default gen_random_uuid(),
  actor_id    uuid references auth.users (id) on delete set null,
  action      text not null,
  entity_type text not null,
  entity_id   text,
  summary     text not null,
  metadata    jsonb,
  created_at  timestamptz not null default now()
);

create index if not exists admin_audit_logs_created_idx
  on public.admin_audit_logs (created_at desc);

create table if not exists public.job_import_batches (
  id          uuid primary key default gen_random_uuid(),
  created_by  uuid references auth.users (id) on delete set null,
  source_id   uuid references public.job_sources (id) on delete set null,
  source_name text not null,
  format      text not null check (format in ('csv', 'json', 'paste', 'url')),
  total_rows  integer not null default 0,
  inserted    integer not null default 0,
  updated     integer not null default 0,
  duplicates  integer not null default 0,
  failed      integer not null default 0,
  errors      jsonb not null default '[]'::jsonb,
  created_at  timestamptz not null default now()
);

create index if not exists job_import_batches_created_idx
  on public.job_import_batches (created_at desc);

-- -----------------------------------------------------------------------------
-- learning_goals — the AI career roadmap, editable by its owner
-- -----------------------------------------------------------------------------

create table if not exists public.learning_goals (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  title       text not null check (char_length(title) between 2 and 200),
  description text check (char_length(description) <= 4000),
  skill_name  text,
  week_number smallint check (week_number between 1 and 104),
  target_date date,
  status      public.goal_status not null default 'todo',
  difficulty  public.difficulty_level,
  resources   jsonb not null default '[]'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger learning_goals_set_updated_at
  before update on public.learning_goals
  for each row execute function public.set_updated_at();

create index if not exists learning_goals_user_idx
  on public.learning_goals (user_id, week_number);

-- -----------------------------------------------------------------------------
-- Sign-up automation
-- -----------------------------------------------------------------------------
-- Every new auth user immediately receives a profile row and the `candidate`
-- role. The role is hard-coded here, which is what makes it impossible to
-- self-register as an administrator.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (
    new.id,
    nullif(btrim(coalesce(new.raw_user_meta_data ->> 'full_name', '')), '')
  )
  on conflict (id) do nothing;

  insert into public.user_roles (user_id, role)
  values (new.id, 'candidate')
  on conflict (user_id, role) do nothing;

  insert into public.candidate_preferences (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
