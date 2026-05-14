import React from 'react';
import { StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import type { BottomTabNavigationOptions } from '@react-navigation/bottom-tabs';
import type { NativeStackNavigationOptions } from '@react-navigation/native-stack';
import type { EdgeInsets } from 'react-native-safe-area-context';

import { chromeBarGradientColors } from '../theme/ambientGradients';
import type { ThemeMode } from '../theme/colors';

type HeaderThemeColors = {
  mode: ThemeMode;
  background: string;
  text: string;
};

/** Layout + gradient; string titles use bold dark (light) / theme text (dark). Home tab overrides title with `HeaderBrand`. */
function buildMatchingHeaderChrome(params: { insets: EdgeInsets; colors: HeaderThemeColors }) {
  const { insets, colors } = params;
  const tabChromeGradient = chromeBarGradientColors(colors.mode);
  const isLight = colors.mode === 'light';
  /** Light: near-black on pink gradient. Dark: keep high-contrast body text. */
  const headerForeground = isLight ? '#0A0A0A' : colors.text;

  return {
    headerShown: true as const,
    headerStatusBarHeight: Math.max(0, insets.top - 5),
    headerTransparent: false,
    headerStyle: {
      backgroundColor: 'transparent' as const,
    },
    headerBackground: () => (
      <LinearGradient
        colors={tabChromeGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0.85 }}
        style={StyleSheet.absoluteFillObject}
      />
    ),
    headerShadowVisible: false,
    headerTintColor: headerForeground,
    headerTitleStyle: {
      fontWeight: '900',
      fontSize: 17,
      color: headerForeground,
    },
    headerTitleContainerStyle: {
      paddingLeft: 6,
      paddingRight: 6,
    },
  };
}

/** Native stacks — same bar width/chrome as the main tab header; default titles from each screen. */
export function couplixMainHeaderScreenOptions(params: {
  insets: EdgeInsets;
  colors: HeaderThemeColors;
}): NativeStackNavigationOptions {
  return buildMatchingHeaderChrome(params) as NativeStackNavigationOptions;
}

/** Bottom tab navigator — same chrome; tab `title` shows in the header (e.g. Home, Settings). */
export function couplixMainTabHeaderScreenOptions(params: {
  insets: EdgeInsets;
  colors: HeaderThemeColors;
}): BottomTabNavigationOptions {
  return buildMatchingHeaderChrome(params) as BottomTabNavigationOptions;
}
