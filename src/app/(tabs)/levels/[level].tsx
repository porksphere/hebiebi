import { Stack, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { SubjectTileGrid } from '@/components/subject/subject-tile';
import { useLevelStages, useLevelSubjects } from '@/lib/wanikani/queries';
import type { Subject } from '@/lib/wanikani/types';
import { spacing, useTheme } from '@/theme';

const SECTIONS: { title: string; types: Subject['object'][] }[] = [
  { title: 'Radicals', types: ['radical'] },
  { title: 'Kanji', types: ['kanji'] },
  { title: 'Vocabulary', types: ['vocabulary', 'kana_vocabulary'] },
];

/** A level's radicals, kanji and vocabulary. Ones you haven't unlocked yet are faded. */
export default function LevelScreen() {
  const theme = useTheme();
  const level = Number(useLocalSearchParams<{ level: string }>().level);
  const subjects = useLevelSubjects(level);
  const stages = useLevelStages(level);

  return (
    <>
      <Stack.Screen options={{ title: `Level ${level}` }} />
      <ScrollView
        style={{ backgroundColor: theme.background }}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={styles.content}>
        {subjects.data ? (
          SECTIONS.map(({ title, types }) => {
            const items = subjects.data.filter((s) => types.includes(s.object));
            if (!items.length) return null;
            return (
              <View key={title} style={styles.section}>
                <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>
                  {title} · {items.length}
                </Text>
                <SubjectTileGrid
                  subjects={items}
                  // Until your progress loads, nothing is faded rather than everything.
                  faded={stages.data ? (s) => !stages.data.has(s.id) : undefined}
                />
              </View>
            );
          })
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

const styles = StyleSheet.create({
  content: { padding: spacing.md, gap: spacing.lg, paddingBottom: 120 },
  section: { gap: spacing.sm },
  sectionTitle: { fontSize: 13, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8 },
  center: { paddingTop: 120, alignItems: 'center', gap: spacing.md },
  centerText: { fontSize: 17, textAlign: 'center' },
  pill: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 20, paddingVertical: 10 },
});
