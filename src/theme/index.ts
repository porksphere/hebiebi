import { useColorScheme } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAppearance } from '@/lib/appearance';

// Monochrome: white on black in dark mode, black on white in light mode. The only hues in the app
// are the answer states (they carry information, so they stay) and WaniKani's item-type colours
// (TYPE_COLORS).
const palette = {
  light: {
    background: '#FFFFFF',
    surface: '#F2F2F2',
    surfaceStrong: '#E4E4E4',
    text: '#000000',
    textSecondary: '#6B6B6B',
    border: '#D6D6D6',
    inverseBackground: '#000000',
    inverseText: '#FFFFFF',
    correct: '#1F9D55',
    incorrect: '#D93B3B',
  },
  dark: {
    background: '#000000',
    surface: '#141414',
    surfaceStrong: '#262626',
    text: '#FFFFFF',
    textSecondary: '#9A9A9A',
    border: '#2E2E2E',
    inverseBackground: '#FFFFFF',
    inverseText: '#000000',
    correct: '#34C76F',
    incorrect: '#FF5C5C',
  },
} as const;

export type Palette = { [K in keyof (typeof palette)['light']]: string };

export function useTheme(): Palette & { scheme: 'light' | 'dark' } {
  const system = useColorScheme() === 'dark' ? 'dark' : 'light';
  // The choice from Settings wins outright, without waiting for the system to report the override.
  const choice = useAppearance();
  const scheme = choice === 'auto' ? system : choice;
  return { ...palette[scheme], scheme };
}

export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 } as const;

/**
 * A screen's side margins: the usual 16, plus whatever the system keeps at that edge (a nav bar
 * down the side of a folded phone, a notch in landscape). Everything a screen shows sits inside
 * these, except what scrolls sideways, backgrounds, and list dividers, which run to the trailing
 * edge as native lists do.
 */
export function useGutters() {
  const insets = useSafeAreaInsets();
  const left = insets.left + spacing.md;
  const right = insets.right + spacing.md;
  return { left, right, insetLeft: insets.left, insetRight: insets.right, padding: { paddingLeft: left, paddingRight: right } };
}

/**
 * WaniKani's colours for item types, which its users read at a glance. Used sparingly: dots and
 * tints where you browse (search, level and item pages, mnemonics), and the review answer field
 * before it's graded. Never as big fills elsewhere.
 */
/**
 * A type colour as a see-through tint over the page, which softens it to a pastel (on white) or a
 * deep muted shade (on black) while keeping its hue. `strength` is 0–1.
 */
export function typeTint(type: keyof typeof TYPE_COLORS, strength: number) {
  return withAlpha(TYPE_COLORS[type], strength);
}

/** A `#RRGGBB` colour at `strength` (0–1) opacity. */
export function withAlpha(hex: string, strength: number) {
  const alpha = Math.round(Math.min(1, Math.max(0, strength)) * 255)
    .toString(16)
    .padStart(2, '0');
  return `${hex}${alpha}`;
}

/** `color` laid over `base` at `strength` (0–1), as one solid `#RRGGBB` (for native chrome). */
export function blend(base: string, color: string, strength: number) {
  const channel = (hex: string, i: number) => parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16);
  return (
    '#' +
    [0, 1, 2]
      .map((i) => Math.round(channel(base, i) + (channel(color, i) - channel(base, i)) * strength))
      .map((n) => n.toString(16).padStart(2, '0'))
      .join('')
  );
}

export const TYPE_COLORS = {
  radical: '#00AAFF',
  kanji: '#FF00AA',
  vocabulary: '#AA00FF',
  kana_vocabulary: '#AA00FF',
} as const;
