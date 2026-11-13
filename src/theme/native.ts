import type { ColorValue } from 'react-native';

import type { Palette } from './index';

/** The background behind the platform's grouped forms, so RN content above a form blends in. */
export function groupedBackground(theme: Palette & { scheme: 'light' | 'dark' }): ColorValue {
  return theme.scheme === 'dark' ? '#000000' : '#F7F7F7';
}
