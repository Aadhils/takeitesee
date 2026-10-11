// Only the reviewed account privacy page maps to this native screen.
export function privacyNotificationTarget(path: string | null): '/privacy-requests' | null {
 if (!path || !path.startsWith('/') || path.startsWith('//') || path.includes('\\')) return null;
 return path.split(/[?#]/, 1)[0] === '/account/privacy' ? '/privacy-requests' : null;
}
