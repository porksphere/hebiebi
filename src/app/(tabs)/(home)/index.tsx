import { useQueryClient } from '@tanstack/react-query';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Forecast, LevelProgress, ReviewHero, SrsBreakdown, StatTile } from '@/components/dashboard';
import { useClient } from '@/lib/auth';
import { confirmEndSession } from '@/components/review/end-session';
import { sessionStats } from '@/lib/review/session';
import { flushReviews, pendingCount } from '@/lib/review/submissions';
import { isInProgress, useReviewSession } from '@/lib/review/use-review-session';
import { useLevelProgress, useSrsCounts, useSummary, useUser } from '@/lib/wanikani/queries';
import { spacing, useTheme } from '@/theme';

export default function TodayScreen() {
  const theme = useTheme();
  const client = useClient();
  const queryClient = useQueryClient();
  const user = useUser();
  const summary = useSummary();
  const srs = useSrsCounts();
  const level = useLevelProgress(user.data?.level);
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
  const maxLevel = user.data?.subscription.max_level_granted;
  const error = summary.error ?? user.error;

  return (
    <ScrollView
      style={{ backgroundColor: theme.background }}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={styles.content}
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
        onEndSession={() => confirmEndSession(session)}
      />

      <View style={styles.row}>
        <StatTile
          label="Lessons"
          value={summary.data ? String(lessonCount) : '–'}
          caption="Do these on WaniKani"
        />
        <StatTile
          label="Level"
          value={user.data ? String(user.data.level) : '–'}
          caption={
            user.data
              ? user.data.subscription.active || maxLevel === 60
                ? `of 60`
                : `Free up to level ${maxLevel}`
              : undefined
          }
        />
      </View>

      {user.data && level.data ? (
        <LevelProgress level={user.data.level} {...level.data} />
      ) : null}

      {summary.data ? <Forecast summary={summary.data} /> : null}

      {srs.data ? <SrsBreakdown counts={srs.data} /> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.md, gap: spacing.md, paddingBottom: 120 },
  row: { flexDirection: 'row', gap: spacing.md },
  banner: { borderWidth: 1, borderRadius: 14, padding: spacing.md },
  bannerText: { fontSize: 15 },
  bannerDetail: { fontSize: 13, marginTop: spacing.xs },
});
