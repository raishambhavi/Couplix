import React, { useMemo, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';

import { AmbientBackground } from '../../components/AmbientBackground';
import { FloatingBackButton } from '../../components/FloatingBackButton';
import { GoldButton } from '../../components/GoldButton';
import { SoftCard } from '../../components/SoftCard';
import { usePairing } from '../../state/PairingContext';
import { useSnap } from '../../state/SnapContext';
import { useTheme } from '../../state/ThemeContext';
import { pickRawPhoto } from '../../utils/snapPickImage';

const PROMPTS = [
  'Show me where you are right now',
  'Something that made you smile today',
  'A texture you love',
  'Your view from the window',
  'What you’re drinking or eating',
];

export function PhotoDropScreen() {
  const { colors } = useTheme();
  const { coupleMode } = usePairing();
  const ld = coupleMode === 'longDistance';
  const { todayKey, dropsByDate, setPhotoDrop } = useSnap();
  const [activePrompt, setActivePrompt] = useState<string | undefined>();

  const todayDrop = dropsByDate[todayKey];
  const gallery = useMemo(() => {
    return Object.entries(dropsByDate)
      .sort((a, b) => b[1].at - a[1].at)
      .map(([k, v]) => ({ key: k, ...v }));
  }, [dropsByDate]);

  const capture = async (source: 'camera' | 'library') => {
    const r = await pickRawPhoto(source);
    if (!r.ok) return;
    setPhotoDrop(todayKey, {
      uri: r.uri,
      at: Date.now(),
      caption: undefined,
      prompt: activePrompt,
    });
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

  return (
    <>
      <AmbientBackground />
      <ScrollView contentContainerStyle={styles.container}>
        <SoftCard>
          <Text style={[styles.sub, { color: colors.muted }]}>
            {ld
              ? 'One raw Photo Drop per day — no filters. A thread of life until you’re together again.'
              : 'One raw Photo Drop per day — no filters. A shared roll of life in the same home.'}
          </Text>
          <Text style={[styles.h, { color: colors.text }]}>Optional prompt</Text>
          <View style={styles.prompts}>
            {PROMPTS.map((p) => (
              <Pressable
                key={p}
                onPress={() => setActivePrompt((cur) => (cur === p ? undefined : p))}
                style={({ pressed }) => [
                  styles.promptChip,
                  {
                    borderColor: activePrompt === p ? colors.gold : colors.border,
                    backgroundColor: activePrompt === p ? 'rgba(231,199,125,0.12)' : 'transparent',
                    opacity: pressed ? 0.85 : 1,
                  },
                ]}
              >
                <Text style={{ color: colors.text, fontSize: 12, fontWeight: '700' }}>{p}</Text>
              </Pressable>
            ))}
          </View>
          {todayDrop?.uri ? (
            <Image source={{ uri: todayDrop.uri }} style={styles.hero} resizeMode="cover" />
          ) : (
            <View style={[styles.hero, styles.ph, { borderColor: colors.border }]}>
              <Text style={{ color: colors.muted, fontWeight: '600' }}>No drop yet today</Text>
            </View>
          )}
          {todayDrop?.prompt ? (
            <Text style={[styles.caption, { color: colors.gold }]}>Prompt: {todayDrop.prompt}</Text>
          ) : null}
          <View style={styles.row}>
            <GoldButton title="Camera" onPress={() => capture('camera')} style={{ flex: 1 }} />
            <GoldButton title="Library" onPress={() => capture('library')} style={{ flex: 1 }} />
          </View>
        </SoftCard>

        <SoftCard>
          <Text style={[styles.h, { color: colors.text }]}>Shared camera roll</Text>
          <Text style={[styles.sub, { color: colors.muted }]}>Newest first — only you and your partner (sync in full build).</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingVertical: 8 }}>
            {gallery.map((item) => (
              <View key={item.key}>
                <Image source={{ uri: item.uri }} style={styles.thumb} resizeMode="cover" />
                <Text style={[styles.micro, { color: colors.muted, marginTop: 4 }]}>{item.key}</Text>
              </View>
            ))}
          </ScrollView>
        </SoftCard>
      </ScrollView>
      <FloatingBackButton />
    </>
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 32, gap: 14 },
  h: { fontSize: 15, fontWeight: '900', marginTop: 6 },
  sub: { marginTop: 4, fontSize: 12, fontWeight: '700', lineHeight: 18 },
  prompts: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  promptChip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 12,
    overflow: 'hidden',
  },
  hero: { width: '100%', height: 220, borderRadius: 12, marginTop: 12 },
  ph: { borderWidth: 1, borderStyle: 'dashed', justifyContent: 'center', alignItems: 'center' },
  caption: { marginTop: 8, fontSize: 12, fontWeight: '700' },
  row: { flexDirection: 'row', gap: 8, marginTop: 12 },
  thumb: { width: 100, height: 100, borderRadius: 10 },
  micro: { fontSize: 10, fontWeight: '600' },
});
