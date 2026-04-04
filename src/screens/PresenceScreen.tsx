import React, { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { GoldButton } from '../components/GoldButton';
import { PresenceRing } from '../components/PresenceRing';
import { AmbientBackground } from '../components/AmbientBackground';
import { SoftCard } from '../components/SoftCard';
import { ScreenHeading } from '../components/ScreenHeading';
import { usePairing, type PresenceStatus } from '../state/PairingContext';
import { useTheme } from '../state/ThemeContext';

const statuses: Array<{ key: PresenceStatus; label: string; hint: string }> = [
  { key: 'awake', label: 'Awake', hint: 'Softly present' },
  { key: 'busy', label: 'Busy', hint: 'I’m occupied' },
  { key: 'free', label: 'Free', hint: 'Say less, feel more' },
  { key: 'winding_down', label: 'Winding down', hint: 'Together, gently' },
];

export function PresenceScreen({ navigation }: { navigation: any }) {
  const { partnerName, presenceStatus, setPresenceStatus } = usePairing();
  const { colors } = useTheme();

  const subtitle = useMemo(() => {
    switch (presenceStatus) {
      case 'awake':
        return `You’re here with ${partnerName}.`;
      case 'busy':
        return `Still connected—even while you work.`;
      case 'free':
        return `Open presence, no pressure.`;
      case 'winding_down':
        return `A calm signal to end the day together.`;
    }
  }, [partnerName, presenceStatus]);

  return (
    <>
      <AmbientBackground />
      <ScrollView contentContainerStyle={styles.container} style={styles.root}>
        <ScreenHeading title="Presence" subtitle="Your ambient signal" />

        <SoftCard>
          <View style={styles.cardTop}>
            <PresenceRing status={presenceStatus} />
            <View style={styles.cardText}>
              <Text style={[styles.cardTitle, { color: colors.text }]}>With {partnerName}</Text>
              <Text style={[styles.cardSubtitle, { color: colors.muted }]}>{subtitle}</Text>
            </View>
          </View>

          <Text style={[styles.sectionTitle, { color: colors.text }]}>Set your feel</Text>
          <View style={styles.pills}>
            {statuses.map((s) => (
              <Pressable
                key={s.key}
                onPress={() => setPresenceStatus(s.key)}
                style={({ pressed }) => [
                  styles.pill,
                  presenceStatus === s.key ? styles.pillActive : null,
                  pressed ? { transform: [{ scale: 0.98 }] } : null,
                ]}
              >
                <Text
                  style={[
                    styles.pillLabel,
                    presenceStatus === s.key ? { color: '#1A1510' } : { color: colors.text },
                  ]}
                >
                  {s.label}
                </Text>
                <Text
                  style={[
                    styles.pillHint,
                    presenceStatus === s.key ? { color: '#1A1510' } : { color: colors.muted },
                  ]}
                >
                  {s.hint}
                </Text>
              </Pressable>
            ))}
          </View>

          <View style={styles.footerRow}>
            <GoldButton title="Send a Pulse" onPress={() => navigation.navigate('Pulse')} />
          </View>
        </SoftCard>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  root: {},
  container: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 32,
    gap: 14,
  },
  cardTop: {
    flexDirection: 'row',
    gap: 14,
    alignItems: 'center',
    marginBottom: 16,
  },
  cardText: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 6,
  },
  cardSubtitle: {
    fontSize: 13,
    lineHeight: 18,
  },
  sectionTitle: {
    fontSize: 12,
    letterSpacing: 0.3,
    marginBottom: 10,
    marginTop: 4,
  },
  pills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  pill: {
    backgroundColor: 'rgba(231, 199, 125, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(231, 199, 125, 0.35)',
    borderRadius: 16,
    paddingVertical: 10,
    paddingHorizontal: 12,
    minWidth: 150,
  },
  pillActive: {
    backgroundColor: 'rgba(231, 199, 125, 0.18)',
    borderColor: 'rgba(231, 199, 125, 0.65)',
  },
  pillLabel: {
    fontWeight: '800',
    fontSize: 14,
    marginBottom: 4,
  },
  pillHint: {
    fontSize: 12,
    lineHeight: 16,
  },
  footerRow: {
    marginTop: 16,
  },
});

