# TakeItEsee Phase 7A - UI/UX Architecture and Design-System Plan

Status: Planning only
Phase: 7A
Scope: Information architecture, navigation, design-system planning, responsive UX, accessibility, and Phase 7B implementation planning.

This document does not implement UI, authentication, APIs, persistence, Supabase, SQL, RLS, payment processing, notification delivery, or backend behavior.

## 1. Purpose and Guardrails

Phase 6 is locked. The UI adapts to the canonical Phase 6 domain model and must not redesign it.

The UI layer may consume and present:

- canonical users, profiles, roles, and scoped authorization context
- service, category, ownership, pricing, and availability contracts
- booking requests, lifecycle states, schedules, cancellations, completion, and no-show records
- payment status, payment references, refunds, disputes, and provider-neutral payment metadata
- notifications, review eligibility, ratings, moderation states, and operational summaries
- security decisions, visibility restrictions, audit outcomes, and sensitive-data boundaries

The UI must not become an authorization source of truth. Every protected action is eventually evaluated server-side using the Phase 6 authorization and security contracts.

The Phase 7A design assumes:

- mobile-first customer workflows
- role-aware provider and admin workspaces
- progressive disclosure for complex operational states
- clear separation between discovery, booking, payment status, and post-service review
- public presentation data separated from private operational and financial data
- multilingual-ready content and UI labels
- graceful loading, empty, error, denied, and offline-like states

## 2. Existing UI Audit

### 2.1 Current routes

The current Next.js App Router scaffold contains these routes:

| Route | Current state | Phase 7A treatment |
| --- | --- | --- |
| `/` | Placeholder home page with headline and four placeholder panels | Retain route; evolve into discovery home in Phase 7B |
| `/explore` | Placeholder listing page | Retain route; evolve into search and discovery |
| `/categories` | Placeholder category page | Retain route; evolve into category browsing |
| `/professionals` | Placeholder professional directory | Retain route; evolve into provider discovery |
| `/businesses` | Placeholder business directory | Retain route; evolve into business discovery |
| `/requirements` | Placeholder requirements page | Retain route; later support customer requirements and provider responses |
| `/login` | Placeholder login page | Retain route; later connect to the Phase 6 auth contracts |
| `/register` | Placeholder registration page | Retain route; later connect to account and role assignment flows |
| `/_not-found` | Next.js generated route | Retain and improve as an accessible error state |

No customer, provider, admin, booking, payment, notification, review, or settings routes are implemented yet.

### 2.2 Current layout and styling

The current layout provides:

- one shared header with text navigation
- a centered max-width main container
- a shared footer
- Tailwind utility styling
- a minimal global stylesheet
- a plain gray/white visual treatment
- no component library beyond the application shell
- no responsive navigation pattern
- no focus, validation, loading, or error system
- no stateful workflow implementation

The existing scaffold is safe to evolve because it contains no live domain behavior. The shell should be replaced deliberately in Phase 7B, with route preservation maintained wherever the route already expresses a public product concept.

### 2.3 Current UX gaps

The scaffold does not yet provide:

- a customer discovery model
- location and search interaction patterns
- service and provider comparison
- booking workflow navigation
- role-aware navigation
- mobile bottom navigation
- provider operations workspace
- admin moderation workspace
- payment-status presentation
- notification center
- review eligibility and submission states
- accessible form and dialog patterns
- consistent loading, empty, error, and permission-denied states

These are Phase 7B implementation concerns, not Phase 7A source changes.

## 3. Product UX Principles

### 3.1 Customer confidence
Every high-consequence action should show what will happen next:

- selected service and provider
- schedule and timezone
- quoted amount and currency
- booking status
- payment status, without implying payment success from booking success
- cancellation or refund status where relevant

### 3.2 Discovery before commitment
The customer should be able to browse and compare before signing in or committing. Authentication is requested at the point where the protected action requires it, such as creating a booking or submitting a review.

### 3.3 One primary action per view
Each screen should have one dominant action, with secondary actions visually subordinate. Examples:

- Explore: Search services
- Service detail: Choose a time
- Booking review: Submit booking request
- Provider booking: Respond to request
- Review form: Submit review
- Admin moderation: Apply decision

### 3.4 State is visible and honest
Booking status and payment status are separate indicators. A screen must never display a paid, completed, or confirmed state unless the corresponding canonical domain state supports it.

