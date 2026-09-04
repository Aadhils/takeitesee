'use client';

import Link from 'next/link';
import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { Badge, Button, Card, Checkbox, EmptyState, Input, Textarea } from '../ui/primitives';
import { useIdentityWorkspaceTranslations } from '../i18n/IdentityWorkspaceTranslations';
import { ProviderDashboardSummary, ProviderHeading } from './ProviderPresentation';
import { LiveProviderShell } from './LiveProviderShell';

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

export default function ProviderProfileManager() {
  const { locale, t } = useIdentityWorkspaceTranslations();
  const [profile, setProfile] = useState<ProviderProfilePayload | null>(null);
  const [form, setForm] = useState({ display_name: '', description: '', location: '' });
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
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

  const roleCopy = useMemo(() => {
    const tamil = locale.toLowerCase().startsWith('ta');
    return tamil ? {
      eyebrow: 'Professional identity',
      title: 'என் talents / professional roles',
      intro: 'ஒரே verified profile-க்குள் உங்கள் பல skills மற்றும் earning roles-ஐ நிர்வகிக்கலாம். Service, freelance, part-time, full-time மற்றும் contract availability-ஐ ஒவ்வொரு role-க்கும் தனியாக அமைக்கலாம்.',
      oneProfile: 'One profile · many talents',
      add: 'Role சேர்க்கவும்',
      edit: 'Edit',
      delete: 'Delete',
      active: 'Active',
      paused: 'Paused',
      experience: 'Experience',
      years: 'years',
      noExperience: 'Experience குறிப்பிடவில்லை',
      noSummary: 'இந்த role-க்கு summary இன்னும் சேர்க்கப்படவில்லை.',
      service: 'Service bookings',
      freelance: 'Freelance',
      partTime: 'Part-time',
      fullTime: 'Full-time',
      contract: 'Contract',
      noneOpen: 'Opportunity modes off',
      emptyTitle: 'உங்கள் முதல் professional role-ஐ சேர்க்கவும்',
      emptyBody: 'Acting Driver, Electrician, Web Developer, Designer, Tuition Teacher போன்ற ஒவ்வொரு talent-ஐயும் இந்த ஒரே profile கீழ் தனி role ஆக வைத்துக்கொள்ளலாம்.',
      editorAdd: 'Professional role சேர்க்கவும்',
      editorEdit: 'Professional role edit செய்யவும்',
      roleTitle: 'Role / talent title',
      roleTitleHint: 'உதா: Web Developer, Acting Driver, Yoga Teacher',
      summary: 'Role summary',
      summaryHint: 'இந்த talent-ல் உங்கள் experience, speciality அல்லது வேலை செய்யும் விதத்தை சுருக்கமாக எழுதுங்கள்.',
      experienceYears: 'Experience years (optional)',
      opportunityHeading: 'Currently open to',
      opportunityHint: 'இந்த role மூலம் நீங்கள் பெற விரும்பும் earning / career opportunities-ஐ தேர்வு செய்யுங்கள்.',
      serviceHelp: 'End users இந்த role-க்கு service booking செய்யலாம்.',
      freelanceHelp: 'Freelance project opportunities-க்கு open.',
      partTimeHelp: 'Part-time job opportunities-க்கு open.',
      fullTimeHelp: 'Full-time job opportunities-க்கு open.',
      contractHelp: 'Contract / fixed-term opportunities-க்கு open.',
      activeLabel: 'இந்த role profile-ல் active ஆக இருக்கட்டும்',
      activeHelp: 'Off செய்தால் role owner dashboard-ல் இருக்கும்; public discovery-க்கு காட்டப்படாது.',
      save: 'Save role',
      update: 'Update role',
      cancel: 'Cancel',
      saved: 'Professional role saved.',
      deleted: 'Professional role deleted.',
      loadError: 'Professional roles load செய்ய முடியவில்லை.',
      saveError: 'Professional role save செய்ய முடியவில்லை.',
      deleteConfirm: 'இந்த professional role-ஐ delete செய்ய வேண்டுமா?',
      verifiedVisibility: 'Verified public visibility',
      verifiedHelp: 'Verified professional-ன் active roles மட்டும் public discovery-க்கு eligible. Subscription/search boost இந்த phase-ல் இல்லை.',
    } : {
      eyebrow: 'Professional identity',
      title: 'My talents / professional roles',
      intro: 'Manage multiple skills and earning roles under one verified profile. Set service, freelance, part-time, full-time and contract availability independently for each role.',
      oneProfile: 'One profile · many talents',
      add: 'Add role',
      edit: 'Edit',
      delete: 'Delete',
      active: 'Active',
      paused: 'Paused',
      experience: 'Experience',
      years: 'years',
      noExperience: 'Experience not specified',
      noSummary: 'No summary has been added for this role yet.',
      service: 'Service bookings',
      freelance: 'Freelance',
      partTime: 'Part-time',
      fullTime: 'Full-time',
      contract: 'Contract',
      noneOpen: 'Opportunity modes off',
      emptyTitle: 'Add your first professional role',
      emptyBody: 'Keep talents such as Acting Driver, Electrician, Web Developer, Designer or Tuition Teacher as separate roles under this one professional identity.',
      editorAdd: 'Add professional role',
      editorEdit: 'Edit professional role',
      roleTitle: 'Role / talent title',
      roleTitleHint: 'Example: Web Developer, Acting Driver, Yoga Teacher',
      summary: 'Role summary',
      summaryHint: 'Briefly describe your experience, speciality or the kind of work you do in this talent.',
      experienceYears: 'Experience years (optional)',
      opportunityHeading: 'Currently open to',
      opportunityHint: 'Choose the earning or career opportunities you want to receive through this role.',
      serviceHelp: 'End users can discover this role for service-booking opportunities.',
      freelanceHelp: 'Open to freelance project opportunities.',
      partTimeHelp: 'Open to part-time job opportunities.',
      fullTimeHelp: 'Open to full-time job opportunities.',
      contractHelp: 'Open to contract or fixed-term opportunities.',
      activeLabel: 'Keep this role active on my profile',
      activeHelp: 'When off, the role remains in your dashboard but is not eligible for public discovery.',
      save: 'Save role',
      update: 'Update role',
      cancel: 'Cancel',
      saved: 'Professional role saved.',
      deleted: 'Professional role deleted.',
      loadError: 'Unable to load professional roles.',
      saveError: 'Unable to save professional role.',
      deleteConfirm: 'Delete this professional role?',
      verifiedVisibility: 'Verified public visibility',
      verifiedHelp: 'Only active roles of a verified professional are eligible for public discovery. Subscription and search boosts are not part of this phase.',
    };
  }, [locale]);

  const loadRoles = useCallback(async () => {
    try {
      setRolesLoading(true);
      setRoleError('');
      const response = await fetch('/api/provider/profile/roles', { cache: 'no-store' });
      const payload = await response.json() as { roles?: ProfessionalRole[]; error?: string };
      if (!response.ok) throw new Error(payload.error ?? roleCopy.loadError);
      setRoles(payload.roles ?? []);
    } catch (cause) {
      setRoleError(cause instanceof Error ? cause.message : roleCopy.loadError);
    } finally {
      setRolesLoading(false);
    }
  }, [roleCopy.loadError]);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const response = await fetch('/api/provider/profile', { cache: 'no-store' });
      const payload = await response.json() as { profile?: ProviderProfilePayload; error?: string };
      if (!response.ok || !payload.profile) throw new Error(payload.error ?? t('profile.loadFallback'));
      setProfile(payload.profile);
      setForm({ display_name: payload.profile.display_name, description: payload.profile.description, location: payload.profile.location });
      if (payload.profile.provider_type === 'professional') void loadRoles();
      else setRoles([]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t('profile.loadFallback'));
    } finally {
      setLoading(false);
    }
  }, [loadRoles, t]);

  useEffect(() => { void load(); }, [load]);

  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const response = await fetch('/api/provider/profile', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      const body = await response.json() as { error?: string };
      if (!response.ok) throw new Error(body.error ?? t('profile.saveFallback'));
      setNotice(t('profile.saved'));
      setEditing(false);
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t('profile.saveFallback'));
    } finally {
      setSaving(false);
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
      if (!response.ok) throw new Error(body.error ?? roleCopy.saveError);
      setRoleNotice(roleCopy.saved);
      resetRoleEditor();
      await loadRoles();
    } catch (cause) {
      setRoleError(cause instanceof Error ? cause.message : roleCopy.saveError);
    } finally {
      setRoleSaving(false);
    }
  };

  const deleteRole = async (role: ProfessionalRole) => {
    if (!window.confirm(roleCopy.deleteConfirm)) return;
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
      if (!response.ok) throw new Error(body.error ?? roleCopy.saveError);
      setRoleNotice(roleCopy.deleted);
      if (editingRoleId === role.id) resetRoleEditor();
      await loadRoles();
    } catch (cause) {
      setRoleError(cause instanceof Error ? cause.message : roleCopy.saveError);
    } finally {
      setRoleSaving(false);
    }
  };

  const complete = Boolean(profile && profile.display_name.trim().length >= 2 && profile.description.trim().length >= 20 && profile.location.trim().length >= 2);

  return <LiveProviderShell active="/provider/profile">
    <ProviderHeading eyebrow={t('profile.eyebrow')} title={profile?.display_name ?? t('profile.titleFallback')} description={t('profile.description')} action={profile && !editing ? <Button type="button" onClick={() => setEditing(true)}>{t('profile.edit')}</Button> : undefined} />
    {error ? <Card><p className="field-error" role="alert">{error}</p></Card> : null}
    {notice ? <Card><p>{notice}</p></Card> : null}
    {loading ? <Card><p>{t('profile.loading')}</p></Card> : null}

    {profile ? <>
      <div className="provider-review-summary">
        <ProviderDashboardSummary label={t('profile.type')} value={profile.provider_type === 'business' ? t('profile.business') : t('profile.professional')} detail={t('profile.liveRole')} tone="info" />
        <ProviderDashboardSummary label={t('profile.readiness')} value={complete ? t('profile.complete') : t('profile.needsWork')} detail={t('profile.readinessDetail')} tone={complete ? 'success' : 'warning'} />
        <ProviderDashboardSummary label={t('profile.verification')} value={profile.verified ? t('profile.verified') : t('profile.pending')} detail={profile.verified ? t('profile.verificationConfirmed') : t('profile.verificationIncomplete')} tone={profile.verified ? 'success' : 'warning'} />
      </div>

      {editing ? <Card className="provider-profile-card"><form onSubmit={save} className="section-stack">
        <div className="section-heading"><div><span className="eyebrow">{t('profile.editor')}</span><h2>{t('profile.publicDetails')}</h2></div><Badge tone={complete ? 'success' : 'warning'}>{complete ? t('profile.launchReady') : t('profile.completeRequired')}</Badge></div>
        <Input label={profile.provider_type === 'business' ? t('profile.businessDisplayName') : t('profile.professionalHeadline')} value={form.display_name} onChange={(event) => setForm((current) => ({ ...current, display_name: event.target.value }))} required maxLength={120} />
        <Textarea label={t('profile.providerDescription')} hint={t('profile.descriptionHint')} value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} maxLength={1200} rows={5} />
        <Input label={t('profile.serviceArea')} value={form.location} onChange={(event) => setForm((current) => ({ ...current, location: event.target.value }))} required maxLength={160} />
        <div className="button-row"><Button type="submit" loading={saving}>{t('profile.save')}</Button><Button type="button" variant="secondary" onClick={() => { setEditing(false); setForm({ display_name: profile.display_name, description: profile.description, location: profile.location }); }}>{t('profile.cancel')}</Button></div>
        <p className="summary-note">{t('profile.incompleteWarning')}</p>
      </form></Card> : null}

      {!editing ? <div className="provider-profile-grid">
        <Card className="provider-profile-card"><div className="provider-profile-identity"><div className="provider-avatar provider-avatar-large" aria-hidden="true">{profile.display_name.slice(0, 2).toUpperCase()}</div><div><h2>{profile.display_name}</h2><p>{profile.provider_type === 'business' ? t('profile.businessProvider') : t('profile.professionalProvider')}</p></div></div><Badge tone={profile.verified ? 'success' : 'warning'}>{profile.verified ? t('profile.verified') : t('profile.verificationPending')}</Badge><p>{profile.description || t('profile.noDescription')}</p></Card>
        <Card className="provider-profile-card"><span className="eyebrow">{t('profile.coverage')}</span><h2>{t('profile.details')}</h2><dl className="provider-profile-details"><div><dt>{t('profile.serviceArea')}</dt><dd>{profile.location || t('profile.notSpecified')}</dd></div><div><dt>{t('profile.catalog')}</dt><dd>{profile.services_active} {t('profile.active')} · {profile.services_total} {t('profile.total')}</dd></div><div><dt>{t('profile.memberSince')}</dt><dd>{new Date(profile.created_at).toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' })}</dd></div><div><dt>{t('profile.lastUpdated')}</dt><dd>{new Date(profile.updated_at).toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' })}</dd></div></dl></Card>
      </div> : null}

      {profile.provider_type === 'professional' ? <Card className="provider-profile-card">
        <div className="section-heading">
          <div><span className="eyebrow">{roleCopy.eyebrow}</span><h2>{roleCopy.title}</h2></div>
          <div className="button-row"><Badge tone="info">{roleCopy.oneProfile}</Badge>{!roleEditorOpen ? <Button type="button" onClick={startNewRole}>{roleCopy.add}</Button> : null}</div>
        </div>
        <p>{roleCopy.intro}</p>
        <p className="summary-note"><strong>{roleCopy.verifiedVisibility}:</strong> {roleCopy.verifiedHelp}</p>
        {roleError ? <p className="field-error" role="alert">{roleError}</p> : null}
        {roleNotice ? <p role="status">{roleNotice}</p> : null}
        {rolesLoading ? <p>{roleCopy.loadError.replace('Unable to load professional roles.', 'Loading professional roles…').replace('Professional roles load செய்ய முடியவில்லை.', 'Professional roles load ஆகிறது…')}</p> : null}

        {!rolesLoading && roles.length === 0 ? <EmptyState title={roleCopy.emptyTitle} action={!roleEditorOpen ? <Button type="button" onClick={startNewRole}>{roleCopy.add}</Button> : undefined}>{roleCopy.emptyBody}</EmptyState> : null}

        {roles.length > 0 ? <div className="section-stack">
          {roles.map((role) => {
            const opportunityLabels = [
              role.service_bookings_enabled ? roleCopy.service : null,
              role.freelance_enabled ? roleCopy.freelance : null,
              role.part_time_enabled ? roleCopy.partTime : null,
              role.full_time_enabled ? roleCopy.fullTime : null,
              role.contract_enabled ? roleCopy.contract : null,
            ].filter((value): value is string => Boolean(value));
            return <Card key={role.id} className="provider-profile-card">
              <div className="section-heading">
                <div><h3>{role.title}</h3><p>{role.experience_years === null ? roleCopy.noExperience : `${roleCopy.experience}: ${role.experience_years} ${roleCopy.years}`}</p></div>
                <Badge tone={role.active ? 'success' : 'neutral'}>{role.active ? roleCopy.active : roleCopy.paused}</Badge>
              </div>
              <p>{role.summary || roleCopy.noSummary}</p>
              <div className="button-row">{opportunityLabels.length ? opportunityLabels.map((label) => <Badge key={label} tone="info">{label}</Badge>) : <Badge>{roleCopy.noneOpen}</Badge>}</div>
              <div className="button-row"><Button type="button" variant="secondary" onClick={() => startEditRole(role)} disabled={roleSaving}>{roleCopy.edit}</Button><Button type="button" variant="danger" onClick={() => void deleteRole(role)} disabled={roleSaving}>{roleCopy.delete}</Button></div>
            </Card>;
          })}
        </div> : null}

        {roleEditorOpen ? <form onSubmit={saveRole} className="section-stack">
          <div className="section-heading"><div><span className="eyebrow">{roleCopy.eyebrow}</span><h3>{editingRoleId ? roleCopy.editorEdit : roleCopy.editorAdd}</h3></div></div>
          <Input label={roleCopy.roleTitle} hint={roleCopy.roleTitleHint} value={roleForm.title} onChange={(event) => setRoleForm((current) => ({ ...current, title: event.target.value }))} required minLength={2} maxLength={120} />
          <Textarea label={roleCopy.summary} hint={roleCopy.summaryHint} value={roleForm.summary} onChange={(event) => setRoleForm((current) => ({ ...current, summary: event.target.value }))} maxLength={1200} rows={4} />
          <Input label={roleCopy.experienceYears} type="number" min={0} max={80} step={1} value={roleForm.experience_years} onChange={(event) => setRoleForm((current) => ({ ...current, experience_years: event.target.value }))} />
          <div className="section-stack"><div><strong>{roleCopy.opportunityHeading}</strong><p className="summary-note">{roleCopy.opportunityHint}</p></div>
            <Checkbox label={roleCopy.service} description={roleCopy.serviceHelp} checked={roleForm.service_bookings_enabled} onChange={(event) => setRoleForm((current) => ({ ...current, service_bookings_enabled: event.target.checked }))} />
            <Checkbox label={roleCopy.freelance} description={roleCopy.freelanceHelp} checked={roleForm.freelance_enabled} onChange={(event) => setRoleForm((current) => ({ ...current, freelance_enabled: event.target.checked }))} />
            <Checkbox label={roleCopy.partTime} description={roleCopy.partTimeHelp} checked={roleForm.part_time_enabled} onChange={(event) => setRoleForm((current) => ({ ...current, part_time_enabled: event.target.checked }))} />
            <Checkbox label={roleCopy.fullTime} description={roleCopy.fullTimeHelp} checked={roleForm.full_time_enabled} onChange={(event) => setRoleForm((current) => ({ ...current, full_time_enabled: event.target.checked }))} />
            <Checkbox label={roleCopy.contract} description={roleCopy.contractHelp} checked={roleForm.contract_enabled} onChange={(event) => setRoleForm((current) => ({ ...current, contract_enabled: event.target.checked }))} />
            <Checkbox label={roleCopy.activeLabel} description={roleCopy.activeHelp} checked={roleForm.active} onChange={(event) => setRoleForm((current) => ({ ...current, active: event.target.checked }))} />
          </div>
          <div className="button-row"><Button type="submit" loading={roleSaving}>{editingRoleId ? roleCopy.update : roleCopy.save}</Button><Button type="button" variant="secondary" onClick={resetRoleEditor} disabled={roleSaving}>{roleCopy.cancel}</Button></div>
        </form> : null}
      </Card> : null}

      <Card className="provider-profile-card"><div className="section-heading"><div><span className="eyebrow">{t('profile.launchConnection')}</span><h2>{t('profile.setupStatus')}</h2></div><Badge tone={complete ? 'success' : 'warning'}>{complete ? t('profile.ready') : t('profile.actionRequired')}</Badge></div><p>{t('profile.launchGateHelp')}</p><Link href="/provider/setup" className="text-link">{t('profile.openSetup')}</Link></Card>
    </> : null}
  </LiveProviderShell>;
}
