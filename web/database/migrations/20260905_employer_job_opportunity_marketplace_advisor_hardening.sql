-- Advisor hardening for Employer + Job Opportunity Marketplace Foundation.
-- Cover the optional professional-role foreign key used by job applications.

create index if not exists job_applications_selected_professional_role_id_idx
  on public.job_applications(selected_professional_role_id);
