// SRS stage positions are fixed across WaniKani's systems: 0 lesson, 1–4 Apprentice, 5–6 Guru,
// 7 Master, 8 Enlightened, 9 Burned. Only the intervals differ between systems.

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
