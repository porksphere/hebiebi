import { useQueryClient } from '@tanstack/react-query';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';

import { formatWhen, LevelPaper, ReviewHero, type Featured } from '@/components/dashboard';
import { useClient } from '@/lib/auth';
import { sessionStats } from '@/lib/review/session';
import { flushReviews, pendingCount } from '@/lib/review/submissions';
import { isInProgress, useReviewSession } from '@/lib/review/use-review-session';
import { useLevelKanji, useSearchIndex, useSummary, useUser } from '@/lib/wanikani/queries';
import { spacing, useGutters, useTheme } from '@/theme';

export default function TodayScreen() {
  const theme = useTheme();
  const gutters = useGutters();
  const client = useClient();
  const queryClient = useQueryClient();
  const user = useUser();
  const summary = useSummary();
  const level = useLevelKanji(user.data?.level);
  const index = useSearchIndex();
  // Which kanji to feature: fixed while the screen is up, different the next time the app opens.
  const [pick] = useState(() => Math.random());
  const [refreshing, setRefreshing] = useState(false);
  const [pending, setPending] = useState(pendingCount);
  const session = useReviewSession();
  const stats = session.state ? sessionStats(session.state) : null;

  const sync = useCallback(async () => {
    if (pendingCount() === 0) return;
    const result = await flushReviews(client);
    setPending(result.remaining);
    if (result.sent.length) queryClient.invalidateQueries();
  }, [client, queryClient]);

  // Anything a previous session couldn't send goes out whenever this screen comes back.
  useFocusEffect(
    useCallback(() => {
      setPending(pendingCount());
      sync();
    }, [sync]),
  );

  const refresh = useCallback(async () => {
    setRefreshing(true);
    await sync();
    await queryClient.invalidateQueries();
    setRefreshing(false);
  }, [queryClient, sync]);

  const now = summary.data?.reviews[0];
  const reviewCount = now && new Date(now.available_at) <= new Date() ? now.subject_ids.length : 0;
  const lessonCount =
    summary.data?.lessons
      .filter((l) => new Date(l.available_at) <= new Date())
      .reduce((n, l) => n + l.subject_ids.length, 0) ?? 0;
  const error = summary.error ?? user.error;

  // One kanji from the reviews that are ready (or, with none ready, the ones coming up).
  const reviewIds = new Set(
    (reviewCount > 0 ? (now?.subject_ids ?? []) : (summary.data?.reviews.flatMap((r) => r.subject_ids) ?? [])),
  );
  const candidates = (index.data ?? []).filter((e) => e.type === 'kanji' && e.characters && reviewIds.has(e.id));
  const entry = candidates.length ? candidates[Math.floor(pick * candidates.length)] : null;
  const featured: Featured | null = entry
    ? { id: entry.id, characters: entry.characters!, reading: entry.reading, meaning: entry.meaning }
    : null;

  // "Next: 8 at 2 PM · 61 in 24 hours · 12 lessons", leaving out whatever is zero.
  const upcoming = (summary.data?.reviews ?? [])
    .filter((r) => new Date(r.available_at) > new Date())
    .slice(0, 24);
  const next = upcoming.find((r) => r.subject_ids.length > 0);
  const dayTotal = upcoming.reduce((n, r) => n + r.subject_ids.length, 0);
  const footer = [
    next
      ? `Next: ${next.subject_ids.length} ${formatWhen(next.available_at).replace(':00', '')}`
      : null,
    dayTotal > (next?.subject_ids.length ?? 0) ? `${dayTotal} in 24 hours` : null,
    lessonCount > 0 ? `${lessonCount} ${lessonCount === 1 ? 'lesson' : 'lessons'} on WaniKani` : null,
  ].filter(Boolean);

  return (
    <ScrollView
      style={{ backgroundColor: theme.background }}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={[styles.content, gutters.padding]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={theme.textSecondary} />}>
      {pending > 0 ? (
        <Pressable onPress={sync} style={[styles.banner, { borderColor: theme.border }]}>
          <Text style={[styles.bannerText, { color: theme.text }]}>
            {pending} {pending === 1 ? 'review hasn’t' : 'reviews haven’t'} reached WaniKani yet. Tap to retry.
          </Text>
        </Pressable>
      ) : null}

      {error ? (
        <View style={[styles.banner, { borderColor: theme.incorrect }]}>
          <Text style={[styles.bannerText, { color: theme.text }]}>
            Couldn’t load your data from WaniKani. Pull down to try again.
          </Text>
          <Text style={[styles.bannerDetail, { color: theme.textSecondary }]}>{error.message}</Text>
        </View>
      ) : null}

      <ReviewHero
        count={reviewCount}
        nextReviewsAt={summary.data?.next_reviews_at ?? null}
        loading={summary.isPending}
        onStart={() => router.push('/review')}
        session={
          isInProgress(session)
            ? {
                completed: stats?.completed ?? null,
                total: stats?.total ?? null,
                remaining: stats?.remaining ?? null,
                wrappingUp: session.state?.wrappingUp ?? false,
              }
            : null
        }
        featured={featured}
      />

      {user.data && level.data ? <LevelPaper level={user.data.level} {...level.data} /> : null}

      {footer.length ? (
        <Text style={[styles.footer, { color: theme.textSecondary, borderTopColor: theme.border }]}>
          {footer.join(' · ')}
        </Text>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.md, gap: spacing.lg, paddingBottom: 120 },
  footer: { fontSize: 13, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: spacing.md - 4 },
  banner: { borderWidth: 1, borderRadius: 14, padding: spacing.md },
  bannerText: { fontSize: 15 },
  bannerDetail: { fontSize: 13, marginTop: spacing.xs },
});