### 3.5 Scoped workspaces
Provider and admin areas are operational tools, not marketing pages. They should favor density, filtering, tables or structured lists, and clear status transitions over decorative cards.

### 3.6 Progressive disclosure
Show the minimum information needed for the current decision, with details available in an expandable panel, drawer, or details route. Sensitive customer, financial, verification, and audit data should only appear in authorized contexts.

### 3.7 Multilingual-ready presentation
Use translation keys for interface text. Preserve localized service and category content from the catalog model. Do not assume translated text has the same length as English.

## 4. Phase 6 UI Contract Map

The UI architecture consumes these locked concepts without redefining them.

| UI concern | Phase 6 source of truth | Presentation rule |
| --- | --- | --- |
| Account identity | `User`, `UserProfile` | Show only authorized profile fields |
| Role navigation | `PlatformRole`, `RoleAssignment`, `AuthorizationContext` | Render affordances from server-provided authorization results |
| Provider identity | `ProviderReference`, `ServiceOwner` | Preserve professional/business discriminator |
| Service content | `Service`, `Category`, catalog contracts | Use localized presentation and availability metadata |
| Price | `Money`, `ServicePricing`, `Currency` | Always display amount with currency |
| Booking | `Booking`, `BookingStatus`, schedule contracts | Use explicit lifecycle labels and transition-aware actions |
| Payment | `PaymentRecord`, `PaymentStatus`, payment references | Display independently from booking status |
| Notifications | `Notification`, notification events | Show delivery/read state without implementing delivery |
| Reviews | `Review`, `Rating`, `BookingReviewEligibility` | Enable review only after eligible booking state |
| Operations | provider/business summary contracts | Treat as aggregate read models, not accounting truth |
| Security | security decisions, scopes, data classifications | Hide, redact, or deny based on server policy |

No UI DTO should create a second ID, owner, role, money, booking, payment, or audit representation.

## 5. Customer Information Architecture

### 5.1 Customer navigation model

Mobile primary navigation:

1. Home
2. Explore
3. Bookings
4. Notifications
5. Profile

The active tab should reflect the current route. Secondary actions such as categories, requirements, saved services, help, and settings are reached from Home, Explore, or Profile rather than competing with the five primary destinations.

Desktop navigation:

- brand and Home link
- Explore
- Categories
- Requirements
- Professionals
- Businesses
- notification indicator
- profile menu
- role entry point when the account has provider or admin permissions

The desktop header may become sticky after the first viewport, but it must not consume excessive vertical space on mobile.

### 5.2 Customer route concepts

Public discovery:

- Home/discovery
- Explore/search results
- Categories
- Category detail
- Service detail
- Provider profile
- Business profile
- Professionals directory
- Businesses directory
- Requirements directory or information page

Authenticated customer workspace:

- My bookings
- Booking detail
- Booking confirmation
- Notifications
- Saved services, only if a persisted favorites model is approved later
- Profile and settings
- Help and support

Transaction flow:

- booking request
- schedule selection
- booking review
- payment status handoff/presentation
- confirmation
- tracking
- completion
- review eligibility and review submission

### 5.3 Customer home

First viewport priorities:

- location/search entry
- concise service discovery prompt
- popular or nearby categories
- a small set of trusted discovery shortcuts
- visible path to requirements for customers who cannot find a matching service

The home page should not become a marketing landing page. Its first job is to begin discovery.

### 5.4 Search and discovery

Search supports:

- free-text service search
- category filter
- location or service region filter
- availability filter when backed by catalog availability
- price display and pricing model
- provider type filter where useful
- sort by relevance, availability, rating, or proximity when those values are available

Search result cards should never imply availability or trust beyond the data returned by the server. Filter state must be represented in the URL when the route is shareable.

### 5.5 Service detail

A service detail view presents:

- localized service name and description
- provider identity and provider type
- category context
- pricing and currency
- pricing model and duration when available
- service availability summary
- rating and review summary when available
- service visibility and publication state only when relevant to an authorized owner
- primary action to select a schedule or request a booking

A service may belong to a professional or business. The UI must use the discriminated provider reference rather than assuming a single provider shape.

### 5.6 Customer booking journey

The canonical journey is:

`Discover -> Search/Browse -> Select Service -> Select Provider if applicable -> Select Date/Time -> Review Booking -> Payment/Payment Status -> Confirmation -> Booking Tracking -> Completion -> Review`

Detailed steps:

