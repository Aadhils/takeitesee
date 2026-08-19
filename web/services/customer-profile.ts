import { createSupabaseBrowserClient } from '../lib/supabase/browser';

export type CustomerProfile = {
  displayName: string;
  email: string;
  phone: string;
  location: string;
  preferredLanguage: string;
  serviceRegions: string[];
  memberSince: string;
};

type UserRow = {
  name: string;
  email: string;
  phone: string | null;
  created_at: string;
};

type CustomerProfileRow = {
  default_location: string | null;
  preferred_language: string;
  service_regions: string[];
};

export type AccountSettings = {
  preferredLanguage: string;
  notifyBookingUpdates: boolean;
  notifyReviewReminders: boolean;
  notifyProductUpdates: boolean;
  reducedMotion: boolean;
  largerText: boolean;
  useHistoryForRecommendations: boolean;
};

type AccountSettingsRow = {
  preferred_language: string;
  notify_booking_updates: boolean;
  notify_review_reminders: boolean;
  notify_product_updates: boolean;
  reduced_motion: boolean;
  larger_text: boolean;
  use_history_for_recommendations: boolean;
};

export async function getCustomerProfile(userId: string, authEmail?: string): Promise<CustomerProfile> {
  const supabase = createSupabaseBrowserClient();
  const [{ data: user, error: userError }, { data: profile, error: profileError }] = await Promise.all([
    supabase.from('users').select('name, email, phone, created_at').eq('id', userId).maybeSingle(),
    supabase.from('customer_profiles').select('default_location, preferred_language, service_regions').eq('user_id', userId).maybeSingle(),
  ]);
  if (userError) throw new Error(userError.message);
  if (profileError) throw new Error(profileError.message);
  if (!user) throw new Error('Your account profile could not be found.');
  return toCustomerProfile(user as UserRow, profile as CustomerProfileRow | null, authEmail);
}

export async function saveCustomerProfile(userId: string, input: Pick<CustomerProfile, 'displayName' | 'phone' | 'location' | 'preferredLanguage' | 'serviceRegions'>) {
  const supabase = createSupabaseBrowserClient();
  const { error: userError } = await supabase.from('users').update({ name: input.displayName.trim(), phone: input.phone.trim() || null, updated_at: new Date().toISOString() }).eq('id', userId);
  if (userError) throw new Error(userError.message);
  const { error: profileError } = await supabase.from('customer_profiles').upsert({
    user_id: userId,
    default_location: input.location.trim() || null,
    preferred_language: input.preferredLanguage,
    service_regions: input.serviceRegions,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id' });
  if (profileError) throw new Error(profileError.message);
}

function toCustomerProfile(user: UserRow, profile: CustomerProfileRow | null, authEmail?: string): CustomerProfile {
  return {
    displayName: user.name,
    email: authEmail ?? user.email,
    phone: user.phone ?? '',
    location: profile?.default_location ?? '',
    preferredLanguage: profile?.preferred_language ?? 'English',
    serviceRegions: profile?.service_regions ?? [],
    memberSince: user.created_at,
  };
}

export async function getAccountSettings(userId: string): Promise<AccountSettings> {
  const supabase = createSupabaseBrowserClient();
  const { data: settings, error } = await supabase
    .from('customer_profiles')
    .select('preferred_language, notify_booking_updates, notify_review_reminders, notify_product_updates, reduced_motion, larger_text, use_history_for_recommendations')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return toAccountSettings(settings as AccountSettingsRow | null);
}

export async function saveAccountSettings(userId: string, input: AccountSettings) {
  const supabase = createSupabaseBrowserClient();
  const { error } = await supabase.from('customer_profiles').upsert({
    user_id: userId,
    preferred_language: input.preferredLanguage,
    notify_booking_updates: input.notifyBookingUpdates,
    notify_review_reminders: input.notifyReviewReminders,
    notify_product_updates: input.notifyProductUpdates,
    reduced_motion: input.reducedMotion,
    larger_text: input.largerText,
    use_history_for_recommendations: input.useHistoryForRecommendations,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id' });
  if (error) throw new Error(error.message);
}

function toAccountSettings(settings: AccountSettingsRow | null): AccountSettings {
  return {
    preferredLanguage: settings?.preferred_language ?? 'English',
    notifyBookingUpdates: settings?.notify_booking_updates ?? true,
    notifyReviewReminders: settings?.notify_review_reminders ?? true,
    notifyProductUpdates: settings?.notify_product_updates ?? false,
    reducedMotion: settings?.reduced_motion ?? false,
    largerText: settings?.larger_text ?? false,
    useHistoryForRecommendations: settings?.use_history_for_recommendations ?? true,
  };
}
