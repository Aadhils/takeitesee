-- Phase 9: Provider availability and scheduling foundation.
-- Apply to the testing Supabase project only after review.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'availability_mode') THEN
    CREATE TYPE availability_mode AS ENUM ('always_available', 'on_request', 'scheduled');
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS service_availability (
  service_id uuid PRIMARY KEY REFERENCES services(id) ON DELETE CASCADE,
  mode availability_mode NOT NULL DEFAULT 'on_request',
  timezone text NOT NULL DEFAULT 'Asia/Kolkata',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS service_availability_windows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id uuid NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  day_of_week smallint NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time time NOT NULL,
  end_time time NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (start_time < end_time)
);

CREATE TABLE IF NOT EXISTS service_availability_blackouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id uuid NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (starts_at < ends_at)
);

CREATE INDEX IF NOT EXISTS service_availability_windows_service_idx ON service_availability_windows(service_id, day_of_week);
CREATE INDEX IF NOT EXISTS service_availability_blackouts_service_idx ON service_availability_blackouts(service_id, starts_at, ends_at);

ALTER TABLE service_availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_availability_windows ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_availability_blackouts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS availability_public_read_active ON service_availability;
CREATE POLICY availability_public_read_active
ON service_availability
FOR SELECT
USING (EXISTS (SELECT 1 FROM services s WHERE s.id = service_availability.service_id AND s.status = 'active'));

DROP POLICY IF EXISTS availability_windows_public_read_active ON service_availability_windows;
CREATE POLICY availability_windows_public_read_active
ON service_availability_windows
FOR SELECT
USING (EXISTS (SELECT 1 FROM services s WHERE s.id = service_availability_windows.service_id AND s.status = 'active'));

DROP POLICY IF EXISTS availability_blackouts_public_read_active ON service_availability_blackouts;
CREATE POLICY availability_blackouts_public_read_active
ON service_availability_blackouts
FOR SELECT
USING (EXISTS (SELECT 1 FROM services s WHERE s.id = service_availability_blackouts.service_id AND s.status = 'active'));

DROP POLICY IF EXISTS availability_provider_manage_own ON service_availability;
CREATE POLICY availability_provider_manage_own
ON service_availability
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM services s
    LEFT JOIN professional_profiles pp ON pp.id = s.professional_id
    LEFT JOIN businesses b ON b.id = s.business_id
    WHERE s.id = service_availability.service_id
      AND (pp.user_id = auth.uid() OR b.owner_user_id = auth.uid())
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM services s
    LEFT JOIN professional_profiles pp ON pp.id = s.professional_id
    LEFT JOIN businesses b ON b.id = s.business_id
    WHERE s.id = service_availability.service_id
      AND (pp.user_id = auth.uid() OR b.owner_user_id = auth.uid())
  )
);

DROP POLICY IF EXISTS availability_windows_provider_manage_own ON service_availability_windows;
CREATE POLICY availability_windows_provider_manage_own
ON service_availability_windows
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM services s
    LEFT JOIN professional_profiles pp ON pp.id = s.professional_id
    LEFT JOIN businesses b ON b.id = s.business_id
    WHERE s.id = service_availability_windows.service_id
      AND (pp.user_id = auth.uid() OR b.owner_user_id = auth.uid())
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM services s
    LEFT JOIN professional_profiles pp ON pp.id = s.professional_id
    LEFT JOIN businesses b ON b.id = s.business_id
    WHERE s.id = service_availability_windows.service_id
      AND (pp.user_id = auth.uid() OR b.owner_user_id = auth.uid())
  )
);

DROP POLICY IF EXISTS availability_blackouts_provider_manage_own ON service_availability_blackouts;
CREATE POLICY availability_blackouts_provider_manage_own
ON service_availability_blackouts
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM services s
    LEFT JOIN professional_profiles pp ON pp.id = s.professional_id
    LEFT JOIN businesses b ON b.id = s.business_id
    WHERE s.id = service_availability_blackouts.service_id
      AND (pp.user_id = auth.uid() OR b.owner_user_id = auth.uid())
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM services s
    LEFT JOIN professional_profiles pp ON pp.id = s.professional_id
    LEFT JOIN businesses b ON b.id = s.business_id
    WHERE s.id = service_availability_blackouts.service_id
      AND (pp.user_id = auth.uid() OR b.owner_user_id = auth.uid())
  )
);