1. Discover
   - Customer enters a service, category, or location intent.
2. Search/Browse
   - Customer compares services and providers using visible filters.
3. Select Service
   - Customer opens service details and confirms scope, price, and duration.
4. Select Provider
   - If the service has multiple eligible providers, customer chooses one using provider cards or a comparison view.
5. Select Date/Time
   - Customer chooses an available schedule with timezone and conflict feedback.
6. Review Booking
   - Customer checks service, provider, schedule, price, currency, notes, and cancellation information.
7. Payment/Payment Status
   - Payment UI, when approved in a later phase, must present payment status separately from booking status.
8. Confirmation
   - Show booking reference, current booking status, schedule, provider, and next action.
9. Booking Tracking
   - Show the lifecycle timeline and actionable status updates.
10. Completion
   - Show completion state and any pending customer confirmation.
11. Review
   - Show review entry only when the server returns eligible completed-booking context.

The UI must not promise an accepted booking when the canonical state is only requested or under provider review.

### 5.7 Customer booking detail

The detail screen uses a status timeline with separate lanes or sections:

- Booking: requested, provider review, accepted, scheduled, in progress, completion pending, completed, cancelled, no-show, refund pending, closed
- Payment: pending, initiated, authorized, captured, failed, cancelled, refunded, disputed, settled, closed

Actions are derived from server authorization and current state. Invalid transitions are not offered as buttons.

## 6. Provider and Business Information Architecture

### 6.1 Provider workspace navigation

Provider navigation is a workspace shell with:

- Overview
- Bookings
- Calendar/availability
- Services/catalog
- Profile/business
- Reviews
- Earnings/payment status
- Notifications
- Settings

For a business, staff navigation and visible actions must be scoped to the active business and the server-authorized staff role. A business owner and a viewer should not see the same mutation controls.

### 6.2 Provider onboarding shell

The onboarding shell is a progress-oriented workspace, not a public profile page. It may show:

- profile completeness
- service/catalog setup
- availability setup
- trust verification status where permitted
- payment eligibility status where permitted
- next required action

It must distinguish platform trust verification from payment-provider eligibility. It must not collect or expose verification evidence in a general UI surface.

### 6.3 Provider dashboard

The overview should prioritize operational decisions:

- pending booking requests
- upcoming accepted/scheduled bookings
- completion confirmations awaiting action
- no-show or cancellation attention items
- service publication warnings
- review summary
- payment status summary without exposing restricted financial records
- notifications requiring attention

Operational summaries are aggregate read models. They are not a replacement for payment or ledger truth.

### 6.4 Services and catalog management

Provider catalog screens support the Phase 6 service model:

- draft, active, paused, archived, suspended, deleted states
- localized service name and description
- category selection
- pricing and currency
- pricing model
- duration
- availability mode
- publication and visibility state
- professional or business ownership context

Actions such as publish, pause, suspend, restore, or delete should appear only when authorized and valid for the current state.

### 6.5 Booking management

Provider booking lists should separate:

- new requests requiring response
- accepted bookings awaiting schedule
- reschedule proposals
- scheduled bookings
- in-progress or completion-pending bookings
- cancelled, rejected, no-show, and closed history

A provider response must make the resulting state clear: accept, reject, propose reschedule, or withdraw where permitted. Customer data shown to the provider must be limited to what is necessary for the assigned booking and authorized scope.

### 6.6 Availability and schedule

The schedule UI should support:

- timezone display
- recurring availability where represented by the backend
- blackout or unavailable periods when supported
- proposed reschedule windows
- conflict feedback
- clear distinction between an available slot and a confirmed booking

The UI does not define availability rules or write schedule state directly; it presents server-authoritative availability and submits typed intents in Phase 7B.

### 6.7 Earnings and payment status

Provider views may show:

- payment status related to assigned bookings
- aggregate captured/refunded/net references when authorized
- operational period and review summary
- pending settlement or eligibility messaging when supported later

Do not expose raw payment credentials, unrestricted ledger entries, provider secrets, or verification evidence.

## 7. Admin Information Architecture

### 7.1 Admin shell

Admin uses a desktop-first sidebar with a compact mobile drawer. The sidebar groups tools by responsibility:

- Overview
- Customers
- Professionals and businesses
- Services and categories
- Bookings
- Payment status
- Reviews and moderation
- Notifications/communications
- Security and audit
- Platform settings

