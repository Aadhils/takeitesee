'use client';

import { useCallback, useEffect, useState } from 'react';
import { Alert, Badge, Button, Card, Input } from '../ui/primitives';

type Destination = {
  id: string;
  gateway: string;
  destination_type: 'bank' | 'upi';
  masked_destination: string;
  beneficiary_name: string;
  status: 'pending' | 'verified' | 'invalid' | 'failed';
  gateway_status?: string | null;
  last_error_code?: string | null;
  last_error_message?: string | null;
  verified_at?: string | null;
};

type Gateway = { enabled: boolean; provider: string; mode: 'sandbox' | 'production' };

type Payload = { gateway?: Gateway; destination?: Destination | null; error?: string };

function tone(status: string): 'success' | 'warning' | 'danger' | 'neutral' | 'info' {
  if (status === 'verified') return 'success';
  if (status === 'pending') return 'warning';
  if (status === 'failed' || status === 'invalid') return 'danger';
  return 'neutral';
}

export default function ProviderPayoutDestinationPanel() {
  const [gateway, setGateway] = useState<Gateway | null>(null);
  const [destination, setDestination] = useState<Destination | null>(null);
  const [destinationType, setDestinationType] = useState<'bank' | 'upi'>('bank');
  const [beneficiaryName, setBeneficiaryName] = useState('');
  const [bankAccount, setBankAccount] = useState('');
  const [bankAccountConfirm, setBankAccountConfirm] = useState('');
  const [bankIfsc, setBankIfsc] = useState('');
  const [vpa, setVpa] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [confirmRemove, setConfirmRemove] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true); setError('');
      const response = await fetch('/api/provider/payout-destination', { cache: 'no-store' });
      const body = await response.json() as Payload;
      if (!response.ok) throw new Error(body.error ?? 'Unable to load payout destination.');
      setGateway(body.gateway ?? null); setDestination(body.destination ?? null);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to load payout destination.'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const register = async () => {
    if (busy) return;
    if (destinationType === 'bank' && bankAccount !== bankAccountConfirm) { setError('Bank account numbers do not match.'); return; }
    setBusy('register'); setError(''); setNotice('');
    try {
      const response = await fetch('/api/provider/payout-destination', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'register', destination_type: destinationType, beneficiary_name: beneficiaryName,
          ...(destinationType === 'bank' ? { bank_account_number: bankAccount, bank_ifsc: bankIfsc } : { vpa }),
        }),
      });
      const body = await response.json() as { destination?: Destination; error?: string };
      if (!response.ok || !body.destination) throw new Error(body.error ?? 'Payout destination could not be registered.');
      setDestination(body.destination); setNotice(`Payout destination is ${body.destination.status}.`);
      setBankAccount(''); setBankAccountConfirm(''); setBankIfsc(''); setVpa('');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Payout destination could not be registered.'); }
    finally { setBusy(''); }
  };

  const refresh = async () => {
    if (busy) return;
    setBusy('refresh'); setError(''); setNotice('');
    try {
      const response = await fetch('/api/provider/payout-destination', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'refresh' }),
      });
      const body = await response.json() as { destination?: Destination; error?: string };
      if (!response.ok || !body.destination) throw new Error(body.error ?? 'Payout destination status could not be refreshed.');
      setDestination(body.destination); setNotice(`Gateway status refreshed: ${body.destination.status}.`);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Payout destination status could not be refreshed.'); }
    finally { setBusy(''); }
  };

  const remove = async () => {
    if (busy) return;
    setBusy('remove'); setError(''); setNotice('');
    try {
      const response = await fetch('/api/provider/payout-destination', { method: 'DELETE' });
      const body = await response.json() as { removed?: boolean; error?: string };
      if (!response.ok || !body.removed) throw new Error(body.error ?? 'Payout destination could not be removed.');
      setDestination(null); setConfirmRemove(false); setNotice('Payout destination removed.');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Payout destination could not be removed.'); }
    finally { setBusy(''); }
  };

  return <Card className="provider-profile-card">
    <div className="section-heading">
      <div><span className="eyebrow">Payout destination</span><h2>Where provider payouts are sent</h2></div>
      {gateway ? <Badge tone={gateway.enabled ? 'success' : 'warning'}>{gateway.enabled ? `${gateway.mode} gateway` : 'Gateway not configured'}</Badge> : null}
    </div>
    <p>Bank account numbers and UPI IDs are sent directly to the payout gateway over the server connection. Takeitesee stores only the gateway beneficiary reference and a masked destination.</p>
    {loading ? <p>Loading payout destination…</p> : null}
    {error ? <Alert tone="danger" title="Payout destination needs attention">{error}</Alert> : null}
    {notice ? <Alert tone="success" title="Payout destination updated">{notice}</Alert> : null}

    {!loading && gateway && !gateway.enabled ? <Alert tone="warning" title="Payout setup is not open yet">The platform payout gateway is not configured, so Takeitesee is not accepting provider bank or UPI details yet.</Alert> : null}

    {destination ? <div className="section-stack" style={{ marginTop: '1rem' }}>
      <div className="section-heading"><div><strong>{destination.beneficiary_name}</strong><p>{destination.masked_destination}</p></div><Badge tone={tone(destination.status)}>{destination.status}</Badge></div>
      <dl className="provider-profile-details">
        <div><dt>Destination type</dt><dd>{destination.destination_type === 'bank' ? 'Bank account' : 'UPI'}</dd></div>
        <div><dt>Gateway status</dt><dd>{destination.gateway_status ?? destination.status}</dd></div>
        <div><dt>Verified</dt><dd>{destination.verified_at ? new Date(destination.verified_at).toLocaleString('en-IN') : 'Not yet'}</dd></div>
      </dl>
      {destination.last_error_message ? <Alert tone="danger">{destination.last_error_message}</Alert> : null}
      <div className="flex flex-wrap gap-3">
        <Button type="button" variant="secondary" loading={busy === 'refresh'} onClick={() => void refresh()}>Refresh verification</Button>
        {!confirmRemove ? <Button type="button" variant="danger" disabled={Boolean(busy)} onClick={() => setConfirmRemove(true)}>Remove destination</Button> : <>
          <Button type="button" variant="danger" loading={busy === 'remove'} onClick={() => void remove()}>Confirm removal</Button>
          <Button type="button" variant="secondary" disabled={Boolean(busy)} onClick={() => setConfirmRemove(false)}>Keep destination</Button>
        </>}
      </div>
    </div> : null}

    {!loading && gateway?.enabled && !destination ? <div className="section-stack" style={{ marginTop: '1rem' }}>
      <div className="flex flex-wrap gap-3">
        <Button type="button" variant={destinationType === 'bank' ? 'primary' : 'secondary'} onClick={() => setDestinationType('bank')}>Bank account</Button>
        <Button type="button" variant={destinationType === 'upi' ? 'primary' : 'secondary'} onClick={() => setDestinationType('upi')}>UPI</Button>
      </div>
      <Input label="Beneficiary name" hint="Use the account holder name in English letters." value={beneficiaryName} onChange={(event) => setBeneficiaryName(event.target.value)} autoComplete="name" />
      {destinationType === 'bank' ? <>
        <Input label="Bank account number" type="password" inputMode="numeric" autoComplete="off" value={bankAccount} onChange={(event) => setBankAccount(event.target.value)} />
        <Input label="Confirm bank account number" type="password" inputMode="numeric" autoComplete="off" value={bankAccountConfirm} onChange={(event) => setBankAccountConfirm(event.target.value)} />
        <Input label="IFSC" autoCapitalize="characters" autoComplete="off" value={bankIfsc} onChange={(event) => setBankIfsc(event.target.value.toUpperCase())} />
      </> : <Input label="UPI ID" autoComplete="off" value={vpa} onChange={(event) => setVpa(event.target.value)} />}
      <Alert tone="info">By saving, you authorize Takeitesee to register this destination with the payout gateway for provider settlements. Raw destination details are not retained in the Takeitesee database.</Alert>
      <Button type="button" loading={busy === 'register'} disabled={!beneficiaryName.trim() || (destinationType === 'bank' ? !bankAccount || !bankAccountConfirm || !bankIfsc : !vpa)} onClick={() => void register()}>Save payout destination</Button>
    </div> : null}
  </Card>;
}