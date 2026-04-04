import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

import { AmbientBackground } from '../../components/AmbientBackground';
import { FloatingBackButton } from '../../components/FloatingBackButton';
import { GoldButton } from '../../components/GoldButton';
import { SoftCard } from '../../components/SoftCard';
import { useChat } from '../../state/ChatContext';
import { usePairing } from '../../state/PairingContext';
import { useTasks } from '../../state/TaskContext';
import { useTheme } from '../../state/ThemeContext';

const DOT = {
  green: '#4ADE80',
  dim: 'rgba(255,255,255,0.2)',
};

export function CoupleTasksScreen() {
  const { colors } = useTheme();
  const { coupleMode } = usePairing();
  const { addTaskLinkedMessage } = useChat();
  const {
    list,
    currentTaskText,
    completion,
    coupleScorePercent,
    dualCompleteCount,
    toggleMyComplete,
    togglePartnerComplete,
    nextTask,
    ensureCalendarDay,
  } = useTasks();

  useFocusEffect(
    React.useCallback(() => {
      ensureCalendarDay();
    }, [ensureCalendarDay])
  );

  const ld = coupleMode === 'longDistance';
  const onToggleMine = () => {
    if (!completion.me && currentTaskText.trim()) {
      addTaskLinkedMessage(currentTaskText);
    }
    toggleMyComplete();
  };

  return (
    <>
      <AmbientBackground />
      <ScrollView contentContainerStyle={styles.container}>
        <SoftCard>
          <Text style={[styles.kicker, { color: colors.gold }]}>
            {ld ? 'Long distance · individual & connection' : 'Living together · shared experiences'}
          </Text>
          <Text style={[styles.sub, { color: colors.muted }]}>
            One curated task at a time. Each of you checks off independently — combined progress is your couple
            score. Change relationship mode on Home to switch lists.
          </Text>
          <View style={[styles.scoreRow, { borderColor: colors.border }]}>
            <Text style={[styles.scoreLabel, { color: colors.text }]}>your bonding ritual score:</Text>
            <Text style={[styles.scoreVal, { color: colors.gold }]}>
              {coupleScorePercent}% · {dualCompleteCount}/{list.length} {ld ? 'both done' : 'done'}
            </Text>
          </View>
        </SoftCard>

        <SoftCard>
          <Text style={[styles.h, { color: colors.text }]}>Today&apos;s task</Text>
          <Text style={[styles.body, { color: colors.text }]}>{currentTaskText || '—'}</Text>

          {ld ? (
            <View style={styles.checkRow}>
              <TaskCheck
                label="You done"
                checked={completion.me}
                onPress={onToggleMine}
                color={colors.gold}
              />
              <TaskCheck
                label="Partner done"
                checked={completion.partner}
                onPress={togglePartnerComplete}
                color={colors.gold}
              />
            </View>
          ) : (
            <View style={styles.checkSingle}>
              <TaskCheck label="Done" checked={completion.me} onPress={onToggleMine} color={DOT.green} />
            </View>
          )}
          <GoldButton title="Next task" onPress={nextTask} style={{ marginTop: 10 }} />
          <GoldButton title="Open chat" onPress={() => (globalThis as any).__couplixNav?.('Chat')} style={{ marginTop: 8 }} />
        </SoftCard>
      </ScrollView>
      <FloatingBackButton />
    </>
  );
}

function TaskCheck({
  label,
  checked,
  onPress,
  color,
}: {
  label: string;
  checked: boolean;
  onPress: () => void;
  color: string;
}) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.checkWrap, pressed ? { opacity: 0.8 } : null]}>
      <View style={[styles.checkBox, { borderColor: color, backgroundColor: checked ? color : 'transparent' }]}>
        {checked ? <Ionicons name="checkmark" size={14} color="#131313" /> : null}
      </View>
      <Text style={styles.checkLabel}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 32, gap: 14 },
  kicker: { fontSize: 11, fontWeight: '900', letterSpacing: 0.6 },
  sub: { marginTop: 8, fontSize: 12, fontWeight: '700', lineHeight: 18 },
  scoreRow: {
    marginTop: 12,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  scoreLabel: { fontSize: 13, fontWeight: '800' },
  scoreVal: { fontSize: 14, fontWeight: '900' },
  h: { fontSize: 15, fontWeight: '900' },
  body: { marginTop: 10, fontSize: 16, fontWeight: '800', lineHeight: 24 },
  checkRow: { flexDirection: 'row', justifyContent: 'space-around', marginTop: 16, gap: 16 },
  checkSingle: { marginTop: 16, alignItems: 'center' },
  checkWrap: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  checkBox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkLabel: { fontSize: 13, fontWeight: '800', color: '#6B6170' },
});
