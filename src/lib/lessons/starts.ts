// Finished lessons waiting to reach WaniKani (PUT /assignments/:id/start), persisted like reviews
// (see outbox.ts) so a lesson passed offline still moves the item to reviews later, with the time
// it was actually learned.

import { createOutbox } from '../outbox';
import type { WaniKaniClient, WaniKaniError } from '../wanikani/client';
import type { Assignment, Resource } from '../wanikani/types';

export interface LessonStart {
  assignmentId: number;
  startedAt: string;
}

const outbox = createOutbox<LessonStart, Resource<Assignment, 'assignment'>>(
  'pending-lesson-starts.json',
  (client, start) => client.startAssignment(start.assignmentId, start.startedAt),
);

export function pendingLessonStarts() {
  return outbox.count();
}

/** Queues the item's move to reviews, stamped now. Send it with `flushLessonStarts`. */
export async function enqueueLessonStart(assignmentId: number, startedAt = new Date().toISOString()) {
  await outbox.enqueue({ assignmentId, startedAt });
}

export interface LessonStartFlushResult {
  /** The updated assignments, now at SRS stage 1 with a review time. */
  started: Resource<Assignment, 'assignment'>[];
  /** Refused by WaniKani (already started elsewhere, …): dropped, not retried. */
  rejected: { start: LessonStart; message: string }[];
  /** Still queued: network trouble or a token without `assignments:start`. */
  remaining: number;
  error: WaniKaniError | Error | null;
}

/** Sends queued lesson starts oldest first. Concurrent calls share one run. */
export async function flushLessonStarts(client: WaniKaniClient): Promise<LessonStartFlushResult> {
  const { sent, rejected, remaining, error } = await outbox.flush(client);
  return { started: sent, rejected: rejected.map(({ item, message }) => ({ start: item, message })), remaining, error };
}
