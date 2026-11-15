// Keyboard shortcuts, for the desktop app (and a browser). A phone has no keyboard to press them on,
// so on native these do nothing.

import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef } from 'react';
import { Platform } from 'react-native';

function onKeyDown(listener: (e: KeyboardEvent) => void) {
  if (Platform.OS !== 'web') return undefined;
  window.addEventListener('keydown', listener);
  return () => window.removeEventListener('keydown', listener);
}

/**
 * Keys for one screen, only while it's the one in front. Screens under it in the stack stay
 * mounted, so a plain listener would still hear keys meant for the screen on top.
 */
export function useScreenHotkeys(handler: (e: KeyboardEvent) => void) {
  const latest = useRef(handler);
  useEffect(() => {
    latest.current = handler;
  });
  useFocusEffect(useCallback(() => onKeyDown((e) => latest.current(e)), []));
}

/**
 * Escape closes what's in front: an item's page goes back to whatever opened it, one step per
 * press, so pages opened from pages unwind one at a time. Mounted once, at the root, so one press
 * is one step however many screens are mounted.
 */
export function useEscapeGoesBack() {
  useEffect(
    () =>
      onKeyDown((e) => {
        if (e.key !== 'Escape' || e.repeat || e.defaultPrevented) return;
        if (!router.canGoBack()) return;
        e.preventDefault();
        router.back();
      }),
    [],
  );
}
