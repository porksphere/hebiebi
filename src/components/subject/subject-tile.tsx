import { router } from 'expo-router';
import { Pressable, StyleSheet, Text } from 'react-native';

import { Grid } from '@/components/grid';

import type { Subject } from '@/lib/wanikani/types';
import { spacing, useTheme } from '@/theme';

import { SubjectCharacters } from './subject-characters';

/**
 * A related subject (a component, or something it appears in): tap to open its page. Shows its
 * reading as WaniKani's tiles do, unless `showReading` is off (mid-review, when a component's
 * reading could give the answer away).
 */
export function SubjectTile({ subject, showReading = true }: { subject: Subject; showReading?: boolean }) {
  const theme = useTheme();
  const meaning = subject.data.meanings.find((m) => m.primary)?.meaning ?? '';
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
      <Text style={[styles.meaning, { color: theme.text }]} numberOfLines={1}>
        {meaning}
      </Text>
    </Pressable>
  );
}

export function SubjectTileGrid({ subjects, showReading = true }: { subjects: Subject[]; showReading?: boolean }) {
  return (
    <Grid columns={4}>
      {subjects.map((s) => (
        <SubjectTile key={s.id} subject={s} showReading={showReading} />
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
