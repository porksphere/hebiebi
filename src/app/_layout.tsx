import { focusManager, MutationCache, QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { AppState, Platform } from 'react-native';

import { AuthProvider, useAuth } from '@/lib/auth';
import { ReviewSessionProvider } from '@/lib/review/use-review-session';
import { Toaster } from '@/components/toast';
import { showToast } from '@/lib/toast';
import { describeError, WaniKaniError } from '@/lib/wanikani/client';
import { useTheme } from '@/theme';

SplashScreen.preventAutoHideAsync();

/**
 * Any request that fails (after its retries) says so in a toast; a bad token instead signs you out
 * (RootNavigator). In development it's logged to Metro too, with the query it was for.
 */
function reportError(error: Error, what: string) {
  if (__DEV__) console.warn(`[${what}]`, error.message);
  if (error instanceof WaniKaniError && error.isUnauthorized) return;
  const { title, detail } = describeError(error);
  showToast(title, detail);
}

const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error, query) => reportError(error, `query ${JSON.stringify(query.queryKey)}`),
  }),
  mutationCache: new MutationCache({
    onError: (error) => reportError(error, 'mutation'),
  }),
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      // A bad token won't get better by retrying.
      retry: (count, error) =>
        !(error instanceof WaniKaniError && error.status >= 400 && error.status < 500) && count < 2,
    },
  },
});

// React Query's focus refetch listens to the browser; on native, app foregrounding is the focus.
if (Platform.OS !== 'web') {
  AppState.addEventListener('change', (status) => focusManager.setFocused(status === 'active'));
}

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <RootNavigator />
      </AuthProvider>
      <Toaster />
    </QueryClientProvider>
  );
}

function RootNavigator() {
  const { state, signOut } = useAuth();
  const theme = useTheme();

  useEffect(() => {
    if (state.status !== 'loading') SplashScreen.hideAsync();
  }, [state.status]);

  // A token revoked on the website shows up as a 401 on any query: drop back to sign-in.
  useEffect(
    () =>
      queryClient.getQueryCache().subscribe((event) => {
        const error = event.query.state.error;
        if (error instanceof WaniKaniError && error.isUnauthorized) signOut();
      }),
    [signOut],
  );

  if (state.status === 'loading') return null;
  const signedIn = state.status === 'signedIn';

  const base = theme.scheme === 'dark' ? DarkTheme : DefaultTheme;
  const navTheme = {
    ...base,
    colors: {
      ...base.colors,
      primary: theme.text,
      background: theme.background,
      card: theme.background,
      text: theme.text,
      border: theme.border,
    },
  };

  return (
    <ThemeProvider value={navTheme}>
      <ReviewSessionProvider>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Protected guard={signedIn}>
            <Stack.Screen name="(tabs)" />
            <Stack.Screen
              name="review"
              // headerShown is set here, not from the screen: toggling a modal's header after it
              // mounts makes react-native-screens remount it and lose the session's state.
              options={{ presentation: 'fullScreenModal', gestureEnabled: false, headerShown: true, title: 'Reviews' }}
            />
            <Stack.Screen name="subject" options={{ presentation: 'modal' }} />
          </Stack.Protected>
          <Stack.Protected guard={!signedIn}>
            <Stack.Screen name="sign-in" />
          </Stack.Protected>
        </Stack>
      </ReviewSessionProvider>
    </ThemeProvider>
  );
}
