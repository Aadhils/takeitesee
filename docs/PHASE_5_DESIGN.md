# TakeItEsee — Phase 5 Design Document

WARNING: PLANNING ONLY — Do NOT implement anything described in this document until explicit approvals are given.

## 1. Objective and Scope

Phase 5 objective:
- Finalize the marketplace transaction, settlement, trust, analytics, and multilingual architecture for TakeItEsee without implementing production financial flows.
- Define a payment and settlement model that is India-first, provider-agnostic, and ready for future international expansion.
- Define commission, refund, dispute, KYC/trust, and analytics principles that are compliant with the approved product decisions.

Scope (planning only):
- Provider-agnostic payment architecture and gateway abstraction.
- Facilitator / provider-managed settlement model and lifecycle design.
- Commission engine design with versioned rules and historical traceability.
- Refund and dispute configuration model.
- Financial data model built around amount + currency, not INR-specific assumptions.
- KYC/trust separation and role-based verification design.
- Privacy-first analytics and analytics-provider-agnostic event design.
- Localization architecture for English, Tamil, Hindi, and Malayalam, with future expansion considerations.

Approved decisions incorporated in this design:
- India-first provider preference: Cashfree Easy Split, subject to onboarding, eligibility, compliance, and commercial approval.
- Facilitator / payment-provider-managed settlement model; no unnecessary direct custody of customer funds.
- Flexible commission architecture across percentage, fixed, tiered, category, provider, and promotion rules.
- Configurable refund/dispute architecture with policy variation by service/category.
- India launch market, INR launch currency, and international-ready monetary modeling.
- Separate payment/KYC eligibility and TakeItEsee trust verification concepts.
- Privacy-first analytics with no unnecessary PII in default analytics events.
- Initial locales: English, Tamil, Hindi, Malayalam; English default/fallback.

## 2. Core Architecture Principles

High-level components (conceptual only):
- `web/` (Next.js App Router): UI for checkout, listings, requirements flow, provider onboarding status, reporting, and admin review.
- Server-side handlers: secure server endpoints for payment orchestration, webhook ingest, reconciliation, and policy checks; secrets stored only in environment-managed secret storage.
- Worker tier: asynchronous job handlers for reconciliation, settlement checks, retries, payout state updates, and audit logging.
- Database: PostgreSQL as the canonical system of record for order, settlement, ledger, provider, trust, and analytics metadata.
- Feature flags: test-mode and rollout controls for all financial and trust surfaces.
- Observability: error tracking and operational metrics without collecting unnecessary PII.

Design principles:
- Provider-agnostic payment abstraction so Cashfree can be initial preference without becoming a permanent hard dependency.
- One account capable of multiple roles: customer, professional, business owner, admin, or any combination permitted by policy.
- Strong auditability for all financial operations, including commission calculation decisions and reconciliation records.
- Idempotent payment and webhook processing to prevent duplicate execution or duplicate settlement.
- Server-side authorization for all financial actions; no client-side trust decisions.
- PostgreSQL Row Level Security strategy for tenant, role, and user-scoped access control.
- No secrets in source control; environment-managed secret storage only.
- Privacy-first data handling; analytics must avoid PII by default.
- Feature flags and test mode before production financial activation.

## 3. Payment Provider Strategy

Preferred India-first provider:
- Cashfree Easy Split is the preferred initial provider for the India launch phase.
- This preference does not create a permanent hard dependency on Cashfree.
- Final production activation is contingent on merchant onboarding, eligibility, legal/compliance review, and commercial approval.

Architecture requirement:
- The application must expose a payment abstraction layer that allows switching or adding providers without redesigning the core marketplace.
- Providers such as Cashfree, Razorpay, and future international providers should be modeled as interchangeable adapters behind the same marketplace contract.
- Provider-specific behavior must remain behind adapters and policy layers, not embed in core domain models.

Conceptual provider abstraction layers:
- Payment orchestration service: creates charges, captures, refunds, and records provider references.
- Provider adapter interface: standard operations for initialization, checkout session, charge capture, refund, payout, webhook verification, and status reconciliation.
- Provider-specific implementation: Cashfree, future Razorpay, and future international provider integrations.
- Settlement policies: provider-specific settlement timing and operational rules remain outside core marketplace logic.

