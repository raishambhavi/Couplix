import React from 'react';
import { StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useTheme } from '../state/ThemeContext';

export function ScreenHeading({
  title,
  subtitle,
  style,
}: {
  title: string;
  subtitle?: string;
  /** Merged with the outer wrapper (e.g. `paddingTop` for safe area). */
  style?: ViewStyle;
}) {
  const { colors } = useTheme();

  return (
    <View style={[styles.wrap, style]}>
      <View style={styles.row}>
        <View style={styles.iconWrap}>
          <Ionicons name="heart" size={22} color={colors.gold} />
        </View>
        <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
      </View>
      {subtitle ? <Text style={[styles.subtitle, { color: colors.muted }]}>{subtitle}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6, paddingTop: 8, marginBottom: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  iconWrap: {
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 4,
  },
  title: { fontSize: 30, fontWeight: '900', letterSpacing: 0.2 },
  subtitle: { fontSize: 14, fontWeight: '700' },
});