Admin and super-admin capabilities must remain distinct. The UI should display a clear role/scope indicator and avoid suggesting that admin access bypasses financial or audit invariants.

### 7.2 Admin dashboard

The dashboard is an operational queue, not a decorative metrics wall. It may summarize:

- pending moderation items
- suspended or reported services
- booking exceptions
- payment reconciliation exceptions when approved later
- trust verification review queues
- security denials and audit events
- notification delivery issues when delivery infrastructure exists

Every sensitive metric should link to an authorized detail view with scope and audit context.

### 7.3 Oversight surfaces

Customer management:

- account status and basic profile metadata
- role assignments through authorized workflows
- security events and access history where permitted
- no unnecessary private data exposure

Provider management:

- professional/business profile state
- service ownership and publication state
- trust verification and payment eligibility summaries, kept separate
- business staff scope and role status

Service/category oversight:

- category tree and activation state
- service status and publication state
- moderation actions with reason and audit trail

Booking oversight:

- booking reference and lifecycle
- provider/customer relationship
- schedule and exception state
- cancellation, no-show, dispute, and refund references

Review moderation:

- booking-linked eligibility context
- target and reviewer scope
- rating/comment content
- moderation status and reason
- immutable moderation event trail

Security/audit:

- authorization decisions
- admin/moderation actions
- sensitive data access events
- file and webhook integrity metadata
- retention and legal-hold metadata where implemented later

## 8. Navigation Architecture

### 8.1 Shells

Use three related shells rather than one overloaded navigation system:

1. Public/customer shell
   - discovery header on desktop
   - bottom navigation on mobile
2. Provider workspace shell
   - workspace header and scoped side navigation
   - business switcher only when the account has multiple authorized business scopes
3. Admin shell
   - audit-oriented sidebar
   - compact mobile drawer
   - persistent role and environment indicator

### 8.2 Navigation rules

- Navigation is contextual to the active role and scope.
- A customer should not see provider mutation controls merely because the account has a provider role elsewhere.
- Business staff navigation must identify the active business scope.
- Admin navigation must not imply access to records that the server has denied.
- Breadcrumbs are useful for category -> service -> provider and admin detail paths, but not for short mobile flows.
- Back navigation must preserve search filters and booking draft context where possible.

## 9. Route Map

### 9.1 Existing routes to retain

```text
/
/explore
/categories
/professionals
/businesses
/requirements
/login
/register
```

These routes remain the initial public and account-entry surface. Their visual design and content can change in Phase 7B without changing their route identity.

### 9.2 Recommended future customer routes

Documentation-only proposal; do not create in Phase 7A.

```text
/customer
/customer/bookings
/customer/bookings/[bookingId]
/customer/notifications
/customer/profile
/customer/settings
/customer/help
/explore/search
/categories/[categorySlug]
/services/[serviceSlug]
/providers/[providerId]
/businesses/[businessId]
/booking/new
/booking/[bookingId]/review
/booking/[bookingId]/confirmation
/booking/[bookingId]/payment-status
/booking/[bookingId]/review-request
```

A favorites route such as `/customer/saved` should remain deferred until a compatible persisted favorites domain contract exists.

### 9.3 Recommended future provider routes

Documentation-only proposal; do not create in Phase 7A.

```text
/provider
/provider/onboarding
/provider/bookings
/provider/bookings/[bookingId]
/provider/calendar
/provider/services
/provider/services/new
/provider/services/[serviceId]
/provider/profile
/provider/business
/provider/reviews
/provider/earnings
/provider/notifications
/provider/settings
```

Business-scoped routes may later use a business identifier or an active business scope, but the URL must not become the authorization source. Server-side scope validation remains authoritative.

### 9.4 Recommended future admin routes

Documentation-only proposal; do not create in Phase 7A.

```text
/admin
/admin/customers
/admin/providers
/admin/businesses
/admin/services
/admin/categories
/admin/bookings
/admin/payments
/admin/reviews
/admin/notifications
/admin/security
/admin/audit
/admin/settings
```

### 9.5 Routes that should not yet be created

Do not create these in Phase 7A:

- payment gateway callback or webhook routes
- Supabase auth callback routes
- API routes
- admin mutation endpoints
- notification delivery endpoints
- file upload endpoints
- RLS or database management routes
- live analytics routes
- worker or reconciliation routes

## 10. Responsive Strategy

### 10.1 Breakpoint intent

