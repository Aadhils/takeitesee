-- Phase 8: Provider catalog persistence foundation.
-- Apply only to the testing Supabase project after review.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'service_status') THEN
    CREATE TYPE service_status AS ENUM ('draft', 'active', 'paused');
  END IF;
END
$$;

ALTER TABLE services
  ADD COLUMN IF NOT EXISTS category text,
  ADD COLUMN IF NOT EXISTS status service_status NOT NULL DEFAULT 'draft';

UPDATE services
SET status = CASE WHEN active THEN 'active'::service_status ELSE 'paused'::service_status END
WHERE status = 'draft';

CREATE INDEX IF NOT EXISTS services_professional_id_idx ON services(professional_id);
CREATE INDEX IF NOT EXISTS services_business_id_idx ON services(business_id);
CREATE INDEX IF NOT EXISTS services_status_idx ON services(status);

ALTER TABLE services ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS services_public_read_active ON services;
CREATE POLICY services_public_read_active
ON services
FOR SELECT
USING (status = 'active');

DROP POLICY IF EXISTS services_provider_read_own ON services;
CREATE POLICY services_provider_read_own
ON services
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM professional_profiles pp
    WHERE pp.id = services.professional_id AND pp.user_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM businesses b
    WHERE b.id = services.business_id AND b.owner_user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS services_provider_insert_own ON services;
CREATE POLICY services_provider_insert_own
ON services
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM professional_profiles pp
    WHERE pp.id = services.professional_id AND pp.user_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM businesses b
    WHERE b.id = services.business_id AND b.owner_user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS services_provider_update_own ON services;
CREATE POLICY services_provider_update_own
ON services
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM professional_profiles pp
    WHERE pp.id = services.professional_id AND pp.user_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM businesses b
    WHERE b.id = services.business_id AND b.owner_user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM professional_profiles pp
    WHERE pp.id = services.professional_id AND pp.user_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM businesses b
    WHERE b.id = services.business_id AND b.owner_user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS services_provider_delete_own ON services;
CREATE POLICY services_provider_delete_own
ON services
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM professional_profiles pp
    WHERE pp.id = services.professional_id AND pp.user_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM businesses b
    WHERE b.id = services.business_id AND b.owner_user_id = auth.uid()
  )
);
