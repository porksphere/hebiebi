// Keeps search-index.ts's slim copy of every subject on the phone. Built once (about ten requests
// of 1,000 subjects), then topped up with only what changed since, using `updated_after`.

import { File, Paths } from 'expo-file-system';

import type { WaniKaniClient } from './client';
import { toSearchEntry, type SearchEntry } from './search-index';

/** Bump when SearchEntry changes shape, to rebuild old caches. */
const VERSION = 1;

interface CachedIndex {
  version: number;
  /** When the last sync started, for the next `updated_after`. */
  syncedAt: string;
  entries: SearchEntry[];
}

const file = () => new File(Paths.document, 'search-index.json');

/** What's on the phone, if anything; synchronous so a screen can show it on its first frame. */
export function readCachedIndex(): SearchEntry[] | undefined {
  return readCache()?.entries;
}

function readCache(): CachedIndex | null {
  try {
    const f = file();
    if (!f.exists) return null;
    const cached = JSON.parse(f.textSync()) as CachedIndex;
    return cached.version === VERSION ? cached : null;
  } catch {
    return null;
  }
}

/** The index, brought up to date. Offline with a cache, the cache is good enough. */
export async function syncIndex(client: WaniKaniClient): Promise<SearchEntry[]> {
  const cached = readCache();
  const startedAt = new Date().toISOString();
  let changed;
  try {
    changed = await client.getAllSubjects(cached?.syncedAt);
  } catch (error) {
    if (cached) return cached.entries;
    throw error;
  }
  if (cached && changed.length === 0) return cached.entries;

  const byId = new Map((cached?.entries ?? []).map((e) => [e.id, e]));
  for (const subject of changed) {
    if (subject.data.hidden_at) byId.delete(subject.id);
    else byId.set(subject.id, toSearchEntry(subject));
  }
  const entries = [...byId.values()];
  const next: CachedIndex = { version: VERSION, syncedAt: startedAt, entries };
  // Not saved means it's rebuilt next time; nothing worse.
  file().write(JSON.stringify(next)).catch(() => {});
  return entries;
}
