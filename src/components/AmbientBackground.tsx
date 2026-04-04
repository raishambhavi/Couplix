import React from 'react';
import { StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

import { usePairing } from '../state/PairingContext';
import { useTheme } from '../state/ThemeContext';

/** Fixed % positions so hearts read as a soft field (deterministic, no layout jump). */
const HEART_FIELD: { top: `${number}%`; left: `${number}%`; size: number; opacity: number }[] = [
  { top: '4%', left: '6%', size: 11, opacity: 0.14 },
  { top: '7%', left: '22%', size: 9, opacity: 0.1 },
  { top: '5%', left: '78%', size: 12, opacity: 0.16 },
  { top: '9%', left: '92%', size: 8, opacity: 0.11 },
  { top: '14%', left: '12%', size: 10, opacity: 0.12 },
  { top: '18%', left: '44%', size: 14, opacity: 0.15 },
  { top: '16%', left: '68%', size: 9, opacity: 0.1 },
  { top: '22%', left: '88%', size: 11, opacity: 0.13 },
  { top: '28%', left: '4%', size: 9, opacity: 0.09 },
  { top: '32%', left: '30%', size: 12, opacity: 0.14 },
  { top: '30%', left: '55%', size: 8, opacity: 0.1 },
  { top: '34%', left: '72%', size: 10, opacity: 0.11 },
  { top: '40%', left: '18%', size: 13, opacity: 0.15 },
  { top: '44%', left: '48%', size: 9, opacity: 0.1 },
  { top: '42%', left: '82%', size: 11, opacity: 0.12 },
  { top: '50%', left: '8%', size: 10, opacity: 0.11 },
  { top: '52%', left: '38%', size: 12, opacity: 0.14 },
  { top: '54%', left: '64%', size: 9, opacity: 0.09 },
  { top: '58%', left: '90%', size: 10, opacity: 0.12 },
  { top: '64%', left: '14%', size: 11, opacity: 0.13 },
  { top: '68%', left: '42%', size: 8, opacity: 0.08 },
  { top: '66%', left: '76%', size: 13, opacity: 0.14 },
  { top: '74%', left: '6%', size: 9, opacity: 0.1 },
  { top: '78%', left: '52%', size: 12, opacity: 0.15 },
  { top: '76%', left: '28%', size: 10, opacity: 0.11 },
  { top: '82%', left: '72%', size: 9, opacity: 0.1 },
  { top: '86%', left: '44%', size: 11, opacity: 0.12 },
  { top: '90%', left: '16%', size: 10, opacity: 0.11 },
  { top: '92%', left: '84%', size: 12, opacity: 0.13 },
];

function HeartBackdrop({ heartColor }: { heartColor: string }) {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {HEART_FIELD.map((h, i) => (
        <View
          key={i}
          style={{
            position: 'absolute',
            top: h.top,
            left: h.left,
            opacity: h.opacity,
          }}
        >
          <Ionicons name="heart" size={h.size} color={heartColor} />
        </View>
      ))}
    </View>
  );
}

export function AmbientBackground() {
  const { colors } = useTheme();
  const { coupleMode } = usePairing();
  const isLongDistance = coupleMode === 'longDistance';
  const tint = isLongDistance
    ? colors.mode === 'dark'
      ? 'rgba(118,98,255,0.12)'
      : 'rgba(118,98,255,0.08)'
    : colors.mode === 'dark'
    ? 'rgba(255,172,114,0.12)'
    : 'rgba(255,172,114,0.08)';

  const roseWash =
    colors.mode === 'dark'
      ? (['rgba(236,72,153,0.28)', 'rgba(168,85,247,0.08)', 'transparent'] as const)
      : (['rgba(252,231,243,0.95)', 'rgba(255,246,250,0.5)', 'transparent'] as const);

  const heartColor = colors.mode === 'dark' ? '#F9A8D4' : '#EC4899';

  return (
    <View pointerEvents="none" style={[styles.root, { backgroundColor: colors.background }]}>
      <LinearGradient
        colors={roseWash}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0.85 }}
        pointerEvents="none"
        style={styles.roseSky}
      />
      <HeartBackdrop heartColor={heartColor} />
      <View pointerEvents="none" style={[styles.tint, { backgroundColor: tint }]} />
      <View pointerEvents="none" style={[styles.blob1, { backgroundColor: colors.cardGlow }]} />
      <View pointerEvents="none" style={[styles.blob2, { backgroundColor: colors.cardGlow }]} />
      <View pointerEvents="none" style={[styles.blob3, { backgroundColor: colors.cardGlow }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
  },
  roseSky: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    height: 520,
  },
  tint: {
    ...StyleSheet.absoluteFillObject,
  },
  blob1: {
    position: 'absolute',
    width: 240,
    height: 240,
    borderRadius: 140,
    left: -80,
    top: 60,
  },
  blob2: {
    position: 'absolute',
    width: 280,
    height: 280,
    borderRadius: 160,
    right: -120,
    top: 160,
  },
  blob3: {
    position: 'absolute',
    width: 260,
    height: 260,
    borderRadius: 150,
    left: 40,
    bottom: -140,
  },
});

