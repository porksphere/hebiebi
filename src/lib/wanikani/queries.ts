import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useClient } from '../auth';
import { PASSING_STAGE, SRS_GROUPS, type SrsGroup } from '../srs';
import type { Subject, UserPreferences } from './types';

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

/** Items per SRS group, from `total_count` of one filtered request per group. */
export function useSrsCounts() {
  const client = useClient();
  return useQuery({
    queryKey: ['srs-counts'],
    queryFn: async () => {
      const counts = await Promise.all(
        SRS_GROUPS.map((g) => client.countAssignments({ srs_stages: g.stages, hidden: false })),
      );
      return Object.fromEntries(SRS_GROUPS.map((g, i) => [g.key, counts[i]])) as Record<SrsGroup, number>;
    },
    staleTime: 10 * 60_000,
  });
}

/** Kanji passed at the user's current level: 90% of them is what levels you up. */
export function useLevelProgress(level: number | undefined) {
  const client = useClient();
  return useQuery({
    queryKey: ['level-progress', level],
    enabled: level !== undefined,
    queryFn: async () => {
      const [subjects, assignments] = await Promise.all([
        client.getSubjectsByLevel(level!, ['kanji']),
        client.getAssignments({ levels: level!, subject_types: 'kanji', hidden: false }),
      ]);
      const total = subjects.length;
      const passed = assignments.filter((a) => a.data.passed_at || a.data.srs_stage >= PASSING_STAGE).length;
      return { total, passed, required: Math.ceil(total * 0.9) };
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
      };
    },
  });
}
