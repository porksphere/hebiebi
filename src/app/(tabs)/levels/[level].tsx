import { Stack, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { kanjiNumber, MINCHO, openSubject, Paper, type PaperState } from '@/components/paper';
import { TypeDot } from '@/components/subject/type-dot';
import { PASSING_STAGE } from '@/lib/srs';
import { useLevelStages, useLevelSubjects } from '@/lib/wanikani/queries';
import type { Subject } from '@/lib/wanikani/types';
import { spacing, useTheme } from '@/theme';

/**
 * A level: its radicals and kanji on practice paper, its vocabulary as ruled rows (words don't fit
 * squares). What you haven't unlocked is blank on the paper and faint in the list.
 */
export default function LevelScreen() {
  const theme = useTheme();
  const level = Number(useLocalSearchParams<{ level: string }>().level);
  const subjects = useLevelSubjects(level);
  const stages = useLevelStages(level);

  // Until your progress loads, everything shows as being learned rather than as blank squares.
  const stateOf = (s: Subject): PaperState => {
    if (!stages.data) return 'learning';
    const stage = stages.data.get(s.id);
    return stage === undefined ? 'locked' : stage >= PASSING_STAGE ? 'passed' : 'learning';
  };
  const of = (...types: Subject['object'][]) =>
    (subjects.data ?? []).filter((s) => types.includes(s.object)).map((subject) => ({ subject, state: stateOf(subject) }));
  const radicals = of('radical');
  const kanji = of('kanji');
  const vocabulary = of('vocabulary', 'kana_vocabulary');
  const all = [...radicals, ...kanji, ...vocabulary];

  return (
    <>
      <Stack.Screen options={{ title: `Level ${level}` }} />
      <ScrollView
        style={{ backgroundColor: theme.background }}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={styles.content}>
        {subjects.data ? (
          <>
            <View style={styles.head}>
              <Text style={[styles.title, { color: theme.text }]} accessibilityLabel={`Level ${level}`}>
                第{kanjiNumber(level)}級
              </Text>
              {stages.data ? (
                <Text style={[styles.count, { color: theme.textSecondary }]}>
                  {all.filter((i) => i.state === 'passed').length} of {all.length} passed
                </Text>
              ) : null}
            </View>

            {radicals.length ? (
              <View style={styles.section}>
                <SectionTitle type="radical" title="Radicals" count={radicals.length} />
                <Paper items={radicals} />
              </View>
            ) : null}

            {kanji.length ? (
              <View style={styles.section}>
                <SectionTitle type="kanji" title="Kanji" count={kanji.length} />
                <Paper items={kanji} />
              </View>
            ) : null}

            {vocabulary.length ? (
              <View>
                <View style={styles.vocabTitle}>
                  <SectionTitle type="vocabulary" title="Vocabulary" count={vocabulary.length} />
                </View>
                {vocabulary.map(({ subject, state }) => {
                  const d = subject.data;
                  const reading = 'readings' in d ? (d.readings.find((r) => r.primary) ?? d.readings[0])?.reading : null;
                  const meaning = d.meanings.find((m) => m.primary)?.meaning ?? '';
                  return (
                    <Pressable
                      key={subject.id}
                      accessibilityRole="button"
                      accessibilityLabel={`${d.characters ?? ''}, ${meaning}${state === 'locked' ? ', locked' : ''}`}
                      onPress={() => openSubject(subject.id)}
                      style={({ pressed }) => [
                        styles.word,
                        { borderTopColor: theme.border, opacity: (pressed ? 0.5 : 1) * (state === 'locked' ? 0.35 : 1) },
                      ]}>
                      <Text style={[styles.wordChars, { color: theme.text }]}>{d.characters}</Text>
                      {reading && reading !== d.characters ? (
                        <Text style={[styles.wordReading, { color: theme.textSecondary }]}>{reading}</Text>
                      ) : null}
                      <Text style={[styles.wordMeaning, { color: theme.textSecondary }]} numberOfLines={1}>
                        {meaning}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            ) : null}
          </>
        ) : subjects.error ? (
          <View style={styles.center}>
            <Text style={[styles.centerText, { color: theme.text }]}>Couldn’t load this level.</Text>
            <Pressable onPress={() => subjects.refetch()} style={[styles.pill, { borderColor: theme.border }]}>
              <Text style={{ color: theme.text, fontSize: 16, fontWeight: '600' }}>Try Again</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.center}>
            <ActivityIndicator color={theme.textSecondary} />
          </View>
        )}
      </ScrollView>
    </>
  );
}

function SectionTitle({ type, title, count }: { type: Subject['object']; title: string; count: number }) {
  const theme = useTheme();
  return (
    <View style={styles.sectionHead}>
      <TypeDot type={type} />
      <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>
        {title} · {count}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.md, gap: spacing.lg, paddingBottom: 120 },
  head: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  title: { fontSize: 28, fontFamily: MINCHO, fontWeight: '600' },
  count: { fontSize: 13, fontVariant: ['tabular-nums'] },
  section: { gap: spacing.sm + 2 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  sectionTitle: { fontSize: 13, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8 },
  vocabTitle: { marginBottom: spacing.sm + 2 },
  word: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.sm + 2,
    paddingVertical: 11,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  wordChars: { fontSize: 19 },
  wordReading: { fontSize: 13 },
  wordMeaning: { fontSize: 13, flex: 1, textAlign: 'right' },
  center: { paddingTop: 120, alignItems: 'center', gap: spacing.md },
  centerText: { fontSize: 17, textAlign: 'center' },
  pill: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 20, paddingVertical: 10 },
});
