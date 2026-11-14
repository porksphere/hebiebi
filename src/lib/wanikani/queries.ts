import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useClient } from '../auth';
import { PASSING_STAGE } from '../srs';
import type { PaperState } from '@/components/paper';
import { orderLessons, type LessonItem } from '../lessons/order';
import { readCachedIndex, syncIndex } from './search-index-cache';
import { getSubjectPageExtras, mayHaveMnemonicImage, mayHavePatternsOfUse } from './subject-page-cache';
import type { Subject, UpdateStudyMaterialBody, UserPreferences } from './types';

export function useUser() {
  const client = useClient();
  return useQuery({ queryKey: ['user'], queryFn: client.getUser, staleTime: 5 * 60_000 });
}

export function useSummary() {
  const client = useClient();
  return useQuery({
    queryKey: ['summary'],
    queryFn: client.getSummary,
    // Reviews unlock on the hour; refreshing every minute keeps the count honest while the app is
    // open, and focus refetch covers coming back to it.
    refetchInterval: 60_000,
  });
}

/**
 * The kanji of the user's current level, in lesson order, each with how far along it is. Passing
 * 90% of them is what levels you up. Seeds the per-subject cache, so tapping one opens at once.
 */
export function useLevelKanji(level: number | undefined) {
  const client = useClient();
  const queryClient = useQueryClient();
  return useQuery({
    queryKey: ['level-kanji', level],
    enabled: level !== undefined,
    queryFn: async () => {
      const [subjects, assignments] = await Promise.all([
        client.getSubjectsByLevel(level!, ['kanji']),
        client.getAssignments({ levels: level!, subject_types: 'kanji', hidden: false }),
      ]);
      const states = new Map<number, PaperState>();
      for (const { data: a } of assignments) {
        if (!a.unlocked_at) continue;
        // Once passed, always passed, even if it has since dropped back to Apprentice.
        states.set(a.subject_id, a.passed_at || a.srs_stage >= PASSING_STAGE ? 'passed' : 'learning');
      }
      for (const s of subjects) queryClient.setQueryData(['subject', s.id], s);
      const kanji = subjects
        .sort((x, y) => x.data.lesson_position - y.data.lesson_position)
        .map((subject) => ({ subject, state: states.get(subject.id) ?? ('locked' as PaperState) }));
      return {
        kanji,
        total: kanji.length,
        passed: kanji.filter((k) => k.state === 'passed').length,
        required: Math.ceil(kanji.length * 0.9),
      };
    },
    staleTime: 10 * 60_000,
  });
}

export function useUpdatePreferences() {
  const client = useClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (prefs: Partial<UserPreferences>) => client.updatePreferences(prefs),
    onSuccess: (user) => queryClient.setQueryData(['user'], user),
  });
}

// --- Subjects ---------------------------------------------------------------------------------

// Subjects change rarely (content edits), so they're cached for the session and fetched by id. Each
// is cached under ['subject', id], whichever request brought it in.
const SUBJECT_STALE = 60 * 60_000;

export function useSubject(id: number) {
  const client = useClient();
  return useQuery({
    queryKey: ['subject', id],
    queryFn: async () => {
      const [subject] = await client.getSubjects([id]);
      if (!subject) throw new Error(`Subject ${id} not found`);
      return subject;
    },
    staleTime: SUBJECT_STALE,
  });
}

/** Several subjects at once, in the order given, reusing any already cached. */
export function useSubjects(ids: number[]) {
  const client = useClient();
  const queryClient = useQueryClient();
  return useQuery({
    queryKey: ['subjects', ids],
    enabled: ids.length > 0,
    queryFn: async () => {
      const cached = new Map<number, Subject>();
      for (const id of ids) {
        const hit = queryClient.getQueryData<Subject>(['subject', id]);
        if (hit) cached.set(id, hit);
      }
      const missing = ids.filter((id) => !cached.has(id));
      if (missing.length) {
        for (const subject of await client.getSubjects(missing)) {
          queryClient.setQueryData(['subject', subject.id], subject);
          cached.set(subject.id, subject);
        }
      }
      return ids.flatMap((id) => (cached.has(id) ? [cached.get(id)!] : []));
    },
    staleTime: SUBJECT_STALE,
  });
}

/** The user's own relationship to a subject: SRS progress, review stats, notes and synonyms. */
export function useSubjectProgress(id: number) {
  const client = useClient();
  return useQuery({
    queryKey: ['subject-progress', id],
    queryFn: async () => {
      const [assignments, stats, materials] = await Promise.all([
        client.getAssignments({ subject_ids: id }),
        client.getReviewStatistics([id]),
        client.getStudyMaterials([id]),
      ]);
      return {
        assignment: assignments[0]?.data ?? null,
        stats: stats[0]?.data ?? null,
        material: materials[0]?.data ?? null,
        /** Needed to change the notes and synonyms: there's one record per subject, updated in place. */
        materialId: materials[0]?.id ?? null,
      };
    },
  });
}

export type SubjectProgress = NonNullable<ReturnType<typeof useSubjectProgress>['data']>;

/**
 * Saves the user's notes or synonyms for a subject: updates the one record if it exists, creates it
 * if not. Only the fields given change. Needs a token with the study materials permissions; a
 * refusal shows as a toast (the root layout's mutation cache), and the caller keeps what was typed.
 */
