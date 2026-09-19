'use client';

import Link from 'next/link';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import { Badge, Button, Card, Checkbox, EmptyState, Input, Textarea } from '../ui/primitives';
import { useIdentityWorkspaceTranslations } from '../i18n/IdentityWorkspaceTranslations';
import styles from './ProviderDashboardIdentityCenter.module.css';

type Profile = {
  provider_type: 'professional' | 'business';
  id: string;
  display_name: string;
  description: string;
  location: string;
  verified: boolean;
  services_total: number;
  services_active: number;
};

type ProfessionalRole = {
  id: string;
  title: string;
  summary: string | null;
  experience_years: number | null;
  service_bookings_enabled: boolean;
  freelance_enabled: boolean;
  part_time_enabled: boolean;
  full_time_enabled: boolean;
  contract_enabled: boolean;
  active: boolean;
};

type RoleForm = {
  title: string;
  summary: string;
  experience_years: string;
  service_bookings_enabled: boolean;
  freelance_enabled: boolean;
  part_time_enabled: boolean;
  full_time_enabled: boolean;
  contract_enabled: boolean;
  active: boolean;
};

const emptyRoleForm: RoleForm = {
  title: '',
  summary: '',
  experience_years: '',
  service_bookings_enabled: true,
  freelance_enabled: false,
  part_time_enabled: false,
  full_time_enabled: false,
  contract_enabled: false,
  active: true,
};

