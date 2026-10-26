import { useColorScheme, useWindowDimensions } from 'react-native';

const light = {
  background: '#FAF7F2',
  surface: '#FFFFFF',
  surfaceAlt: '#F3EEE6',
  border: '#E7E0D6',
  text: '#1F1B16',
  textMuted: '#6B6259',
  primary: '#C2410C',
  onPrimary: '#FFFFFF',
  liked: '#15803D',
  likedBg: '#DCFCE7',
  disliked: '#B91C1C',
  dislikedBg: '#FEE2E2',
  mixedBg: '#FEF3C7',
  star: '#D97706',
  danger: '#B91C1C',
  // Charts (categorical slots validated for CVD + contrast on the card surface).
  chart1: '#2A78D6',
  chart2: '#EB6834',
  chartGrid: '#EEE8DF',
  warning: '#B45309',
  warningBg: '#FEF3C7',
};

export type Palette = typeof light;

const dark: Palette = {
  background: '#141210',
  surface: '#1E1B18',
  surfaceAlt: '#29251F',
  border: '#36312B',
  text: '#F5EFE6',
  textMuted: '#A89F94',
  primary: '#FB923C',
  onPrimary: '#1A0F05',
  liked: '#4ADE80',
  likedBg: '#14351F',
  disliked: '#F87171',
  dislikedBg: '#3B1717',
  mixedBg: '#3A2E10',
  star: '#FBBF24',
  danger: '#F87171',
  chart1: '#3987E5',
  chart2: '#D95926',
  chartGrid: '#2C2722',
  warning: '#FBBF24',
  warningBg: '#3A2E10',
};

export function useColors(): Palette {
  return useColorScheme() === 'dark' ? dark : light;
}

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const radius = { sm: 8, md: 12, lg: 16, pill: 999 } as const;

/** Content never stretches wider than this on big screens. */
export const MAX_CONTENT_WIDTH = 1100;

export type Breakpoint = 'phone' | 'tablet' | 'desktop';

/**
 * phone   < 700px   → single column, bottom navigation
 * tablet  700–1099  → sidebar, two panes on the restaurant page
 * desktop ≥ 1100    → sidebar, card grid with three columns
 */
export function useBreakpoint() {
  const { width } = useWindowDimensions();
  const bp: Breakpoint = width >= 1100 ? 'desktop' : width >= 700 ? 'tablet' : 'phone';
  return {
    bp,
    isPhone: bp === 'phone',
    isWide: bp !== 'phone',
    columns: bp === 'desktop' ? 3 : bp === 'tablet' ? 2 : 1,
  };
}
