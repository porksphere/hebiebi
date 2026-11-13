import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { ReviewItem, SessionState } from '@/lib/review/session';
import { sessionStats } from '@/lib/review/session';
import { stageName } from '@/lib/srs';
import { spacing, useTheme } from '@/theme';

import { SubjectCharacters } from '@/components/subject/subject-characters';

export function SessionSummary({
  state,
  endingStages,
  unsent,
  onRetrySync,
  onDone,
}: {
  state: SessionState;
  endingStages: Record<number, number>;
  unsent: number;
  onRetrySync: () => void;
  onDone: () => void;
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const stats = sessionStats(state);
  const done = state.completed.map((id) => state.items[id]);
  const wrong = done.filter((i) => i.incorrectMeaning + i.incorrectReading > 0);
  const right = done.filter((i) => i.incorrectMeaning + i.incorrectReading === 0);

  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.content}>
        <Text style={[styles.big, { color: theme.text }]}>{stats.accuracy ?? 0}%</Text>
        <Text style={[styles.caption, { color: theme.textSecondary }]}>
          {stats.correctFirstTry} of {stats.completed} right first time
          {stats.remaining ? ` · ${stats.remaining} left for later` : ''}
        </Text>

        {unsent > 0 ? (
          <Pressable onPress={onRetrySync} style={[styles.banner, { borderColor: theme.incorrect }]}>
            <Text style={{ color: theme.text, fontSize: 15 }}>
              {unsent} {unsent === 1 ? 'review is' : 'reviews are'} saved on this phone but not sent yet. Tap to retry
              — they’ll also go out next time you open the app.
            </Text>
          </Pressable>
        ) : null}

        {wrong.length ? <Group title={`Answered wrong · ${wrong.length}`} items={wrong} endingStages={endingStages} /> : null}
        {right.length ? <Group title={`Answered right · ${right.length}`} items={right} endingStages={endingStages} /> : null}
      </ScrollView>
      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md, borderTopColor: theme.border }]}>
        <Pressable
          onPress={onDone}
          style={({ pressed }) => [styles.done, { backgroundColor: theme.inverseBackground, opacity: pressed ? 0.8 : 1 }]}>
          <Text style={[styles.doneText, { color: theme.inverseText }]}>Done</Text>
        </Pressable>
      </View>
    </View>
  );
}

function Group({
  title,
  items,
  endingStages,
}: {
  title: string;
  items: ReviewItem[];
  endingStages: Record<number, number>;
}) {
  const theme = useTheme();
  return (
    <View style={styles.group}>
      <Text style={[styles.groupTitle, { color: theme.textSecondary }]}>{title}</Text>
      <View style={styles.grid}>
        {items.map((item) => {
          const end = endingStages[item.assignmentId];
          const up = end !== undefined && end > item.srsStage;
          return (
            <Pressable
              key={item.assignmentId}
              onPress={() => router.push({ pathname: '/subject/[id]', params: { id: String(item.subject.id) } })}
              style={({ pressed }) => [styles.cell, { backgroundColor: theme.surface, opacity: pressed ? 0.6 : 1 }]}>
              <SubjectCharacters subject={item.subject} color={theme.text} size={30} />
              <Text style={[styles.cellMeaning, { color: theme.textSecondary }]} numberOfLines={1}>
                {item.subject.data.meanings.find((m) => m.primary)?.meaning}
              </Text>
              {end !== undefined ? (
                <Text style={[styles.cellStage, { color: up ? theme.correct : theme.incorrect }]} numberOfLines={1}>
                  {up ? '↑' : '↓'} {stageName(end)}
                </Text>
              ) : null}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { padding: spacing.md, gap: spacing.lg, paddingTop: spacing.xl },
  big: { fontSize: 64, fontWeight: '700', textAlign: 'center', letterSpacing: -2 },
  caption: { fontSize: 15, textAlign: 'center', marginTop: -spacing.md },
  banner: { borderWidth: 1, borderRadius: 14, padding: spacing.md },
  group: { gap: spacing.sm },
  groupTitle: { fontSize: 13, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  cell: { width: '31.5%', borderRadius: 14, padding: spacing.sm, alignItems: 'center', gap: 2 },
  cellMeaning: { fontSize: 12 },
  cellStage: { fontSize: 11, fontWeight: '600' },
  footer: { paddingHorizontal: spacing.md, paddingTop: spacing.md, borderTopWidth: StyleSheet.hairlineWidth },
  done: { borderRadius: 999, paddingVertical: 15, alignItems: 'center' },
  doneText: { fontSize: 17, fontWeight: '600' },
});
