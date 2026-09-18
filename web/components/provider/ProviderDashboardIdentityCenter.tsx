'use client';

import Link from 'next/link';
import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
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
  const { locale } = useIdentityWorkspaceTranslations();
  const tamil = locale.toLowerCase().startsWith('ta');
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

  const copy = useMemo(() => tamil ? {
    eyebrow: 'Profile details', title: 'Public profile விவரங்கள்', subtitle: 'மேலே உள்ள photo & banner identity-க்கு கீழே, customers பார்க்கும் பெயர், description மற்றும் service area-ஐ இங்கே manage செய்யுங்கள்.',
    professional: 'Professional', business: 'Business', verified: 'Verified', pending: 'Verification pending', ready: 'Profile ready', needs: 'Profile needs work',
    editProfile: 'Edit profile', addRole: 'Add role', profileName: 'Professional headline / display name', businessName: 'Business display name', description: 'Provider description', area: 'Service area', save: 'Save profile', cancel: 'Cancel', saved: 'Profile saved.',
    roles: 'Talents & roles', rolesHelp: 'ஒவ்வொரு skill-ஐ compact card-ஆ manage செய்யுங்கள்.', roleTitle: 'Role / talent title', summary: 'Short role summary', experience: 'Experience years (optional)', serviceBookings: 'Service bookings', more: 'More opportunity options', freelance: 'Freelance', partTime: 'Part-time', fullTime: 'Full-time', contract: 'Contract', activeRole: 'Keep this role active', saveRole: 'Save role', updateRole: 'Update role', edit: 'Edit', delete: 'Delete', roleSaved: 'Role saved.', duplicate: 'இந்த role ஏற்கனவே உள்ளது. Existing role-ல் Edit பயன்படுத்துங்கள்.',
    noRoles: 'உங்கள் முதல் role-ஐ சேர்க்கவும்', noRolesBody: 'Web Developer, Driver, Designer போன்ற talents-ஐ தனித்தனி role ஆக வைத்துக்கொள்ளலாம்.',
    setup: 'Continue provider setup', publicReadiness: 'Public readiness', services: 'Services', active: 'active', launch: 'Marketplace setup', launchBody: 'Category, location approval, availability மற்றும் service launch-ஐ தொடர்ந்து முடிக்கவும்.',
  } : {
    eyebrow: 'Profile details', title: 'Public profile details', subtitle: 'Keep the name, description and service area customers see aligned with the photo and banner identity above.',
    professional: 'Professional', business: 'Business', verified: 'Verified', pending: 'Verification pending', ready: 'Profile ready', needs: 'Profile needs work',
    editProfile: 'Edit profile', addRole: 'Add role', profileName: 'Professional headline / display name', businessName: 'Business display name', description: 'Provider description', area: 'Service area', save: 'Save profile', cancel: 'Cancel', saved: 'Profile saved.',
    roles: 'Talents & roles', rolesHelp: 'Manage each skill as one compact role card.', roleTitle: 'Role / talent title', summary: 'Short role summary', experience: 'Experience years (optional)', serviceBookings: 'Service bookings', more: 'More opportunity options', freelance: 'Freelance', partTime: 'Part-time', fullTime: 'Full-time', contract: 'Contract', activeRole: 'Keep this role active', saveRole: 'Save role', updateRole: 'Update role', edit: 'Edit', delete: 'Delete', roleSaved: 'Role saved.', duplicate: 'This role already exists. Use Edit on the existing role instead.',
    noRoles: 'Add your first role', noRolesBody: 'Keep talents such as Web Developer, Driver or Designer as separate roles.',
    setup: 'Continue provider setup', publicReadiness: 'Public readiness', services: 'Services', active: 'active', launch: 'Marketplace setup', launchBody: 'Continue category, location approval, availability and service launch.',
  }, [tamil]);

  const loadRoles = useCallback(async () => {
    setRolesLoading(true);
    setRoleError('');
    try {
      const response = await fetch('/api/provider/profile/roles', { cache: 'no-store' });
      const body = await response.json() as { roles?: ProfessionalRole[]; error?: string };
      if (!response.ok) throw new Error(body.error ?? 'Unable to load roles.');
      const nextRoles = body.roles ?? [];
      setRoles(nextRoles);
      if (nextRoles.length === 0) setRolesManagerOpen(true);
    } catch (cause) {
      setRoleError(cause instanceof Error ? cause.message : 'Unable to load roles.');
    } finally {
      setRolesLoading(false);
    }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/provider/profile', { cache: 'no-store' });
      const body = await response.json() as { profile?: Profile; error?: string };
      if (!response.ok || !body.profile) throw new Error(body.error ?? 'Unable to load provider profile.');
      setProfile(body.profile);
      const profileReady = body.profile.display_name.trim().length >= 2
        && body.profile.description.trim().length >= 20
        && body.profile.location.trim().length >= 2;
      setProfileManagerOpen(!profileReady);
      setForm({ display_name: body.profile.display_name, description: body.profile.description, location: body.profile.location });
      if (body.profile.provider_type === 'professional') void loadRoles();
      else setRoles([]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to load provider profile.');
    } finally {
      setLoading(false);
    }
  }, [loadRoles]);

  useEffect(() => { void load(); }, [load]);

  const complete = Boolean(profile && profile.display_name.trim().length >= 2 && profile.description.trim().length >= 20 && profile.location.trim().length >= 2);

  const saveProfile = async (event: FormEvent) => {
    event.preventDefault();
    if (saving) return;
    setSaving(true); setError(''); setNotice('');
    try {
      const response = await fetch('/api/provider/profile', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      const body = await response.json() as { error?: string };
      if (!response.ok) throw new Error(body.error ?? 'Unable to save profile.');
      setNotice(copy.saved); setEditing(false); await load(); onProfileUpdated?.();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to save profile.'); }
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
    if (roles.some((role) => role.id !== editingRoleId && role.title.trim().toLocaleLowerCase() === normalized)) { setRoleError(copy.duplicate); return; }
    setRoleSaving(true); setRoleError(''); setRoleNotice('');
    try {
      const response = await fetch('/api/provider/profile/roles', { method: editingRoleId ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: editingRoleId ?? undefined, ...roleForm }) });
      const body = await response.json() as { error?: string };
      if (!response.ok) throw new Error(body.error ?? 'Unable to save role.');
      setRoleNotice(copy.roleSaved); closeRoleEditor(); await loadRoles();
    } catch (cause) { setRoleError(cause instanceof Error ? cause.message : 'Unable to save role.'); }
    finally { setRoleSaving(false); }
  };

  const deleteRole = async (role: ProfessionalRole) => {
    if (!window.confirm(tamil ? 'இந்த role-ஐ delete செய்ய வேண்டுமா?' : 'Delete this role?')) return;
    setRoleSaving(true); setRoleError('');
    try {
      const response = await fetch('/api/provider/profile/roles', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: role.id }) });
      const body = await response.json() as { error?: string };
      if (!response.ok) throw new Error(body.error ?? 'Unable to delete role.');
      await loadRoles();
    } catch (cause) { setRoleError(cause instanceof Error ? cause.message : 'Unable to delete role.'); }
    finally { setRoleSaving(false); }
  };

  if (loading) return <Card className={styles.panel}><p>{tamil ? 'Provider identity load ஆகிறது…' : 'Loading provider identity…'}</p></Card>;
  if (!profile) return <Card className={styles.panel}><p className="field-error" role="alert">{error || 'Provider profile unavailable.'}</p></Card>;

  return <section id="provider-profile" className={styles.center} aria-label="Provider profile and identity controls">
    <details
      className={styles.managementDisclosure}
      open={profileManagerOpen}
      onToggle={(event) => setProfileManagerOpen(event.currentTarget.open)}
    >
      <summary className={styles.managementSummary}>
        <div className={styles.managementSummaryCopy}>
          <span className={styles.eyebrow}>{copy.eyebrow}</span>
          <strong>{profile.display_name || copy.title}</strong>
          <small>{profile.location || copy.area} · {profile.services_active} {copy.active} / {profile.services_total} {copy.services.toLowerCase()}</small>
        </div>
        <div className={styles.managementSummaryMeta}>
          <Badge tone={profile.verified ? 'success' : 'warning'}>{profile.verified ? copy.verified : copy.pending}</Badge>
          <Badge tone={complete ? 'success' : 'warning'}>{complete ? copy.ready : copy.needs}</Badge>
          <span className={styles.managementCaret} aria-hidden="true">⌄</span>
        </div>
      </summary>

      <div className={styles.managementBody}>
        {notice ? <p className={styles.notice} role="status">{notice}</p> : null}
        {error ? <p className="field-error" role="alert">{error}</p> : null}

        <div className={styles.preview}>
          <div><strong>{profile.display_name}</strong><p>{profile.description || (tamil ? 'Short provider description சேர்க்கவும்.' : 'Add a short provider description.')}</p></div>
          <div className={styles.facts}><span><small>{copy.area}</small><strong>{profile.location || '—'}</strong></span><span><small>{copy.services}</small><strong>{profile.services_active} {copy.active} · {profile.services_total}</strong></span></div>
        </div>

        <div className={styles.actions}>
          <Button type="button" onClick={() => setEditing((value) => !value)}>{copy.editProfile}</Button>
          <Link href="/provider/public-readiness" className={styles.secondaryLink}>{copy.publicReadiness}</Link>
        </div>

        {editing ? <form className={styles.editor} onSubmit={saveProfile}>
          <div className={styles.twoColumns}><Input label={profile.provider_type === 'business' ? copy.businessName : copy.profileName} value={form.display_name} onChange={(event) => setForm((current) => ({ ...current, display_name: event.target.value }))} required maxLength={120} /><Input label={copy.area} value={form.location} onChange={(event) => setForm((current) => ({ ...current, location: event.target.value }))} required maxLength={160} /></div>
          <Textarea label={copy.description} value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} maxLength={1200} rows={3} />
          <div className={styles.actions}><Button type="submit" loading={saving}>{copy.save}</Button><Button type="button" variant="secondary" onClick={() => { setEditing(false); setForm({ display_name: profile.display_name, description: profile.description, location: profile.location }); }}>{copy.cancel}</Button></div>
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
          <span className={styles.eyebrow}>{copy.professional}</span>
          <strong>{copy.roles}</strong>
          <small>{rolesLoading ? (tamil ? 'Roles load ஆகிறது…' : 'Loading roles…') : roles.length ? `${roles.length} ${roles.length === 1 ? 'role' : 'roles'}` : copy.noRoles}</small>
        </div>
        <div className={styles.managementSummaryMeta}>
          <Badge tone={roles.some((role) => role.active) ? 'success' : 'neutral'}>{roles.filter((role) => role.active).length} active</Badge>
          <span className={styles.managementCaret} aria-hidden="true">⌄</span>
        </div>
      </summary>

      <div className={styles.managementBody}>
        <div className={styles.sectionHead}>
          <div><p>{copy.rolesHelp}</p></div>
          {!roleEditorOpen ? <Button type="button" onClick={startNewRole}>{copy.addRole}</Button> : null}
        </div>
        {roleNotice ? <p className={styles.notice} role="status">{roleNotice}</p> : null}
        {roleError && !roleEditorOpen ? <p className="field-error" role="alert">{roleError}</p> : null}
        {rolesLoading ? <p>{tamil ? 'Roles load ஆகிறது…' : 'Loading roles…'}</p> : null}
        {!rolesLoading && roles.length === 0 ? <EmptyState title={copy.noRoles} action={<Button type="button" onClick={startNewRole}>{copy.addRole}</Button>}>{copy.noRolesBody}</EmptyState> : null}
        {roles.length ? <div className={styles.roleRail}>{roles.map((role) => <article className={styles.roleCard} key={role.id}><div className={styles.roleTop}><div><h3>{role.title}</h3><small>{role.experience_years === null ? (tamil ? 'Experience குறிப்பிடவில்லை' : 'Experience not specified') : `${role.experience_years} years experience`}</small></div><Badge tone={role.active ? 'success' : 'neutral'}>{role.active ? 'Active' : 'Paused'}</Badge></div><p>{role.summary || (tamil ? 'Short summary சேர்க்கவும்.' : 'Add a short summary.')}</p><div className={styles.chips}>{role.service_bookings_enabled ? <Badge tone="info">{copy.serviceBookings}</Badge> : null}{role.freelance_enabled ? <Badge tone="info">{copy.freelance}</Badge> : null}{role.part_time_enabled ? <Badge tone="info">{copy.partTime}</Badge> : null}{role.full_time_enabled ? <Badge tone="info">{copy.fullTime}</Badge> : null}{role.contract_enabled ? <Badge tone="info">{copy.contract}</Badge> : null}</div><div className={styles.actions}><Button type="button" variant="secondary" onClick={() => startEditRole(role)} disabled={roleSaving}>{copy.edit}</Button><Button type="button" variant="danger" onClick={() => void deleteRole(role)} disabled={roleSaving}>{copy.delete}</Button></div></article>)}</div> : null}

        {roleEditorOpen ? <form className={styles.roleEditor} onSubmit={saveRole}>
          <div className={styles.twoColumns}><Input label={copy.roleTitle} value={roleForm.title} onChange={(event) => { setRoleError(''); setRoleForm((current) => ({ ...current, title: event.target.value })); }} required minLength={2} maxLength={120} /><Input label={copy.experience} type="number" min={0} max={80} step={1} value={roleForm.experience_years} onChange={(event) => setRoleForm((current) => ({ ...current, experience_years: event.target.value }))} /></div>
          <Textarea label={copy.summary} value={roleForm.summary} onChange={(event) => setRoleForm((current) => ({ ...current, summary: event.target.value }))} maxLength={1200} rows={3} />
          <Checkbox label={copy.serviceBookings} checked={roleForm.service_bookings_enabled} onChange={(event) => setRoleForm((current) => ({ ...current, service_bookings_enabled: event.target.checked }))} />
          <details className={styles.more}><summary>{copy.more}</summary><div className={styles.optionGrid}><Checkbox label={copy.freelance} checked={roleForm.freelance_enabled} onChange={(event) => setRoleForm((current) => ({ ...current, freelance_enabled: event.target.checked }))} /><Checkbox label={copy.partTime} checked={roleForm.part_time_enabled} onChange={(event) => setRoleForm((current) => ({ ...current, part_time_enabled: event.target.checked }))} /><Checkbox label={copy.fullTime} checked={roleForm.full_time_enabled} onChange={(event) => setRoleForm((current) => ({ ...current, full_time_enabled: event.target.checked }))} /><Checkbox label={copy.contract} checked={roleForm.contract_enabled} onChange={(event) => setRoleForm((current) => ({ ...current, contract_enabled: event.target.checked }))} /><Checkbox label={copy.activeRole} checked={roleForm.active} onChange={(event) => setRoleForm((current) => ({ ...current, active: event.target.checked }))} /></div></details>
          {roleError ? <p className="field-error" role="alert" aria-live="assertive">{roleError}</p> : null}
          <div className={styles.actions}><Button type="submit" loading={roleSaving}>{editingRoleId ? copy.updateRole : copy.saveRole}</Button><Button type="button" variant="secondary" onClick={closeRoleEditor}>{copy.cancel}</Button></div>
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
          <span className={styles.eyebrow}>{copy.launch}</span>
          <strong>{complete ? (tamil ? 'Profile ready — marketplace setup' : 'Profile ready — marketplace setup') : (tamil ? 'Profile basics-ஐ முடிக்கவும்' : 'Finish your profile basics')}</strong>
          <small>{complete ? (tamil ? 'Category, location, availability & launch' : 'Category, location, availability & launch') : copy.launchBody}</small>
        </div>
        <div className={styles.managementSummaryMeta}>
          <Badge tone={complete ? 'success' : 'warning'}>{complete ? copy.ready : copy.needs}</Badge>
          <span className={styles.managementCaret} aria-hidden="true">⌄</span>
        </div>
      </summary>
      <div className={styles.managementBody}>
        <div className={styles.launchCompactBody}>
          <p>{copy.launchBody}</p>
          <Link href="/provider/setup" className={styles.setupLink}>{copy.setup}</Link>
        </div>
      </div>
    </details>
  </section>;
}
