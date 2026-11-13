import { useQueryClient } from '@tanstack/react-query';
import * as SecureStore from 'expo-secure-store';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { createClient, type WaniKaniClient } from './wanikani/client';
import type { User } from './wanikani/types';

const TOKEN_KEY = 'wanikani.token';

type AuthState =
  | { status: 'loading' }
  | { status: 'signedOut' }
  | { status: 'signedIn'; token: string; client: WaniKaniClient };

interface AuthContextValue {
  state: AuthState;
  /** Validates the token against `/user`, then stores it. Throws on an invalid token. */
  signIn: (token: string) => Promise<User>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

// WaniKani personal access tokens are UUIDs; tolerate surrounding whitespace and a pasted
// "Bearer " prefix, which is what people copy from curl examples.
export function normalizeToken(input: string) {
  return input.trim().replace(/^bearer\s+/i, '');
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const [state, setState] = useState<AuthState>({ status: 'loading' });

  useEffect(() => {
    SecureStore.getItemAsync(TOKEN_KEY)
      .then((token) =>
        setState(token ? { status: 'signedIn', token, client: createClient(token) } : { status: 'signedOut' }),
      )
      .catch(() => setState({ status: 'signedOut' }));
  }, []);

  const signIn = useCallback(
    async (input: string) => {
      const token = normalizeToken(input);
      const client = createClient(token);
      const user = await client.getUser();
      await SecureStore.setItemAsync(TOKEN_KEY, token);
      queryClient.clear();
      queryClient.setQueryData(['user'], user);
      setState({ status: 'signedIn', token, client });
      return user;
    },
    [queryClient],
  );

  const signOut = useCallback(async () => {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
    queryClient.clear();
    setState({ status: 'signedOut' });
  }, [queryClient]);

  const value = useMemo(() => ({ state, signIn, signOut }), [state, signIn, signOut]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}

/** The API client for the signed-in user. Only call from screens behind the sign-in guard. */
export function useClient() {
  const { state } = useAuth();
  if (state.status !== 'signedIn') throw new Error('useClient called while signed out');
  return state.client;
}
