'use client';

import Link from 'next/link';
import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { Badge, Button, Card, Checkbox, EmptyState, Input, Textarea } from '../ui/primitives';
import { useIdentityWorkspaceTranslations } from '../i18n/IdentityWorkspaceTranslations';
import { LiveProviderShell } from './LiveProviderShell';
import styles from './ProviderProfileSetupCenter.module.css';

type ProviderProfilePayload = {
  provider_type: 'professional' | 'business';
  id: string;
  display_name: string;
  description: string;
  location: string;
  verified: boolean;
  services_total: number;
  services_active: number;
  created_at: string;
  updated_at: string;
};

type ProfessionalRole = {
  id: string;
  professional_id: string;
  title: string;
  summary: string | null;
  experience_years: number | null;
  service_bookings_enabled: boolean;
  freelance_enabled: boolean;
  part_time_enabled: boolean;
  full_time_enabled: boolean;
  contract_enabled: boolean;
  active: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
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

export default function ProviderProfileSetupCenter() {
  const { locale } = useIdentityWorkspaceTranslations();
  const [profile, setProfile] = useState<ProviderProfilePayload | null>(null);
  const [form, setForm] = useState({ display_name: '', description: '', location: '' });
  const [editingProfile, setEditingProfile] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const [roles, setRoles] = useState<ProfessionalRole[]>([]);
  const [rolesLoading, setRolesLoading] = useState(false);
  const [roleSaving, setRoleSaving] = useState(false);
  const [roleEditorOpen, setRoleEditorOpen] = useState(false);
  const [editingRoleId, setEditingRoleId] = useState<string | null>(null);
  const [roleForm, setRoleForm] = useState<RoleForm>(emptyRoleForm);
  const [roleError, setRoleError] = useState('');
  const [roleNotice, setRoleNotice] = useState('');

  const copy = useMemo(() => {
    const tamil = locale.toLowerCase().startsWith('ta');
    return tamil ? {
      eyebrow: 'Provider profile',
      title: 'Profile setup center',
      subtitle: 'Public profile, talents மற்றும் marketplace launch setup-ஐ ஒரே இடத்தில் எளிதாக நிர்வகிக்கலாம்.',
      professional: 'Professional',
      business: 'Business',
      verified: 'Verified',
      verificationPending: 'Verification pending',
      profileReady: 'Profile ready',
      needsProfile: 'Profile needs details',
      profileStep: 'Profile',
      rolesStep: 'Roles',
      launchStep: 'Launch',
      done: 'Done',
      rolesReady: 'Ready',
      addRole: 'Add role',
      editProfile: 'Edit profile',
      serviceArea: 'Service area',
      services: 'Services',
      active: 'active',
      profileEditorTitle: 'Public profile update',
      profileEditorHelp: '3 விபரங்கள் மட்டும்: name, short description, service area. சுருக்கமாக எழுதினால் போதும்.',
      displayName: 'Professional headline / display name',
      businessName: 'Business display name',
      description: 'Provider description',
      descriptionHint: '20+ characters. End user உங்களை ஏன் choose செய்ய வேண்டும் என்பதை சுருக்கமாக சொல்லுங்கள்.',
      saveProfile: 'Save profile',
      cancel: 'Cancel',
      savedProfile: 'Profile saved.',
      profileSaveError: 'Profile save செய்ய முடியவில்லை.',
      loading: 'Profile load ஆகிறது…',
      loadError: 'Profile load செய்ய முடியவில்லை.',
      noDescription: 'Short description சேர்த்தால் end user profile-ஐ விரைவாக புரிந்து கொள்வார்.',
      rolesEyebrow: 'Professional talents',
      rolesTitle: 'Talents & roles',
      rolesIntro: 'ஒவ்வொரு skill-க்கும் ஒரு compact role card. Add role செய்த பிறகு தேவையான opportunity options மட்டும் தேர்வு செய்யலாம்.',
      swipeRoles: 'மேலும் roles பார்க்க side-ஆ swipe செய்யலாம்',
      noRolesTitle: 'உங்கள் முதல் role-ஐ சேர்க்கவும்',
      noRolesBody: 'Web Developer, Driver, Designer போன்ற ஒவ்வொரு talent-ஐ தனி role ஆக வைத்துக்கொள்ளலாம்.',
      addRoleTitle: 'Quick role setup',
      editRoleTitle: 'Role edit',
      addRoleHelp: 'முதலில் role name + short summary மட்டும். மற்ற opportunity settings optional.',
      roleTitle: 'Role / talent title',
      roleTitleHint: 'உதா: Web Developer, Acting Driver, Web Designer',
      roleSummary: 'Short role summary',
      roleSummaryHint: 'இந்த skill-ல் நீங்கள் என்ன செய்கிறீர்கள் என்பதை ஒரு அல்லது இரண்டு வரியில் எழுதுங்கள்.',
      experience: 'Experience years (optional)',
      serviceBookings: 'Service bookings',
      serviceBookingsHelp: 'Customers இந்த role-ஐ service booking-க்கு காணலாம்.',
      moreOptions: 'More opportunity options',
      freelance: 'Freelance',
      partTime: 'Part-time',
      fullTime: 'Full-time',
      contract: 'Contract',
      activeRole: 'Keep this role active',
      saveRole: 'Save role',
      updateRole: 'Update role',
      roleSaved: 'Role saved.',
      roleDeleted: 'Role deleted.',
      roleSaveError: 'Role save செய்ய முடியவில்லை.',
      duplicate: 'இந்த role ஏற்கனவே உள்ளது. Existing role-ல் Edit பயன்படுத்துங்கள்.',
      delete: 'Delete',
      edit: 'Edit',
      deleteConfirm: 'இந்த role-ஐ delete செய்ய வேண்டுமா?',
      noExperience: 'Experience not specified',
      noSummary: 'Short summary இன்னும் சேர்க்கப்படவில்லை.',
      opportunityNone: 'No opportunity modes selected',
      nextTitleReady: 'Profile ready. இப்போது marketplace setup-ஐ connect செய்யுங்கள்.',
      nextTitlePending: 'முதலில் profile basics complete செய்யுங்கள்.',
      nextBody: 'Category, location approval, availability மற்றும் service launch இந்த next setup flow-ல் இருக்கும்.',
      continueSetup: 'Continue provider setup',
    } : {
      eyebrow: 'Provider profile',
      title: 'Profile setup center',
      subtitle: 'Manage your public profile, talents and marketplace launch setup in one simple place.',
      professional: 'Professional',
      business: 'Business',
      verified: 'Verified',
      verificationPending: 'Verification pending',
      profileReady: 'Profile ready',
      needsProfile: 'Profile needs details',
      profileStep: 'Profile',
      rolesStep: 'Roles',
      launchStep: 'Launch',
      done: 'Done',
      rolesReady: 'Ready',
      addRole: 'Add role',
      editProfile: 'Edit profile',
      serviceArea: 'Service area',
      services: 'Services',
      active: 'active',
      profileEditorTitle: 'Update public profile',
      profileEditorHelp: 'Only 3 essentials: name, short description and service area. Keep it simple and clear.',
      displayName: 'Professional headline / display name',
      businessName: 'Business display name',
      description: 'Provider description',
      descriptionHint: 'Use 20+ characters. Briefly explain what you do and why a customer should choose you.',
      saveProfile: 'Save profile',
      cancel: 'Cancel',
      savedProfile: 'Profile saved.',
      profileSaveError: 'Unable to save profile.',
      loading: 'Loading profile…',
      loadError: 'Unable to load profile.',
      noDescription: 'Add a short description so customers can understand your profile quickly.',
      rolesEyebrow: 'Professional talents',
      rolesTitle: 'Talents & roles',
      rolesIntro: 'Keep one compact card per skill. Add a role first, then choose only the opportunity types you want.',
      swipeRoles: 'Swipe sideways to view more roles',
      noRolesTitle: 'Add your first role',
      noRolesBody: 'Keep each talent such as Web Developer, Driver or Designer as a separate role.',
      addRoleTitle: 'Quick role setup',
      editRoleTitle: 'Edit role',
      addRoleHelp: 'Start with a role name and short summary. Extra opportunity settings are optional.',
      roleTitle: 'Role / talent title',
      roleTitleHint: 'Example: Web Developer, Acting Driver, Web Designer',
      roleSummary: 'Short role summary',
      roleSummaryHint: 'Describe what you do in this skill in one or two lines.',
      experience: 'Experience years (optional)',
      serviceBookings: 'Service bookings',
      serviceBookingsHelp: 'Customers can discover this role for service bookings.',
      moreOptions: 'More opportunity options',
      freelance: 'Freelance',
      partTime: 'Part-time',
      fullTime: 'Full-time',
      contract: 'Contract',
      activeRole: 'Keep this role active',
      saveRole: 'Save role',
      updateRole: 'Update role',
      roleSaved: 'Role saved.',
      roleDeleted: 'Role deleted.',
      roleSaveError: 'Unable to save role.',
      duplicate: 'This role already exists. Use Edit on the existing role instead.',
      delete: 'Delete',
      edit: 'Edit',
      deleteConfirm: 'Delete this role?',
      noExperience: 'Experience not specified',
      noSummary: 'No short summary has been added yet.',
      opportunityNone: 'No opportunity modes selected',
      nextTitleReady: 'Profile ready. Now connect it to the marketplace.',
      nextTitlePending: 'Complete your profile basics first.',
      nextBody: 'Category, location approval, availability and service launch continue in Provider Setup.',
      continueSetup: 'Continue provider setup',
    };
  }, [locale]);

  const loadRoles = useCallback(async () => {
    try {
      setRolesLoading(true);
      setRoleError('');
      const response = await fetch('/api/provider/profile/roles', { cache: 'no-store' });
      const payload = await response.json() as { roles?: ProfessionalRole[]; error?: string };
      if (!response.ok) throw new Error(payload.error ?? copy.loadError);
      setRoles(payload.roles ?? []);
    } catch (cause) {
      setRoleError(cause instanceof Error ? cause.message : copy.loadError);
    } finally {
      setRolesLoading(false);
    }
  }, [copy.loadError]);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const response = await fetch('/api/provider/profile', { cache: 'no-store' });
      const payload = await response.json() as { profile?: ProviderProfilePayload; error?: string };
      if (!response.ok || !payload.profile) throw new Error(payload.error ?? copy.loadError);
      setProfile(payload.profile);
      setForm({
        display_name: payload.profile.display_name,
        description: payload.profile.description,
        location: payload.profile.location,
      });
      if (payload.profile.provider_type === 'professional') void loadRoles();
      else setRoles([]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : copy.loadError);
    } finally {
      setLoading(false);
    }
  }, [copy.loadError, loadRoles]);

  useEffect(() => { void load(); }, [load]);

  const saveProfile = async (event: FormEvent) => {
    event.preventDefault();
    if (savingProfile) return;
    setSavingProfile(true);
    setError('');
    setNotice('');
    try {
      const response = await fetch('/api/provider/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const body = await response.json() as { error?: string };
      if (!response.ok) throw new Error(body.error ?? copy.profileSaveError);
      setNotice(copy.savedProfile);
      setEditingProfile(false);
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : copy.profileSaveError);
    } finally {
      setSavingProfile(false);
    }
  };

  const resetRoleEditor = () => {
    setRoleEditorOpen(false);
    setEditingRoleId(null);
    setRoleForm(emptyRoleForm);
    setRoleError('');
  };

  const startNewRole = () => {
    setRoleNotice('');
    setRoleError('');
    setEditingRoleId(null);
    setRoleForm(emptyRoleForm);
    setRoleEditorOpen(true);
  };

  const startEditRole = (role: ProfessionalRole) => {
    setRoleNotice('');
    setRoleError('');
    setEditingRoleId(role.id);
    setRoleForm({
      title: role.title,
      summary: role.summary ?? '',
      experience_years: role.experience_years === null ? '' : String(role.experience_years),
      service_bookings_enabled: role.service_bookings_enabled,
      freelance_enabled: role.freelance_enabled,
      part_time_enabled: role.part_time_enabled,
      full_time_enabled: role.full_time_enabled,
      contract_enabled: role.contract_enabled,
      active: role.active,
    });
    setRoleEditorOpen(true);
  };

  const saveRole = async (event: FormEvent) => {
    event.preventDefault();
    if (roleSaving) return;
    const normalizedTitle = roleForm.title.trim().toLocaleLowerCase();
    const duplicateRole = roles.find((role) => role.id !== editingRoleId && role.title.trim().toLocaleLowerCase() === normalizedTitle);
    if (duplicateRole) {
      setRoleError(copy.duplicate);
      setRoleNotice('');
      return;
    }

    setRoleSaving(true);
    setRoleError('');
    setRoleNotice('');
    try {
      const response = await fetch('/api/provider/profile/roles', {
        method: editingRoleId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: editingRoleId ?? undefined, ...roleForm }),
      });
      const body = await response.json() as { error?: string };
      if (!response.ok) throw new Error(body.error ?? copy.roleSaveError);
      setRoleNotice(copy.roleSaved);
      resetRoleEditor();
      await loadRoles();
    } catch (cause) {
      setRoleError(cause instanceof Error ? cause.message : copy.roleSaveError);
    } finally {
      setRoleSaving(false);
    }
  };

  const deleteRole = async (role: ProfessionalRole) => {
    if (!window.confirm(copy.deleteConfirm)) return;
    setRoleSaving(true);
    setRoleError('');
    setRoleNotice('');
    try {
      const response = await fetch('/api/provider/profile/roles', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: role.id }),
      });
      const body = await response.json() as { error?: string };
      if (!response.ok) throw new Error(body.error ?? copy.roleSaveError);
      setRoleNotice(copy.roleDeleted);
      if (editingRoleId === role.id) resetRoleEditor();
      await loadRoles();
    } catch (cause) {
      setRoleError(cause instanceof Error ? cause.message : copy.roleSaveError);
    } finally {
      setRoleSaving(false);
    }
  };

  const complete = Boolean(profile
    && profile.display_name.trim().length >= 2
    && profile.description.trim().length >= 20
    && profile.location.trim().length >= 2);
  const rolesReady = profile?.provider_type !== 'professional' || roles.length > 0;

  return <LiveProviderShell active="/provider/profile">
    <div className={styles.center}>
      {error ? <Card className={styles.alertCard}><p className="field-error" role="alert">{error}</p></Card> : null}
      {notice ? <Card className={styles.alertCard}><p role="status">{notice}</p></Card> : null}
      {loading ? <Card className={styles.alertCard}><p>{copy.loading}</p></Card> : null}

      {profile ? <>
        <Card className={styles.hero}>
          <div className={styles.heroTop}>
            <div className={styles.identity}>
              <div className={styles.avatar} aria-hidden="true">{profile.display_name.slice(0, 2).toUpperCase()}</div>
              <div className={styles.identityText}>
                <span className={styles.eyebrow}>{copy.eyebrow}</span>
                <h1>{copy.title}</h1>
                <p>{copy.subtitle}</p>
              </div>
            </div>
            <div className={styles.badges}>
              <Badge tone="info">{profile.provider_type === 'business' ? copy.business : copy.professional}</Badge>
              <Badge tone={profile.verified ? 'success' : 'warning'}>{profile.verified ? copy.verified : copy.verificationPending}</Badge>
              <Badge tone={complete ? 'success' : 'warning'}>{complete ? copy.profileReady : copy.needsProfile}</Badge>
            </div>
          </div>

          <div className={styles.profilePreview}>
            <div>
              <strong>{profile.display_name}</strong>
              <p>{profile.description || copy.noDescription}</p>
            </div>
            <div className={styles.quickFacts}>
              <span><small>{copy.serviceArea}</small><strong>{profile.location || '—'}</strong></span>
              <span><small>{copy.services}</small><strong>{profile.services_active} {copy.active} · {profile.services_total}</strong></span>
            </div>
          </div>

          <div className={styles.steps} aria-label="Provider profile progress">
            <div className={`${styles.step} ${complete ? styles.stepDone : ''}`}><span>1</span><div><strong>{copy.profileStep}</strong><small>{complete ? copy.done : copy.needsProfile}</small></div></div>
            <div className={`${styles.step} ${rolesReady ? styles.stepDone : ''}`}><span>2</span><div><strong>{profile.provider_type === 'professional' ? copy.rolesStep : copy.verified}</strong><small>{profile.provider_type === 'professional' ? `${roles.length} · ${rolesReady ? copy.rolesReady : copy.addRole}` : (profile.verified ? copy.done : copy.verificationPending)}</small></div></div>
            <div className={styles.step}><span>3</span><div><strong>{copy.launchStep}</strong><small>{copy.continueSetup}</small></div></div>
          </div>

          <div className={styles.heroActions}>
            <Button type="button" onClick={() => setEditingProfile((value) => !value)}>{copy.editProfile}</Button>
            {profile.provider_type === 'professional' && !roleEditorOpen ? <Button type="button" variant="secondary" onClick={startNewRole}>{copy.addRole}</Button> : null}
          </div>
        </Card>

        {editingProfile ? <Card className={styles.editorCard}>
          <div className={styles.sectionHead}><div><span className={styles.eyebrow}>{copy.profileStep}</span><h2>{copy.profileEditorTitle}</h2><p>{copy.profileEditorHelp}</p></div></div>
          <form onSubmit={saveProfile} className={styles.formStack}>
            <Input label={profile.provider_type === 'business' ? copy.businessName : copy.displayName} value={form.display_name} onChange={(event) => setForm((current) => ({ ...current, display_name: event.target.value }))} required maxLength={120} />
            <Textarea label={copy.description} hint={copy.descriptionHint} value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} maxLength={1200} rows={4} />
            <Input label={copy.serviceArea} value={form.location} onChange={(event) => setForm((current) => ({ ...current, location: event.target.value }))} required maxLength={160} />
            <div className={styles.formActions}><Button type="submit" loading={savingProfile}>{copy.saveProfile}</Button><Button type="button" variant="secondary" onClick={() => { setEditingProfile(false); setForm({ display_name: profile.display_name, description: profile.description, location: profile.location }); }}>{copy.cancel}</Button></div>
          </form>
        </Card> : null}

        {profile.provider_type === 'professional' ? <Card className={styles.rolesSection}>
          <div className={styles.sectionHead}>
            <div><span className={styles.eyebrow}>{copy.rolesEyebrow}</span><h2>{copy.rolesTitle}</h2><p>{copy.rolesIntro}</p></div>
            {!roleEditorOpen ? <Button type="button" onClick={startNewRole}>{copy.addRole}</Button> : null}
          </div>

          {roleNotice ? <p className={styles.notice} role="status">{roleNotice}</p> : null}
          {roleError && !roleEditorOpen ? <p className="field-error" role="alert">{roleError}</p> : null}
          {rolesLoading ? <p>{copy.loading}</p> : null}

          {roleEditorOpen ? <form onSubmit={saveRole} className={styles.roleEditor}>
            <div className={styles.roleEditorHead}><div><span className={styles.eyebrow}>{copy.rolesStep}</span><h3>{editingRoleId ? copy.editRoleTitle : copy.addRoleTitle}</h3><p>{copy.addRoleHelp}</p></div></div>
            <div className={styles.twoColumns}>
              <Input label={copy.roleTitle} hint={copy.roleTitleHint} value={roleForm.title} onChange={(event) => { setRoleError(''); setRoleForm((current) => ({ ...current, title: event.target.value })); }} required minLength={2} maxLength={120} />
              <Input label={copy.experience} type="number" min={0} max={80} step={1} value={roleForm.experience_years} onChange={(event) => setRoleForm((current) => ({ ...current, experience_years: event.target.value }))} />
            </div>
            <Textarea label={copy.roleSummary} hint={copy.roleSummaryHint} value={roleForm.summary} onChange={(event) => setRoleForm((current) => ({ ...current, summary: event.target.value }))} maxLength={1200} rows={3} />
            <Checkbox label={copy.serviceBookings} description={copy.serviceBookingsHelp} checked={roleForm.service_bookings_enabled} onChange={(event) => setRoleForm((current) => ({ ...current, service_bookings_enabled: event.target.checked }))} />
            <details className={styles.moreOptions}>
              <summary>{copy.moreOptions}</summary>
              <div className={styles.optionGrid}>
                <Checkbox label={copy.freelance} checked={roleForm.freelance_enabled} onChange={(event) => setRoleForm((current) => ({ ...current, freelance_enabled: event.target.checked }))} />
                <Checkbox label={copy.partTime} checked={roleForm.part_time_enabled} onChange={(event) => setRoleForm((current) => ({ ...current, part_time_enabled: event.target.checked }))} />
                <Checkbox label={copy.fullTime} checked={roleForm.full_time_enabled} onChange={(event) => setRoleForm((current) => ({ ...current, full_time_enabled: event.target.checked }))} />
                <Checkbox label={copy.contract} checked={roleForm.contract_enabled} onChange={(event) => setRoleForm((current) => ({ ...current, contract_enabled: event.target.checked }))} />
                <Checkbox label={copy.activeRole} checked={roleForm.active} onChange={(event) => setRoleForm((current) => ({ ...current, active: event.target.checked }))} />
              </div>
            </details>
            {roleError ? <p className="field-error" role="alert" aria-live="assertive">{roleError}</p> : null}
            <div className={styles.formActions}><Button type="submit" loading={roleSaving}>{editingRoleId ? copy.updateRole : copy.saveRole}</Button><Button type="button" variant="secondary" onClick={resetRoleEditor} disabled={roleSaving}>{copy.cancel}</Button></div>
          </form> : null}

          {!rolesLoading && roles.length === 0 ? <EmptyState title={copy.noRolesTitle} action={!roleEditorOpen ? <Button type="button" onClick={startNewRole}>{copy.addRole}</Button> : undefined}>{copy.noRolesBody}</EmptyState> : null}

          {roles.length > 0 ? <>
            <p className={styles.swipeHint}>{copy.swipeRoles}</p>
            <div className={styles.roleGrid}>
              {roles.map((role) => {
                const opportunityLabels = [
                  role.service_bookings_enabled ? copy.serviceBookings : null,
                  role.freelance_enabled ? copy.freelance : null,
                  role.part_time_enabled ? copy.partTime : null,
                  role.full_time_enabled ? copy.fullTime : null,
                  role.contract_enabled ? copy.contract : null,
                ].filter((value): value is string => Boolean(value));
                return <Card key={role.id} className={styles.roleCard}>
                  <div className={styles.roleCardHead}><div><h3>{role.title}</h3><small>{role.experience_years === null ? copy.noExperience : `${role.experience_years} years experience`}</small></div><Badge tone={role.active ? 'success' : 'neutral'}>{role.active ? copy.active : 'Paused'}</Badge></div>
                  <p className={styles.roleSummary}>{role.summary || copy.noSummary}</p>
                  <div className={styles.chips}>{opportunityLabels.length ? opportunityLabels.map((label) => <Badge key={label} tone="info">{label}</Badge>) : <Badge>{copy.opportunityNone}</Badge>}</div>
                  <div className={styles.roleActions}><Button type="button" variant="secondary" onClick={() => startEditRole(role)} disabled={roleSaving}>{copy.edit}</Button><Button type="button" variant="danger" onClick={() => void deleteRole(role)} disabled={roleSaving}>{copy.delete}</Button></div>
                </Card>;
              })}
            </div>
          </> : null}
        </Card> : null}

        <Card className={styles.nextCard}>
          <div><span className={styles.eyebrow}>{copy.launchStep}</span><h2>{complete ? copy.nextTitleReady : copy.nextTitlePending}</h2><p>{copy.nextBody}</p></div>
          <Link href="/provider/setup" className={styles.setupLink}>{copy.continueSetup}</Link>
        </Card>
      </> : null}
    </div>
  </LiveProviderShell>;
}
