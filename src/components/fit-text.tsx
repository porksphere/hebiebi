import { useState } from 'react';
import { StyleSheet, Text, View, type StyleProp, type TextProps, type TextStyle, type ViewStyle } from 'react-native';

/**
 * One line of text that shrinks until it fits `width`, however far that takes, and is never cut
 * short with "…". `adjustsFontSizeToFit` can't promise that: react-native-web ignores it, and on
 * iOS it gives up at `minimumFontScale` and truncates.
 *
 * A hidden copy at the full size, in a box too wide to constrain it, measures the text's natural
 * width; the shown copy takes the font size that scales that to `width`. The shown copy waits for
 * the measurement of the text it's showing, so a new text never flashes at the old one's size.
 */
export function FitText({
  children,
  width,
  style,
  containerStyle,
  ...textProps
}: Omit<TextProps, 'children' | 'style' | 'numberOfLines'> & {
  children: string;
  width: number;
  style: StyleProp<TextStyle>;
  containerStyle?: StyleProp<ViewStyle>;
}) {
  const [measured, setMeasured] = useState<{ text: string; width: number } | null>(null);
  const flat = StyleSheet.flatten(style) ?? {};
  const fontSize = flat.fontSize ?? 14;
  const ready = measured?.text === children && measured.width > 0;
  const scale = ready ? Math.min(1, width / measured.width) : 1;

  return (
    <View style={[{ width }, containerStyle]}>
      <View style={styles.measureBox} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <Text
          style={[style, styles.measure]}
          numberOfLines={1}
          onLayout={(e) => setMeasured({ text: children, width: e.nativeEvent.layout.width })}>
          {children}
        </Text>
      </View>
      <Text
        {...textProps}
        style={[
          style,
          { fontSize: fontSize * scale, opacity: ready ? (flat.opacity ?? 1) : 0 },
          flat.lineHeight ? { lineHeight: flat.lineHeight * scale } : null,
        ]}
        numberOfLines={1}>
        {children}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  // Wide enough that nothing realistic wraps or truncates in it, and out of sight.
  measureBox: { position: 'absolute', top: 0, left: 0, width: 10000, alignItems: 'flex-start', opacity: 0 },
  measure: { position: 'relative', alignSelf: 'flex-start' },
});
