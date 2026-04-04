import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { CountdownTogetherScreen } from '../screens/together/CountdownTogetherScreen';
import { CoupleGoalsScreen } from '../screens/together/CoupleGoalsScreen';
import { SharedJournalScreen } from '../screens/together/SharedJournalScreen';
import { TogetherHubScreen } from '../screens/together/TogetherHubScreen';
import { WishJarScreen } from '../screens/together/WishJarScreen';
import { OurTripsTogetherScreen } from '../screens/together/OurTripsTogetherScreen';
import { TravelMapScreen } from '../screens/together/TravelMapScreen';
import { UpdateTripScreen } from '../screens/together/UpdateTripScreen';
import { TogetherProvider } from '../state/TogetherContext';
import { useTheme } from '../state/ThemeContext';

export type TogetherStackParamList = {
  TogetherHub: undefined;
  WishJar: undefined;
  OurTripsTogether: undefined;
  TravelMap: undefined;
  UpdateTrip: undefined;
  CountdownTogether: undefined;
  SharedJournal: undefined;
  CoupleGoals: undefined;
};

const Stack = createNativeStackNavigator<TogetherStackParamList>();

export function TogetherStackNavigator() {
  const { colors } = useTheme();
  return (
    <TogetherProvider>
      <Stack.Navigator
        screenOptions={{
          headerShown: true,
          headerStyle: { backgroundColor: colors.surface },
          headerTintColor: colors.text,
          headerShadowVisible: false,
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        <Stack.Screen name="TogetherHub" component={TogetherHubScreen} options={{ title: 'Together' }} />
        <Stack.Screen name="WishJar" component={WishJarScreen} options={{ title: 'Wish Jar' }} />
        <Stack.Screen
          name="OurTripsTogether"
          component={OurTripsTogetherScreen}
          options={{ title: 'Our Trips Together' }}
        />
        <Stack.Screen name="TravelMap" component={TravelMapScreen} options={{ title: 'Travel map' }} />
        <Stack.Screen name="UpdateTrip" component={UpdateTripScreen} options={{ title: 'Update trip' }} />
        <Stack.Screen
          name="CountdownTogether"
          component={CountdownTogetherScreen}
          options={{ title: 'Countdown Together' }}
        />
        <Stack.Screen name="SharedJournal" component={SharedJournalScreen} options={{ title: 'Our Journal' }} />
        <Stack.Screen name="CoupleGoals" component={CoupleGoalsScreen} options={{ title: 'Couple Goals' }} />
      </Stack.Navigator>
    </TogetherProvider>
  );
}
