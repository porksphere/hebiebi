import { useRef, useState, type ComponentRef } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { kanjiNumber, MINCHO, openSubject, Paper, type PaperState } from '@/components/paper';
import { TypeDot } from '@/components/subject/type-dot';
import { PASSING_STAGE } from '@/lib/srs';
import { useLevelStages, useLevelSubjects, useUser } from '@/lib/wanikani/queries';
import type { Subject } from '@/lib/wanikani/types';
import { spacing, useGutters, useTheme } from '@/theme';

const LEVELS = Array.from({ length: 60 }, (_, i) => i + 1);

/**
 * No list of levels: the tab opens on your level, and a strip of numbers along the top slides
 * sideways to pick another. The chosen one is set large, in kanji.
 */
export default function LevelsScreen() {
  const theme = useTheme();
  const gutters = useGutters();
  const { data: user } = useUser();
  const current = user?.level ?? 1;
  const maxGranted = user?.subscription.max_level_granted ?? 60;
  // Yours until you pick another.
  const [chosen, setChosen] = useState<number | null>(null);
  const level = chosen ?? current;

  const strip = useRef<ComponentRef<typeof ScrollView>>(null);
  const stripWidth = useRef(0);

  return (
    <ScrollView
      style={{ backgroundColor: theme.background }}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={[styles.content, gutters.padding]}>
      <ScrollView
        ref={strip}
        horizontal
        showsHorizontalScrollIndicator={false}
        onLayout={(e) => (stripWidth.current = e.nativeEvent.layout.width)}
        // Scrolls sideways, so it runs under anything at the screen's sides; its ends are padded
        // so the first and last numbers can still be pulled clear.
        style={[styles.strip, { borderBottomColor: theme.border, marginLeft: -gutters.left, marginRight: -gutters.right }]}
        contentContainerStyle={[
          styles.stripContent,
          { paddingLeft: gutters.insetLeft + spacing.sm, paddingRight: gutters.insetRight + spacing.sm },
        ]}>
        {LEVELS.map((n) => {
          const selected = n === level;
          return (
            <Pressable
              key={n}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              accessibilityLabel={`Level ${n}${n === current ? ', your level' : ''}`}
              onPress={() => setChosen(n)}
              // The chosen number grows, which moves it; whenever it lands somewhere new, centre it.
              onLayout={
                selected
                  ? (e) => {
                      const { x, width } = e.nativeEvent.layout;
                      strip.current?.scrollTo({ x: Math.max(0, x + width / 2 - stripWidth.current / 2) });
                    }
                  : undefined
              }
              style={({ pressed }) => [styles.stripItem, pressed && { opacity: 0.5 }]}>
              {selected ? (
                <Text style={[styles.stripChosen, { color: theme.text }]}>{kanjiNumber(n)}</Text>
              ) : (
                <Text
                  style={[
                    styles.stripNumber,
                    { color: theme.text },
                    // Ahead of you: faint. Past what the subscription covers: fainter still.
                    n > current && { fontWeight: '500', opacity: n > maxGranted ? 0.14 : 0.3 },
                  ]}>
                  {n}
                </Text>
              )}
            </Pressable>
          );
        })}
      </ScrollView>

      <Level key={level} level={level} />
    </ScrollView>
  );
}

/**
 * A level: its radicals and kanji on practice paper, its vocabulary as ruled rows (words don't fit
 * squares). What you haven't unlocked is blank on the paper and faint in the list.
 */
function Level({ level }: { level: number }) {
  const theme = useTheme();
  const gutters = useGutters();
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

  if (!subjects.data) {
    return subjects.error ? (
      <View style={styles.center}>
        <Text style={[styles.centerText, { color: theme.text }]}>Couldn’t load level {level}.</Text>
        <Pressable onPress={() => subjects.refetch()} style={[styles.pill, { borderColor: theme.border }]}>
          <Text style={{ color: theme.text, fontSize: 16, fontWeight: '600' }}>Try Again</Text>
        </Pressable>
      </View>
    ) : (
      <View style={styles.center}>
        <ActivityIndicator color={theme.textSecondary} />
      </View>
    );
  }

  return (
    <>
      <View style={styles.head}>
        <Text style={[styles.title, { color: theme.text }]}>Level {level}</Text>
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
                // The rule keeps its full strength (only the words fade) and, like a native list's,
                // runs on to the trailing edge of the screen.
                style={[styles.wordRule, { borderTopColor: theme.border, marginRight: -gutters.right }]}>
                {({ pressed }) => (
                  <View
                    style={[
                      styles.word,
                      { paddingRight: gutters.right, opacity: (pressed ? 0.5 : 1) * (state === 'locked' ? 0.35 : 1) },
                    ]}>
                    <Text style={[styles.wordChars, { color: theme.text }]}>{d.characters}</Text>
                    {reading && reading !== d.characters ? (
                      <Text style={[styles.wordReading, { color: theme.textSecondary }]}>{reading}</Text>
                    ) : null}
                    <Text style={[styles.wordMeaning, { color: theme.textSecondary }]} numberOfLines={1}>
                      {meaning}
                    </Text>
                  </View>
                )}
              </Pressable>
            );
          })}
        </View>
      ) : null}
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

  // Runs edge to edge, past the page's side padding.
  strip: { borderBottomWidth: StyleSheet.hairlineWidth, flexGrow: 0 },
  stripContent: { alignItems: 'flex-end', paddingBottom: spacing.sm + 4 },
  stripItem: { minWidth: 44, minHeight: 52, paddingHorizontal: 6, alignItems: 'center', justifyContent: 'flex-end' },
  stripNumber: { fontSize: 17, fontWeight: '600', fontVariant: ['tabular-nums'], paddingBottom: 5 },
  stripChosen: { fontSize: 40, lineHeight: 46, fontFamily: MINCHO, fontWeight: '600', paddingHorizontal: 6 },

  head: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  title: { fontSize: 20, fontWeight: '700' },
  count: { fontSize: 13, fontVariant: ['tabular-nums'] },
  section: { gap: spacing.sm + 2 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  sectionTitle: { fontSize: 13, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8 },
  vocabTitle: { marginBottom: spacing.sm + 2 },
  wordRule: { borderTopWidth: StyleSheet.hairlineWidth },
  word: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm + 2, paddingVertical: 11 },
  wordChars: { fontSize: 19 },
  wordReading: { fontSize: 13 },
  wordMeaning: { fontSize: 13, flex: 1, textAlign: 'right' },
  center: { paddingTop: 80, alignItems: 'center', gap: spacing.md },
  centerText: { fontSize: 17, textAlign: 'center' },
  pill: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 20, paddingVertical: 10 },
});
