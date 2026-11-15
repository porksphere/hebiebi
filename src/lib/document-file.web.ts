// Web has no expo-file-system. In the desktop app the shell keeps real files in its data folder;
// in a plain browser (`bun run web`, for development) localStorage stands in.

import { desktop } from './desktop';
import type { DocumentFile } from './document-file';

export type { DocumentFile };

const PREFIX = 'hebiebi.file.';

export function documentFile(name: string): DocumentFile {
  if (desktop) {
    const files = desktop.files;
    return { read: () => files.read(name), write: (text) => files.write(name, text) };
  }
  return {
    read: () => (typeof localStorage === 'undefined' ? null : localStorage.getItem(PREFIX + name)),
    write: async (text) => localStorage.setItem(PREFIX + name, text),
  };
}
