-- Phase 17: optimize marketplace messaging core read RLS auth initplans.
--
-- Only row-independent auth.uid() calls are wrapped in scalar subqueries.
-- Existing authenticated role and customer/provider participant ownership remain
-- unchanged. These policies are SELECT-only.
--
-- Message INSERT/send behavior, conversation mutation, read-marker write/upsert
-- behavior, marketplace requirement jobs, moderation/reporting, review INSERT,
-- and all Cashfree, payment, refund, payout, and finance policies are intentionally
-- outside this migration.

alter policy marketplace_conversations_participant_read
  on public.marketplace_conversations
  using (
    customer_id = (select auth.uid())
    or provider_user_id = (select auth.uid())
  );

alter policy marketplace_messages_participant_read
  on public.marketplace_messages
  using (
    exists (
      select 1
      from public.marketplace_conversations c
      where c.id = marketplace_messages.conversation_id
        and (
          c.customer_id = (select auth.uid())
          or c.provider_user_id = (select auth.uid())
        )
    )
  );

alter policy marketplace_conversation_reads_own_read
  on public.marketplace_conversation_reads
  using (
    user_id = (select auth.uid())
  );
