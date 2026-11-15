// A small JSON-ish file the app keeps for itself: in the app's documents folder on a phone, and in
// the desktop shell's data folder (or the browser's localStorage) on web — see document-file.web.ts.

import { File, Paths } from 'expo-file-system';

export interface DocumentFile {
  /** The contents, or null when there's no such file. Synchronous, so a first frame can use it. */
  read(): string | null;
  write(text: string): Promise<void>;
}

export function documentFile(name: string): DocumentFile {
  const file = new File(Paths.document, name);
  return {
    read: () => (file.exists ? file.textSync() : null),
    write: async (text) => {
      await file.write(text);
    },
  };
}
