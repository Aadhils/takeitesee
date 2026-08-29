'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Badge, Button, Card, EmptyState } from '../ui/primitives';

type BookingLink = { booking_reference: string; service_name_snapshot: string } | null;
type Dispute = {
  id: string; gateway_dispute_id: string; booking_id: string | null; dispute_type: string; reason_code?: string | null; reason_description?: string | null;
  amount_minor: number; currency: string; gateway_status: string; local_state: string; dispute_action_on?: string | null; cf_remarks?: string | null;
  respond_by?: string | null; gateway_updated_at?: string | null; last_seen_at: string; booking?: BookingLink;
};
type GatewayException = {
  id: string; exception_key: string; category: string; booking_id: string | null; gateway_reference?: string | null; amount_minor?: number | null; currency?: string | null;
  severity: string; status: string; summary: string; detail?: string | null; last_seen_at: string; resolution_note?: string | null; booking?: BookingLink;
};
type FinanceHold = {
  id: string; booking_id: string; owner_user_id: string; source_type: string; amount_minor: number; currency: string; status: string; public_summary: string; opened_at: string; booking?: BookingLink;
};
type Recovery = {
  id: string; owner_user_id: string; booking_id: string; source_type: string; amount_minor: number; currency: string; status: string; reason: string; created_at: string; resolution_note?: string | null; booking?: BookingLink;
};
type Payload = {
  disputes?: Dispute[]; exceptions?: GatewayException[]; holds?: FinanceHold[]; recoveries?: Recovery[];
  gateway?: { enabled: boolean; provider: string; mode: 'sandbox' | 'production' }; error?: string;
};

function money(minor: number | null | undefined, currency = 'INR') {
  try { return new Intl.NumberFormat('en-IN', { style: 'currency', currency, minimumFractionDigits: 2 }).format(Number(minor ?? 0) / 100); }
  catch { return `${currency} ${(Number(minor ?? 0) / 100).toFixed(2)}`; }
}
function stateTone(value: string): 'neutral' | 'success' | 'warning' | 'danger' | 'info' {
  if (['won','resolved','recovered'].includes(value)) return 'success';
  if (['lost','accepted','recovery_required','critical'].includes(value)) return 'danger';
  if (['action_required','under_review','open','warning'].includes(value)) return 'warning';
  return 'info';
}
function deadline(value?: string | null) {
  if (!value) return 'No merchant deadline supplied';
  const date = new Date(value);
  const hours = (date.getTime() - Date.now()) / 3_600_000;
  const formatted = date.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
  if (hours < 0) return `${formatted} · deadline passed`;
  if (hours <= 24) return `${formatted} · due within 24h`;
  return formatted;
}

