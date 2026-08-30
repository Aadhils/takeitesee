'use client';

import { useCallback, useEffect, useState } from 'react';
import { Badge, Button, Card, Input, Select } from '../ui/primitives';
import { useRemainingWorkspaceTranslations } from '../i18n/RemainingWorkspaceTranslations';

type Review = { id: string; rating: number; comment?: string; status: string; provider_response?: string; provider_responded_at?: string; created_at: string };
type Issue = { id: string; category: string; summary: string; priority: string; status: string; resolution_note?: string; created_at: string; updated_at: string };
type CloseoutState = 'in_progress' | 'awaiting_review' | 'reviewed' | 'support_open' | 'support_resolved' | 'cancelled' | 'customer_no_show' | 'provider_no_show' | 'eligible_to_close' | 'closed';
type AttendanceOutcome = 'pending' | 'service_completed' | 'customer_no_show' | 'provider_no_show';
type Closeout = {
  booking_id: string; booking_reference: string; service_name: string; booking_status: string; payment_status: string;
  state: CloseoutState; attendance_outcome: AttendanceOutcome; review: Review | null; issues: Issue[]; active_issue: Issue | null;
  policy: { no_show_grace_minutes: number; completion_confirmation_hours: number; review_window_days: number; support_window_days: number; auto_close_days: number };
  service_completed_at?: string; customer_completion_confirmed_at?: string; customer_no_show_reported_at?: string; provider_no_show_reported_at?: string;
  no_show_available_at?: string; completion_confirmation_due_at?: string; review_due_at?: string; support_due_at?: string; close_eligible_at?: string; closed_at?: string;
  can_confirm_completion: boolean; can_report_provider_no_show: boolean; can_report_customer_no_show: boolean; can_open_support: boolean;
  review_window_open: boolean; support_window_open: boolean; completion_confirmation_overdue: boolean; close_blockers: string[];
};

const categories = ['Service quality', 'Provider no-show', 'Payment or refund', 'Safety concern', 'Other'];
const tamilCategoryLabels: Record<string, string> = {
  'Service quality': 'சேவை தரம்',
  'Provider no-show': 'வழங்குநர் வரவில்லை',
  'Payment or refund': 'பணம் அல்லது refund',
  'Safety concern': 'பாதுகாப்பு பிரச்சனை',
  'Other': 'மற்றவை',
};

