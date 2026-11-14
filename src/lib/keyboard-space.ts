// The room the review screen keeps for the keyboard, so its layout never slides when the keyboard
// comes and goes (opening Item Info hides it, closing it brings it back).
//
// iOS doesn't say how tall the keyboard will be before it opens, so it's learned: every time the
// keyboard shows, its height is noted against the window's size (each fold, orientation and
// device size is its own entry) and kept on the phone. The screen then reserves the tallest seen
// for that size from its first frame. Only the first time in a new window size, or when a taller
// keyboard turns up (switching to the Japanese keyboard, say), does it move, once.

import { File, Paths } from 'expo-file-system';
import { useEffect, useState } from 'react';
import { Dimensions, Keyboard, LayoutAnimation, useWindowDimensions, type KeyboardEvent } from 'react-native';

// v2: v1 could learn a wrong height mid-rotation, so its entries are dropped.
const file = new File(Paths.document, 'keyboard-heights-v2.json');

let heights: Record<string, number> = {};
try {
  if (file.exists) heights = JSON.parse(file.textSync()) as Record<string, number>;
} catch {
  heights = {};
}

function keyFor(width: number, height: number) {
  return `${Math.round(width)}x${Math.round(height)}`;
}

/** The keyboard height to keep clear at the bottom of the window, in points (0 until first seen). */
export function useKeyboardSpace() {
  const window = useWindowDimensions();
  const key = keyFor(window.width, window.height);
  const [learned, setLearned] = useState(heights);

  useEffect(() => {
    function onShow(e: KeyboardEvent) {
      const now = Dimensions.get('window');
      const k = keyFor(now.width, now.height);
      const { screenY, height: frameHeight, width: frameWidth } = e.endCoordinates;
      const height = Math.round(frameHeight);
      // Only learn from a keyboard docked across the bottom of this window. Mid-rotation the
      // window and keyboard sizes briefly disagree; a floating or split keyboard, or a hardware
      // keyboard's bar, doesn't fill the bottom. None of those say anything about the docked one.
      const docked =
        Math.abs(screenY + frameHeight - now.height) <= 2 && frameWidth >= now.width - 2 && height >= 150;
      // And never more than 60% of the window: anything bigger is a bad reading, not a keyboard.
      const plausible = height <= now.height * 0.6;
      if (__DEV__) {
        console.log(
          `[keyboard] window ${k}, frame y ${Math.round(screenY)} h ${height} w ${Math.round(frameWidth)}` +
            ` → ${docked && plausible ? `ok (known ${heights[k] ?? 'none'})` : 'ignored'}`,
        );
      }
      if (!docked || !plausible || height <= (heights[k] ?? 0)) return;
      if (e.duration) {
        LayoutAnimation.configureNext({
          duration: e.duration,
          update: { type: LayoutAnimation.Types.keyboard },
        });
      }
      heights = { ...heights, [k]: height };
      setLearned(heights);
      Promise.resolve(file.write(JSON.stringify(heights))).catch(() => {});
    }
    const subs = [Keyboard.addListener('keyboardWillShow', onShow), Keyboard.addListener('keyboardWillChangeFrame', onShow)];
    return () => subs.forEach((s) => s.remove());
  }, []);

  // Never reserve more than the keyboard could take of this window, whatever was saved.
  return Math.min(learned[key] ?? 0, Math.round(window.height * 0.6));
}
