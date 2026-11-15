// The small celebration when an item is done (meaning and reading both right): its characters lift
// away during the switch to the next item, alongside it, so it holds nothing up.

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { AccessibilityInfo, Animated, Easing, StyleSheet } from 'react-native';

function reduceMotion() {
  return AccessibilityInfo.isReduceMotionEnabled().catch(() => false);
}

/**
 * The finished item's characters, floating up and fading out over the next item's as it arrives.
 * Mount it for one item (keyed), positioned over the characters; it calls `onDone` when it's gone.
 */
export function LiftAway({ children, onDone }: { children: ReactNode; onDone: () => void }) {
  const [t] = useState(() => new Animated.Value(0));
  useEffect(() => {
    let cancelled = false;
    reduceMotion().then((reduce) => {
      if (cancelled) return;
      if (reduce) return onDone();
      Animated.timing(t, {
        toValue: 1,
        duration: 420,
        easing: Easing.bezier(0.3, 0.6, 0.3, 1),
        useNativeDriver: true,
      }).start(() => onDone());
    });
    return () => {
      cancelled = true;
    };
  }, [t, onDone]);

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.lift,
        {
          opacity: t.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }),
          transform: [
            { translateY: t.interpolate({ inputRange: [0, 1], outputRange: [0, -46] }) },
            { scale: t.interpolate({ inputRange: [0, 1], outputRange: [1, 0.9] }) },
          ],
        },
      ]}>
      {children}
    </Animated.View>
  );
}

/**
 * The next item's characters easing in under a LiftAway. Call `play` (stable) from a layout effect
 * once the next item has rendered, so neither the old nor the new characters flash.
 */
export function useArrive() {
  const [t] = useState(() => new Animated.Value(1));
  const play = useCallback(() => {
    t.setValue(0);
    Animated.timing(t, { toValue: 1, duration: 260, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
  }, [t]);
  const style = {
    opacity: t,
    transform: [{ translateY: t.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }],
  };
  return { play, style };
}

const styles = StyleSheet.create({
  // Centred over the characters by its parent (alignItems/justifyContent: center).
  lift: { position: 'absolute' },
});
