import { router } from 'expo-router';
import { NativeTabs } from 'expo-router/native-tabs';
import { SymbolView } from 'expo-symbols';
import { PlatformColor, Pressable, StyleSheet, Text, View } from 'react-native';

import { confirmEndSession } from '@/components/review/end-session';
import { sessionStats } from '@/lib/review/session';
import { useReviewSession } from '@/lib/review/use-review-session';
import { spacing } from '@/theme';

/**
 * A minimised review session, in the tab bar's bottom accessory (iOS 26+), the way a music app
 * shows what's playing: tap to go back in, ✕ to end it. The system draws the glass; the label
 * colours are the system's own so they read on it in light and dark.
 *
 * Rendered twice by the system (regular and inline placements), so no local state.
 */
export function SessionAccessory() {
  const session = useReviewSession();
  const placement = NativeTabs.BottomAccessory.usePlacement();
  const stats = session.state ? sessionStats(session.state) : null;

  const detail = !stats
    ? 'Loading…'
    : session.state?.wrappingUp
      ? `Wrapping up · ${stats.remaining} left`
      : `${stats.remaining} left`;

  return (
    <View style={styles.row}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Resume reviews, ${detail}`}
        onPress={() => router.push('/review')}
        style={({ pressed }) => [styles.main, { opacity: pressed ? 0.5 : 1 }]}>
        <Text style={styles.title} numberOfLines={1}>
          Reviews <Text style={styles.detail}>{detail}</Text>
        </Text>
      </Pressable>
      {/* Inline (beside a collapsed tab bar) is too cramped for a destructive button. */}
      {placement === 'regular' ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="End session"
          hitSlop={10}
          onPress={() => confirmEndSession(session)}
          style={({ pressed }) => [styles.end, { opacity: pressed ? 0.5 : 1 }]}>
          <SymbolView name="xmark" size={15} weight="semibold" tintColor={PlatformColor('label')} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flex: 1, flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, gap: spacing.sm },
  main: { flex: 1, justifyContent: 'center', alignSelf: 'stretch' },
  title: { fontSize: 15, fontWeight: '600', color: PlatformColor('label') },
  detail: { fontWeight: '400', color: PlatformColor('secondaryLabel') },
  end: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
});
