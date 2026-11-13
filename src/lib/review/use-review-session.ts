import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';

import { useClient } from '../auth';
import { useUser } from '../wanikani/queries';
import { checkAnswer, type CheckResult } from './answer-checker';
import {
  advance,
  answerCurrent,
  createSession,
  makeItem,
  setWrappingUp,
  skip,
  type ReviewItem,
  type SessionState,
} from './session';
import { enqueueReview, flushReviews, pendingCount } from './submissions';

export type Phase =
  | { kind: 'answering' }
  /** Graded; waiting for the user to move on. */
  | { kind: 'graded'; correct: boolean; result: CheckResult; completedItem: ReviewItem | null };

/** Loads everything a session needs in one go: assignments, their subjects, user synonyms. */
function useSessionData() {
  const client = useClient();
  const queryClient = useQueryClient();
  return useQuery({
    queryKey: ['review-session'],
    staleTime: Infinity,
    gcTime: 0,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    queryFn: async () => {
      const assignments = await client.getAvailableReviews();
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
      return assignments.flatMap((a) => {
        const subject = subjectById.get(a.data.subject_id);
        if (!subject || subject.data.hidden_at) return [];
        return [makeItem(a.id, subject, a.data.srs_stage, synonyms.get(subject.id) ?? [])];
      });
    },
  });
}

export function useReviewSession() {
  const client = useClient();
  const { data: user } = useUser();
  const data = useSessionData();
  const [state, setState] = useState<SessionState | null>(null);
  const [phase, setPhase] = useState<Phase>({ kind: 'answering' });
  /** assignment id → SRS stage after its review, as WaniKani reports it back. */
  const [endingStages, setEndingStages] = useState<Record<number, number>>({});
  const [unsent, setUnsent] = useState(0);
  const [submitError, setSubmitError] = useState<Error | null>(null);

  // Build the session once the data arrives.
  if (data.data && !state && data.data.length > 0) {
    setState(createSession(data.data, { order: user?.preferences.reviews_presentation_order }));
  }

  const sync = useCallback(async () => {
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
    return result;
  }, [client]);

  const submit = useCallback(
    (input: string): CheckResult | null => {
      if (!state?.current || phase.kind !== 'answering') return null;
      const item = state.items[state.current.assignmentId];
      const result = checkAnswer(item.subject, state.current.type, input, item.synonyms);
      if (result.kind === 'retry') return result;
      const correct = result.kind === 'correct';
      const graded = answerCurrent(state, correct);
      setState(graded.state);
      setPhase({ kind: 'graded', correct, result, completedItem: graded.completedItem });
      return result;
    },
    [state, phase],
  );

  /** Moves past a graded answer. A finished item's review is queued and sent now, not before. */
  const next = useCallback(() => {
    if (!state || phase.kind !== 'graded') return;
    const done = phase.completedItem;
    if (done) {
      enqueueReview({
        assignment_id: done.assignmentId,
        incorrect_meaning_answers: done.incorrectMeaning,
        incorrect_reading_answers: done.incorrectReading,
      }).then(() => {
        setUnsent(pendingCount());
        sync();
      });
    }
    setState(advance(state));
    setPhase({ kind: 'answering' });
  }, [state, phase, sync]);

  // These two are wired to native header menu items, which can hold on to the callback from an
  // earlier render. So they read the CURRENT state (functional update, a ref for the phase) rather
  // than closing over it: a stale closure here would restore an old session.
  const phaseRef = useRef(phase);
  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  const skipQuestion = useCallback(() => {
    if (phaseRef.current.kind === 'answering') setState((s) => (s ? skip(s) : s));
  }, []);

  const toggleWrapUp = useCallback(() => {
    setState((s) => (s ? setWrappingUp(s, !s.wrappingUp) : s));
  }, []);

  return {
    loading: data.isPending,
    error: data.error,
    retryLoad: data.refetch,
    empty: data.data?.length === 0,
    state,
    phase,
    submit,
    next,
    skipQuestion,
    toggleWrapUp,
    endingStages,
    unsent,
    submitError,
    sync,
    autoplayAudio: user?.preferences.reviews_autoplay_audio ?? false,
  };
}
