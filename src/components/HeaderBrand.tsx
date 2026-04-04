import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '../state/ThemeContext';

export function HeaderBrand({
  title = 'Couplix',
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
        accessibilityLabel="Open Couplix index"
        onPress={onPressIcon}
        disabled={!onPressIcon}
        style={({ pressed }) => [styles.iconButton, pressed ? { opacity: 0.75 } : null]}
        hitSlop={12}
      >
        <Image source={require('../../assets/icon.png')} style={styles.icon} />
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
    height: 40,
  },
  iconButton: {
    borderRadius: 12,
  },
  icon: {
    width: 34,
    height: 34,
    borderRadius: 10,
  },
  title: {
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: 0.2,
  },
});

