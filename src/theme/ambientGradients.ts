import type { ThemeMode } from './colors';

/** Same stops as `AmbientBackground` rose sky (scroll area under the notch). */
export const AMBIENT_ROSE_SKY_LIGHT = [
  'rgba(252,231,243,0.95)',
  'rgba(255,246,250,0.5)',
  'transparent',
] as const;

export const AMBIENT_ROSE_SKY_DARK = [
  'rgba(236,72,153,0.28)',
  'rgba(168,85,247,0.08)',
  'transparent',
] as const;

export function ambientRoseSkyColors(mode: ThemeMode): readonly string[] {
  return mode === 'dark' ? AMBIENT_ROSE_SKY_DARK : AMBIENT_ROSE_SKY_LIGHT;
}

/**
 * Tab header + tab bar: same family as the scroll ambient, but the last stop is opaque
 * so short chrome heights (unlike the 520px tall sky layer) never read as flat white/grey.
 */
export function chromeBarGradientColors(mode: ThemeMode): [string, string, string] {
  if (mode === 'dark') {
    return ['rgba(236,72,153,0.32)', 'rgba(20,18,27,0.95)', '#0B0A0F'];
  }
  return ['rgba(252,231,243,0.98)', 'rgba(255,246,250,0.88)', '#FFF7F3'];
}
