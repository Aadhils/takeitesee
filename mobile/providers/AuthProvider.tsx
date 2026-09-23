import type { Session } from '@supabase/supabase-js';
import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { ApiError, fetchNativeSession } from '../lib/api';
import { supabase } from '../lib/supabase';

type ServerIdentity = {
  userId: string;
  roles: string[];
};

type AuthState =
  | { status: 'loading'; identity: null }
  | { status: 'signedOut'; identity: null }
  | { status: 'signedIn'; identity: ServerIdentity };

type AuthContextValue = AuthState & {
  signIn(email: string, password: string): Promise<void>;
  signOut(): Promise<void>;
  refresh(): Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

async function validateServerSession(session: Session): Promise<ServerIdentity> {
  const result = await fetchNativeSession(session.access_token);

  if (!result.authenticated) {
    throw new Error('Authentication required.');
  }

  return {
    userId: result.user_id,
    roles: result.roles,
  };
}

export function AuthProvider({ children }: PropsWithChildren) {
  const [state, setState] = useState<AuthState>({ status: 'loading', identity: null });

  const establishSession = useCallback(async (session: Session | null) => {
    if (!session) {
      setState({ status: 'signedOut', identity: null });
      return;
    }

    try {
      const identity = await validateServerSession(session);
      setState({ status: 'signedIn', identity });
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        await supabase.auth.signOut();
        setState({ status: 'signedOut', identity: null });
        return;
      }

      throw error;
    }
  }, []);

  const refresh = useCallback(async () => {
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    await establishSession(data.session);
  }, [establishSession]);

  useEffect(() => {
    let active = true;

    supabase.auth
      .getSession()
      .then(async ({ data, error }) => {
        if (!active) return;
        if (error) throw error;
        await establishSession(data.session);
      })
      .catch(() => {
        if (active) setState({ status: 'signedOut', identity: null });
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      void establishSession(session).catch(() => {
        if (active) setState({ status: 'signedOut', identity: null });
      });
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [establishSession]);

  const signIn = useCallback(
    async (email: string, password: string) => {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });

      if (error || !data.session) {
        throw new Error(error?.message ?? 'Unable to sign in.');
      }

      await establishSession(data.session);
    },
    [establishSession],
  );

  const signOut = useCallback(async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    setState({ status: 'signedOut', identity: null });
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ ...state, signIn, signOut, refresh }),
    [refresh, signIn, signOut, state],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider.');
  return context;
}
