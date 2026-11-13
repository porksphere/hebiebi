import { Pressable, StyleSheet, Text, View } from 'react-native';

import { SRS_GROUPS, type SrsGroup } from '@/lib/srs';
import type { Summary } from '@/lib/wanikani/types';
import { spacing, useTheme } from '@/theme';

// --- Review hero ------------------------------------------------------------------------------

export function ReviewHero({
  count,
  nextReviewsAt,
  onStart,
  loading,
}: {
  count: number;
  nextReviewsAt: string | null;
  onStart: () => void;
  loading?: boolean;
}) {
  const theme = useTheme();
  const has = count > 0;
  return (
    <View style={[styles.hero, { backgroundColor: theme.inverseBackground }]}>
      <Text style={[styles.heroLabel, { color: theme.inverseText }]}>Reviews</Text>
      <Text style={[styles.heroCount, { color: theme.inverseText }]}>{loading ? '–' : count}</Text>
      <Text style={[styles.heroCaption, { color: theme.inverseText }]}>
        {loading
          ? 'Checking WaniKani…'
          : has
            ? count === 1
              ? 'item is waiting for you'
              : 'items are waiting for you'
            : nextReviewsAt
              ? `Next reviews ${formatWhen(nextReviewsAt)}`
              : 'Nothing scheduled'}
      </Text>
      <Pressable
        accessibilityRole="button"
        disabled={!has}
        onPress={onStart}
        style={({ pressed }) => [
          styles.heroButton,
          { backgroundColor: theme.background, opacity: !has ? 0.35 : pressed ? 0.75 : 1 },
        ]}>
        <Text style={[styles.heroButtonText, { color: theme.text }]}>Start Reviews</Text>
      </Pressable>
    </View>
  );
}

// --- Stat tiles -------------------------------------------------------------------------------

export function StatTile({ label, value, caption }: { label: string; value: string; caption?: string }) {
  const theme = useTheme();
  return (
    <View style={[styles.tile, { backgroundColor: theme.surface }]}>
      <Text style={[styles.tileLabel, { color: theme.textSecondary }]}>{label}</Text>
      <Text style={[styles.tileValue, { color: theme.text }]}>{value}</Text>
      {caption ? <Text style={[styles.tileCaption, { color: theme.textSecondary }]}>{caption}</Text> : null}
    </View>
  );
}

// --- Level progress ---------------------------------------------------------------------------

export function LevelProgress({
  level,
  passed,
  total,
  required,
}: {
  level: number;
  passed: number;
  total: number;
  required: number;
}) {
  const theme = useTheme();
  const fraction = total ? Math.min(1, passed / total) : 0;
  const marker = total ? required / total : 0.9;
  const toGo = Math.max(0, required - passed);
  return (
    <Card title={`Level ${level}`} trailing={`${passed} / ${total} kanji`}>
      <View style={[styles.track, { backgroundColor: theme.surfaceStrong }]}>
        <View style={[styles.fill, { backgroundColor: theme.text, width: `${fraction * 100}%` }]} />
        <View style={[styles.marker, { left: `${marker * 100}%`, backgroundColor: theme.textSecondary }]} />
      </View>
      <Text style={[styles.caption, { color: theme.textSecondary }]}>
        {toGo === 0 ? 'Enough kanji passed to level up.' : `Pass ${toGo} more kanji to reach level ${level + 1}.`}
      </Text>
    </Card>
  );
}

// --- Forecast ---------------------------------------------------------------------------------

export function Forecast({ summary }: { summary: Summary }) {
  const theme = useTheme();
  // The first bucket is "available now"; the rest are the coming hours.
  const hours = summary.reviews.slice(1, 25).map((r) => ({
    at: new Date(r.available_at),
    count: r.subject_ids.length,
  }));
  const max = Math.max(1, ...hours.map((h) => h.count));
  const total = hours.reduce((n, h) => n + h.count, 0);
  return (
    <Card title="Next 24 hours" trailing={`${total} ${total === 1 ? 'review' : 'reviews'}`}>
      <View style={styles.bars} accessibilityLabel={`${total} reviews in the next 24 hours`}>
        {hours.map((h, i) => (
          <View key={i} style={styles.barSlot}>
            <View
              style={[
                styles.bar,
                {
                  height: h.count ? Math.max(3, (h.count / max) * 72) : 2,
                  backgroundColor: h.count ? theme.text : theme.surfaceStrong,
                },
              ]}
            />
          </View>
        ))}
      </View>
      <View style={styles.barLabels}>
        {[0, 6, 12, 18].map((i) =>
          hours[i] ? (
            <Text key={i} style={[styles.barLabel, { color: theme.textSecondary }]}>
              {hours[i].at.toLocaleTimeString([], { hour: 'numeric' })}
            </Text>
          ) : null,
        )}
      </View>
    </Card>
  );
}

