// react-native-web's Alert.alert does nothing at all, so a confirmation built on it never showed
// and its action never ran. The browser's confirm() does it; the desktop app shows it as a native
// dialog. It has no button labels of its own, so the title and message carry the question.

import type { ConfirmOptions } from './confirm';

export type { ConfirmOptions };

export function confirmDestructive({ title, message, onConfirm }: ConfirmOptions) {
  if (window.confirm(`${title}\n\n${message}`)) onConfirm();
}
