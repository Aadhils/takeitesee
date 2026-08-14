# TakeItEsee — Phase 6 Implementation Blueprint

WARNING: PLANNING ONLY — This document defines the planned Phase 6 work and must not be implemented as production code or database work at this time.

## 1. Phase 6 Scope

### 1.1 Goal
Phase 6 defines the safe, implementation-ready planning baseline for TakeItEsee after the approved Phase 5 decisions. The focus is to create a blueprint for the marketplace foundation, booking system, financial abstraction layer, and security controls without activating any live services or production workflows.

### 1.2 In Scope for Phase 6
Phase 6 should prepare, in staged and feature-flagged form:
- canonical marketplace schema and shared domain types
- auth and role foundation design
- service catalog and availability model
- requirement posting and booking workflow design
- booking status history and safe transition model
- provider-agnostic payment adapter design
- commission engine design with versioned rules
- ledger, settlement, and reconciliation design
- notification and review foundation
- RLS and server-side authorization design
- audit, security validation, and sandbox test planning

### 1.3 Out of Scope for Phase 6
Phase 6 must not perform or enable:
- real payment processing or live provider activation
- Cashfree activation or live SDK use
- Razorpay activation or real provider connectivity
- live KYC collection or production trust verification
- production analytics vendor activation
- database migrations or DDL execution
- any Supabase project creation or live service connection
- API keys or secret provisioning
- deployment or hosting changes
- modifications to the existing Coming Soon website
- actual Phase 6 implementation beyond planning

### 1.4 Safe Incremental Milestones

6A — Core schema and status contracts
- define canonical data model and shared types
- define status enums and lifecycle invariants
- define append-only financial and audit patterns
- define canonical ownership and role source-of-truth

6B — Auth, session, and role foundation
- define signup, login, logout, password reset, and session handling
- define role assignment model and authorization boundaries
- define policy design and RLS skeleton

6C — Service and catalog foundation
- define categories, services, pricing and locations
- define ownership mapping and publication lifecycle

6D — Booking and workflow foundation
- define requirements, responses, bookings, scheduling, completion, and cancellation
- define status history and safe transitions

6E — Payment adapter foundation
- define provider abstraction, checkout intents, webhook ingestion, and reconciliation contracts
- keep Cashfree as the preferred India-first option without hard-wiring core logic to it

6F — Commission and ledger foundation
- define deterministic commission precedence
- define versioned rule storage and ledger invariants
- define settlement and payout linkage rules

6G — Notifications and reviews
- define notifications, ratings, and review lifecycle models
- define event-driven message flows

6H — Security, RLS, and privacy validation
- validate access rules, webhook integrity, file handling, and audit coverage
- validate data minimization and privacy separation

6I — Testing and staging readiness
- define unit, integration, RLS, webhook, payment sandbox, commission, and workflow tests
- define feature-flag and staging checklists

---

## 2. Canonical Ownership and Role Model

### 2.1 Canonical design principle
TakeItEsee must have exactly one authoritative ownership and role model.

The authoritative source of truth is:
- `users` for the account identity
- `user_profiles` for public/shared profile metadata
- `role_assignments` for user role and scope
- `professional_profiles` for professional identity
- `businesses` for business identity
- `business_staff` for business membership and scoped staff roles

No competing ownership or role tables may be used as authoritative sources for the same decision.

### 2.2 Canonical ownership model

#### Users
- Every human/account holder is represented once in `users`.
- A single `users` row may hold multiple roles through `role_assignments`.

#### Customer identity
- Customer status is represented by role assignment, not by duplicated customer tables with conflicting status logic.
- `customer_profiles` is a profile extension only, not the source of truth for authorization.

#### Professional identity
- Professional identity is represented by `professional_profiles` linked to `users`.
- Professional authorization is derived from `role_assignments` with role = `professional` and scope = `user` or `professional_profile` as applicable.
- Provider business relationship is separate from professional identity and must not be conflated.

#### Business identity
- A business is represented by `businesses`.
- Business ownership and management are represented in `role_assignments` and `business_staff`.
- `businesses.owner_user_id` is metadata and operational convenience only; the security boundary remains role assignment and business membership.

#### Business staff membership
- `business_staff` binds a user to a business with a specific role and scoped permissions.
- `role_assignments` remains authoritative for role and scope.
- `business_staff` provides business-specific membership context and must not override `role_assignments`.

### 2.3 Canonical verification model
Payment eligibility and platform trust are separate and must never be conflated.

#### Payment eligibility
Canonical source of truth:
- `payment_eligibility_status` table

Business purpose:
- states whether a user or business is allowed to receive or route payments through a provider, subject to onboarding and legal/compliance approval.

#### Platform trust verification
Canonical source of truth:
- `trust_verification_records` table

Business purpose:
- states whether the platform has verified the user, business, or professional profile as trusted for marketplace operations.

Important rule:
- verification evidence is stored separately from current operational status
- status changes are recorded in append-only audit history
- no duplicate status fields on `professional_profiles` or `businesses` are used as operational source of truth

---

## 3. Service Ownership and Listing Authorization

### 3.1 Ownership strategy
The ambiguous pattern of `professional_id or business_id` is not allowed.

TakeItEsee will use one enforceable model:
- `services` is a canonical listing table
- `service_ownership` is used to bind a service to exactly one owning entity
- `service_ownership.owner_type` is constrained to `professional` or `business`
- `service_ownership.owner_id` is validated against the correct related table

Recommended enforcement pattern:
- `professional_service_ownership` for professional-owned services
- `business_service_ownership` for business-owned services
- each service has exactly one membership row in one of these tables
- no service row may exist without exactly one valid ownership mapping

This avoids unsafe dual ownership and prevents conflicting permissions.

### 3.2 Authorization rules for services

#### Create service listing
Allowed only when:
- the actor has a valid professional or business role assignment
- the actor is an active owner or authorized manager for the target entity
- the entity is active and has the required trust/payment eligibility status for listing publication where applicable

#### Edit service listing
Allowed only when:
- the actor is the owner or delegated manager for the owning entity
- the service is not archived or suspended by admin
- the actor has relevant permission in `role_assignments` or `business_staff`

#### Publish service listing
Allowed only when:
- service is in draft or paused state
- owner is authorized
- any required trust or business verification requirements are satisfied
- feature flags allow listing publication

#### Disable service listing
Allowed when:
- owner disables it
- admin suspends it for moderation or compliance
- temporary pause is allowed for onboarding or maintenance

#### Delete service listing
Allowed only when:
- owner or admin deletes it with an audit trail
- soft delete is preferred for operational history and review; hard delete is restricted to admin and system operations only

### 3.3 Service lifecycle states
- draft
- active
- paused
- archived
- suspended
- deleted

---

## 4. Proposed Database Model

### 4.1 Design principles
- Postgres is the canonical system of record
- Use UUID primary keys
- Use explicit status enums and CHECK constraints
- Use append-only financial and audit records
- Use `created_at`, `updated_at`, and `deleted_at` where appropriate
- Use soft delete for historical records rather than hard deletes where business continuity matters
- Keep provider-specific metadata in JSONB and in a provider adapter contract, not as core-domain assumptions
- Deny by default in RLS

### 4.2 Canonical tables

#### `users`
Purpose:
- canonical account record

Important columns:
- id
- email
- phone
- auth_provider
- status
- email_verified
- phone_verified
- preferred_locale
- content_locale
- created_at
- updated_at
- deleted_at
- last_login_at

Relationships:
- one-to-one with `user_profiles`
- one-to-many with `role_assignments`
- one-to-many with `notifications`
- one-to-many with `audit_logs`

Indexes:
- unique(email) where not deleted
- unique(phone) where not deleted
- index(status)

#### `user_profiles`
Purpose:
- shared profile metadata

Important columns:
- id
- user_id
- display_name
- avatar_url
- bio
- locale_preference
- content_locale
- created_at
- updated_at

Constraints:
- one profile row per user

#### `role_assignments`
Purpose:
- authoritative RBAC and scope model

