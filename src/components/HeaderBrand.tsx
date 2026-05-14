import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '../state/ThemeContext';

export function HeaderBrand({
  title = 'CoupliX',
  onPressIcon,
}: {
  title?: string;
  onPressIcon?: () => void;
}) {
  const { colors } = useTheme();

  return (
    <View style={styles.wrap}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Open CoupliX index"
        onPress={onPressIcon}
        disabled={!onPressIcon}
        style={({ pressed }) => [styles.iconButton, pressed ? { opacity: 0.75 } : null]}
        hitSlop={12}
      >
        <Image
          source={require('../../assets/couplix-header-mark-transparent.png')}
          style={styles.icon}
          resizeMode="contain"
        />
      </Pressable>
      <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
        {title}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 44,
  },
  iconButton: {
    borderRadius: 14,
  },
  icon: {
    width: 42,
    height: 42,
    borderRadius: 12,
  },
  title: {
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: 0.2,
  },
});

