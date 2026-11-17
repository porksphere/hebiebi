import { router } from 'expo-router';
import { Pressable, StyleSheet, Text } from 'react-native';

import { Grid } from '@/components/grid';

import type { Subject } from '@/lib/wanikani/types';
import { spacing, useTheme } from '@/theme';

import { SubjectCharacters } from './subject-characters';

interface TileParts {
  /** Off mid-review while the item's reading is still to be asked: a related reading can give it away. */
  showReading?: boolean;
  /** Likewise for the meaning. */
  showMeaning?: boolean;
}

/**
 * A related subject (a component, a lookalike, or something it appears in): tap to open its page.
 * Shows its reading and meaning as WaniKani's tiles do, less whichever part is switched off.
 */
export function SubjectTile({ subject, showReading = true, showMeaning = true }: { subject: Subject } & TileParts) {
  const theme = useTheme();
  const meaning = showMeaning ? (subject.data.meanings.find((m) => m.primary)?.meaning ?? null) : null;
  const readings = 'readings' in subject.data ? subject.data.readings : [];
  const reading = showReading ? (readings.find((r) => r.primary)?.reading ?? null) : null;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={[subject.data.characters, reading, meaning].filter(Boolean).join(', ')}
      onPress={() => router.push({ pathname: '/subject/[id]', params: { id: String(subject.id) } })}
      style={({ pressed }) => [
        styles.tile,
        { backgroundColor: theme.surface, opacity: pressed ? 0.6 : 1 },
      ]}>
      <SubjectCharacters subject={subject} color={theme.text} size={30} />
      {reading ? (
        <Text style={[styles.reading, { color: theme.textSecondary }]} numberOfLines={1} adjustsFontSizeToFit>
          {reading}
        </Text>
      ) : null}
      {meaning ? (
        <Text style={[styles.meaning, { color: theme.text }]} numberOfLines={1}>
          {meaning}
        </Text>
      ) : null}
    </Pressable>
  );
}

export function SubjectTileGrid({ subjects, ...parts }: { subjects: Subject[] } & TileParts) {
  return (
    <Grid columns={4}>
      {subjects.map((s) => (
        <SubjectTile key={s.id} subject={s} {...parts} />
      ))}
    </Grid>
  );
}

const styles = StyleSheet.create({
  tile: {
    minHeight: 76,
    borderRadius: 14,
    paddingVertical: spacing.sm,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  reading: { fontSize: 11 },
  meaning: { fontSize: 11, fontWeight: '500' },
});