export default function ProviderDashboardIdentityCenter({ onProfileUpdated }: { onProfileUpdated?: () => void }) {
  const { t } = useIdentityWorkspaceTranslations();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [form, setForm] = useState({ display_name: '', description: '', location: '' });
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [roles, setRoles] = useState<ProfessionalRole[]>([]);
  const [rolesLoading, setRolesLoading] = useState(false);
  const [roleEditorOpen, setRoleEditorOpen] = useState(false);
  const [editingRoleId, setEditingRoleId] = useState<string | null>(null);
  const [roleSaving, setRoleSaving] = useState(false);
  const [roleError, setRoleError] = useState('');
  const [roleNotice, setRoleNotice] = useState('');
  const [roleForm, setRoleForm] = useState<RoleForm>(emptyRoleForm);
  const [profileManagerOpen, setProfileManagerOpen] = useState(false);
  const [rolesManagerOpen, setRolesManagerOpen] = useState(false);
  const [setupManagerOpen, setSetupManagerOpen] = useState(false);

  const loadRoles = useCallback(async () => {
    setRolesLoading(true);
    setRoleError('');
    try {
      const response = await fetch('/api/provider/profile/roles', { cache: 'no-store' });
      const body = await response.json() as { roles?: ProfessionalRole[]; error?: string };
      if (!response.ok) throw new Error(body.error ?? t('provider.identity.loadRolesFallback'));
      const nextRoles = body.roles ?? [];
      setRoles(nextRoles);
      if (nextRoles.length === 0) setRolesManagerOpen(true);
    } catch (cause) {
      setRoleError(cause instanceof Error ? cause.message : t('provider.identity.loadRolesFallback'));
    } finally {
      setRolesLoading(false);
    }
  }, [t]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/provider/profile', { cache: 'no-store' });
      const body = await response.json() as { profile?: Profile; error?: string };
      if (!response.ok || !body.profile) throw new Error(body.error ?? t('profile.loadFallback'));
      setProfile(body.profile);
      const profileReady = body.profile.display_name.trim().length >= 2
        && body.profile.description.trim().length >= 20
        && body.profile.location.trim().length >= 2;
      setProfileManagerOpen(!profileReady);
      setForm({ display_name: body.profile.display_name, description: body.profile.description, location: body.profile.location });
      if (body.profile.provider_type === 'professional') void loadRoles();
      else setRoles([]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t('profile.loadFallback'));
    } finally {
      setLoading(false);
    }
  }, [loadRoles, t]);

  useEffect(() => { void load(); }, [load]);

  const complete = Boolean(profile && profile.display_name.trim().length >= 2 && profile.description.trim().length >= 20 && profile.location.trim().length >= 2);

  const saveProfile = async (event: FormEvent) => {
    event.preventDefault();
    if (saving) return;
    setSaving(true); setError(''); setNotice('');
    try {
      const response = await fetch('/api/provider/profile', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      const body = await response.json() as { error?: string };
      if (!response.ok) throw new Error(body.error ?? t('profile.saveFallback'));
      setNotice(t('provider.identity.profileSaved')); setEditing(false); await load(); onProfileUpdated?.();
    } catch (cause) { setError(cause instanceof Error ? cause.message : t('profile.saveFallback')); }
    finally { setSaving(false); }
  };

  const startNewRole = () => { setRolesManagerOpen(true); setEditingRoleId(null); setRoleForm(emptyRoleForm); setRoleError(''); setRoleNotice(''); setRoleEditorOpen(true); };
  const startEditRole = (role: ProfessionalRole) => {
    setRolesManagerOpen(true);
    setEditingRoleId(role.id); setRoleError(''); setRoleNotice(''); setRoleEditorOpen(true);
    setRoleForm({ title: role.title, summary: role.summary ?? '', experience_years: role.experience_years === null ? '' : String(role.experience_years), service_bookings_enabled: role.service_bookings_enabled, freelance_enabled: role.freelance_enabled, part_time_enabled: role.part_time_enabled, full_time_enabled: role.full_time_enabled, contract_enabled: role.contract_enabled, active: role.active });
  };
  const closeRoleEditor = () => { setRoleEditorOpen(false); setEditingRoleId(null); setRoleForm(emptyRoleForm); setRoleError(''); };

  const saveRole = async (event: FormEvent) => {
    event.preventDefault();
    if (roleSaving) return;
    const normalized = roleForm.title.trim().toLocaleLowerCase();
    if (roles.some((role) => role.id !== editingRoleId && role.title.trim().toLocaleLowerCase() === normalized)) { setRoleError(t('provider.identity.duplicateRole')); return; }
    setRoleSaving(true); setRoleError(''); setRoleNotice('');
    try {
      const response = await fetch('/api/provider/profile/roles', { method: editingRoleId ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: editingRoleId ?? undefined, ...roleForm }) });
      const body = await response.json() as { error?: string };
      if (!response.ok) throw new Error(body.error ?? t('provider.identity.saveRoleFallback'));
      setRoleNotice(t('provider.identity.roleSaved')); closeRoleEditor(); await loadRoles();
    } catch (cause) { setRoleError(cause instanceof Error ? cause.message : t('provider.identity.saveRoleFallback')); }
    finally { setRoleSaving(false); }
  };

  const deleteRole = async (role: ProfessionalRole) => {
    if (!window.confirm(t('provider.identity.deleteRoleConfirm'))) return;
    setRoleSaving(true); setRoleError('');
    try {
      const response = await fetch('/api/provider/profile/roles', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: role.id }) });
      const body = await response.json() as { error?: string };
      if (!response.ok) throw new Error(body.error ?? t('provider.identity.deleteRoleFallback'));
      await loadRoles();
    } catch (cause) { setRoleError(cause instanceof Error ? cause.message : t('provider.identity.deleteRoleFallback')); }
    finally { setRoleSaving(false); }
  };

  if (loading) return <Card className={styles.panel}><p>{t('provider.identity.loadingIdentity')}</p></Card>;
  if (!profile) return <Card className={styles.panel}><p className="field-error" role="alert">{error || t('provider.identity.profileUnavailable')}</p></Card>;

  return <section id="provider-profile" className={styles.center} aria-label={t('provider.identity.controlsLabel')}>
    <details
      className={styles.managementDisclosure}
      open={profileManagerOpen}
      onToggle={(event) => setProfileManagerOpen(event.currentTarget.open)}
    >
      <summary className={styles.managementSummary}>
        <div className={styles.managementSummaryCopy}>
          <span className={styles.eyebrow}>{t('provider.identity.profileDetails')}</span>
          <strong>{profile.display_name || t('provider.identity.publicProfileDetails')}</strong>
          <small>{profile.location || t('profile.serviceArea')} · {profile.services_active} {t('profile.active')} / {profile.services_total} {t('provider.services').toLowerCase()}</small>
        </div>
        <div className={styles.managementSummaryMeta}>
          <Badge tone={profile.verified ? 'success' : 'warning'}>{profile.verified ? t('profile.verified') : t('profile.verificationPending')}</Badge>
          <Badge tone={complete ? 'success' : 'warning'}>{complete ? t('profile.ready') : t('profile.needsWork')}</Badge>
          <span className={styles.managementCaret} aria-hidden="true">⌄</span>
        </div>
      </summary>

      <div className={styles.managementBody}>
        {notice ? <p className={styles.notice} role="status">{notice}</p> : null}
        {error ? <p className="field-error" role="alert">{error}</p> : null}

        <div className={styles.preview}>
          <div><strong>{profile.display_name}</strong><p>{profile.description || t('provider.identity.addDescription')}</p></div>
          <div className={styles.facts}><span><small>{t('profile.serviceArea')}</small><strong>{profile.location || '—'}</strong></span><span><small>{t('provider.services')}</small><strong>{profile.services_active} {t('profile.active')} · {profile.services_total}</strong></span></div>
        </div>

        <div className={styles.actions}>
          <Button type="button" onClick={() => setEditing((value) => !value)}>{t('profile.edit')}</Button>
          <Link href="/provider/public-readiness" className={styles.secondaryLink}>{t('provider.identity.publicReadiness')}</Link>
        </div>

        {editing ? <form className={styles.editor} onSubmit={saveProfile}>
          <div className={styles.twoColumns}><Input label={profile.provider_type === 'business' ? t('profile.businessDisplayName') : t('provider.identity.profileName')} value={form.display_name} onChange={(event) => setForm((current) => ({ ...current, display_name: event.target.value }))} required maxLength={120} /><Input label={t('profile.serviceArea')} value={form.location} onChange={(event) => setForm((current) => ({ ...current, location: event.target.value }))} required maxLength={160} /></div>
          <Textarea label={t('profile.providerDescription')} value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} maxLength={1200} rows={3} />
          <div className={styles.actions}><Button type="submit" loading={saving}>{t('profile.save')}</Button><Button type="button" variant="secondary" onClick={() => { setEditing(false); setForm({ display_name: profile.display_name, description: profile.description, location: profile.location }); }}>{t('profile.cancel')}</Button></div>
        </form> : null}
      </div>
    </details>

    {profile.provider_type === 'professional' ? <details
      className={styles.managementDisclosure}
      open={rolesManagerOpen}
      onToggle={(event) => setRolesManagerOpen(event.currentTarget.open)}
    >
      <summary className={styles.managementSummary}>
        <div className={styles.managementSummaryCopy}>
          <span className={styles.eyebrow}>{t('profile.professional')}</span>
          <strong>{t('provider.identity.roles')}</strong>
          <small>{rolesLoading ? t('provider.identity.loadingRoles') : roles.length ? `${roles.length} ${roles.length === 1 ? t('provider.identity.roleSingular') : t('provider.identity.rolePlural')}` : t('provider.identity.noRoles')}</small>
        </div>
        <div className={styles.managementSummaryMeta}>
          <Badge tone={roles.some((role) => role.active) ? 'success' : 'neutral'}>{roles.filter((role) => role.active).length} {t('profile.active')}</Badge>
          <span className={styles.managementCaret} aria-hidden="true">⌄</span>
        </div>
      </summary>

      <div className={styles.managementBody}>
        <div className={styles.sectionHead}>
          <div><p>{t('provider.identity.rolesHelp')}</p></div>
          {!roleEditorOpen ? <Button type="button" onClick={startNewRole}>{t('provider.identity.addRole')}</Button> : null}
        </div>
        {roleNotice ? <p className={styles.notice} role="status">{roleNotice}</p> : null}
        {roleError && !roleEditorOpen ? <p className="field-error" role="alert">{roleError}</p> : null}
        {rolesLoading ? <p>{t('provider.identity.loadingRoles')}</p> : null}
        {!rolesLoading && roles.length === 0 ? <EmptyState title={t('provider.identity.noRoles')} action={<Button type="button" onClick={startNewRole}>{t('provider.identity.addRole')}</Button>}>{t('provider.identity.noRolesBody')}</EmptyState> : null}
        {roles.length ? <div className={styles.roleRail}>{roles.map((role) => <article className={styles.roleCard} key={role.id}><div className={styles.roleTop}><div><h3>{role.title}</h3><small>{role.experience_years === null ? t('provider.identity.experienceNotSpecified') : `${role.experience_years} ${t('provider.identity.yearsExperience')}`}</small></div><Badge tone={role.active ? 'success' : 'neutral'}>{role.active ? t('provider.identity.active') : t('provider.identity.paused')}</Badge></div><p>{role.summary || t('provider.identity.addRoleSummary')}</p><div className={styles.chips}>{role.service_bookings_enabled ? <Badge tone="info">{t('provider.identity.serviceBookings')}</Badge> : null}{role.freelance_enabled ? <Badge tone="info">{t('provider.identity.freelance')}</Badge> : null}{role.part_time_enabled ? <Badge tone="info">{t('provider.identity.partTime')}</Badge> : null}{role.full_time_enabled ? <Badge tone="info">{t('provider.identity.fullTime')}</Badge> : null}{role.contract_enabled ? <Badge tone="info">{t('provider.identity.contract')}</Badge> : null}</div><div className={styles.actions}><Button type="button" variant="secondary" onClick={() => startEditRole(role)} disabled={roleSaving}>{t('provider.identity.edit')}</Button><Button type="button" variant="danger" onClick={() => void deleteRole(role)} disabled={roleSaving}>{t('provider.identity.delete')}</Button></div></article>)}</div> : null}

        {roleEditorOpen ? <form className={styles.roleEditor} onSubmit={saveRole}>
          <div className={styles.twoColumns}><Input label={t('provider.identity.roleTitle')} value={roleForm.title} onChange={(event) => { setRoleError(''); setRoleForm((current) => ({ ...current, title: event.target.value })); }} required minLength={2} maxLength={120} /><Input label={t('provider.identity.experienceOptional')} type="number" min={0} max={80} step={1} value={roleForm.experience_years} onChange={(event) => setRoleForm((current) => ({ ...current, experience_years: event.target.value }))} /></div>
          <Textarea label={t('provider.identity.roleSummary')} value={roleForm.summary} onChange={(event) => setRoleForm((current) => ({ ...current, summary: event.target.value }))} maxLength={1200} rows={3} />
          <Checkbox label={t('provider.identity.serviceBookings')} checked={roleForm.service_bookings_enabled} onChange={(event) => setRoleForm((current) => ({ ...current, service_bookings_enabled: event.target.checked }))} />
          <details className={styles.more}><summary>{t('provider.identity.moreOptions')}</summary><div className={styles.optionGrid}><Checkbox label={t('provider.identity.freelance')} checked={roleForm.freelance_enabled} onChange={(event) => setRoleForm((current) => ({ ...current, freelance_enabled: event.target.checked }))} /><Checkbox label={t('provider.identity.partTime')} checked={roleForm.part_time_enabled} onChange={(event) => setRoleForm((current) => ({ ...current, part_time_enabled: event.target.checked }))} /><Checkbox label={t('provider.identity.fullTime')} checked={roleForm.full_time_enabled} onChange={(event) => setRoleForm((current) => ({ ...current, full_time_enabled: event.target.checked }))} /><Checkbox label={t('provider.identity.contract')} checked={roleForm.contract_enabled} onChange={(event) => setRoleForm((current) => ({ ...current, contract_enabled: event.target.checked }))} /><Checkbox label={t('provider.identity.keepRoleActive')} checked={roleForm.active} onChange={(event) => setRoleForm((current) => ({ ...current, active: event.target.checked }))} /></div></details>
          {roleError ? <p className="field-error" role="alert" aria-live="assertive">{roleError}</p> : null}
          <div className={styles.actions}><Button type="submit" loading={roleSaving}>{editingRoleId ? t('provider.identity.updateRole') : t('provider.identity.saveRole')}</Button><Button type="button" variant="secondary" onClick={closeRoleEditor}>{t('profile.cancel')}</Button></div>
        </form> : null}
      </div>
    </details> : null}

    <details
      className={`${styles.managementDisclosure} ${styles.setupDisclosure}`}
      open={setupManagerOpen}
      onToggle={(event) => setSetupManagerOpen(event.currentTarget.open)}
    >
      <summary className={styles.managementSummary}>
        <div className={styles.managementSummaryCopy}>
          <span className={styles.eyebrow}>{t('provider.identity.marketplaceSetup')}</span>
          <strong>{complete ? t('provider.identity.profileReadySetup') : t('provider.identity.finishProfileBasics')}</strong>
          <small>{complete ? t('provider.identity.setupReadyDetail') : t('provider.identity.setupBody')}</small>
        </div>
        <div className={styles.managementSummaryMeta}>
          <Badge tone={complete ? 'success' : 'warning'}>{complete ? t('profile.ready') : t('profile.needsWork')}</Badge>
          <span className={styles.managementCaret} aria-hidden="true">⌄</span>
        </div>
      </summary>
      <div className={styles.managementBody}>
        <div className={styles.launchCompactBody}>
          <p>{t('provider.identity.setupBody')}</p>
          <Link href="/provider/setup" className={styles.setupLink}>{t('provider.identity.continueSetup')}</Link>
        </div>
      </div>
    </details>
  </section>;
}
