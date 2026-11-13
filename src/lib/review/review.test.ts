/// <reference types="bun" />
import { describe, expect, test } from 'bun:test';

import type { Subject } from '../wanikani/types';
import { checkMeaning, checkReading, correctAnswers, typoTolerance } from './answer-checker';
import { answerCurrent, advance, createSession, makeItem, sessionStats, setWrappingUp } from './session';

const base = {
  created_at: '',
  document_url: '',
  hidden_at: null,
  lesson_position: 0,
  meaning_mnemonic: '',
  slug: '',
  spaced_repetition_system_id: 1,
};

function kanji(id = 1, level = 1): Subject {
  return {
    id,
    object: 'kanji',
    url: '',
    data_updated_at: null,
    data: {
      ...base,
      level,
      characters: '人',
      meanings: [{ meaning: 'Person', primary: true, accepted_answer: true }],
      auxiliary_meanings: [
        { meaning: 'People', type: 'whitelist' },
        { meaning: 'Persona', type: 'blacklist' },
      ],
      readings: [
        { reading: 'にん', primary: true, accepted_answer: true, type: 'onyomi' },
        { reading: 'じん', primary: false, accepted_answer: true, type: 'onyomi' },
        { reading: 'ひと', primary: false, accepted_answer: false, type: 'kunyomi' },
      ],
      amalgamation_subject_ids: [],
      component_subject_ids: [],
      meaning_hint: null,
      reading_hint: null,
      reading_mnemonic: '',
      visually_similar_subject_ids: [],
    },
  };
}

function vocab(meaning: string, reading: string): Subject {
  return {
    id: 2,
    object: 'vocabulary',
    url: '',
    data_updated_at: null,
    data: {
      ...base,
      level: 1,
      characters: '食べる',
      meanings: [{ meaning, primary: true, accepted_answer: true }],
      auxiliary_meanings: [],
      readings: [{ reading, primary: true, accepted_answer: true }],
      component_subject_ids: [],
      context_sentences: [],
      parts_of_speech: ['godan verb'],
      pronunciation_audios: [],
      reading_mnemonic: '',
    },
  };
}

function radical(id: number): Subject {
  return {
    id,
    object: 'radical',
    url: '',
    data_updated_at: null,
    data: {
      ...base,
      level: 1,
      characters: '一',
      meanings: [{ meaning: 'Ground', primary: true, accepted_answer: true }],
      auxiliary_meanings: [],
      amalgamation_subject_ids: [],
      character_images: [],
    },
  };
}

describe('meaning', () => {
  test('exact, case and whitespace insensitive', () => {
    expect(checkMeaning(kanji(), '  person ').kind).toBe('correct');
  });
  test('whitelist and user synonyms', () => {
    expect(checkMeaning(kanji(), 'people').kind).toBe('correct');
    expect(checkMeaning(kanji(), 'human', ['Human']).kind).toBe('correct');
  });
  test('blacklist is wrong even though it is within typo distance', () => {
    expect(checkMeaning(kanji(), 'persona').kind).toBe('incorrect');
  });
  test('typo tolerance', () => {
    expect(typoTolerance(3)).toBe(0);
    const r = checkMeaning(kanji(), 'persn');
    expect(r).toEqual({ kind: 'correct', exact: false, matched: 'person' });
    expect(checkMeaning(kanji(), 'pxrsxx').kind).toBe('incorrect');
  });
  test('reading typed as the meaning is a retry', () => {
    expect(checkMeaning(kanji(), 'nin').kind).toBe('retry');
  });
  test('kana in a meaning answer is a retry', () => {
    expect(checkMeaning(kanji(), 'にん').kind).toBe('retry');
  });
  test('verb without "to" is a retry', () => {
    expect(checkMeaning(vocab('To Eat', 'たべる'), 'eat').kind).toBe('retry');
    expect(checkMeaning(vocab('To Eat', 'たべる'), 'to eat').kind).toBe('correct');
  });
});

