-- Seeds the six services shown in the browsing/discovery UI (web/data/discovery-fixtures.ts)
-- into the real catalog tables, using the exact same UUIDs the client already sends as
-- service_id/provider_id when creating a booking. Without these rows, public.bookings'
-- NOT NULL foreign key to public.services(id) rejects every booking insert.
--
-- These are unclaimed listings: professional_profiles.user_id / businesses.owner_user_id
-- are left NULL (requires 20260817b_nullable_provider_owner.sql to run first). No auth.users
-- rows are created or modified here. Link a listing to a real provider later with a plain
-- UPDATE once that professional/business registers and is verified.
--
-- Safe to re-run: every insert is idempotent (ON CONFLICT DO NOTHING).

insert into public.professional_profiles (id, user_id, headline, description, service_area, verified) values
  ('5f7a3b3f-54e5-4f6c-a070-3c63f4e9c001', null, 'Brand identity starter kit', 'A focused identity system to help a new business show up with confidence.', 'Remote delivery across India', true),
  ('5f7a3b3f-54e5-4f6c-a070-3c63f4e9c003', null, 'Small event photography', 'Warm, natural coverage for intimate events and milestone days.', 'Kochi and nearby areas', false)
on conflict (id) do nothing;

insert into public.businesses (id, owner_user_id, name, description, location, verified) values
  ('6a8b4c4a-65f6-4f7d-b181-4d74f5fad001', null, 'Brightline Services', 'Home electrical and cleaning services.', 'Chennai, Tamil Nadu', true),
  ('6a8b4c4a-65f6-4f7d-b181-4d74f5fad002', null, 'Northstar Learning', 'Maths coaching for school-age students.', 'Bengaluru, Karnataka', true),
  ('6a8b4c4a-65f6-4f7d-b181-4d74f5fad003', null, 'PixelCraft Studio', 'Small business websites and web presence.', 'Remote delivery across India', true)
on conflict (id) do nothing;

insert into public.services (id, provider_type, professional_id, business_id, name, description, location, duration_minutes, base_price, currency, active) values
  ('4e6f2a2e-43d4-4f5b-9f6f-2b52f3d8b001', 'business', null, '6a8b4c4a-65f6-4f7d-b181-4d74f5fad001', 'Home electrical inspection', 'A careful safety check for switches, wiring, and common electrical issues.', 'Chennai, Tamil Nadu', 90, 850, 'INR', true),
  ('4e6f2a2e-43d4-4f5b-9f6f-2b52f3d8b002', 'professional', '5f7a3b3f-54e5-4f6c-a070-3c63f4e9c001', null, 'Brand identity starter kit', 'A focused identity system to help a new business show up with confidence.', 'Remote delivery', 240, 4500, 'INR', true),
  ('4e6f2a2e-43d4-4f5b-9f6f-2b52f3d8b003', 'business', null, '6a8b4c4a-65f6-4f7d-b181-4d74f5fad002', 'Maths coaching for grades 8-10', 'Patient, structured coaching with a plan for stronger fundamentals.', 'Bengaluru, Karnataka', 60, 600, 'INR', true),
  ('4e6f2a2e-43d4-4f5b-9f6f-2b52f3d8b004', 'business', null, '6a8b4c4a-65f6-4f7d-b181-4d74f5fad001', 'Deep home cleaning', 'A detailed reset for kitchens, bathrooms, and high-use living spaces.', 'Chennai, Tamil Nadu', 180, 1200, 'INR', true),
  ('4e6f2a2e-43d4-4f5b-9f6f-2b52f3d8b005', 'professional', '5f7a3b3f-54e5-4f6c-a070-3c63f4e9c003', null, 'Small event photography', 'Warm, natural coverage for intimate events and milestone days.', 'Kochi, Kerala', 240, 6500, 'INR', true),
  ('4e6f2a2e-43d4-4f5b-9f6f-2b52f3d8b006', 'business', null, '6a8b4c4a-65f6-4f7d-b181-4d74f5fad003', 'Small business website setup', 'A clear, maintainable website foundation for a growing local business.', 'Remote delivery', 300, 12000, 'INR', true)
on conflict (id) do nothing;
