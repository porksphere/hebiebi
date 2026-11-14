// Just enough HTML reading for WaniKani's public item pages (see subject-page-cache.ts). Pure, so
// the parsers built on it can be unit-tested.

const ENTITIES: Record<string, string> = { amp: '&', quot: '"', apos: "'", lt: '<', gt: '>', nbsp: ' ' };

export function decodeEntities(input: string) {
  return input.replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (whole, code: string) => {
    if (code[0] === '#') {
      const n = code[1] === 'x' || code[1] === 'X' ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return Number.isFinite(n) ? String.fromCodePoint(n) : whole;
    }
    return ENTITIES[code.toLowerCase()] ?? whole;
  });
}

/** An attribute's decoded value from an opening tag, or null if it isn't there. */
export function attribute(tag: string, name: string) {
  const match = new RegExp(`\\s${name}\\s*=\\s*("([^"]*)"|'([^']*)')`, 'i').exec(tag);
  return match ? decodeEntities(match[2] ?? match[3] ?? '') : null;
}

/** Whether a class attribute lists `name` (as a whole class, not a prefix of another). */
export function hasClass(tag: string, name: string) {
  return (attribute(tag, 'class') ?? '').split(/\s+/).includes(name);
}

/** Text content: tags dropped, entities decoded, whitespace collapsed. */
export function textOf(html: string) {
  return decodeEntities(html.replace(/<[^>]*>/g, '')).replace(/\s+/g, ' ').trim();
}

/** The page without its `<template>` copies, which hold empty, placeholder versions of the markup. */
export function withoutTemplates(html: string) {
  return html.replace(/<template\b[\s\S]*?<\/template>/gi, '');
}