Important columns:
- id
- user_id
- role
- scope_type
- scope_id
- granted_by
- granted_at
- revoked_at
- is_active

Key rule:
- This is the authoritative source for user role and scope.

Indexes:
- idx_role_assignments_user_role
- idx_role_assignments_scope
- unique(user_id, role, scope_type, scope_id, is_active) where is_active = true

#### `customer_profiles`
Purpose:
- customer-specific metadata

Important columns:
- id
- user_id
- preferred_service_regions
- default_address_id
- created_at
- updated_at

#### `professional_profiles`
Purpose:
- professional identity and operating profile

Important columns:
- id
- user_id
- headline
- summary
- experience_years
- service_radius_km
- availability_mode
- status
- created_at
- updated_at

Constraints:
- one active professional profile per user for default operating context
- no status field is treated as a source of truth for payment eligibility or trust verification

#### `businesses`
Purpose:
- business identity and operational profile

Important columns:
- id
- owner_user_id
- business_name
- legal_name
- business_type
- gstin
- registration_number
- status
- created_at
- updated_at
- deleted_at

#### `business_staff`
Purpose:
- explicit business membership and scoped staff permissions

Important columns:
- id
- business_id
- user_id
- staff_role
- status
- invited_by
- joined_at
- created_at
- updated_at

Unique rule:
- one active membership per user per business

#### `categories`
Purpose:
- service taxonomy

Important columns:
- id
- name
- slug
- parent_category_id
- locale
- is_active
- sort_order
- created_at

#### `services`
Purpose:
- service catalog records

Important columns:
- id
- category_id
- service_name
- slug
- description
- currency
- base_price
- pricing_model
- duration_minutes
- status
- is_published
- created_at
- updated_at
- deleted_at

Ownership binding:
- service ownership is defined in `professional_service_ownership` or `business_service_ownership` and must be exactly one mapping row per service

#### `professional_service_ownership`
Purpose:
- service ownership mapping for professional-owned services

Important columns:
- id
- service_id
- professional_id
- created_at

Rules:
- unique(service_id)
- professional_id must reference `professional_profiles.id`

#### `business_service_ownership`
Purpose:
- service ownership mapping for business-owned services

Important columns:
- id
- service_id
- business_id
- created_at

Rules:
- unique(service_id)
- business_id must reference `businesses.id`

#### `addresses`
Purpose:
- customer, professional, and business addresses

Important columns:
- id
- owner_type
- owner_id
- address_type
- label
- line1
- line2
- city
- state
- postal_code
- country
- latitude
- longitude
- is_primary
- created_at

Constraint rule:
- owner_type must be a validated enum and owner_id must be checked against the matching table in server-side logic

#### `requirements`
Purpose:
- customer posted service request

Important columns:
- id
- customer_id
- category_id
- title
- description
- budget_min
- budget_max
- currency
- location_id
- status
- created_at
- updated_at

#### `responses`
Purpose:
- provider response to a requirement

Important columns:
- id
- requirement_id
- owner_type
- owner_id
- message
- proposed_price
- currency
- status
- created_at
- updated_at

#### `bookings`
Purpose:
- finalized service order or booking

Important columns:
- id
- customer_id
- service_id
- requirement_id
- provider_owner_type
- provider_owner_id
- booking_reference
- status
- subtotal_amount
- currency
- tax_amount
- platform_fee_amount
- provider_payout_amount
- scheduled_start_at
- scheduled_end_at
- created_at
- updated_at
- completed_at
- cancelled_at

Constraints:
- booking_reference unique
- payment state and booking state must be validated by transition rules

#### `booking_status_history`
Purpose:
- append-only booking lifecycle timeline

Important columns:
- id
- booking_id
- previous_status
- new_status
- changed_by_user_id
- reason_code
- notes
- created_at

Rule:
- append-only; no updates to historical rows

#### `payment_providers`
Purpose:
- provider catalog configuration metadata

Important columns:
- id
- code
- name
- is_active
- is_default
- settlement_model
- country_code
- supported_currencies
- config_version
- created_at

#### `payment_records`
Purpose:
- canonical payment lifecycle record and source of truth for payment state

Important columns:
- id
- booking_id
- customer_id
- provider_id
- provider_payment_id
- payment_method_type
- gross_amount
- currency
- status
- initiated_at
- captured_at
- failed_at
- created_at
- updated_at
- idempotency_key

Rules:
- status is the canonical payment lifecycle state
- no direct financial movement without a related ledger entry
- provider_payment_id unique per provider record if present

#### `payment_attempts`
Purpose:
- underlying technical attempts for a payment transaction

Important columns:
- id
- payment_record_id
- attempt_number
- provider_operation
- idempotency_key
- request_hash
- response_code
- status
- error_message
- created_at

Rules:
- unique idempotency key per provider operation
- no duplicate capture/refund/payout attempts allowed

#### `commission_rules`
Purpose:
- base commission policy definition

Important columns:
- id
- name
- rule_type
- scope_type
- scope_id
- category_id
- provider_id
- percentage_rate
- fixed_amount
- tier_definition
- promotional_flag
- effective_from
- effective_to
- status
- created_by
- created_at

#### `commission_rule_versions`
Purpose:
- immutable snapshot of each rule version

Important columns:
- id
- commission_rule_id
- version
- rule_payload
- created_by
- created_at

#### `transaction_commissions`
Purpose:
- selected rule version and computed commission for a transaction

Important columns:
- id
- booking_id
- payment_record_id
- commission_rule_id
- commission_rule_version_id
- calculation_basis
- percentage_rate
- fixed_amount
- computed_amount
- currency
- status
- created_at

Rules:
- the selected commission rule version is captured at processing time and never mutated

#### `provider_settlements`
Purpose:
- provider-managed settlement record

Important columns:
- id
- booking_id
- payment_record_id
- professional_id
- business_id
- provider_id
- gross_amount
- commission_amount
- net_amount
- currency
- status
- provider_settlement_reference
- scheduled_for
- settled_at
- created_at

Rules:
- settlement is derived from approved financial state, not a competing source of truth
- no payout without approved settlement

#### `payout_events`
Purpose:
- payout execution records

Important columns:
- id
- settlement_id
- payout_account_id
- provider_id
- amount
- currency
- status
- provider_payout_reference
- requested_at
- processed_at
- created_at

#### `refunds`
Purpose:
- refund requests and outcomes

Important columns:
- id
- booking_id
- payment_record_id
- requested_by_user_id
- refund_type
- reason_code
- amount
- currency
- status
- policy_version
- approved_by
- created_at
- processed_at

#### `disputes`
Purpose:
- dispute and evidence tracking

Important columns:
- id
- booking_id
- payment_record_id
- raised_by_user_id
- dispute_type
- status
- evidence_reference
- summary
- resolution
- resolved_by
- created_at
- resolved_at

#### `ledger_entries`
Purpose:
- canonical append-only financial history

Important columns:
- id
- booking_id
- payment_record_id
- settlement_id
- payout_event_id
- refund_id
- dispute_id
- entry_type
- direction
- amount
- currency
- balance_before
- balance_after
- actor_user_id
- provider_event_id
- created_at

Rules:
- append-only
- no update/delete of financial history except explicit adjustment entries with reason references
- all financial movements must have a matching ledger entry and direction

#### `webhook_events`
Purpose:
- durable provider webhook log

Important columns:
- id
- provider_id
- provider_event_type
- provider_event_id
- raw_payload
- signature_verified
- processing_status
- idempotency_key
- processed_at
- failure_reason
- created_at

Rules:
- idempotent processing required
- duplicate provider event ID + transaction reference is rejected

#### `notifications`
Purpose:
- user-facing lifecycle messages

Important columns:
- id
- user_id
- notification_type
- title
- body
- target_entity_type
- target_entity_id
- read_at
- delivered_at
- created_at

#### `reviews`
Purpose:
- user review and rating records

Important columns:
- id
- booking_id
- reviewer_user_id
- target_type
- target_id
- rating_score
- review_text
- status
- created_at
- updated_at

#### `payment_eligibility_status`
Purpose:
- canonical status for payment or payout provider eligibility

