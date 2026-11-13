// The Today screen's two pieces: the review count over a big faint kanji, and the current level
// as a sheet of kanji practice paper that fills in as you learn.

import { router } from 'expo-router';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import type { KanjiState } from '@/lib/wanikani/queries';
import type { Subject } from '@/lib/wanikani/types';
import { spacing, useTheme } from '@/theme';

/** A brush-style face for the kanji that are here to be looked at rather than read. */
const MINCHO = Platform.select({ ios: 'Hiragino Mincho ProN', default: undefined });

function openSubject(id: number) {
  router.push({ pathname: '/subject/[id]', params: { id: String(id) } });
}

// --- Review hero ------------------------------------------------------------------------------

/** A session that's been minimised: how far along it is. `null` counts while it's still loading. */
export interface SessionProgress {
  completed: number | null;
  total: number | null;
  /** Still to answer: the items in play, plus the backlog unless wrapping up. */
  remaining: number | null;
  wrappingUp: boolean;
}

/** The kanji shown big behind the count, with its reading and meaning above it. */
export interface Featured {
  id: number;
  characters: string;
  reading: string | null;
  meaning: string;
}

export function ReviewHero({
  count,
  nextReviewsAt,
  onStart,
  loading,
  session,
  featured,
}: {
  count: number;
  nextReviewsAt: string | null;
  onStart: () => void;
  loading?: boolean;
  /** Set while a session is minimised: the button resumes it instead of starting one. */
  session?: SessionProgress | null;
  featured?: Featured | null;
}) {
  const theme = useTheme();
  const has = count > 0 || !!session;

  let value: string;
  let caption: string;
  if (session) {
    value = session.remaining === null ? '–' : String(session.remaining);
    caption =
      session.total === null
        ? 'Getting your reviews…'
        : session.wrappingUp
          ? 'left · wrapping up'
          : `left · ${session.completed} of ${session.total} done`;
  } else {
    value = loading ? '–' : String(count);
    caption = loading
      ? 'Checking WaniKani…'
      : count > 0
        ? count === 1
          ? 'review ready'
          : 'reviews ready'
        : nextReviewsAt
          ? `Next reviews ${formatWhen(nextReviewsAt)}`
          : 'Nothing scheduled';
  }

  return (
    <View style={styles.hero}>
      {featured ? (
        <Text
          style={[styles.ghost, { color: theme.surface }]}
          pointerEvents="none"
          accessible={false}
          importantForAccessibility="no">
          {featured.characters}
        </Text>
      ) : null}
      {featured ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${featured.characters}, ${featured.meaning}`}
          hitSlop={10}
          onPress={() => openSubject(featured.id)}
          style={({ pressed }) => [styles.word, { opacity: pressed ? 0.5 : 1 }]}>
          <Text style={[styles.wordText, { color: theme.textSecondary }]} numberOfLines={1}>
            <Text style={[styles.wordGlyph, { color: theme.text }]}>{featured.characters}</Text>
            {featured.reading ? ` · ${featured.reading}` : ''} · {featured.meaning.toLowerCase()}
          </Text>
        </Pressable>
      ) : null}
      <View style={styles.heroRow}>
        <View style={styles.heroText}>
          <Text style={[styles.heroCount, { color: theme.text }]}>{value}</Text>
          <Text style={[styles.heroCaption, { color: theme.textSecondary }]}>{caption}</Text>
        </View>
        {has ? (
          <Pressable
            accessibilityRole="button"
            onPress={onStart}
            style={({ pressed }) => [
              styles.heroButton,
              { backgroundColor: theme.inverseBackground, opacity: pressed ? 0.75 : 1 },
            ]}>
            <Text style={[styles.heroButtonText, { color: theme.inverseText }]}>{session ? 'Resume' : 'Start'}</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

// --- Level paper ------------------------------------------------------------------------------

const COLUMNS = 8;

/**
 * The level's kanji on practice paper. A square is empty until the kanji is unlocked, grey while
 * you're learning it and black once it's passed.
 */
export function LevelPaper({
  level,
  kanji,
  passed,
  total,
  required,
}: {
  level: number;
  kanji: { subject: Subject; state: KanjiState }[];
  passed: number;
  total: number;
  required: number;
}) {
  const theme = useTheme();
  const toGo = Math.max(0, required - passed);
  const rows: ({ subject: Subject; state: KanjiState } | null)[][] = [];
  for (let i = 0; i < kanji.length; i += COLUMNS) {
    const row: ({ subject: Subject; state: KanjiState } | null)[] = kanji.slice(i, i + COLUMNS);
    while (row.length < COLUMNS) row.push(null);
    rows.push(row);
  }
  const line = theme.textSecondary;

  return (
    <View style={styles.level}>
      <View style={styles.levelHead}>
        <Text style={[styles.levelTitle, { color: theme.text }]} accessibilityLabel={`Level ${level}`}>
          <Text style={styles.levelKanji}>第{kanjiNumber(level)}級</Text>
          {'  '}Level {level}
        </Text>
        <Text style={[styles.levelCount, { color: theme.textSecondary }]}>
          {passed} of {total}
        </Text>
      </View>

      <View style={[styles.paper, { borderColor: line, backgroundColor: theme.background }]}>
        {rows.map((row, r) => (
          <View key={r} style={styles.paperRow}>
            {row.map((cell, c) => {
              const shown = cell && cell.state !== 'locked';
              return (
                <Pressable
                  key={c}
                  disabled={!shown}
                  accessibilityRole={shown ? 'button' : undefined}
                  accessibilityLabel={
                    shown
                      ? `${cell.subject.data.characters}, ${cell.state === 'passed' ? 'passed' : 'learning'}`
                      : undefined
                  }
                  onPress={() => cell && openSubject(cell.subject.id)}
                  style={({ pressed }) => [styles.square, { borderColor: line, opacity: pressed ? 0.4 : 1 }]}>
                  <View style={[styles.guideH, { backgroundColor: theme.border }]} />
                  <View style={[styles.guideV, { backgroundColor: theme.border }]} />
                  {shown ? (
                    <Text
                      style={[styles.squareGlyph, { color: theme.text, opacity: cell.state === 'passed' ? 1 : 0.28 }]}
                      adjustsFontSizeToFit
                      numberOfLines={1}>
                      {cell.subject.data.characters}
                    </Text>
                  ) : null}
                </Pressable>
              );
            })}
          </View>
        ))}
      </View>

      <Text style={[styles.note, { color: theme.textSecondary }]}>
        {toGo === 0
          ? 'Enough kanji passed to level up.'
          : `${toGo} more kanji to reach level ${level + 1}`}
      </Text>
    </View>
  );
}

// --- Shared -----------------------------------------------------------------------------------

const DIGITS = ['', '一', '二', '三', '四', '五', '六', '七', '八', '九'];

/** 1–99 in kanji numerals: 7 → 七, 12 → 十二, 60 → 六十. */
export function kanjiNumber(n: number) {
  const tens = Math.floor(n / 10);
  return (tens > 1 ? DIGITS[tens] : '') + (tens > 0 ? '十' : '') + DIGITS[n % 10];
}

export function formatWhen(iso: string) {
  const date = new Date(iso);
  const now = new Date();
  const time = date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  const sameDay = date.toDateString() === now.toDateString();
  if (sameDay) return `at ${time}`;
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  if (date.toDateString() === tomorrow.toDateString()) return `tomorrow at ${time}`;
  return `on ${date.toLocaleDateString([], { weekday: 'long' })} at ${time}`;
}

const styles = StyleSheet.create({
  hero: { minHeight: 190, justifyContent: 'flex-end', gap: spacing.sm + 4 },
  // Runs off the right edge on purpose; the scroll view clips it.
  ghost: {
    position: 'absolute',
    top: -56,
    right: -78,
    fontSize: 270,
    lineHeight: 300,
    fontWeight: '600',
    fontFamily: MINCHO,
  },
  word: { alignSelf: 'flex-start' },
  wordText: { fontSize: 13 },
  wordGlyph: { fontSize: 15, fontWeight: '600' },
  heroRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: spacing.md },
  heroText: { flexShrink: 1 },
  heroCount: { fontSize: 76, lineHeight: 76, fontWeight: '700', letterSpacing: -3, fontVariant: ['tabular-nums'] },
  heroCaption: { fontSize: 13, marginTop: spacing.xs },
  heroButton: { borderRadius: 999, paddingVertical: 11, paddingHorizontal: 22 },
  heroButtonText: { fontSize: 16, fontWeight: '600' },

  level: { gap: spacing.sm + 2 },
  levelHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  levelTitle: { fontSize: 20, fontWeight: '700' },
  levelKanji: { fontFamily: MINCHO, fontWeight: '600' },
  levelCount: { fontSize: 13, fontVariant: ['tabular-nums'] },
  paper: { borderTopWidth: 1, borderLeftWidth: 1 },
  paperRow: { flexDirection: 'row' },
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
  squareGlyph: { fontSize: 24, fontFamily: MINCHO, fontWeight: '600', textAlign: 'center' },
  note: { fontSize: 13 },
});
