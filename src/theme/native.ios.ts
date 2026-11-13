import { PlatformColor, type ColorValue } from 'react-native';

import type { Palette } from './index';

/** SwiftUI's grouped `Form` sits on systemGroupedBackground; RN content above it should match. */
export function groupedBackground(_theme: Palette & { scheme: 'light' | 'dark' }): ColorValue {
  return PlatformColor('systemGroupedBackground');
}
