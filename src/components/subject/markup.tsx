import { StyleSheet, Text, type TextStyle } from 'react-native';

import { TYPE_COLORS, useTheme } from '@/theme';

// WaniKani mnemonics and hints carry light markup: <radical>, <kanji>, <vocabulary>, <meaning>,
// <reading>, <ja>. Subject tags get a tint of their type's WaniKani colour, as on the website
// (behind the text, which keeps the normal colour so it stays readable); meaning/reading are
// emphasised.
const TAG = /<(radical|kanji|vocabulary|meaning|reading|ja)>([\s\S]*?)<\/\1>/g;

export function Markup({ text, style }: { text: string; style?: TextStyle }) {
  const theme = useTheme();
  const parts: React.ReactNode[] = [];
  let last = 0;
  for (const match of text.matchAll(TAG)) {
    const [whole, tag, inner] = match;
    const index = match.index ?? 0;
    if (index > last) parts.push(text.slice(last, index));
    const key = `${index}-${tag}`;
    if (tag === 'radical' || tag === 'kanji' || tag === 'vocabulary') {
      parts.push(
        <Text
          key={key}
          style={[
            styles.subject,
            // Hex alpha: ~20% in light mode, ~33% on black, where a faint tint disappears.
            { backgroundColor: `${TYPE_COLORS[tag]}${theme.scheme === 'dark' ? '55' : '33'}`, color: theme.text },
          ]}>
          {` ${inner} `}
        </Text>,
      );
    } else if (tag === 'ja') {
      parts.push(inner);
    } else {
      parts.push(
        <Text key={key} style={styles.emphasis}>
          {inner}
        </Text>,
      );
    }
    last = index + whole.length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return <Text style={[styles.body, { color: theme.text }, style]}>{parts}</Text>;
}

const styles = StyleSheet.create({
  body: { fontSize: 16, lineHeight: 24 },
  subject: { fontWeight: '600', borderRadius: 4, overflow: 'hidden' },
  emphasis: { fontWeight: '700' },
});
