import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Grid } from '@/components/grid';
import { useUser } from '@/lib/wanikani/queries';
import { spacing, useTheme } from '@/theme';

/** WaniKani's own names for each ten levels. */
const GROUPS = [
  { name: 'Pleasant', kanji: '快' },
  { name: 'Painful', kanji: '苦' },
  { name: 'Death', kanji: '死' },
  { name: 'Hell', kanji: '地獄' },
  { name: 'Paradise', kanji: '天国' },
  { name: 'Reality', kanji: '現実' },
];

export default function LevelsScreen() {
  const theme = useTheme();
  const { data: user } = useUser();
  const current = user?.level ?? 0;
  const maxGranted = user?.subscription.max_level_granted ?? 60;

  return (
    <ScrollView
      style={{ backgroundColor: theme.background }}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={styles.content}>
      {GROUPS.map((group, g) => (
        <View key={group.name} style={styles.group}>
          <Text style={[styles.groupTitle, { color: theme.textSecondary }]}>
            {group.name} <Text style={styles.groupKanji}>{group.kanji}</Text>
          </Text>
          <Grid columns={5}>
            {Array.from({ length: 10 }, (_, i) => g * 10 + i + 1).map((level) => {
              const isCurrent = level === current;
              const ahead = level > current;
              return (
                <Pressable
                  key={level}
                  accessibilityRole="button"
                  accessibilityLabel={`Level ${level}${isCurrent ? ', your level' : ''}`}
                  onPress={() => router.push({ pathname: '/levels/[level]', params: { level: String(level) } })}
                  style={({ pressed }) => [
                    styles.tile,
                    { backgroundColor: isCurrent ? theme.inverseBackground : theme.surface },
                    // Past what the subscription covers: there, but quieter still.
                    { opacity: (pressed ? 0.6 : 1) * (level > maxGranted ? 0.45 : 1) },
                  ]}>
                  <Text
                    style={[
                      styles.tileText,
                      { color: isCurrent ? theme.inverseText : ahead ? theme.textSecondary : theme.text },
                    ]}>
                    {level}
                  </Text>
                </Pressable>
              );
            })}
          </Grid>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.md, gap: spacing.lg, paddingBottom: 120 },
  group: { gap: spacing.sm },
  groupTitle: { fontSize: 13, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8 },
  groupKanji: { fontWeight: '400', letterSpacing: 0 },
  tile: { aspectRatio: 1, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  tileText: { fontSize: 20, fontWeight: '600', fontVariant: ['tabular-nums'] },
});
