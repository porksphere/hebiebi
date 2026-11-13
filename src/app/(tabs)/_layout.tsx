import { NativeTabs } from 'expo-router/native-tabs';

import { SessionAccessory } from '@/components/review/session-accessory';
import { isInProgress, useReviewSession } from '@/lib/review/use-review-session';
import { useTheme } from '@/theme';

export default function TabsLayout() {
  const theme = useTheme();
  const session = useReviewSession();
  return (
    <NativeTabs tintColor={theme.text}>
      {/* A minimised review session, like a music app's now-playing bar. iOS 26+. */}
      {isInProgress(session) ? (
        <NativeTabs.BottomAccessory>
          <SessionAccessory />
        </NativeTabs.BottomAccessory>
      ) : null}
      <NativeTabs.Trigger name="(home)">
        <NativeTabs.Trigger.Label>Today</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'square.stack', selected: 'square.stack.fill' }} md="home" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="settings">
        <NativeTabs.Trigger.Label>Settings</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="gearshape" md="settings" />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
