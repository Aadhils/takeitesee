import { supabase } from './supabase';

export type AccountPreferences = { notifyBookingUpdates: boolean; notifyReviewReminders: boolean; notifyProductUpdates: boolean; useHistoryForRecommendations: boolean };
type PreferencesRow = { notify_booking_updates: boolean; notify_review_reminders: boolean; notify_product_updates: boolean; use_history_for_recommendations: boolean };
const columns = 'user_id,notify_booking_updates,notify_review_reminders,notify_product_updates,use_history_for_recommendations';
const fromRow = (row: PreferencesRow | null): AccountPreferences => ({
  notifyBookingUpdates: row?.notify_booking_updates ?? true,
  notifyReviewReminders: row?.notify_review_reminders ?? true,
  notifyProductUpdates: row?.notify_product_updates ?? false,
  useHistoryForRecommendations: row?.use_history_for_recommendations ?? true,
});
async function requireOwner(userId: string) {
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session || data.session.user.id !== userId) throw new Error('Sign in again to manage your settings.');
}
export async function fetchAccountPreferences(userId: string): Promise<AccountPreferences> {
  await requireOwner(userId);
  const { data, error } = await supabase.from('customer_profiles').select(columns).eq('user_id', userId).maybeSingle();
  if (error) throw new Error('Your settings could not load. Please retry.');
  await requireOwner(userId);
  return fromRow(data as PreferencesRow | null);
}
export async function saveAccountPreferences(userId: string, input: AccountPreferences): Promise<AccountPreferences> {
  for (const value of [input.notifyBookingUpdates, input.notifyReviewReminders, input.notifyProductUpdates, input.useHistoryForRecommendations]) {
    if (typeof value !== 'boolean') throw new Error('Choose valid settings before saving.');
  }
  await requireOwner(userId);
  // Existing self-owned RLS policy; patch only these preferences, preserving profile/language/accessibility fields.
  const { data, error } = await supabase.from('customer_profiles').upsert({
    user_id: userId,
    notify_booking_updates: input.notifyBookingUpdates,
    notify_review_reminders: input.notifyReviewReminders,
    notify_product_updates: input.notifyProductUpdates,
    use_history_for_recommendations: input.useHistoryForRecommendations,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id' }).select(columns).single();
  if (error || !data || data.user_id !== userId) throw new Error('Settings could not be saved. Please retry.');
  await requireOwner(userId);
  return fromRow(data as PreferencesRow);
}
