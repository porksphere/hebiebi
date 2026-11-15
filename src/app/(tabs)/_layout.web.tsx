import { Tabs } from 'expo-router/js-tabs';
import { SymbolView, type AndroidSymbol } from 'expo-symbols';
import type { ColorValue } from 'react-native';

import { useTheme } from '@/theme';

// Web (the desktop app): NativeTabs' web bar is a pill fixed over the top of the page, on top of
// each tab's header and its title. The window is phone-shaped, so the tabs go along the bottom as
// they do on a phone, as a plain bar in the theme's colours. The icons are the Material ones the
// native layout gives Android (`md`), which SymbolView draws on web from its own bundled font.
function icon(name: AndroidSymbol) {
  return function TabIcon({ color, size }: { color: ColorValue; size: number }) {
    return <SymbolView name={{ web: name }} tintColor={color} size={size} />;
  };
}

export default function TabsLayout() {
  const theme = useTheme();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.text,
        tabBarInactiveTintColor: theme.textSecondary,
        tabBarStyle: { backgroundColor: theme.background, borderTopColor: theme.border, height: 58 },
        // The label box is only as tall as its font, so it clipped the descenders (the "y" of Today).
        tabBarLabelStyle: { fontSize: 11, lineHeight: 16, height: 16 },
      }}>
      <Tabs.Screen name="(home)" options={{ title: 'Today', tabBarIcon: icon('home') }} />
      <Tabs.Screen name="levels" options={{ title: 'Levels', tabBarIcon: icon('grid_view') }} />
      <Tabs.Screen name="settings" options={{ title: 'Settings', tabBarIcon: icon('settings') }} />
      <Tabs.Screen name="search" options={{ title: 'Search', tabBarIcon: icon('search') }} />
    </Tabs>
  );
}
