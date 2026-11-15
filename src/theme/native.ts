import type { ColorValue } from 'react-native';

import type { Palette } from './index';

/** The background behind the platform's grouped forms, so RN content above a form blends in. */
export function groupedBackground(theme: Palette & { scheme: 'light' | 'dark' }): ColorValue {
  return theme.scheme === 'dark' ? '#000000' : '#F7F7F7';
}

/** Text on a surface the system draws (the tab bar's accessory). Elsewhere that's the theme's. */
export function systemLabel(theme: Palette, secondary = false): ColorValue {
  return secondary ? theme.textSecondary : theme.text;
}