Important columns:
- id
- entity_type
- entity_id
- provider_id
- status
- checked_at
- expires_at
- reason_code
- created_at

#### `trust_verification_records`
Purpose:
- canonical status for platform trust verification

Important columns:
- id
- entity_type
- entity_id
- verification_type
- status
- evidence_reference
- reviewed_by
- reviewed_at
- notes
- created_at

#### `audit_logs`
Purpose:
- immutable operational and security audit trail

Important columns:
- id
- actor_user_id
- action_type
- resource_type
- resource_id
- old_values
- new_values
- ip_address_hash
- user_agent_hash
- created_at

Rules:
- append-only
- restricted to admin and system service role
- no direct user modification

---

## 5. RLS and Security Matrix

### 5.1 Core RLS rules
- deny by default
- server-side policy functions must validate ownership and business scope
- no client-side role claims may be trusted as authorization truth
- admin and service-role access is narrow and logged
- sensitive financial, payout, KYC, dispute, and audit tables require stricter access than general user data

### 5.2 Role-based access summary

| Table | Customer | Professional / Provider | Business | Admin | Super Admin | Service Role |
| --- | --- | --- | --- | --- | --- | --- |
| payment_records | own payments only | own completed or assigned payment activity only | own business-linked payment activity only | operational read access, no direct mutation | full operational access | internal processing and reconciliation only |
| payment_attempts | own payment attempts only | own payment attempts only | relevant business-linked attempts only | operational review only | full access | internal processing only |
| ledger_entries | no direct access unless explicitly required via booking status | no direct access unless tied to own earnings | no direct access unless tied to own business payments | restricted operational read access | full access | internal ledger writes only |
| provider_settlements | no direct access | own settlement data only | own business settlement data only | review access | full access | internal settlement processing only |
| payout_events | no direct access | own payout events only | own business payout events only | review access | full access | internal payout processing only |
| refunds | own refund record only | own refund records for assigned bookings | own business refund records only | support and review access | full access | internal processing only |
| disputes | own dispute record only | own dispute records only | own business dispute records only | full operational review and resolution access | full access | internal processing and evidence handling |
| webhook_events | no access | no access | no access | restricted admin read access only | full access | internal ingest and verification only |
| audit_logs | no access | no access | no access | restricted operational read access | full access | append-only internal writes only |
| payment_eligibility_status | own status only | own status or provider-linked status only | own business status if applicable | review access | full access | internal onboarding and verification processing only |
| trust_verification_records | own status only where permitted | own verification status only | own business verification status only | review and approval access | full access | internal verification processing only |

### 5.3 Explicit field-level access rules
- `audit_logs` must be append-only and readable only by authorized admins and system processes.
- `webhook_events` must be readable only by system and admin roles; no customer or provider read access.
- `payment_records` and `ledger_entries` are not customer-facing records and must not be exposed directly to end-user UIs.
- `payment_eligibility_status` and `trust_verification_records` must remain separate and must not be readable by unrelated users.
- `payout_events` and `provider_settlements` are restricted to the owning professional/business and authorized admin roles.

### 5.4 Predicate examples
- Ownership predicate: `payment_record.customer_id = auth.uid()`
- Business scope predicate: `EXISTS (SELECT 1 FROM business_staff bs WHERE bs.business_id = target.business_id AND bs.user_id = auth.uid() AND bs.status = 'active')`
- Professional scope predicate: `professional_profiles.user_id = auth.uid()`
- Admin predicate: `EXISTS (SELECT 1 FROM role_assignments ra WHERE ra.user_id = auth.uid() AND ra.role IN ('admin','super_admin') AND ra.is_active = true)`
- Service role: developer-only, never user-facing, and only for internal worker tasks

### 5.5 Admin restrictions
- Admins are not the same as super admins
- Admins may review moderation and operational records but must not directly bypass append-only financial integrity rules or trust-verification controls
- Super admin actions must be logged in `audit_logs` with actor, timestamp, and target metadata

---

## 6. Canonical Financial State and Ledger Invariants

### 6.1 Canonical financial model
TakeItEsee must maintain one system-of-record financial model.

The canonical records are:
- `payment_records` as payment lifecycle source of truth
- `ledger_entries` as append-only financial history and accounting truth
- `provider_settlements` and `payout_events` as settlement and payout execution records, not competing financial sources of truth

### 6.2 Invariants
Every monetary event must satisfy all of the following:
- every payment movement has a ledger entry with direction and amount
- every payout is tied to an approved settlement record
- every commission calculation is attached to a versioned commission rule reference
- every refund or partial refund is attached to a valid payment or partial-payment record
- available balance must never become negative without an explicit explained adjustment entry
- every state transition has a corresponding audit entry and status history log
- provider-specific data is normalized into a standard model before it reaches core domain logic

### 6.3 Financial lifecycle rules
- `payment_records` owns payment lifecycle state
- `ledger_entries` stores the canonical money movement trail
- `provider_settlements` captures provider-managed settlement execution results
- `payout_events` records actual payout execution against the approved settlement
- `refunds` and `disputes` create adjustment ledger entries and settlement adjustments when required

### 6.4 Reconciliation invariants
- provider report totals must reconcile to `ledger_entries` and settlement totals with explicit tolerances and exception handling
- provider webhook duplicates must not create second ledger entries
- manual adjustments must be time-stamped and linked to admin actor or system process
- every reconciliation exception must create an audit event and a reviewable record

### 6.5 Rules to enforce in design
- no payout without approved settlement
- no commission without a versioned commission-rule reference
- no refund without the corresponding payment or partial-payment reference
- no unexplained negative available balance
- no operation that writes a financial state without creating a ledger entry and audit event

---

## 7. Deterministic Commission Engine

### 7.1 Rule objectives
The commission engine must be data-driven, deterministic, and versioned.

It must support:
- percentage commission
- fixed fee commission
- hybrid percentage + fixed fee
- tiered commission
- category-specific commission
- service-specific commission
- provider/professional/business-specific commission
- promotional or temporary rules
- effective-date validation

### 7.2 Rule precedence model
Commission evaluation must always follow the same precedence rules:
1. promotional or temporary override rules
2. service-specific rules
3. category-specific rules
4. provider/professional/business-specific rules
5. global default rules
6. fallback rules if applicable

Within each level:
- earliest valid effective date may be used unless a more specific rule is explicitly marked as override
- explicit rule priority wins over date order
- one final selected rule version must be stored in `transaction_commissions`

### 7.3 Conflict resolution rules
- the engine must define whether rules stack or one rule wins
- any rule combination must be deterministic
- hybrid percentage + fixed rules must be applied in a fixed formula order
- tier rules require explicit tier selection based on the metric used for tiering
- promotional rules must not automatically override business-approved base rules unless the rule design explicitly states override behavior

### 7.4 Required outputs
For every transaction, the system must persist:
- selected rule ID
- selected rule version ID
- calculation basis
- percentage rate
- fixed fee
- computed amount
- currency
- created_at
- audit references

### 7.5 Effective-date and audit rules
- commission rules must be valid only within their effective range
- a historical transaction must always preserve the rule version used at that time
- later rule changes must not retroactively alter earlier commission decisions
- commission adjustments require explicit adjustment records and audit entries

---

## 8. Payment State Machine and Idempotency

### 8.1 Payment lifecycle state machine
Allowed states:
- pending
- initiated
- authorized
- captured
- failed
- partially_refunded
- refunded
- disputed
- settled
- closed

### 8.2 Transition rules

| From | To | Allowed |
| --- | --- | --- |
| pending | initiated | yes |
| initiated | authorized | yes |
| initiated | failed | yes |
| authorized | captured | yes |
| authorized | failed | yes |
| captured | partially_refunded | yes |
| captured | refunded | yes |
| captured | disputed | yes |
| captured | settled | yes |
| partially_refunded | refunded | yes |
| partially_refunded | disputed | yes |
| refunded | closed | yes |
| disputed | resolved or closed | yes |
| settled | closed | yes |

