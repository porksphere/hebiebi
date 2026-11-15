// expo-secure-store has no web implementation. The desktop shell encrypts the token with the OS
// keyring (Electron's safeStorage); a plain browser, which is only for development, uses
// localStorage.

import { desktop } from './desktop';

const TOKEN_KEY = 'hebiebi.wanikani.token';

export const tokenStore = desktop
  ? desktop.token
  : {
      get: async () => localStorage.getItem(TOKEN_KEY),
      set: async (token: string) => localStorage.setItem(TOKEN_KEY, token),
      delete: async () => localStorage.removeItem(TOKEN_KEY),
    };
