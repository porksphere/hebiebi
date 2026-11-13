import * as Haptics from 'expo-haptics';
import { useRef, useState, type ReactNode } from 'react';
import { Animated, Easing, Pressable, StyleSheet, View } from 'react-native';

const HOLD_MS = 800;
const RING_SIZE = 220;

/**
 * Press and hold to undo, deliberately slow: a disc swells behind the content while you hold, and
 * at the end it pops and the undo happens. Let go early and it all springs back. Does nothing
 * (and shows nothing) while `enabled` is false.
 */
export function HoldToUndo({
  enabled,
  onUndo,
  ringColor,
  children,
}: {
  enabled: boolean;
  onUndo: () => void;
  ringColor: string;
  children: ReactNode;
}) {
  // useState, not useRef: the values are read while rendering (in styles).
  /** The hold, 0 → 1: drives the content's swell. */
  const [progress] = useState(() => new Animated.Value(0));
  /** The disc behind: follows the hold, but stays big through the pop instead of springing back. */
  const [ring] = useState(() => new Animated.Value(0));
  const [pop] = useState(() => new Animated.Value(0));
  /** Set once the hold completes, so letting go doesn't interrupt the pop. */
  const popped = useRef(false);

  function begin() {
    if (!enabled) return;
    Haptics.selectionAsync();
    popped.current = false;
    pop.setValue(0);
    // Slow to start, so a brush past doesn't look like anything.
    const hold = { toValue: 1, duration: HOLD_MS, easing: Easing.in(Easing.quad), useNativeDriver: true };
    Animated.parallel([Animated.timing(progress, hold), Animated.timing(ring, hold)]).start(({ finished }) => {
      if (!finished) return;
      popped.current = true;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      onUndo();
      Animated.parallel([
        Animated.timing(pop, { toValue: 1, duration: 220, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.spring(progress, { toValue: 0, useNativeDriver: true, speed: 14, bounciness: 10 }),
      ]).start(() => {
        ring.setValue(0);
        pop.setValue(0);
      });
    });
  }

  function cancel() {
    if (popped.current) return;
    progress.stopAnimation();
    ring.stopAnimation();
    Animated.parallel([
      Animated.spring(progress, { toValue: 0, useNativeDriver: true, speed: 20 }),
      Animated.spring(ring, { toValue: 0, useNativeDriver: true, speed: 20 }),
    ]).start();
  }

  // The disc grows with the hold, then on the pop flies out a little further as it fades.
  const ringScale = Animated.add(
    ring.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] }),
    pop.interpolate({ inputRange: [0, 1], outputRange: [0, 0.35] }),
  );
  const ringOpacity = Animated.multiply(
    ring.interpolate({ inputRange: [0, 0.1, 1], outputRange: [0, 0.5, 1] }),
    pop.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }),
  );
  const contentScale = progress.interpolate({ inputRange: [0, 1], outputRange: [1, 1.18] });

  return (
    <Pressable
      onPressIn={begin}
      onPressOut={cancel}
      disabled={!enabled}
      accessibilityActions={enabled ? [{ name: 'undo', label: 'Undo answer' }] : undefined}
      onAccessibilityAction={(e) => e.nativeEvent.actionName === 'undo' && onUndo()}
      style={styles.root}>
      <View style={styles.center} pointerEvents="none">
        <Animated.View
          style={[
            styles.ring,
            { backgroundColor: ringColor, opacity: ringOpacity, transform: [{ scale: ringScale }] },
          ]}
        />
      </View>
      <Animated.View style={{ transform: [{ scale: contentScale }] }}>{children}</Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { alignItems: 'center', justifyContent: 'center' },
  center: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  ring: { width: RING_SIZE, height: RING_SIZE, borderRadius: RING_SIZE / 2 },
});
