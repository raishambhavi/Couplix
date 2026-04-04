export type ThemeMode = 'dark' | 'light';

type ThemeColors = {
  mode: ThemeMode;
  background: string;
  surface: string;
  text: string;
  muted: string;
  gold: string;
  gold2: string;
  border: string;
  cardGlow: string;
  danger: string;
};

export const colorsDark: ThemeColors = {
  mode: 'dark',
  background: '#0B0A0F',
  surface: '#14121B',
  text: '#F5F2EB',
  muted: '#A79F9B',
  gold: '#E7C77D',
  gold2: '#D7B56D',
  border: 'rgba(231, 199, 125, 0.35)',
  cardGlow: 'rgba(231, 199, 125, 0.12)',
  danger: '#FF4D6D',
};

export const colorsLight: ThemeColors = {
  mode: 'light',
  background: '#FFF7F3',
  surface: '#FFFFFF',
  text: '#17131A',
  muted: '#6B5F67',
  gold: '#C99B3D',
  gold2: '#B9872F',
  border: 'rgba(201, 155, 61, 0.28)',
  cardGlow: 'rgba(201, 155, 61, 0.12)',
  danger: '#E11D48',
};

export function getColors(mode: ThemeMode): ThemeColors {
  return mode === 'light' ? colorsLight : colorsDark;
}

