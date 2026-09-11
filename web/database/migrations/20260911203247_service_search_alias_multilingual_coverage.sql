-- Expand canonical Services taxonomy search aliases for Tamil + common local English usage.
-- The protected platform_categories metadata remains the source of truth; the existing
-- statement trigger refreshes marketplace_search_taxonomy_public after this update.
-- Existing aliases are preserved in original order and normalized duplicates are ignored.

with additions(category_code, new_aliases) as (
  values
    ('car_bike_wash', array['கார் வாஷ்','பைக் வாஷ்','வாகன வாஷ்','கார் கழுவுதல்']::text[]),
    ('towing_roadside_assistance', array['டோயிங்','டோ வண்டி','ரோட்சைடு உதவி','வாகன மீட்பு']::text[]),
    ('vehicle_electrical', array['ஆட்டோ எலக்ட்ரீஷியன்','வாகன எலக்ட்ரீஷியன்','பேட்டரி ரிப்பேர்','வாகன வயரிங்']::text[]),
    ('accounting_tax', array['கணக்காளர்','ஜிஎஸ்டி தாக்கல்','வரி தாக்கல்','கணக்கு சேவை']::text[]),
    ('business_consulting', array['பிசினஸ் கன்சல்டன்ட்','வணிக ஆலோசகர்','ஸ்டார்ட்அப் ஆலோசனை','பிசினஸ் டெவலப்மெண்ட்']::text[]),
    ('legal_compliance', array['கம்பெனி பதிவு','டிரேட்மார்க்','ஒப்பந்தம் தயாரித்தல்','சட்ட சேவை']::text[]),
    ('printing_document_services', array['ஜெராக்ஸ்','போட்டோகாப்பி','பிரிண்டிங்','ஆவண அச்சிடுதல்']::text[]),
    ('real_estate_services', array['ப்ராப்பர்டி புரோக்கர்','ரியல் எஸ்டேட் ஏஜென்ட்','சொத்து முகவர்','வாடகை புரோக்கர்']::text[]),
    ('beauty_grooming', array['சலூன்','பியூட்டிஷியன்','பார்பர்','மேக்கப் ஆர்டிஸ்ட்','அழகு சேவை']::text[]),
    ('fitness_training', array['பர்சனல் ட்ரெய்னர்','ஃபிட்னஸ் கோச்','ஜிம் ட்ரெய்னர்','உடற்பயிற்சி பயிற்சியாளர்']::text[]),
    ('career_skill_training', array['வேலை பயிற்சி','கேரியர் கோச்சிங்','தொழில் பயிற்சி','திறன் பயிற்சி']::text[]),
    ('computer_digital_skills', array['கம்ப்யூட்டர் கிளாஸ்','கோடிங் கிளாஸ்','கம்ப்யூட்டர் பயிற்சி','டிஜிட்டல் திறன்']::text[]),
    ('language_training', array['ஸ்போக்கன் இங்கிலிஷ்','மொழி வகுப்பு','மொழி ஆசிரியர்','ஆங்கிலப் பேச்சுப் பயிற்சி']::text[]),
    ('music_arts_training', array['மியூசிக் கிளாஸ்','டான்ஸ் கிளாஸ்','டிராயிங் கிளாஸ்','கலை வகுப்பு']::text[]),
    ('acting_performing_arts', array['நடிகர்','நடிகை','பெர்ஃபார்மர்','நடிப்பு கலைஞர்','மேடை கலைஞர்']::text[]),
    ('decoration_services', array['டெக்கரேட்டர்','ஸ்டேஜ் டெக்கரேஷன்','திருமண அலங்காரம்','நிகழ்ச்சி அலங்காரம்']::text[]),
    ('event_planning', array['ஈவென்ட் பிளானர்','வெட்டிங் பிளானர்','பார்ட்டி பிளானர்','நிகழ்ச்சி ஏற்பாட்டாளர்']::text[]),
    ('music_dj_services', array['டிஜே','டிஜே சேவை','ஈவென்ட் டிஜே','இசை சேவை']::text[]),
    ('photography_videography', array['போட்டோகிராபர்','வீடியோகிராபர்','போட்டோ ஸ்டூடியோ','திருமண புகைப்படம்']::text[]),
    ('bakery_sweets', array['பேக்கரி','கேக் கடை','இனிப்பு கடை','கேக் மேக்கர்']::text[]),
    ('catering_services', array['கேட்டரிங்','கேட்டரர்','திருமண கேட்டரிங்','உணவு கேட்டரிங்']::text[]),
    ('diagnostic_labs', array['டயக்னோஸ்டிக் சென்டர்','பிளட் டெஸ்ட் லேப்','மெடிக்கல் லேப்','ரத்த பரிசோதனை']::text[]),
    ('home_healthcare', array['ஹோம் நர்ஸ்','நோயாளர் பராமரிப்பு','ஹோம் கேர்','வீட்டு மருத்துவ பராமரிப்பு']::text[]),
    ('ac_service', array['ac repair','air conditioner service','ac mechanic','ac technician','ஏசி சர்வீஸ்','ஏசி ரிப்பேர்','ஏசி மெக்கானிக்','ஏசி டெக்னீஷியன்']::text[]),
    ('appliance_repair', array['appliance repair','home appliance repair','washing machine repair','fridge repair','அப்ளையன்ஸ் ரிப்பேர்','வீட்டு உபகரண ரிப்பேர்','வாஷிங் மெஷின் ரிப்பேர்','ஃபிரிட்ஜ் ரிப்பேர்']::text[]),
    ('pest_control', array['pest control','termite control','cockroach control','rat control','பெஸ்ட் கண்ட்ரோல்','கரப்பான் பூச்சி ஒழிப்பு','எலி ஒழிப்பு','கரையான் கட்டுப்பாடு']::text[]),
    ('electronics_mobile_shops', array['மொபைல் கடை','போன் கடை','எலக்ட்ரானிக்ஸ் கடை','மொபைல் ஆக்சஸரீஸ்']::text[]),
    ('fashion_clothing', array['ஆடை கடை','டிரஸ் கடை','கார்மெண்ட்ஸ் கடை','டெய்லரிங்','ஃபேஷன் கடை']::text[]),
    ('hardware_electrical_shops', array['ஹார்ட்வேர் கடை','எலக்ட்ரிக்கல் கடை','டூல் கடை','கட்டுமான பொருள் கடை']::text[]),
    ('ai_automation', array['ஏஐ ஏஜென்ட்','ஆட்டோமேஷன்','சாட்பாட்','வொர்க்ஃப்ளோ ஆட்டோமேஷன்','ஏஐ ஆட்டோமேஷன்']::text[]),
    ('software_it_support', array['சாப்ட்வேர் டெவலப்பர்','கஸ்டம் சாப்ட்வேர்','ஈஆர்பி சாப்ட்வேர்','சிஆர்எம் சாப்ட்வேர்','ஐடி சப்போர்ட்']::text[]),
    ('digital_marketing', array['டிஜிட்டல் மார்க்கெட்டிங்','சோஷியல் மீடியா மார்க்கெட்டிங்','எஸ்இஓ','டிஜிட்டல் விளம்பரம்','சோஷியல் மீடியா விளம்பரம்']::text[]),
    ('graphic_design', array['கிராபிக் டிசைனர்','லோகோ டிசைன்','போஸ்டர் டிசைன்','பேனர் டிசைன்','பிராண்டிங் டிசைன்']::text[]),
    ('mobile_app_development', array['ஆப் டெவலப்பர்','மொபைல் டெவலப்பர்','ஆண்ட்ராய்டு டெவலப்பர்','ஐஓஎஸ் டெவலப்பர்','ஆப் டெவலப்மெண்ட்']::text[])
), merged as (
  select child.id,
    array(
      select alias_value
      from (
        select distinct on (alias_norm) alias_value, alias_order
        from (
          select btrim(existing.alias_value) as alias_value,
                 existing.alias_order::bigint as alias_order,
                 lower(regexp_replace(btrim(existing.alias_value),'\s+',' ','g')) as alias_norm
          from jsonb_array_elements_text(
            case when jsonb_typeof(child.metadata -> 'search_aliases')='array'
                 then child.metadata -> 'search_aliases' else '[]'::jsonb end
          ) with ordinality existing(alias_value, alias_order)
          where btrim(existing.alias_value)<>''
          union all
          select btrim(incoming.alias_value),
                 1000 + incoming.alias_order::bigint,
                 lower(regexp_replace(btrim(incoming.alias_value),'\s+',' ','g'))
          from unnest(additions.new_aliases) with ordinality incoming(alias_value, alias_order)
          where btrim(incoming.alias_value)<>''
        ) combined
        order by alias_norm, alias_order
      ) deduped
      order by alias_order
    ) as aliases
  from public.platform_categories child
  join public.platform_applications app on app.id=child.application_id and app.code='services'
  join additions on additions.category_code=child.code
  where child.active=true and child.parent_id is not null
)
update public.platform_categories child
set metadata=jsonb_set(coalesce(child.metadata,'{}'::jsonb),'{search_aliases}',to_jsonb(merged.aliases),true),
    updated_at=now()
from merged
where child.id=merged.id;
