User Roles and Permissions — TakeItEsee

Principles
- Every account retains Customer capability. If the account becomes a Provider, it may own exactly ONE final Provider identity: Professional OR Business, never both.
- A pending Provider application may be withdrawn before approval, but once a Provider application is approved its Provider type and ownership are final and cannot be switched through normal product flows.
- Admin / Super Admin authorization is a separate platform-governance capability and does not create a second Provider identity.
- A professional user has one master `professional_profiles` identity and can have multiple child `professional_roles` / talents under that identity.
- Role assignments may be scoped (e.g., a user is `manager` for a specific `business`).
- Permission checks should be RBAC (role-based) with optional ACL for scoped resources.

Primary roles

1) Visitor
- Unauthenticated user browsing marketing pages.
- Can view public content and search results (subject to visibility rules).
- Can read public professional/business profiles and public requirements.
- For professional talents, public visibility is limited to active roles whose parent professional identity is verified.
- Structured professional career/resume details are visible only when the professional explicitly enables public resume visibility and the master professional identity is verified.

2) Customer
- Basic authenticated user who can post requirements, contact professionals, save favorites, and leave reviews as an author.
- Customer capability remains available when the same account has one approved Provider identity.
- Permissions:
  - Create/Update/Delete own requirements
  - View proposals or contact professionals
  - Rate & review professionals/services/businesses
  - Manage wallet/payment methods (future)

3) Professional
- A user offering services and/or presenting a professional identity for earning and career opportunities.
- Professional is one of the two mutually exclusive Provider identity types. An approved Professional account cannot also own or later switch to a Business Provider identity through normal product flows.
- Owns exactly one master `professional_profiles` row for identity, verification, headline, description, and primary service area.
- May create multiple child `professional_roles` representing distinct talents, for example Web Developer, Designer, Network Technician, Acting Driver, or Tuition Teacher.
- Each child role can independently express whether the professional is currently open to service bookings, freelance, part-time, full-time, or contract opportunities.
- May maintain one structured career/resume profile under the same master identity, with work experience, education, certifications, skills, career availability and privacy controls.
- Permissions:
  - Update the owned master professional profile
  - Create/Update/Delete owned professional roles/talents
  - Create/Update/Delete owned career/resume data
  - Keep resume data private by default and explicitly publish it when ready
  - Publish/Manage services
  - Respond to requirements and send proposals
  - Manage bookings and availability
  - View reviews and ratings
- Verification belongs to the master professional identity. Paid subscription or future visibility boosts must not automatically grant verification.
- Publishing a career profile does not mean TakeItEsee independently verified employment, education or certification claims unless a separate verification status is explicitly shown.

4) Business
- Organization Provider identity representing a company or group.
- Business is the other mutually exclusive Provider identity type. An approved Business account cannot also own or later switch to a Professional Provider identity through normal product flows.
- May have multiple staff members with scoped role assignments (manager, staff); staff membership does not give the owner a second Provider identity.
- Permissions:
  - Manage business profile, services, and staff role assignments
  - View analytics for the business
  - Invite/assign staff and set permissions (scope)
- Business profile behavior is separate from the individual professional multi-skill and resume model unless a later product requirement explicitly connects them.
- Employer hiring, job posting and applicant-management workflows are separate future capabilities and are not implied by the professional resume profile.

5) Admin
- Platform-operator role for delegated marketplace operations and moderation.
- Permissions depend on delegated scope and may include:
  - Moderation, user/provider operations, and content takedown
  - Operational dashboards and permitted audit visibility
  - Delegated actions allowed by Admin RBAC/ACL
- Admin authorization does not weaken Provider identity finality.

Professional identity model
- `professional_profiles` is the single master identity for one professional user.
- `professional_roles` is one-to-many from `professional_profiles` and stores role/talent-specific presentation and opportunity preferences.
- `professional_career_profiles` is at most one structured resume/career summary per master professional identity.
- `professional_experiences`, `professional_education`, `professional_certifications`, and `professional_skills` are professional-owned child records under that same identity.
- Career data is private by default. Public career reads require both `public_resume_enabled=true` and a verified parent professional identity.
- A professional does not create multiple master identities merely because they have multiple talents, services, portfolio samples, or career records.
- Portfolio/media, resume, future job-opportunity, subscription, analytics, and search-boost features extend this master-identity + child-data model rather than duplicating provider accounts.
- Public professional discovery must preserve verification, active-state, privacy, marketplace trust and explicit publication boundaries.

Provider identity finality
- Customer capability is universal; Provider identity is optional.
- An account may finalize exactly one Provider identity: `professional_profiles` OR an owned `businesses` identity.
- Approved `provider_applications` are the durable finality record for Provider type and ownership.
- Deleting or recreating a Provider profile must never become a path to switch Provider type.
- Professional and Business offerings remain searchable together through the unified marketplace even though their Provider identities are mutually exclusive per account.

Availability model boundaries
- Provider live work mode (`available`, `busy`, `offline`, `paused`) is Provider-level operational state.
- `service_availability`, weekly windows, and blackouts remain per-service booking/scheduling state.
- Future Business shop open/closed or operating-hours state is a separate Business operational signal and must not be treated as identical to service availability or Provider live work mode.

Role assignment model
- Use `role_assignments` table with columns: `user_id`, `role`, `scope_type`, `scope_id`, `active`, `granted_by`, `granted_at`.
- Provider role assignments must never authorize one account to own both Provider identity types.
- Business staff/manager scope is membership in a Business identity and is distinct from owning a second Provider identity.

Permission evaluation
- Centralize permission checks in a policy layer or service.
- Combine role checks and resource-level ACLs. Example: to edit a `business`, require the appropriate scoped business membership/ownership permission, OR an authorized platform operator capability.
- Professional role, portfolio and career mutations must resolve ownership through the parent master professional profile; clients must not be allowed to choose another professional identity as the mutation owner.
- Provider mutations must preserve the approved Professional-or-Business finality invariant.

Impersonation & audit
- Admin/Super Admin impersonation, if supported, must require explicit logging and an approval process.
- Every platform role or delegated permission change must be audited.
