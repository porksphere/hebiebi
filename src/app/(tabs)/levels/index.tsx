import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { MINCHO } from '@/components/paper';
import { useUser } from '@/lib/wanikani/queries';
import { spacing, useTheme } from '@/theme';

/** WaniKani's own names for each ten levels. Their kanji run down the sheet's margin. */
const GROUPS = [
  { name: 'Pleasant', kanji: '快' },
  { name: 'Painful', kanji: '苦' },
  { name: 'Death', kanji: '死' },
  { name: 'Hell', kanji: '地獄' },
  { name: 'Paradise', kanji: '天国' },
  { name: 'Reality', kanji: '現実' },
];

/** All sixty levels on one ruled sheet: finished ones in black, yours filled in, the rest faint. */
export default function LevelsScreen() {
  const theme = useTheme();
  const { data: user } = useUser();
  const current = user?.level ?? 0;
  const maxGranted = user?.subscription.max_level_granted ?? 60;
  const line = theme.textSecondary;

  return (
    <ScrollView
      style={{ backgroundColor: theme.background }}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={styles.content}>
      <View style={[styles.sheet, { borderColor: line }]}>
        {GROUPS.map((group, g) => (
          <View key={group.name} style={styles.group}>
            <View
              style={[styles.margin, { borderColor: line }]}
              accessible
              accessibilityRole="header"
              accessibilityLabel={`${group.name}, levels ${g * 10 + 1} to ${g * 10 + 10}`}>
              {[...group.kanji].map((ch) => (
                <Text key={ch} style={[styles.marginKanji, { color: theme.text }]}>
                  {ch}
                </Text>
              ))}
            </View>
            <View style={styles.rows}>
              {[0, 5].map((offset) => (
                <View key={offset} style={styles.row}>
                  {Array.from({ length: 5 }, (_, i) => g * 10 + offset + i + 1).map((level) => {
                    const isCurrent = level === current;
                    return (
                      <Pressable
                        key={level}
                        accessibilityRole="button"
                        accessibilityLabel={`Level ${level}${isCurrent ? ', your level' : ''}`}
                        onPress={() => router.push({ pathname: '/levels/[level]', params: { level: String(level) } })}
                        style={({ pressed }) => [
                          styles.square,
                          { borderColor: line, backgroundColor: isCurrent ? theme.inverseBackground : undefined },
                          pressed && { opacity: 0.5 },
                        ]}>
                        <Text
                          style={[
                            styles.number,
                            { color: isCurrent ? theme.inverseText : theme.text },
                            // Ahead of you: faint. Past what the subscription covers: fainter still.
                            level > current && { fontWeight: '500', opacity: level > maxGranted ? 0.14 : 0.3 },
                          ]}>
                          {level}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              ))}
            </View>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.md, paddingBottom: 120 },
  sheet: { borderTopWidth: 1, borderLeftWidth: 1 },
  group: { flexDirection: 'row' },
  margin: { width: 38, borderRightWidth: 1, borderBottomWidth: 1, alignItems: 'center', justifyContent: 'center', gap: 2 },
  marginKanji: { fontSize: 20, fontFamily: MINCHO, fontWeight: '600' },
  rows: { flex: 1 },
  row: { flexDirection: 'row' },
  square: { flex: 1, aspectRatio: 1, borderRightWidth: 1, borderBottomWidth: 1, alignItems: 'center', justifyContent: 'center' },
  number: { fontSize: 20, fontWeight: '600', fontVariant: ['tabular-nums'] },
});
