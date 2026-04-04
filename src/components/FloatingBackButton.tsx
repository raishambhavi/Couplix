import React from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { useTheme } from '../state/ThemeContext';

/**
 * Pinned just above the bottom tab bar. Screen content already lays out above the tab bar,
 * so we only add a small inset above the safe home-indicator area.
 */
export function FloatingBackButton() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <Pressable
      onPress={() => (globalThis as any).__couplixNavBack?.()}
      style={({ pressed }) => [
        styles.backFab,
        {
          bottom: 10 + insets.bottom,
          backgroundColor: colors.surface,
          borderColor: colors.border,
          opacity: pressed ? 0.75 : 1,
        },
      ]}
    >
      <Ionicons name="arrow-back" size={20} color={colors.gold} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  backFab: {
    position: 'absolute',
    right: 16,
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    elevation: 8,
  },
});
