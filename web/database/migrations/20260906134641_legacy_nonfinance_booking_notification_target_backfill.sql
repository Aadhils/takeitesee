-- Backfill historical non-finance booking/review notifications created before
-- booking lifecycle and interaction deep links were introduced.
--
-- Current emitters/resolvers already write the correct destinations. This data-only
-- migration changes navigation metadata for existing rows only and preserves all
-- Finance/Cashfree/payment/refund/payout/settlement/recovery rows unchanged.

with provider_owner as (
  select b.id as booking_id,
         case
           when b.provider_type::text='business' then biz.owner_user_id
           else pro.user_id
         end as provider_user_id
  from public.bookings b
  left join public.businesses biz on biz.id=b.business_id
  left join public.professional_profiles pro on pro.id=b.professional_id
)
update public.notifications n
set target_path = case
  when n.event_type='review_submitted' then '/provider/reviews'
  when n.event_type='completion_confirmed' then '/provider/bookings/' || n.booking_id::text
  when n.event_type='review_response' then '/bookings/' || n.booking_id::text
  when n.recipient_user_id=b.customer_id then '/bookings/' || n.booking_id::text
  when n.recipient_user_id=po.provider_user_id then '/provider/bookings/' || n.booking_id::text
  else n.target_path
end
from public.bookings b
join provider_owner po on po.booking_id=b.id
where n.booking_id=b.id
  and n.target_path is null
  and n.event_type in (
    'booking_created',
    'booking_accepted',
    'service_completed',
    'completion_confirmed',
    'review_response',
    'review_submitted'
  )
  and (
    n.event_type in ('review_submitted','completion_confirmed','review_response')
    or n.recipient_user_id=b.customer_id
    or n.recipient_user_id=po.provider_user_id
  );