Forbidden patterns:
- `captured -> authorized` is not allowed
- `refunded -> captured` is not allowed
- `failed -> captured` is not allowed
- `settled -> refunded` without explicit adjustment flow is not allowed
- `closed` must not be reopened without admin-controlled exception workflow

### 8.3 Idempotency and duplicate protection
All payment and provider operations require unique idempotency keys.

Required rules:
- unique per provider operation and transaction reference
- webhook deduplication using provider event ID + transaction reference
- duplicate capture, refund, payout, or settlement requests must be rejected or marked duplicate without side effects
- replay-safe provider event processing only writes to a single authoritative state transition

### 8.4 Webhook processing model
- provider signature verification is required before processing
- webhook payloads are stored in `webhook_events` first
- only validated and deduplicated events can mutate payment or settlement states
- if a retry occurs, the system must compare event IDs and reject duplicates
- any webhook that fails validation or processing must be recorded with failure reason and retry metadata

### 8.5 Payment failure handling
- failed payments require explicit reason codes and audit entries
- payment retries must be separate attempt records, not additional hidden state changes
- no payout may follow a failed or unconfirmed payment state

---

## 9. Booking Lifecycle State Machine

### 9.1 Booking lifecycle
The booking lifecycle must be tied to provider action, payment state, and refund/dispute logic.

Recommended statuses:
- draft
- submitted
- pending_provider_acceptance
- accepted
- scheduled
- in_progress
- awaiting_completion
- completed
- payment_pending
- payment_confirmed
- paid
- cancelled
- refunded
- disputed
- closed

### 9.2 Booking transition rules
Allowed transitions:
- draft -> submitted
- submitted -> pending_provider_acceptance
- pending_provider_acceptance -> accepted
- pending_provider_acceptance -> cancelled
- accepted -> scheduled
- scheduled -> in_progress
- in_progress -> awaiting_completion
- awaiting_completion -> completed
- completed -> payment_pending
- payment_pending -> payment_confirmed
- payment_confirmed -> paid
- paid -> refunded only through explicit refund policy evaluation
- paid -> disputed only through explicit dispute workflow
- cancelled -> refunded or closed depending on policy
- refunded -> closed
- disputed -> resolved or closed

Forbidden transitions:
- completed -> scheduled without explicit admin recovery path
- paid -> accepted
- paid -> cancelled without refund policy evaluation
- refunded -> paid
- disputed -> paid

### 9.3 Payment and service completion gates
- a booking cannot enter payment-confirmed state before a valid payment record exists
- a booking cannot be completed if the required provider acceptance and schedule steps are not complete
- a cancellation or service failure may trigger a refund path, but it must not bypass the ledger and audit rules
- a dispute must freeze settlement actions until resolution is recorded

---

## 10. Canonical Verification Model

### 10.1 Canonical principle
TakeItEsee must have a single canonical source of truth for each verification domain.

#### Payment / payout eligibility
Canonical table:
- `payment_eligibility_status`

Purpose:
- provider-specific onboarding and eligibility state

#### Platform trust verification
Canonical table:
- `trust_verification_records`

Purpose:
- platform trust, identity, business, or service verification status

### 10.2 Evidence and status separation
- evidence and review history must be separate from current status summary
- current status must be derived from the latest valid verification record or explicit policy record
- historical review records remain immutable and auditable
- no competing status columns in `professional_profiles` or `businesses` should be used as operational truth

### 10.3 Access rules
- Customers can read only their own verification records where relevant
- Professionals may read their own verification and eligibility status
- Businesses may read their own verification and eligibility status and their staff status only within scope
- Only admins and service-role tasks may read or update sensitive verification actions
- all verification decisions must be written to `audit_logs`

---

## 11. Security Baseline and Additional Safety Controls

### 11.1 Server-side authorization
- all sensitive actions must be validated server-side
- no client acceptance of ownership or role is trusted
- service-side policy functions must resolve role assignments, business membership, and active status

### 11.2 Secrets and credentials
- no secrets in source control
- no live credentials in docs or code
- all external provider credentials remain in environment-managed secret storage only
- provider-specific values must remain outside core domain assumptions and in provider adapter configuration boundaries

### 11.3 Input validation and file handling
- validate all request payloads using strict schemas
- sanitize HTML and rich text before storage
- validate upload type, size, and purpose
- use signed upload URLs or equivalent controlled storage flow
- restrict file access using policy-based storage rules

### 11.4 Webhooks and replay protection
- verify provider signatures before processing
- store raw payloads in `webhook_events`
- deduplicate using provider event ID and transaction reference
- reject invalid or replayed payloads
- all mutated state must be tied to audit entries

### 11.5 Rate limiting and abuse controls
- apply per-user and per-IP rate limiting to sensitive endpoints
- protect login, password reset, checkout init, webhook endpoints, and admin operations differently from public browsing routes
- add threat detection and suspicious-activity logging when required

### 11.6 Logging and privacy
- logs must not store raw payment credentials or KYC documents
- mask or hash direct identifiers in operational logs when possible
- keep raw PII out of analytics systems by default
- use records retention policies for audit, financial, and support data

### 11.7 Admin operation controls
- admin actions are not unrestricted system access
- admin actions must create audit entries
- super admin actions should require explicit approval workflows for high-risk or irreversible operations

### 11.8 Safe defaults for failed or missing provider data
- provider failures must not silently mutate state
- missing provider data should create a reconciliation exception, not a silent success
- system should enter a suspended or pending reconciliation state when provider data is absent or inconsistent

### 11.9 Staging security checklist
Before any live provider or sandbox activation:
- confirm feature flags are disabled
- confirm webhooks are validated
- confirm duplicate event handling is implemented and tested
- confirm RLS policies are reviewed by security owners
- confirm allowed admin/operator scope is correct
- confirm audit logs cover all financial updates
- confirm no secrets are committed

---

## 12. Privacy and Compliance Architecture

### 12.1 Privacy-first approach
TakeItEsee must minimize sensitive information in both product data and operational analytics.

Sensitive data must be isolated and access-controlled:
- KYC evidence and verification records must be separate from operational profile data
- payment details must be kept out of the application layer and handled through provider-managed flows
- analytics events must not include phone, email, address, chat messages, KYC documents, or payment credentials

### 12.2 Business/legal review required
The following items require business, legal, and compliance review, but are not treated as legal approval in this design document:
- final payout policy and compliance requirements for providers
- KYC or verification process requirements for payout recipients and providers
- record retention periods for financial and verification data
- dispute and refund policy differences by region, service, or category
- final analytics data retention and consent posture

### 12.3 Data minimization
- keep only what is required for the transaction or trust process
- separate operational data from evidence and verification artifacts
- mask or hash identifiers in logs and support workflows where possible

---

## 13. Multilingual Architecture

The approved supported UI locales are:
- English (en)
- Tamil (ta)
- Hindi (hi)
- Malayalam (ml)

### 13.1 UI language design
- UI strings must be resolved through a locale key system, not direct hardcoded strings
- the default locale can be English
- locale should be separate from the content locale used for user-generated content

### 13.2 User-generated content language
- user-generated content should carry `content_locale` metadata
- multilingual search and discovery can be implemented later without redesigning the core model
- AI translation remains a future enhancement and is not required in this blueprint

### 13.3 RTL readiness
- UI layouts must be designed using logical directionality patterns
- avoid hardcoded left-to-right assumptions
- allow future additional languages and RTL expansions without rewiring core business models

---

## 14. Scalability and Migration Safety

### 14.1 Keep the first design simple
The initial launch should remain intentionally small and low-risk, while preserving a path to scale.

### 14.2 Scale triggers and migration guidance
The project should avoid premature complexity, but it should prepare for later extension by keeping clean boundaries:
- data access is separated by entity and role
- payment logic is separated behind provider adapters
- settlement and commission logic remain data-driven
- search and realtime can be extracted later without reworking core transaction models

### 14.3 Avoiding unnecessary migration pain
- do not embed provider-specific assumptions into the core financial model
- do not mix role enforcement and business logic in client code
- do not let verification or payout metadata drift into unrelated tables
- keep audit and ledger entries append-only to simplify later reconciliation and compliance review

