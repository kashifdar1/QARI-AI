/**
 * Green-led palette with a restrained gold accent (used sparingly — streaks,
 * completed-passage marks — never as a primary action color, to avoid
 * reading as a "reward/gamification-first" product for what is fundamentally
 * a learning tool).
 */
export type ColorScheme = 'light' | 'dark';

export type ThemeColors = {
  background: string;
  surface: string;
  surfaceRaised: string;
  textPrimary: string;
  textMuted: string;
  border: string;
  primary: string;
  primaryPressed: string;
  onPrimary: string;
  accentGold: string;
  success: string;
  warning: string;
  danger: string;
  onDanger: string;
};

const lightColors: ThemeColors = {
  background: '#FBFBF8',
  surface: '#FFFFFF',
  surfaceRaised: '#F2F6F2',
  textPrimary: '#14231A',
  textMuted: '#5B6B60',
  border: '#DDE6DE',
  primary: '#1F6B3B',
  primaryPressed: '#164F2C',
  onPrimary: '#FFFFFF',
  accentGold: '#B8892B',
  success: '#1F6B3B',
  warning: '#B8892B',
  danger: '#B3261E',
  onDanger: '#FFFFFF',
};

const darkColors: ThemeColors = {
  background: '#0E1912',
  surface: '#152219',
  surfaceRaised: '#1C2B21',
  textPrimary: '#EAF2EC',
  textMuted: '#9FB3A6',
  border: '#2B3B31',
  primary: '#4FAE72',
  primaryPressed: '#3C8C59',
  onPrimary: '#0E1912',
  accentGold: '#D9AC57',
  success: '#4FAE72',
  warning: '#D9AC57',
  danger: '#E5615A',
  onDanger: '#2A0705',
};

export const colorSchemes: Record<ColorScheme, ThemeColors> = {
  light: lightColors,
  dark: darkColors,
};

export function colorsFor(scheme: ColorScheme): ThemeColors {
  return colorSchemes[scheme];
}
