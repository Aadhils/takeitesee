-- Product Order Conversation Schema Foundation
--
-- Extend the existing secure marketplace conversation model with a Business
-- product-order context. This migration does not create conversations, expose a
-- new messaging UI, or change existing requirement/job messaging behavior.
-- Payment, Cashfree, refund, payout, settlement, reconciliation, recovery,
-- recurrence, and inventory behavior remain untouched.

alter table public.marketplace_conversations
  add column business_product_order_id uuid;

alter table public.marketplace_conversations
  add constraint marketplace_conversations_business_product_order_id_fkey
  foreign key (business_product_order_id)
  references public.business_product_orders(id)
  on delete restrict;

alter table public.marketplace_conversations
  add constraint marketplace_conversations_business_product_order_id_key
  unique (business_product_order_id);

alter table public.marketplace_conversations
  drop constraint marketplace_conversations_conversation_kind_check,
  drop constraint marketplace_conversations_context_check,
  drop constraint marketplace_conversations_closed_reason_check;

alter table public.marketplace_conversations
  add constraint marketplace_conversations_conversation_kind_check
    check (conversation_kind = any (array[
      'requirement'::text,
      'job_application'::text,
      'product_order'::text
    ])),
  add constraint marketplace_conversations_context_check
    check (
      (
        conversation_kind='requirement'
        and requirement_id is not null
        and proposal_id is not null
        and job_application_id is null
        and business_product_order_id is null
      )
      or
      (
        conversation_kind='job_application'
        and requirement_id is null
        and proposal_id is null
        and job_application_id is not null
        and business_product_order_id is null
      )
      or
      (
        conversation_kind='product_order'
        and requirement_id is null
        and proposal_id is null
        and job_application_id is null
        and business_product_order_id is not null
      )
    ),
  add constraint marketplace_conversations_closed_reason_check
    check (
      closed_reason is null
      or closed_reason = any (array[
        'fulfilled'::text,
        'cancelled'::text,
        'declined'::text,
        'hired'::text,
        'rejected'::text,
        'withdrawn'::text
      ])
    );
