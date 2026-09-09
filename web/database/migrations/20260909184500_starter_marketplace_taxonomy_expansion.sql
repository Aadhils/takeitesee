-- Starter marketplace taxonomy expansion.
-- Adds canonical root groups and concrete leaf specialties for the TakeItEsee Services application.
-- Provider identity remains Professional OR Business; these categories classify offerings, not provider identity.

DO $$
BEGIN
  IF (SELECT count(*) FROM public.platform_applications WHERE code = 'services') <> 1 THEN
    RAISE EXCEPTION 'Expected exactly one platform application with code=services.';
  END IF;
END
$$;

WITH app AS (
  SELECT id
  FROM public.platform_applications
  WHERE code = 'services'
), roots(code, name, description, sort_order) AS (
  VALUES
    ('automotive_mobility', 'Automotive & Mobility', 'Vehicle repair, roadside help, driver and mobility-related services.', 100),
    ('care_personal_services', 'Care & Personal Services', 'Child care, elder care, grooming, fitness and other personal support services.', 200),
    ('food_catering', 'Food & Catering', 'Cooking, catering, beverages, restaurants, food stalls, bakery and related services.', 300),
    ('technology_digital', 'Technology & Digital', 'Web, mobile, software, design, marketing, AI and digital technology services.', 400),
    ('health_wellness', 'Health & Wellness', 'Clinics, hospitals, pharmacies, diagnostics and healthcare service categories.', 500),
    ('education_training', 'Education & Training', 'Tuition, coaching, language, digital skills, arts and career training services.', 600),
    ('business_professional_services', 'Business & Professional Services', 'Legal, accounting, consulting, real-estate and document-related professional services.', 700),
    ('retail_local_shops', 'Retail & Local Shops', 'Local retail stores covering food, household, electronics, fashion and everyday goods.', 800),
    ('events_creative_services', 'Events & Creative Services', 'Photography, event planning, decoration, music and performing-arts services.', 900)
)
INSERT INTO public.platform_categories (
  application_id,
  parent_id,
  code,
  name,
  description,
  active,
  sort_order,
  metadata
)
SELECT
  app.id,
  NULL,
  roots.code,
  roots.name,
  roots.description,
  true,
  roots.sort_order,
  jsonb_build_object('taxonomy_seed', 'starter_v1', 'taxonomy_level', 'root')
FROM app
CROSS JOIN roots
ON CONFLICT (application_id, code) DO NOTHING;

