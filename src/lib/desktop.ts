// What the Electron shell (desktop/src/preload.ts) puts on `window` for the page. Undefined on a
// phone and in a plain browser.

export interface HebiebiDesktop {
  platform: string;
  files: {
    read(name: string): string | null;
    write(name: string, text: string): Promise<void>;
  };
  token: {
    get(): Promise<string | null>;
    set(token: string): Promise<void>;
    delete(): Promise<void>;
  };
}

export const desktop: HebiebiDesktop | undefined =
  typeof window === 'undefined' ? undefined : (window as { hebiebiDesktop?: HebiebiDesktop }).hebiebiDesktop;
