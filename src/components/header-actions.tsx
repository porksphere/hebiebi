import { Stack } from 'expo-router';
import type { AndroidSymbol } from 'expo-symbols';
import type { SFSymbol } from 'sf-symbols-typescript';

/** A button in a screen's header. See header-actions.web.tsx for how web draws it. */
export interface HeaderAction {
  /** What it does, read out; the button's text when it has no icon. */
  label: string;
  /** SF Symbol, on iOS. */
  icon?: SFSymbol;
  /** Material symbol, on web. */
  webIcon?: AndroidSymbol;
  onPress: () => void;
  /** The confirming action (Done, Save): iOS's prominent style. */
  done?: boolean;
  /** A toggle that's on (wrap up). */
  selected?: boolean;
  disabled?: boolean;
}

/** iOS: the native header toolbar (`Stack.Toolbar`), which web doesn't draw at all. */
export function HeaderActions({ placement, actions }: { placement: 'left' | 'right'; actions: HeaderAction[] }) {
  return (
    <Stack.Toolbar placement={placement}>
      {actions.map((a) =>
        a.icon ? (
          <Stack.Toolbar.Button
            key={a.label}
            icon={a.icon}
            accessibilityLabel={a.label}
            selected={a.selected}
            disabled={a.disabled}
            onPress={a.onPress}
          />
        ) : (
          <Stack.Toolbar.Button
            key={a.label}
            variant={a.done ? 'done' : undefined}
            disabled={a.disabled}
            onPress={a.onPress}>
            {a.label}
          </Stack.Toolbar.Button>
        ),
      )}
    </Stack.Toolbar>
  );
}
