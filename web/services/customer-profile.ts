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
