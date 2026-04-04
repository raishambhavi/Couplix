import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { useTheme } from '../state/ThemeContext';
import { SnapHubScreen } from '../screens/snap/SnapHubScreen';
import { DailySnapScreen } from '../screens/snap/DailySnapScreen';
import { WeeklyCollageScreen } from '../screens/snap/WeeklyCollageScreen';
import { QuarterlyVideoScreen } from '../screens/snap/QuarterlyVideoScreen';
import { MemoryMapScreen } from '../screens/snap/MemoryMapScreen';
import { PhotoDropScreen } from '../screens/snap/PhotoDropScreen';

export type SnapStackParamList = {
  SnapHub: undefined;
  DailySnap: undefined;
  WeeklyCollage: undefined;
  QuarterlyVideo: undefined;
  MemoryMap: undefined;
  PhotoDrop: undefined;
};

const Stack = createNativeStackNavigator<SnapStackParamList>();

export function SnapStackNavigator() {
  const { colors } = useTheme();

  return (
    <Stack.Navigator
      initialRouteName="SnapHub"
      screenOptions={{
        headerShown: true,
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.text,
        headerShadowVisible: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="SnapHub" component={SnapHubScreen} options={{ title: 'Snap' }} />
      <Stack.Screen name="DailySnap" component={DailySnapScreen} options={{ title: 'Daily Snap' }} />
      <Stack.Screen name="WeeklyCollage" component={WeeklyCollageScreen} options={{ title: 'Weekly Collage' }} />
      <Stack.Screen name="QuarterlyVideo" component={QuarterlyVideoScreen} options={{ title: 'Memory Video' }} />
      <Stack.Screen name="MemoryMap" component={MemoryMapScreen} options={{ title: 'Memory Map' }} />
      <Stack.Screen name="PhotoDrop" component={PhotoDropScreen} options={{ title: 'Photo Drop' }} />
    </Stack.Navigator>
  );
}
