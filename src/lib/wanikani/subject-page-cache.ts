// What WaniKani shows on an item's public page (`document_url`) but not in the API: a radical's
// illustration (mnemonic-image.ts) and a vocabulary item's Patterns of Use (patterns-of-use.ts).
// One fetch of the page gives both. Cached on the device: whatever was found, forever (the content
// is stable); "nothing there" for a few weeks, since WaniKani keeps adding illustrations. It relies
// on undocumented HTML, so every failure just means nothing extra. Illustration SVGs themselves are
// cached by expo-image.

import { File, Paths } from 'expo-file-system';

import { parseMnemonicImage, type MnemonicImage } from './mnemonic-image';
import { parsePatternsOfUse, type PatternOfUse } from './patterns-of-use';
import type { Subject } from './types';

export interface SubjectPageExtras {
  image: MnemonicImage | null;
  patterns: PatternOfUse[];
}

// `patterns` is absent on entries written before patterns were read (radicals only, so nothing lost).
type CacheEntry = { image: MnemonicImage | null; patterns?: PatternOfUse[]; checkedAt: number };

const RECHECK_MISSING_MS = 21 * 24 * 60 * 60 * 1000;
const NOTHING: SubjectPageExtras = { image: null, patterns: [] };

// --- Device cache -----------------------------------------------------------------------------

let cacheFile: File | null = null;
let cache: Record<string, CacheEntry> | null = null;

function loadCache() {
  if (cache) return cache;
  // The file name predates patterns, when only illustrations were kept.
  cacheFile ??= new File(Paths.document, 'mnemonic-images.json');
  try {
    cache = cacheFile.exists ? (JSON.parse(cacheFile.textSync()) as Record<string, CacheEntry>) : {};
  } catch {
    cache = {};
  }
  return cache;
}

function saveCache() {
  cacheFile?.write(JSON.stringify(cache ?? {})).catch(() => {});
}

// --- Which subjects -------------------------------------------------------------------------

/** Only radicals have illustrations. */
export function mayHaveMnemonicImage(subject: Subject) {
  return subject.object === 'radical';
}

/** Only vocabulary (kana-only included) has Patterns of Use. */
export function mayHavePatternsOfUse(subject: Subject) {
  return subject.object === 'vocabulary' || subject.object === 'kana_vocabulary';
}

function found(subject: Subject, extras: SubjectPageExtras) {
  return mayHaveMnemonicImage(subject) ? !!extras.image : extras.patterns.length > 0;
}

// --- Fetching -------------------------------------------------------------------------------

// Concurrent asks for one subject (the illustration and the patterns hooks, say) share one fetch.
const inFlight = new Map<number, Promise<SubjectPageExtras>>();

export function getSubjectPageExtras(subject: Subject): Promise<SubjectPageExtras> {
  if (!mayHaveMnemonicImage(subject) && !mayHavePatternsOfUse(subject)) return Promise.resolve(NOTHING);
  const entries = loadCache();
  const hit = entries[subject.id];
  // An entry from before patterns were read is still complete for a radical.
  if (hit && (hit.patterns !== undefined || !mayHavePatternsOfUse(subject))) {
    const extras = { image: hit.image, patterns: hit.patterns ?? [] };
    if (found(subject, extras) || Date.now() - hit.checkedAt < RECHECK_MISSING_MS) return Promise.resolve(extras);
  }

  let request = inFlight.get(subject.id);
  if (!request) {
    request = fetchExtras(subject, hit).finally(() => inFlight.delete(subject.id));
    inFlight.set(subject.id, request);
  }
  return request;
}

async function fetchExtras(subject: Subject, hit: CacheEntry | undefined): Promise<SubjectPageExtras> {
  const previous = { image: hit?.image ?? null, patterns: hit?.patterns ?? [] };
  try {
    // A public page: no token, no cookies.
    const res = await fetch(subject.data.document_url, { credentials: 'omit', headers: { Accept: 'text/html' } });
    if (!res.ok) return previous;
    const html = await res.text();
    const extras: SubjectPageExtras = {
      image: mayHaveMnemonicImage(subject) ? parseMnemonicImage(html) : null,
      patterns: mayHavePatternsOfUse(subject) ? parsePatternsOfUse(html) : [],
    };
    loadCache()[subject.id] = { ...extras, checkedAt: Date.now() };
    saveCache();
    return extras;
  } catch {
    // Offline, blocked, or the page changed shape: nothing extra this time, and nothing cached,
    // so the next open tries again.
    return previous;
  }
}
