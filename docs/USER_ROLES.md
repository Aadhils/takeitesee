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
- Permissions:
  - Update the owned master professional profile
  - Create/Update/Delete owned professional roles/talents
  - Publish/Manage services
  - Respond to requirements and send proposals
  - Manage bookings and availability
  - View reviews and ratings
- Verification belongs to the master professional identity. Paid subscription or future visibility boosts must not automatically grant verification.

4) Business
- Organization account representing a company or group.
- May have multiple staff members with scoped role assignments (manager, staff).
- Permissions:
  - Manage business profile, services, and staff role assignments
  - View analytics for the business
  - Invite/assign staff and set permissions (scope)
- Business profile behavior is separate from the individual professional multi-skill model unless a later product requirement explicitly connects them.

5) Admin
- Superuser role for platform operators.
- Permissions:
  - Full access to most data for moderation, user management, content takedown
  - Access to audit logs and operations dashboards
  - Can assign/revoke roles

Professional identity model
- `professional_profiles` is the single master identity for one professional user.
- `professional_roles` is one-to-many from `professional_profiles` and stores role/talent-specific presentation and opportunity preferences.
- A professional does not create multiple master identities merely because they have multiple talents.
- Future portfolio/media, resume, job-opportunity, subscription, analytics, and search-boost features should extend this master-identity + child-role model rather than duplicating provider accounts.
- Public professional-role discovery must preserve verification, active-state, privacy, and marketplace trust boundaries.

Role assignment model
- Use `role_assignments` table with columns: `user_id`, `role`, `scope_type`, `scope_id`, `active`, `granted_by`, `granted_at`.
- Example entries:
  - (user_1, 'customer', null, null) => basic customer
  - (user_2, 'professional', null, null) => professional
  - (user_3, 'business', 'business', business_1_id) => manager for business_1

Permission evaluation
- Centralize permission checks in a policy layer or service.
- Combine role checks and resource-level ACLs. Example: to edit a `business`, require role `business` with scope_id equal to the target business id, OR `admin`.
- Professional role mutations must resolve ownership through the parent master professional profile; clients must not be allowed to choose another professional identity as the mutation owner.

Impersonation & audit
- Admin may have an impersonation workflow but require explicit logging and an approval process.
- Every platform role change must be audited (store in `audits` table).