Use behavior-based breakpoints rather than designing separate products:

- Mobile: single-column, touch-first, bottom navigation, bottom sheets
- Tablet: two-column discovery and compact workspace layouts
- Desktop: constrained content plus persistent navigation and comparison views

The exact Tailwind breakpoints can follow the existing project configuration in Phase 7B, but component behavior must be defined independently of arbitrary pixel values.

### 10.2 Content widths

- Reading content: approximately 45-70rem depending on density
- Discovery results: responsive grid with a stable card minimum width
- Booking review: single focused column with a secondary summary on desktop
- Provider workspace: sidebar plus a fluid content area
- Admin workspace: sidebar plus dense content with table/card alternatives

### 10.3 Mobile booking patterns

- Use a stepper or progress indicator with one decision per screen.
- Keep the selected service, provider, schedule, and amount visible in a compact summary.
- Use a bottom sheet for date/time selection where it improves reachability.
- Keep primary actions fixed near the bottom only when they do not cover content or keyboard input.
- Preserve draft state when moving backward.
- Do not use a horizontal desktop table for booking confirmation on mobile.

### 10.4 Touch targets and interaction

- Minimum interactive target: 44 by 44 CSS pixels.
- Increase spacing between destructive and primary actions.
- Use full-width action rows for important mobile decisions.
- Avoid hover-only meaning; every hover affordance needs a focus and touch equivalent.
- Support swipe only as an enhancement, never as the sole route to an action.

## 11. Design-System Specification

### 11.1 Brand hierarchy

TakeItEsee should feel approachable, useful, and trustworthy rather than luxurious or corporate. The brand hierarchy is:

1. TakeItEsee brand mark/name
2. Product action: find, compare, book, manage
3. Context: service, provider, booking, payment, review
4. Supporting metadata: category, location, schedule, status

The brand should not overwhelm repeated operational screens.

### 11.2 Typography

Phase 7B should select a distinctive, readable font family and load it intentionally. Avoid default browser/system typography as the final brand expression.

Recommended hierarchy:

- Display: 2.5-4rem for the discovery entry point only
- Page title: 1.75-2.25rem
- Section title: 1.25-1.5rem
- Card title: 1-1.125rem
- Body: 0.9375-1rem
- Supporting metadata: 0.8125-0.875rem
- Labels and status: 0.75-0.8125rem with sufficient line height

Do not use viewport-scaled font sizes or negative letter spacing. Text must wrap without clipping.

### 11.3 Color tokens

Define semantic tokens rather than scattering raw color values:

```text
--color-canvas
--color-surface
--color-surface-raised
--color-surface-muted
--color-text
--color-text-muted
--color-border
--color-primary
--color-primary-strong
--color-secondary
--color-accent
--color-success
--color-warning
--color-danger
--color-info
--color-focus
```

The visual direction should use a light, warm-neutral canvas with a confident primary accent and restrained secondary accents. Avoid a one-hue palette and avoid default purple-on-white styling.

State semantics:

- Success: completed, eligible, delivered, active
- Warning: pending, review required, expiring, reschedule proposed
- Danger: failed, rejected, suspended, cancelled where destructive emphasis is needed
- Info: neutral progress, guidance, payment status explanation

Color never carries status alone; pair it with text, icon, or a shape cue.

### 11.4 Surfaces, spacing, radius, and elevation

Spacing scale:

```text
space-1: 0.25rem
space-2: 0.5rem
space-3: 0.75rem
space-4: 1rem
space-5: 1.25rem
space-6: 1.5rem
space-8: 2rem
space-10: 2.5rem
space-12: 3rem
space-16: 4rem
```

Radius scale:

```text
radius-sm: 4px
radius-md: 8px
radius-lg: 12px
radius-pill: 999px for tags and status only
```

Use cards for repeated service, provider, booking, and review items. Do not place page sections inside decorative cards or nest cards inside cards.

Elevation:

- flat: default page content
- raised: individual repeated item or toolbar
- floating: menu, dialog, bottom sheet
- critical: destructive confirmation or system-level alert

Shadows should be subtle and paired with borders so surfaces remain clear in low contrast or high zoom.

### 11.5 Core components

Build components around behavior and state, not only appearance:

