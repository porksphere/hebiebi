import { useCallback, useEffect, useRef, useState, type ComponentRef } from 'react';
import {
  Keyboard,
  LayoutAnimation,
  Platform,
  type KeyboardEvent,
  View,
} from 'react-native';

/**
 * Bottom padding that keeps a view's content clear of the keyboard (iOS).
 *
 * Measures the view in WINDOW coordinates and pads by however much of it the keyboard covers, so
 * it's right whatever sits above the view: a native header, a modal presentation, an iPhone Duo's
 * folded or unfolded window. KeyboardAvoidingView isn't: it compares the keyboard (screen
 * coordinates) with its own frame relative to its PARENT, so under a native stack header it comes
 * up short by the header's height and the bottom of the screen hides behind the keyboard.
 *
 * Android needs nothing: the window resizes for the keyboard (adjustResize).
 *
 * Usage: `<View ref={ref} onLayout={onLayout} style={{ paddingBottom: inset }}>`. Padding sits
 * inside the view, so it doesn't change the frame being measured.
 */
export function useKeyboardInset() {
  const ref = useRef<ComponentRef<typeof View>>(null);
  const [inset, setInset] = useState(0);
  /** Top of the keyboard in screen coordinates, or null while it's hidden. */
  const keyboardTop = useRef<number | null>(null);

  const measure = useCallback((animation?: { duration: number }) => {
    const view = ref.current;
    if (!view) return;
    view.measureInWindow((_x, y, _width, height) => {
      const top = keyboardTop.current;
      const next = top === null ? 0 : Math.max(0, Math.round(y + height - top));
      setInset((prev) => {
        if (prev === next) return prev;
        if (animation?.duration) {
          LayoutAnimation.configureNext({
            duration: animation.duration,
            update: { duration: animation.duration, type: LayoutAnimation.Types.keyboard },
          });
        }
        return next;
      });
    });
  }, []);

  useEffect(() => {
    if (Platform.OS !== 'ios') return;
    // keyboardWillChangeFrame covers show, hide, and resizes (QuickType bar, a fold or unfold).
    const onFrame = (e: KeyboardEvent) => {
      const { screenY, height } = e.endCoordinates;
      // A frame with no height, or one that ends below the screen, means the keyboard is gone.
      keyboardTop.current = height > 0 ? screenY : null;
      measure({ duration: e.duration });
    };
    const onHide = (e: KeyboardEvent) => {
      keyboardTop.current = null;
      measure({ duration: e.duration });
    };
    const subs = [
      Keyboard.addListener('keyboardWillChangeFrame', onFrame),
      Keyboard.addListener('keyboardWillHide', onHide),
    ];
    return () => subs.forEach((s) => s.remove());
  }, [measure]);

  // The view itself moving (the window resizing on a fold, say) changes the overlap too.
  const onLayout = useCallback(() => measure(), [measure]);

  return { ref, inset, onLayout };
}
