-- =============================================================================
-- CareerPilot — 0002 · Row Level Security
-- =============================================================================
-- Principle: deny by default. RLS is enabled on every table and a policy is
-- added only where a legitimate, scoped access path exists.
--
-- Two invariants are worth calling out explicitly:
--
--  1. `user_roles` has NO insert/update/delete policy at all. A client cannot
--     grant itself a single role, no matter what it sends. Role changes require
--     the service-role key and are audited.
--
--  2. Administrators do NOT get blanket access to private candidate data.
--     There is no policy letting an administrator read `cv_profiles`,
--     `ai_conversations` or `ai_messages`. Administrators manage the platform
--     (catalogue, sources, accounts, telemetry), not people's private lives.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Role helpers
-- -----------------------------------------------------------------------------
-- SECURITY DEFINER is required: a policy on `user_roles` that queried
-- `user_roles` through RLS would recurse infinitely. These functions run with the
-- definer's rights and only ever answer a boolean.

create or replace function public.has_role(uid uuid, role_name public.app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles ur
    where ur.user_id = uid
      and ur.role = role_name
  );
$$;

create or replace function public.is_admin(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.has_role(uid, 'admin');
$$;

revoke all on function public.has_role(uuid, public.app_role) from public;
revoke all on function public.is_admin(uuid) from public;
grant execute on function public.has_role(uuid, public.app_role) to anon, authenticated;
grant execute on function public.is_admin(uuid) to anon, authenticated;

-- -----------------------------------------------------------------------------
-- Enable RLS everywhere
-- -----------------------------------------------------------------------------

alter table public.profiles              enable row level security;
alter table public.user_roles            enable row level security;
alter table public.candidate_preferences enable row level security;
alter table public.skills                enable row level security;
alter table public.candidate_skills      enable row level security;
alter table public.job_sources           enable row level security;
alter table public.jobs                  enable row level security;
alter table public.saved_jobs            enable row level security;
alter table public.applications          enable row level security;
alter table public.cv_profiles           enable row level security;
alter table public.ai_conversations      enable row level security;
alter table public.ai_messages           enable row level security;
alter table public.ai_usage_logs         enable row level security;
alter table public.admin_audit_logs      enable row level security;
alter table public.job_import_batches    enable row level security;
alter table public.learning_goals        enable row level security;

-- -----------------------------------------------------------------------------
-- profiles
-- -----------------------------------------------------------------------------

drop policy if exists profiles_select_own_or_admin on public.profiles;
create policy profiles_select_own_or_admin
  on public.profiles for select
  to authenticated
  using (id = (select auth.uid()) or public.is_admin((select auth.uid())));

drop policy if exists profiles_insert_self on public.profiles;
create policy profiles_insert_self
  on public.profiles for insert
  to authenticated
  with check (id = (select auth.uid()));

-- A user may edit only their own profile row, and the row must still be theirs
-- after the update. There is no update policy for administrators: platform-level
-- account handling goes through the audited service-role path.
drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self
  on public.profiles for update
  to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- -----------------------------------------------------------------------------
-- user_roles — read your own roles; writes are impossible from a client
-- -----------------------------------------------------------------------------

drop policy if exists user_roles_select_own_or_admin on public.user_roles;
create policy user_roles_select_own_or_admin
  on public.user_roles for select
  to authenticated
  using (user_id = (select auth.uid()) or public.is_admin((select auth.uid())));

-- Deliberately no INSERT / UPDATE / DELETE policies.
-- See `scripts/create-admin.mjs` and `src/lib/admin/roles.ts`.

-- -----------------------------------------------------------------------------
-- candidate_preferences — strictly private
-- -----------------------------------------------------------------------------

drop policy if exists candidate_preferences_all_own on public.candidate_preferences;
create policy candidate_preferences_all_own
  on public.candidate_preferences for all
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- -----------------------------------------------------------------------------
-- skills — a shared, read-only catalogue
-- -----------------------------------------------------------------------------

drop policy if exists skills_select_all on public.skills;
create policy skills_select_all
  on public.skills for select
  to anon, authenticated
  using (true);

-- No write policy: the catalogue is seeded by migrations and extended by the
-- service-role import path only, so it stays curated.

-- -----------------------------------------------------------------------------
-- candidate_skills — strictly private
-- -----------------------------------------------------------------------------

drop policy if exists candidate_skills_all_own on public.candidate_skills;
create policy candidate_skills_all_own
  on public.candidate_skills for all
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- -----------------------------------------------------------------------------
-- job_sources — administrators only
-- -----------------------------------------------------------------------------

drop policy if exists job_sources_admin_all on public.job_sources;
create policy job_sources_admin_all
  on public.job_sources for all
  to authenticated
  using (public.is_admin((select auth.uid())))
  with check (public.is_admin((select auth.uid())));

-- -----------------------------------------------------------------------------
-- jobs — published listings are public; only administrators may mutate
-- -----------------------------------------------------------------------------

drop policy if exists jobs_select_published on public.jobs;
create policy jobs_select_published
  on public.jobs for select
  to anon, authenticated
  using (
    status = 'published'
    and (expires_at is null or expires_at > now())
  );

-- Administrators additionally see drafts and expired rows.
drop policy if exists jobs_select_admin on public.jobs;
create policy jobs_select_admin
  on public.jobs for select
  to authenticated
  using (public.is_admin((select auth.uid())));

drop policy if exists jobs_insert_admin on public.jobs;
create policy jobs_insert_admin
  on public.jobs for insert
  to authenticated
  with check (public.is_admin((select auth.uid())));

drop policy if exists jobs_update_admin on public.jobs;
create policy jobs_update_admin
  on public.jobs for update
  to authenticated
  using (public.is_admin((select auth.uid())))
  with check (public.is_admin((select auth.uid())));

drop policy if exists jobs_delete_admin on public.jobs;
create policy jobs_delete_admin
  on public.jobs for delete
  to authenticated
  using (public.is_admin((select auth.uid())));

-- -----------------------------------------------------------------------------
-- saved_jobs — strictly private
-- -----------------------------------------------------------------------------

drop policy if exists saved_jobs_all_own on public.saved_jobs;
create policy saved_jobs_all_own
  on public.saved_jobs for all
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- -----------------------------------------------------------------------------
-- applications — strictly private
-- -----------------------------------------------------------------------------

drop policy if exists applications_all_own on public.applications;
create policy applications_all_own
  on public.applications for all
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- -----------------------------------------------------------------------------
-- cv_profiles — strictly private. No administrator policy exists.
-- -----------------------------------------------------------------------------

drop policy if exists cv_profiles_all_own on public.cv_profiles;
create policy cv_profiles_all_own
  on public.cv_profiles for all
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- -----------------------------------------------------------------------------
-- ai_conversations / ai_messages — strictly private. No administrator policy.
-- -----------------------------------------------------------------------------

drop policy if exists ai_conversations_all_own on public.ai_conversations;
create policy ai_conversations_all_own
  on public.ai_conversations for all
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists ai_messages_select_own on public.ai_messages;
create policy ai_messages_select_own
  on public.ai_messages for select
  to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists ai_messages_insert_own on public.ai_messages;
create policy ai_messages_insert_own
  on public.ai_messages for insert
  to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.ai_conversations c
      where c.id = conversation_id
        and c.user_id = (select auth.uid())
    )
  );

