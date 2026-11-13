// The small celebration when an item is done (meaning and reading both right). Neither holds
// anything up: the shine plays while the result is on screen anyway, and the lift plays during the
// switch to the next item, alongside it.

import { useCallback, useEffect, useImperativeHandle, useState, type ReactNode, type Ref } from 'react';
import { AccessibilityInfo, Animated, Easing, StyleSheet, View, type LayoutChangeEvent } from 'react-native';

function reduceMotion() {
  return AccessibilityInfo.isReduceMotionEnabled().catch(() => false);
}

export interface ShineHandle {
  play: () => void;
}

/**
 * A band of light that sweeps once across whatever it's laid over (the answer field). Put it last
 * inside the field's container; it fills it and ignores touches. `radius` matches the field's.
 */
export function Shine({ ref, radius }: { ref: Ref<ShineHandle>; radius: number }) {
  const [x] = useState(() => new Animated.Value(0));
  const [width, setWidth] = useState(0);
  const band = width * 0.45;

  useImperativeHandle(
    ref,
    () => ({
      play: async () => {
        if (!width || (await reduceMotion())) return;
        x.setValue(0);
        Animated.timing(x, {
          toValue: 1,
          duration: 620,
          easing: Easing.bezier(0.4, 0, 0.2, 1),
          useNativeDriver: true,
        }).start(() => x.setValue(0));
      },
    }),
    [width, x],
  );

  return (
    <View
      pointerEvents="none"
      onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}
      style={[StyleSheet.absoluteFill, { borderRadius: radius, overflow: 'hidden' }]}>
      {width ? (
        <Animated.View
          style={[
            styles.band,
            {
              width: band,
              transform: [{ translateX: x.interpolate({ inputRange: [0, 1], outputRange: [-band * 1.2, width + band * 0.2] }) }],
            },
          ]}
        />
      ) : null}
    </View>
  );
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
  band: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    backgroundImage: 'linear-gradient(100deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.55) 50%, rgba(255,255,255,0) 100%)',
  },
  // Centred over the characters by its parent (alignItems/justifyContent: center).
  lift: { position: 'absolute' },
});
