import { confirmDestructive } from '@/lib/confirm';
import { hasPartialAnswers, type ReviewSession } from '@/lib/review/use-review-session';

/**
 * Ends the session, asking first only when that would throw away part-answered items. `end` is
 * what ending means here; the review screen closes itself first and ends the session once it's gone.
 */
export function confirmEndSession(session: ReviewSession, end: () => void = session.end) {
  if (!hasPartialAnswers(session.state)) return end();
  confirmDestructive({
    title: 'End this session?',
    message: 'Finished items are already saved. Items you’ve only partly answered will come back next time.',
    confirm: 'End Session',
    cancel: 'Keep Going',
    onConfirm: end,
  });
}
