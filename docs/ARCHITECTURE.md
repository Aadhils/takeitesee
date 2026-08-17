TakeItEsee — Architecture Overview

This document outlines recommended architecture choices and reasoning for evolving the existing static Coming Soon site into a scalable marketplace platform.

Goals
- Support user registration and multi-role accounts (customer, professional, business)
- Scalable backend APIs and search/discovery
- Real-time features: chat/notifications
- Mobile apps (Android/iOS) and PWA support
- Operational observability, security, and compliance readiness

High-level architecture (Phase 3 — approved stack)
- Frontend: Next.js (App Router) with TypeScript
  - Why: SSR/SSG for SEO, App Router features, server components, and strong Vercel integration for preview and production deployments.
- Styling / UI: Tailwind CSS with an accessible component architecture (headless components and design tokens)
  - Why: Rapid UI development, consistent theming, and encourages accessible patterns.
- Managed backend services: Supabase (Postgres, Auth, Storage, Realtime)
  - Why: Unifies database, authentication, storage, and realtime into a single managed offering that lowers operational overhead and uses standard Postgres for portability.
- API pattern: Next.js Route Handlers / Server Actions for server-side logic; keep service boundaries clean so components can be extracted into dedicated services later.
- Database: PostgreSQL hosted via Supabase (UUID PKs, JSONB for flexible metadata)
  - Why: ACID, relational integrity, and Postgres features (e.g., Full-Text Search, PostGIS) with managed convenience.
- Search: PostgreSQL Full-Text Search (initial)
  - Why: Minimizes early infra complexity and cost; plan to migrate to a dedicated search engine (OpenSearch/Algolia) if/when search needs justify it.
- Realtime: Supabase Realtime (initial) for presence, notifications and basic chat workload
- Caching & Pub/Sub: Redis as an add-on when required (e.g., for rate limiting, queues, caches)
- Storage & CDN: Supabase Storage initially; plan to migrate to S3 + CDN or a dedicated image CDN when necessary.
- Authentication: Supabase Auth (email/password + OAuth providers) as the initial auth provider
- Hosting: Frontend on Vercel; data and backend services on Supabase
- Monitoring: Start lightweight and design for Sentry/OpenTelemetry integration later

Rationale summary
- This file is updated to reflect the Phase 3 approved technology stack: Next.js + Tailwind + Supabase + Vercel. Choices favor low operational overhead, developer velocity, and clear migration paths.

Security and compliance
- Use HTTPS everywhere, secure cookies, CSP, and strict CORS policies.
- Secrets management via cloud secret manager (AWS Secrets Manager / Parameter Store / Vault).
- Regular backups, DB encryption at rest, and role-based access control.
- Plan for data protection laws (GDPR/CCPA) and create a data retention policy.

Rationale summary
- Prioritize developer velocity and production readiness: Next.js + TypeScript + Postgres is a proven combination that supports SEO, PWA, mobile, and complex marketplace workflows.
- Use managed services for high-velocity early development (Auth, Search, Realtime) with migration paths to self-hosted solutions.

Appendix: incremental rollout strategy
1. Scaffold Next.js site under `web/` while preserving current static site as-is.
2. Create an `api/` service (monorepo `packages/api`) exposing versioned REST endpoints.
3. Add `shared/` package for types and DTOs, plus a database package with migrations (Prisma recommended) and seeds.
4. Integrate managed Auth provider and a developer admin UI for early user/role management.