export default function BookingCloseoutPanel({ bookingId, allowSupport = false, viewer = 'customer' }: { bookingId: string; allowSupport?: boolean; viewer?: 'customer' | 'provider' }) {
  const { t, locale } = useRemainingWorkspaceTranslations();
  const [closeout, setCloseout] = useState<Closeout | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showSupport, setShowSupport] = useState(false);
  const [showNoShow, setShowNoShow] = useState(false);
  const [category, setCategory] = useState(categories[0]);
  const [summary, setSummary] = useState('');
  const [details, setDetails] = useState('');
  const [noShowNote, setNoShowNote] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setError('');
      const response = await fetch(`/api/bookings/${encodeURIComponent(bookingId)}/closeout`, { cache: 'no-store' });
      const payload = await response.json() as Closeout & { error?: string };
      if (!response.ok || !payload.booking_id) throw new Error(payload.error ?? 'Unable to load closeout state.');
      setCloseout(payload);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to load closeout state.'); }
    finally { setLoading(false); }
  }, [bookingId]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    const refresh = (event: Event) => {
      const detail = (event as CustomEvent<{ bookingId?: string }>).detail;
      if (!detail?.bookingId || detail.bookingId === bookingId) void load();
    };
    window.addEventListener('booking:closeout-refresh', refresh);
    return () => window.removeEventListener('booking:closeout-refresh', refresh);
  }, [bookingId, load]);

  const refreshAll = async () => {
    await load();
    window.dispatchEvent(new CustomEvent('booking:audit-refresh', { detail: { bookingId } }));
  };

  const openSupport = async () => {
    if (busy) return;
    setBusy(true); setError('');
    try {
      const response = await fetch(`/api/bookings/${encodeURIComponent(bookingId)}/support`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ category, summary, details }),
      });
      const payload = await response.json() as { issue?: Issue; error?: string };
      if (!response.ok || !payload.issue) throw new Error(payload.error ?? 'Support case could not be opened.');
      setShowSupport(false); setSummary(''); setDetails(''); await refreshAll();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Support case could not be opened.'); }
    finally { setBusy(false); }
  };

  const attendanceAction = async (action: 'confirm_completion' | 'report_provider_no_show' | 'report_customer_no_show') => {
    if (busy) return;
    setBusy(true); setError('');
    try {
      const providerAction = action === 'report_customer_no_show';
      const url = providerAction
        ? `/api/provider/bookings/${encodeURIComponent(bookingId)}/attendance`
        : `/api/bookings/${encodeURIComponent(bookingId)}/attendance`;
      const response = await fetch(url, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, note: noShowNote.trim() || undefined }),
      });
      const payload = await response.json() as Closeout & { error?: string };
      if (!response.ok || !payload.booking_id) throw new Error(payload.error ?? 'Attendance action could not be completed.');
      setCloseout(payload); setShowNoShow(false); setNoShowNote('');
      window.dispatchEvent(new CustomEvent('booking:audit-refresh', { detail: { bookingId } }));
      window.dispatchEvent(new CustomEvent('booking:provider-list-refresh', { detail: { bookingId } }));
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Attendance action could not be completed.'); }
    finally { setBusy(false); }
  };

  const formatMoment = (value?: string) => {
    if (!value) return '—';
    try { return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)); }
    catch { return value; }
  };
  const attendanceLabel = (value: AttendanceOutcome) => {
    if (value === 'service_completed') return t('closeout.attendance.completed');
    if (value === 'customer_no_show') return t('closeout.attendance.customerNoShow');
    if (value === 'provider_no_show') return t('closeout.attendance.providerNoShow');
    return t('closeout.attendance.pending');
  };
  const stateCopy = (state: CloseoutState) => {
    if (state === 'closed') return { label: t('closeout.state.closed'), tone: 'success' as const, detail: t('closeout.state.closedHelp') };
    if (state === 'eligible_to_close') return { label: t('closeout.state.eligible'), tone: 'warning' as const, detail: t('closeout.state.eligibleHelp') };
    if (state === 'provider_no_show') return { label: t('closeout.state.providerNoShow'), tone: 'danger' as const, detail: t('closeout.state.providerNoShowHelp') };
    if (state === 'customer_no_show') return { label: t('closeout.state.customerNoShow'), tone: 'warning' as const, detail: t('closeout.state.customerNoShowHelp') };
    if (state === 'support_open') return { label: t('closeout.state.supportOpen'), tone: 'warning' as const, detail: t('closeout.state.supportOpenHelp') };
    if (state === 'support_resolved') return { label: t('closeout.state.supportResolved'), tone: 'success' as const, detail: t('closeout.state.supportResolvedHelp') };
    if (state === 'reviewed') return { label: t('closeout.state.reviewed'), tone: 'success' as const, detail: t('closeout.state.reviewedHelp') };
    if (state === 'awaiting_review') return { label: t('closeout.state.awaiting'), tone: 'info' as const, detail: t('closeout.state.awaitingHelp') };
    if (state === 'cancelled') return { label: t('closeout.state.cancelled'), tone: 'neutral' as const, detail: t('closeout.state.cancelledHelp') };
    return { label: t('closeout.state.progress'), tone: 'neutral' as const, detail: t('closeout.state.progressHelp') };
  };
  const issueCategoryLabel = (value: string) => locale === 'ta-IN' ? tamilCategoryLabels[value] ?? value : value;

  if (loading) return <Card className="policy-card"><p>{t('closeout.loading')}</p></Card>;
  if (!closeout) return <Card className="policy-card"><p role="alert" style={{ color: 'var(--danger, #b42318)' }}>{error || t('closeout.unavailable')}</p></Card>;

  const state = stateCopy(closeout.state);
  const latestIssue = closeout.active_issue ?? closeout.issues[0] ?? null;
  const canSupport = viewer === 'customer' && allowSupport && closeout.can_open_support;
  const canNoShow = viewer === 'customer' ? closeout.can_report_provider_no_show : closeout.can_report_customer_no_show;

  return <Card className="policy-card">
    <div className="section-heading">
      <div><span className="eyebrow">{t('closeout.eyebrow')}</span><h2>{t('closeout.title')}</h2></div>
      <Badge tone={state.tone}>{state.label}</Badge>
    </div>
    <p className="summary-note">{state.detail}</p>

    <dl className="review-details">
      <div><dt>{t('closeout.attendance')}</dt><dd>{attendanceLabel(closeout.attendance_outcome)}</dd></div>
      <div><dt>{t('closeout.payment')}</dt><dd><Badge tone={closeout.payment_status === 'paid' ? 'success' : closeout.payment_status === 'failed' ? 'danger' : 'neutral'}>{closeout.payment_status}</Badge></dd></div>
      <div><dt>{t('closeout.completionConfirmation')}</dt><dd>{closeout.customer_completion_confirmed_at ? `${t('closeout.confirmed')} · ${formatMoment(closeout.customer_completion_confirmed_at)}` : closeout.service_completed_at ? `${closeout.completion_confirmation_overdue ? t('closeout.windowElapsed') : t('closeout.awaitingCustomer')} · ${formatMoment(closeout.completion_confirmation_due_at)}` : t('closeout.notApplicable')}</dd></div>
      <div><dt>{t('closeout.reviewWindow')}</dt><dd>{closeout.review ? `${closeout.review.rating}/5 · ${t('closeout.submitted')}` : closeout.review_due_at ? `${closeout.review_window_open ? t('closeout.open') : t('closeout.ended')} · ${formatMoment(closeout.review_due_at)}` : t('closeout.notAvailable')}</dd></div>
      <div><dt>{t('closeout.supportWindow')}</dt><dd>{latestIssue ? `${latestIssue.status.replaceAll('_', ' ')} · ${issueCategoryLabel(latestIssue.category)}` : closeout.support_due_at ? `${closeout.support_window_open ? t('closeout.open') : t('closeout.ended')} · ${formatMoment(closeout.support_due_at)}` : t('closeout.availableActive')}</dd></div>
      <div><dt>{t('closeout.final')}</dt><dd>{closeout.closed_at ? `${t('closeout.closed')} · ${formatMoment(closeout.closed_at)}` : closeout.close_eligible_at ? `${t('closeout.slaTarget')} ${formatMoment(closeout.close_eligible_at)}` : t('closeout.notScheduled')}</dd></div>
    </dl>

    {closeout.review?.provider_response ? <div style={{ marginTop: '1rem', padding: '1rem', border: '1px solid var(--border, #d9dce5)', borderRadius: '.8rem' }}><strong>{t('closeout.providerResponse')}</strong><p style={{ marginBottom: 0 }}>{closeout.review.provider_response}</p></div> : null}
    {latestIssue?.resolution_note && !closeout.active_issue ? <div style={{ marginTop: '1rem' }}><strong>{t('closeout.supportResolution')}</strong><p>{latestIssue.resolution_note}</p></div> : null}
    {closeout.close_blockers.length && closeout.state === 'eligible_to_close' ? <p className="summary-note">{t('closeout.blockers')}: {closeout.close_blockers.map((item) => item.replaceAll('_', ' ')).join(', ')}.</p> : null}
    {error ? <p role="alert" style={{ color: 'var(--danger, #b42318)' }}>{error}</p> : null}

    <div style={{ display: 'flex', gap: '.6rem', flexWrap: 'wrap', marginTop: '1rem' }}>
      {viewer === 'customer' && closeout.can_confirm_completion ? <Button type="button" disabled={busy} onClick={() => void attendanceAction('confirm_completion')}>{busy ? t('reason.updating') : t('closeout.confirmService')}</Button> : null}
      {canNoShow && !showNoShow ? <Button type="button" variant="secondary" disabled={busy} onClick={() => setShowNoShow(true)}>{viewer === 'customer' ? t('closeout.reportProviderNoShow') : t('closeout.markCustomerNoShow')}</Button> : null}
      {canSupport && !showSupport ? <Button type="button" variant="secondary" onClick={() => setShowSupport(true)}>{t('closeout.getHelp')}</Button> : null}
    </div>

    {showNoShow ? <div style={{ display: 'grid', gap: '.75rem', marginTop: '1rem' }}>
      <label style={{ display: 'grid', gap: '.45rem' }}><strong>{t('closeout.noShowDetails')}</strong><textarea value={noShowNote} maxLength={1000} rows={3} onChange={(event) => setNoShowNote(event.target.value)} placeholder={t('closeout.noShowPlaceholder')} style={{ width: '100%', padding: '.8rem', border: '1px solid #d9d9e3', borderRadius: '.7rem', font: 'inherit' }} /></label>
      <p className="summary-note">{t('closeout.noShowPolicyPrefix')} {closeout.policy.no_show_grace_minutes} {t('closeout.noShowPolicySuffix')}</p>
      <div style={{ display: 'flex', gap: '.6rem', flexWrap: 'wrap' }}><Button type="button" disabled={busy} onClick={() => void attendanceAction(viewer === 'customer' ? 'report_provider_no_show' : 'report_customer_no_show')}>{busy ? t('closeout.recording') : viewer === 'customer' ? t('closeout.reportNoShow') : t('closeout.markNoShow')}</Button><Button type="button" variant="quiet" disabled={busy} onClick={() => setShowNoShow(false)}>{t('common.cancel')}</Button></div>
    </div> : null}

    {showSupport ? <div style={{ display: 'grid', gap: '.85rem', marginTop: '1rem' }}>
      <Select label={t('closeout.supportCategory')} value={category} onChange={(event) => setCategory(event.target.value)}>{categories.map((item) => <option value={item} key={item}>{issueCategoryLabel(item)}</option>)}</Select>
      <Input label={t('closeout.shortSummary')} value={summary} maxLength={180} onChange={(event) => setSummary(event.target.value)} placeholder={t('closeout.summaryPlaceholder')} />
      <label style={{ display: 'grid', gap: '.45rem' }}><strong>{t('closeout.detailsOptional')}</strong><textarea value={details} maxLength={2000} rows={4} onChange={(event) => setDetails(event.target.value)} placeholder={t('closeout.detailsPlaceholder')} style={{ width: '100%', padding: '.8rem', border: '1px solid #d9d9e3', borderRadius: '.7rem', font: 'inherit' }} /></label>
      <div style={{ display: 'flex', gap: '.6rem', flexWrap: 'wrap' }}><Button type="button" disabled={busy || summary.trim().length < 3} onClick={() => void openSupport()}>{busy ? t('closeout.opening') : t('closeout.openCase')}</Button><Button type="button" variant="quiet" disabled={busy} onClick={() => setShowSupport(false)}>{t('common.cancel')}</Button></div>
    </div> : null}
  </Card>;
}
