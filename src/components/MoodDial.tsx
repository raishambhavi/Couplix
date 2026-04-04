import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { PanResponder, Pressable, StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';

const N = 8;
const TWO_PI = Math.PI * 2;
const SECTOR = TWO_PI / N;

export type MoodDialMood = { value: number; emoji: string; label: string };

type Props = {
  moods: MoodDialMood[];
  value: number;
  onChange: (value: number) => void;
  accentColor: string;
  ringColor: string;
  centerBg: string;
  textColor: string;
  mutedColor: string;
};

function angleToIndex(dx: number, dy: number, minRadius: number): number | null {
  const dist = Math.hypot(dx, dy);
  if (dist < minRadius) return null;
  const angle = Math.atan2(dy, dx);
  let t = (angle + Math.PI / 2 + TWO_PI) % TWO_PI;
  return Math.floor((t + SECTOR / 2) / SECTOR) % N;
}

export function MoodDial({
  moods,
  value,
  onChange,
  accentColor,
  ringColor,
  centerBg,
  textColor,
  mutedColor,
}: Props) {
  const layoutRef = useRef({ w: 280, h: 280 });
  const lastIndexRef = useRef(value);

  useEffect(() => {
    lastIndexRef.current = value;
  }, [value]);

  const applyIndex = useCallback(
    (idx: number | null) => {
      if (idx == null || idx < 0 || idx > 7) return;
      if (idx !== lastIndexRef.current) {
        lastIndexRef.current = idx;
        Haptics.selectionAsync().catch(() => {});
        onChange(idx);
      }
    },
    [onChange]
  );

  const updateFromXY = useCallback(
    (x: number, y: number) => {
      const { w, h } = layoutRef.current;
      const cx = w / 2;
      const cy = h / 2;
      const dx = x - cx;
      const dy = y - cy;
      const idx = angleToIndex(dx, dy, 44);
      if (idx != null) applyIndex(idx);
    },
    [applyIndex]
  );

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (e) => {
          updateFromXY(e.nativeEvent.locationX, e.nativeEvent.locationY);
        },
        onPanResponderMove: (e) => {
          updateFromXY(e.nativeEvent.locationX, e.nativeEvent.locationY);
        },
      }),
    [updateFromXY]
  );

  const onLayout = useCallback((e: { nativeEvent: { layout: { width: number; height: number } } }) => {
    const { width, height } = e.nativeEvent.layout;
    layoutRef.current = { w: width, h: height };
  }, []);

  const selected = moods[value] ?? moods[3];
  const size = 280;
  const cx = size / 2;
  const cy = size / 2;
  const centerDiscSize = 132;
  const centerOff = (size - centerDiscSize) / 2;
  const rEmoji = 102;
  const rRing = 118;

  const emojiSlots = useMemo(() => {
    return moods.map((m, i) => {
      const theta = -Math.PI / 2 + (i / N) * TWO_PI;
      const left = cx + rEmoji * Math.cos(theta) - 22;
      const top = cy + rEmoji * Math.sin(theta) - 22;
      return { m, left, top, i };
    });
  }, [moods, cx, cy, rEmoji]);

  const dotAngle = -Math.PI / 2 + (value / N) * TWO_PI;
  const dotLeft = cx + rRing * Math.cos(dotAngle) - 7;
  const dotTop = cy + rRing * Math.sin(dotAngle) - 7;

  return (
    <View style={styles.wrap}>
      <View style={[styles.dialFrame, { width: size, height: size }]} onLayout={onLayout}>
        <View style={StyleSheet.absoluteFill} {...panResponder.panHandlers} />
        <View
          pointerEvents="none"
          style={[
            styles.ring,
            {
              borderColor: ringColor,
              width: size - 4,
              height: size - 4,
              borderRadius: (size - 4) / 2,
              top: 2,
              left: 2,
            },
          ]}
        />
        {emojiSlots.map(({ m, left, top, i }) => {
          const active = i === value;
          return (
            <Pressable
              key={m.value}
              accessibilityRole="button"
              accessibilityLabel={m.label}
              onPress={() => {
                lastIndexRef.current = i;
                Haptics.selectionAsync().catch(() => {});
                onChange(i);
              }}
              style={({ pressed }) => [
                styles.emojiHit,
                styles.emojiHitLayer,
                {
                  left,
                  top,
                  borderColor: active ? accentColor : 'transparent',
                  backgroundColor: active ? `${accentColor}22` : 'transparent',
                  opacity: pressed ? 0.85 : 1,
                },
              ]}
            >
              <Text style={styles.emojiChar}>{m.emoji}</Text>
            </Pressable>
          );
        })}
        <View
          pointerEvents="none"
          style={[
            styles.knob,
            {
              left: dotLeft,
              top: dotTop,
              backgroundColor: accentColor,
              borderColor: centerBg,
              zIndex: 3,
            },
          ]}
        />
        <View
          pointerEvents="none"
          style={[
            styles.centerDisc,
            {
              backgroundColor: centerBg,
              borderColor: ringColor,
              width: centerDiscSize,
              height: centerDiscSize,
              borderRadius: centerDiscSize / 2,
              left: centerOff,
              top: centerOff,
            },
          ]}
        >
          <Text style={[styles.centerEmoji, { color: textColor }]}>{selected.emoji}</Text>
          <Text style={[styles.centerLabel, { color: textColor }]} numberOfLines={2}>
            {selected.label}
          </Text>
          <Text style={[styles.centerHint, { color: mutedColor }]}>Drag or tap</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', marginVertical: 8 },
  dialFrame: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    position: 'absolute',
    borderWidth: 2,
    opacity: 0.9,
  },
  emojiHit: {
    position: 'absolute',
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emojiHitLayer: {
    zIndex: 2,
  },
  emojiChar: {
    fontSize: 22,
  },
  knob: {
    position: 'absolute',
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
  },
  centerDisc: {
    position: 'absolute',
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
    zIndex: 1,
  },
  centerEmoji: {
    fontSize: 36,
    marginBottom: 4,
  },
  centerLabel: {
    fontSize: 13,
    fontWeight: '900',
    textAlign: 'center',
    lineHeight: 17,
  },
  centerHint: {
    fontSize: 10,
    fontWeight: '700',
    marginTop: 6,
  },
});
