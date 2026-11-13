import { useColorScheme } from 'react-native';

// Monochrome: white on black in dark mode, black on white in light mode. The only hues in the app
// are the answer states — they carry information, so they stay.
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
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  return { ...palette[scheme], scheme };
}

export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 } as const;
