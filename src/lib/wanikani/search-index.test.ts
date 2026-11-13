/// <reference types="bun" />
import { describe, expect, test } from 'bun:test';

import { searchSubjects, toSearchEntry, type SearchEntry } from './search-index';
import type { Subject } from './types';

function entry(
  id: number,
  type: SearchEntry['type'],
  level: number,
  characters: string,
  meanings: string[],
  readings: string[] = [],
): SearchEntry {
  return {
    id,
    type,
    level,
    characters,
    imageUrl: null,
    meaning: meanings[0],
    meanings: meanings.map((m) => m.toLowerCase()),
    readings,
    reading: readings[0] ?? null,
  };
}

const entries = [
  entry(1, 'radical', 1, '水', ['Water']),
  entry(2, 'kanji', 1, '水', ['Water'], ['すい', 'みず']),
  entry(3, 'vocabulary', 1, '水', ['Water'], ['みず']),
  entry(4, 'vocabulary', 3, '水曜日', ['Wednesday'], ['すいようび']),
  entry(5, 'vocabulary', 5, '食べる', ['To Eat'], ['たべる']),
  entry(6, 'kanji', 10, '偉', ['Great', 'Admirable'], ['い']),
  entry(7, 'vocabulary', 2, '大人', ['Adult', 'Grown Up'], ['おとな']),
];
const ids = (query: string) => searchSubjects(entries, query).map((e) => e.id);

describe('searchSubjects', () => {
  test('empty query finds nothing', () => {
    expect(ids('  ')).toEqual([]);
  });

  test('meaning: exact before partial, radical → kanji → vocab within a level', () => {
    expect(ids('water')).toEqual([1, 2, 3]);
    expect(ids('Wat')).toEqual([1, 2, 3]);
  });

  test('a later word beats the middle of a word', () => {
    // "eat" is the start of a word in "to eat", and only inside "great".
    expect(ids('eat')).toEqual([5, 6]);
  });

  test('alternative meanings count, below primary ones', () => {
    expect(ids('grown')).toEqual([7]);
    expect(ids('admirable')).toEqual([6]);
  });

  test('romaji searches readings', () => {
    // みず is the vocab's primary reading but only the kanji's secondary one.
    expect(ids('mizu')).toEqual([3, 2]);
    expect(ids('suiyoubi')).toEqual([4]);
  });

  test('kana and characters', () => {
    expect(ids('みず')).toEqual([3, 2]);
    expect(ids('ミズ')).toEqual([3, 2]);
    expect(ids('水')).toEqual([1, 2, 3, 4]);
    expect(ids('曜')).toEqual([4]);
  });
});

describe('toSearchEntry', () => {
  test('primary first, whitelist kept, blacklist and unaccepted dropped, katakana → hiragana', () => {
    const subject = {
      id: 9,
      object: 'vocabulary',
      data: {
        level: 4,
        characters: 'テレビ',
        meanings: [
          { meaning: 'Television', primary: false, accepted_answer: true },
          { meaning: 'TV', primary: true, accepted_answer: true },
          { meaning: 'Telly', primary: false, accepted_answer: false },
        ],
        auxiliary_meanings: [
          { meaning: 'Tube', type: 'whitelist' },
          { meaning: 'Radio', type: 'blacklist' },
        ],
        readings: [{ reading: 'テレビ', primary: true, accepted_answer: true }],
      },
    } as unknown as Subject;
    const e = toSearchEntry(subject);
    expect(e.meaning).toBe('TV');
    expect(e.meanings).toEqual(['tv', 'television', 'tube']);
    expect(e.readings).toEqual(['てれび']);
    expect(e.reading).toBe('テレビ');
  });
});
