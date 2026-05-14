import React from 'react';
import { Pressable } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ChatScreen } from '../screens/chat/ChatScreen';
import { couplixMainHeaderScreenOptions } from './couplixHeaderScreenOptions';
import { useTheme } from '../state/ThemeContext';

export type ChatStackParamList = {
  ChatMain: { messageId?: string } | undefined;
};

const Stack = createNativeStackNavigator<ChatStackParamList>();

export function ChatStackNavigator() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <Stack.Navigator
      screenOptions={{
        ...couplixMainHeaderScreenOptions({ insets, colors }),
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen
        name="ChatMain"
        component={ChatScreen}
        options={({ navigation }) => ({
          title: 'Chat',
          headerLeft: () => (
            <Pressable
              onPress={() => {
                if (navigation.canGoBack()) navigation.goBack();
                else (globalThis as any).__couplixOpenIndex?.();
              }}
              style={({ pressed }) => [{ paddingHorizontal: 6, opacity: pressed ? 0.7 : 1 }]}
              hitSlop={12}
            >
              <Ionicons name="arrow-back" size={22} color={colors.gold} />
            </Pressable>
          ),
        })}
      />
    </Stack.Navigator>
  );
}

