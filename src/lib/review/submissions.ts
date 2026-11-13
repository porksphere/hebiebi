// Reviews waiting to reach WaniKani, persisted so a dropped connection or a closed app doesn't lose
// answered work. Each carries its own `created_at`, so a late submission still records when the
// review actually happened.

import { File, Paths } from 'expo-file-system';

import { WaniKaniError, type WaniKaniClient } from '../wanikani/client';
import type { CreateReviewBody, CreateReviewResponse } from '../wanikani/types';

const file = new File(Paths.document, 'pending-reviews.json');

let pending: CreateReviewBody[] | null = null;
let flushing: Promise<FlushResult> | null = null;

function load(): CreateReviewBody[] {
  if (pending) return pending;
  try {
    pending = file.exists ? (JSON.parse(file.textSync()) as CreateReviewBody[]) : [];
  } catch {
    pending = [];
  }
  return pending;
}

async function save() {
  try {
    await file.write(JSON.stringify(pending ?? []));
  } catch (e) {
    console.warn('[submissions] could not persist pending reviews', e);
  }
}

export function pendingCount() {
  return load().length;
}

export async function enqueueReview(review: CreateReviewBody) {
  load().push({ ...review, created_at: review.created_at ?? new Date().toISOString() });
  await save();
}

export interface FlushResult {
  sent: CreateReviewResponse[];
  /** Rejected by WaniKani (e.g. not available for review any more): dropped, not retried. */
  rejected: { review: CreateReviewBody; message: string }[];
  /** Still queued: network trouble or a token without `reviews:create`. */
  remaining: number;
  error: WaniKaniError | Error | null;
}

/** Sends queued reviews oldest first. Concurrent calls share one run. */
export function flushReviews(client: WaniKaniClient): Promise<FlushResult> {
  flushing ??= (async () => {
    const result: FlushResult = { sent: [], rejected: [], remaining: 0, error: null };
    const queue = load();
    while (queue.length > 0) {
      const review = queue[0];
      try {
        result.sent.push(await client.createReview(review));
        queue.shift();
      } catch (e) {
        // 422: the assignment can't take this review (already reviewed elsewhere, not available,
        // …). Retrying won't change that, so drop it rather than block the queue forever.
        if (e instanceof WaniKaniError && e.status === 422) {
          result.rejected.push({ review, message: e.message });
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
}
