// Which lessons come first, and how they're split into batches. Pure, so it can be unit-tested.
//
// WaniKani teaches by level, then radicals before kanji before vocabulary (each needs the ones
// before it), then in its own lesson order. Note that WaniKani has deprecated the order setting:
// the API always reports `ascending_level_then_subject` now. The others are kept for completeness.

import { shuffle, type Rng } from '../review/session';
import type { LessonPresentationOrder, StudyMaterial, Resource, Subject, SubjectType } from '../wanikani/types';

export interface LessonItem {
  assignmentId: number;
  subject: Subject;
  /** The user's notes and synonyms for it, if any, with its id for updating. */
  material: Resource<StudyMaterial, 'study_material'> | null;
}

const TYPE_RANK: Record<SubjectType, number> = {
  radical: 0,
  kanji: 1,
  vocabulary: 2,
  kana_vocabulary: 2,
};

export function orderLessons<T extends { subject: Subject }>(
  items: readonly T[],
  order: LessonPresentationOrder = 'ascending_level_then_subject',
  rng: Rng = Math.random,
): T[] {
  if (order === 'shuffled') return shuffle(items, rng);
  const byLevel = (a: T, b: T) => a.subject.data.level - b.subject.data.level;
  if (order === 'ascending_level_then_shuffled') {
    // Stable sort over a shuffle: by level, random within a level.
    return shuffle(items, rng)
      .map((item, index) => ({ item, index }))
      .sort((a, b) => byLevel(a.item, b.item) || a.index - b.index)
      .map(({ item }) => item);
  }
  return [...items].sort(
    (a, b) =>
      byLevel(a, b) ||
      TYPE_RANK[a.subject.object] - TYPE_RANK[b.subject.object] ||
      a.subject.data.lesson_position - b.subject.data.lesson_position ||
      a.subject.id - b.subject.id,
  );
}

/** Consecutive batches of `size` (at least 1); the last may be shorter. */
export function toBatches<T>(items: readonly T[], size: number): T[][] {
  const n = Math.max(1, Math.floor(size) || 1);
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += n) out.push(items.slice(i, i + n));
  return out;
}