drop policy if exists ai_messages_delete_own on public.ai_messages;
create policy ai_messages_delete_own
  on public.ai_messages for delete
  to authenticated
  using (user_id = (select auth.uid()));

-- -----------------------------------------------------------------------------
-- ai_usage_logs — a user may record, and read, only their own usage
-- -----------------------------------------------------------------------------

drop policy if exists ai_usage_logs_select_own_or_admin on public.ai_usage_logs;
create policy ai_usage_logs_select_own_or_admin
  on public.ai_usage_logs for select
  to authenticated
  using (user_id = (select auth.uid()) or public.is_admin((select auth.uid())));

drop policy if exists ai_usage_logs_insert_own on public.ai_usage_logs;
create policy ai_usage_logs_insert_own
  on public.ai_usage_logs for insert
  to authenticated
  with check (user_id = (select auth.uid()));

-- -----------------------------------------------------------------------------
-- admin_audit_logs — administrators read; administrators append their own
-- -----------------------------------------------------------------------------

drop policy if exists admin_audit_logs_select_admin on public.admin_audit_logs;
create policy admin_audit_logs_select_admin
  on public.admin_audit_logs for select
  to authenticated
  using (public.is_admin((select auth.uid())));

drop policy if exists admin_audit_logs_insert_admin on public.admin_audit_logs;
create policy admin_audit_logs_insert_admin
  on public.admin_audit_logs for insert
  to authenticated
  with check (
    public.is_admin((select auth.uid()))
    and actor_id = (select auth.uid())
  );

-- Audit rows are immutable once written.
-- Deliberately no UPDATE or DELETE policies.

-- -----------------------------------------------------------------------------
-- job_import_batches — administrators only
-- -----------------------------------------------------------------------------

drop policy if exists job_import_batches_admin_all on public.job_import_batches;
create policy job_import_batches_admin_all
  on public.job_import_batches for all
  to authenticated
  using (public.is_admin((select auth.uid())))
  with check (
    public.is_admin((select auth.uid()))
    and created_by = (select auth.uid())
  );

-- -----------------------------------------------------------------------------
-- learning_goals — strictly private
-- -----------------------------------------------------------------------------

drop policy if exists learning_goals_all_own on public.learning_goals;
create policy learning_goals_all_own
  on public.learning_goals for all
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- -----------------------------------------------------------------------------
-- Storage: a private bucket for CV files
-- -----------------------------------------------------------------------------
-- Files are never public. Access is granted through short-lived signed URLs
-- generated on the server, and the object path must start with the owner's id.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'cv-files',
  'cv-files',
  false,
  5242880,
  array[
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain'
  ]
)
on conflict (id) do nothing;

drop policy if exists cv_files_select_own on storage.objects;
create policy cv_files_select_own
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'cv-files'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists cv_files_insert_own on storage.objects;
create policy cv_files_insert_own
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'cv-files'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists cv_files_update_own on storage.objects;
create policy cv_files_update_own
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'cv-files'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists cv_files_delete_own on storage.objects;
create policy cv_files_delete_own
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'cv-files'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
