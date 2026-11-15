import { useNavigation } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useLayoutEffect, useRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { spacing, useTheme, type Palette } from '@/theme';

import type { HeaderAction } from './header-actions';

export type { HeaderAction };

/**
 * Web: `Stack.Toolbar` draws nothing here, which left the desktop app with no way to wrap up or
 * end a session, close an item's page or save a note. So the buttons go in the header's own
 * left/right slot instead.
 *
 * The slot is only set again when a button's look changes (setting it on every render would
 * re-render the navigator, and with it this screen, forever); presses always reach the latest
 * handlers. Taking the buttons away empties the slot.
 */
export function HeaderActions({ placement, actions }: { placement: 'left' | 'right'; actions: HeaderAction[] }) {
  const navigation = useNavigation();
  const theme = useTheme();
  const latest = useRef(actions);
  useLayoutEffect(() => {
    latest.current = actions;
  });
  const look = JSON.stringify([
    theme.scheme,
    actions.map((a) => [a.label, a.webIcon, a.done, a.selected, a.disabled]),
  ]);

  useLayoutEffect(() => {
    const slot = placement === 'left' ? 'headerLeft' : 'headerRight';
    const shown = latest.current.map(({ onPress: _, ...rest }, i) => ({ ...rest, i }));
    navigation.setOptions({
      [slot]: () => (
        <View style={[styles.row, placement === 'left' ? styles.left : styles.right]} {...KEEP_FOCUS}>
          {shown.map((a) => (
            <ActionButton key={a.label} action={a} theme={theme} onPress={() => latest.current[a.i]?.onPress()} />
          ))}
        </View>
      ),
    });
    return () => navigation.setOptions({ [slot]: undefined });
    // `look` stands for everything the buttons show; `theme` is part of it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigation, placement, look]);

  return null;
}

/**
 * A click on a header button leaves the keyboard where it was: without this the button takes focus
 * on mouse-down, and wrapping up mid-answer took the keyboard away from the answer field. The
 * press itself still happens; only the browser's focus move is stopped. (A View passes onMouseDown
 * through on web; React Native's types don't list it.)
 */
const KEEP_FOCUS = { onMouseDown: (e: MouseEvent) => e.preventDefault() } as object;

function ActionButton({
  action,
  theme,
  onPress,
}: {
  action: Omit<HeaderAction, 'onPress'>;
  theme: Palette;
  onPress: () => void;
}) {
  const color = action.disabled ? theme.textSecondary : theme.text;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={action.label}
      accessibilityState={{ disabled: action.disabled, selected: action.selected }}
      disabled={action.disabled}
      onPress={onPress}
      style={({ hovered, pressed }: { hovered?: boolean; pressed: boolean }) => [
        action.webIcon ? styles.icon : styles.text,
        { backgroundColor: action.selected ? theme.surfaceStrong : hovered && !action.disabled ? theme.surface : 'transparent' },
        { opacity: pressed ? 0.5 : action.disabled ? 0.5 : 1 },
      ]}>
      {action.webIcon ? (
        <SymbolView name={{ web: action.webIcon }} size={22} tintColor={color} />
      ) : (
        <Text style={[styles.label, { color, fontWeight: action.done ? '600' : '400' }]}>{action.label}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  left: { marginLeft: spacing.sm },
  right: { marginRight: spacing.sm },
  icon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  text: { height: 36, paddingHorizontal: spacing.sm, borderRadius: 18, justifyContent: 'center' },
  label: { fontSize: 17 },
});
