'use client';

import { useLanguage } from '../i18n/LanguageProvider';
import { Alert, Badge, Card } from '../ui/primitives';
import { saveScopedServiceSettings } from '../../app/admin/settings/actions';
import { AdminLiveEmptyState, AdminLiveHeading, AdminLiveShell } from './AdminLiveChrome';

type SettingsScope = {
  key: string;
  serviceId: string;
  applicationId: string;
  locationId: string | null;
  categoryId: string | null;
  serviceName: string | null;
  applicationName: string | null;
  locationName: string | null;
  categoryName: string | null;
  canManage: boolean;
  stored: boolean;
  updatedAt: string | null;
  settings: {
    showNewServicesAfterReview: boolean;
    displayVerificationBadges: boolean;
    defaultReviewQueue: string;
    requireProviderResponse: boolean;
    flagLowRatings: boolean;
    lowRatingThreshold: number;
  };
};

type SettingsAudit = { id: number; createdAt: string };

export default function AdminLiveSettings({ saved, error, scopes, audits }: { saved: boolean; error: string | null; scopes: SettingsScope[]; audits: SettingsAudit[] }) {
  const { locale } = useLanguage();
  const text = (en: string, ta: string) => locale === 'ta-IN' ? ta : en;
  const formatTimestamp = (value: string) => new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Kolkata',
  }).format(new Date(value));

  return (
    <AdminLiveShell active="/admin/settings">
      <AdminLiveHeading
        eyebrow={text('Scoped operations configuration', 'Scope செய்யப்பட்ட செயல்பாட்டு அமைப்பு')}
        title={text('Live admin settings', 'Live admin அமைப்புகள்')}
        description={text(
          'Operational preferences are stored in Supabase per active service scope. Saves require manage permission and every successful change is written to the admin audit log.',
          'ஒவ்வொரு active service scope-க்கும் செயல்பாட்டு preferences Supabase-ல் சேமிக்கப்படுகின்றன. Save செய்ய manage permission தேவை; ஒவ்வொரு வெற்றிகரமான மாற்றமும் admin audit log-ல் பதிவு செய்யப்படும்.',
        )}
      />

      {saved ? (
        <Alert tone="success" title={text('Settings saved', 'அமைப்புகள் சேமிக்கப்பட்டன')}>
          {text('The scoped configuration was persisted and audited.', 'Scope செய்யப்பட்ட configuration சேமிக்கப்பட்டு audit செய்யப்பட்டது.')}
        </Alert>
      ) : null}
      {error === 'manage_required' ? (
        <Alert tone="danger" title={text('Manage permission required', 'Manage permission தேவை')}>
          {text('This scope is view-only for the signed-in administrator.', 'Signed-in administrator-க்கு இந்த scope view-only ஆக உள்ளது.')}
        </Alert>
      ) : null}
      {error && error !== 'manage_required' ? (
        <Alert tone="danger" title={text('Settings were not saved', 'அமைப்புகள் சேமிக்கப்படவில்லை')}>
          {text('Please review the values and try again.', 'Values-ஐ சரிபார்த்து மீண்டும் முயற்சிக்கவும்.')}
        </Alert>
      ) : null}

      {scopes.length ? (
        <div className="admin-live-settings-stack">
          {scopes.map((scope) => {
            const serviceName = scope.serviceName ?? text('Scoped service', 'Scope செய்யப்பட்ட சேவை');
            const applicationName = scope.applicationName ?? text('Application', 'Application');
            const locationName = scope.locationId ? scope.locationName ?? text('Assigned location', 'ஒதுக்கப்பட்ட இடம்') : text('All locations', 'அனைத்து இடங்கள்');
            const categoryName = scope.categoryId ? scope.categoryName ?? text('Assigned category', 'ஒதுக்கப்பட்ட வகை') : text('All categories', 'அனைத்து வகைகள்');

            return (
              <Card className="admin-live-settings-card" key={scope.key}>
                <div className="admin-record-top">
                  <div>
                    <span className="eyebrow">{applicationName} · {locationName}</span>
                    <h2>{serviceName}</h2>
                    <p>{categoryName}</p>
                  </div>
                  <Badge tone={scope.canManage ? 'success' : 'neutral'}>
                    {scope.canManage ? text('Manage enabled', 'Manage இயக்கப்பட்டுள்ளது') : text('View only', 'பார்வைக்கு மட்டும்')}
                  </Badge>
                </div>

                <form action={saveScopedServiceSettings}>
                  <input type="hidden" name="service_id" value={scope.serviceId} />
                  <input type="hidden" name="application_id" value={scope.applicationId} />
                  <input type="hidden" name="location_id" value={scope.locationId ?? ''} />
                  <input type="hidden" name="category_id" value={scope.categoryId ?? ''} />

                  <div className="admin-settings-grid">
                    <section className="admin-settings-panel">
                      <span className="eyebrow">{text('Marketplace', 'Marketplace')}</span>
                      <h3>{text('Listing preferences', 'Listing preferences')}</h3>
                      <label className="choice-row">
                        <input className="choice-input" type="checkbox" name="show_new_services_after_review" defaultChecked={scope.settings.showNewServicesAfterReview} disabled={!scope.canManage} />
                        <span>
                          <strong>{text('Show new services after review', 'Review பிறகு புதிய சேவைகளை காட்டு')}</strong>
                          <span className="choice-description">{text('Reviewed services can appear in the marketplace catalog.', 'Review செய்யப்பட்ட சேவைகள் marketplace catalog-ல் தோன்றலாம்.')}</span>
                        </span>
                      </label>
                      <label className="choice-row">
                        <input className="choice-input" type="checkbox" name="display_verification_badges" defaultChecked={scope.settings.displayVerificationBadges} disabled={!scope.canManage} />
                        <span>
                          <strong>{text('Display verification badges', 'Verification badges-ஐ காட்டு')}</strong>
                          <span className="choice-description">{text('Show verified-provider trust status on scoped listings.', 'Scope செய்யப்பட்ட listings-ல் verified-provider trust status-ஐ காட்டு.')}</span>
                        </span>
                      </label>
                    </section>

                    <section className="admin-settings-panel">
                      <span className="eyebrow">{text('Booking rules', 'Booking விதிகள்')}</span>
                      <h3>{text('Customer journey defaults', 'Customer journey defaults')}</h3>
                      <div className="field">
                        <label className="field-label" htmlFor={`review-${scope.serviceId}`}>{text('Default review queue', 'Default review queue')}</label>
                        <select className="field-control" id={`review-${scope.serviceId}`} name="default_review_queue" defaultValue={scope.settings.defaultReviewQueue} disabled={!scope.canManage}>
                          <option value="provider_review">{text('Provider review', 'Provider review')}</option>
                          <option value="manual_review">{text('Manual review', 'Manual review')}</option>
                        </select>
                      </div>
                      <label className="choice-row">
                        <input className="choice-input" type="checkbox" name="require_provider_response" defaultChecked={scope.settings.requireProviderResponse} disabled={!scope.canManage} />
                        <span>
                          <strong>{text('Require provider response', 'Provider response தேவை')}</strong>
                          <span className="choice-description">{text('Keep provider acknowledgement enabled for scoped booking requests.', 'Scope செய்யப்பட்ட booking requests-க்கு provider acknowledgement-ஐ enabled-ஆ வைத்திரு.')}</span>
                        </span>
                      </label>
                    </section>

                    <section className="admin-settings-panel">
                      <span className="eyebrow">{text('Trust and reviews', 'Trust மற்றும் reviews')}</span>
                      <h3>{text('Moderation preferences', 'Moderation preferences')}</h3>
                      <label className="choice-row">
                        <input className="choice-input" type="checkbox" name="flag_low_ratings" defaultChecked={scope.settings.flagLowRatings} disabled={!scope.canManage} />
                        <span>
                          <strong>{text('Flag low ratings for review', 'குறைந்த ratings-ஐ review-க்கு குறி')}</strong>
                          <span className="choice-description">{text('Enable the persisted low-rating moderation preference.', 'Persisted low-rating moderation preference-ஐ இயக்கு.')}</span>
                        </span>
                      </label>
                      <div className="field">
                        <label className="field-label" htmlFor={`threshold-${scope.serviceId}`}>{text('Low rating threshold', 'Low rating வரம்பு')}</label>
                        <select className="field-control" id={`threshold-${scope.serviceId}`} name="low_rating_threshold" defaultValue={String(scope.settings.lowRatingThreshold)} disabled={!scope.canManage}>
                          {[1, 2, 3, 4, 5].map((rating) => <option value={String(rating)} key={rating}>{locale === 'ta-IN' ? `${rating} நட்சத்திரம்` : `${rating} ${rating === 1 ? 'star' : 'stars'}`}</option>)}
                        </select>
                      </div>
                    </section>
                  </div>

                  <div className="admin-settings-save-row">
                    <div>
                      <strong>{scope.stored ? text('Database configuration active', 'Database configuration செயலில்') : text('Using safe defaults', 'Safe defaults பயன்படுத்தப்படுகின்றன')}</strong>
                      <span>
                        {scope.stored && scope.updatedAt
                          ? `${text('Last saved', 'கடைசியாக சேமித்தது')} ${formatTimestamp(scope.updatedAt)}`
                          : text('The first save creates the scoped settings record.', 'முதல் save இந்த scoped settings record-ஐ உருவாக்கும்.')}
                      </span>
                    </div>
                    <button className="button button-primary" type="submit" disabled={!scope.canManage}>{text('Save settings', 'அமைப்புகளை சேமி')}</button>
                  </div>
                </form>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card>
          <AdminLiveEmptyState titleEn="No scoped services" titleTa="Scope செய்யப்பட்ட சேவைகள் இல்லை">
            {text('Assign an enabled service scope before configuring operational settings.', 'Operational settings configure செய்வதற்கு முன் enabled service scope ஒன்றை assign செய்யவும்.')}
          </AdminLiveEmptyState>
        </Card>
      )}

      <Card className="admin-settings-audit-card">
        <div className="admin-section-heading">
          <div>
            <span className="eyebrow">{text('Audit trail', 'Audit trail')}</span>
            <h2>{text('Recent setting changes', 'சமீபத்திய setting மாற்றங்கள்')}</h2>
          </div>
          <Badge tone="info">{text('Supabase persisted', 'Supabase-ல் சேமிக்கப்பட்டது')}</Badge>
        </div>
        {audits.length ? (
          <ol className="admin-settings-audit-list">
            {audits.map((audit) => (
              <li key={audit.id}>
                <div><strong>{text('Settings updated', 'Settings புதுப்பிக்கப்பட்டது')}</strong><span>{formatTimestamp(audit.createdAt)}</span></div>
                <Badge tone="success">{text('audited', 'audit செய்யப்பட்டது')}</Badge>
              </li>
            ))}
          </ol>
        ) : (
          <p className="admin-fixture-note">{text('No settings changes have been recorded for this administrator yet.', 'இந்த administrator-க்கு இதுவரை settings changes பதிவு செய்யப்படவில்லை.')}</p>
        )}
      </Card>
    </AdminLiveShell>
  );
}
