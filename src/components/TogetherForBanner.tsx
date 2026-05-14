import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { usePairing } from '../state/PairingContext';
import { useTheme } from '../state/ThemeContext';
import { elapsedSinceMet, pad2 } from '../utils/relationshipTime';

type Props = {
  /** When set, user can open Settings to set or change the first-met date */
  onPressEditDate?: () => void;
};

function formatDays(n: number): string {
  if (n < 0) return '00';
  if (n < 100) return pad2(n);
  return String(Math.min(n, 99999));
}

function FlipColumn({
  value,
  label,
  flex,
  digitColor,
  labelColor,
  panelBg,
  rimColor,
}: {
  value: string;
  label: string;
  flex: number;
  digitColor: string;
  labelColor: string;
  panelBg: string;
  rimColor: string;
}) {
  return (
    <View style={[styles.column, { flex }]}>
      <View style={[styles.unitRim, { borderColor: rimColor }]}>
        <View style={[styles.unitWell, { backgroundColor: panelBg }]}>
          <View style={styles.unitFace}>
            <Text
              style={[styles.digits, { color: digitColor }]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.35}
            >
              {value}
            </Text>
          </View>
        </View>
      </View>
      <Text style={[styles.unitLabel, { color: labelColor }]}>{label}</Text>
    </View>
  );
}

export function TogetherForBanner({ onPressEditDate }: Props) {
  const { colors } = useTheme();
  const { metAtMs } = usePairing();
  const [togetherNow, setTogetherNow] = useState(Date.now());

  useEffect(() => {
    if (metAtMs == null) return;
    const id = setInterval(() => setTogetherNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [metAtMs]);

  const togetherElapsed = useMemo(
    () => elapsedSinceMet(metAtMs, togetherNow),
    [metAtMs, togetherNow],
  );

  const isDark = colors.mode === 'dark';

  /** Digits: purple, tuned for contrast on pink-grey panels. */
  const digitColor = isDark ? '#E4C9EF' : '#5B386E';
  const labelColor = isDark ? 'rgba(228, 201, 239, 0.82)' : 'rgba(91, 56, 110, 0.72)';
  /** Inner cell: slightly deeper pink-grey glass. */
  const panelBg = isDark ? 'rgba(72, 56, 68, 0.45)' : 'rgba(200, 168, 186, 0.42)';
  const panelRim = isDark ? 'rgba(200, 160, 185, 0.28)' : 'rgba(168, 128, 152, 0.38)';

  /** Outer counter block: pinkish grey, slightly transparent. */
  const flipFrameBg = isDark ? 'rgba(88, 68, 82, 0.58)' : 'rgba(214, 182, 196, 0.48)';
  const flipFrameBorder = isDark ? 'rgba(216, 137, 167, 0.35)' : 'rgba(200, 120, 150, 0.42)';

  const commonCol = {
    digitColor,
    labelColor,
    panelBg,
    rimColor: panelRim,
  };

  const clock =
    togetherElapsed != null ? (
      <View style={[styles.flipFrame, { backgroundColor: flipFrameBg, borderColor: flipFrameBorder }]}>
        <View style={styles.flipRow}>
          <FlipColumn {...commonCol} value={formatDays(togetherElapsed.totalDays)} label="DAYS" flex={1.15} />
          <View style={styles.gap} />
          <FlipColumn {...commonCol} value={pad2(togetherElapsed.hours)} label="HRS" flex={1} />
          <View style={styles.gap} />
          <FlipColumn {...commonCol} value={pad2(togetherElapsed.minutes)} label="MINS" flex={1} />
          <View style={styles.gap} />
          <FlipColumn {...commonCol} value={pad2(togetherElapsed.seconds)} label="SECS" flex={1} />
        </View>
      </View>
    ) : (
      <View style={[styles.flipFrame, { backgroundColor: flipFrameBg, borderColor: flipFrameBorder }]}>
        <View style={styles.flipRow}>
          <FlipColumn {...commonCol} value="—" label="DAYS" flex={1} />
          <View style={styles.gap} />
          <FlipColumn {...commonCol} value="—" label="HRS" flex={1} />
          <View style={styles.gap} />
          <FlipColumn {...commonCol} value="—" label="MINS" flex={1} />
          <View style={styles.gap} />
          <FlipColumn {...commonCol} value="—" label="SECS" flex={1} />
        </View>
      </View>
    );

  const gradientColors = isDark
    ? ([`rgba(216, 137, 167, 0.18)`, 'rgba(20, 18, 27, 0.96)'] as const)
    : ([`rgba(216, 137, 167, 0.22)`, colors.surface] as const);

  const body = (
    <>
      <Text style={[styles.eyebrow, { color: colors.muted }]}>Together for</Text>
      {clock}
      {togetherElapsed ? null : (
        <Text style={[styles.unitHint, { color: colors.muted }]}>set your first-met date</Text>
      )}
    </>
  );

  const gradient = (
    <LinearGradient
      colors={gradientColors}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.banner, { borderColor: colors.border }]}
    >
      {body}
      {metAtMs == null && onPressEditDate ? (
        <Text style={[styles.tapCue, { color: colors.text }]}>Tap to set in Settings</Text>
      ) : null}
      {metAtMs != null && onPressEditDate ? (
        <Pressable onPress={onPressEditDate} hitSlop={12} accessibilityRole="button">
          <Text style={[styles.editLink, { color: colors.gold }]}>Edit date in Settings</Text>
        </Pressable>
      ) : null}
    </LinearGradient>
  );

  if (metAtMs == null && onPressEditDate) {
    return (
      <Pressable
        onPress={onPressEditDate}
        accessibilityRole="button"
        accessibilityLabel="Set first met date in Settings"
        style={({ pressed }) => [pressed && { opacity: 0.94 }]}
      >
        {gradient}
      </Pressable>
    );
  }

  return gradient;
}

const styles = StyleSheet.create({
  banner: {
    marginTop: 2,
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 14,
    alignItems: 'center',
    borderWidth: 1,
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  flipFrame: {
    width: '100%',
    borderRadius: 14,
    borderWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 8,
  },
  flipRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  gap: { width: 6 },
  column: {
    alignItems: 'center',
    minWidth: 0,
  },
  unitRim: {
    width: '100%',
    borderRadius: 10,
    borderWidth: 1,
    padding: 2,
    minHeight: 54,
  },
  unitWell: {
    borderRadius: 8,
    overflow: 'hidden',
    justifyContent: 'center',
    minHeight: 48,
  },
  unitFace: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 2,
    minHeight: 48,
  },
  digits: {
    fontSize: 25,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
    letterSpacing: 0.5,
  },
  unitLabel: {
    marginTop: 8,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.05,
    textAlign: 'center',
  },
  unitHint: {
    fontSize: 13,
    fontWeight: '800',
    marginTop: 10,
    textAlign: 'center',
  },
  tapCue: {
    fontSize: 12,
    fontWeight: '800',
    marginTop: 12,
    opacity: 0.88,
  },
  editLink: {
    fontSize: 12,
    fontWeight: '800',
    marginTop: 12,
    textDecorationLine: 'underline',
  },
});
