// The review screen's haptics, as one vocabulary. Rules they follow:
//   - Each outcome has its own feel, recognisable without looking: crisp = right, dull = wrong.
//   - Short. One clean transient feels precise; long or buzzy patterns feel like an alarm. That's
//     why a miss isn't the system "error" notification, a harsh triple buzz (Face ID failing) that
//     punishes something you'll do dozens of times a session.
//   - Matched to what's on screen: the retry taps land with the field's shake, the item-done
//     crescendo with the shine.
//   - The strongest feel is kept for the rarest good moment (an item done), so it stays special.

import * as Haptics from 'expo-haptics';

const { ImpactFeedbackStyle: Style } = Haptics;

function impact(style: Haptics.ImpactFeedbackStyle) {
  Haptics.impactAsync(style).catch(() => {});
}

function sequence(steps: [delayMs: number, style: Haptics.ImpactFeedbackStyle][]) {
  for (const [delay, style] of steps) {
    if (delay === 0) impact(style);
    else setTimeout(() => impact(style), delay);
  }
}

export const haptics = {
  /** One part right: a single crisp tick. */
  correct: () => impact(Style.Rigid),

  /** A miss: two soft, dull thuds, a gentle "nuh-uh". */
  wrong: () => sequence([[0, Style.Soft], [110, Style.Soft]]),

  /** Not graded, try again: light taps on the field's shake (its swings are 90ms apart). */
  retry: () => sequence([[0, Style.Light], [90, Style.Light], [180, Style.Soft]]),

  /** Both parts right, the item's done: a rising light → medium → heavy, with the shine. */
  itemDone: () => sequence([[0, Style.Light], [70, Style.Medium], [150, Style.Heavy]]),

  /** Moving on to the next question: the faintest tick. */
  next: () => Haptics.selectionAsync().catch(() => {}),

  /** Starting a press-and-hold (undo). */
  holdStart: () => Haptics.selectionAsync().catch(() => {}),

  /** A press-and-hold completing: one firm pop. */
  holdPop: () => impact(Style.Heavy),
};
