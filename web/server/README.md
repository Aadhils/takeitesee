# Production backend foundation

The current browser flow remains available through the explicitly local development adapters in `services/auth-adapter.ts` and `services/booking-repository.ts`.

Production mode is enabled automatically once `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are both set (see `lib/supabase/config.ts`). Set `NEXT_PUBLIC_TAKEITSEE_BACKEND_MODE=development` to force the local development fallback even when Supabase is configured.

The server contracts are in:

- `server/auth/session.ts`
- `server/bookings/repository.ts`
- `types/production-domain.ts`

Both read/write real data through Supabase (`lib/supabase/server.ts`) using the signed-in user's session cookie, so Postgres Row Level Security enforces ownership. The schema and RLS policies are applied through `supabase/migrations/`.

Do not put the Supabase service-role/secret key in client code or `NEXT_PUBLIC_*` variables.