## 4. Money, Settlement, and Custody Model

TakeItEsee must avoid unnecessary direct custody of customer funds.

Approved model:
- Use a facilitator / payment-provider-managed settlement model.
- Customer funds flow through TakeItEsee checkout into the selected payment provider.
- The provider allocates the platform commission, professional/business payout, and any applicable adjustments according to the approved settlement model.
- Exact regulated funds flow must follow the selected provider's approved model and applicable law.

Conceptual flow:
1. Customer completes purchase or booking at checkout.
2. TakeItEsee initiates payment through the provider abstraction.
3. Provider receives and settles the customer payment.
4. Provider-managed allocation separates platform commission and payout to the professional/business.
5. Provider-managed settlement completes payouts under the approved provider configuration.

Core design requirements:
- Do not introduce direct escrow or custody patterns unless a provider-specific legal/regulatory model explicitly requires them.
- Financial records should be modeled as provider-agnostic monetary events rather than assuming direct platform custody.
- All settlement-related records should be audited and reconciled against provider reports.

## 5. Commission Engine Architecture

TakeItEsee must use a flexible commission architecture that supports all approved rule types:
- Percentage commission
- Fixed commission
- Tiered commission
- Category-specific commission
- Provider-specific commission
- Promotional or temporary commission rules

Important constraints:
- Do not lock a launch percentage yet.
- Launch commission rates remain pending business approval.
- Commission rules must be versioned and auditable so historical transactions preserve the exact commission rule used at transaction time.

Recommended conceptual model:
- `commission_rules`: stores rule metadata, effective date range, scope, priority, and status.
- `commission_rule_versions`: stores immutable snapshots of the rule configuration for auditability.
- `transaction_commissions`: stores the rule version selected for each transaction and the resulting calculated commission.
- `commission_adjustments`: stores reversals, promotional credits, manual edits, and dispute-driven adjustments.

Rule design considerations:
- Rules must be evaluated deterministically based on transaction context, service category, provider, and time.
- Temporal validity must be explicit so no historical settlement is recalculated without a recorded versioned change.
- Promotion or temporary rules must be isolated from base rules and may be activated by feature flags or campaign configuration.

## 6. Refunds, Cancellations, and Disputes

TakeItEsee must use a configurable refund and dispute architecture supporting:
- Full refund
- Partial refund
- No-refund outcomes
- Pre-service cancellation
- Provider failure
- Customer cancellation
- Duplicate or technical payment issues
- Admin dispute review
- Evidence and history retention
- Commission reversal or adjustment
- Provider settlement adjustment
- Complete audit trail

Architectural principles:
- Refund and dispute behavior must be policy-driven rather than hardcoded to a single outcome.
- Refund policy may vary by service or category and must be configurable with policy metadata, not fixed at the application model level.
- Policies must define when the platform, provider, or professional/business bears responsibility.
- Dispute workflows must retain evidence, timeline, status changes, and final resolution details.

Conceptual model:
- `refund_policies`: defines policy by service/category, payment type, and timing window.
- `refund_requests`: tracks customer or admin-initiated refund actions.
- `disputes`: tracks dispute lifecycle, evidence, resolution, and actor action.
- `financial_adjustments`: captures commission reversals, provider settlement changes, and net impact.

Implementation note:
- Do not implement the actual refund rules yet. This document defines the architecture and operational requirements only.

## 7. Market and Currency Model

Initial market:
- India

Initial currency:
- INR

Core design requirement:
- The application architecture must remain international-ready and must not hard-code INR into the core financial data model.
- All monetary transaction records should be modeled around amount + currency rather than assuming a single launch currency.
- Future currencies and provider integrations should be addable without redesigning the payment domain.

Monetary domain rules:
- Financial records should store both the transaction amount and the currency code.
- Conversion logic belongs in provider or pricing/settlement services, not in core marketplace business data models.
- Provider adapters should normalize provider-specific currency conventions to the common model.

Expansion posture:
- International provider selection remains pending future expansion decision.
- Current design should allow future multi-currency and cross-border settlement flows without redesigning the underlying financial model.

