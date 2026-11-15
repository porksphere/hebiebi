// Keyboard shortcuts, for the desktop app (and a browser). A phone has no keyboard to press them on,
// so on native these do nothing.

import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef } from 'react';
import { Platform } from 'react-native';

// In the capture phase, before the page sees the key: react-native-web's TextInput stops every
// keydown from bubbling, so a shortcut listening the ordinary way never heard a key pressed in the
// answer field.
function onKeyDown(listener: (e: KeyboardEvent) => void) {
  if (Platform.OS !== 'web') return undefined;
  window.addEventListener('keydown', listener, { capture: true });
  return () => window.removeEventListener('keydown', listener, { capture: true });
}

/** A text field has the keyboard, so Enter is its own (submitting it) rather than a shortcut's. */
export function typingInField() {
  const el = typeof document === 'undefined' ? null : document.activeElement;
  return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA');
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

/** What a click is meant for in its own right, so it shouldn't also move the keyboard. */
const CONTROLS =
  'button, a, input, textarea, select, [role="button"], [role="link"], [role="switch"], [role="checkbox"], [role="tab"]';

/**
 * A click anywhere on this screen that isn't on a control calls `onClick` (the review screen puts
 * the keyboard back in its answer field). On `click`, which comes when the button is released, so
 * a press held for something of its own (hold to undo) has done its thing first. While the screen
 * is in front only, like useScreenHotkeys.
 */
export function useClickAway(onClick: () => void) {
  const latest = useRef(onClick);
  useEffect(() => {
    latest.current = onClick;
  });
  useFocusEffect(
    useCallback(() => {
      if (Platform.OS !== 'web') return undefined;
      const listener = (e: MouseEvent) => {
        if (e.button !== 0 || (e.target instanceof Element && e.target.closest(CONTROLS))) return;
        latest.current();
      };
      window.addEventListener('click', listener);
      return () => window.removeEventListener('click', listener);
    }, []),
  );
}
