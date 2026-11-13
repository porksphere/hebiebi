// Shows the toast from lib/toast.ts (`showToast` from anywhere). One <Toaster /> at the root.
//
// On iOS it sits in react-native-screens' FullWindowOverlay, a window above everything, because
// the review screen and item sheets are native modals that would otherwise cover it. The overlay
// is only mounted while a toast shows; outside the toast itself, touches pass through.

import { SymbolView } from 'expo-symbols';
import { useEffect, useState, type ReactNode } from 'react';
import { Animated, Easing, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { FullWindowOverlay } from 'react-native-screens';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { dismissToast, useToast, type Toast } from '@/lib/toast';
import { spacing, useGutters, useTheme } from '@/theme';

const VISIBLE_MS = 4000;

export function Toaster() {
  const toast = useToast();
  if (!toast) return null;
  const card = <ToastCard key={toast.id} toast={toast} />;
  return Platform.OS === 'ios' ? <FullWindowOverlay>{card}</FullWindowOverlay> : <Overlay>{card}</Overlay>;
}

function Overlay({ children }: { children: ReactNode }) {
  return (
    <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
      {children}
    </View>
  );
}

function ToastCard({ toast }: { toast: Toast }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const gutters = useGutters();
  const [t] = useState(() => new Animated.Value(0));

  useEffect(() => {
    Animated.timing(t, { toValue: 1, duration: 220, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
    const timer = setTimeout(() => {
      Animated.timing(t, { toValue: 0, duration: 180, easing: Easing.in(Easing.cubic), useNativeDriver: true }).start(
        () => dismissToast(toast.id),
      );
    }, VISIBLE_MS);
    return () => clearTimeout(timer);
  }, [t, toast.id]);

  return (
    <View pointerEvents="box-none" style={[styles.anchor, { top: insets.top + spacing.sm, left: gutters.left, right: gutters.right }]}>
      <Animated.View
        style={{
          opacity: t,
          transform: [{ translateY: t.interpolate({ inputRange: [0, 1], outputRange: [-16, 0] }) }],
        }}>
        <Pressable
          accessibilityRole="alert"
          accessibilityLabel={toast.detail ? `${toast.title}. ${toast.detail}` : toast.title}
          accessibilityHint="Tap to dismiss"
          onPress={() => dismissToast(toast.id)}
          style={[styles.card, { backgroundColor: theme.inverseBackground }]}>
          <SymbolView name="exclamationmark.triangle.fill" size={16} tintColor={theme.inverseText} />
          <View style={styles.text}>
            <Text style={[styles.title, { color: theme.inverseText }]} numberOfLines={2}>
              {toast.title}
            </Text>
            {toast.detail ? (
              <Text style={[styles.detail, { color: theme.inverseText }]} numberOfLines={2}>
                {toast.detail}
              </Text>
            ) : null}
          </View>
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  anchor: { position: 'absolute', alignItems: 'center' },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm + 2,
    paddingVertical: 12,
    paddingHorizontal: spacing.md,
    borderRadius: 18,
    maxWidth: 440,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
  },
  text: { flexShrink: 1, gap: 1 },
  title: { fontSize: 15, fontWeight: '600' },
  detail: { fontSize: 13, opacity: 0.7 },
});
