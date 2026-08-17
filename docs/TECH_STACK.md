TakeItEsee — Locked Technology Stack (Phase 3)

Approved stack (locked for initial development)
- Frontend / Full-stack: Next.js (with App Router) + TypeScript
- Styling / UI system: Tailwind CSS with accessible component library (design tokens + headless components)
- Backend / Managed services: Supabase (managed PostgreSQL, Auth, Storage, Realtime)
- Hosting: Vercel for Next.js apps; Supabase for backend/data services
- Realtime: Supabase Realtime (initial)
- Search: PostgreSQL Full-Text Search (initial)
- API pattern: Next.js Route Handlers / Server Actions; maintain service boundaries for future extraction
- Monitoring: lightweight local-first approach; design for Sentry/OpenTelemetry later

Why each was selected
- Next.js + TypeScript: provides SSR/SSG for SEO, strong developer DX, App Router for modern routing, and tight integration with Vercel. Using Next.js server components and route handlers enables a minimal backend surface while keeping the option to extract APIs later.
- Tailwind CSS: fast, utility-driven styling that produces consistent, responsive UIs with minimal CSS bloat. Works well with component-driven accessible UI patterns.
- Supabase (Postgres + Auth + Storage + Realtime): provides a low-friction managed backend that matches product needs: Postgres relational model, built-in auth and storage, and realtime features. Low cost to start and enables iteration without building core infra.
- PostgreSQL Full-Text Search: keeps search within the database to reduce early infra complexity and cost; provides adequate capability for MVP discovery and is straightforward to migrate later to a dedicated search engine if required.
- Vercel: best-in-class hosting for Next.js apps with preview deployments, global edge network, and simple integration.

Alternatives considered
- Frontend: Remix, Gatsby — chosen Next.js for broad ecosystem and SSR/ISR features.
- Auth/Backend: Auth0, Clerk, Firebase — chosen Supabase for unified managed DB + Auth + Storage and smoother migration path.
- Search: Algolia / Elastic — deferred to later to avoid vendor cost and complexity early.
- Realtime: Pusher/Ably — chosen Supabase Realtime to keep stack unified; plan to migrate if scale/feature set requires.

Scaling and migration strategy
- Keep API boundaries clean: use Next.js route handlers as API surface; avoid business logic in pages so backend can be extracted to a dedicated service later.
- Shared `shared/` types package for types/DTOs to prevent drift when splitting frontend/backend.
- Use Supabase as the primary datastore for early development; if scaling needs arise, migration plan:
  - Move heavy search to OpenSearch/Algolia via background sync from Postgres.
  - Introduce Redis for caching and pub/sub; move sessions or locks out of Postgres where necessary.
  - Extract complex endpoints into a dedicated Node.js service or serverless functions.
- Image storage: start on Supabase Storage and migrate to S3/CloudFront or image CDN (ImageKit/Cloudinary) with URL rewriting when needed.

Estimated complexity considerations
- Low initial infra complexity (Vercel + Supabase) with high developer velocity.
- Medium complexity when introducing cross-region DB replicas, dedicated search, or a microservices architecture — plan to add CI/CD checks and infra-as-code before those steps.

Security considerations (top-level)
- Plan for Row Level Security policies in Postgres (Supabase supports RLS).
- Use server-side permission checks for sensitive operations; never rely only on client checks.
- Enforce HTTPS, secure cookies, short-lived tokens, and refresh tokens storing strategies.

Notes
- This stack is chosen to minimize upfront operational burden and cost while preserving clear migration paths to more scalable and specialized services as demand grows.
