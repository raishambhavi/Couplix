import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, Dimensions, StyleSheet, View } from 'react-native';

const { width: W, height: H } = Dimensions.get('window');
const COLORS = ['#EC4899', '#F472B6', '#FBBF24', '#FDE68A', '#FFF', '#A855F7', '#FB7185', '#34D399'];

type ParticleSpec = { id: number; left: number; color: string; delay: number; scale: number; w: number; h: number };

function ConfettiParticle({ spec }: { spec: ParticleSpec }) {
  const translateY = useRef(new Animated.Value(-24)).current;
  const rotate = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const dur = 2200 + Math.random() * 500;
    const anim = Animated.sequence([
      Animated.delay(spec.delay),
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: H + 80,
          duration: dur,
          useNativeDriver: true,
        }),
        Animated.timing(rotate, {
          toValue: 1,
          duration: dur,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0,
          duration: dur,
          useNativeDriver: true,
        }),
      ]),
    ]);
    anim.start();
    return () => anim.stop();
  }, [opacity, rotate, spec.delay, translateY]);

  const spin = rotate.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '720deg'] });

  return (
    <Animated.View
      style={[
        styles.particle,
        {
          left: spec.left,
          width: spec.w,
          height: spec.h,
          backgroundColor: spec.color,
          opacity,
          transform: [{ translateY }, { rotate: spin }, { scale: spec.scale }],
        },
      ]}
    />
  );
}

/**
 * Full-screen confetti burst (pure RN Animated). Parent should change `key` to replay.
 */
export function ConfettiBurst({ onFinish }: { onFinish?: () => void }) {
  const specs = useMemo<ParticleSpec[]>(
    () =>
      Array.from({ length: 28 }, (_, i) => ({
        id: i,
        left: Math.random() * Math.max(40, W - 16),
        color: COLORS[i % COLORS.length],
        delay: Math.random() * 450,
        scale: 0.55 + Math.random() * 0.75,
        w: 6 + Math.random() * 8,
        h: 8 + Math.random() * 12,
      })),
    []
  );

  useEffect(() => {
    const t = setTimeout(() => onFinish?.(), 3100);
    return () => clearTimeout(t);
  }, [onFinish]);

  return (
    <View pointerEvents="none" style={styles.layer}>
      {specs.map((spec) => (
        <ConfettiParticle key={spec.id} spec={spec} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  layer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 999,
  },
  particle: {
    position: 'absolute',
    top: H * 0.1,
    borderRadius: 3,
  },
});
