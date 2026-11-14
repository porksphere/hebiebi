/// <reference types="bun" />
import { describe, expect, test } from 'bun:test';

import { parsePatternsOfUse } from './patterns-of-use';

// Trimmed from https://www.wanikani.com/vocabulary/大人: the page's <template> copies (empty), then
// the real tabs and panels.
const PAGE = `
<template data-template-name="patternsOfUsePattern">
  <a class="subject-collocations__pattern-name" data-collocations-target="pattern" role="tab" lang="ja" href="#"></a>
</template>
<template data-template-name="patternsOfUseCollocationItem">
  <li class="subject-collocations__pattern-collocation" data-collocations-target="sentences" role="tabpanel" hidden="hidden"></li>
</template>
<div class="subject-collocations" data-controller="collocations">
  <div class="subject-collocations__pattern-names">
    <a class="subject-collocations__pattern-name" data-action="collocations#changePattern" aria-controls="collocations-4517272-0" aria-selected="true" role="tab" lang="ja" href="#">大人に〜</a>
    <a class="subject-collocations__pattern-name" aria-controls="collocations-4517272-1" aria-selected="false" role="tab" lang="ja" href="#">大人の〜</a>
  </div>
  <ul class="subject-collocations__pattern-collocations">
    <li class="subject-collocations__pattern-collocation" id="collocations-4517272-0" role="tabpanel">
      <div class="context-sentences">
        <p class="wk-text" lang="ja" data-japanese="">大人になりたい</p>
        <p class="wk-text" data-english="">want to become an adult, want to become mature</p>
      </div>
      <div class="context-sentences">
        <p class="wk-text" lang="ja" data-japanese="">大人になる</p>
        <p class="wk-text" data-english="">become an adult &amp; mature</p>
      </div>
    </li>
    <li class="subject-collocations__pattern-collocation" id="collocations-4517272-1" role="tabpanel" hidden="hidden">
      <div class="context-sentences">
        <p class="wk-text" lang="ja" data-japanese="">大人のマナー</p>
        <p class="wk-text" data-english="">adult manners</p>
      </div>
    </li>
  </ul>
</div>
<section class="subject-section">
  <div class="context-sentences"><p lang="ja" data-japanese="">これは文です。</p><p data-english="">Not a pattern.</p></div>
</section>`;

describe('parsePatternsOfUse', () => {
  test('reads each pattern with its combinations, skipping templates', () => {
    expect(parsePatternsOfUse(PAGE)).toEqual([
      {
        pattern: '大人に〜',
        combinations: [
          { ja: '大人になりたい', en: 'want to become an adult, want to become mature' },
          { ja: '大人になる', en: 'become an adult & mature' },
        ],
      },
      { pattern: '大人の〜', combinations: [{ ja: '大人のマナー', en: 'adult manners' }] },
    ]);
  });

  test('a page without patterns', () => {
    expect(parsePatternsOfUse('<html><body>kanji page</body></html>')).toEqual([]);
  });
});