export default function FinanceRiskManager() {
  const [payload, setPayload] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [notes, setNotes] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    try {
      setLoading(true); setError('');
      const response = await fetch('/api/super-admin/finance-risk', { cache: 'no-store' });
      const body = await response.json() as Payload;
      if (!response.ok) throw new Error(body.error ?? 'Unable to load finance risk queue.');
      setPayload(body);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to load finance risk queue.'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const act = async (key: string, body: Record<string, unknown>, success: string) => {
    if (busy) return;
    setBusy(key); setError(''); setNotice('');
    try {
      const response = await fetch('/api/super-admin/finance-risk', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error ?? 'Finance risk action failed.');
      setNotice(success); await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Finance risk action failed.'); }
    finally { setBusy(''); }
  };

  const disputes = payload?.disputes ?? [];
  const exceptions = payload?.exceptions ?? [];
  const holds = payload?.holds ?? [];
  const recoveries = payload?.recoveries ?? [];
  const activeDisputes = useMemo(() => disputes.filter((item) => ['unmatched','action_required','under_review','recovery_required'].includes(item.local_state)), [disputes]);
  const activeExceptions = useMemo(() => exceptions.filter((item) => ['open','recovery_required'].includes(item.status)), [exceptions]);
  const openRecoveries = useMemo(() => recoveries.filter((item) => item.status === 'open'), [recoveries]);

  return <section className="section-stack">
    <div><span className="eyebrow">Payment risk</span><h2>Disputes, gateway exceptions & recovery</h2><p>Keep provider payouts frozen while chargebacks or gateway reversals are unresolved. Customer PII from Cashfree dispute webhooks is intentionally not stored in this workspace.</p></div>
    {error ? <Alert tone="danger" title="Finance risk queue needs attention">{error}</Alert> : null}
    {notice ? <Alert tone="success" title="Finance risk updated">{notice}</Alert> : null}
    {payload?.gateway && !payload.gateway.enabled ? <Alert tone="warning" title="Cashfree actions disabled">The finance-risk ledger is active, but Cashfree credentials are not configured. Webhook/API refresh and dispute acceptance remain safely disabled until gateway activation.</Alert> : null}
    {loading ? <Card><p>Loading finance risk queue…</p></Card> : null}

    {!loading ? <div className="provider-summary-grid">
      <Card><span className="eyebrow">Action queue</span><h2>{activeDisputes.length}</h2><p>Open or unmatched payment disputes</p></Card>
      <Card><span className="eyebrow">Reconciliation</span><h2>{activeExceptions.length}</h2><p>Open gateway exceptions</p></Card>
      <Card><span className="eyebrow">Provider protection</span><h2>{holds.length}</h2><p>Active payout finance holds</p></Card>
      <Card><span className="eyebrow">Recovery</span><h2>{openRecoveries.length}</h2><p>Outstanding provider recovery entries</p></Card>
    </div> : null}

    {!loading ? <div className="section-stack">
      <div><h3>Cashfree disputes & chargebacks</h3><p>Merchant deadlines are operationally critical. Accepting a dispute is irreversible at Takeitesee and is sent directly to Cashfree.</p></div>
      {activeDisputes.length ? activeDisputes.map((item) => {
        const note = notes[item.id] ?? '';
        const canAccept = item.dispute_action_on === 'MERCHANT' && ['action_required','under_review'].includes(item.local_state);
        return <Card key={item.id}>
          <div className="section-heading"><div><span className="eyebrow">{item.booking?.booking_reference ?? `Cashfree ${item.gateway_dispute_id}`}</span><h2>{item.dispute_type.replaceAll('_', ' ')}</h2></div><Badge tone={stateTone(item.local_state)}>{item.local_state.replaceAll('_', ' ')}</Badge></div>
          <p><strong>{money(item.amount_minor, item.currency)}</strong> · {item.reason_description || item.reason_code || 'Gateway dispute'} · Cashfree state {item.gateway_status}</p>
          <dl className="provider-profile-details"><div><dt>Merchant response</dt><dd>{item.dispute_action_on || 'Not specified'}</dd></div><div><dt>Respond by</dt><dd>{deadline(item.respond_by)}</dd></div><div><dt>Service</dt><dd>{item.booking?.service_name_snapshot || 'Unmatched transaction'}</dd></div></dl>
          {item.cf_remarks ? <p className="admin-fixture-note">Cashfree: {item.cf_remarks}</p> : null}
          <textarea aria-label={`Finance note for dispute ${item.gateway_dispute_id}`} value={note} maxLength={500} onChange={(event) => setNotes((current) => ({ ...current, [item.id]: event.target.value }))} placeholder="Finance action note" rows={3} style={{ width: '100%', marginTop: '.75rem' }} />
          <div className="flex flex-wrap gap-3" style={{ marginTop: '.75rem' }}>
            <Button type="button" variant="secondary" disabled={!payload?.gateway?.enabled || Boolean(busy)} loading={busy === `refresh:${item.id}`} onClick={() => void act(`refresh:${item.id}`, { action: 'refresh_dispute', dispute_id: item.id }, 'Dispute refreshed from Cashfree.')}>Refresh Cashfree</Button>
            {canAccept ? <Button type="button" disabled={!payload?.gateway?.enabled || note.trim().length < 3 || Boolean(busy)} loading={busy === `accept:${item.id}`} onClick={() => {
              if (window.confirm('Accept this Cashfree dispute? This concedes the dispute and may create a financial loss.')) void act(`accept:${item.id}`, { action: 'accept_dispute', dispute_id: item.id, confirmed: true, note: note.trim() }, 'Dispute acceptance sent to Cashfree and reconciled.');
            }}>Accept dispute</Button> : null}
            {item.booking_id ? <Link className="button button-secondary" href={`/admin/bookings/${encodeURIComponent(item.booking_id)}`}>Open booking</Link> : null}
          </div>
        </Card>;
      }) : <Card><EmptyState title="No active disputes">New Cashfree disputes, chargebacks, pre-arbitrations, or unmatched cases will appear here.</EmptyState></Card>}
    </div> : null}

    {!loading ? <div className="section-stack">
      <div><h3>Gateway reconciliation exceptions</h3><p>Auto-refund mismatches, unmatched events, and partial financial reversals stay visible until finance explicitly resolves them.</p></div>
      {activeExceptions.length ? activeExceptions.map((item) => {
        const note = notes[`exception:${item.id}`] ?? '';
        const blocked = item.status === 'recovery_required';
        return <Card key={item.id}>
          <div className="section-heading"><div><span className="eyebrow">{item.category.replaceAll('_', ' ')}</span><h2>{item.summary}</h2></div><Badge tone={stateTone(item.severity)}>{item.severity}</Badge></div>
          <p>{item.detail || 'Gateway reconciliation requires review.'}</p>
          {item.amount_minor ? <p><strong>{money(item.amount_minor, item.currency || 'INR')}</strong></p> : null}
          {blocked ? <Alert tone="warning" title="Recovery must be resolved first">This exception cannot close while an associated provider recovery remains open.</Alert> : null}
          <textarea aria-label={`Resolution note for exception ${item.id}`} value={note} maxLength={500} onChange={(event) => setNotes((current) => ({ ...current, [`exception:${item.id}`]: event.target.value }))} placeholder="Resolution note" rows={2} style={{ width: '100%' }} />
          <div className="flex flex-wrap gap-3" style={{ marginTop: '.75rem' }}>
            <Button type="button" variant="secondary" disabled={blocked || note.trim().length < 3 || Boolean(busy)} loading={busy === `resolve:${item.id}`} onClick={() => void act(`resolve:${item.id}`, { action: 'resolve_exception', exception_id: item.id, resolution: 'resolve', note: note.trim() }, 'Gateway exception resolved.')}>Resolve</Button>
            <Button type="button" variant="secondary" disabled={blocked || note.trim().length < 3 || Boolean(busy)} loading={busy === `ignore:${item.id}`} onClick={() => void act(`ignore:${item.id}`, { action: 'resolve_exception', exception_id: item.id, resolution: 'ignore', note: note.trim() }, 'Gateway exception marked ignored with audit note.')}>Ignore</Button>
            {item.booking_id ? <Link className="button button-secondary" href={`/admin/bookings/${encodeURIComponent(item.booking_id)}`}>Open booking</Link> : null}
          </div>
        </Card>;
      }) : <Card><EmptyState title="No open gateway exceptions">Signed gateway events that cannot reconcile automatically will appear here.</EmptyState></Card>}
    </div> : null}

    {!loading ? <div className="section-stack">
      <div><h3>Provider recovery ledger</h3><p>A recovery exists only when provider funds already escaped before the gateway loss became final. Open recovery blocks future payout preparation.</p></div>
      {openRecoveries.length ? openRecoveries.map((item) => {
        const note = notes[`recovery:${item.id}`] ?? '';
        return <Card key={item.id}>
          <div className="section-heading"><div><span className="eyebrow">{item.booking?.booking_reference ?? 'Provider recovery'}</span><h2>{money(item.amount_minor, item.currency)}</h2></div><Badge tone="danger">recovery required</Badge></div>
          <p>{item.reason}</p>
          <textarea aria-label={`Recovery resolution note ${item.id}`} value={note} maxLength={500} onChange={(event) => setNotes((current) => ({ ...current, [`recovery:${item.id}`]: event.target.value }))} placeholder="How was this recovery resolved?" rows={2} style={{ width: '100%' }} />
          <div className="flex flex-wrap gap-3" style={{ marginTop: '.75rem' }}>
            <Button type="button" disabled={note.trim().length < 3 || Boolean(busy)} loading={busy === `recovered:${item.id}`} onClick={() => void act(`recovered:${item.id}`, { action: 'resolve_recovery', recovery_id: item.id, resolution: 'recovered', note: note.trim() }, 'Provider recovery marked recovered.')}>Mark recovered</Button>
            <Button type="button" variant="secondary" disabled={note.trim().length < 3 || Boolean(busy)} loading={busy === `waived:${item.id}`} onClick={() => void act(`waived:${item.id}`, { action: 'resolve_recovery', recovery_id: item.id, resolution: 'waived', note: note.trim() }, 'Provider recovery waived with audit note.')}>Waive recovery</Button>
            <Link className="button button-secondary" href={`/admin/bookings/${encodeURIComponent(item.booking_id)}`}>Open booking</Link>
          </div>
        </Card>;
      }) : <Card><EmptyState title="No provider recovery balance">Any post-payout reversal will create a recovery entry here automatically.</EmptyState></Card>}
    </div> : null}
  </section>;
}
