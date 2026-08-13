TakeItEsee — Security Baseline (Phase 3)

Purpose
- Provide a practical security baseline for development with the approved Supabase + Next.js stack.
- Focus on architecture-level protections developers must follow.

Authentication
- Use Supabase Auth as the primary provider for the MVP.
- Require email verification for critical actions (payments, identity verification flows).
- Use server-side session validation for sensitive API endpoints.
- Use short-lived JWTs with refresh tokens handled securely (HttpOnly, Secure cookies for web clients).

Authorization
- Centralize authorization logic in server-side policy functions/middleware.
- Use RBAC combined with scoped role assignments (see `role_assignments` table design).
- Never trust client-provided role claims — always verify on server using DB checks and RLS policies.

Row Level Security (RLS)
- Enable RLS on Postgres tables that contain user-scoped data: `profiles`, `requirements`, `messages`, `notifications`, `businesses` (sensitive drafts).
- Define policies per action (SELECT, INSERT, UPDATE, DELETE) using current_user context and role checks.
- Example: `messages` SELECT policy allows only participants to read messages.

Environment variables and secrets
- Store secrets in environment or a secrets manager (Vercel/Supabase/team secret store). Do not commit `.env` to Git.
- Use least privilege for service keys. Use separate keys for local dev, staging, and production.

API protection
- Use Next.js route handlers with server-side auth checks and validation at the boundary.
- Validate input thoroughly (schema validation with Zod/Joi) before performing DB operations.
- Use parameterized queries / ORM safe APIs to prevent SQL injection.

Rate limiting and abuse protection
- Implement per-IP and per-user rate limiting using edge middleware or middleware running before API handlers. Vercel Edge or a middleware-level approach can apply rate limits.
- Use Redis for rate counters when scale requires persistent counters.

Input validation and sanitization
- Use schema validation (Zod recommended for TypeScript) for all incoming payloads.
- Sanitize HTML or rich-text content on the server (DOMPurify server-side or equivalent) before saving or rendering.

File upload security
- Use signed upload URLs (Supabase Storage supports policy-based uploads).
- Validate file types and sizes server-side before storing references in the DB.
- Store files outside the webroot, serve via CDN or signed URLs, and scan for malware in high-risk scenarios.

Logging, auditing, and monitoring
- Log security-relevant events: logins, role changes, failed auth attempts, sensitive API calls, file uploads, and admin actions.
- Store audit logs in a tamper-evident system (append-only table) with retention policies.
- Design logs to avoid storing sensitive PII in plaintext — mask or redact where necessary.

Secrets management
- Use Vercel/Supabase secret environment variables for deployments.
- For local development, use a `.env.local` that is gitignored.

Key recommendations
- Enforce RLS early for per-user data; it provides strong server-side guarantees when combined with proper auth context propagation.
- Centralize permission checks and keep policies simple and auditable.
- Add SAST/static analysis to CI pipelines before production deploys.
