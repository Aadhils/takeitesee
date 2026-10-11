import { createContext, type PropsWithChildren, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { fetchNativeProfiles } from '../lib/identity-media';
import { resolveProfileSelection, type IdentityMedia, type NativeProfile, type ProfileScope } from '../lib/profile-model';
import { useAuth } from './AuthProvider';

type WorkspaceValue = {
  profiles: NativeProfile[];
  selectedScope: ProfileScope;
  loading: boolean;
  error: string;
  refresh(): Promise<void>;
  select(scope: ProfileScope): boolean;
  updateMedia(scope: ProfileScope, media: IdentityMedia): void;
};
type State = { userId: string | null; profiles: NativeProfile[]; selectedScope: ProfileScope; loading: boolean; error: string };
const emptyState: State = { userId: null, profiles: [], selectedScope: 'customer', loading: false, error: '' };
const WorkspaceContext = createContext<WorkspaceValue | null>(null);
const preferenceKey = (userId: string) => `takeitesee.workspace.${userId}`;

export function WorkspaceProvider({ children }: PropsWithChildren) {
  const auth = useAuth();
  const userId = auth.status === 'signedIn' ? auth.identity.userId : null;
  const [state, setState] = useState<State>(emptyState);
  const owner = useRef(userId);
  owner.current = userId;
  const inFlight = useRef<{ userId: string; promise: Promise<void> } | null>(null);

  const refresh = useCallback(async () => {
    if (!userId) return;
    if (inFlight.current?.userId === userId) return inFlight.current.promise;
    const promise = (async () => {
      setState((current) => current.userId === userId ? { ...current, loading: true, error: '' } : { ...emptyState, userId, loading: true });
      try {
        const profiles = await fetchNativeProfiles(userId);
        if (owner.current !== userId) return;
        let stored: string | null = null;
        try { stored = globalThis.localStorage.getItem(preferenceKey(userId)); } catch { /* In-memory selection still works. */ }
        setState((current) => ({ userId, profiles, loading: false, error: '', selectedScope: resolveProfileSelection(profiles, current.userId === userId && current.profiles.length ? current.selectedScope : stored) }));
      } catch (cause) {
        if (owner.current === userId) setState((current) => ({ ...current, loading: false, error: cause instanceof Error ? cause.message : 'Your profiles could not load.' }));
      }
    })();
    inFlight.current = { userId, promise };
    try { await promise; } finally { if (inFlight.current?.promise === promise) inFlight.current = null; }
  }, [userId]);

  useEffect(() => { if (userId) void refresh(); else setState(emptyState); }, [userId, refresh]);

  const select = useCallback((scope: ProfileScope) => {
    if (!userId || state.userId !== userId || !state.profiles.some((profile) => profile.scope === scope)) return false;
    setState((current) => current.userId === userId && current.selectedScope !== scope ? { ...current, selectedScope: scope } : current);
    try { globalThis.localStorage.setItem(preferenceKey(userId), scope); } catch { /* Selection is retained in memory. */ }
    return true;
  }, [userId, state.userId, state.profiles]);

  const updateMedia = useCallback((scope: ProfileScope, media: IdentityMedia) => {
    if (!userId || media.scope !== scope) return;
    setState((current) => current.userId === userId ? { ...current, profiles: current.profiles.map((profile) => profile.scope === scope ? { ...profile, media, mediaError: undefined } : profile) } : current);
  }, [userId]);

  const visible = state.userId === userId ? state : emptyState;
  const value = useMemo<WorkspaceValue>(() => ({ profiles: visible.profiles, selectedScope: visible.selectedScope, loading: visible.loading, error: visible.error, refresh, select, updateMedia }), [visible.profiles, visible.selectedScope, visible.loading, visible.error, refresh, select, updateMedia]);
  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace() {
  const workspace = useContext(WorkspaceContext);
  if (!workspace) throw new Error('useWorkspace must be used inside WorkspaceProvider.');
  return workspace;
}
