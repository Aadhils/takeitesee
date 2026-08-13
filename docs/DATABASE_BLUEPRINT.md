Database Blueprint — TakeItEsee (initial)

Context
- This blueprint assumes initial hosting on Supabase (managed PostgreSQL, Auth, Storage). Schemas and patterns are standard Postgres and portable to other Postgres hosts.

Design principles
- Use PostgreSQL as the system of record with UUID primary keys.
- Use JSONB fields for flexible metadata and denormalization where appropriate.
- Soft-deletes with `deleted_at` to preserve history.
- Timestamps: `created_at`, `updated_at` on all tables.
- Role assignments are many-to-many to allow multi-role accounts.

Core tables

1) users
- id: UUID PK
- email: varchar, unique, indexed
- email_verified: boolean
- phone: varchar, indexed (nullable)
- password_hash: varchar (nullable if using OAuth/SSO)
- preferred_locale: varchar(10)
- metadata: JSONB (preferences, flags)
- created_at, updated_at, deleted_at

Indexes: unique(email), index(phone), index(created_at)

2) role_assignments
- id: UUID PK
- user_id: UUID FK -> users.id
- role: enum('visitor','customer','professional','business','admin')
- scope_type: varchar (optional: 'business','professional_profile', null)
- scope_id: UUID nullable (references business.id or professional_profiles.id)
- active: boolean
- assigned_by: UUID nullable
- created_at, updated_at

Notes: Allows one user to have multiple roles and scoped roles (e.g., manager of a particular business).

3) profiles (generic profile container)
- id: UUID PK
- user_id: UUID FK -> users.id
- display_name: varchar
- bio: text
- avatar_url: varchar
- contact_info: JSONB (phone, website, social links)
- public: boolean
- metadata: JSONB
- created_at, updated_at

4) businesses
- id: UUID PK
- owner_user_id: UUID FK -> users.id (primary owner)
- name: varchar
- slug: varchar unique
- description: text
- address: JSONB (structured address)
- contact: JSONB
- verified: boolean
- metadata: JSONB
- created_at, updated_at

Indexes: index(slug), index(owner_user_id)

5) professional_profiles
- id: UUID PK
- user_id: UUID FK -> users.id
- title: varchar
- headline: varchar
- services_offered: JSONB (array of service ids or objects)
- hourly_rate: numeric (nullable)
- location: geography / point (for geospatial queries) OR JSONB
- verified: boolean
- rating_aggregate: numeric (cached average)
- metadata: JSONB
- created_at, updated_at

Indexes: user_id, GIST on location if using PostGIS

6) categories
- id: UUID PK
- parent_id: UUID nullable (self FK)
- name: varchar
- slug: varchar unique
- metadata: JSONB
- created_at, updated_at

7) services
- id: UUID PK
- professional_profile_id: UUID FK -> professional_profiles.id (nullable)
- business_id: UUID FK -> businesses.id (nullable)
- category_id: UUID FK -> categories.id
- title: varchar
- description: text
- price: numeric nullable
- unit: varchar (e.g., hour, job)
- metadata: JSONB
- created_at, updated_at

8) requirements (posts / job requests)
- id: UUID PK
- user_id: UUID FK -> users.id (requester)
- title: varchar
- description: text
- category_id: UUID FK
- location: geography/JSONB
- status: enum('open','assigned','closed','cancelled')
- assigned_service_id: UUID nullable
- assigned_professional_id: UUID nullable
- budget_min, budget_max: numeric
- visibility: enum('public','private')
- metadata: JSONB
- created_at, updated_at

Indexes: user_id, category_id, status, GIST on location

9) reviews
- id: UUID PK
- author_id: UUID FK -> users.id
- target_type: enum('professional','business','service')
- target_id: UUID (FK depending on type)
- rating: smallint
- title: varchar
- body: text
- created_at, updated_at

Indexes: author_id, target composite index (target_type, target_id)

10) chats
- id: UUID PK
- type: enum('direct','group')
- title: varchar nullable
- created_by: UUID FK -> users.id
- metadata: JSONB
- created_at, updated_at

11) messages
- id: UUID PK
- chat_id: UUID FK -> chats.id
- sender_id: UUID FK -> users.id
- body: text
- attachments: JSONB (list of storage object refs)
- read_by: JSONB (array of user_id / timestamps) or separate receipts table
- created_at, delivered_at, read_at

Indexes: chat_id + created_at

12) notifications
- id: UUID PK
- user_id: UUID FK -> users.id
- type: varchar
- payload: JSONB
- read: boolean
- delivered_at, created_at

13) audits / events (optional)
- event_id, user_id, action, object_type, object_id, payload JSONB, created_at

Notes on types and migrations
- Use a migration tool (Prisma Migrate, Flyway, or Liquibase). For TypeScript ecosystem, Prisma + PostgreSQL provides a good developer DX.
- Use UUID v4 (or ULID) for primary keys for horizontal scaling and less collision risk.
- Use PostGIS for geospatial queries if location-based discovery is a key feature.

Search indexing (initial)
- Use PostgreSQL Full-Text Search for initial discovery features to avoid introducing an external search service early.
- Denormalize minimal search documents into a `search_index` table (or materialized views) with fields: id, type, title, snippet, tsvector columns for full-text, location, category_ids, tags, ranking_boosts, updated_at.
- Keep index updates in background workers or via DB triggers; consider logical replication or change data capture when moving to a dedicated search engine later.

Backups and retention
- Daily logical backups, point-in-time recovery for critical tables, periodic export of search indexes and message backups for retention/compliance.
