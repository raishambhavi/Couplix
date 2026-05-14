import React from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { BottomTabBarHeightContext } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { useTheme } from '../state/ThemeContext';

/**
 * Gap between the FAB and the bottom tab bar (when this screen lives inside the main tabs).
 * Scene layout already ends above the tab bar, so we must NOT add `insets.bottom` again here
 * — that was doubling safe-area and floating the button too high.
 */
const GAP_ABOVE_TAB_BAR = 8;

export function FloatingBackButton() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const tabBarHeightFromContext = React.useContext(BottomTabBarHeightContext);
  /** Inside bottom tabs: small gap above tab bar. Elsewhere: gap + home indicator inset. */
  const bottom =
    tabBarHeightFromContext != null ? GAP_ABOVE_TAB_BAR : GAP_ABOVE_TAB_BAR + insets.bottom;

  return (
    <Pressable
      onPress={() => (globalThis as any).__couplixNavBack?.()}
      style={({ pressed }) => [
        styles.backFab,
        {
          bottom,
          backgroundColor: colors.surface,
          borderColor: colors.border,
          opacity: pressed ? 0.75 : 1,
        },
      ]}
    >
      <Ionicons name="arrow-back" size={20} color={colors.gold} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  backFab: {
    position: 'absolute',
    right: 16,
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    elevation: 8,
  },
});
