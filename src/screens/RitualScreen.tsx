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

const prompts = [
  'One thing I’m grateful for today…',
  'A small memory I want us to share…',
  'A gentle intention for the evening…',
  'How I want you to feel right now…',
];

function dayIndex(d: Date, mod: number) {
  const start = new Date(d.getFullYear(), 0, 1);
  const diff = d.getTime() - start.getTime();
  const oneDay = 24 * 60 * 60 * 1000;
  return Math.floor(diff / oneDay) % mod;
}

export function RitualScreen({ navigation }: { navigation: any }) {
  const { partnerName, coupleCode } = usePairing();
  const settings = useSettings();
  const { colors } = useTheme();
  const today = useMemo(() => new Date(), []);
  const todayKey = useMemo(() => today.toISOString().slice(0, 10), [today]);
  const prompt = useMemo(() => prompts[dayIndex(today, prompts.length)], [today]);

  const [shared, setShared] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!coupleCode) return;
      const key = `ritualShared:${coupleCode}:${todayKey}`;
      try {
        const raw = await AsyncStorage.getItem(key);
        if (!mounted) return;
        if (raw) setShared(raw);
      } catch {
        // ignore
      }
    })();
    return () => {
      mounted = false;
    };
  }, [coupleCode, todayKey]);

  useEffect(() => {
    if (!coupleCode) return;
    const key = `ritualShared:${coupleCode}:${todayKey}`;
    if (!shared) return;
    AsyncStorage.setItem(key, shared).catch(() => {});
  }, [shared, coupleCode, todayKey]);

  return (
    <>
      <AmbientBackground />
      <ScrollView contentContainerStyle={styles.container} style={styles.root}>
        <ScreenHeading title="Ritual" subtitle="A daily moment of closeness." />

        <SoftCard>
          <Text style={[styles.cardTitle, { color: colors.text }]}>Today’s prompt</Text>
          <Text style={[styles.prompt, { color: colors.text }]}>{prompt}</Text>
          <Text style={[styles.cardSubtitle, { color: colors.muted }]}>
            For you and {partnerName}—kept private on your device for now.
          </Text>

          {shared ? (
            <View style={styles.sharedBox}>
              <Text style={[styles.sharedLabel, { color: colors.text }]}>Marked shared</Text>
              <Text style={[styles.sharedValue, { color: colors.muted }]}>{shared}</Text>
            </View>
          ) : null}

          <GoldButton
            title={shared ? 'Done' : 'Mark as shared'}
            disabled={false}
            onPress={() => {
              const stamp = `Shared at ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
              setShared(stamp);
              settings.sendNotification(`Ritual shared: ${prompt}`);
            }}
          />

          <Pressable
            onPress={() => navigation.navigate('Rituals')}
            style={({ pressed }) => [styles.link, pressed ? { opacity: 0.7 } : null]}
          >
            <Text style={[styles.linkText, { color: colors.gold }]}>Next: add a shared moment</Text>
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
    fontSize: 12,
    letterSpacing: 0.3,
    fontWeight: '800',
  },
  prompt: {
    fontSize: 20,
    fontWeight: '900',
    lineHeight: 26,
  },
  cardSubtitle: {
    fontSize: 13,
    lineHeight: 18,
  },
  sharedBox: {
    borderWidth: 1,
    borderColor: 'rgba(231, 199, 125, 0.55)',
    backgroundColor: 'rgba(231, 199, 125, 0.10)',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  sharedLabel: {
    fontWeight: '900',
  },
  sharedValue: {
    marginTop: 4,
    fontWeight: '700',
  },
  link: {
    marginTop: 2,
    paddingVertical: 10,
    alignItems: 'center',
  },
  linkText: {
    fontWeight: '900',
  },
});

