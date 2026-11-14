// Reviews waiting to reach WaniKani, persisted so a dropped connection or a closed app doesn't lose
// answered work. Each carries its own `created_at`, so a late submission still records when the
// review actually happened.

import { createOutbox } from '../outbox';
import type { WaniKaniClient, WaniKaniError } from '../wanikani/client';
import type { CreateReviewBody, CreateReviewResponse } from '../wanikani/types';

const outbox = createOutbox<CreateReviewBody, CreateReviewResponse>('pending-reviews.json', (client, review) =>
  client.createReview(review),
);

export function pendingCount() {
  return outbox.count();
}

export async function enqueueReview(review: CreateReviewBody) {
  await outbox.enqueue({ ...review, created_at: review.created_at ?? new Date().toISOString() });
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
export async function flushReviews(client: WaniKaniClient): Promise<FlushResult> {
  const { rejected, ...rest } = await outbox.flush(client);
  return { ...rest, rejected: rejected.map(({ item, message }) => ({ review: item, message })) };
}
