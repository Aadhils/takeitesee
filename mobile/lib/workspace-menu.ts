import type { ProfileScope } from './profile-model';

export type MenuItem = { label: string; detail: string; path: string; web?: boolean };
export type MenuGroup = { title: string; items: MenuItem[] };

export function workspaceMenu(scope: ProfileScope): MenuGroup[] {
  const provider = scope !== 'customer';
  const groups: MenuGroup[] = [{ title: provider ? 'Customer work' : 'Your activity', items: provider ? [
    { label: 'Leads & proposals', detail: 'Matching requests and your responses', path: '/provider' },
    { label: 'Bookings', detail: 'Assigned services and booking details', path: '/provider-bookings' },
    { label: 'Service availability', detail: 'Manage availability for your services', path: '/provider-service-availability' },
    { label: 'Live work status', detail: 'Available, busy, offline or paused', path: '/provider-live-status' },
    { label: 'Customer reviews', detail: 'Ratings and your response history', path: '/provider-reviews' },
  ] : [
    { label: 'Edit profile details', detail: 'Name, phone and location', path: '/edit-profile?scope=customer' },
    { label: 'My bookings', detail: 'Service dates and booking details', path: '/bookings' },
    { label: 'My requirements', detail: 'Requests and Provider proposals', path: '/requirements' },
    { label: 'My reviews', detail: 'Your published service feedback', path: '/reviews' },
  ] }];
  if (provider) groups.push({ title: 'Services & profile', items: [
    { label: 'Edit Provider details', detail: 'Name, description and service area', path: `/edit-profile?scope=${scope}` },
    { label: 'Manage services', detail: 'Create drafts and edit your service listings', path: '/provider-services' },
    { label: 'Weekly schedule', detail: 'Configure service working hours', path: '/provider-schedule' },
    { label: 'Verification', detail: 'Review your verification status', path: '/provider-verification' },
    { label: 'Public profile readiness', detail: 'Check your profile before sharing', path: '/provider-readiness' },
    { label: 'Public handle', detail: 'Manage your public profile address', path: '/provider-handle' },
  ] });
  if (scope === 'professional') groups.push({ title: 'Professional presence', items: [
    { label: 'Portfolio', detail: 'Showcase your work', path: '/provider-portfolio' },
    { label: 'Résumé & career', detail: 'Review your résumé and career availability', path: '/provider-career' },
    { label: 'Jobs & applications', detail: 'Track applications and saved opportunities', path: '/provider-job-tracker' },
  ] });
  if (scope === 'business') groups.push({ title: 'Business presence', items: [
    { label: 'Business profile', detail: 'Manage your business information', path: '/edit-profile?scope=business' },
    { label: 'Hiring & applicants', detail: 'Review job listings and applicant status', path: '/provider-hiring' },
  ] });
  groups.push({ title: 'Stay connected', items: [
    { label: 'Messages', detail: 'Your service conversations', path: provider ? '/messages?workspace=provider' : '/messages?workspace=customer' },
    { label: 'Notifications', detail: 'Booking, proposal and message updates', path: '/notifications' },
    { label: 'Settings & privacy', detail: 'Preferences, security and account actions', path: '/settings' },
  ] });
  return groups;
}

// Only fixed, reviewed TakeItEsee paths may leave the app; no session tokens in URLs.
export function workspaceWebUrl(path: string): string {
  const allowed = new Set([
    ...workspaceMenu('customer').flatMap((group) => group.items.filter((item) => item.web).map((item) => item.path)),
    ...workspaceMenu('professional').flatMap((group) => group.items.filter((item) => item.web).map((item) => item.path)),
    ...workspaceMenu('business').flatMap((group) => group.items.filter((item) => item.web).map((item) => item.path)),
    '/provider/jobs', '/provider/resume', '/provider/portfolio', '/provider/verification', '/provider/handle', '/provider/services', '/provider/setup', '/account/profile', '/account/settings', '/account/security', '/account/privacy', '/privacy', '/terms', '/cookies',
  ]);
  if (!allowed.has(path)) throw new Error('This account page is unavailable.');
  return `https://www.takeitesee.com${path}`;
}
