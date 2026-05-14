import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '../state/ThemeContext';
import { couplixMainHeaderScreenOptions } from './couplixHeaderScreenOptions';
import { SnapHubScreen } from '../screens/snap/SnapHubScreen';
import { DailySnapScreen } from '../screens/snap/DailySnapScreen';
import { WeeklyCollageScreen } from '../screens/snap/WeeklyCollageScreen';
import { QuarterlyVideoScreen } from '../screens/snap/QuarterlyVideoScreen';
import { MemoryMapScreen } from '../screens/snap/MemoryMapScreen';

export type SnapStackParamList = {
  SnapHub: undefined;
  DailySnap: undefined;
  WeeklyCollage: undefined;
  QuarterlyVideo: undefined;
  MemoryMap: undefined;
};

const Stack = createNativeStackNavigator<SnapStackParamList>();

export function SnapStackNavigator() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <Stack.Navigator
      initialRouteName="SnapHub"
      screenOptions={{
        ...couplixMainHeaderScreenOptions({ insets, colors }),
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="SnapHub" component={SnapHubScreen} options={{ title: 'Snap' }} />
      <Stack.Screen name="DailySnap" component={DailySnapScreen} options={{ title: 'Daily Snap' }} />
      <Stack.Screen name="WeeklyCollage" component={WeeklyCollageScreen} options={{ title: 'Weekly Collage' }} />
      <Stack.Screen name="QuarterlyVideo" component={QuarterlyVideoScreen} options={{ title: 'Memory Video' }} />
      <Stack.Screen name="MemoryMap" component={MemoryMapScreen} options={{ title: 'Memory Map' }} />
    </Stack.Navigator>
  );
}
