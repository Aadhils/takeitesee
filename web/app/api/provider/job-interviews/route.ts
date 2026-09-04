import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '../../../../lib/supabase/server';
import { productionAuthProvider } from '../../../../server/auth/session';

export const runtime = 'nodejs';

type Mode = 'in_person' | 'phone' | 'video';
const MODES = new Set<Mode>(['in_person', 'phone', 'video']);

function text(value: unknown, max: number) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function duration(value: unknown) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 30;
  return Math.max(15, Math.min(240, Math.trunc(number)));
}

function startsAt(value: unknown) {
  if (typeof value !== 'string' || !value.trim()) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function meetingUrl(value: unknown) {
  const candidate = text(value, 1000);
  if (!candidate) return null;
  try {
    const url = new URL(candidate);
    return url.protocol === 'https:' ? url.toString() : null;
  } catch {
    return null;
  }
}

async function providerContext(request: Request) {
  const session = await productionAuthProvider.requireProvider(request);
  const supabase = await createSupabaseServerClient();
  const { data: business, error: businessError } = await supabase.from('businesses').select('id,verified').eq('owner_user_id', session.user_id).limit(1).maybeSingle();
  if (businessError) throw new Error(businessError.message);
  if (business) return { session, supabase, mode: 'business' as const, business };
  const { data: professional, error: professionalError } = await supabase.from('professional_profiles').select('id,verified').eq('user_id', session.user_id).limit(1).maybeSingle();
  if (professionalError) throw new Error(professionalError.message);
  if (!professional) throw new Error('Provider profile not found.');
  return { session, supabase, mode: 'professional' as const, professional };
}

export async function POST(request: Request) {
  try {
    const context = await providerContext(request);
    if (context.mode !== 'business') return NextResponse.json({ error: 'Business employer required.' }, { status: 403 });
    if (!context.business.verified) return NextResponse.json({ error: 'Verify your business before scheduling interviews.' }, { status: 403 });

    const body = await request.json() as Record<string, unknown>;
    const applicationId = text(body.application_id, 64);
    const start = startsAt(body.starts_at);
    const mode = text(body.mode, 20) as Mode;
    const timezone = text(body.timezone, 64) || 'Asia/Kolkata';
    const location = text(body.location, 300) || null;
    const url = body.meeting_url ? meetingUrl(body.meeting_url) : null;
    const note = text(body.note, 2000) || null;

    if (!applicationId || !start || !MODES.has(mode)) return NextResponse.json({ error: 'Application, interview time and mode are required.' }, { status: 400 });
    if (new Date(start).getTime() <= Date.now()) return NextResponse.json({ error: 'Interview must be scheduled in the future.' }, { status: 400 });
    if (body.meeting_url && !url) return NextResponse.json({ error: 'Meeting link must use HTTPS.' }, { status: 400 });

    const { data, error } = await context.supabase.from('job_interviews').insert({
      job_application_id: applicationId,
      scheduled_by_user_id: context.session.user_id,
      starts_at: start,
      duration_minutes: duration(body.duration_minutes),
      timezone,
      mode,
      location,
      meeting_url: url,
      note,
      status: 'scheduled',
    }).select('*').single();
    if (error) throw new Error(error.message);
    return NextResponse.json({ interview: data }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to schedule interview.' }, { status: 400 });
  }
}

export async function PATCH(request: Request) {
  try {
    const context = await providerContext(request);
    const body = await request.json() as Record<string, unknown>;
    const action = text(body.action, 30);
    const interviewId = text(body.interview_id, 64);
    if (!interviewId) return NextResponse.json({ error: 'Interview is required.' }, { status: 400 });

    if (action === 'respond') {
      if (context.mode !== 'professional') return NextResponse.json({ error: 'Professional applicant required.' }, { status: 403 });
      const responseStatus = text(body.status, 20);
      if (!['accepted', 'declined'].includes(responseStatus)) return NextResponse.json({ error: 'Accept or decline the interview.' }, { status: 400 });
      const { data, error } = await context.supabase.from('job_interviews').update({ status: responseStatus }).eq('id', interviewId).select('*').single();
      if (error) throw new Error(error.message);
      return NextResponse.json({ interview: data });
    }

    if (action === 'cancel') {
      if (context.mode !== 'business') return NextResponse.json({ error: 'Business employer required.' }, { status: 403 });
      const { data, error } = await context.supabase.from('job_interviews').update({ status: 'cancelled' }).eq('id', interviewId).select('*').single();
      if (error) throw new Error(error.message);
      return NextResponse.json({ interview: data });
    }

    if (action === 'reschedule') {
      if (context.mode !== 'business') return NextResponse.json({ error: 'Business employer required.' }, { status: 403 });
      const start = startsAt(body.starts_at);
      const mode = text(body.mode, 20) as Mode;
      const timezone = text(body.timezone, 64) || 'Asia/Kolkata';
      const location = text(body.location, 300) || null;
      const url = body.meeting_url ? meetingUrl(body.meeting_url) : null;
      const note = text(body.note, 2000) || null;
      if (!start || !MODES.has(mode)) return NextResponse.json({ error: 'Interview time and mode are required.' }, { status: 400 });
      if (new Date(start).getTime() <= Date.now()) return NextResponse.json({ error: 'Interview must be scheduled in the future.' }, { status: 400 });
      if (body.meeting_url && !url) return NextResponse.json({ error: 'Meeting link must use HTTPS.' }, { status: 400 });

      const { data, error } = await context.supabase.from('job_interviews').update({
        starts_at: start,
        duration_minutes: duration(body.duration_minutes),
        timezone,
        mode,
        location,
        meeting_url: url,
        note,
        status: 'scheduled',
      }).eq('id', interviewId).select('*').single();
      if (error) throw new Error(error.message);
      return NextResponse.json({ interview: data });
    }

    return NextResponse.json({ error: 'Unknown interview action.' }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to update interview.' }, { status: 400 });
  }
}
