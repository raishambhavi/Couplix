import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { SettingsHomeScreen } from '../screens/settings/SettingsHomeScreen';
import { SettingsDetailScreen } from '../screens/settings/SettingsDetailScreen';
import { useTheme } from '../state/ThemeContext';
import { couplixMainHeaderScreenOptions } from './couplixHeaderScreenOptions';
import type { SettingsPanelId, SettingsStackParamList } from '../screens/settings/settingsNavPrimitives';

export type { SettingsPanelId, SettingsStackParamList };

const Stack = createNativeStackNavigator<SettingsStackParamList>();

const DETAIL_TITLES: Record<SettingsPanelId, string> = {
  profile: 'Manage profile',
  partner: 'Partner & dates',
  personal: 'Personal information',
  appearance: 'Appearance',
  notifications: 'Notifications',
  relationship: 'Living situation',
  pairing: 'Pairing',
  account: 'Account',
};

export function SettingsStackNavigator() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <Stack.Navigator
      initialRouteName="SettingsHome"
      screenOptions={{
        ...couplixMainHeaderScreenOptions({ insets, colors }),
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="SettingsHome" component={SettingsHomeScreen} options={{ title: 'Settings' }} />
      <Stack.Screen
        name="SettingsDetail"
        component={SettingsDetailScreen}
        options={({ route }) => ({
          title: DETAIL_TITLES[route.params.panel] ?? 'Settings',
          headerBackVisible: false,
        })}
      />
    </Stack.Navigator>
  );
}
