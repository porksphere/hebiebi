import { PlatformColor, type ColorValue } from 'react-native';

import type { Palette } from './index';

/** SwiftUI's grouped `Form` sits on systemGroupedBackground; RN content above it should match. */
export function groupedBackground(_theme: Palette & { scheme: 'light' | 'dark' }): ColorValue {
  return PlatformColor('systemGroupedBackground');
}

/** Text on a surface the system draws (the tab bar's glass accessory): the system's label colours,
 *  which read on that glass in light and dark. */
export function systemLabel(_theme: Palette, secondary = false): ColorValue {
  return PlatformColor(secondary ? 'secondaryLabel' : 'label');
}
