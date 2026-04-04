import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { GoldButton } from '../components/GoldButton';
import { AmbientBackground } from '../components/AmbientBackground';
import { SoftCard } from '../components/SoftCard';
import { ScreenHeading } from '../components/ScreenHeading';
import { usePairing } from '../state/PairingContext';
import { useSettings } from '../state/SettingsContext';
import { useTheme } from '../state/ThemeContext';
import AsyncStorage from '@react-native-async-storage/async-storage';

type Pulse = {
  id: string;
  at: number;
};

function formatTime(ts: number) {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function PulseScreen({ navigation }: { navigation: any }) {
  const { partnerName, coupleCode } = usePairing();
  const settings = useSettings();
  const { colors } = useTheme();
  const [sent, setSent] = useState<Pulse[]>([]);
  const [justSentId, setJustSentId] = useState<string | null>(null);

  const lastThree = useMemo(() => sent.slice().reverse().slice(0, 3), [sent]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!coupleCode) return;
      const key = `pulses:${coupleCode}`;
      try {
        const raw = await AsyncStorage.getItem(key);
        if (!mounted) return;
        if (!raw) return;
        const parsed = JSON.parse(raw) as Pulse[];
        setSent(parsed);
      } catch {
        // ignore
      }
    })();
    return () => {
      mounted = false;
    };
  }, [coupleCode]);

  useEffect(() => {
    if (!coupleCode) return;
    const key = `pulses:${coupleCode}`;
    AsyncStorage.setItem(key, JSON.stringify(sent)).catch(() => {});
  }, [sent, coupleCode]);

  return (
    <>
      <AmbientBackground />
      <ScrollView contentContainerStyle={styles.container} style={styles.root}>
        <ScreenHeading title="Pulse" subtitle="One tap. Felt presence." />

        <SoftCard>
          <Text style={[styles.cardTitle, { color: colors.text }]}>Send a pulse to {partnerName}</Text>
          <Text style={[styles.cardSubtitle, { color: colors.muted }]}>
            No chat. No thread. Just a meaningful, ambient signal.
          </Text>

          <GoldButton
            title="Send Pulse"
            onPress={() => {
              const id = `${Date.now()}`;
              const pulse: Pulse = { id, at: Date.now() };
              setSent((prev) => [...prev, pulse]);
              setJustSentId(id);
              settings.sendNotification(`You sent a pulse to ${partnerName}.`);
              setTimeout(() => setJustSentId((cur) => (cur === id ? null : cur)), 1500);
            }}
            style={{ marginTop: 6 }}
          />

          {justSentId ? (
            <View style={styles.pulseSent}>
              <Text style={[styles.pulseSentText, { color: colors.text }]}>Pulse sent</Text>
            </View>
          ) : null}

          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Recent pulses</Text>
            {lastThree.length === 0 ? (
              <Text style={[styles.empty, { color: colors.muted }]}>Nothing yet. Tap “Send Pulse”.</Text>
            ) : (
              lastThree.map((p) => (
                <View key={p.id} style={styles.pulseRow}>
                  <View style={[styles.dot, { backgroundColor: colors.gold }]} />
                  <Text style={[styles.pulseTime, { color: colors.text }]}>{formatTime(p.at)}</Text>
                </View>
              ))
            )}
          </View>

          <Pressable
            onPress={() => navigation.navigate('Rituals')}
            style={({ pressed }) => [styles.link, pressed ? { opacity: 0.7 } : null]}
          >
            <Text style={[styles.linkText, { color: colors.gold }]}>Next: do today’s ritual</Text>
          </Pressable>
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
  cardTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  cardSubtitle: {
    fontSize: 13,
    lineHeight: 18,
  },
  pulseSent: {
    marginTop: -2,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(231, 199, 125, 0.55)',
    backgroundColor: 'rgba(231, 199, 125, 0.10)',
  },
  pulseSentText: {
    fontWeight: '800',
  },
  section: {
    marginTop: 6,
    gap: 10,
  },
  sectionTitle: {
    fontSize: 12,
    letterSpacing: 0.3,
  },
  empty: {
    fontSize: 13,
  },
  pulseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(231, 199, 125, 0.12)',
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 999,
    opacity: 0.9,
  },
  pulseTime: {
    fontWeight: '700',
  },
  link: {
    marginTop: 2,
    paddingVertical: 10,
    alignItems: 'center',
  },
  linkText: {
    fontWeight: '800',
  },
});

