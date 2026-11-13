/// <reference types="bun" />
import { describe, expect, test } from 'bun:test';

import { parseMnemonicImage } from './mnemonic-image';

// Trimmed from https://www.wanikani.com/radicals/power: two <template> copies with placeholders,
// then the real one.
const PAGE = `
<template><wk-mnemonic-image src="" class="x--\${subjectCategory}" aria-label="\${mnemonicImageDescription}" style="aspect-ratio: 1/1;"></template>
<template><wk-mnemonic-image src="" aria-label="\${mnemonicImageDescription}"></template>
<div class='subject-mnemonic-image'>
  <wk-mnemonic-image src="https://files.wanikani.com/ypy204p9q1l2j6g7bg3az7biaeft"
    class="subject-mnemonic-image__image subject-mnemonic-image__image--radical"
    aria-label="Upper body of a muscleman &amp; his &quot;arm&quot;" style="aspect-ratio: 4/3;">
</div>`;

describe('parseMnemonicImage', () => {
  test('skips template placeholders and reads the real image', () => {
    expect(parseMnemonicImage(PAGE)).toEqual({
      url: 'https://files.wanikani.com/ypy204p9q1l2j6g7bg3az7biaeft',
      description: 'Upper body of a muscleman & his "arm"',
      aspectRatio: 4 / 3,
    });
  });
  test('no image on the page', () => {
    expect(parseMnemonicImage('<html><body>kanji page</body></html>')).toBeNull();
  });
  test('ignores images from other hosts', () => {
    expect(parseMnemonicImage('<wk-mnemonic-image src="https://evil.example/x.svg">')).toBeNull();
  });
});
