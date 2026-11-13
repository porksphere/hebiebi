import { Stack } from 'expo-router';

import { useTheme } from '@/theme';

// Subject pages are their own stack inside a sheet, so tapping a radical/kanji/vocabulary tile pushes
// its page within the sheet (with a back button), and the sheet closes as a whole.
export default function SubjectStack() {
  const theme = useTheme();
  return (
    <Stack
      screenOptions={{
        headerShadowVisible: false,
        headerStyle: { backgroundColor: theme.background },
        headerTintColor: theme.text,
        contentStyle: { backgroundColor: theme.background },
      }}
    />
  );
}
