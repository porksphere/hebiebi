// The app's appearance: follow the phone, or always light or dark. Saved on the device and applied
// through React Native's Appearance, so native chrome (tab bar, headers, alerts) follows too.

import { Appearance } from 'react-native';

import { localSetting } from './local-setting';

export type AppearanceChoice = 'auto' | 'light' | 'dark';

const setting = localSetting<AppearanceChoice>('appearance', ['auto', 'light', 'dark'], 'auto');
if (setting.get() !== 'auto') Appearance.setColorScheme(setting.get());

export function setAppearance(next: AppearanceChoice) {
  setting.set(next);
  Appearance.setColorScheme(next);
}

export const useAppearance = setting.use;