- Button: primary, secondary, quiet, destructive, loading, disabled
- Icon button: tooltip, accessible label, focus ring, disabled state
- Input: label, hint, validation, error, disabled, loading
- Select/combobox: keyboard navigation, search, empty, loading
- Search field: location/search intent, clear, submit, recent state later
- Service card: title, provider, price, duration, rating, availability hint, action
- Provider card: identity, provider type, category/service context, rating, action
- Booking card: booking reference, service, schedule, booking status, payment status
- Status badge: text plus semantic icon, not color alone
- Tabs: keyboard roving focus and URL/state preservation where appropriate
- Breadcrumbs: semantic navigation for deep desktop routes
- Dialog: confirmation, destructive action, accessible focus trap
- Drawer/bottom sheet: mobile filter, schedule selector, detail peek
- Toast/alert: non-blocking success, warning, or error with persistence rules
- Skeleton: layout-preserving loading placeholder
- Empty state: explanation plus one next action
- Error state: plain-language issue, retry, support path
- Permission-denied state: no sensitive detail leakage, safe explanation

Use an icon library in Phase 7B rather than hand-drawn interface glyphs. Every unfamiliar icon needs a tooltip or accessible label.

### 11.6 Forms

All forms should include:

- visible label or correctly associated accessible name
- input purpose and expected format
- inline validation close to the field
- summary for multiple errors
- preserved values after non-destructive errors
- disabled/loading state during submission
- server error presentation distinct from client validation
- no sensitive values in query strings or logs

### 11.7 Status presentation

A status component should accept the canonical status value and map it to:

- human-readable label
- semantic tone
- icon
- optional explanation
- allowed next-action hint supplied by the server

The UI must not invent transitions by mapping a status to a button locally.

## 12. Loading, Empty, Error, and Success States

Every future route should define these states before implementation.

Loading:

- preserve the final layout shape with skeletons
- do not show false values such as price or rating placeholders that look real
- show a progress indicator for multi-step booking only when progress is known

Empty:

- state what is empty
- explain why the user may be seeing it
- provide one useful next action
- do not show a blank panel or an unexplained zero

Error:

- use plain language
- provide retry where safe
- preserve non-sensitive draft input
- show a support/reference path for booking and payment failures
- never expose provider payloads, stack traces, secrets, or internal policy details

Permission denied:

- do not reveal whether a hidden resource exists
- show a generic access message and safe navigation option
- record the denied event server-side where required by security policy

Success:

- confirm the actual canonical result
- show reference ID and next action where relevant
- distinguish a submitted booking request from an accepted booking
- distinguish payment initiation from capture or settlement

## 13. Accessibility Requirements

### 13.1 Semantic structure

- Use `header`, `nav`, `main`, `aside`, `section`, and `footer` appropriately.
- Use one clear page heading and a logical heading hierarchy.
- Use lists for result sets and navigation groups.
- Use native buttons and links for actions and navigation.
- Keep tables for genuinely tabular admin data and provide a mobile alternative when needed.

### 13.2 Keyboard and focus

- All interactive controls must be keyboard reachable.
- Focus indicators must be visible against every surface.
- Dialogs and drawers must trap focus while open and restore it on close.
- Escape closes dismissible overlays unless a critical confirmation requires a deliberate action.
- Do not use focus order that differs from visual order without a strong reason.

### 13.3 Forms and messaging

- Every field has an accessible label.
- Validation errors are associated with their fields.
- Error summaries are announced when multiple errors occur.
- Loading and success announcements use polite live regions where appropriate.
- Status badges include text and are not color-only.

### 13.4 Contrast and motion

- Meet WCAG AA contrast for normal text and controls.
- Focus, disabled, and error states must remain distinguishable.
- Respect `prefers-reduced-motion`.
- Avoid essential information conveyed only by animation, hover, or auto-advancing content.

### 13.5 Responsive accessibility

- Touch targets are at least 44 by 44 CSS pixels.
- Bottom navigation remains reachable above device safe areas.
- Keyboard use remains possible on responsive layouts.
- Text can resize to 200 percent without loss of content or function.
- Long service names, localized text, booking references, and error messages must wrap safely.

## 14. Reusable Component Architecture

The future implementation should organize UI code by responsibility:

