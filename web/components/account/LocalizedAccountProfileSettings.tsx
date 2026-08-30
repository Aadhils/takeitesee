'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Badge, Button, Card, Checkbox, ErrorState, Input, Select } from '../ui/primitives';
import { getSupabaseBrowserUser, isSupabaseConfigured } from '../../services/auth-adapter';
import { getAccountSettings, getCustomerProfile, saveAccountSettings, saveCustomerProfile, type AccountSettings, type CustomerProfile } from '../../services/customer-profile';
import { useRemainingWorkspaceTranslations } from '../i18n/RemainingWorkspaceTranslations';

function LocalizedAccountShell({ children, active, customerName }: { children: React.ReactNode; active: string; customerName?: string }) {
  const { t } = useRemainingWorkspaceTranslations();
  const name = customerName || t('account.yourAccount');
  const initials = name.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase();
  const links = [
    { href: '/account', label: t('account.overview') },
    { href: '/account/profile', label: t('account.profile') },
    { href: '/account/settings', label: t('account.settings') },
    { href: '/notifications', label: t('account.notifications') },
    { href: '/reviews', label: t('account.reviews') },
    { href: '/help', label: t('account.help') },
  ];
  return <div className="account-layout">
    <aside className="account-sidebar">
      <div className="account-sidebar-heading"><div className="provider-avatar account-avatar" aria-hidden="true">{initials || '?'}</div><div><strong>{name}</strong><span>{t('account.customer')}</span></div></div>
      <nav aria-label={t('account.nav')}>{links.map((link) => <Link href={link.href} className={active === link.href ? 'account-nav-active' : ''} aria-current={active === link.href ? 'page' : undefined} key={link.href}>{link.label}</Link>)}</nav>
    </aside>
    <main className="account-content">{children}</main>
  </div>;
}

