// Only reviewed internal Provider pages may map to native routes.
const targets = {
  '/provider/verification': '/provider-verification',
  '/provider/public-readiness': '/provider-readiness',
  '/provider/handle': '/provider-handle',
} as const;
export function providerNotificationTarget(path: string | null) {
  if (!path || !path.startsWith('/') || path.startsWith('//') || path.includes('\\')) return null;
  const pathname = path.split(/[?#]/, 1)[0];
  return Object.prototype.hasOwnProperty.call(targets, pathname) ? targets[pathname as keyof typeof targets] : null;
}