## 8. KYC and Trust Verification

Use role-based verification.

Important separation:
- Payment-provider KYC and TakeItEsee Trust Verification are separate concepts.
- Customers should not be forced through unnecessary provider-level KYC.
- Professionals and businesses receiving payouts may require provider onboarding or payment-provider KYC.

Separate statuses required:
1. Payment / KYC eligibility status
2. TakeItEsee profile / business / professional verification status

Conceptual status model:
- `payment_eligibility_status`: indicates whether the user or business is eligible to receive or route payments through the selected provider.
- `trust_verification_status`: indicates whether the TakeItEsee profile, business, or professional has completed platform verification steps.

Design principles:
- The provider KYC status must not be conflated with platform trust status.
- Trust verification may include identity, business, or service verification in future phases.
- KYC collection is not to be implemented in this phase.

## 9. Analytics and Privacy Architecture

Use privacy-first analytics.

The marketplace should track product and business metrics such as:
- Search activity
- Category demand
- Requirement posting
- Responses
- Booking/conversion funnel
- Provider response performance
- Marketplace growth metrics

By default, analytics events must not include unnecessary PII such as:
- Phone numbers
- Email addresses
- Precise addresses
- Chat message contents
- KYC documents
- Payment credentials or payment details

Analytics architecture requirements:
- Keep the analytics provider agnostic initially.
- Use pseudonymous identifiers or server-side mapping when event correlation is required.
- Ensure data minimization and retention controls are designed before production activation.
- Keep analytics collection separate from payment and KYC systems.

Final analytics vendor remains pending approval.

## 10. Internationalization Architecture

Initial supported locales:
- English (en)
- Tamil (ta)
- Hindi (hi)
- Malayalam (ml)

Architecture requirement:
- English may be the initial fallback/default locale.
- UI language must be separate from user-generated content language.
- The future architecture must support additional languages without core application rewrites.
- Prepare conceptually for future RTL languages such as Arabic.

Future-ready design:
- Localization should be driven by locale metadata and translation keys rather than hardcoded strings.
- User-generated content may carry locale metadata for search and display behavior.
- Search and discovery should be capable of multilingual behavior in future phases.
- AI-assisted translation may be added later, but is not part of this phase design.

## 11. Cross-Cutting Rules and Safety Requirements

TakeItEsee must maintain the following principles throughout Phase 5 design and future implementation:
- One account capable of multiple roles.
- Provider-agnostic payment architecture.
- Strong auditability for financial operations.
- Idempotent payment and webhook processing.
- Server-side authorization.
- PostgreSQL Row Level Security strategy.
- No secrets in source control.
- Privacy-first data handling.
- Feature flags and test mode before production financial activation.

Additional operational safeguards:
- Payment operations must be designed to avoid production activation until proper approvals, feature flags, and sandbox validation are complete.
- Provider contracts and operational compliance must be validated before live production activation.
- Reconciliation and dispute handling must be operationally reviewable with evidence history and resolution audit trails.

## 12. Explicit Implementation Boundaries

This design is intentionally documentation-only and must not proceed into implementation without separate approvals.

Do not implement:
- Payment SDK installation
- Cashfree integration
- Razorpay integration
- Supabase integration
- Database tables or migrations
- Authentication flows
- Payment or payout execution
- KYC collection
- Analytics tracking implementation
- API keys or secrets
- Deployment or publication actions
- Phase 6 work

This design is limited to architecture, policy, data design, and decision documentation.

## 13. Pending Approval Items

The following items remain pending explicit approval beyond the decisions already captured above:
- Final production activation of Cashfree Easy Split after onboarding, compliance, and commercial approval.
- Launch commission rates and business-approved commission policies.
- Specific refund and dispute policy rules by service/category.
- Final analytics vendor and retention policy.
- Future international provider selection for expansion.

## 14. Recommended Next Step

The next step is a formal review of the updated Phase 5 design against the approved product and architecture decisions. This document is ready for sign-off and must remain documentation-only until the next implementation gate is explicitly approved.

---

Document prepared for design sign-off. No production implementation work is authorized under this document.

*End of Phase 5 Design (planning only)*
