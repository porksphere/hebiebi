// Writes waiting to reach WaniKani, persisted so a dropped connection or a closed app doesn't lose
// them. Each item carries whatever timestamp it needs, recorded when it was queued, so a late send
// still records when the thing actually happened. Used for reviews (review/submissions.ts) and
// finished lessons (lessons/starts.ts).

import { File, Paths } from 'expo-file-system';

import { WaniKaniError, type WaniKaniClient } from './wanikani/client';

export interface OutboxFlushResult<T, R> {
  sent: R[];
  /** Refused by WaniKani (422: the item can't take this any more): dropped, not retried. */
  rejected: { item: T; message: string }[];
  /** Still queued: network trouble, or a token without the permission this needs. */
  remaining: number;
  error: WaniKaniError | Error | null;
}

export function createOutbox<T, R>(
  fileName: string,
  send: (client: WaniKaniClient, item: T) => Promise<R>,
) {
  const tag = fileName.replace(/\.json$/, '');
  let file: File | null = null;
  let pending: T[] | null = null;
  let flushing: Promise<OutboxFlushResult<T, R>> | null = null;

  function load(): T[] {
    if (pending) return pending;
    file ??= new File(Paths.document, fileName);
    try {
      pending = file.exists ? (JSON.parse(file.textSync()) as T[]) : [];
    } catch {
      pending = [];
    }
    return pending;
  }

  async function save() {
    try {
      await file?.write(JSON.stringify(pending ?? []));
    } catch (e) {
      console.warn(`[${tag}] could not persist the queue`, e);
    }
  }

  return {
    count: () => load().length,

    async enqueue(item: T) {
      load().push(item);
      await save();
    },

    /** Sends queued items oldest first. Concurrent calls share one run. */
    flush(client: WaniKaniClient): Promise<OutboxFlushResult<T, R>> {
      flushing ??= (async () => {
        const result: OutboxFlushResult<T, R> = { sent: [], rejected: [], remaining: 0, error: null };
        const queue = load();
        while (queue.length > 0) {
          const item = queue[0];
          try {
            result.sent.push(await send(client, item));
            queue.shift();
          } catch (e) {
            // 422: WaniKani won't take it (already done elsewhere, not available, …). Retrying
            // won't change that, so drop it rather than block the queue forever.
            if (e instanceof WaniKaniError && e.status === 422) {
              result.rejected.push({ item, message: e.message });
              queue.shift();
              continue;
            }
            result.error = e as Error;
            break;
          }
        }
        await save();
        result.remaining = queue.length;
        return result;
      })().finally(() => {
        flushing = null;
      });
      return flushing;
    },
  };
}
