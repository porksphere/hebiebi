import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';

import { useAuth } from '../auth';
import { describeError, type WaniKaniClient } from '../wanikani/client';
import { showToast } from '../toast';
import { checkAnswer, hasReading, type CheckResult } from './answer-checker';
import {
  advance,
  answerCurrent,
  createSession,
  isItemDone,
  makeItem,
  setWrappingUp,
  type ReviewItem,
  type SessionState,
} from './session';
import { enqueueReview, flushReviews, pendingCount } from './submissions';

// The session lives here, above the navigator, not in the review screen: closing the screen only
// minimises it, and the home screen and tab bar show it until it's finished or ended.

export type Phase =
  | { kind: 'answering' }
  /**
   * Graded; waiting for the user to move on. `answer` is kept so a resumed screen can show it, and
   * `before` is the session as it was, for undo (possible until Next, since nothing's sent before).
   */
  | {
      kind: 'graded';
      correct: boolean;
      result: CheckResult;
      answer: string;
      completedItem: ReviewItem | null;
      before: SessionState;
    };

const SESSION_KEY = ['review-session'] as const;

/**
 * Everything a session needs, in one go: the account (fetched fresh, so the review order is the
 * one set right now, here or on the website), assignments, their subjects, and user synonyms.
 */
async function loadSession(client: WaniKaniClient, queryClient: ReturnType<typeof useQueryClient>) {
  const [user, assignments] = await Promise.all([client.getUser(), client.getAvailableReviews()]);
  queryClient.setQueryData(['user'], user);
  const ids = assignments.map((a) => a.data.subject_id);
  const [subjects, materials] = await Promise.all([
    client.getSubjects(ids),
    // Synonyms are a nicety; a failure here shouldn't block reviewing.
    client.getStudyMaterials(ids).catch(() => []),
  ]);
  // Seed the subject cache so opening an item's page mid-review is instant.
  for (const subject of subjects) queryClient.setQueryData(['subject', subject.id], subject);
  const subjectById = new Map(subjects.map((s) => [s.id, s]));
  const synonyms = new Map(materials.map((m) => [m.data.subject_id, m.data.meaning_synonyms]));
  const items = assignments.flatMap((a) => {
    const subject = subjectById.get(a.data.subject_id);
    if (!subject || subject.data.hidden_at) return [];
    return [makeItem(a.id, subject, a.data.srs_stage, synonyms.get(subject.id) ?? [])];
  });
  return { items, order: user.preferences.reviews_presentation_order };
}

