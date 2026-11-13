import { toHiragana, toKana } from 'wanakana';

import type { AnySubjectData, Reading, Subject } from '../wanikani/types';

export type QuestionType = 'meaning' | 'reading';

export type CheckResult =
  /** `exact: false` means it was accepted through typo tolerance. */
  | { kind: 'correct'; exact: boolean; matched: string }
  | { kind: 'incorrect' }
  /** Not graded: the input is shaken back with a hint and the user tries again, no penalty. */
  | { kind: 'retry'; message: string };

// --- Meaning ----------------------------------------------------------------------------------

export function normalizeMeaning(input: string) {
  return input
    .toLowerCase()
    .replace(/[‘’]/g, "'")
    .replace(/[-‐–—_/]/g, ' ')
    .replace(/[.,'"!?()]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function levenshtein(a: string, b: string) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
    }
    prev = cur;
  }
  return prev[b.length];
}

/** How many edits a meaning of this length tolerates: none for short words, more for long ones. */
export function typoTolerance(length: number) {
  if (length <= 3) return 0;
  if (length <= 5) return 1;
  if (length <= 7) return 2;
  return 2 + Math.floor(length / 7);
}

function readingsOf(subject: Subject): Reading[] {
  return (subject.data as AnySubjectData).readings ?? [];
}

export function acceptedMeanings(subject: Subject, synonyms: string[] = []) {
  return [
    ...subject.data.meanings.filter((m) => m.accepted_answer).map((m) => m.meaning),
    ...subject.data.auxiliary_meanings.filter((m) => m.type === 'whitelist').map((m) => m.meaning),
    ...synonyms,
  ];
}

export function checkMeaning(subject: Subject, input: string, synonyms: string[] = []): CheckResult {
  const answer = normalizeMeaning(input);
  if (!answer) return { kind: 'retry', message: '' };

  if (/[぀-ヿ一-龯]/.test(input)) {
    return { kind: 'retry', message: 'We want the meaning, in English.' };
  }

  const accepted = acceptedMeanings(subject, synonyms).map(normalizeMeaning);
  const blacklist = subject.data.auxiliary_meanings
    .filter((m) => m.type === 'blacklist')
    .map((m) => normalizeMeaning(m.meaning));

  if (blacklist.includes(answer)) return { kind: 'incorrect' };

  const exact = accepted.find((m) => m === answer);
  if (exact) return { kind: 'correct', exact: true, matched: exact };

  // Typed a reading in romaji instead of the meaning (e.g. "inu" for 犬).
  const asKana = toHiragana(answer.replace(/\s/g, ''));
  if (readingsOf(subject).some((r) => toHiragana(r.reading) === asKana)) {
    return { kind: 'retry', message: 'That’s the reading. We want the meaning.' };
  }

  // Verbs are asked as "to …": "eat" for 食べる gets a nudge rather than a fail.
  if (!answer.startsWith('to ') && accepted.some((m) => m === `to ${answer}`)) {
    return { kind: 'retry', message: 'Almost — verb meanings start with “to”.' };
  }

  let best: { meaning: string; distance: number } | null = null;
  for (const meaning of accepted) {
    const distance = levenshtein(answer, meaning);
    if (distance <= typoTolerance(meaning.length) && (!best || distance < best.distance)) {
      best = { meaning, distance };
    }
  }
  if (!best) return { kind: 'incorrect' };

  // A typo that lands closer to a blacklisted meaning than to an accepted one is that wrong answer.
  if (blacklist.some((b) => levenshtein(answer, b) < best.distance)) return { kind: 'incorrect' };

  return { kind: 'correct', exact: false, matched: best.meaning };
}

// --- Reading ----------------------------------------------------------------------------------

/** Katakana → hiragana by code point, keeping ー (wanakana's toHiragana expands it to a vowel). */
export function katakanaToHiragana(input: string) {
  return input.replace(/[ァ-ヶ]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0x60));
}

const SMALL_TO_LARGE: Record<string, string> = {
  ぁ: 'あ',
  ぃ: 'い',
  ぅ: 'う',
  ぇ: 'え',
  ぉ: 'お',
  っ: 'つ',
  ゃ: 'や',
  ゅ: 'ゆ',
  ょ: 'よ',
  ゎ: 'わ',
};
function enlargeSmallKana(input: string) {
  return input.replace(/[ぁぃぅぇぉっゃゅょゎ]/g, (ch) => SMALL_TO_LARGE[ch] ?? ch);
}

/** Final conversion of what was typed: romaji leftovers (a trailing "n") become kana. */
export function finalizeReadingInput(input: string) {
  return toKana(input.trim().replace(/\s+/g, ''));
}

const READING_TYPE_NAMES = { onyomi: 'on’yomi', kunyomi: 'kun’yomi', nanori: 'nanori' } as const;

export function checkReading(subject: Subject, input: string): CheckResult {
  const typed = finalizeReadingInput(input);
  if (!typed) return { kind: 'retry', message: '' };
  if (/[a-z0-9]/i.test(typed)) {
    return { kind: 'retry', message: 'We want the reading, in kana.' };
  }

  const answer = katakanaToHiragana(typed);
  const readings = readingsOf(subject);
  const norm = (r: Reading) => katakanaToHiragana(r.reading);

  const exact = readings.find((r) => r.accepted_answer && norm(r) === answer);
  if (exact) return { kind: 'correct', exact: true, matched: exact.reading };

  // Kanji: a real reading of the kanji, just not the one this item teaches.
  const other = readings.find((r) => !r.accepted_answer && norm(r) === answer);
  if (other) {
    const wanted = readings.find((r) => r.primary)?.type;
    const name = wanted ? READING_TYPE_NAMES[wanted] : 'other';
    return { kind: 'retry', message: `That’s a reading, but we’re looking for the ${name}.` };
  }

  if (readings.some((r) => r.accepted_answer && enlargeSmallKana(norm(r)) === enlargeSmallKana(answer))) {
    return { kind: 'retry', message: 'Close — check your small kana (ゃ ゅ ょ っ).' };
  }

  return { kind: 'incorrect' };
}

// --- Shared -----------------------------------------------------------------------------------

/** Radicals and kana-only vocabulary are asked for their meaning only. */
export function hasReading(subject: Subject) {
  return subject.object === 'kanji' || subject.object === 'vocabulary';
}

export function checkAnswer(
  subject: Subject,
  type: QuestionType,
  input: string,
  synonyms: string[] = [],
): CheckResult {
  return type === 'meaning' ? checkMeaning(subject, input, synonyms) : checkReading(subject, input);
}
