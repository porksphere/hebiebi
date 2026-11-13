// The review queue, as pure functions over an immutable state so it can be unit-tested.
//
// How a session runs (matching WaniKani's own reviews):
//   - Up to ACTIVE_SIZE items are "in play". Each question picks a random item in play and a random
//     part of it still unanswered (meaning or reading), so the two parts of an item are rarely back
//     to back.
//   - A wrong answer counts against that part, and the part stays unanswered; it comes back later.
//   - Once every part of an item has been answered correctly, the item is done: it leaves play, the
//     caller submits its review, and the next item from the backlog takes its place.
//   - Wrap-up stops refilling, so the session ends once the items in play are done.

import { hasReading, type QuestionType } from './answer-checker';
import type { Subject } from '../wanikani/types';

export const ACTIVE_SIZE = 10;

export interface ReviewItem {
  assignmentId: number;
  subject: Subject;
  srsStage: number;
  /** The user's own extra accepted meanings (study materials). */
  synonyms: string[];
  meaningDone: boolean;
  readingDone: boolean;
  incorrectMeaning: number;
  incorrectReading: number;
}

export interface Question {
  assignmentId: number;
  type: QuestionType;
}

export interface SessionState {
  items: Record<number, ReviewItem>;
  backlog: number[];
  active: number[];
  completed: number[];
  current: Question | null;
  wrappingUp: boolean;
}

export type Rng = () => number;

export type PresentationOrder = 'shuffled' | 'lower_levels_first';

export function shuffle<T>(input: readonly T[], rng: Rng = Math.random): T[] {
  const out = [...input];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function makeItem(
  assignmentId: number,
  subject: Subject,
  srsStage: number,
  synonyms: string[] = [],
): ReviewItem {
  return {
    assignmentId,
    subject,
    srsStage,
    synonyms,
    meaningDone: false,
    readingDone: !hasReading(subject),
    incorrectMeaning: 0,
    incorrectReading: 0,
  };
}

export function isItemDone(item: ReviewItem) {
  return item.meaningDone && item.readingDone;
}

export function createSession(
  items: ReviewItem[],
  { order = 'shuffled', rng = Math.random }: { order?: PresentationOrder; rng?: Rng } = {},
): SessionState {
  let ordered = shuffle(items, rng);
  if (order === 'lower_levels_first') {
    // Stable sort over the shuffle: by level, random within a level.
    ordered = ordered
      .map((item, index) => ({ item, index }))
      .sort((a, b) => a.item.subject.data.level - b.item.subject.data.level || a.index - b.index)
      .map(({ item }) => item);
  }
  const ids = ordered.map((i) => i.assignmentId);
  const state: SessionState = {
    items: Object.fromEntries(ordered.map((i) => [i.assignmentId, i])),
    backlog: ids.slice(ACTIVE_SIZE),
    active: ids.slice(0, ACTIVE_SIZE),
    completed: [],
    current: null,
    wrappingUp: false,
  };
  return nextQuestion(state, rng);
}

function openParts(item: ReviewItem): QuestionType[] {
  const parts: QuestionType[] = [];
  if (!item.meaningDone) parts.push('meaning');
  if (!item.readingDone) parts.push('reading');
  return parts;
}

/** Picks the next question, avoiding the item just asked when anything else is in play. */
export function nextQuestion(state: SessionState, rng: Rng = Math.random): SessionState {
  if (state.active.length === 0) return { ...state, current: null };
  const previous = state.current?.assignmentId;
  const candidates = state.active.length > 1 ? state.active.filter((id) => id !== previous) : state.active;
  const assignmentId = candidates[Math.floor(rng() * candidates.length)];
  const parts = openParts(state.items[assignmentId]);
  const type = parts[Math.floor(rng() * parts.length)];
  return { ...state, current: { assignmentId, type } };
}

/**
 * Grades the current question. Does NOT move on: the screen shows the result first, then calls
 * `advance`. `completedItem` is set when this answer finished the item, i.e. its review is ready.
 */
export function answerCurrent(
  state: SessionState,
  correct: boolean,
): { state: SessionState; completedItem: ReviewItem | null } {
  const q = state.current;
  if (!q) return { state, completedItem: null };
  const item = { ...state.items[q.assignmentId] };
  if (correct) {
    if (q.type === 'meaning') item.meaningDone = true;
    else item.readingDone = true;
  } else if (q.type === 'meaning') {
    item.incorrectMeaning++;
  } else {
    item.incorrectReading++;
  }

  const items = { ...state.items, [item.assignmentId]: item };
  if (!isItemDone(item)) return { state: { ...state, items }, completedItem: null };

  const active = state.active.filter((id) => id !== item.assignmentId);
  let backlog = state.backlog;
  if (!state.wrappingUp && backlog.length > 0) {
    active.push(backlog[0]);
    backlog = backlog.slice(1);
  }
  return {
    state: { ...state, items, active, backlog, completed: [...state.completed, item.assignmentId] },
    completedItem: item,
  };
}

export function advance(state: SessionState, rng: Rng = Math.random) {
  return nextQuestion(state, rng);
}

/** Moves on without answering; the question stays open and comes back later. */
export function skip(state: SessionState, rng: Rng = Math.random) {
  return nextQuestion(state, rng);
}

export function setWrappingUp(state: SessionState, wrappingUp: boolean): SessionState {
  if (wrappingUp) return { ...state, wrappingUp };
  // Leaving wrap-up refills play from the backlog.
  const room = Math.max(0, ACTIVE_SIZE - state.active.length);
  return {
    ...state,
    wrappingUp,
    active: [...state.active, ...state.backlog.slice(0, room)],
    backlog: state.backlog.slice(room),
  };
}

export function sessionStats(state: SessionState) {
  const total = Object.keys(state.items).length;
  const done = state.completed.map((id) => state.items[id]);
  const correctFirstTry = done.filter((i) => i.incorrectMeaning === 0 && i.incorrectReading === 0).length;
  return {
    total,
    completed: done.length,
    remaining: state.active.length + (state.wrappingUp ? 0 : state.backlog.length),
    correctFirstTry,
    accuracy: done.length ? Math.round((correctFirstTry / done.length) * 100) : null,
  };
}
