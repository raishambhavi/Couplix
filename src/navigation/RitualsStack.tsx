import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { useTheme } from '../state/ThemeContext';
import { RitualsHubScreen } from '../screens/rituals/RitualsHubScreen';
import { DailyDareScreen } from '../screens/rituals/DailyDareScreen';
import { QuestionOfTheDayScreen } from '../screens/rituals/QuestionOfTheDayScreen';
import { NightNoteScreen } from '../screens/rituals/NightNoteScreen';
import { StreakBoardScreen } from '../screens/rituals/StreakBoardScreen';

export type RitualsStackParamList = {
  RitualsHub: undefined;
  DailyDare: undefined;
  QuestionOfTheDay: undefined;
  NightNote: undefined;
  StreakBoard: undefined;
};

const Stack = createNativeStackNavigator<RitualsStackParamList>();

export function RitualsStackNavigator() {
  const { colors } = useTheme();

  return (
    <Stack.Navigator
      initialRouteName="RitualsHub"
      screenOptions={{
        headerShown: true,
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.text,
        headerShadowVisible: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="RitualsHub" component={RitualsHubScreen} options={{ title: 'Rituals' }} />
      <Stack.Screen name="DailyDare" component={DailyDareScreen} options={{ title: 'Daily Dare' }} />
      <Stack.Screen
        name="QuestionOfTheDay"
        component={QuestionOfTheDayScreen}
        options={{ title: 'Question of the Day' }}
      />
      <Stack.Screen name="NightNote" component={NightNoteScreen} options={{ title: 'Night Note' }} />
      <Stack.Screen name="StreakBoard" component={StreakBoardScreen} options={{ title: 'Streak Board' }} />
    </Stack.Navigator>
  );
}
