-- Privacy hardening: disclosure-complete Provider rows remain public, but anonymous
-- callers should only be able to select marketplace-facing Provider columns.
-- Internal account linkage and audit timestamps stay unavailable to anon.
-- Authenticated Provider/Admin access is intentionally unchanged.

revoke select on table public.professional_profiles from anon;
grant select (
  id,
  headline,
  description,
  service_area,
  verified,
  legal_name,
  principal_address,
  public_contact_email,
  public_contact_phone,
  website_url,
  grievance_officer_name,
  grievance_officer_designation,
  grievance_email,
  grievance_phone
) on table public.professional_profiles to anon;

revoke select on table public.businesses from anon;
grant select (
  id,
  name,
  description,
  location,
  verified,
  legal_name,
  principal_address,
  public_contact_email,
  public_contact_phone,
  website_url,
  grievance_officer_name,
  grievance_officer_designation,
  grievance_email,
  grievance_phone
) on table public.businesses to anon;
