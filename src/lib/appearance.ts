// The app's appearance: follow the phone, or always light or dark. Saved on the device and applied
// through React Native's Appearance, so native chrome (tab bar, headers, alerts) follows too.

import { File, Paths } from 'expo-file-system';
import { useSyncExternalStore } from 'react';
import { Appearance } from 'react-native';

export type AppearanceChoice = 'auto' | 'light' | 'dark';

const file = new File(Paths.document, 'appearance.json');
const listeners = new Set<() => void>();

function read(): AppearanceChoice {
  try {
    const saved = file.exists ? (JSON.parse(file.textSync()) as { choice?: string }).choice : undefined;
    return saved === 'light' || saved === 'dark' ? saved : 'auto';
  } catch {
    return 'auto';
  }
}

let choice = read();
if (choice !== 'auto') Appearance.setColorScheme(choice);

export function setAppearance(next: AppearanceChoice) {
  if (next === choice) return;
  choice = next;
  Appearance.setColorScheme(next);
  for (const listener of listeners) listener();
  Promise.resolve(file.write(JSON.stringify({ choice: next }))).catch(() => {});
}

export function useAppearance() {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => choice,
  );
}