---

## 15. Testing Strategy

### 15.1 Unit tests
- role evaluation logic
- commission precedence and hybrid calculations
- payment state transitions
- booking state transitions
- locale resolution and content-language separation
- validation and sanitization helpers

### 15.2 Integration tests
- signup and role assignment flows
- requirement creation and response lifecycle
- booking workflow and payment gating
- review lifecycle
- notification dispatch

### 15.3 RLS tests
- customer cannot read other users’ sensitive records
- professional cannot access unrelated business data
- business staff cannot access unrelated business data
- admin and service-role read scope are explicit and validated

### 15.4 Payment sandbox tests
- provider adapter normalization
- successful and failed charges
- duplicate webhook processing
- duplicate capture prevention
- partial refund and dispute accounting logic
- ledger reconciliation tests

### 15.5 Commission tests
- percentage rules
- fixed rules
- hybrid rules
- tiered rules
- category and provider precedence
- promotional overrides
- historical version retention

### 15.6 Workflow tests
- requirement to booking to payment lifecycle
- cancellation and refund path
- dispute path and settlement hold
- review posting after completion

---

## 16. Recommended Phase 6A–6I Order

### 6A — Canonical schema and status contracts
- define ownership and role-source-of-truth rules
- define account, listing, booking, financial, verification, and audit models
- define append-only and soft-delete rules
- define canonical status enums

### 6B — Auth, session, and role foundation
- define signup/login/logout/reset process
- define role assignment and scope rules
- define session protection and verification requirements
- define initial RLS policy skeletons

### 6C — Service and catalog foundation
- define category and service taxonomy
- define service ownership mapping strategy
- define publish/edit/disable/delete rules
- define pricing and availability model

### 6D — Booking and workflow foundation
- define requirement lifecycle and response model
- define booking lifecycle and transition model
- define cancellation and dispute gate relationships

### 6E — Payment adapter foundation
- define provider abstraction and adapter contract
- define payment and webhook processing model
- define duplicate prevention and reconciliation baseline

### 6F — Commission and ledger foundation
- define rule precedence and conflict rules
- define transaction commission and ledger invariants
- define settlement and payout separation rules

### 6G — Notifications and reviews
- define review flow and event-driven notifications
- define lifecycle messaging and user visibility rules

### 6H — Security, RLS, and privacy validation
- validate role scope and sensitive table access
- validate audit log coverage and data minimization
- validate webhook and file upload security

### 6I — Testing, staging, and rollout readiness
- define unit, integration, workflow, RLS, sandbox, and commission tests
- define staging feature-flag gates and readiness checklist

---

## 17. Final Planning Note
This blueprint is intentionally limited to planning and documentation. No migrations, SDK installation, provider activation, secret provisioning, production rollout, or Phase 6 implementation work is authorized from this document.

---

End of Phase 6 Implementation Blueprint (planning only)

Important columns:
- id
- requirement_id
- professional_id or business_id
- message
- proposed_price
- currency
- status
- created_at
- updated_at

Relationships:
- Many-to-one with `requirements`
- Many-to-one with `professional_profiles` / `businesses`

Indexes:
- idx_responses_requirement_status

Lifecycle/status model:
- pending, accepted, rejected, withdrawn

#### 2.2.13 `bookings`
Purpose:
- Finalized service booking or order between customer and provider

Important columns:
- id
- customer_id
- professional_id or business_id
- service_id
- requirement_id
- booking_reference
- status
- subtotal_amount
- currency
- tax_amount
- platform_fee_amount
- provider_payout_amount
- created_at
- scheduled_start_at
- scheduled_end_at
- completed_at
- canceled_at

Relationships:
- Many-to-one with `users` customer
- Many-to-one with `professional_profiles` or businesses
- Many-to-one with `services`
- One-to-many with `booking_status_history`, `payment_records`, `refunds`, `disputes`, `reviews`

Indexes:
- idx_bookings_customer_status
- idx_bookings_provider_status
- idx_bookings_service
- idx_bookings_reference_unique

Uniqueness:
- booking_reference unique

Lifecycle/status model:
- requested, accepted, scheduled, in_progress, completed, cancelled, disputed, refunded, closed

#### 2.2.14 `booking_status_history`
Purpose:
- Append-only status timeline for a booking

Important columns:
- id
- booking_id
- previous_status
- new_status
- changed_by_user_id
- reason_code
- notes
- created_at

Relationships:
- Many-to-one with `bookings`

Indexes:
- idx_booking_status_booking_created

Lifecycle/status model:
- append-only, immutable except soft-delete or admin correction logging

#### 2.2.15 `payment_providers`
Purpose:
- Provider catalog/configuration metadata

Important columns:
- id
- code
- name
- category
- is_active
- is_default
- config_version
- settlement_model
- country_code
- supported_currencies
- created_at

Relationships:
- One-to-many with `payment_records`, `provider_settlements`, `webhook_events`

Unique rules:
- code unique

#### 2.2.16 `payment_records`
Purpose:
- Canonical payment transaction record

Important columns:
- id
- booking_id
- customer_id
- provider_id
- provider_payment_id
- payment_method_type
- gross_amount
- currency
- status
- failure_reason
- provider_status
- initiated_at
- captured_at
- failed_at
- created_at

Relationships:
- Many-to-one with `bookings`
- Many-to-one with `users`
- Many-to-one with `payment_providers`
- One-to-many with `payment_attempts`, `ledger_entries`

Indexes:
- idx_payment_records_customer_status
- idx_payment_records_provider_id
- idx_payment_records_booking
- idx_payment_records_external_ref_unique

Uniqueness:
- provider_payment_id unique per provider where present

Lifecycle/status model:
- pending, authorized, captured, failed, refunded, partially_refunded, disputed, closed

#### 2.2.17 `payment_attempts`
Purpose:
- Financial retry and technical operation attempt history

Important columns:
- id
- payment_record_id
- attempt_number
- provider_operation
- request_idempotency_key
- payload_hash
- response_code
- status
- error_message
- created_at

Relationships:
- Many-to-one with `payment_records`

Indexes:
- idx_payment_attempts_payment_record
- idx_payment_attempts_idempotency_key_unique (where applicable)

Lifecycle/status model:
- started, succeeded, failed, retried

#### 2.2.18 `commission_rules`
Purpose:
- Data-driven commission policy rules

Important columns:
- id
- name
- rule_type
- scope_type
- scope_id
- category_id
- provider_id
- percentage_rate
- fixed_amount
- tier_definition
- promotional_flag
- effective_from
- effective_to
- status
- version
- created_by
- created_at

Relationships:
- One-to-many with `commission_rule_versions`
- One-to-many with `transaction_commissions`

Indexes:
- idx_commission_rules_scope_active
- idx_commission_rules_effective_range

Lifecycle/status model:
- draft, active, expired, archived

#### 2.2.19 `commission_rule_versions`
Purpose:
- Immutable snapshots of each commission rule

Important columns:
- id
- commission_rule_id
- version
- rule_payload
- created_by
- created_at

Relationships:
- Many-to-one with `commission_rules`

Lifecycle/status model:
- immutable snapshot

#### 2.2.20 `transaction_commissions`
Purpose:
- Transaction-specific commission decisions recorded at settlement time

Important columns:
- id
- booking_id
- payment_record_id
- commission_rule_id
- commission_rule_version_id
- calculation_basis
- percent_rate
- fixed_amount
- computed_amount
- currency
- status
- created_at

Relationships:
- Many-to-one with `bookings`
- Many-to-one with `payment_records`
- Many-to-one with `commission_rules`

Indexes:
- idx_transaction_commissions_booking
- idx_transaction_commissions_payment

Lifecycle/status model:
- calculated, approved, reversed, adjusted

#### 2.2.21 `provider_settlements`
Purpose:
- Tracks provider-managed settlement plan and status

Important columns:
- id
- booking_id
- professional_id or business_id
- provider_id
- gross_amount
- currency
- commission_amount
- net_amount
- status
- provider_settlement_reference
- scheduled_for
- settled_at
- created_at