export function LocalizedProfilePage() {
  const { t, locale } = useRemainingWorkspaceTranslations();
  const [profile, setProfile] = useState<CustomerProfile>();
  const [form, setForm] = useState<CustomerProfile>();
  const [userId, setUserId] = useState<string>();
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        setLoading(true); setError(undefined);
        if (!isSupabaseConfigured()) throw new Error('Live profile data is unavailable until Supabase is configured.');
        const user = await getSupabaseBrowserUser();
        if (!user) throw new Error('Sign in to view your profile.');
        const current = await getCustomerProfile(user.id, user.email ?? undefined);
        if (!active) return;
        setUserId(user.id); setProfile(current); setForm(current);
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : 'Unable to load your profile.');
      } finally { if (active) setLoading(false); }
    })();
    return () => { active = false; };
  }, []);

  const updateField = <K extends keyof CustomerProfile>(field: K, value: CustomerProfile[K]) => setForm((current) => current ? { ...current, [field]: value } : current);
  const save = async () => {
    if (!userId || !form || !form.displayName.trim()) return;
    try {
      setSaving(true); setError(undefined);
      await saveCustomerProfile(userId, form);
      setProfile(form); setEditing(false); setSaved(true);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to save your profile.'); }
    finally { setSaving(false); }
  };

  const customerName = profile?.displayName ?? t('account.yourAccount');
  return <LocalizedAccountShell active="/account/profile" customerName={customerName}>
    <section className="account-page-heading"><span className="eyebrow">{t('profile.eyebrow')}</span><h1>{t('profile.title')}</h1><p>{t('profile.intro')}</p></section>
    {loading ? <Card><p>{t('profile.loading')}</p></Card> : error && !profile ? <ErrorState title={t('profile.unavailable')}>{error}</ErrorState> : null}
    {profile && form ? <>
      <div className="profile-summary card"><div className="provider-avatar provider-avatar-large" aria-hidden="true">{profile.displayName.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase()}</div><div><span className="eyebrow">{t('profile.customerProfile')}</span><h2>{profile.displayName}</h2><p>{profile.email}</p><span className="card-location">{profile.location || t('common.notAdded')}</span></div><Badge tone="success">{t('profile.authenticated')}</Badge></div>
      <div className="profile-detail-grid">
        <Card><span className="eyebrow">{t('profile.identity')}</span><h2>{t('profile.contactDetails')}</h2>
          {editing ? <div className="profile-form"><Input label={t('profile.displayName')} value={form.displayName} required onChange={(event) => updateField('displayName', event.target.value)} /><Input label={t('profile.email')} type="email" value={form.email} readOnly hint={t('profile.emailHint')} /><Input label={t('profile.phone')} type="tel" value={form.phone} onChange={(event) => updateField('phone', event.target.value)} /><Input label={t('profile.location')} value={form.location} onChange={(event) => updateField('location', event.target.value)} /></div> : <dl className="account-details"><div><dt>{t('profile.name')}</dt><dd>{profile.displayName}</dd></div><div><dt>{t('profile.email')}</dt><dd>{profile.email}</dd></div><div><dt>{t('profile.phone')}</dt><dd>{profile.phone || t('common.notAdded')}</dd></div><div><dt>{t('profile.location')}</dt><dd>{profile.location || t('common.notAdded')}</dd></div></dl>}
          {editing ? <div className="account-actions"><Button type="button" variant="secondary" onClick={() => { setForm(profile); setEditing(false); }}>{t('common.cancel')}</Button><Button type="button" loading={saving} onClick={save}>{t('profile.save')}</Button></div> : <Button type="button" variant="secondary" onClick={() => { setSaved(false); setEditing(true); }}>{t('profile.edit')}</Button>}
          {saved ? <p className="explore-disclaimer" role="status">{t('profile.saved')}</p> : null}{error ? <p className="field-error" role="alert">{error}</p> : null}
        </Card>
        <Card><span className="eyebrow">{t('profile.preferences')}</span><h2>{t('profile.servicePreferences')}</h2>
          {editing ? <div className="profile-form"><Select label={t('profile.preferredLanguage')} value={form.preferredLanguage} onChange={(event) => updateField('preferredLanguage', event.target.value)}><option value="English">English</option><option value="Tamil">தமிழ்</option><option value="Hindi">Hindi</option><option value="Malayalam">Malayalam</option></Select><Input label={t('profile.serviceRegions')} value={form.serviceRegions.join(', ')} hint={t('profile.regionsHint')} onChange={(event) => updateField('serviceRegions', event.target.value.split(',').map((region) => region.trim()).filter(Boolean))} /></div> : <><div className="profile-region-list">{profile.serviceRegions.length ? profile.serviceRegions.map((region) => <Badge tone="neutral" key={region}>{region}</Badge>) : <span>{t('common.notAdded')}</span>}</div><dl className="account-details"><div><dt>{t('profile.preferredLanguage')}</dt><dd>{profile.preferredLanguage}</dd></div><div><dt>{t('profile.memberSince')}</dt><dd>{new Date(profile.memberSince).toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' })}</dd></div></dl></>}
        </Card>
      </div>
    </> : null}
  </LocalizedAccountShell>;
}

export function LocalizedSettingsPage() {
  const { t } = useRemainingWorkspaceTranslations();
  const [settings, setSettings] = useState<AccountSettings>();
  const [form, setForm] = useState<AccountSettings>();
  const [customerName, setCustomerName] = useState<string>();
  const [userId, setUserId] = useState<string>();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        setLoading(true); setError(undefined);
        if (!isSupabaseConfigured()) throw new Error('Live settings are unavailable until Supabase is configured.');
        const user = await getSupabaseBrowserUser();
        if (!user) throw new Error('Sign in to manage your settings.');
        const [current, profile] = await Promise.all([getAccountSettings(user.id), getCustomerProfile(user.id, user.email ?? undefined)]);
        if (!active) return;
        setUserId(user.id); setSettings(current); setForm(current); setCustomerName(profile.displayName);
      } catch (cause) { if (active) setError(cause instanceof Error ? cause.message : 'Unable to load your settings.'); }
      finally { if (active) setLoading(false); }
    })();
    return () => { active = false; };
  }, []);

  const updateField = <K extends keyof AccountSettings>(field: K, value: AccountSettings[K]) => { setSaved(false); setForm((current) => current ? { ...current, [field]: value } : current); };
  const save = async () => {
    if (!userId || !form) return;
    try { setSaving(true); setError(undefined); await saveAccountSettings(userId, form); setSettings(form); setSaved(true); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to save your settings.'); }
    finally { setSaving(false); }
  };

  return <LocalizedAccountShell active="/account/settings" customerName={customerName ?? t('account.yourAccount')}>
    <section className="account-page-heading"><span className="eyebrow">{t('settings.eyebrow')}</span><h1>{t('settings.title')}</h1><p>{t('settings.intro')}</p></section>
    {saved ? <div className="alert alert-success" role="status"><strong>{t('settings.saved')}</strong><span>{t('settings.savedHelp')}</span></div> : null}
    {loading ? <Card><p>{t('settings.loading')}</p></Card> : error && !settings ? <ErrorState title={t('settings.unavailable')}>{error}</ErrorState> : null}
    {settings && form ? <><div className="settings-grid">
      <Card className="settings-section"><span className="eyebrow">{t('settings.communication')}</span><h2>{t('settings.notificationPreferences')}</h2><Checkbox label={t('settings.bookingUpdates')} description={t('settings.bookingUpdatesHelp')} checked={form.notifyBookingUpdates} onChange={(event) => updateField('notifyBookingUpdates', event.target.checked)} /><Checkbox label={t('settings.reviewReminders')} description={t('settings.reviewRemindersHelp')} checked={form.notifyReviewReminders} onChange={(event) => updateField('notifyReviewReminders', event.target.checked)} /><Checkbox label={t('settings.productInfo')} description={t('settings.productInfoHelp')} checked={form.notifyProductUpdates} onChange={(event) => updateField('notifyProductUpdates', event.target.checked)} /></Card>
      <Card className="settings-section"><span className="eyebrow">{t('settings.experience')}</span><h2>{t('settings.languageAccessibility')}</h2><Select label={t('settings.language')} value={form.preferredLanguage} onChange={(event) => updateField('preferredLanguage', event.target.value)}><option value="English">English</option><option value="Tamil">தமிழ்</option><option value="Hindi">Hindi</option><option value="Malayalam">Malayalam</option></Select><Checkbox label={t('settings.reducedMotion')} description={t('settings.reducedMotionHelp')} checked={form.reducedMotion} onChange={(event) => updateField('reducedMotion', event.target.checked)} /><Checkbox label={t('settings.largerText')} description={t('settings.largerTextHelp')} checked={form.largerText} onChange={(event) => updateField('largerText', event.target.checked)} /></Card>
      <Card className="settings-section"><span className="eyebrow">{t('settings.privacy')}</span><h2>{t('settings.accountVisibility')}</h2><Checkbox label={t('settings.historyRecommendations')} description={t('settings.historyRecommendationsHelp')} checked={form.useHistoryForRecommendations} onChange={(event) => updateField('useHistoryForRecommendations', event.target.checked)} /><p className="settings-note">{t('settings.privacyNote')}</p></Card>
      <Card className="settings-section settings-danger"><span className="eyebrow">{t('settings.danger')}</span><h2>{t('settings.accountActions')}</h2><p>{t('settings.dangerHelp')}</p><Button type="button" variant="danger" disabled>{t('settings.deleteAccount')}</Button></Card>
    </div>{error ? <p className="field-error" role="alert">{error}</p> : null}<Button type="button" loading={saving} onClick={save}>{t('settings.save')}</Button></> : null}
  </LocalizedAccountShell>;
}