```text
web/
  app/                 route composition and page-level data boundaries
  components/
    layout/            public, provider, and admin shells
    navigation/        headers, bottom nav, sidebars, breadcrumbs
    discovery/         search, filters, service and provider cards
    booking/           stepper, schedule, summary, timeline, status
    payments/          payment-status presentation only
    notifications/     notification list, unread state, preference shell
    reviews/           rating, eligibility, submission, moderation views
    operations/        summary cards, tables, period selectors
    security/          denied, verification, audit context displays
    ui/                 buttons, inputs, dialogs, drawers, status, states
  lib/
    formatting/        money, dates, localized content presentation
    routing/           typed route helpers when needed
    accessibility/     announcements and focus helpers
```

Components may format and present canonical types, but mutation permissions and state transitions remain server-authoritative.

## 15. Phase 7B Implementation Sequence

Phase 7B is future work and is not started by this document.

Recommended order:

1. Establish the visual tokens and typography choice.
2. Build accessible primitives: buttons, fields, labels, status badges, dialogs, drawers, skeletons, and state views.
3. Build the public/customer shell with responsive desktop header and mobile bottom navigation.
4. Replace the placeholder home, explore, categories, professionals, businesses, and requirements pages with static or fixture-backed presentation states.
5. Build service cards, provider cards, service detail, provider profile, and search/filter presentation.
6. Build customer booking screens against typed fixtures and locked booking/payment contracts.
7. Build customer bookings, booking detail, notifications, and review presentation states.
8. Build provider workspace shell, dashboard, catalog, availability, booking management, reviews, notifications, and operational summary views.
9. Build admin shell and read-only oversight/moderation surfaces.
10. Add route-level loading, empty, error, denied, and responsive accessibility validation.
11. Connect approved server-authoritative data boundaries only in a later approved phase.

Phase 7B should begin with fixtures or typed adapters, not with new persistence or provider integrations.

## 16. Explicit Phase 7A Boundaries

This phase creates documentation only. It does not:

- modify `web/app` routes or components
- modify `web/types` canonical Phase 6 contracts
- create API routes or server actions
- add authentication implementation
- add Supabase or any database integration
- add SQL, migrations, or RLS policies
- add payment gateway or payment processing code
- add notification delivery providers
- add analytics vendors or tracking
- add workers, webhooks, or reconciliation jobs
- add production configuration or deployment changes
- create a favorites persistence model
- create a chat or messaging model
- start Phase 7B implementation
- start Phase 8 or any later phase

## 17. Risks and Unresolved UX Decisions

1. Location model
   - The catalog and address contracts support future location-aware behavior, but the exact customer location permission, service-region matching, and map interaction model remain undecided.

2. Authentication timing
   - The product should allow public discovery, but the exact point at which login is required for booking, requirements, notifications, and reviews depends on the future server flow.

3. Provider selection
   - Some services may have one provider while others may expose multiple eligible providers. The selection UI should remain conditional on returned provider data.

4. Schedule interaction
   - Calendar granularity, timezone policy, recurring availability, blackout management, and reschedule negotiation need backend decisions before final interaction details.

5. Payment presentation
   - Payment status can be designed now, but checkout, redirect, capture, refund, and dispute UI must wait for approved payment integration contracts.

6. Favorites
   - Saved services are a requested customer capability, but no canonical favorites domain contract exists. Keep the navigation affordance deferred.

7. Business scope switching
   - Multi-business staff and owner accounts need a finalized active-scope selection pattern before provider navigation is implemented.

8. Admin permissions
   - Admin versus super-admin operations need concrete policy mapping before destructive controls are enabled.

9. Notification preferences
   - Notification records and events exist, but channel preferences and delivery provider behavior are intentionally deferred.

10. Commission and ledger presentation
    - Commission and ledger implementation is deferred. Provider earnings screens should remain aggregate, status-oriented, and read-model based until those contracts are approved.

11. Content moderation
    - Review moderation states exist, but moderation queues, evidence views, and escalation rules require implementation approval.

12. Internationalization delivery
    - Locale-ready content is supported by the domain model, but translation catalog ownership, formatting rules, and language switching persistence remain future decisions.

## 18. Phase 7A Completion Criteria

Phase 7A is complete when:

- customer, provider/business, and admin information architectures are documented
- the end-to-end customer booking journey is mapped to locked domain states
- existing and future routes are clearly separated
- mobile, tablet, and desktop behavior is specified
- design tokens and reusable components are defined
- loading, empty, error, success, and denied states are specified
- accessibility requirements are explicit
- Phase 7B has an ordered implementation sequence
- no Phase 6 domain contract requires redesign for the planned UI
- no UI or backend implementation has been introduced