// --- SRS breakdown ----------------------------------------------------------------------------

export function SrsBreakdown({ counts }: { counts: Record<SrsGroup, number> }) {
  const theme = useTheme();
  return (
    <Card title="Items">
      <View style={styles.srsRow}>
        {SRS_GROUPS.map((g, i) => (
          <View key={g.key} style={styles.srsCell}>
            <Text style={[styles.srsValue, { color: theme.text, opacity: 1 - i * 0.13 }]}>{counts[g.key]}</Text>
            <Text style={[styles.srsLabel, { color: theme.textSecondary }]} numberOfLines={1}>
              {g.label}
            </Text>
          </View>
        ))}
      </View>
    </Card>
  );
}

// --- Shared -----------------------------------------------------------------------------------

export function Card({
  title,
  trailing,
  children,
}: {
  title: string;
  trailing?: string;
  children: React.ReactNode;
}) {
  const theme = useTheme();
  return (
    <View style={[styles.card, { backgroundColor: theme.surface }]}>
      <View style={styles.cardHeader}>
        <Text style={[styles.cardTitle, { color: theme.text }]}>{title}</Text>
        {trailing ? <Text style={[styles.cardTrailing, { color: theme.textSecondary }]}>{trailing}</Text> : null}
      </View>
      {children}
    </View>
  );
}

export function formatWhen(iso: string) {
  const date = new Date(iso);
  const now = new Date();
  const time = date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  const sameDay = date.toDateString() === now.toDateString();
  if (sameDay) return `at ${time}`;
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  if (date.toDateString() === tomorrow.toDateString()) return `tomorrow at ${time}`;
  return `on ${date.toLocaleDateString([], { weekday: 'long' })} at ${time}`;
}

const styles = StyleSheet.create({
  hero: { borderRadius: 28, padding: spacing.lg, gap: 2 },
  heroLabel: { fontSize: 15, fontWeight: '600', opacity: 0.7, textTransform: 'uppercase', letterSpacing: 1 },
  heroCount: { fontSize: 72, fontWeight: '700', letterSpacing: -2, fontVariant: ['tabular-nums'] },
  heroCaption: { fontSize: 15, opacity: 0.7, marginBottom: spacing.md },
  heroButton: { borderRadius: 999, paddingVertical: 15, alignItems: 'center' },
  heroButtonText: { fontSize: 17, fontWeight: '600' },

  tile: { flex: 1, borderRadius: 20, padding: spacing.md, gap: 2 },
  tileLabel: { fontSize: 13, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.6 },
  tileValue: { fontSize: 34, fontWeight: '700', fontVariant: ['tabular-nums'] },
  tileCaption: { fontSize: 13 },

  card: { borderRadius: 20, padding: spacing.md, gap: spacing.sm + 4 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  cardTitle: { fontSize: 17, fontWeight: '600' },
  cardTrailing: { fontSize: 15, fontVariant: ['tabular-nums'] },
  caption: { fontSize: 13 },

  track: { height: 10, borderRadius: 5, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 5 },
  marker: { position: 'absolute', top: 0, bottom: 0, width: 2 },

  bars: { flexDirection: 'row', alignItems: 'flex-end', height: 76, gap: 3 },
  barSlot: { flex: 1, justifyContent: 'flex-end' },
  bar: { borderRadius: 2 },
  barLabels: { flexDirection: 'row', justifyContent: 'space-between', marginRight: '25%' },
  barLabel: { fontSize: 11, fontVariant: ['tabular-nums'] },

  srsRow: { flexDirection: 'row' },
  srsCell: { flex: 1, alignItems: 'center', gap: 2 },
  srsValue: { fontSize: 22, fontWeight: '700', fontVariant: ['tabular-nums'] },
  srsLabel: { fontSize: 11 },
});
