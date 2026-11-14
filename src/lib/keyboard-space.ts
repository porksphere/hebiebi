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

const file = new File(Paths.document, 'keyboard-heights.json');

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
      // How far the keyboard reaches up from the bottom of the window.
      const height = Math.max(0, Math.round(now.height - e.endCoordinates.screenY));
      // A small one is a hardware keyboard's bar or a floating keyboard: nothing to learn from.
      if (height < 150 || height <= (heights[k] ?? 0)) return;
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

  return learned[key] ?? 0;
}
