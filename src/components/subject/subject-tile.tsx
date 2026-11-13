import { router } from 'expo-router';
import { Pressable, StyleSheet, Text } from 'react-native';

import { Grid } from '@/components/grid';

import type { Subject } from '@/lib/wanikani/types';
import { spacing, useTheme } from '@/theme';

import { SubjectCharacters } from './subject-characters';

/** A related subject (a component, or something it appears in): tap to open its page. */
export function SubjectTile({ subject }: { subject: Subject }) {
  const theme = useTheme();
  const meaning = subject.data.meanings.find((m) => m.primary)?.meaning ?? '';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${subject.data.characters ?? ''} ${meaning}`}
      onPress={() => router.push({ pathname: '/subject/[id]', params: { id: String(subject.id) } })}
      style={({ pressed }) => [
        styles.tile,
        { backgroundColor: theme.surface, opacity: pressed ? 0.6 : 1 },
      ]}>
      <SubjectCharacters subject={subject} color={theme.text} size={30} />
      <Text style={[styles.meaning, { color: theme.textSecondary }]} numberOfLines={1}>
        {meaning}
      </Text>
    </Pressable>
  );
}

export function SubjectTileGrid({ subjects }: { subjects: Subject[] }) {
  return (
    <Grid columns={4}>
      {subjects.map((s) => (
        <SubjectTile key={s.id} subject={s} />
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
  meaning: { fontSize: 11 },
});