Relationships:
- Many-to-one with `bookings`
- Many-to-one with `payment_providers`

Indexes:
- idx_settlements_booking
- idx_settlements_status

Lifecycle/status model:
- pending, queued, processing, settled, failed, adjusted

#### 2.2.22 `payout_accounts`
Purpose:
- Provider payout bank or wallet account metadata

Important columns:
- id
- user_id or business_id
- provider_id
- provider_account_reference
- account_type
- status
- onboarding_status
- last_verified_at
- created_at

Relationships:
- Many-to-one with `users` / `businesses`
- One-to-many with `payout_events`

Lifecycle/status model:
- draft, pending_review, active, disabled, rejected

#### 2.2.23 `payout_events`
Purpose:
- Records issued payouts and settlement transactions

Important columns:
- id
- payout_account_id
- booking_id
- provider_id
- amount
- currency
- status
- provider_payout_reference
- requested_at
- processed_at
- failed_at
- created_at

Relationships:
- Many-to-one with `payout_accounts`
- Many-to-one with `bookings`

Lifecycle/status model:
- queued, processing, succeeded, failed, reversed

#### 2.2.24 `refunds`
Purpose:
- Tracks refund requests and final outcomes

Important columns:
- id
- payment_record_id
- booking_id
- requested_by_user_id
- refund_type
- reason_code
- amount
- currency
- status
- policy_version
- approved_by
- created_at
- processed_at

Relationships:
- Many-to-one with `payment_records`
- Many-to-one with `bookings`

Indexes:
- idx_refunds_payment_record
- idx_refunds_status

Lifecycle/status model:
- requested, approved, rejected, processing, completed, failed

#### 2.2.25 `disputes`
Purpose:
- Tracks customer or admin disputes on payments or services

Important columns:
- id
- booking_id
- payment_record_id
- raised_by_user_id
- dispute_type
- status
- evidence_url
- summary
- resolution
- resolved_by
- created_at
- resolved_at

Relationships:
- Many-to-one with `bookings`
- Many-to-one with `payment_records`

Lifecycle/status model:
- opened, under_review, pending_evidence, resolved, rejected, escalated

#### 2.2.26 `ledger_entries`
Purpose:
- Canonical append-only financial ledger

Important columns:
- id
- booking_id
- payment_record_id
- payout_event_id
- refund_id
- dispute_id
- entry_type
- direction
- amount
- currency
- balance_before
- balance_after
- actor_user_id
- provider_event_id
- created_at

Relationships:
- Many-to-one with booking/payment/payout/refund/dispute

Indexes:
- idx_ledger_booking_time
- idx_ledger_record_type

Lifecycle/status model:
- append-only; immutable after finalization except corrections via adjustment entries

#### 2.2.27 `webhook_events`
Purpose:
- Durable storage of external provider webhooks and processing status

Important columns:
- id
- provider_id
- provider_event_type
- provider_event_id
- raw_payload
- signature_verified
- processing_status
- idempotency_key
- processed_at
- failure_reason
- created_at

Relationships:
- Many-to-one with `payment_providers`

Indexes:
- idx_webhooks_provider_event_unique
- idx_webhooks_processing_status

Lifecycle/status model:
- received, queued, processed, failed, duplicate, ignored

#### 2.2.28 `notifications`
Purpose:
- User-facing notifications for lifecycle events

Important columns:
- id
- user_id
- notification_type
- title
- body
- target_entity_type
- target_entity_id
- read_at
- delivered_at
- created_at

Relationships:
- Many-to-one with `users`

Indexes:
- idx_notifications_user_unread

Lifecycle/status model:
- queued, delivered, read, archived

#### 2.2.29 `reviews`
Purpose:
- Public or semi-public service rating and review records

Important columns:
- id
- booking_id
- reviewer_user_id
- target_professional_id or target_business_id
- rating_score
- review_text
- status
- created_at
- updated_at

Relationships:
- Many-to-one with `bookings`
- Many-to-one with `users`

Indexes:
- idx_reviews_target_rating
- idx_reviews_booking_unique

Lifecycle/status model:
- draft, published, hidden, removed

#### 2.2.30 `kyc_payment_eligibility`
Purpose:
- Separate payment / provider eligibility status

Important columns:
- id
- user_id or business_id
- provider_id
- status
- status_reason
- checked_at
- expires_at
- created_at

Relationships:
- Many-to-one with `users` or `businesses`
- Many-to-one with `payment_providers`

Lifecycle/status model:
- not_required, pending, eligible, ineligible, expired

#### 2.2.31 `trust_verification_records`
Purpose:
- Separate platform trust and verification status

Important columns:
- id
- entity_type
- entity_id
- verification_type
- status
- evidence_reference
- reviewed_by
- reviewed_at
- notes
- created_at

Relationships:
- Polymorphic by user, professional, or business

Lifecycle/status model:
- pending, approved, rejected, expired, revoked

#### 2.2.32 `audit_logs`
Purpose:
- Immutable operational and security audit trail

Important columns:
- id
- actor_user_id
- action_type
- resource_type
- resource_id
- old_values
- new_values
- ip_address_hash
- user_agent_hash
- created_at

Relationships:
- Many-to-one with `users`

Indexes:
- idx_audit_resource_time
- idx_audit_actor_time

Lifecycle/status model:
- append-only

### 2.3 Additional design notes
- Currency fields should always be stored with amount in a generic `amount + currency` pattern.
- Use `status` enums rather than free text to enforce lifecycle consistency.
- Use append-only records for financial events, status transitions, and audit entries.
- Keep payment provider fields as normalized metadata rather than hard-coding provider fields into every table.

---

## 3. Row Level Security Strategy

The goal is to align with the approved architecture and the existing security baseline: use DB-level RLS to enforce access, while keeping Authorization decisions in server logic and policy functions.

### 3.1 Core RLS principle
- RLS must be enabled on all user-scoped tables and sensitive financial and trust tables.
- The application must never trust client-provided role claims alone.
- Authorization should be determined by server-side policy functions reading the authenticated user, role assignments, and resource ownership metadata.

### 3.2 Roles and access expectations

#### Customer access
Customers should be able to read or update only:
- their own profile and addresses
- their own requirements, reservations, payment records, and support/dispute activity
- their own notifications and reviews authored by them
- public professional/business profile data required for discovery
- public service listings and selected categories

Blocked from:
- other customers’ payment or trust metadata
- other users’ KYC documents or provider payout metadata
- admin-only financial reconciliation and audit records

#### Professional / Service Provider access
Professionals should be able to read or update:
- their own profile, service catalog, availability, responses, bookings, and payout/account metadata eligible to them
- their own reviews and performance insights
- their own requirement responses and status updates

Blocked from:
- other professionals’ KYC or provider account data
- customer payment credentials or non-owned financial records
- admin or system-level reconciliation data

#### Business access
Business accounts should be able to access:
- business profile and staff assignments for their business
- business service catalog and bookings
- business payout or settlement metadata for that business
- staff access scoped to that business only

Blocked from:
- unrelated businesses’ KYC, financial records, or audit logs

#### Admin access
Admins should be able to read:
- moderation-relevant records across all users, listings, bookings, and disputes
- support and audit data necessary for operations
- payment and settlement exceptions and webhook exception records

Blocked from:
- arbitrary direct mutation of user payment credentials or raw secret values
- bypassing immutable audit trail or policy enforcement

#### Super Admin access
Super Admins should have:
- full operational access to management dashboards and controlled role assignment
- ability to approve or reject trust verification and sensitive escalations

Additional guardrails:
- any super-admin action should be logged in `audit_logs`
- impersonation or elevated access should require explicit approval and strong audit metadata

#### System / server-side service role
The service role may:
- process webhooks, retries, reconciliation jobs, and internal ledger updates
- write to append-only financial tables and audit records
- read provider metadata required for system integrity

Constraints:
- system service role must not bypass policy for customer-facing reads by default
- all service-role tasks must be constrained to explicit operation scopes and logged

