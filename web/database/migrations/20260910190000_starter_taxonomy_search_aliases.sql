-- Starter governed search aliases for the canonical TakeItEsee Services taxonomy.
-- Aliases enrich public discovery only. They do not change Provider identity,
-- service category approval, marketplace eligibility, or Provider scope.

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
), aliases(code, search_aliases) AS (
  VALUES
    ('plumbing', ARRAY['plumber','pipe repair','water leak','tap repair','பிளம்பர்','குழாய் பழுது']::text[]),
    ('electrical', ARRAY['electrician','electrical work','wiring','current work','எலக்ட்ரீஷியன்','மின்சார வேலை']::text[]),
    ('cleaning', ARRAY['cleaner','house cleaning','home cleaner','deep cleaner','வீடு சுத்தம்']::text[]),
    ('drainage_sewer_cleaning', ARRAY['drainage cleaner','sewer cleaning','drain cleaning','blockage cleaning','டிரெய்னேஜ்','கழிவுநீர் சுத்தம்']::text[]),
    ('gardening_outdoor_maintenance', ARRAY['garden cleaner','gardener','garden maintenance','lawn care','தோட்டம் சுத்தம்']::text[]),
    ('carpentry', ARRAY['carpenter','wood work','furniture repair','தச்சர்']::text[]),
    ('painting', ARRAY['painter','house painter','wall painting','பெயிண்டர்']::text[]),

    ('vehicle_mechanic', ARRAY['mechanic','bike mechanic','car mechanic','auto mechanic','vehicle repair','மெக்கானிக்']::text[]),
    ('tyre_puncture_repair', ARRAY['puncture','puncture shop','tyre puncture','tire puncture','tyre repair','tire repair','பஞ்சர்','டயர் பஞ்சர்']::text[]),
    ('vehicle_electrical', ARRAY['auto electrician','vehicle electrician','battery repair','vehicle wiring']::text[]),
    ('car_bike_wash', ARRAY['car wash','bike wash','vehicle wash','car cleaning']::text[]),
    ('driver_services', ARRAY['acting driver','temporary driver','personal driver','driver on demand','டிரைவர்','ஆக்டிங் டிரைவர்']::text[]),
    ('towing_roadside_assistance', ARRAY['towing','tow truck','breakdown service','roadside help','roadside assistance']::text[]),

    ('child_care', ARRAY['babysitter','baby sitter','nanny','child minder','குழந்தை பராமரிப்பு']::text[]),
    ('elder_care', ARRAY['elderly care','senior care','elder caretaker','முதியோர் பராமரிப்பு']::text[]),
    ('beauty_grooming', ARRAY['salon','beautician','barber','makeup artist','beauty service']::text[]),
    ('fitness_training', ARRAY['personal trainer','fitness coach','gym trainer','workout trainer']::text[]),

    ('cook_chef_services', ARRAY['cook','chef','biryani master','cooking master','home cook','சமையல்காரர்','பிரியாணி மாஸ்டர்']::text[]),
    ('catering_services', ARRAY['caterer','party catering','wedding catering','food catering']::text[]),
    ('tea_beverage_services', ARRAY['tea master','tea maker','beverage maker','டீ மாஸ்டர்','தேநீர்']::text[]),
    ('restaurants_food_stalls', ARRAY['restaurant','food stall','biryani shop','biryani stall','உணவகம்','பிரியாணி கடை']::text[]),
    ('bakery_sweets', ARRAY['bakery','cake shop','sweet shop','cake maker']::text[]),

    ('website_development', ARRAY['web developer','website developer','web design','website design','web development','வெப்சைட் டெவலப்பர்']::text[]),
    ('mobile_app_development', ARRAY['app developer','mobile developer','android developer','ios developer','app development']::text[]),
    ('software_it_support', ARRAY['software developer','custom software','erp software','crm software','it support']::text[]),
    ('graphic_design', ARRAY['graphic designer','logo design','poster design','banner design','branding design']::text[]),
    ('digital_marketing', ARRAY['social media marketing','online marketing','seo','digital ads','social media ads']::text[]),
    ('ai_automation', ARRAY['ai agent','automation','chatbot','workflow automation','ai automation service']::text[]),

    ('clinics', ARRAY['clinic','doctor clinic','medical clinic','கிளினிக்']::text[]),
    ('hospitals', ARRAY['hospital','multi specialty hospital','மருத்துவமனை']::text[]),
    ('pharmacies', ARRAY['medical shop','medical store','pharmacy','chemist','medicine shop','மெடிக்கல் ஷாப்','மருந்தகம்']::text[]),
    ('diagnostic_labs', ARRAY['diagnostic center','diagnostic centre','pathology lab','blood test lab','medical lab']::text[]),
    ('home_healthcare', ARRAY['home nurse','patient care','home patient care','home care']::text[]),

    ('tuition_coaching', ARRAY['tuition center','tuition centre','coaching center','coaching centre','academy','tutor','டியூஷன்','அகாடமி']::text[]),
    ('language_training', ARRAY['spoken english','language class','language tutor','spoken language']::text[]),
    ('computer_digital_skills', ARRAY['computer class','coding class','computer training','digital skills']::text[]),
    ('music_arts_training', ARRAY['music class','dance class','drawing class','arts class']::text[]),
    ('career_skill_training', ARRAY['job training','career coaching','vocational training','skill training']::text[]),

    ('legal_compliance', ARRAY['company registration','trademark','agreement drafting','legal service','business registration']::text[]),
    ('accounting_tax', ARRAY['accountant','gst filing','tax filing','bookkeeping','accounts service']::text[]),
    ('business_consulting', ARRAY['business consultant','startup consulting','business development','growth consultant']::text[]),
    ('real_estate_services', ARRAY['property broker','real estate agent','property agent','rental broker']::text[]),
    ('printing_document_services', ARRAY['xerox','photocopy','printing shop','document printing']::text[]),

    ('meat_butcher_shops', ARRAY['meat shop','mutton shop','beef shop','butcher','butcher shop','இறைச்சி கடை','மட்டன் கடை']::text[]),
    ('fish_seafood_shops', ARRAY['fish shop','seafood shop','fish market','மீன் கடை']::text[]),
    ('grocery_general_stores', ARRAY['grocery shop','provision store','general store','மளிகை கடை']::text[]),
    ('hardware_electrical_shops', ARRAY['hardware shop','electrical shop','tool shop','building materials shop']::text[]),
    ('electronics_mobile_shops', ARRAY['mobile shop','phone shop','electronics shop','mobile accessories']::text[]),
    ('fashion_clothing', ARRAY['clothing shop','dress shop','garment shop','tailoring','fashion store']::text[]),

    ('photography_videography', ARRAY['photographer','videographer','photo studio','wedding photography']::text[]),
    ('event_planning', ARRAY['event planner','wedding planner','party planner','event organizer']::text[]),
    ('decoration_services', ARRAY['decorator','stage decoration','wedding decoration','event decoration']::text[]),
    ('music_dj_services', ARRAY['dj','dj service','disc jockey','event dj']::text[]),
    ('acting_performing_arts', ARRAY['actor','actress','performer','acting artist','performing artist']::text[])
)
UPDATE public.platform_categories pc
SET metadata = coalesce(pc.metadata, '{}'::jsonb)
    || jsonb_build_object(
      'search_aliases', to_jsonb(aliases.search_aliases),
      'search_alias_version', 'starter_v1'
    ),
    updated_at = now()
FROM app, aliases
WHERE pc.application_id = app.id
  AND pc.code = aliases.code;

DO $$
DECLARE
  alias_count integer;
BEGIN
  SELECT count(*)
  INTO alias_count
  FROM public.platform_categories pc
  JOIN public.platform_applications pa ON pa.id = pc.application_id
  WHERE pa.code = 'services'
    AND pc.metadata ? 'search_aliases';

  IF alias_count < 50 THEN
    RAISE EXCEPTION 'Expected at least 50 canonical categories with governed search aliases, found %.', alias_count;
  END IF;
END
$$;
