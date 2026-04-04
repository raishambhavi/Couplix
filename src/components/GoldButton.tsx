import React from 'react';
import { Pressable, StyleSheet, Text, ViewStyle } from 'react-native';

import { useTheme } from '../state/ThemeContext';

export function GoldButton({
  title,
  onPress,
  style,
  disabled,
}: {
  title: string;
  onPress: () => void;
  style?: ViewStyle;
  disabled?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.base,
        { backgroundColor: colors.gold },
        style,
        disabled ? styles.disabled : null,
        pressed ? { transform: [{ scale: 0.99 }] } : null,
      ]}
    >
      <Text style={styles.text}>{title}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    color: '#1A1510',
    fontWeight: '700',
    fontSize: 16,
    letterSpacing: 0.2,
  },
  disabled: {
    opacity: 0.6,
  },
});