### 3.3 Sensitive table policy posture
Key policy emphasis:
- `payment_records`, `payment_attempts`, `ledger_entries`, `provider_settlements`, `payout_events`, `refunds`, `disputes`, `webhook_events`, `kyc_payment_eligibility`, `trust_verification_records`, `audit_logs` must have strict access boundaries.
- `audit_logs` should be append-only and readable only by authorized admins and system processes.
- `webhook_events` should be readable by system workers and restricted admins only.
- `kyc_payment_eligibility` and `trust_verification_records` must not be visible to unrelated roles.
- `payout_events` and provider account metadata must be restricted to owning business/professional or authorized admin roles.

### 3.4 RLS implementation patterns
Use patterns such as:
- ownership check: `auth.uid() = user_id`
- business relationship check: `EXISTS` query against `business_staff`
- admin check: `EXISTS` query against `role_assignments`
- service-role bypass only for internal system jobs
- verification-safe checks: ensure that a user can access only rows for which they have a valid relationship

---

## 4. Authentication & Authorization Design

This is a planning design only; no implementation yet.

### 4.1 Auth model
Use a managed auth provider such as Supabase Auth as an authentication boundary, while keeping role resolution and authorization in the application layer.

### 4.2 User lifecycle
- Signup with email + password and/or mobile OTP path
- Role selection during onboarding or after account creation
- Email verification before high-risk actions
- Mobile verification before payment or payout-related capabilities
- Session management using secure server-side session validation and refresh tokens

### 4.3 Flows to design

#### Signup
- Create `users` record
- Create `user_profiles` row
- Initialize `role_assignments` for the default customer role if applicable
- Trigger welcome and verification notifications

#### Login
- Authenticate via email/password, magic link, or OAuth
- Validate session state and roles on server
- Set secure session cookies or token-managed session state for web app usage

#### Logout
- Clear active session and invalidate any corresponding tokens
- Log the event to audit trail

#### Password reset
- Request reset token
- Validate token and update password
- Audit success/failure events

#### Email / mobile verification
- Require verification for critical actions like listing publication, payout onboard, business approval, and production-order actions
- Separate verification state from trust verification to avoid conflating statuses

#### Session handling
- Use short-lived sessions with refresh tokens managed securely
- Store server-side session data only where necessary
- Enforce device/session revocation if suspicious activity is detected

### 4.4 Role assignment
Role assignment will use `role_assignments` with scope-aware records:
- `customer` globally for customer users
- `professional` globally for individual providers
- `business_owner` or `business_manager` for specific business scopes
- `admin` and `super_admin` for platform operations

### 4.5 Authorization boundaries
- No role claim should be trusted from client-side alone.
- Use server-side policy checks to ensure ownership, business membership, or admin permission.
- Sensitive operations (order changes, payouts, disputes, KYC status changes, role changes) must pass dedicated server-side policy validations before mutation.

---

## 5. Payment Architecture

This design follows the approved Phase 5 architecture: provider-agnostic, Cashfree-preferred for India, but not permanently coupled to a single provider.

### 5.1 Core objectives
- Keep the marketplace payment domain provider-agnostic
- Allow Cashfree Easy Split to be the preferred India-first provider without hard-wiring it into core code
- Support future provider additions and settlement patterns without redesigning the foundation
- Preserve auditability, idempotency, and reconciliation integrity

### 5.2 Provider abstraction
Define a common interface for:
- checkout session creation
- charge / payment intent creation
- payment confirmation and status polling reconciliation
- refund initiation
- payout initiation
- webhook verification and event parsing
- settlement status retrieval
- provider-specific metadata normalization

Recommended modules:
- `payment/provider-interface`
- `payment/adapter/cashfree`
- `payment/adapter/razorpay` (future, not active in Phase 6)
- `payment/adapter/international-provider` (future)
- `payment/orchestrator`
- `payment/ledger`
- `payment/webhooks`

### 5.3 Payment lifecycle
1. Customer creates a booking or purchase request
2. Checkout request resolves to payment session or payment intent creation
3. Payment record created with pending status and idempotency key
4. Provider confirms charge or payment result
5. Payment record transitions to succeeded/failed/cancelled
6. Commission and provider payout calculation is derived from a versioned commission rule
7. Provider-managed settlement is recorded in settlement tables and ledger entries
8. Reconciliation compares provider data with ledger and adjustment records

### 5.4 Important financial entities in design
- `payment_records`: canonical payment transaction summary
- `payment_attempts`: attempt-level tracing and idempotency support
- `provider_settlements`: provider-managed settlement pipeline
- `payout_events`: payout to business/professional
- `ledger_entries`: financial truth table
- `refunds` and `disputes`: lifecycle and resolution tracking
- `webhook_events`: provider event archival and processing

### 5.5 Webhook processing design
- All provider webhooks must be validated using provider signature verification
- Events must be stored in `webhook_events` before processing
- Idempotency key derived from provider event ID and payment/order reference
- Duplicate events must not re-execute financial state transitions
- Failed webhook events must enter retry or DLQ flow with alerting

### 5.6 Reconciliation and ledger integrity
- Provider reports must reconcile with local ledger entries
- Mismatches must generate reconciliation exceptions and admin-visible alerts
- Ledger entries must be append-only and strongly linked to payment, payout, refund, or adjustment records
- No direct financial writes should occur without an associated ledger record or audit entry

### 5.7 Commission and settlement integration
- Commission rule version is captured when the transaction is created
- Revenue split is computed and stored in transaction commission records
- Provider settlement total is derived from the agreed payout model
- Payout status is tracked separately from payment status to avoid conflating the two

### 5.8 Feature flags for financial activation
Real payments remain disabled until approved, including:
- live checkout
- real provider integration
- webhook processing in production mode
- payout execution
- live admin financial tools

---

## 6. Commission Engine Design

The commission engine must be data-driven, not hard-coded, and must preserve the exact rule version used for every transaction.

### 6.1 Supported rule types
- percentage commission
- fixed commission
- percentage + fixed
- tiered commission
- category-specific commission
- service-specific commission
- provider-specific commission
- promotional or temporary commission rules
- effective start/end date rules

### 6.2 Rule model
Use a rule structure containing:
- `rule_type`
- `base_scope` (global, category, service, provider, business, professional, market)
- `effective_from`, `effective_to`
- `priority`
- `status`
- `version`
- `payload` with calculation-specific configuration
- `promotion_flag`
- `audit metadata`

### 6.3 Calculation flow
1. Booking or payment record is created
2. Rule candidates are evaluated based on scope and context
3. Applicable rules are sorted by priority and valid date windows
4. The selected rule version is recorded in `transaction_commissions`
5. The computed commission amount is stored along with amount, currency, and source version
6. Reversals or adjustments generate `commission_adjustments` records

### 6.4 Auditability requirement
Historical transactions must retain:
- the rule version used at transaction time
- the calculation basis
- the actor or system source of the calculation
- adjustment history if later corrected

### 6.5 Safe business guardrails
- Launch percentage remains pending business approval
- No default production commission should be implemented before sign-off
- Commission logic must remain behind feature flags until approved

---

## 7. Booking / Service Workflow Definition

This is the core marketplace flow and should remain governed by safe, explicit status transitions.

### 7.1 End-to-end lifecycle
Customer discovers service
→ selects professional/business
→ creates booking or requirement
→ professional/business accepts or rejects
→ scheduling details are confirmed
→ service execution occurs
→ completion is marked
→ payment is processed or settled through provider abstraction
→ review/rating is collected
→ refund/dispute may follow if applicable

### 7.2 Status model
Recommended lifecycle statuses:
- `draft`
- `published`
- `awaiting_response`
- `pending_acceptance`
- `accepted`
- `scheduled`
- `in_progress`
- `awaiting_completion`
- `completed`
- `payment_pending`
- `payment_confirmed`
- `paid`
- `cancelled`
- `refunded`
- `disputed`
- `closed`