describe('reading', () => {
  test('accepted readings, romaji leftovers finalized', () => {
    expect(checkReading(kanji(), 'にん').kind).toBe('correct');
    expect(checkReading(kanji(), 'にn').kind).toBe('correct');
    expect(checkReading(kanji(), 'ジン').kind).toBe('correct');
  });
  test("a kanji's other reading type is a retry", () => {
    const r = checkReading(kanji(), 'ひと');
    expect(r.kind).toBe('retry');
    if (r.kind === 'retry') expect(r.message).toContain('on’yomi');
  });
  test('small kana slip is a retry', () => {
    expect(checkReading(vocab('x', 'きょう'), 'きよう').kind).toBe('retry');
  });
  test('wrong', () => {
    expect(checkReading(kanji(), 'さん').kind).toBe('incorrect');
  });
});

describe('session', () => {
  // Deterministic RNG.
  const seq = (...values: number[]) => {
    let i = 0;
    return () => values[i++ % values.length];
  };

  test('radical item completes on its meaning alone and gets submitted once', () => {
    let state = createSession([makeItem(10, radical(1), 1)], { rng: seq(0) });
    expect(state.current).toEqual({ assignmentId: 10, type: 'meaning' });
    const { state: next, completedItem } = answerCurrent(state, true);
    expect(completedItem?.assignmentId).toBe(10);
    state = advance(next);
    expect(state.current).toBeNull();
  });

  test('wrong answers are counted and the part comes back', () => {
    let state = createSession([makeItem(1, kanji(), 1)], { rng: seq(0) });
    const first = state.current!.type;
    let r = answerCurrent(state, false);
    expect(r.completedItem).toBeNull();
    state = advance(r.state, seq(0));
    r = answerCurrent(state, true);
    state = advance(r.state, seq(0));
    r = answerCurrent(state, true);
    expect(r.completedItem).not.toBeNull();
    const item = r.completedItem!;
    expect(first === 'meaning' ? item.incorrectMeaning : item.incorrectReading).toBe(1);
  });

  test('refills from the backlog, and wrap-up stops refilling', () => {
    const items = Array.from({ length: 15 }, (_, i) => makeItem(i + 1, radical(i + 1), 1));
    let state = createSession(items, { rng: seq(0.3) });
    expect(state.active).toHaveLength(10);
    expect(state.backlog).toHaveLength(5);
    state = answerCurrent(state, true).state;
    expect(state.active).toHaveLength(10);
    state = setWrappingUp(advance(state), true);
    state = answerCurrent(state, true).state;
    expect(state.active).toHaveLength(9);
    expect(sessionStats(state).remaining).toBe(9);
  });

  test('wrap-up finishes only the items in play (at most 10), then ends', () => {
    const items = Array.from({ length: 40 }, (_, i) => makeItem(i + 1, radical(i + 1), 1));
    let state = setWrappingUp(createSession(items), true);
    expect(sessionStats(state).remaining).toBe(10);
    let answered = 0;
    while (state.current) {
      state = advance(answerCurrent(state, true).state);
      answered++;
    }
    expect(answered).toBe(10);
    expect(state.backlog).toHaveLength(30);
  });

  test('lower levels first', () => {
    const items = [makeItem(1, kanji(1, 5), 1), makeItem(2, kanji(2, 1), 1), makeItem(3, kanji(3, 3), 1)];
    const state = createSession(items, { order: 'lower_levels_first' });
    expect(state.active).toEqual([2, 3, 1]);
  });
});

describe('correctAnswers', () => {
  test('meanings: accepted only, primary first, no synonyms or whitelist extras', () => {
    expect(correctAnswers(kanji(), 'meaning')).toEqual(['Person']);
  });

  test('readings: accepted only, primary first', () => {
    expect(correctAnswers(kanji(), 'reading')).toEqual(['にん', 'じん']);
  });
});
