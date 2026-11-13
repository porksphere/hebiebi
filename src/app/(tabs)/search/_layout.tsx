import { Stack } from 'expo-router';
import { Platform } from 'react-native';

export default function SearchStack() {
  return (
    <Stack screenOptions={{ headerLargeTitle: true, headerTransparent: Platform.OS === 'ios' }}>
      <Stack.Screen name="index" options={{ title: 'Search' }} />
    </Stack>
  );
}
