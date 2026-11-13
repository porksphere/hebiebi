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
      <NativeTabs.Trigger name="levels">
        <NativeTabs.Trigger.Label>Levels</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'square.grid.2x2', selected: 'square.grid.2x2.fill' }} md="grid_view" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="settings">
        <NativeTabs.Trigger.Label>Settings</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="gearshape" md="settings" />
      </NativeTabs.Trigger>
      {/* The system search tab: on iOS 26 its own round button at the end of the tab bar. */}
      <NativeTabs.Trigger name="search" role="search">
        <NativeTabs.Trigger.Label>Search</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="magnifyingglass" md="search" />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
