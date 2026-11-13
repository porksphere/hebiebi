import { Alert } from 'react-native';

import { hasPartialAnswers, type ReviewSession } from '@/lib/review/use-review-session';

/** Ends the session, asking first only when that would throw away part-answered items. */
export function confirmEndSession(session: ReviewSession) {
  if (!hasPartialAnswers(session.state)) return session.end();
  Alert.alert(
    'End this session?',
    'Finished items are already saved. Items you’ve only partly answered will come back next time.',
    [
      { text: 'Keep Going', style: 'cancel' },
      { text: 'End Session', style: 'destructive', onPress: session.end },
    ],
  );
}
