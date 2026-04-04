import React from 'react';
import { LogBox, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DarkTheme, DefaultTheme, NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import * as Notifications from 'expo-notifications';
import { useLastNotificationResponse } from 'expo-notifications';
import { enableScreens } from 'react-native-screens';

import { PairingProvider } from './src/state/PairingContext';
import { SettingsProvider } from './src/state/SettingsContext';
import { ThemeProvider, useTheme } from './src/state/ThemeContext';
import { AuthProvider, useAuth } from './src/state/AuthContext';
import { OnboardingScreen } from './src/screens/OnboardingScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';
import { HomeScreen } from './src/screens/HomeScreen';
import { HeartbeatScreen } from './src/screens/HeartbeatScreen';
import { NudgeScreen } from './src/screens/NudgeScreen';
import { RitualsStackNavigator } from './src/navigation/RitualsStack';
import { MoodHubScreen } from './src/screens/feature/MoodHubScreen';
import { SoftLocationScreen } from './src/screens/feature/SoftLocationScreen';
import { SharedSkyScreen } from './src/screens/feature/SharedSkyScreen';
import { MoodSyncScreen } from './src/screens/feature/MoodSyncScreen';
import { usePairing } from './src/state/PairingContext';
import { Ionicons } from '@expo/vector-icons';
import { SignInScreen } from './src/screens/auth/SignInScreen';
import { SignUpScreen } from './src/screens/auth/SignUpScreen';
import { ProfileSetupScreen } from './src/screens/auth/ProfileSetupScreen';
import { HeaderBrand } from './src/components/HeaderBrand';
import { FeatureIndexModal } from './src/components/FeatureIndexModal';
import { useNavigationContainerRef } from '@react-navigation/native';
import { AccountScreen } from './src/screens/account/AccountScreen';
import { RitualsProvider } from './src/state/RitualsContext';
import { SnapProvider } from './src/state/SnapContext';
import { SnapStackNavigator } from './src/navigation/SnapStack';
import { TaskStackNavigator } from './src/navigation/TaskStack';
import { TaskProvider } from './src/state/TaskContext';
import { TogetherStackNavigator } from './src/navigation/TogetherStack';
import { ChatProvider } from './src/state/ChatContext';
import { ChatStackNavigator } from './src/navigation/ChatStack';
import { GrowthScreen } from './src/screens/GrowthScreen';
import { ExpoPushRegistration } from './src/components/ExpoPushRegistration';
import { navigateFromNotificationData } from './src/navigation/handleNotificationOpen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

enableScreens();

const LOVE_QUOTES = [
  'Love is composed of a single soul inhabiting two bodies.',
  'In all the world, there is no heart for me like yours.',
  'You are my today and all of my tomorrows.',
  'Where there is love there is life.',
  'Every love story is beautiful, but ours is my favorite.',
  'I still fall for you every day.',
  'Home is wherever I am with you.',
  'You are the finest, loveliest, tenderest person I have ever known.',
  'Together is a wonderful place to be.',
  'You make my heart smile.',
];
const QUOTE_DISMISS_KEY = 'quote:dismissedDate';

function MainTabs() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [indexOpen, setIndexOpen] = React.useState(false);
  const [quoteOpen, setQuoteOpen] = React.useState(false);
  const [quote, setQuote] = React.useState(LOVE_QUOTES[0]);
  const [dontShowToday, setDontShowToday] = React.useState(false);
  React.useEffect(() => {
    (globalThis as any).__couplixOpenIndex = () => setIndexOpen(true);
    return () => {
      (globalThis as any).__couplixOpenIndex = undefined;
    };
  }, []);
  React.useEffect(() => {
    let mounted = true;
    (async () => {
      const today = new Date().toISOString().slice(0, 10);
      const dismissed = await AsyncStorage.getItem(QUOTE_DISMISS_KEY).catch(() => null);
      if (!mounted || dismissed === today) return;
      const next = LOVE_QUOTES[Math.floor(Math.random() * LOVE_QUOTES.length)] ?? LOVE_QUOTES[0];
      setQuote(next);
      setQuoteOpen(true);
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const closeQuote = async () => {
    if (dontShowToday) {
      const today = new Date().toISOString().slice(0, 10);
      await AsyncStorage.setItem(QUOTE_DISMISS_KEY, today).catch(() => {});
    }
    setQuoteOpen(false);
  };
  return (
    <RitualsProvider>
      <SnapProvider>
      <ChatProvider>
      <TaskProvider>
      <>
        <FeatureIndexModal
          visible={indexOpen}
          onClose={() => setIndexOpen(false)}
        items={[
          { key: 'home', label: 'Home', icon: 'home', onPress: () => (globalThis as any).__couplixNav?.('Home') },
          { key: 'mood', label: 'Mood', icon: 'happy', onPress: () => (globalThis as any).__couplixNav?.('Mood') },
          { key: 'snap', label: 'Snap', icon: 'camera', onPress: () => (globalThis as any).__couplixNav?.('Snap') },
          { key: 'chat', label: 'Chat', icon: 'chatbubbles', onPress: () => (globalThis as any).__couplixNav?.('Chat') },
          { key: 'rituals', label: 'Rituals', icon: 'book', onPress: () => (globalThis as any).__couplixNav?.('Rituals') },
          { key: 'task', label: 'Tasks', icon: 'checkbox-outline', onPress: () => (globalThis as any).__couplixNav?.('Task') },
          { key: 'together', label: 'Together', icon: 'people', onPress: () => (globalThis as any).__couplixNav?.('Together') },
          { key: 'growth', label: 'Growth', icon: 'trending-up', onPress: () => (globalThis as any).__couplixNav?.('Growth') },
          { key: 'settings', label: 'Settings', icon: 'settings', onPress: () => (globalThis as any).__couplixNav?.('Settings') },
        ]}
      />
      <Tab.Navigator
        screenOptions={{
        headerShown: true,
        headerTitle: () => <HeaderBrand title="Couplix" onPressIcon={() => setIndexOpen(true)} />,
        headerTitleAlign: 'left',
        headerTransparent: true,
        headerStyle: {
          backgroundColor: 'transparent',
          height: 96,
        },
        headerTitleContainerStyle: {
          paddingLeft: 6,
          paddingRight: 6,
        },
        headerShadowVisible: false,
        tabBarStyle: {
          backgroundColor: colors.background,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: colors.border,
          paddingBottom: Math.max(insets.bottom, 8),
          paddingTop: 6,
          minHeight: 52 + Math.max(insets.bottom, 8),
          elevation: 8,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.06,
          shadowRadius: 6,
        },
        tabBarItemStyle: {
          flex: 1,
        },
        tabBarLabelStyle: {
          textAlign: 'center',
        },
        tabBarActiveTintColor: '#EC4899',
        tabBarInactiveTintColor: colors.muted,
        }}
      >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{
          title: 'Home',
          tabBarIcon: ({ color, size }) => <Ionicons name="home" size={size} color={color} />,
        }}
      />
      <Tab.Screen
        name="Together"
        component={TogetherStackNavigator}
        options={{
          title: 'Together',
          headerShown: false,
          tabBarIcon: ({ color, size }) => <Ionicons name="people" size={size} color={color} />,
        }}
      />
      <Tab.Screen
        name="Snap"
        component={SnapStackNavigator}
        options={{
          title: 'Snap',
          headerShown: false,
          tabBarIcon: ({ color, size }) => <Ionicons name="camera" size={size} color={color} />,
        }}
      />
      <Tab.Screen
        name="Chat"
        component={ChatStackNavigator}
        options={{
          title: 'Chat',
          headerShown: false,
          tabBarIcon: ({ color, size }) => <Ionicons name="chatbubbles" size={size} color={color} />,
        }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          title: 'Settings',
          tabBarIcon: ({ color, size }) => <Ionicons name="settings" size={size} color={color} />,
        }}
      />
      <Tab.Screen
        name="Rituals"
        component={RitualsStackNavigator}
        options={{
          title: 'Rituals',
          headerShown: false,
          tabBarButton: () => null,
          tabBarItemStyle: { display: 'none' },
        }}
      />
      <Tab.Screen
        name="Task"
        component={TaskStackNavigator}
        options={{
          title: 'Tasks',
          headerShown: false,
          tabBarButton: () => null,
          tabBarItemStyle: { display: 'none' },
        }}
      />
      <Tab.Screen
        name="Mood"
        component={MoodHubScreen}
        options={{
          title: 'Mood',
          tabBarButton: () => null,
          tabBarItemStyle: { display: 'none' },
        }}
      />
      <Tab.Screen
        name="Growth"
        component={GrowthScreen}
        options={{
          title: 'Growth',
          tabBarButton: () => null,
          tabBarItemStyle: { display: 'none' },
        }}
      />
      <Tab.Screen
        name="Heartbeat"
        component={HeartbeatScreen}
        options={{
          title: 'Heartbeat',
          tabBarButton: () => null,
          tabBarItemStyle: { display: 'none' },
        }}
      />
      <Tab.Screen
        name="Nudge"
        component={NudgeScreen}
        options={{
          title: 'Nudge',
          tabBarButton: () => null,
          tabBarItemStyle: { display: 'none' },
        }}
      />
      <Tab.Screen
        name="SoftLocation"
        component={SoftLocationScreen}
        options={{
          title: 'Soft Location',
          tabBarButton: () => null,
          tabBarItemStyle: { display: 'none' },
        }}
      />
      <Tab.Screen
        name="SharedSky"
        component={SharedSkyScreen}
        options={{
          title: 'Shared Sky',
          tabBarButton: () => null,
          tabBarItemStyle: { display: 'none' },
        }}
      />
      <Tab.Screen
        name="MoodSync"
        component={MoodSyncScreen}
        options={{
          title: 'Mood Sync',
          tabBarButton: () => null,
          tabBarItemStyle: { display: 'none' },
        }}
      />
        </Tab.Navigator>
        <Modal visible={quoteOpen} transparent animationType="fade" onRequestClose={closeQuote}>
          <View style={styles.quoteBackdrop}>
            <View style={[styles.quoteCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.quoteTitle, { color: colors.gold }]}>Couplix Love Note</Text>
              <Text style={[styles.quoteText, { color: colors.text }]}>{quote}</Text>
              <Pressable
                onPress={() => setDontShowToday((v) => !v)}
                style={({ pressed }) => [styles.quoteToggleRow, pressed ? { opacity: 0.75 } : null]}
              >
                <View
                  style={[
                    styles.quoteCheck,
                    {
                      borderColor: colors.border,
                      backgroundColor: dontShowToday ? colors.gold : 'transparent',
                    },
                  ]}
                />
                <Text style={[styles.quoteToggleText, { color: colors.muted }]}>Don&apos;t show again today</Text>
              </Pressable>
              <Pressable
                onPress={closeQuote}
                style={({ pressed }) => [
                  styles.quoteCloseBtn,
                  { backgroundColor: colors.gold, opacity: pressed ? 0.8 : 1 },
                ]}
              >
                <Text style={styles.quoteCloseText}>Close</Text>
              </Pressable>
            </View>
          </View>
        </Modal>
      </>
      </TaskProvider>
      </ChatProvider>
      </SnapProvider>
    </RitualsProvider>
  );
}

function AppNavigator() {
  const { colors } = useTheme();
  const { isPaired } = usePairing();
  const auth = useAuth();
  const lastNotificationResponse = useLastNotificationResponse();
  const statusBarStyle = colors.mode === 'dark' ? 'light' : 'dark';
  const baseTheme = colors.mode === 'dark' ? DarkTheme : DefaultTheme;
  const navRef = useNavigationContainerRef<any>();

  React.useEffect(() => {
    if (auth.loading || !auth.user) return;
    if (lastNotificationResponse === undefined || lastNotificationResponse === null) return;
    if (lastNotificationResponse.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER) return;

    const data = lastNotificationResponse.notification.request.content.data as Record<string, unknown>;
    if (!data || typeof data !== 'object') return;

    let cancelled = false;
    const attempt = () => {
      if (cancelled || !navRef.isReady()) return false;
      navigateFromNotificationData(navRef, data);
      Notifications.clearLastNotificationResponseAsync().catch(() => {});
      return true;
    };

    if (attempt()) {
      return () => {
        cancelled = true;
      };
    }

    const interval = setInterval(() => {
      if (attempt()) clearInterval(interval);
    }, 120);
    const timeout = setTimeout(() => clearInterval(interval), 5000);
    return () => {
      cancelled = true;
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [auth.loading, auth.user, lastNotificationResponse]);
  // Expose a tiny global nav helper for the Index modal (keeps it simple and reliable).
  (globalThis as any).__couplixNav = (routeName: string) => {
    try {
      navRef.navigate(routeName as never);
    } catch {}
  };
  (globalThis as any).__couplixNavBack = () => {
    try {
      if (navRef.canGoBack()) navRef.goBack();
      else (globalThis as any).__couplixOpenIndex?.();
    } catch {}
  };

  return (
    <NavigationContainer
      ref={navRef}
      theme={{
        ...baseTheme,
        dark: colors.mode === 'dark',
        colors: {
          ...baseTheme.colors,
          background: colors.background,
          card: colors.background,
          text: colors.text,
          border: colors.border,
          primary: colors.gold,
          notification: colors.gold,
        },
      }}
    >
      <StatusBar style={statusBarStyle as any} />

      {auth.loading ? (
        <></>
      ) : auth.user ? (
        <Stack.Navigator
          key={isPaired ? 'paired' : 'unpaired'}
          initialRouteName={isPaired ? 'MainTabs' : 'Onboarding'}
          screenOptions={{ headerShown: false }}
        >
          <Stack.Screen name="MainTabs" component={MainTabs} />
          <Stack.Screen name="Account" component={AccountScreen} />
          <Stack.Screen name="Onboarding" component={OnboardingScreen} />
        </Stack.Navigator>
      ) : (
        <Stack.Navigator
          key="signed-out"
          initialRouteName="SignIn"
          screenOptions={{ headerShown: false }}
        >
          <Stack.Screen name="SignIn" component={SignInScreen} />
          <Stack.Screen name="SignUp" component={SignUpScreen} />
          <Stack.Screen name="ProfileSetup" component={ProfileSetupScreen} />
          <Stack.Screen name="Account" component={AccountScreen} />
          <Stack.Screen name="MainTabs" component={MainTabs} />
        </Stack.Navigator>
      )}
    </NavigationContainer>
  );
}

export default function App() {
  React.useEffect(() => {
    LogBox.ignoreLogs([
      '@firebase/firestore: Firestore (12.11.0): Using maximum backoff delay to prevent overloading the backend.',
      '`expo-notifications` functionality is not fully supported in Expo Go',
      '[expo-av]: Expo AV has been deprecated and will be removed in SDK 54.',
    ]);
  }, []);

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AuthProvider>
          <SettingsProvider>
            <ExpoPushRegistration />
            <PairingProvider>
              <AppNavigator />
            </PairingProvider>
          </SettingsProvider>
        </AuthProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  quoteBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 22,
  },
  quoteCard: {
    width: '100%',
    maxWidth: 430,
    borderRadius: 18,
    borderWidth: 1,
    padding: 18,
    gap: 12,
  },
  quoteTitle: {
    fontSize: 16,
    fontWeight: '900',
    textAlign: 'center',
  },
  quoteText: {
    fontSize: 18,
    lineHeight: 28,
    fontWeight: '800',
    textAlign: 'center',
  },
  quoteCloseBtn: {
    marginTop: 6,
    alignSelf: 'center',
    borderRadius: 999,
    paddingHorizontal: 22,
    paddingVertical: 12,
  },
  quoteCloseText: {
    color: '#1A1510',
    fontSize: 15,
    fontWeight: '900',
  },
  quoteToggleRow: {
    marginTop: 2,
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    gap: 8,
  },
  quoteCheck: {
    width: 18,
    height: 18,
    borderRadius: 5,
    borderWidth: 1,
  },
  quoteToggleText: {
    fontSize: 12,
    fontWeight: '800',
  },
});
