import React, { useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { GoldButton } from '../components/GoldButton';
import { AmbientBackground } from '../components/AmbientBackground';
import { SoftCard } from '../components/SoftCard';
import { ScreenHeading } from '../components/ScreenHeading';
import { usePairing } from '../state/PairingContext';
import { useTheme } from '../state/ThemeContext';
import AsyncStorage from '@react-native-async-storage/async-storage';

type Moment = { id: string; at: number; text: string };

export function MomentsScreen() {
  const { partnerName, coupleCode } = usePairing();
  const { colors } = useTheme();
  const [draft, setDraft] = useState('');
  const [moments, setMoments] = useState<Moment[]>([]);

  const list = useMemo(() => moments.slice().sort((a, b) => b.at - a.at), [moments]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!coupleCode) return;
      const key = `moments:${coupleCode}`;
      try {
        const raw = await AsyncStorage.getItem(key);
        if (!mounted) return;
        if (!raw) {
          // First-run starter moments.
          setMoments([
            {
              id: 'm1',
              at: Date.now() - 1000 * 60 * 60 * 3,
              text: `A quiet “I’m thinking of you” moment.`,
            },
            {
              id: 'm2',
              at: Date.now() - 1000 * 60 * 60 * 26,
              text: `Remembering us—small and warm.`,
            },
          ]);
          return;
        }
        const parsed = JSON.parse(raw) as Moment[];
        setMoments(parsed);
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
    const key = `moments:${coupleCode}`;
    AsyncStorage.setItem(key, JSON.stringify(moments)).catch(() => {});
  }, [moments, coupleCode]);

  return (
    <>
      <AmbientBackground />
      <ScrollView contentContainerStyle={styles.container} style={styles.root}>
        <ScreenHeading title="Moments" subtitle="Low-noise intimacy, built for daily life." />

        <SoftCard>
          <Text style={[styles.cardTitle, { color: colors.text }]}>Add a note</Text>
          <Text style={[styles.cardSubtitle, { color: colors.muted }]}>
            For {partnerName}. Saved to your couple code on this device.
          </Text>

          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder="e.g., I saw something that made me think of you…"
            placeholderTextColor={colors.muted}
            style={[styles.input, { backgroundColor: colors.background }]}
            multiline
            maxLength={220}
          />

          <GoldButton
            title="Save moment"
            onPress={() => {
              const text = draft.trim();
              if (!text) return;
              const id = `${Date.now()}`;
              const m: Moment = { id, at: Date.now(), text };
              setMoments((prev) => [m, ...prev]);
              setDraft('');
            }}
            disabled={draft.trim().length === 0}
            style={{ marginTop: 10 }}
          />
        </SoftCard>

        <View style={styles.listHeader}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Shared moments</Text>
          <Text style={[styles.sectionHint, { color: colors.muted }]}>{list.length} total</Text>
        </View>

        <FlatList
          data={list}
          scrollEnabled={false}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <View style={styles.momentRow}>
              <View style={[styles.dot, { backgroundColor: colors.gold }]} />
              <View style={styles.momentBody}>
                <Text style={[styles.momentText, { color: colors.text }]}>{item.text}</Text>
                <Text style={[styles.momentTime, { color: colors.muted }]}>
                  {new Date(item.at).toLocaleString([], {
                    weekday: 'short',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </Text>
              </View>
            </View>
          )}
        />

        <Pressable onPress={() => {}} style={{ height: 8 }} />
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
    fontWeight: '900',
    letterSpacing: 0.3,
    fontSize: 12,
  },
  cardSubtitle: {
    fontSize: 13,
    lineHeight: 18,
  },
  input: {
    backgroundColor: 'rgba(231, 199, 125, 0.06)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(231, 199, 125, 0.22)',
    paddingHorizontal: 14,
    paddingVertical: 12,
    minHeight: 92,
    fontSize: 15,
    lineHeight: 20,
  },
  listHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    paddingHorizontal: 2,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '900',
  },
  sectionHint: {
    fontSize: 12,
    fontWeight: '700',
  },
  momentRow: {
    flexDirection: 'row',
    gap: 12,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(231, 199, 125, 0.12)',
    paddingHorizontal: 2,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 999,
    opacity: 0.9,
    marginTop: 6,
  },
  momentBody: { flex: 1, gap: 6 },
  momentText: {
    fontSize: 15,
    fontWeight: '800',
    lineHeight: 20,
  },
  momentTime: {
    fontSize: 12,
    fontWeight: '700',
  },
});

