import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { AmbientBackground } from '../../components/AmbientBackground';
import { FloatingBackButton } from '../../components/FloatingBackButton';
import { ScreenHeading } from '../../components/ScreenHeading';
import { SoftCard } from '../../components/SoftCard';
import { usePairing } from '../../state/PairingContext';
import { useTheme } from '../../state/ThemeContext';

const featureCards = [
  {
    key: 'Heartbeat',
    title: 'Heartbeat Share',
    icon: 'pulse',
    subTogether: 'Tap & hold — feel close in the same home',
    subLD: 'Tap & hold — sync pulse across the distance',
  },
  {
    key: 'Nudge',
    title: 'Nudge',
    icon: 'radio',
    subTogether: 'Silent patterns when you’re in different rooms',
    subLD: 'Silent patterns that bridge time zones',
  },
  {
    key: 'SoftLocation',
    title: 'Soft Location',
    icon: 'location',
    subTogether: 'Fuzzy zones — home, out, date night',
    subLD: 'Fuzzy zones in different cities — no exact GPS',
  },
  {
    key: 'SharedSky',
    title: 'Shared Sky',
    icon: 'partly-sunny',
    subTogether: 'Compare weather & daylight from two windows',
    subLD: 'Their sky vs yours — daylight and weather apart',
  },
  {
    key: 'MoodSync',
    title: 'Mood Sync',
    icon: 'happy',
    subTogether: 'Emotional dial when you share a space',
    subLD: 'Emotional dial when you’re far apart',
  },
] as const;

export function MoodHubScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { coupleMode } = usePairing();
  const ld = coupleMode === 'longDistance';

  return (
    <>
      <AmbientBackground />
      <ScrollView
        contentContainerStyle={[styles.container, { paddingBottom: Math.max(insets.bottom, 24) + 24 }]}
      >
        <ScreenHeading
          title="Mood"
          subtitle={
            ld
              ? 'Tuned for long distance — same five features, different emphasis.'
              : 'Tuned for life under one roof — same five features, different emphasis.'
          }
        />

        <SoftCard
          style={{
            backgroundColor: 'transparent',
            borderWidth: 0,
            borderColor: 'transparent',
            shadowOpacity: 0,
            elevation: 0,
            padding: 0,
          }}
        >
          <View style={styles.grid}>
            {featureCards.map((f) => (
              <Pressable
                key={f.key}
                onPress={() => (globalThis as any).__couplixNav?.(f.key)}
                style={({ pressed }) => [
                  styles.tile,
                  {
                    borderColor: 'rgba(0,0,0,0.5)',
                    backgroundColor: 'rgba(255,255,255,0.08)',
                    opacity: pressed ? 0.8 : 1,
                  },
                ]}
              >
                <Ionicons name={f.icon as any} size={26} color={colors.gold} />
                <Text style={[styles.tileTitle, { color: colors.text }]}>{f.title}</Text>
                <Text style={[styles.tileSubtitle, { color: colors.muted }]}>
                  {ld ? f.subLD : f.subTogether}
                </Text>
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
  container: { paddingHorizontal: 20, paddingTop: 108, paddingBottom: 32, gap: 14 },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  tile: {
    width: '48%',
    borderWidth: 1,
    borderRadius: 16,
    minHeight: 156,
    paddingVertical: 14,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  tileTitle: { fontSize: 14, fontWeight: '900', textAlign: 'center' },
  tileSubtitle: { fontSize: 11, fontWeight: '700', textAlign: 'center', lineHeight: 16 },
});

