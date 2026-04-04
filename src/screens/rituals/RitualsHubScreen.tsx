import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';

import { AmbientBackground } from '../../components/AmbientBackground';
import { FloatingBackButton } from '../../components/FloatingBackButton';
import { ScreenHeading } from '../../components/ScreenHeading';
import { SoftCard } from '../../components/SoftCard';
import type { RitualsStackParamList } from '../../navigation/RitualsStack';
import { usePairing } from '../../state/PairingContext';
import { useTheme } from '../../state/ThemeContext';

const featureCards = [
  {
    key: 'DailyDare' as const,
    title: 'Daily Dare',
    icon: 'flash',
    subTogether: 'Rotating dares for shared everyday life',
    subLD: 'Rotating dares built for miles apart',
  },
  {
    key: 'QuestionOfTheDay' as const,
    title: 'Question of the Day',
    icon: 'help-circle',
    subTogether: 'Depth for life under one roof',
    subLD: 'Depth for hearts in two places',
  },
  {
    key: 'NightNote' as const,
    title: 'Night Note',
    icon: 'moon',
    subTogether: 'Wake up to a note from the same home',
    subLD: 'Wake up to a note across time zones',
  },
  {
    key: 'StreakBoard' as const,
    title: 'Streak Board',
    icon: 'trophy',
    subTogether: 'Shared streaks for daily life together',
    subLD: 'Shared streaks that bridge the gap',
  },
] as const;

export function RitualsHubScreen() {
  const { colors } = useTheme();
  const { coupleMode } = usePairing();
  const ld = coupleMode === 'longDistance';
  const navigation = useNavigation<NativeStackNavigationProp<RitualsStackParamList>>();

  return (
    <>
      <AmbientBackground />
      <ScrollView contentContainerStyle={styles.container}>
        <ScreenHeading
          title="Rituals"
          subtitle={
            ld
              ? 'Dares & questions tuned for long distance — change mode on Home anytime.'
              : 'Dares & questions tuned for living together — change mode on Home anytime.'
          }
        />

        <SoftCard>
          <View style={styles.list}>
            {featureCards.map((f) => (
              <Pressable
                key={f.key}
                onPress={() => navigation.navigate(f.key)}
                style={({ pressed }) => [
                  styles.item,
                  {
                    borderColor: colors.border,
                    backgroundColor: colors.cardGlow,
                    opacity: pressed ? 0.85 : 1,
                  },
                ]}
              >
                <Ionicons name={f.icon as any} size={22} color={colors.gold} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.itemTitle, { color: colors.text }]}>{f.title}</Text>
                  <Text style={[styles.itemSubtitle, { color: colors.muted }]}>
                    {ld ? f.subLD : f.subTogether}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.muted} />
              </Pressable>
            ))}
          </View>
        </SoftCard>
      </ScrollView>
      <FloatingBackButton />
    </>
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 32, gap: 14 },
  list: { gap: 10 },
  item: {
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  itemTitle: { fontSize: 15, fontWeight: '900' },
  itemSubtitle: { fontSize: 12, fontWeight: '700', marginTop: 2 },
});
