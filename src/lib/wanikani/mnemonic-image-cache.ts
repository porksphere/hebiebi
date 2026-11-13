// Fetches and caches WaniKani's radical illustrations (see mnemonic-image.ts for where they come
// from). Cached on the device: found images forever (the file ids are permanent), "no image" for a
// few weeks, since more radicals get illustrations over time. It relies on undocumented HTML, so
// every failure just means no image. The SVG file itself is cached by expo-image.

import { File, Paths } from 'expo-file-system';

import { parseMnemonicImage, type MnemonicImage } from './mnemonic-image';
import type { Subject } from './types';

type CacheEntry = { image: MnemonicImage | null; checkedAt: number };

const RECHECK_MISSING_MS = 21 * 24 * 60 * 60 * 1000;

// --- Device cache -----------------------------------------------------------------------------

let cacheFile: File | null = null;
let cache: Record<string, CacheEntry> | null = null;

function loadCache() {
  if (cache) return cache;
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

/** Radicals only: no other subject type has illustrations. */
export function mayHaveMnemonicImage(subject: Subject) {
  return subject.object === 'radical';
}

export async function getMnemonicImage(subject: Subject): Promise<MnemonicImage | null> {
  if (!mayHaveMnemonicImage(subject)) return null;
  const entries = loadCache();
  const hit = entries[subject.id];
  if (hit && (hit.image || Date.now() - hit.checkedAt < RECHECK_MISSING_MS)) return hit.image;

  try {
    // A public page: no token, no cookies.
    const res = await fetch(subject.data.document_url, { credentials: 'omit', headers: { Accept: 'text/html' } });
    if (!res.ok) return hit?.image ?? null;
    const image = parseMnemonicImage(await res.text());
    entries[subject.id] = { image, checkedAt: Date.now() };
    saveCache();
    return image;
  } catch {
    // Offline, blocked, or the page changed shape: no image this time, and nothing cached, so the
    // next open tries again.
    return null;
  }
}
