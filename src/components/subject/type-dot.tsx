import { View } from 'react-native';

import type { SubjectType } from '@/lib/wanikani/types';
import { TYPE_COLORS } from '@/theme';

/** A small dot in the item type's WaniKani colour, set before a type name or a section title. */
export function TypeDot({ type, size = 8 }: { type: SubjectType; size?: number }) {
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no"
      style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: TYPE_COLORS[type] }}
    />
  );
}
