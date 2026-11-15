import { describe, expect, test } from 'bun:test';

import { nextStage } from './srs';

// WaniKani's examples and edges: https://docs.api.wanikani.com (SRS stage calculation).
describe('nextStage', () => {
  test('all right goes up one', () => {
    expect(nextStage(1, 0, 0)).toBe(2);
    expect(nextStage(4, 0, 0)).toBe(5);
    expect(nextStage(8, 0, 0)).toBe(9);
  });

  test('never past burned', () => {
    expect(nextStage(9, 0, 0)).toBe(9);
  });

  test('below Guru, down by half the wrong answers, rounded up', () => {
    expect(nextStage(4, 1, 0)).toBe(3);
    expect(nextStage(4, 1, 1)).toBe(3);
    expect(nextStage(4, 2, 1)).toBe(2);
  });

  test('from Guru up, twice as far', () => {
    expect(nextStage(6, 1, 0)).toBe(4);
    expect(nextStage(8, 1, 2)).toBe(4);
  });

  test('never below Apprentice I', () => {
    expect(nextStage(2, 5, 5)).toBe(1);
    expect(nextStage(1, 1, 0)).toBe(1);
  });
});
