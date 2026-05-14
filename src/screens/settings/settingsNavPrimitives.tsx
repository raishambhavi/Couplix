import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import type { ThemeColors } from '../../theme/colors';

export type SettingsPanelId =
  | 'profile'
  | 'partner'
  | 'personal'
  | 'appearance'
  | 'notifications'
  | 'relationship'
  | 'pairing'
  | 'account';

export type SettingsStackParamList = {
  SettingsHome: undefined;
  SettingsDetail: { panel: SettingsPanelId };
};

export function SettingsGroupCard({ children, colors }: { children: React.ReactNode; colors: ThemeColors }) {
  return (
    <View
      style={{
        borderRadius: 18,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: colors.border,
        backgroundColor: colors.surface,
        overflow: 'hidden',
        marginBottom: 10,
      }}
    >
      {children}
    </View>
  );
}

export function SettingsNavRow({
  icon,
  title,
  subtitle,
  showDivider,
  active,
  onPress,
  colors,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  title: string;
  subtitle?: string;
  showDivider: boolean;
  active?: boolean;
  onPress: () => void;
  colors: ThemeColors;
}) {
  return (
    <>
      {showDivider ? (
        <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginLeft: 54 }} />
      ) : null}
      <Pressable
        onPress={onPress}
        style={({ pressed }) => ({
          flexDirection: 'row',
          alignItems: 'center',
          paddingVertical: 13,
          paddingHorizontal: 14,
          gap: 12,
          backgroundColor: active ? colors.cardGlow : pressed ? colors.cardGlow : 'transparent',
        })}
      >
        <Ionicons name={icon} size={22} color={colors.gold} style={{ opacity: 0.95 }} />
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.text, fontSize: 16, fontWeight: '700' }}>{title}</Text>
          {subtitle ? (
            <Text style={{ color: colors.muted, fontSize: 13, fontWeight: '600', marginTop: 2 }} numberOfLines={2}>
              {subtitle}
            </Text>
          ) : null}
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.muted} />
      </Pressable>
    </>
  );
}
