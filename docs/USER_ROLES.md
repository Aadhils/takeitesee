User Roles and Permissions — TakeItEsee

Principles
- One user account can hold multiple platform roles simultaneously (customer, professional, business owner, admin).
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
- Permissions:
  - Create/Update/Delete own requirements
  - View proposals or contact professionals
  - Rate & review professionals/services/businesses
  - Manage wallet/payment methods (future)

3) Professional
- A user offering services and/or presenting a professional identity for earning and career opportunities.
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
- Organization account representing a company or group.
- May have multiple staff members with scoped role assignments (manager, staff).
- Permissions:
  - Manage business profile, services, and staff role assignments
  - View analytics for the business
  - Invite/assign staff and set permissions (scope)
- Business profile behavior is separate from the individual professional multi-skill and resume model unless a later product requirement explicitly connects them.
- Employer hiring, job posting and applicant-management workflows are separate future capabilities and are not implied by the professional resume profile.

5) Admin
- Superuser role for platform operators.
- Permissions:
  - Full access to most data for moderation, user management, content takedown
  - Access to audit logs and operations dashboards
  - Can assign/revoke roles

Professional identity model
- `professional_profiles` is the single master identity for one professional user.
- `professional_roles` is one-to-many from `professional_profiles` and stores role/talent-specific presentation and opportunity preferences.
- `professional_career_profiles` is at most one structured resume/career summary per master professional identity.
- `professional_experiences`, `professional_education`, `professional_certifications`, and `professional_skills` are professional-owned child records under that same identity.
- Career data is private by default. Public career reads require both `public_resume_enabled=true` and a verified parent professional identity.
- A professional does not create multiple master identities merely because they have multiple talents, services, portfolio samples, or career records.
- Portfolio/media, resume, future job-opportunity, subscription, analytics, and search-boost features extend this master-identity + child-data model rather than duplicating provider accounts.
- Public professional discovery must preserve verification, active-state, privacy, marketplace trust and explicit publication boundaries.

Role assignment model
- Use `role_assignments` table with columns: `user_id`, `role`, `scope_type`, `scope_id`, `active`, `granted_by`, `granted_at`.
- Example entries:
  - (user_1, 'customer', null, null) => basic customer
  - (user_2, 'professional', null, null) => professional
  - (user_3, 'business', 'business', business_1_id) => manager for business_1

Permission evaluation
- Centralize permission checks in a policy layer or service.
- Combine role checks and resource-level ACLs. Example: to edit a `business`, require role `business` with scope_id equal to the target business id, OR `admin`.
- Professional role, portfolio and career mutations must resolve ownership through the parent master professional profile; clients must not be allowed to choose another professional identity as the mutation owner.

Impersonation & audit
- Admin may have an impersonation workflow but require explicit logging and an approval process.
- Every platform role change must be audited (store in `audits` table).
