import { NextResponse } from 'next/server';
import { createSupabaseServiceClient } from '../../../../lib/supabase/service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type SearchTaxonomyCategory = {
  code: string;
  name: string;
  group_name: string;
  aliases: string[];
};

function normalizedAliases(metadata: unknown) {
  if (!metadata || typeof metadata !== 'object') return [];
  const aliases = (metadata as Record<string, unknown>).search_aliases;
  if (!Array.isArray(aliases)) return [];
  return Array.from(new Set(
    aliases
      .map((alias) => String(alias ?? '').normalize('NFKC').replace(/\s+/g, ' ').trim())
      .filter(Boolean),
  )).slice(0, 40);
}

export async function GET() {
  try {
    const supabase = createSupabaseServiceClient();
    const { data: applications, error: applicationError } = await supabase
      .from('platform_applications')
      .select('id')
      .eq('code', 'services')
      .eq('status', 'active')
      .limit(2);

    if (applicationError || applications?.length !== 1) {
      return NextResponse.json({ categories: [] }, { headers: { 'Cache-Control': 'no-store' } });
    }

    const { data, error } = await supabase
      .from('platform_categories')
      .select('id,parent_id,code,name,metadata,sort_order')
      .eq('application_id', applications[0].id)
      .eq('active', true)
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true });

    if (error) {
      return NextResponse.json({ categories: [] }, { headers: { 'Cache-Control': 'no-store' } });
    }

    const byId = new Map((data ?? []).map((row: any) => [String(row.id), row]));
    const categories: SearchTaxonomyCategory[] = [];

    for (const row of data ?? []) {
      if (!row.parent_id) continue;
      const parent = byId.get(String(row.parent_id));
      if (!parent?.name || !row.code || !row.name) continue;
      categories.push({
        code: String(row.code),
        name: String(row.name),
        group_name: String(parent.name),
        aliases: normalizedAliases(row.metadata),
      });
    }

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
