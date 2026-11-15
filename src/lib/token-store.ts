// Where the personal access token is kept: the Keychain on iOS (Keystore-backed on Android). Web
// keeps it elsewhere; see token-store.web.ts.

import * as SecureStore from 'expo-secure-store';

const TOKEN_KEY = 'wanikani.token';

export const tokenStore = {
  get: () => SecureStore.getItemAsync(TOKEN_KEY),
  set: (token: string) => SecureStore.setItemAsync(TOKEN_KEY, token),
  delete: () => SecureStore.deleteItemAsync(TOKEN_KEY),
};
