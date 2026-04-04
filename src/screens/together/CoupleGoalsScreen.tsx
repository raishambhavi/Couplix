import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import { AmbientBackground } from '../../components/AmbientBackground';
import { ConfettiBurst } from '../../components/ConfettiBurst';
import { FloatingBackButton } from '../../components/FloatingBackButton';
import { GoldButton } from '../../components/GoldButton';
import { SoftCard } from '../../components/SoftCard';
import { useAuth } from '../../state/AuthContext';
import type { CoupleGoalItem } from '../../state/TogetherContext';
import { useTogether } from '../../state/TogetherContext';
import { useTheme } from '../../state/ThemeContext';

export function CoupleGoalsScreen() {
  const { colors } = useTheme();
  const auth = useAuth();
  const uid = auth.user?.uid ?? '';
  const { coupleGoals, addCoupleGoal, toggleCoupleGoalComplete } = useTogether();
  const [draft, setDraft] = useState('');
  const year = new Date().getFullYear();
  const [goalYear, setGoalYear] = useState(year);
  const [burstId, setBurstId] = useState(0);
  const [showConfetti, setShowConfetti] = useState(false);
  const prevGoalsJsonRef = useRef('');

  const fireConfetti = useCallback(() => {
    setBurstId((i) => i + 1);
    setShowConfetti(true);
  }, []);

  useEffect(() => {
    const s = JSON.stringify(coupleGoals);
    if (!prevGoalsJsonRef.current) {
      prevGoalsJsonRef.current = s;
      return;
    }
    if (s === prevGoalsJsonRef.current) return;
    let prev: CoupleGoalItem[];
    try {
      prev = JSON.parse(prevGoalsJsonRef.current);
    } catch {
      prevGoalsJsonRef.current = s;
      return;
    }
    for (const g of coupleGoals) {
      const p = prev.find((x) => x.id === g.id);
      if (g.completed && (!p || !p.completed) && g.completedByUid && g.completedByUid !== uid) {
        fireConfetti();
        break;
      }
    }
    prevGoalsJsonRef.current = s;
  }, [coupleGoals, uid, fireConfetti]);

  const sorted = useMemo(
    () =>
      [...coupleGoals].sort((a, b) => {
        if (a.year !== b.year) return b.year - a.year;
        return b.completed === a.completed ? 0 : a.completed ? 1 : -1;
      }),
    [coupleGoals]
  );

  return (
    <View style={styles.root}>
      <AmbientBackground />
      <ScrollView contentContainerStyle={styles.container}>
        <LinearGradient
          colors={['rgba(236,72,153,0.35)', 'rgba(244,114,182,0.12)', 'transparent']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.hero}
        >
          <Text style={[styles.heroEyebrow, { color: colors.muted }]}>This year & beyond</Text>
          <Text style={[styles.heroTitle, { color: colors.text }]}>Couple goals</Text>
          <Text style={[styles.heroSub, { color: colors.muted }]}>
            Plan together, celebrate together — completions sync to your partner instantly.
          </Text>
        </LinearGradient>

        <SoftCard>
          <Text style={[styles.label, { color: colors.text }]}>New goal</Text>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder="e.g. Weekend trip to the coast"
            placeholderTextColor={colors.muted}
            style={[styles.input, { color: colors.text, borderColor: colors.border }]}
          />
          <View style={styles.yearRow}>
            {[-1, 0, 1].map((offset) => {
              const y = year + offset;
              const on = goalYear === y;
              return (
                <Pressable
                  key={y}
                  onPress={() => setGoalYear(y)}
                  style={[
                    styles.yearChip,
                    {
                      borderColor: on ? colors.gold : colors.border,
                      backgroundColor: on ? 'rgba(236,72,153,0.15)' : 'rgba(231,199,125,0.06)',
                    },
                  ]}
                >
                  <Text style={[styles.yearChipText, { color: colors.text }]}>{y}</Text>
                </Pressable>
              );
            })}
          </View>
          <GoldButton
            title="Add goal"
            onPress={() => {
              addCoupleGoal(draft, goalYear);
              setDraft('');
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
            }}
            disabled={!draft.trim()}
          />
        </SoftCard>

        <Text style={[styles.sectionLabel, { color: colors.muted }]}>Your list</Text>
        {sorted.length === 0 ? (
          <SoftCard>
            <Text style={[styles.empty, { color: colors.muted }]}>
              Add goals you both care about — travel, habits, dates, or little promises.
            </Text>
          </SoftCard>
        ) : (
          sorted.map((g) => (
            <SoftCard key={g.id} style={g.completed ? styles.doneCard : undefined}>
              <View style={styles.goalRow}>
                <View style={{ flex: 1, gap: 6 }}>
                  <Text style={[styles.goalYear, { color: colors.gold }]}>{g.year}</Text>
                  <Text style={[styles.goalText, { color: colors.text }]}>{g.text}</Text>
                  {g.completed ? (
                    <Text style={[styles.meta, { color: colors.muted }]}>
                      Completed{g.completedByUid === uid ? ' by you' : ' by partner'} 🎊
                    </Text>
                  ) : null}
                </View>
                <Pressable
                  onPress={() => {
                    const willComplete = !g.completed;
                    toggleCoupleGoalComplete(g.id, uid);
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
                    if (willComplete) fireConfetti();
                  }}
                  style={[
                    styles.checkBtn,
                    {
                      borderColor: g.completed ? colors.gold : colors.border,
                      backgroundColor: g.completed ? 'rgba(236,72,153,0.2)' : 'transparent',
                    },
                  ]}
                >
                  <Ionicons name={g.completed ? 'heart' : 'heart-outline'} size={22} color={colors.gold} />
                </Pressable>
              </View>
            </SoftCard>
          ))
        )}
      </ScrollView>
      <FloatingBackButton />
      {showConfetti ? (
        <ConfettiBurst key={burstId} onFinish={() => setShowConfetti(false)} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  container: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 120, gap: 12 },
  hero: {
    borderRadius: 20,
    padding: 18,
    marginBottom: 4,
    borderWidth: 1,
    borderColor: 'rgba(244,114,182,0.25)',
  },
  heroEyebrow: { fontSize: 11, fontWeight: '800', letterSpacing: 1.2, textTransform: 'uppercase' },
  heroTitle: { fontSize: 26, fontWeight: '900', marginTop: 6 },
  heroSub: { fontSize: 13, fontWeight: '700', lineHeight: 18, marginTop: 8 },
  label: { fontSize: 14, fontWeight: '900', marginBottom: 8 },
  input: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontWeight: '700',
    marginBottom: 12,
  },
  yearRow: { flexDirection: 'row', gap: 8, marginBottom: 14, flexWrap: 'wrap' },
  yearChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
  },
  yearChipText: { fontSize: 13, fontWeight: '800' },
  sectionLabel: { fontSize: 12, fontWeight: '800', marginTop: 8, marginLeft: 4 },
  empty: { fontSize: 13, fontWeight: '700', lineHeight: 19, textAlign: 'center' },
  goalRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  goalYear: { fontSize: 11, fontWeight: '900', letterSpacing: 0.6 },
  goalText: { fontSize: 16, fontWeight: '800', lineHeight: 22 },
  meta: { fontSize: 11, fontWeight: '700' },
  checkBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneCard: { opacity: 0.92 },
});
