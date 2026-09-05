import { NextResponse } from 'next/server';
import { productionAuthProvider } from '../../../../server/auth/session';
import { createSupabaseServerClient } from '../../../../lib/supabase/server';
import { createSupabaseServiceClient } from '../../../../lib/supabase/service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const portfolioBucket = 'professional-portfolio-media';
const portfolioPreviewTtlSeconds = 10 * 60;

type ModerationQueueRow = {
  context_kind?: string;
  target_type?: string;
  target_id?: string;
  [key: string]: unknown;
};

async function addPortfolioPreviews(rows: ModerationQueueRow[]) {
  const targetIds = Array.from(new Set(rows
    .filter((row) => row.context_kind === 'professional_portfolio' && row.target_type === 'portfolio_media' && row.target_id)
    .map((row) => String(row.target_id))));
  if (!targetIds.length) return rows;

  try {
    const service = createSupabaseServiceClient();
    const { data: mediaRows, error } = await service
      .from('professional_portfolio_media')
      .select('id,object_path,media_type')
      .in('id', targetIds);
    if (error || !mediaRows?.length) return rows;

    const previews = new Map<string, { media_type: string; signed_url: string }>();
    await Promise.all(mediaRows.map(async (media) => {
      const { data, error: signedError } = await service.storage
        .from(portfolioBucket)
        .createSignedUrl(String(media.object_path), portfolioPreviewTtlSeconds);
      if (!signedError && data?.signedUrl) previews.set(String(media.id), { media_type: String(media.media_type), signed_url: data.signedUrl });
    }));

    return rows.map((row) => {
      const preview = row.target_id ? previews.get(String(row.target_id)) : undefined;
      return preview ? { ...row, portfolio_media_type: preview.media_type, portfolio_preview_url: preview.signed_url } : row;
    });
  } catch {
    return rows;
  }
}

export async function GET(request: Request) {
  try {
    await productionAuthProvider.requireAdmin(request);
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc('get_marketplace_moderation_queue');
    if (error) throw new Error(error.message);
    const reports = await addPortfolioPreviews(Array.isArray(data) ? data as ModerationQueueRow[] : []);
    return NextResponse.json({ reports });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Moderation queue could not be loaded.';
    return NextResponse.json({ error: message }, { status: /authentication/i.test(message) ? 401 : 403 });
  }
}

export async function PATCH(request: Request) {
  try {
    await productionAuthProvider.requireAdmin(request);
    const body = await request.json() as { report_id?: string; status?: 'open'|'reviewing'|'actioned'|'dismissed'; note?: string };
    if (!body.report_id) return NextResponse.json({ error: 'Report ID is required.' }, { status: 400 });
    if (!body.status || !['open','reviewing','actioned','dismissed'].includes(body.status)) return NextResponse.json({ error: 'Choose a valid moderation status.' }, { status: 400 });
    const note = String(body.note ?? '').trim();
    if (note.length > 2000) return NextResponse.json({ error: 'Moderation note must be 2000 characters or fewer.' }, { status: 400 });
    if (['actioned','dismissed'].includes(body.status) && note.length < 3) return NextResponse.json({ error: 'A moderation note is required to close a report.' }, { status: 400 });
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc('admin_update_marketplace_moderation_report', {
      target_report_id: body.report_id,
      requested_status: body.status,
      requested_note: note || null,
    }).maybeSingle();
    if (error || !data) throw new Error(error?.message ?? 'Moderation report could not be updated.');
    return NextResponse.json({ report: data });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Moderation report could not be updated.';
    const status = /authentication/i.test(message) ? 401 : /permission|required/i.test(message) ? 403 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
