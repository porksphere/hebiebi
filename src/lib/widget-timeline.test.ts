import { expect, test } from 'bun:test';

import type { Summary } from './wanikani/types';
import { reviewsTimeline } from './widget-timeline';

const now = new Date('2026-11-13T10:20:00Z');
const bucket = (iso: string, n: number) => ({ available_at: iso, subject_ids: Array.from({ length: n }, (_, i) => i) });
const summary = (reviews: ReturnType<typeof bucket>[]) => ({ reviews, lessons: [], next_reviews_at: null }) as unknown as Summary;

test('starts with what is ready now and points at the next batch', () => {
  const [first] = reviewsTimeline(
    summary([bucket('2026-11-13T10:00:00Z', 42), bucket('2026-11-13T11:00:00Z', 0), bucket('2026-11-13T12:00:00Z', 8)]),
    now,
  );
  expect(first.date).toEqual(now);
  expect(first.props.count).toBe(42);
  expect(first.props.nextCount).toBe(8);
  expect(first.props.nextAt).not.toBe('');
});

test('adds an entry for each hour that brings reviews, with a running total', () => {
  const entries = reviewsTimeline(
    summary([bucket('2026-11-13T10:00:00Z', 42), bucket('2026-11-13T12:00:00Z', 8), bucket('2026-11-13T15:00:00Z', 5)]),
    now,
  );
  expect(entries.map((e) => e.props.count)).toEqual([42, 50, 55]);
  expect(entries[1].date).toEqual(new Date('2026-11-13T12:00:00Z'));
  expect(entries[1].props.nextCount).toBe(5);
  expect(entries[2].props.nextAt).toBe('');
});

test('nothing ready and nothing coming is a single empty entry', () => {
  const entries = reviewsTimeline(summary([bucket('2026-11-13T10:00:00Z', 0)]), now);
  expect(entries).toEqual([{ date: now, props: { count: 0, nextCount: 0, nextAt: '' } }]);
});
