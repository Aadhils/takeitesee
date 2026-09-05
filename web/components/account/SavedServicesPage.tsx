'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import LocalizedAccountShell from './LocalizedAccountShell';
import { Badge, Button, Card, EmptyState } from '../ui/primitives';
import { useLanguage } from '../i18n/LanguageProvider';

type SavedService = {
  service_id: string;
  saved_at: string;
  available: boolean;
  service: null | {
    id: string;
    name: string;
    description: string;
    category: string | null;
    location: string | null;
    duration_minutes: number;
    base_price: number;
    currency: string;
    provider_type: 'professional' | 'business';
    provider_name: string;
  };
};

export default function SavedServicesPage() {
  const { locale } = useLanguage();
  const tamil = locale === 'ta-IN';
  const [items, setItems] = useState<SavedService[]>([]);
  const [loading, setLoading] = useState(true);
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/account/saved-services', { cache: 'no-store' });
      if (response.status === 401) {
        setAuthenticated(false);
        setItems([]);
        return;
      }
      const payload = await response.json() as { saved_services?: SavedService[]; error?: string };
      if (!response.ok) throw new Error(payload.error || 'Unable to load saved services.');
      setAuthenticated(true);
      setItems(payload.saved_services ?? []);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to load saved services.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const remove = async (serviceId: string) => {
    if (busyId) return;
    setBusyId(serviceId);
    setError('');
    try {
      const response = await fetch('/api/account/saved-services', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ service_id: serviceId }),
      });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error || 'Unable to remove saved service.');
      setItems((current) => current.filter((item) => item.service_id !== serviceId));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to remove saved service.');
    } finally {
      setBusyId('');
    }
  };

  const money = (amount: number, currency: string) => {
    try { return new Intl.NumberFormat(locale, { style: 'currency', currency, maximumFractionDigits: 2 }).format(amount); }
    catch { return `${currency} ${amount.toFixed(2)}`; }
  };

  return <LocalizedAccountShell active="/saved-services">
    <section className="account-page-heading">
      <span className="eyebrow">{tamil ? 'சேவை shortlist' : 'Service shortlist'}</span>
      <h1>{tamil ? 'சேமித்த சேவைகள்' : 'Saved services'}</h1>
      <p>{tamil ? 'பின்னர் பார்க்க அல்லது booking செய்ய நீங்கள் சேமித்த verified marketplace சேவைகள்.' : 'Verified marketplace services you saved to revisit or book later.'}</p>
    </section>

    {authenticated === false ? <Card>
      <EmptyState title={tamil ? 'Saved services பார்க்க sign in செய்யவும்' : 'Sign in to view saved services'}>
        {tamil ? 'சேவைகளை shortlist செய்து எந்த சாதனத்திலிருந்தும் மீண்டும் பார்க்க உங்கள் account-ல் sign in செய்யவும்.' : 'Sign in to shortlist services and return to them from your account.'}
      </EmptyState>
      <div className="button-row"><Link className="button button-primary" href="/login?returnTo=%2Fsaved-services">Sign in</Link><Link className="button button-secondary" href="/signup">{tamil ? 'Account உருவாக்கவும்' : 'Create account'}</Link></div>
    </Card> : loading ? <Card><p>{tamil ? 'Saved services ஏற்றுகிறது…' : 'Loading saved services…'}</p></Card> : error ? <Card><p className="field-error" role="alert">{error}</p><Button type="button" variant="secondary" onClick={() => void load()}>{tamil ? 'மீண்டும் முயற்சி' : 'Try again'}</Button></Card> : items.length === 0 ? <Card>
      <EmptyState title={tamil ? 'இன்னும் saved services இல்லை' : 'No saved services yet'}>
        {tamil ? 'Explore-ல் ஒரு verified service-ஐ திறந்து Save service பயன்படுத்துங்கள்.' : 'Open a verified service from Explore and use Save service.'}
      </EmptyState>
      <Link className="button button-primary" href="/explore">{tamil ? 'சேவைகளை Explore செய்' : 'Explore services'}</Link>
    </Card> : <div style={{ display: 'grid', gap: '1rem' }}>
      {items.map((item) => {
        if (!item.available || !item.service) {
          return <Card key={item.service_id} className="policy-card">
            <div className="section-heading"><div><span className="eyebrow">{tamil ? 'Saved service' : 'Saved service'}</span><h2>{tamil ? 'இந்த சேவை தற்போது கிடைக்கவில்லை' : 'This saved service is no longer available'}</h2></div><Badge tone="neutral">{tamil ? 'Unavailable' : 'Unavailable'}</Badge></div>
            <p className="detail-copy">{tamil ? 'Provider சேவையை pause/deactivate செய்திருக்கலாம். Saved reference-ஐ வேண்டுமெனில் remove செய்யலாம்.' : 'The provider may have paused or deactivated this service. You can remove the saved reference.'}</p>
            <Button type="button" variant="quiet" loading={busyId === item.service_id} onClick={() => void remove(item.service_id)}>{tamil ? 'Saved service-ஐ நீக்கு' : 'Remove saved service'}</Button>
          </Card>;
        }

        const service = item.service;
        return <Card key={item.service_id} className="policy-card">
          <div className="section-heading"><div><span className="eyebrow">{service.category || (tamil ? 'சேவை' : 'Service')}</span><h2>{service.name}</h2><p className="summary-note">{service.provider_name} · {service.provider_type === 'business' ? (tamil ? 'Business' : 'Business') : (tamil ? 'Professional' : 'Professional')}</p></div><Badge tone="success">{tamil ? 'Saved' : 'Saved'}</Badge></div>
          <p className="detail-copy">{service.description}</p>
          <dl className="review-details"><div><dt>{tamil ? 'இடம்' : 'Location'}</dt><dd>{service.location || (tamil ? 'Flexible' : 'Flexible')}</dd></div><div><dt>{tamil ? 'கால அளவு' : 'Duration'}</dt><dd>{service.duration_minutes} {tamil ? 'நிமிடங்கள்' : 'minutes'}</dd></div><div><dt>{tamil ? 'விலை' : 'Price'}</dt><dd>{money(service.base_price, service.currency)}</dd></div><div><dt>{tamil ? 'சேமித்த தேதி' : 'Saved'}</dt><dd>{new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(new Date(item.saved_at))}</dd></div></dl>
          <div className="button-row"><Link className="button button-primary" href={`/services/${encodeURIComponent(service.id)}`}>{tamil ? 'சேவையை திற' : 'Open service'}</Link><Button type="button" variant="quiet" loading={busyId === item.service_id} onClick={() => void remove(item.service_id)}>{tamil ? 'Unsave' : 'Unsave'}</Button></div>
        </Card>;
      })}
    </div>}
  </LocalizedAccountShell>;
}