function useSessionController() {
  const { state: auth } = useAuth();
  const client = auth.status === 'signedIn' ? auth.client : null;
  const queryClient = useQueryClient();

  /** A session has been started and not yet ended (it may be loading, in progress or finished). */
  const [active, setActive] = useState(false);
  const [state, setState] = useState<SessionState | null>(null);
  /** Bumped when a session ends, so the next one loads afresh and never reuses the old data. */
  const [sessionId, setSessionId] = useState(0);
  const data = useQuery({
    queryKey: [...SESSION_KEY, sessionId],
    // Off once the session is built, so refreshing everything else (pull to refresh, closing the
    // review screen) never reloads a session that's under way.
    enabled: active && !!client && !state,
    staleTime: Infinity,
    gcTime: 0,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    queryFn: () => loadSession(client!, queryClient),
  });
  // Live, so flipping autoplay in Settings mid-session takes effect.
  const user = useQuery({
    queryKey: ['user'],
    enabled: !!client,
    staleTime: 5 * 60_000,
    queryFn: () => client!.getUser(),
  });

  const [phase, setPhase] = useState<Phase>({ kind: 'answering' });
  /** assignment id → SRS stage after its review, as WaniKani reports it back. */
  const [endingStages, setEndingStages] = useState<Record<number, number>>({});
  const [unsent, setUnsent] = useState(0);
  const [submitError, setSubmitError] = useState<Error | null>(null);

  // Build the session once the data arrives.
  if (active && data.data && !state && data.data.items.length > 0) {
    setState(createSession(data.data.items, { order: data.data.order }));
  }

  const sync = useCallback(async () => {
    if (!client) return;
    const result = await flushReviews(client);
    if (result.sent.length) {
      setEndingStages((prev) => {
        const next = { ...prev };
        for (const r of result.sent) next[r.data.assignment_id] = r.data.ending_srs_stage;
        return next;
      });
    }
    setUnsent(result.remaining);
    setSubmitError(result.error);
    if (result.error) {
      // Nothing's lost: they're saved on the phone and retried.
      showToast('Reviews saved, not sent yet', `${describeError(result.error).title}. They’ll be sent automatically.`);
    }
    return result;
  }, [client]);

  const queueReview = useCallback(
    (done: ReviewItem) => {
      enqueueReview({
        assignment_id: done.assignmentId,
        incorrect_meaning_answers: done.incorrectMeaning,
        incorrect_reading_answers: done.incorrectReading,
      }).then(() => {
        setUnsent(pendingCount());
        sync();
      });
    },
    [sync],
  );

  // Stable, so a screen that starts a session on mount doesn't start another when one ends.
  const start = useCallback(() => setActive(true), []);

  const reset = useCallback(() => {
    setActive(false);
    setSessionId((n) => n + 1);
    setState(null);
    setPhase({ kind: 'answering' });
    setEndingStages({});
    setSubmitError(null);
  }, []);

  // `end` reads the phase through a ref so it stays stable: the review screen ends a finished
  // session from an unmount cleanup, which mustn't re-run (and end it early) on every answer.
  const phaseRef = useRef(phase);
  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  const end = useCallback(() => {
    // An answer that finished an item, still on screen: its review counts, so it goes out.
    const current = phaseRef.current;
    if (current.kind === 'graded' && current.completedItem) queueReview(current.completedItem);
    reset();
  }, [queueReview, reset]);

  // Signing out (or into another account) ends it.
  const [owner, setOwner] = useState(client);
  if (owner !== client) {
    setOwner(client);
    reset();
  }

  const submit = useCallback(
    (input: string): CheckResult | null => {
      if (!state?.current || phase.kind !== 'answering') return null;
      const item = state.items[state.current.assignmentId];
      const result = checkAnswer(item.subject, state.current.type, input, item.synonyms);
      if (result.kind === 'retry') return result;
      const correct = result.kind === 'correct';
      const graded = answerCurrent(state, correct);
      setState(graded.state);
      setPhase({ kind: 'graded', correct, result, answer: input, completedItem: graded.completedItem, before: state });
      return result;
    },
    [state, phase],
  );

  /** Moves past a graded answer. A finished item's review is queued and sent now, not before. */
  const next = useCallback(() => {
    if (!state || phase.kind !== 'graded') return;
    if (phase.completedItem) queueReview(phase.completedItem);
    setState(advance(state));
    setPhase({ kind: 'answering' });
  }, [state, phase, queueReview]);

  /** Takes back the last answer. Returns what was typed, to put back in the field. */
  const undo = useCallback((): string | null => {
    if (phase.kind !== 'graded') return null;
    setState(phase.before);
    setPhase({ kind: 'answering' });
    return phase.answer;
  }, [phase]);

  // Wired to a native header button, which can hold on to the callback from an earlier render. So
  // it reads the CURRENT state (a functional update) rather than closing over it: a stale closure
  // here would restore an old session.
  const toggleWrapUp = useCallback(() => {
    setState((s) => (s ? setWrappingUp(s, !s.wrappingUp) : s));
  }, []);

  /** Synonyms changed on an item's page mid-session: later answers for that item accept them. */
  const updateSynonyms = useCallback((subjectId: number, synonyms: string[]) => {
    setState((s) => {
      if (!s) return s;
      const hit = Object.values(s.items).find((i) => i.subject.id === subjectId);
      if (!hit) return s;
      return { ...s, items: { ...s.items, [hit.assignmentId]: { ...hit, synonyms } } };
    });
  }, []);

  return {
    active,
    start,
    end,
    loading: active && data.isPending,
    error: data.error,
    retryLoad: data.refetch,
    empty: data.data?.items.length === 0,
    state,
    phase,
    submit,
    next,
    undo,
    toggleWrapUp,
    updateSynonyms,
    endingStages,
    unsent,
    submitError,
    sync,
    autoplayAudio: user.data?.preferences.reviews_autoplay_audio ?? false,
  };
}

export type ReviewSession = ReturnType<typeof useSessionController>;

const ReviewSessionContext = createContext<ReviewSession | null>(null);

export function ReviewSessionProvider({ children }: { children: ReactNode }) {
  const session = useSessionController();
  return <ReviewSessionContext.Provider value={session}>{children}</ReviewSessionContext.Provider>;
}

export function useReviewSession() {
  const session = useContext(ReviewSessionContext);
  if (!session) throw new Error('useReviewSession needs a ReviewSessionProvider');
  return session;
}

/** Started, with questions still to answer: what the home screen and tab bar offer to resume. */
export function isInProgress(session: ReviewSession) {
  return session.active && !session.error && !session.empty && (session.loading || !!session.state?.current);
}

/** Ending would throw away answers: an item has had one part answered, or something wrong. */
export function hasPartialAnswers(state: SessionState | null) {
  if (!state) return false;
  return Object.values(state.items).some(
    (i) =>
      !isItemDone(i) &&
      (i.incorrectMeaning > 0 || i.incorrectReading > 0 || i.meaningDone || (i.readingDone && hasReading(i.subject))),
  );
}
