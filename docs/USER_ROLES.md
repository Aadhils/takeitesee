User Roles and Permissions — TakeItEsee

Principles
- One user account can hold multiple roles simultaneously (customer, professional, business owner, admin).
- Role assignments may be scoped (e.g., a user is `manager` for a specific `business`).
- Permission checks should be RBAC (role-based) with optional ACL for scoped resources.

Primary roles

1) Visitor
- Unauthenticated user browsing marketing pages.
- Can view public content and search results (subject to visibility rules).
- Can read public professional/business profiles and public requirements.

2) Customer
- Basic authenticated user who can post requirements, contact professionals, save favorites, and leave reviews as an author.
- Permissions:
  - Create/Update/Delete own requirements
  - View proposals or contact professionals
  - Rate & review professionals/services/businesses
  - Manage wallet/payment methods (future)

3) Professional
- A user offering services. Can have one or multiple `professional_profiles`.
- Permissions:
  - Create/Update professional_profile(s)
  - Publish/Manage services
  - Respond to requirements and send proposals
  - Manage bookings and availability
  - View reviews and ratings

4) Business
- Organization account representing a company or group.
- May have multiple staff members with scoped role assignments (manager, staff).
- Permissions:
  - Manage business profile, services, and staff role assignments
  - View analytics for the business
  - Invite/assign staff and set permissions (scope)

5) Admin
- Superuser role for platform operators.
- Permissions:
  - Full access to most data for moderation, user management, content takedown
  - Access to audit logs and operations dashboards
  - Can assign/revoke roles

Role assignment model
- Use `role_assignments` table with columns: `user_id`, `role`, `scope_type`, `scope_id`, `active`, `granted_by`, `granted_at`.
- Example entries:
  - (user_1, 'customer', null, null)  => basic customer
  - (user_2, 'professional', null, null) => professional
  - (user_3, 'business', 'business', business_1_id) => manager for business_1

Permission evaluation
- Centralize permission checks in a policy layer or service.
- Combine role checks and resource-level ACLs. Example: to edit a `business`, require role `business` with scope_id equal to the target business id, OR `admin`.

Impersonation & audit
- Admin may have an impersonation workflow but require explicit logging and an approval process.
- Every role change must be audited (store in `audits` table).
