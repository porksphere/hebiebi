// The Today screen's two pieces: the review count over a big faint kanji, and the current level
// as a sheet of kanji practice paper that fills in as you learn.

import { Pressable, StyleSheet, Text, View } from 'react-native';

import { kanjiNumber, MINCHO, openSubject, Paper, type PaperState } from '@/components/paper';
import type { Subject } from '@/lib/wanikani/types';
import { spacing, useTheme } from '@/theme';

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
        // Decoration, so it stops at the edge of what's visible rather than running under a side bar.
        <View style={styles.ghostClip} pointerEvents="none">
          <Text style={[styles.ghost, { color: theme.surface }]} accessible={false} importantForAccessibility="no">
            {featured.characters}
          </Text>
        </View>
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

/** The current level's kanji on practice paper (see paper.tsx), with how many more to level up. */
export function LevelPaper({
  level,
  kanji,
  passed,
  total,
  required,
}: {
  level: number;
  kanji: { subject: Subject; state: PaperState }[];
  passed: number;
  total: number;
  required: number;
}) {
  const theme = useTheme();
  const toGo = Math.max(0, required - passed);
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
      <Paper items={kanji} />
      <Text style={[styles.note, { color: theme.textSecondary }]}>
        {toGo === 0 ? 'Enough kanji passed to level up.' : `${toGo} more kanji to reach level ${level + 1}`}
      </Text>
    </View>
  );
}

// --- Shared -----------------------------------------------------------------------------------

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
  // The kanji runs off the right edge on purpose. The clip reaches through the page's 16 margin to
  // that edge and cuts it there.
  ghostClip: { position: 'absolute', top: -56, height: 300, left: 0, right: -spacing.md, overflow: 'hidden' },
  ghost: {
    position: 'absolute',
    top: 0,
    right: -62,
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
  note: { fontSize: 13 },
});
