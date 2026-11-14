// Keeps the Reviews widget (src/widgets/reviews.tsx) up to date. WaniKani's summary says how many
// reviews unlock at each coming hour, so the widget gets the whole day as a timeline and changes
// on the hour by itself. Called whenever the summary changes.

import { Platform } from 'react-native';

import type { Summary } from './wanikani/types';
import { reviewsTimeline } from './widget-timeline';

export function syncReviewsWidget(summary: Summary) {
  if (Platform.OS !== 'ios') return;
  try {
    // Loaded here, not imported: a build from before the widget existed has no native side for
    // it, and importing would throw as the app starts.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const widget = (require('@/widgets/reviews') as typeof import('@/widgets/reviews')).default;
    widget.updateTimeline(reviewsTimeline(summary));
  } catch (e) {
    if (__DEV__) console.warn('[widget] not updated', e);
  }
}
