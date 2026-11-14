// A setting kept on this phone only (not synced to WaniKani), as a small JSON file. Read once at
// start-up, so the first frame already has it; components follow changes through the hook.

import { File, Paths } from 'expo-file-system';
import { useSyncExternalStore } from 'react';

export function localSetting<T extends string>(name: string, values: readonly T[], fallback: T) {
  const file = new File(Paths.document, `${name}.json`);
  const listeners = new Set<() => void>();

  let value: T = fallback;
  try {
    const saved = file.exists ? (JSON.parse(file.textSync()) as { value?: string }).value : undefined;
    if (values.includes(saved as T)) value = saved as T;
  } catch {
    // Unreadable: keep the default.
  }

  return {
    get: () => value,
    set(next: T) {
      if (next === value) return;
      value = next;
      for (const listener of listeners) listener();
      Promise.resolve(file.write(JSON.stringify({ value: next }))).catch(() => {});
    },
    use() {
      return useSyncExternalStore(
        (listener) => {
          listeners.add(listener);
          return () => listeners.delete(listener);
        },
        () => value,
      );
    },
  };
}