WITH app AS (
  SELECT id
  FROM public.platform_applications
  WHERE code = 'services'
), leaves(parent_code, code, name, description, sort_order) AS (
  VALUES
    -- Home Services additions. Existing Plumbing/Electrical/Cleaning/AC/Appliance/Pest Control remain unchanged.
    ('home_services', 'drainage_sewer_cleaning', 'Drainage & Sewer Cleaning', 'Drain, sewer, blockage and sanitation cleaning services.', 60),
    ('home_services', 'gardening_outdoor_maintenance', 'Gardening & Outdoor Maintenance', 'Garden cleaning, trimming, lawn care and outdoor property maintenance.', 70),
    ('home_services', 'carpentry', 'Carpentry', 'Furniture, woodwork, fitting, repair and general carpentry services.', 80),
    ('home_services', 'painting', 'Painting', 'Interior, exterior, touch-up and property painting services.', 90),

    -- Automotive & Mobility.
    ('automotive_mobility', 'vehicle_mechanic', 'Vehicle Mechanic', 'Mechanical inspection, repair and maintenance for cars, bikes and other vehicles.', 0),
    ('automotive_mobility', 'tyre_puncture_repair', 'Tyre & Puncture Repair', 'Tyre inspection, puncture repair, replacement and related roadside tyre services.', 10),
    ('automotive_mobility', 'vehicle_electrical', 'Vehicle Electrical', 'Battery, wiring, lighting, starter and other vehicle electrical services.', 20),
    ('automotive_mobility', 'car_bike_wash', 'Car & Bike Wash', 'Vehicle washing, cleaning and basic detailing services.', 30),
    ('automotive_mobility', 'driver_services', 'Driver Services', 'Temporary, acting, personal and on-demand driver services.', 40),
    ('automotive_mobility', 'towing_roadside_assistance', 'Towing & Roadside Assistance', 'Vehicle towing, breakdown support and roadside assistance.', 50),

    -- Care & Personal Services.
    ('care_personal_services', 'child_care', 'Child Care', 'Babysitting and child-care support services.', 0),
    ('care_personal_services', 'elder_care', 'Elder Care', 'Non-emergency elder assistance, companionship and daily support services.', 10),
    ('care_personal_services', 'beauty_grooming', 'Beauty & Grooming', 'Hair, grooming, salon and personal beauty services.', 20),
    ('care_personal_services', 'fitness_training', 'Fitness Training', 'Personal fitness coaching, exercise guidance and training services.', 30),

    -- Food & Catering.
    ('food_catering', 'cook_chef_services', 'Cooking & Chef Services', 'Home cooks, specialist chefs and food preparation professionals.', 0),
    ('food_catering', 'catering_services', 'Catering Services', 'Event, party, corporate and bulk food catering services.', 10),
    ('food_catering', 'tea_beverage_services', 'Tea & Beverage Services', 'Tea masters, beverage specialists and drink preparation services.', 20),
    ('food_catering', 'restaurants_food_stalls', 'Restaurants & Food Stalls', 'Restaurants, biryani stalls, meal outlets and local prepared-food businesses.', 30),
    ('food_catering', 'bakery_sweets', 'Bakery & Sweets', 'Bakeries, cake makers, sweet shops and dessert businesses.', 40),

    -- Technology & Digital.
    ('technology_digital', 'website_development', 'Website Development', 'Website design, development, maintenance and related web services.', 0),
    ('technology_digital', 'mobile_app_development', 'Mobile App Development', 'Android, iOS and cross-platform mobile application development.', 10),
    ('technology_digital', 'software_it_support', 'Custom Software & IT Support', 'Custom software, business systems, technical support and IT services.', 20),
    ('technology_digital', 'graphic_design', 'Graphic Design', 'Branding, logo, marketing artwork and general graphic design services.', 30),
    ('technology_digital', 'digital_marketing', 'Digital Marketing', 'Social media, campaigns, SEO and online marketing services.', 40),
    ('technology_digital', 'ai_automation', 'AI & Automation', 'AI-enabled workflows, automation, agents and intelligent business process services.', 50),

    -- Health & Wellness. Keep Clinic, Hospital and Pharmacy distinct for discovery and verification.
    ('health_wellness', 'clinics', 'Clinics', 'Clinics and outpatient healthcare providers.', 0),
    ('health_wellness', 'hospitals', 'Hospitals', 'Hospital and institutional healthcare provider listings.', 10),
    ('health_wellness', 'pharmacies', 'Pharmacies', 'Licensed medical and pharmacy store listings.', 20),
    ('health_wellness', 'diagnostic_labs', 'Diagnostic Labs', 'Diagnostic, pathology and medical testing laboratory listings.', 30),
    ('health_wellness', 'home_healthcare', 'Home Healthcare', 'Eligible home healthcare and patient-support service providers.', 40),

    -- Education & Training.
    ('education_training', 'tuition_coaching', 'Tuition & Coaching', 'School tuition, academic coaching and learning-centre services.', 0),
    ('education_training', 'language_training', 'Language Training', 'Language teaching, spoken-language coaching and communication training.', 10),
    ('education_training', 'computer_digital_skills', 'Computer & Digital Skills', 'Computer basics, software tools, coding and digital-skills training.', 20),
    ('education_training', 'music_arts_training', 'Music & Arts Training', 'Music, dance, drawing and creative-arts instruction.', 30),
    ('education_training', 'career_skill_training', 'Career & Skill Training', 'Vocational, job-readiness, professional and career-development training.', 40),

    -- Business & Professional Services.
    ('business_professional_services', 'legal_compliance', 'Legal & Compliance', 'Business legal support, registrations, agreements and compliance services.', 0),
    ('business_professional_services', 'accounting_tax', 'Accounting & Tax', 'Bookkeeping, accounting, tax filing and finance administration services.', 10),
    ('business_professional_services', 'business_consulting', 'Business Consulting', 'Business planning, strategy, development and growth consulting.', 20),
    ('business_professional_services', 'real_estate_services', 'Real Estate Services', 'Property brokerage, rental support and real-estate service providers.', 30),
    ('business_professional_services', 'printing_document_services', 'Printing & Document Services', 'Printing, photocopying, document preparation and related local services.', 40),

    -- Retail & Local Shops.
    ('retail_local_shops', 'meat_butcher_shops', 'Meat & Butcher Shops', 'Beef, mutton and other meat retail or butcher businesses.', 0),
    ('retail_local_shops', 'fish_seafood_shops', 'Fish & Seafood Shops', 'Fish and seafood retail businesses.', 10),
    ('retail_local_shops', 'grocery_general_stores', 'Grocery & General Stores', 'Grocery, provisions and everyday general retail stores.', 20),
    ('retail_local_shops', 'hardware_electrical_shops', 'Hardware & Electrical Shops', 'Hardware, tools, building supplies and electrical retail stores.', 30),
    ('retail_local_shops', 'electronics_mobile_shops', 'Electronics & Mobile Shops', 'Consumer electronics, mobile phone and accessory retailers.', 40),
    ('retail_local_shops', 'fashion_clothing', 'Fashion & Clothing', 'Clothing, tailoring, fashion and apparel retail businesses.', 50),

    -- Events & Creative Services.
    ('events_creative_services', 'photography_videography', 'Photography & Videography', 'Photography, video production and event media services.', 0),
    ('events_creative_services', 'event_planning', 'Event Planning', 'Wedding, party, corporate and local event planning services.', 10),
    ('events_creative_services', 'decoration_services', 'Decoration Services', 'Stage, venue, floral and event decoration services.', 20),
    ('events_creative_services', 'music_dj_services', 'Music & DJ Services', 'DJs, live music and event audio entertainment services.', 30),
    ('events_creative_services', 'acting_performing_arts', 'Acting & Performing Arts', 'Actors, performers and live creative talent services.', 40)
)
INSERT INTO public.platform_categories (
  application_id,
  parent_id,
  code,
  name,
  description,
  active,
  sort_order,
  metadata
)
SELECT
  app.id,
  parent.id,
  leaves.code,
  leaves.name,
  leaves.description,
  true,
  leaves.sort_order,
  jsonb_build_object('taxonomy_seed', 'starter_v1', 'taxonomy_level', 'leaf')
FROM app
JOIN leaves ON true
JOIN public.platform_categories parent
  ON parent.application_id = app.id
 AND parent.code = leaves.parent_code
ON CONFLICT (application_id, code) DO NOTHING;
