import type { AuthSession, SignInInput, SignUpInput, User } from '../types/auth-domain';
import { getBookingDraft, saveBookingDraft } from './booking-repository';
import { createSupabaseBrowserClient } from '../lib/supabase/browser';
import { isSupabaseConfigured } from '../lib/supabase/config';

const sessionKey = 'takeitesee.devSession';
const usersKey = 'takeitesee.devUsers';

export type AuthState = { authenticated: false } | { authenticated: true; customerId: string; customerName: string; customerContactReference?: string };

export interface AuthAdapter {
  getCurrentUser(): User | undefined;
  getSession(): AuthSession | undefined;
  isAuthenticated(): boolean;
  signIn(input: SignInInput): User;
  signUp(input: SignUpInput): User;
  signOut(): void;
  getLoginPath(returnTo: string): string;
}

function readUsers(): User[] {
  if (typeof window === 'undefined') return [];
  try {
    const value = JSON.parse(window.localStorage.getItem(usersKey) ?? '[]');
    return Array.isArray(value) ? value as User[] : [];
  } catch { return []; }
}

function writeUsers(users: User[]) {
  try { window.localStorage.setItem(usersKey, JSON.stringify(users)); } catch { /* Development persistence is optional. */ }
}

function writeSession(session: AuthSession) {
  try { window.localStorage.setItem(sessionKey, JSON.stringify(session)); } catch { /* Development persistence is optional. */ }
}

function normalizeEmail(email: string) { return email.trim().toLowerCase(); }
function createUserId() { return typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `dev-user-${Date.now()}`; }
function assertCredential(credential: string) { if (credential.trim().length < 4) throw new Error('Use a development credential with at least 4 characters.'); }

function completePendingDraft(user: User) {
  const draft = getBookingDraft();
  if (draft) saveBookingDraft({ ...draft, customerId: user.id as typeof draft.customerId, customerName: user.name, customerContactReference: user.email });
}

export const localDevelopmentAuthAdapter: AuthAdapter = {
  getCurrentUser: () => localDevelopmentAuthAdapter.getSession()?.user,
  getSession: () => {
    if (typeof window === 'undefined') return undefined;
    try {
      const value = JSON.parse(window.localStorage.getItem(sessionKey) ?? 'null');
      return value?.user ? value as AuthSession : undefined;
    } catch { return undefined; }
  },
  isAuthenticated: () => Boolean(localDevelopmentAuthAdapter.getSession()),
  signIn: ({ email, credential }: SignInInput) => {
    assertCredential(credential);
    const user = readUsers().find((candidate) => candidate.email === normalizeEmail(email));
    if (!user) throw new Error('No development account exists for that email. Create an account first.');
    writeSession({ user, issuedAt: new Date().toISOString() });
    completePendingDraft(user);
    return user;
  },
  signUp: ({ name, email, phone, credential }: SignUpInput) => {
    assertCredential(credential);
    if (name.trim().length < 2) throw new Error('Enter your name.');
    const normalizedEmail = normalizeEmail(email);
    const users = readUsers();
    if (users.some((user) => user.email === normalizedEmail)) throw new Error('A development account already exists for that email.');
    const now = new Date().toISOString();
    const user: User = { id: createUserId(), name: name.trim(), email: normalizedEmail, phone: phone?.trim() || undefined, role: 'customer', createdAt: now, updatedAt: now };
    writeUsers([...users, user]);
    writeSession({ user, issuedAt: now });
    completePendingDraft(user);
    return user;
  },
  signOut: () => { try { window.localStorage.removeItem(sessionKey); } catch { /* Development persistence is optional. */ } },
  getLoginPath: (returnTo: string) => `/login?returnTo=${encodeURIComponent(returnTo)}`,
};

export const presentationAuthAdapter = {
  getCurrentCustomer: (): AuthState => {
    const user = localDevelopmentAuthAdapter.getCurrentUser();
    return user ? { authenticated: true, customerId: user.id, customerName: user.name, customerContactReference: user.email } : { authenticated: false };
  },
  getLoginPath: (returnTo: string) => localDevelopmentAuthAdapter.getLoginPath(returnTo),
};

export { isSupabaseConfigured };

/** Resolves the current customer from the real Supabase session when configured, otherwise falls back to the local development session. Never mixes the two identities. */
export async function getCurrentCustomerAsync(): Promise<AuthState> {
  if (isSupabaseConfigured()) {
    const user = await getSupabaseBrowserUser();
    if (!user) return { authenticated: false };
    const name = (user.user_metadata as { name?: string } | null | undefined)?.name ?? user.email ?? 'Account';
    return { authenticated: true, customerId: user.id, customerName: name, customerContactReference: user.email ?? undefined };
  }
  return presentationAuthAdapter.getCurrentCustomer();
}

export async function signInWithSupabase(input: SignInInput) {
  const supabase = createSupabaseBrowserClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email: input.email.trim().toLowerCase(), password: input.credential });
  if (error || !data.user) throw new Error(error?.message ?? 'Unable to sign in.');
  return data.user;
}

export async function signUpWithSupabase(input: SignUpInput) {
  const supabase = createSupabaseBrowserClient();
  const { data, error } = await supabase.auth.signUp({ email: input.email.trim().toLowerCase(), password: input.credential, options: { data: { name: input.name.trim(), phone: input.phone?.trim() || undefined, role: 'customer' } } });
  if (error || !data.user) throw new Error(error?.message ?? 'Unable to create an account.');
  return { user: data.user, session: data.session };
}

export async function signOutWithSupabase() {
  const supabase = createSupabaseBrowserClient();
  const { error } = await supabase.auth.signOut();
  if (error) throw new Error(error.message);
}

export async function getSupabaseBrowserUser() {
  const supabase = createSupabaseBrowserClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}
