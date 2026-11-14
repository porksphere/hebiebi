// The Reviews widget's timeline, worked out from WaniKani's summary. Pure, so it's unit-tested.

import type { ReviewsWidgetProps } from '@/widgets/reviews';

import type { Summary } from './wanikani/types';

/** The widget's timeline from a summary: an entry for now, then one for each hour that adds reviews. */
export function reviewsTimeline(summary: Summary, now = new Date()): { date: Date; props: ReviewsWidgetProps }[] {
  const buckets = summary.reviews
    .map((r) => ({ at: new Date(r.available_at), count: r.subject_ids.length }))
    .filter((b) => b.count > 0)
    .sort((a, b) => a.at.getTime() - b.at.getTime());
  const ready = buckets.filter((b) => b.at <= now).reduce((n, b) => n + b.count, 0);
  const coming = buckets.filter((b) => b.at > now);

  const hour = (date: Date) => date.toLocaleTimeString([], { hour: 'numeric' });
  const next = (i: number) =>
    coming[i] ? { nextCount: coming[i].count, nextAt: hour(coming[i].at) } : { nextCount: 0, nextAt: '' };

  const entries = [{ date: now, props: { count: ready, ...next(0) } }];
  let count = ready;
  coming.forEach((bucket, i) => {
    count += bucket.count;
    entries.push({ date: bucket.at, props: { count, ...next(i + 1) } });
  });
  return entries;
}
