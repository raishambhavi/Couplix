import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AmbientBackground } from '../../components/AmbientBackground';
import { FloatingBackButton } from '../../components/FloatingBackButton';
import { GoldButton } from '../../components/GoldButton';
import { SoftCard } from '../../components/SoftCard';
import type { DareTierKind } from '../../data/dailyDares';
import { useRituals } from '../../state/RitualsContext';
import { useTheme } from '../../state/ThemeContext';

const DARE_TIER_LABELS: Record<DareTierKind, string> = {
  rotation: 'Rotation',
  fun: 'Fun',
  deep: 'Deep',
  spicy: 'Spicy',
};

export function DailyDareScreen() {
  const { colors } = useTheme();
  const {
    coupleMode,
    dareTier,
    setDareTier,
    currentDare,
    nextDare,
    dareDone,
    setDareDone,
    dareStreak,
    setDareStreak,
    streakBoard,
    setStreakBoard,
    saveRitualsState,
  } = useRituals();

  return (
    <>
      <AmbientBackground />
      <ScrollView contentContainerStyle={styles.container}>
        <SoftCard>
          <Text style={[styles.sub, { color: colors.muted }]}>
            Curated dares — random each time. Lists match{' '}
            <Text style={{ fontWeight: '900', color: colors.gold }}>
              {coupleMode === 'together' ? 'living together' : 'long distance'}
            </Text>{' '}
            (change on Home or Settings).
          </Text>
          <Text style={[styles.label, { color: colors.muted, marginTop: 10 }]}>Challenge mix</Text>
          <View style={styles.row}>
            {(['rotation', 'fun', 'deep', 'spicy'] as DareTierKind[]).map((t) => (
              <Pressable
                key={t}
                onPress={() => setDareTier(t)}
                style={({ pressed }) => [
                  styles.tierChip,
                  {
                    borderColor: dareTier === t ? colors.gold : colors.border,
                    backgroundColor: dareTier === t ? 'rgba(231,199,125,0.2)' : 'rgba(231,199,125,0.06)',
                    opacity: pressed ? 0.8 : 1,
                  },
                ]}
              >
                <Text style={[styles.tierText, { color: colors.text }]}>{DARE_TIER_LABELS[t]}</Text>
              </Pressable>
            ))}
          </View>
          <Text style={[styles.body, { color: colors.text }]}>{currentDare}</Text>
          <GoldButton title="Next dare" onPress={nextDare} style={{ marginTop: 10 }} />
          <GoldButton
            title={dareDone ? 'Completed Today' : 'Mark as Completed'}
            disabled={dareDone}
            onPress={() => {
              setDareDone(true);
              const nextStreak = dareStreak + 1;
              setDareStreak(nextStreak);
              const nextBoard = { ...streakBoard, daresCompleted: nextStreak };
              setStreakBoard(nextBoard);
              saveRitualsState({ dareStreak: nextStreak, streakBoard: nextBoard }).catch(() => {});
            }}
            style={{ marginTop: 10 }}
          />
          <Text style={[styles.meta, { color: colors.gold }]}>Shared streak: {dareStreak} day(s)</Text>
          <Text style={[styles.meta, { color: colors.muted }]}>
            Partner reaction unlocks when both complete.
          </Text>
        </SoftCard>
      </ScrollView>
      <FloatingBackButton />
    </>
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 32, gap: 14 },
  sub: { marginTop: 4, fontSize: 12, fontWeight: '700' },
  label: { marginTop: 8, fontSize: 11, fontWeight: '800', letterSpacing: 0.3 },
  body: { marginTop: 10, fontSize: 14, fontWeight: '800', lineHeight: 20 },
  row: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginTop: 10 },
  tierChip: { borderWidth: 1, borderRadius: 999, paddingVertical: 7, paddingHorizontal: 11 },
  tierText: { fontSize: 12, fontWeight: '900' },
  meta: { marginTop: 8, fontSize: 12, fontWeight: '700', lineHeight: 18 },
});
