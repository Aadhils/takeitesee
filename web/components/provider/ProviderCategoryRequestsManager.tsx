'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { submitProviderCategoryRequest } from '../../app/provider/category-requests/actions';
import { useRemainingWorkspaceTranslations } from '../i18n/RemainingWorkspaceTranslations';
import styles from './ProviderCategoryRequestsResponsive.module.css';

type Application = { id: string; code: string; name: string; status: string };
type Category = { id: string; application_id: string; parent_id: string | null; code: string; name: string; active: boolean };
export type ProviderCategoryRequest = {
  id: string;
  provider_type: 'professional' | 'business';
  application_id: string;
  suggested_parent_category_id: string | null;
  requested_name: string;
  requested_description: string | null;
  status: 'pending' | 'approved' | 'rejected';
  review_note: string | null;
  created_category_id: string | null;
  created_at: string;
  reviewed_at: string | null;
};

function statusStyle(status: ProviderCategoryRequest['status']) {
  if (status === 'approved') return { background: '#ecfdf3', color: '#067647', borderColor: '#abefc6' };
  if (status === 'rejected') return { background: '#fef3f2', color: '#b42318', borderColor: '#fecdca' };
  return { background: '#fffaeb', color: '#b54708', borderColor: '#fedf89' };
}

export default function ProviderCategoryRequestsManager({
  applications,
  categories,
  requests,
}: {
  applications: Application[];
  categories: Category[];
  requests: ProviderCategoryRequest[];
}) {
  const { t, locale } = useRemainingWorkspaceTranslations();
  const appName = useMemo(() => new Map(applications.map((app) => [app.id, app.name])), [applications]);
  const categoryName = useMemo(() => new Map(categories.map((category) => [category.id, category.name])), [categories]);
  const rootCategories = useMemo(() => categories.filter((category) => !category.parent_id), [categories]);

  const statusLabel = (status: ProviderCategoryRequest['status']) => ({
    pending: t('categoryRequest.status.pending'),
    approved: t('categoryRequest.status.approved'),
    rejected: t('categoryRequest.status.rejected'),
  }[status]);

  const providerTypeLabel = (providerType: ProviderCategoryRequest['provider_type']) =>
    providerType === 'professional' ? t('categoryRequest.provider.professional') : t('categoryRequest.provider.business');

  const dateLabel = (value: string) => new Date(value).toLocaleString(locale);

  return <div className={styles.categoryRequestsJourney}>
    <section className="page-intro">
      <span className="eyebrow">{t('categoryRequest.eyebrow')}</span>
      <h1>{t('categoryRequest.title')}</h1>
      <p>{t('categoryRequest.intro')}</p>
      <Link href="/provider/services" className="text-link">{t('categoryRequest.back')}</Link>
    </section>

    <section className="card section-stack">
      <div>
        <span className="eyebrow">{t('categoryRequest.formEyebrow')}</span>
        <h2>{t('categoryRequest.formTitle')}</h2>
        <p>{t('categoryRequest.formHelp')}</p>
      </div>
      <form action={submitProviderCategoryRequest} className={`section-stack ${styles.requestForm}`}>
        <label>{t('categoryRequest.application')}
          <select name="application_id" required defaultValue={applications[0]?.id ?? ''}>
            {applications.map((app) => <option key={app.id} value={app.id}>{app.name}</option>)}
          </select>
        </label>
        <label>{t('categoryRequest.closestGroup')}
          <select name="parent_category_id" defaultValue="">
            <option value="">{t('categoryRequest.adminDecide')}</option>
            {rootCategories.map((category) => <option key={category.id} value={category.id}>{category.name} — {appName.get(category.application_id) ?? t('categoryRequest.applicationFallback')}</option>)}
          </select>
        </label>
        <label>{t('categoryRequest.name')}
          <input name="requested_name" required minLength={2} maxLength={100} placeholder={t('categoryRequest.namePlaceholder')} />
        </label>
        <label>{t('categoryRequest.description')}
          <textarea name="requested_description" rows={4} maxLength={1000} placeholder={t('categoryRequest.descriptionPlaceholder')} />
        </label>
        <button type="submit" className={styles.submitAction} disabled={!applications.length}>{t('categoryRequest.submit')}</button>
      </form>
    </section>

    <section className="section-stack">
      <div><span className="eyebrow">{t('categoryRequest.historyEyebrow')}</span><h2>{t('categoryRequest.historyTitle')}</h2></div>
      {requests.length ? requests.map((request) => <article className="card" key={request.id}>
        <div className={styles.requestHeader}>
          <div className={styles.requestIdentity}>
            <span className="eyebrow">{appName.get(request.application_id) ?? t('categoryRequest.applicationFallback')} · {providerTypeLabel(request.provider_type)}</span>
            <h3>{request.requested_name}</h3>
          </div>
          <span className={styles.statusPill} style={{ ...statusStyle(request.status), border: '1px solid', borderRadius: 999, padding: '5px 10px', fontSize: 12, fontWeight: 700 }}>{statusLabel(request.status)}</span>
        </div>
        {request.requested_description ? <p>{request.requested_description}</p> : null}
        <p><strong>{t('categoryRequest.suggestedGroup')}</strong> {request.suggested_parent_category_id ? categoryName.get(request.suggested_parent_category_id) ?? t('categoryRequest.categoryFallback') : t('categoryRequest.adminToDecide')}</p>
        {request.review_note ? <p><strong>{t('categoryRequest.adminNote')}</strong> {request.review_note}</p> : null}
        {request.status === 'approved' ? <p><strong>{t('categoryRequest.approvedCategory')}</strong> {request.created_category_id ? categoryName.get(request.created_category_id) ?? request.requested_name : request.requested_name}. {t('categoryRequest.approvedHelp')}</p> : null}
        {request.status === 'pending' ? <p className="summary-note">{t('categoryRequest.pendingHelp')}</p> : null}
        <p className="summary-note">{t('categoryRequest.submitted')} {dateLabel(request.created_at)}{request.reviewed_at ? ` · ${t('categoryRequest.reviewed')} ${dateLabel(request.reviewed_at)}` : ''}</p>
      </article>) : <div className="card"><p>{t('categoryRequest.empty')}</p></div>}
    </section>
  </div>;
}
