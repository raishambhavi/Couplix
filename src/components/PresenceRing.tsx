import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';

import { useTheme } from '../state/ThemeContext';
import type { PresenceStatus } from '../state/PairingContext';

function getStatusConfig(status: PresenceStatus) {
  switch (status) {
    case 'awake':
      return { label: 'Awake', intensity: 1, ringOpacity: 0.95 };
    case 'busy':
      return { label: 'Busy', intensity: 0.6, ringOpacity: 0.7 };
    case 'free':
      return { label: 'Free', intensity: 0.8, ringOpacity: 0.85 };
    case 'winding_down':
      return { label: 'Winding down', intensity: 0.45, ringOpacity: 0.6 };
  }
}

export function PresenceRing({ status }: { status: PresenceStatus }) {
  const { colors } = useTheme();
  const cfg = useMemo(() => getStatusConfig(status), [status]);
  const pulseAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    pulseAnim.setValue(0);
    const loop = Animated.loop(
      Animated.timing(pulseAnim, {
        toValue: 1,
        duration: 2200,
        easing: Easing.inOut(Easing.quad),
        useNativeDriver: true,
      })
    );
    loop.start();
    return () => loop.stop();
  }, [pulseAnim]);

  const pulseScale = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1 + 0.06 * cfg.intensity],
  });
  const pulseOpacity = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [cfg.ringOpacity, 0.25],
  });

  return (
    <View style={styles.wrap}>
      <Animated.View
        style={[
          styles.ring,
          {
            borderColor: colors.gold,
            opacity: cfg.ringOpacity,
            transform: [{ scale: pulseScale }],
          },
        ]}
      />
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          styles.ring,
          {
            borderColor: colors.gold,
            opacity: pulseOpacity,
          },
        ]}
      />
      <View
        style={[
          styles.center,
          {
            backgroundColor: colors.surface,
            borderColor: colors.border,
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: 170,
    height: 170,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
  },
  ring: {
    position: 'absolute',
    width: 170,
    height: 170,
    borderRadius: 999,
    borderWidth: 2,
  },
  center: {
    width: 110,
    height: 110,
    borderRadius: 999,
    borderWidth: 1,
  },
});

