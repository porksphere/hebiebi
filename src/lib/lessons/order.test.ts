/// <reference types="bun" />
import { describe, expect, test } from 'bun:test';

import type { Subject, SubjectType } from '../wanikani/types';
import { orderLessons, toBatches } from './order';

function item(id: number, object: SubjectType, level: number, lesson_position: number) {
  return { id, subject: { id, object, data: { level, lesson_position } } as unknown as Subject };
}

const items = [
  item(1, 'vocabulary', 2, 0),
  item(2, 'kanji', 2, 5),
  item(3, 'radical', 2, 9),
  item(4, 'kana_vocabulary', 1, 3),
  item(5, 'kanji', 1, 2),
  item(6, 'kanji', 2, 1),
  item(7, 'vocabulary', 1, 1),
];

const ids = (list: { id: number }[]) => list.map((i) => i.id);

describe('orderLessons', () => {
  test('level, then radical < kanji < vocabulary, then lesson position', () => {
    expect(ids(orderLessons(items))).toEqual([5, 7, 4, 3, 6, 2, 1]);
  });

  test('kana vocabulary ranks with vocabulary', () => {
    expect(ids(orderLessons([item(1, 'kana_vocabulary', 1, 0), item(2, 'vocabulary', 1, 1)]))).toEqual([1, 2]);
  });

  test('level then shuffled keeps levels in order', () => {
    const levels = orderLessons(items, 'ascending_level_then_shuffled', () => 0.42).map((i) => i.subject.data.level);
    expect(levels).toEqual([1, 1, 1, 2, 2, 2, 2]);
  });

  test('shuffled keeps every item exactly once', () => {
    const out = orderLessons(items, 'shuffled', () => 0.7);
    expect(ids(out).sort()).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  test('does not mutate its input', () => {
    const copy = [...items];
    orderLessons(items);
    expect(items).toEqual(copy);
  });
});

describe('toBatches', () => {
  test('splits into batches, the last one shorter', () => {
    expect(toBatches([1, 2, 3, 4, 5, 6, 7], 3)).toEqual([[1, 2, 3], [4, 5, 6], [7]]);
  });
  test('a nonsense size still gives batches of one', () => {
    expect(toBatches([1, 2], 0)).toEqual([[1], [2]]);
    expect(toBatches([1, 2], Number.NaN)).toEqual([[1], [2]]);
  });
  test('nothing in, nothing out', () => {
    expect(toBatches([], 5)).toEqual([]);
  });
});
