import { supabase } from './supabase';
export const accountLanguages = ['English', 'Tamil', 'Hindi', 'Malayalam'] as const;
export type AccountLanguage = typeof accountLanguages[number];
export type ExperiencePreferences = { preferredLanguage: AccountLanguage; reducedMotion: boolean; largerText: boolean };
type Row = { user_id: string; preferred_language: string; reduced_motion: boolean; larger_text: boolean };
const columns = 'user_id,preferred_language,reduced_motion,larger_text';
function fromRow(row: Row | null): ExperiencePreferences {
 const language = row?.preferred_language ?? 'English';
 if (!accountLanguages.includes(language as AccountLanguage)) throw new Error('Your saved language is not supported by this editor. Review it on the website.');
 return { preferredLanguage: language as AccountLanguage, reducedMotion: row?.reduced_motion ?? false, largerText: row?.larger_text ?? false };
}
async function owner(userId: string) { const { data, error } = await supabase.auth.getSession(); if (error || !data.session || data.session.user.id !== userId) throw new Error('Sign in again to manage preferences.'); }
export async function fetchExperiencePreferences(userId: string) {
 await owner(userId);
 const { data, error } = await supabase.from('customer_profiles').select(columns).eq('user_id', userId).maybeSingle();
 await owner(userId);
 if (error || (data && data.user_id !== userId)) throw new Error('Your preferences could not load. Please retry.');
 return fromRow(data as Row | null);
}
export async function saveExperiencePreferences(userId: string, input: ExperiencePreferences) {
 if (!accountLanguages.includes(input.preferredLanguage) || typeof input.reducedMotion !== 'boolean' || typeof input.largerText !== 'boolean') throw new Error('Choose valid preferences.');
 await owner(userId);
 const { data, error } = await supabase.from('customer_profiles').upsert({ user_id: userId, preferred_language: input.preferredLanguage, reduced_motion: input.reducedMotion, larger_text: input.largerText, updated_at: new Date().toISOString() }, { onConflict: 'user_id' }).select(columns).single();
 await owner(userId);
 if (error || !data || data.user_id !== userId) throw new Error('Save could not be confirmed. Reload preferences before saving again.');
 return fromRow(data as Row);
}
