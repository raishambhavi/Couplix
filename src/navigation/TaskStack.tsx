import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { useTheme } from '../state/ThemeContext';
import { CoupleTasksScreen } from '../screens/task/CoupleTasksScreen';

export type TaskStackParamList = {
  CoupleTasks: undefined;
};

const Stack = createNativeStackNavigator<TaskStackParamList>();

export function TaskStackNavigator() {
  const { colors } = useTheme();

  return (
    <Stack.Navigator
      initialRouteName="CoupleTasks"
      screenOptions={{
        headerShown: true,
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.text,
        headerShadowVisible: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="CoupleTasks" component={CoupleTasksScreen} options={{ title: 'Tasks' }} />
    </Stack.Navigator>
  );
}
