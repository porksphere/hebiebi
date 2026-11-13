// Search over every subject. WaniKani's API has no text search, so the app keeps a slim copy of
// all ~9,000 subjects on the phone (search-index-cache.ts) and searches it here. Pure, so it's
// unit-tested.

import { isJapanese, isRomaji, toHiragana } from 'wanakana';

import type { Subject, SubjectType } from './types';

export interface SearchEntry {
  id: number;
  type: SubjectType;
  level: number;
  /** null for a radical that's only an image. */
  characters: string | null;
  /** The radical's SVG, when it has no characters. */
  imageUrl: string | null;
  meaning: string;
  /** Primary first; every meaning that counts as right, lower-cased for matching. */
  meanings: string[];
  /** Primary first, in hiragana (katakana readings converted) for matching. */
  readings: string[];
  /** The primary reading as WaniKani writes it, for display. */
  reading: string | null;
}

export function toSearchEntry(subject: Subject): SearchEntry {
  const d = subject.data;
  const meanings = [...d.meanings]
    .sort((a, b) => Number(b.primary) - Number(a.primary))
    .filter((m) => m.accepted_answer)
    .map((m) => m.meaning);
  for (const aux of d.auxiliary_meanings) if (aux.type === 'whitelist') meanings.push(aux.meaning);
  const readings =
    'readings' in d && d.readings
      ? [...d.readings].sort((a, b) => Number(b.primary) - Number(a.primary)).map((r) => r.reading)
      : // Kana-only vocabulary is its own reading.
        subject.object === 'kana_vocabulary' && d.characters
        ? [d.characters]
        : [];
  const image =
    subject.object === 'radical' && !d.characters
      ? (subject.data.character_images.find((i) => i.content_type === 'image/svg+xml') ??
        subject.data.character_images[0])
      : undefined;
  return {
    id: subject.id,
    type: subject.object,
    level: d.level,
    characters: d.characters,
    imageUrl: image?.url ?? null,
    meaning: d.meanings.find((m) => m.primary)?.meaning ?? meanings[0] ?? '',
    meanings: meanings.map((m) => m.toLowerCase()),
    readings: readings.map((r) => toHiragana(r)),
    reading: readings[0] ?? null,
  };
}

/** Lower is better: an exact match, then a match at the start of a word, then anywhere. */
function matchScore(haystack: string, needle: string): number | null {
  if (haystack === needle) return 0;
  if (haystack.startsWith(needle)) return 1;
  const at = haystack.indexOf(needle);
  if (at < 0) return null;
  // The start of a later word ("to eat" for "eat") beats the middle of one ("great").
  return /[\s\-/(]/.test(haystack[at - 1]) ? 2 : 3;
}

function best(values: string[], needle: string) {
  let top: number | null = null;
  values.forEach((value, i) => {
    const score = matchScore(value, needle);
    // An alternative meaning or a secondary reading ranks just below the primary one.
    if (score !== null) top = Math.min(top ?? Infinity, score + (i === 0 ? 0 : 0.5));
  });
  return top;
}

const TYPE_ORDER: Record<SubjectType, number> = { radical: 0, kanji: 1, vocabulary: 2, kana_vocabulary: 2 };

/**
 * Finds subjects by meaning ("water"), reading as kana or romaji ("mizu", "みず"), or characters
 * ("水"). Best matches first; ties go to the lower level.
 */
export function searchSubjects(entries: SearchEntry[], rawQuery: string, limit = 60): SearchEntry[] {
  const query = rawQuery.trim().toLowerCase().replace(/\s+/g, ' ');
  if (!query) return [];

  const japanese = isJapanese(query.replace(/\s/g, ''));
  // Romaji is tried as a reading too ("mizu" → みず). English that happens to be valid romaji
  // ("tame") still prefers meanings: a reading match ranks a little below an equal meaning match.
  const kana = japanese ? toHiragana(query) : isRomaji(query) ? toHiragana(query.replace(/\s/g, '')) : null;
  const kanaIsReal = kana !== null && isJapanese(kana);

  const scored: { entry: SearchEntry; score: number }[] = [];
  for (const entry of entries) {
    let score: number | null = null;
    if (japanese) {
      const chars = entry.characters ? matchScore(entry.characters, query) : null;
      const reading = kanaIsReal ? best(entry.readings, kana) : null;
      score = Math.min(chars ?? Infinity, reading ?? Infinity);
    } else {
      const meaning = best(entry.meanings, query);
      const reading = kanaIsReal && query.length >= 2 ? best(entry.readings, kana) : null;
      score = Math.min(meaning ?? Infinity, reading === null ? Infinity : reading + 0.25);
    }
    if (score !== Infinity && score !== null) scored.push({ entry, score });
  }
  scored.sort(
    (a, b) =>
      a.score - b.score ||
      a.entry.level - b.entry.level ||
      TYPE_ORDER[a.entry.type] - TYPE_ORDER[b.entry.type] ||
      a.entry.id - b.entry.id,
  );
  return scored.slice(0, limit).map((s) => s.entry);
}
