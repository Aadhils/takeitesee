'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import LocalizedAccountShell from './LocalizedAccountShell';
import styles from './CustomerSavedItemsResponsive.module.css';
import { Badge, Button, Card, EmptyState } from '../ui/primitives';
import { useRemainingWorkspaceTranslations } from '../i18n/RemainingWorkspaceTranslations';

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
  const { locale, t } = useRemainingWorkspaceTranslations();
  const [items, setItems] = useState<SavedService[]>([]);
  const [loading, setLoading] = useState(true);
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState('');

  const load = useCallback(async () => {
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
      if (!response.ok) throw new Error(payload.error || t('savedServices.error.load'));
      setAuthenticated(true);
      setItems(payload.saved_services ?? []);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t('savedServices.error.load'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => { void load(); }, [load]);

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
      if (!response.ok) throw new Error(payload.error || t('savedServices.error.remove'));
      setItems((current) => current.filter((item) => item.service_id !== serviceId));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t('savedServices.error.remove'));
    } finally {
      setBusyId('');
    }
  };

  const money = (amount: number, currency: string) => {
    try { return new Intl.NumberFormat(locale, { style: 'currency', currency, maximumFractionDigits: 2 }).format(amount); }
    catch { return `${currency} ${amount.toFixed(2)}`; }
  };

  return <div className={styles.savedItemsJourney}><LocalizedAccountShell active="/saved-services">
    <section className="account-page-heading">
      <span className="eyebrow">{t('savedServices.eyebrow')}</span>
      <h1>{t('savedServices.title')}</h1>
      <p>{t('savedServices.intro')}</p>
    </section>

    {authenticated === false ? <Card>
      <EmptyState title={t('savedServices.signInTitle')}>
        {t('savedServices.signInHelp')}
      </EmptyState>
      <div className="button-row"><Link className="button button-primary" href="/login?returnTo=%2Fsaved-services">{t('savedServices.signIn')}</Link><Link className="button button-secondary" href="/signup">{t('savedServices.createAccount')}</Link></div>
    </Card> : loading ? <Card><p>{t('savedServices.loading')}</p></Card> : error ? <Card><p className="field-error" role="alert">{error}</p><Button type="button" variant="secondary" onClick={() => void load()}>{t('common.retry')}</Button></Card> : items.length === 0 ? <Card>
      <EmptyState title={t('savedServices.emptyTitle')}>
        {t('savedServices.emptyHelp')}
      </EmptyState>
      <Link className="button button-primary" href="/explore">{t('savedServices.explore')}</Link>
    </Card> : <div style={{ display: 'grid', gap: '1rem' }}>
      {items.map((item) => {
        if (!item.available || !item.service) {
          return <Card key={item.service_id} className="policy-card">
            <div className="section-heading"><div><span className="eyebrow">{t('savedServices.unavailableEyebrow')}</span><h2>{t('savedServices.unavailableTitle')}</h2></div><Badge tone="neutral">{t('savedServices.unavailableBadge')}</Badge></div>
            <p className="detail-copy">{t('savedServices.unavailableHelp')}</p>
            <Button type="button" variant="quiet" loading={busyId === item.service_id} onClick={() => void remove(item.service_id)}>{t('savedServices.remove')}</Button>
          </Card>;
        }

        const service = item.service;
        return <Card key={item.service_id} className="policy-card">
          <div className="section-heading"><div><span className="eyebrow">{service.category || t('savedServices.categoryFallback')}</span><h2>{service.name}</h2><p className="summary-note">{service.provider_name} · {service.provider_type === 'business' ? t('savedServices.provider.business') : t('savedServices.provider.professional')}</p></div><Badge tone="success">{t('savedServices.savedBadge')}</Badge></div>
          <p className="detail-copy">{service.description}</p>
          <dl className="review-details"><div><dt>{t('savedServices.location')}</dt><dd>{service.location || t('savedServices.flexible')}</dd></div><div><dt>{t('savedServices.duration')}</dt><dd>{service.duration_minutes} {t('savedServices.minutes')}</dd></div><div><dt>{t('savedServices.price')}</dt><dd>{money(service.base_price, service.currency)}</dd></div><div><dt>{t('savedServices.savedDate')}</dt><dd>{new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(new Date(item.saved_at))}</dd></div></dl>
          <div className="button-row"><Link className="button button-primary" href={`/services/${encodeURIComponent(service.id)}`}>{t('savedServices.open')}</Link><Button type="button" variant="quiet" loading={busyId === item.service_id} onClick={() => void remove(item.service_id)}>{t('savedServices.unsave')}</Button></div>
        </Card>;
      })}
    </div>}
  </LocalizedAccountShell></div>;
}
