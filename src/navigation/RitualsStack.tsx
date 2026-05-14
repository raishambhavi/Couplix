import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '../state/ThemeContext';
import { couplixMainHeaderScreenOptions } from './couplixHeaderScreenOptions';
import { RitualsHubScreen } from '../screens/rituals/RitualsHubScreen';
import { DailyDareScreen } from '../screens/rituals/DailyDareScreen';
import { QuestionOfTheDayScreen } from '../screens/rituals/QuestionOfTheDayScreen';
import { QuestionOfTheDayAnswerScreen } from '../screens/rituals/QuestionOfTheDayAnswerScreen';
import { NightNoteScreen } from '../screens/rituals/NightNoteScreen';
import { StreakBoardScreen } from '../screens/rituals/StreakBoardScreen';
import { CoupleTasksScreen } from '../screens/task/CoupleTasksScreen';

export type RitualsStackParamList = {
  RitualsHub: undefined;
  DailyDare: undefined;
  QuestionOfTheDay: undefined;
  QuestionOfTheDayAnswer: { topicId: string };
  CoupleTasks: undefined;
  NightNote: undefined;
  StreakBoard: undefined;
};

const Stack = createNativeStackNavigator<RitualsStackParamList>();

export function RitualsStackNavigator() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <Stack.Navigator
      initialRouteName="RitualsHub"
      screenOptions={{
        ...couplixMainHeaderScreenOptions({ insets, colors }),
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
      <Stack.Screen
        name="QuestionOfTheDayAnswer"
        component={QuestionOfTheDayAnswerScreen}
        options={{ title: 'Answer' }}
      />
      <Stack.Screen name="CoupleTasks" component={CoupleTasksScreen} options={{ title: 'Tasks' }} />
      <Stack.Screen name="NightNote" component={NightNoteScreen} options={{ title: 'Night Note' }} />
      <Stack.Screen name="StreakBoard" component={StreakBoardScreen} options={{ title: 'Streak Board' }} />
    </Stack.Navigator>
  );
}
