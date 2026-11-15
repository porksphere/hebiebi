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
export const BURNED_STAGE = 9;

/**
 * The stage a review moves an item to, by WaniKani's published rule: all right and it goes up one;
 * otherwise down by half its wrong answers (meaning and reading together), rounded up, and twice
 * that from Guru up, but never below Apprentice I. WaniKani's reply to the review carries the same
 * number (`ending_srs_stage`), but it can come much later; this is for showing it at once.
 */
export function nextStage(stage: number, incorrectMeaning: number, incorrectReading: number) {
  const incorrect = incorrectMeaning + incorrectReading;
  if (incorrect === 0) return Math.min(stage + 1, BURNED_STAGE);
  const penalty = stage >= PASSING_STAGE ? 2 : 1;
  return Math.max(1, stage - Math.ceil(incorrect / 2) * penalty);
}
