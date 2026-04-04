import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { usePairing } from '../state/PairingContext';
import { elapsedSinceMet, pad2 } from '../utils/relationshipTime';

type Props = {
  /** When set, user can open Settings to set or change the first-met date */
  onPressEditDate?: () => void;
};

export function TogetherForBanner({ onPressEditDate }: Props) {
  const { metAtMs } = usePairing();
  const [togetherNow, setTogetherNow] = useState(Date.now());

  useEffect(() => {
    if (metAtMs == null) return;
    const id = setInterval(() => setTogetherNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [metAtMs]);

  const togetherElapsed = useMemo(
    () => elapsedSinceMet(metAtMs, togetherNow),
    [metAtMs, togetherNow]
  );

  const body = (
    <>
      <Text style={styles.eyebrow}>Together for</Text>
      {togetherElapsed ? (
        <>
          <Text style={styles.number}>{togetherElapsed.totalDays}</Text>
          <Text style={styles.unit}>days</Text>
          <View style={styles.clockRow}>
            <Text style={styles.clockPiece}>{pad2(togetherElapsed.hours)}</Text>
            <Text style={styles.clockSep}>:</Text>
            <Text style={styles.clockPiece}>{pad2(togetherElapsed.minutes)}</Text>
            <Text style={styles.clockSep}>:</Text>
            <Text style={styles.clockPiece}>{pad2(togetherElapsed.seconds)}</Text>
          </View>
          <Text style={styles.hint}>hours · min · sec (live)</Text>
        </>
      ) : (
        <>
          <Text style={styles.number}>—</Text>
          <Text style={styles.unit}>set your first-met date</Text>
        </>
      )}
    </>
  );

  const gradient = (
    <LinearGradient
      colors={['rgba(236,72,153,0.45)', 'rgba(15,10,20,0.92)']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.banner}
    >
      {body}
      {metAtMs == null && onPressEditDate ? (
        <Text style={styles.tapCue}>Tap to set in Settings</Text>
      ) : null}
      {metAtMs != null && onPressEditDate ? (
        <Pressable onPress={onPressEditDate} hitSlop={12} accessibilityRole="button">
          <Text style={styles.editLink}>Edit date in Settings</Text>
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
    paddingVertical: 18,
    paddingHorizontal: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(244,114,182,0.35)',
  },
  eyebrow: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  number: {
    color: '#FFF',
    fontSize: 44,
    fontWeight: '900',
    marginTop: 6,
  },
  unit: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 13,
    fontWeight: '800',
    marginTop: 2,
    textAlign: 'center',
  },
  clockRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    gap: 4,
  },
  clockPiece: {
    color: '#FFF',
    fontSize: 22,
    fontWeight: '900',
  },
  clockSep: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 20,
    fontWeight: '800',
  },
  hint: {
    color: 'rgba(255,255,255,0.65)',
    fontSize: 10,
    fontWeight: '800',
    marginTop: 8,
    letterSpacing: 0.6,
  },
  tapCue: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 12,
    fontWeight: '800',
    marginTop: 12,
  },
  editLink: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 12,
    fontWeight: '800',
    marginTop: 12,
    textDecorationLine: 'underline',
  },
});
