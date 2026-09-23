import { mobileEnv } from './env';

export class ApiError extends Error {
  readonly status: number;
  readonly body: unknown;

  constructor(status: number, message: string, body: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
  }
}

type NativeApiRequestInit = RequestInit & {
  accessToken?: string | null;
};

export async function apiFetch<T>(
  path: string,
  { accessToken, headers: inputHeaders, ...init }: NativeApiRequestInit = {},
): Promise<T> {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const headers = new Headers(inputHeaders);

  headers.set('Accept', 'application/json');

  if (accessToken) {
    headers.set('Authorization', `Bearer ${accessToken}`);
  }

  if (init.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(`${mobileEnv.apiBaseUrl}${normalizedPath}`, {
    ...init,
    headers,
  });

  const text = await response.text();
  let body: unknown = null;

  if (text) {
    try {
      body = JSON.parse(text) as unknown;
    } catch {
      body = text;
    }
  }

  if (!response.ok) {
    const message =
      typeof body === 'object' && body !== null && 'error' in body
        ? String((body as { error?: unknown }).error || response.statusText)
        : response.statusText || `Request failed with ${response.status}`;

    throw new ApiError(response.status, message, body);
  }

  return body as T;
}

export type NativeSessionResponse =
  | { authenticated: false }
  | {
      authenticated: true;
      user_id: string;
      roles: string[];
    };

export function fetchNativeSession(accessToken: string) {
  return apiFetch<NativeSessionResponse>('/api/mobile/session', {
    method: 'GET',
    accessToken,
  });
}
