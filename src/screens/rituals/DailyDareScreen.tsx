import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { AmbientBackground } from '../../components/AmbientBackground';
import { FloatingBackButton } from '../../components/FloatingBackButton';
import { GoldButton } from '../../components/GoldButton';
import { SoftCard } from '../../components/SoftCard';
import type { CoupleMode, WeekBand } from '../../data/dailyDares';
import { useRituals } from '../../state/RitualsContext';
import { useTheme } from '../../state/ThemeContext';

function bandCopy(band: WeekBand, mode: CoupleMode): { title: string; subtitle: string } {
  if (band === 'weekend') {
    return mode === 'together'
      ? { title: 'Weekend spark', subtitle: 'A little extra fun while you have more room to play.' }
      : { title: 'Weekend spark', subtitle: 'Something playful you can do from wherever you are.' };
  }
  return mode === 'together'
    ? { title: 'Weekday glow', subtitle: 'Light, doable — made for busy days at home.' }
    : { title: 'Weekday glow', subtitle: 'Small gestures that keep you close across the distance.' };
}

export function DailyDareScreen() {
  const { colors } = useTheme();
  const {
    coupleMode,
    partnerName,
    partnerUid,
    ritualDayKey,
    dareBand,
    currentDare,
    dareDone,
    partnerDareDone,
    markDareComplete,
    dareStreak,
  } = useRituals();

  const band = useMemo(() => bandCopy(dareBand, coupleMode), [dareBand, coupleMode]);

  const gradientColors = useMemo(
    () =>
      dareBand === 'weekend'
        ? (['rgba(216,113,151,0.55)', 'rgba(120,60,95,0.35)', 'rgba(40,20,45,0.2)'] as const)
        : (['rgba(231,199,125,0.45)', 'rgba(216,113,151,0.28)', 'rgba(80,40,70,0.15)'] as const),
    [dareBand],
  );

  return (
    <>
      <AmbientBackground />
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.heroWrap}>
          <LinearGradient colors={gradientColors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.heroGradient}>
            <Text style={styles.heroKicker}>{"Today's dare"}</Text>
            <View style={[styles.badge, { borderColor: colors.gold }]}>
              <Text style={[styles.badgeText, { color: colors.text }]}>{band.title}</Text>
            </View>
            <Text style={[styles.heroDare, { color: colors.text }]}>{currentDare}</Text>
            <Text style={[styles.heroHint, { color: colors.muted }]}>{band.subtitle}</Text>
            <Text style={[styles.syncLine, { color: colors.muted }]}>
              Same dare for both of you · UTC day {ritualDayKey}
              {partnerUid ? '' : ' · Pair to sync'}
            </Text>
          </LinearGradient>
        </View>

        <SoftCard>
          <Text style={[styles.sectionLabel, { color: colors.muted }]}>Progress</Text>
          <View style={styles.progressRow}>
            <View style={[styles.progressChip, { borderColor: colors.border }]}>
              <Text style={[styles.progressLabel, { color: colors.muted }]}>You</Text>
              <Text style={[styles.progressState, { color: dareDone ? colors.gold : colors.text }]}>
                {dareDone ? 'Done' : 'Not yet'}
              </Text>
            </View>
            <View style={[styles.progressChip, { borderColor: colors.border }]}>
              <Text style={[styles.progressLabel, { color: colors.muted }]}>{partnerName || 'Partner'}</Text>
              <Text
                style={[
                  styles.progressState,
                  { color: partnerUid ? (partnerDareDone ? colors.gold : colors.text) : colors.muted },
                ]}
              >
                {!partnerUid ? '—' : partnerDareDone ? 'Done' : 'Not yet'}
              </Text>
            </View>
          </View>
          <Text style={[styles.modeLine, { color: colors.muted }]}>
            Mode:{' '}
            <Text style={{ fontWeight: '900', color: colors.gold }}>
              {coupleMode === 'together' ? 'Living together' : 'Long distance'}
            </Text>{' '}
            (change on Home or Settings). Dares follow this mode and weekday vs weekend (UTC) automatically.
          </Text>
          <GoldButton
            title={dareDone ? 'You completed today' : 'We did it — mark mine done'}
            disabled={dareDone}
            onPress={() => {
              markDareComplete().catch(() => {});
            }}
            style={{ marginTop: 14 }}
          />
          <Text style={[styles.streak, { color: colors.gold }]}>Couple dare streak: {dareStreak} day(s)</Text>
          <Text style={[styles.streakHint, { color: colors.muted }]}>
            {partnerUid
              ? 'Streak grows when both of you finish the same UTC calendar day.'
              : 'Streak grows each day you complete (pair anytime to sync with your partner).'}
          </Text>
        </SoftCard>
      </ScrollView>
      <FloatingBackButton />
    </>
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 40, gap: 16 },
  heroWrap: {
    borderRadius: 22,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  heroGradient: { paddingHorizontal: 20, paddingVertical: 22 },
  heroKicker: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 2,
    textTransform: 'uppercase',
    opacity: 0.85,
  },
  badge: {
    alignSelf: 'flex-start',
    marginTop: 10,
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(0,0,0,0.12)',
  },
  badgeText: { fontSize: 12, fontWeight: '900' },
  heroDare: {
    marginTop: 14,
    fontSize: 20,
    fontWeight: '800',
    lineHeight: 28,
  },
  heroHint: { marginTop: 10, fontSize: 13, fontWeight: '600', lineHeight: 19 },
  syncLine: { marginTop: 12, fontSize: 11, fontWeight: '700' },
  sectionLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 0.4 },
  progressRow: { flexDirection: 'row', gap: 10, marginTop: 10 },
  progressChip: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(231,199,125,0.06)',
  },
  progressLabel: { fontSize: 11, fontWeight: '800' },
  progressState: { marginTop: 4, fontSize: 15, fontWeight: '900' },
  modeLine: { marginTop: 14, fontSize: 12, fontWeight: '700', lineHeight: 18 },
  streak: { marginTop: 12, fontSize: 14, fontWeight: '900' },
  streakHint: { marginTop: 6, fontSize: 12, fontWeight: '600', lineHeight: 18 },
});