export function useSaveStudyMaterial(subjectId: number) {
  const client = useClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (changes: UpdateStudyMaterialBody) => {
      const progress = queryClient.getQueryData<SubjectProgress>(['subject-progress', subjectId]);
      let id = progress?.materialId ?? null;
      if (id === null) {
        // Not loaded, or made elsewhere since: look before creating, as a second one is refused.
        const [existing] = await client.getStudyMaterials([subjectId]);
        id = existing?.id ?? null;
      }
      return id === null
        ? client.createStudyMaterial({ subject_id: subjectId, ...changes })
        : client.updateStudyMaterial(id, changes);
    },
    onSuccess: (saved) => {
      queryClient.setQueryData<SubjectProgress>(['subject-progress', subjectId], (old) =>
        old ? { ...old, material: saved.data, materialId: saved.id } : old,
      );
    },
  });
}

/** A radical's illustration, from its public WaniKani page (see subject-page-cache.ts). */
export function useMnemonicImage(subject: Subject) {
  return useQuery({
    queryKey: ['subject-page', subject.id],
    enabled: mayHaveMnemonicImage(subject),
    queryFn: () => getSubjectPageExtras(subject),
    select: (extras) => extras.image,
    staleTime: Infinity,
    retry: false,
  });
}

/**
 * A vocabulary item's Patterns of Use, each with its Common Word Combinations, from its public
 * WaniKani page (see subject-page-cache.ts). Empty when it has none or the page couldn't be read.
 */
export function usePatternsOfUse(subject: Subject) {
  return useQuery({
    queryKey: ['subject-page', subject.id],
    enabled: mayHavePatternsOfUse(subject),
    queryFn: () => getSubjectPageExtras(subject),
    select: (extras) => extras.patterns,
    staleTime: Infinity,
    retry: false,
  });
}

// --- Lessons ----------------------------------------------------------------------------------

/**
 * Everything waiting in the lesson queue, in teaching order, with batch size and autoplay from
 * the account (fetched fresh, so a change on the website counts). Seeds the per-subject cache.
 * Start them in batches of `batchSize` (lessons/order.ts `toBatches`).
 */
export function useLessons() {
  const client = useClient();
  const queryClient = useQueryClient();
  return useQuery({
    queryKey: ['lessons'],
    queryFn: async () => {
      const [user, assignments] = await Promise.all([client.getUser(), client.getLessonAssignments()]);
      queryClient.setQueryData(['user'], user);
      const ids = assignments.map((a) => a.data.subject_id);
      const [subjects, materials] = await Promise.all([
        ids.length ? client.getSubjects(ids) : Promise.resolve([]),
        // Notes and synonyms are a nicety; a failure here shouldn't block lessons.
        ids.length ? client.getStudyMaterials(ids).catch(() => []) : Promise.resolve([]),
      ]);
      for (const subject of subjects) queryClient.setQueryData(['subject', subject.id], subject);
      const subjectById = new Map(subjects.map((s) => [s.id, s]));
      const materialBySubject = new Map(materials.map((m) => [m.data.subject_id, m]));
      const items = assignments.flatMap((a): LessonItem[] => {
        const subject = subjectById.get(a.data.subject_id);
        if (!subject || subject.data.hidden_at) return [];
        const material = materialBySubject.get(subject.id);
        return [
          {
            assignmentId: a.id,
            subject,
            material: material ? (material as LessonItem['material']) : null,
          },
        ];
      });
      return {
        items: orderLessons(items, user.preferences.lessons_presentation_order),
        batchSize: user.preferences.lessons_batch_size,
        autoplayAudio: user.preferences.lessons_autoplay_audio,
      };
    },
  });
}

// --- Browse and search ------------------------------------------------------------------------

/** Every subject in a level, in WaniKani's lesson order. Seeds the per-subject cache too. */
export function useLevelSubjects(level: number) {
  const client = useClient();
  const queryClient = useQueryClient();
  return useQuery({
    queryKey: ['level-subjects', level],
    staleTime: SUBJECT_STALE,
    queryFn: async () => {
      const subjects = await client.getSubjectsByLevel(level);
      for (const s of subjects) queryClient.setQueryData(['subject', s.id], s);
      return subjects.sort((a, b) => a.data.lesson_position - b.data.lesson_position);
    },
  });
}

/** subject id → SRS stage, for the user's assignments in a level (missing = not unlocked yet). */
export function useLevelStages(level: number) {
  const client = useClient();
  return useQuery({
    queryKey: ['level-stages', level],
    queryFn: async () => {
      const assignments = await client.getAssignments({ levels: level });
      return new Map(
        assignments.filter((a) => a.data.unlocked_at).map((a) => [a.data.subject_id, a.data.srs_stage]),
      );
    },
  });
}

/**
 * The search index: what's on the phone straight away, then brought up to date. The first ever
 * load fetches every subject, which takes a few seconds.
 */
export function useSearchIndex() {
  const client = useClient();
  return useQuery({
    queryKey: ['search-index'],
    queryFn: () => syncIndex(client),
    initialData: readCachedIndex,
    // The cached copy is shown at once but still counts as stale, so it's topped up in the background.
    initialDataUpdatedAt: 0,
    staleTime: 6 * 60 * 60_000,
    gcTime: Infinity,
  });
}
