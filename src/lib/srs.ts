// SRS stage positions are fixed across WaniKani's systems: 0 lesson, 1–4 Apprentice, 5–6 Guru,
// 7 Master, 8 Enlightened, 9 Burned. Only the intervals differ between systems.

export type SrsGroup = 'apprentice' | 'guru' | 'master' | 'enlightened' | 'burned';

export const SRS_GROUPS: { key: SrsGroup; label: string; stages: number[] }[] = [
  { key: 'apprentice', label: 'Apprentice', stages: [1, 2, 3, 4] },
  { key: 'guru', label: 'Guru', stages: [5, 6] },
  { key: 'master', label: 'Master', stages: [7] },
  { key: 'enlightened', label: 'Enlightened', stages: [8] },
  { key: 'burned', label: 'Burned', stages: [9] },
];

const STAGE_NAMES = [
  'Lesson',
  'Apprentice I',
  'Apprentice II',
  'Apprentice III',
  'Apprentice IV',
  'Guru I',
  'Guru II',
  'Master',
  'Enlightened',
  'Burned',
];

export function stageName(stage: number) {
  return STAGE_NAMES[stage] ?? `Stage ${stage}`;
}

export const PASSING_STAGE = 5;
