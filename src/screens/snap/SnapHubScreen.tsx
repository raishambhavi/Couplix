import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';

import { AmbientBackground } from '../../components/AmbientBackground';
import { FloatingBackButton } from '../../components/FloatingBackButton';
import { ScreenHeading } from '../../components/ScreenHeading';
import { SoftCard } from '../../components/SoftCard';
import type { SnapStackParamList } from '../../navigation/SnapStack';
import { usePairing } from '../../state/PairingContext';
import { useTheme } from '../../state/ThemeContext';

const featureCards = [
  {
    key: 'DailySnap' as const,
    title: 'Daily Snap',
    icon: 'camera',
    subTogether: 'One raw photo each — same-day life side by side',
    subLD: 'One raw photo each — presence across the distance',
  },
  {
    key: 'WeeklyCollage' as const,
    title: 'Weekly Photo Collage',
    icon: 'grid',
    subTogether: 'Sunday grid of your week together',
    subLD: 'Sunday grid reuniting both of your weeks',
  },
  {
    key: 'QuarterlyVideo' as const,
    title: 'Quarterly Memory Video',
    icon: 'film',
    subTogether: 'Seasonal reel from shared everyday moments',
    subLD: 'Seasonal reel from your far-apart days',
  },
  {
    key: 'MemoryMap' as const,
    title: 'Memory Map',
    icon: 'map',
    subTogether: 'Pins for favourite spots you share',
    subLD: 'Pins when you reunite + places that matter',
  },
  {
    key: 'PhotoDrop' as const,
    title: 'Photo Drop',
    icon: 'images',
    subTogether: 'Prompted raw drops into your shared roll',
    subLD: 'Prompted raw drops until you’re together again',
  },
] as const;

export function SnapHubScreen() {
  const { colors } = useTheme();
  const { coupleMode } = usePairing();
  const ld = coupleMode === 'longDistance';
  const navigation = useNavigation<NativeStackNavigationProp<SnapStackParamList>>();

  return (
    <>
      <AmbientBackground />
      <ScrollView contentContainerStyle={styles.container}>
        <ScreenHeading
          title="Photo & memory"
          subtitle={
            ld
              ? 'Built for long distance — raw daily presence until the next hello.'
              : 'Built for life together — raw daily presence from the same chapter.'
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
  container: { paddingHorizontal: 20, paddingTop: 90, paddingBottom: 32, gap: 14 },
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
