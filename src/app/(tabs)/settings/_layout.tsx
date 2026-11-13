import { Stack } from 'expo-router';

import { groupedBackground } from '@/theme/native';
import { useTheme } from '@/theme';

// The screen is a native form (SwiftUI `Form` / Compose), whose scroll view UIKit's large title
// can't track, so the bar is a plain inline one that blends into the form's background.
export default function SettingsStack() {
  const theme = useTheme();
  return (
    <Stack
      screenOptions={{
        headerShadowVisible: false,
        headerStyle: { backgroundColor: groupedBackground(theme) as string },
      }}>
      <Stack.Screen name="index" options={{ title: 'Settings' }} />
    </Stack>
  );
}
