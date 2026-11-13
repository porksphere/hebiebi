// Kanji practice paper: ruled squares with faint centre guides. A square is empty until its item
// is unlocked, grey while it's being learned and black once it's passed. Used for the current
// level on Today and for radicals and kanji on a level's page.

import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import type { Subject } from '@/lib/wanikani/types';
import { useTheme } from '@/theme';

export type PaperState = 'passed' | 'learning' | 'locked';

/** A brush-style face for the characters that are here to be looked at rather than read. */
export const MINCHO = Platform.select({ ios: 'Hiragino Mincho ProN', default: undefined });

export function openSubject(id: number) {
  router.push({ pathname: '/subject/[id]', params: { id: String(id) } });
}

const COLUMNS = 8;

export function Paper({ items }: { items: { subject: Subject; state: PaperState }[] }) {
  const theme = useTheme();
  const line = theme.textSecondary;
  const rows: ({ subject: Subject; state: PaperState } | null)[][] = [];
  for (let i = 0; i < items.length; i += COLUMNS) {
    const row: ({ subject: Subject; state: PaperState } | null)[] = items.slice(i, i + COLUMNS);
    // A short last row is padded with blank squares, as on a real sheet.
    while (row.length < COLUMNS) row.push(null);
    rows.push(row);
  }

  return (
    <View style={[styles.paper, { borderColor: line, backgroundColor: theme.background }]}>
      {rows.map((row, r) => (
        <View key={r} style={styles.row}>
          {row.map((cell, c) => {
            const shown = cell && cell.state !== 'locked' ? cell : null;
            const d = shown?.subject.data;
            const image = d && !d.characters && 'character_images' in d ? svgOf(d.character_images) : null;
            const meaning = d?.meanings.find((m) => m.primary)?.meaning ?? '';
            return (
              <Pressable
                key={c}
                disabled={!shown}
                accessibilityRole={shown ? 'button' : undefined}
                accessibilityLabel={
                  shown ? `${d?.characters ?? meaning}, ${shown.state === 'passed' ? 'passed' : 'learning'}` : undefined
                }
                onPress={() => shown && openSubject(shown.subject.id)}
                style={({ pressed }) => [styles.square, { borderColor: line, opacity: pressed ? 0.4 : 1 }]}>
                <View style={[styles.guideH, { backgroundColor: theme.border }]} />
                <View style={[styles.guideV, { backgroundColor: theme.border }]} />
                {shown ? (
                  <View style={{ opacity: shown.state === 'passed' ? 1 : 0.28 }}>
                    {d?.characters ? (
                      <Text style={[styles.glyph, { color: theme.text }]} adjustsFontSizeToFit numberOfLines={1}>
                        {d.characters}
                      </Text>
                    ) : image ? (
                      <Image source={{ uri: image }} style={styles.image} tintColor={theme.text} contentFit="contain" />
                    ) : null}
                  </View>
                ) : null}
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

function svgOf(images: { url: string; content_type: string }[]) {
  return (images.find((i) => i.content_type === 'image/svg+xml') ?? images[0])?.url ?? null;
}

const DIGITS = ['', '一', '二', '三', '四', '五', '六', '七', '八', '九'];

/** 1–99 in kanji numerals: 7 → 七, 12 → 十二, 60 → 六十. */
export function kanjiNumber(n: number) {
  const tens = Math.floor(n / 10);
  return (tens > 1 ? DIGITS[tens] : '') + (tens > 0 ? '十' : '') + DIGITS[n % 10];
}

const styles = StyleSheet.create({
  paper: { borderTopWidth: 1, borderLeftWidth: 1 },
  row: { flexDirection: 'row' },
  square: {
    flex: 1,
    aspectRatio: 1,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  guideH: { position: 'absolute', left: 0, right: 0, top: '50%', height: StyleSheet.hairlineWidth },
  guideV: { position: 'absolute', top: 0, bottom: 0, left: '50%', width: StyleSheet.hairlineWidth },
  glyph: { fontSize: 24, fontFamily: MINCHO, fontWeight: '600', textAlign: 'center' },
  image: { width: 22, height: 22 },
});
