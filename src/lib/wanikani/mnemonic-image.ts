// WaniKani's radical illustrations (added from January 2025) aren't in the API. They're only on the
// public item page (`document_url`), as
//   <wk-mnemonic-image src="https://files.wanikani.com/<id>" aria-label="<description>"
//                      style="aspect-ratio: 1/1;">
// so the page is fetched when a radical is opened and parsed here. Fetching and the device cache live
// in mnemonic-image-cache.ts; this file stays free of native modules so it can be unit-tested.

export interface MnemonicImage {
  url: string;
  description: string;
  aspectRatio: number;
}

const IMAGE_HOST = 'https://files.wanikani.com/';

const ENTITIES: Record<string, string> = { amp: '&', quot: '"', apos: "'", lt: '<', gt: '>', nbsp: ' ' };
function decodeEntities(input: string) {
  return input.replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (whole, code: string) => {
    if (code[0] === '#') {
      const n = code[1] === 'x' || code[1] === 'X' ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return Number.isFinite(n) ? String.fromCodePoint(n) : whole;
    }
    return ENTITIES[code.toLowerCase()] ?? whole;
  });
}

function attribute(tag: string, name: string) {
  const match = new RegExp(`\\s${name}\\s*=\\s*("([^"]*)"|'([^']*)')`, 'i').exec(tag);
  return match ? decodeEntities(match[2] ?? match[3] ?? '') : null;
}

/**
 * The first real illustration on an item page. The page also carries `<template>` copies with an
 * empty src and `${…}` placeholders, which are skipped.
 */
export function parseMnemonicImage(html: string): MnemonicImage | null {
  for (const [tag] of html.matchAll(/<wk-mnemonic-image\b[^>]*>/gi)) {
    const src = attribute(tag, 'src');
    if (!src?.startsWith(IMAGE_HOST)) continue;
    const ratio = /aspect-ratio:\s*([\d.]+)\s*\/\s*([\d.]+)/i.exec(attribute(tag, 'style') ?? '');
    const aspectRatio = ratio ? Number(ratio[1]) / Number(ratio[2]) : 1;
    return {
      url: src,
      description: attribute(tag, 'aria-label') ?? '',
      aspectRatio: Number.isFinite(aspectRatio) && aspectRatio > 0 ? aspectRatio : 1,
    };
  }
  return null;
}
