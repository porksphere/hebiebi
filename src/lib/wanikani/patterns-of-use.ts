// A vocabulary item's Patterns of Use and Common Word Combinations aren't in the API. They're only
// on the public item page (`document_url`): one tab per pattern,
//   <a class="subject-collocations__pattern-name" aria-controls="collocations-<n>-<i>">大人に〜</a>
// and one panel per pattern with its combinations,
//   <li class="subject-collocations__pattern-collocation" id="collocations-<n>-<i>">
//     <div class="context-sentences"><p data-japanese>大人になる</p><p data-english>become an adult</p></div>
// Fetching and the device cache live in subject-page-cache.ts; this file stays free of native
// modules so it can be unit-tested.

import { attribute, hasClass, textOf, withoutTemplates } from './html';

export interface WordCombination {
  ja: string;
  en: string;
}

export interface PatternOfUse {
  /** The pattern, e.g. 「大人に〜」. */
  pattern: string;
  combinations: WordCombination[];
}

/** Every pattern on the page, in the page's order. Empty when there are none (or the page changed). */
export function parsePatternsOfUse(html: string): PatternOfUse[] {
  const page = withoutTemplates(html);

  // Panel id → its combinations.
  const panels = new Map<string, WordCombination[]>();
  for (const match of page.matchAll(/(<li\b[^>]*>)([\s\S]*?)<\/li>/gi)) {
    const [, tag, body] = match;
    if (!hasClass(tag, 'subject-collocations__pattern-collocation')) continue;
    const id = attribute(tag, 'id');
    if (!id) continue;
    const combinations: WordCombination[] = [];
    for (const sentence of body.split(/<div\b[^>]*class="[^"]*\bcontext-sentences\b[^"]*"[^>]*>/i).slice(1)) {
      const ja = /<p\b[^>]*\sdata-japanese\b[^>]*>([\s\S]*?)<\/p>/i.exec(sentence);
      const en = /<p\b[^>]*\sdata-english\b[^>]*>([\s\S]*?)<\/p>/i.exec(sentence);
      if (ja && en && textOf(ja[1])) combinations.push({ ja: textOf(ja[1]), en: textOf(en[1]) });
    }
    panels.set(id, combinations);
  }

  const patterns: PatternOfUse[] = [];
  for (const match of page.matchAll(/(<a\b[^>]*>)([\s\S]*?)<\/a>/gi)) {
    const [, tag, body] = match;
    if (!hasClass(tag, 'subject-collocations__pattern-name')) continue;
    const panel = attribute(tag, 'aria-controls');
    const pattern = textOf(body);
    if (!panel || !pattern) continue;
    patterns.push({ pattern, combinations: panels.get(panel) ?? [] });
  }
  return patterns;
}
