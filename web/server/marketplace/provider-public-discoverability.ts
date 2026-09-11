import 'server-only';
import { createClient } from '@supabase/supabase-js';

const chunkSize = 200;

function publicSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

function normalizedIds(ids: readonly string[]) {
  return Array.from(new Set(ids.map((id) => String(id || '').trim()).filter(Boolean)));
}

export async function loadPublicServiceIds(ids: readonly string[]): Promise<Set<string> | null> {
  const targets = normalizedIds(ids);
  if (!targets.length) return new Set<string>();
  const supabase = publicSupabase();
  if (!supabase) return null;

  const visible = new Set<string>();
  for (let start = 0; start < targets.length; start += chunkSize) {
    const chunk = targets.slice(start, start + chunkSize);
    const { data, error } = await supabase.from('services').select('id').in('id', chunk);
    if (error) return null;
    for (const row of data ?? []) if (row.id) visible.add(String(row.id));
  }
  return visible;
}

export async function loadPublicProductIds(ids: readonly string[]): Promise<Set<string> | null> {
  const targets = normalizedIds(ids);
  if (!targets.length) return new Set<string>();
  const supabase = publicSupabase();
  if (!supabase) return null;

  const visible = new Set<string>();
  for (let start = 0; start < targets.length; start += chunkSize) {
    const chunk = targets.slice(start, start + chunkSize);
    const { data, error } = await supabase.from('business_products').select('id').in('id', chunk);
    if (error) return null;
    for (const row of data ?? []) if (row.id) visible.add(String(row.id));
  }
  return visible;
}