### 7.3 Safe status transition rules
- `draft` → `published` only when the listing is valid and approved for visibility
- `published` → `awaiting_response` when a requirement is submitted
- requirement or booking cannot move to `accepted` without provider availability or business approval
- `scheduled` cannot proceed without valid time slot and provider confirmation
- `completed` must require a clear completion trigger produced by the relevant actor or platform workflow
- `cancelled` can occur before or during scheduling depending on policy and timing
- `paid` and `settled` should be derived after payment and provider step completion, not directly overwritten by user actions
- `disputed` requires review workflow and evidence storage

### 7.4 Operational design notes
- Each status change should emit an entry in `booking_status_history`
- Actions requiring financial impact must also create ledger and settlement-related records
- No direct cancellation should bypass policy evaluation or refund determination

---

## 8. Multilingual Architecture

The approved Phase 5 decisions require:
- English
- Tamil
- Hindi
- Malayalam
- English default/fallback locale
- separation of UI locale and user-generated content locale
- future readiness for additional languages and RTL support

### 8.1 UI language design
- Localize all UI strings by locale and translation key
- Default to `en` while allowing locale preference from account settings or browser locale
- Keep locale resolution separate from marketplace content language

### 8.2 User-generated content design
- Content records should carry `content_locale` metadata for search and display behavior
- Search and discovery should be enabled for multilingual content later without forcing a redesign
- AI-assisted translation may be added later but is not part of this phase

### 8.3 Future RTL readiness
- Use logical CSS patterns, not hardcoded left-to-right layout assumptions
- Design for locale-aware directionality and text expansion in layout templates
- Keep locale metadata in core user and content models to support future RTL languages such as Arabic

---

## 9. Security Baseline and Hardening Requirements

The design must comply with the approved security baseline and the Phase 5 architecture constraints.

### 9.1 Core security controls
- Server-side authorization for all sensitive actions
- RLS enforced at database layer for user-scoped tables
- Secret isolation and no secrets in source control
- Structured input validation and schema enforcement at all API boundaries
- Webhook signature verification for provider events
- Idempotency keys for all financial operations
- Append-only audit trail for all critical business and financial events
- Rate limiting for abuse prevention and burst protection
- Upload validation and signed storage URLs for sensitive or user-generated content
- Protection against privilege escalation via server-side role evaluation and limited admin scopes

### 9.2 Financial operation safeguards
- No irreversible financial action without idempotent operation enforcement
- Provider event processing must be replay-safe
- All payouts and settlement operations must be reviewable with evidence and linked ledger records
- Feature flags must gate all external financial activation paths

### 9.3 Secret handling rules
- No secrets, tokens, or credentials in `.env`, docs, commit history, or source files
- Secret storage must be environment-managed
- Separate values by environment and service responsibility

### 9.4 Data handling standards
- No unnecessary PII in analytics or logs
- Mask or hash sensitive identifiers in audit logs where possible
- Do not store raw payment credential information on the application layer

---

## 10. Feature Flags

Phase 6 should prepare a feature-flag catalog for all external and financial features until approved:

- real payments
- provider payouts
- production webhook processing
- production KYC
- production trust verification
- production analytics
- external provider integrations
- business payout onboarding
- live financial reconciliation
- automatic settlement execution
- provider-specific refund automation
- provider-specific payout automation

Recommended pattern:
- each feature flag should define scope, environment gates, rollout state, and owner
- production financial activation should remain blocked behind explicit approval gates and staging validation

---

## 11. Testing Strategy

Phase 6 planning must define a staged and real-behavior-focused testing strategy.

### 11.1 Unit tests
- role and permission logic
- commission-rule evaluation
- payment adapter normalization logic
- booking state transition logic
- notification generator logic
- locale resolution logic
- validation and sanitization helper tests

### 11.2 Integration tests
- user signup and profile creation
- requirement creation and response flow
- booking creation and acceptance flow
- review submission logic
- notification event emission

### 11.3 RLS / security tests
- customer cannot read other users’ financial records
- business staff cannot access unrelated business records
- admin-only data remains protected from customer visibility
- service role only writes inside approved system boundaries

### 11.4 Payment sandbox tests
- provider adapter status normalization
- successful test charge flow
- failed payment handling
- idempotent duplicate webhook processing
- refund and partial refund simulation
- ledger consistency checks

### 11.5 Webhook tests
- valid signature passes
- invalid signature rejected
- duplicate event ignored or marked duplicate
- retries resolve without double execution

### 11.6 Commission tests
- percentage calculations
- fixed fee calculations
- tier selection correctness
- category/provider override precedence
- historical rule version capture
- adjustment/reversal flow

### 11.7 Booking workflow tests
- workflow path from request to completion
- cancellation policies
- dispute creation from service failure
- review creation after booking completion

### 11.8 Role/permission tests
- multi-role user access control
- scope-specific business permissions
- escalation prevention
- admin-only changes are auditable

### 11.9 End-to-end tests
- browser-based marketplace flow in staging only
- sandbox checkout evaluation without production credentials
- requirement-to-booking-to-payment sandbox path
- admin moderation and dispute review path

---

## 12. Recommended Phase 6 Implementation Order

The safest order is to build the system from foundational data and authorization boundaries outward, then add the booking and financial layers only after database, role, and policy foundations are stable.

### 12.1 Milestone 6A — Core schema/types
- finalize canonical entities and status enums
- establish shared TypeScript domain models
- define IDs, localization metadata, and currency conventions
- define append-only ledger and audit requirements

### 12.2 Milestone 6B — Auth and role foundation
- define user accounts, profiles, and role assignments
- design signup/login/password-reset flows
- define session management and verification paths
- align role permissions with RLS model

### 12.3 Milestone 6C — Service/catalog foundation
- categories and nested taxonomy
- service definitions and pricing metadata
- business and professional service ownership
- availability and location metadata

### 12.4 Milestone 6D — Booking workflow
- customer requirements and responses
- booking creation and acceptance
- status transitions and history timeline
- completion and review triggers

### 12.5 Milestone 6E — Payment adapter foundation
- provider abstraction and adapter design
- checkout/payment intent orchestration
- webhook ingestion and verification
- payment status reconciliation without live activation

### 12.6 Milestone 6F — Commission/ledger foundation
- versioned commission rules
- transaction-specific commission snapshots
- settlement and payout tracking
- ledger and adjustment integrity

### 12.7 Milestone 6G — Notifications/reviews
- notification types and triggers
- review/rating model
- event-driven customer/professional updates

### 12.8 Milestone 6H — Security/RLS validation
- validate access controls and business ownership checks
- audit log coverage and sensitive data masking
- secret isolation and rate limit design
- webhook and upload hardening

### 12.9 Milestone 6I — Testing and staging readiness
- unit + integration + RLS + webhook + commission + workflow tests
- staging and sandbox validation matrix
- feature-flag review and approved rollout gate for future production activation

---

## 13. Assumptions Made
- The approved Phase 5 decisions are the governing architecture and must remain the source of truth.
- Supabase/PostgreSQL is the planned datastore model for Phase 6, consistent with the repo’s approved stack and prior architecture documents.
- Cashfree Easy Split is the preferred India-first provider only and remains optional until commercial and compliance approvals are complete.
- New authentication and payment functionality is conceptual only and will not be implemented during this planning phase.
- The project continues to avoid direct custody of customer funds and will use a facilitator/provider-managed settlement model.
- The system is initially India-focused with INR launch currency but is designed to be international-ready.

## 14. Decisions That Still Require Explicit Approval
- Final provider activation strategy for Cashfree Easy Split and any live production onboarding path
- Final launch commission rate and business-approved policy set
- Specific refund, cancellation, and dispute policy rules by service/category
- Final analytics vendor and retention policy
- International expansion provider selection beyond India-first scope
- Final KYC collection / provider onboarding plan for payout recipients and trust verification workflow
- Any change to the architecture that deviates from the approved Phase 5 decisions

## 15. Final Planning Note
This blueprint is intentionally limited to planning and design and does not authorize code implementation, migration execution, external service activation, or deployment. All later implementation work must occur only after explicit approval and a separate implementation gate.

---

End of Phase 6 Implementation Blueprint (planning only)
