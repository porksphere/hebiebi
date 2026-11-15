// Asks before something that can't be taken back. The system alert on a phone; see confirm.web.ts.

import { Alert } from 'react-native';

export interface ConfirmOptions {
  title: string;
  message: string;
  /** The destructive button's label. */
  confirm: string;
  cancel?: string;
  onConfirm: () => void;
}

export function confirmDestructive({ title, message, confirm, cancel = 'Cancel', onConfirm }: ConfirmOptions) {
  Alert.alert(title, message, [
    { text: cancel, style: 'cancel' },
    { text: confirm, style: 'destructive', onPress: onConfirm },
  ]);
}
