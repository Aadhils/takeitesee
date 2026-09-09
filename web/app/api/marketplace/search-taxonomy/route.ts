import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type SearchTaxonomyCategory = {
  code: string;
  name: string;
  group_name: string;
  aliases: string[];
};

function normalizedAliases(value: unknown) {
  if (!Array.isArray(value)) return [];
  return Array.from(new Set(
    value
      .map((alias) => String(alias ?? '').normalize('NFKC').replace(/\s+/g, ' ').trim())
      .filter(Boolean),
  )).slice(0, 40);
}

export async function GET() {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) {
      return NextResponse.json({ categories: [] }, { headers: { 'Cache-Control': 'no-store' } });
    }

    const supabase = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
    const { data, error } = await supabase
      .from('marketplace_search_taxonomy_public')
      .select('category_code,category_name,group_name,search_aliases')
      .order('group_sort_order', { ascending: true })
      .order('group_name', { ascending: true })
      .order('category_sort_order', { ascending: true })
      .order('category_name', { ascending: true });

    if (error) {
      return NextResponse.json({ categories: [] }, { headers: { 'Cache-Control': 'no-store' } });
    }

    const categories: SearchTaxonomyCategory[] = (data ?? [])
      .map((row: any) => ({
        code: String(row.category_code ?? '').trim(),
        name: String(row.category_name ?? '').trim(),
        group_name: String(row.group_name ?? '').trim(),
        aliases: normalizedAliases(row.search_aliases),
      }))
      .filter((category: SearchTaxonomyCategory) => category.code && category.name && category.group_name);

    return NextResponse.json(
      { categories },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch {
    // Search suggestions are optional discovery enrichment. The marketplace remains
    // usable through normal service text search if taxonomy enrichment is unavailable.
    return NextResponse.json({ categories: [] }, { headers: { 'Cache-Control': 'no-store' } });
  }
}
