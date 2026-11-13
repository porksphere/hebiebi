// The toast queue: `showToast` from anywhere (UI or not); <Toaster /> (components/toast.tsx) shows
// it. One at a time, newest wins.

import { useSyncExternalStore } from 'react';

export interface Toast {
  id: number;
  title: string;
  detail?: string;
}

/**
 * The same message again within this long isn't shown again: offline, the dashboard's refetch fails
 * every minute, and once is enough to say so.
 */
const REPEAT_MS = 2 * 60_000;

let current: Toast | null = null;
let nextId = 1;
const lastShown = new Map<string, number>();
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

export function showToast(title: string, detail?: string) {
  const key = `${title}\n${detail ?? ''}`;
  const now = Date.now();
  if (now - (lastShown.get(key) ?? 0) < REPEAT_MS) return;
  lastShown.set(key, now);
  current = { id: nextId++, title, detail };
  emit();
}

export function dismissToast(id: number) {
  if (current?.id !== id) return;
  current = null;
  emit();
}

export function useToast() {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => current,
  );
}
