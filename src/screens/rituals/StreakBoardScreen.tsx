import React from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AmbientBackground } from '../../components/AmbientBackground';
import { FloatingBackButton } from '../../components/FloatingBackButton';
import { GoldButton } from '../../components/GoldButton';
import { SoftCard } from '../../components/SoftCard';
import { useRituals } from '../../state/RitualsContext';
import { useTheme } from '../../state/ThemeContext';

const rescueChallenges = [
  'Send a 10-second voice “thinking of you”.',
  'Share one photo from your day.',
  'Send one gratitude line now.',
];

export function StreakBoardScreen() {
  const { colors } = useTheme();
  const { streakBoard, setStreakBoard, saveRitualsState } = useRituals();

  return (
    <>
      <AmbientBackground />
      <ScrollView contentContainerStyle={styles.container}>
        <SoftCard>
          <View style={styles.board}>
            <Text style={[styles.meta, { color: colors.text }]}>Good morning: {streakBoard.goodMorning}</Text>
            <Text style={[styles.meta, { color: colors.text }]}>Dares completed: {streakBoard.daresCompleted}</Text>
            <Text style={[styles.meta, { color: colors.text }]}>Calls had: {streakBoard.calls}</Text>
            <Text style={[styles.meta, { color: colors.text }]}>Notes sent: {streakBoard.notesSent}</Text>
            <Text style={[styles.meta, { color: colors.text }]}>Daily snaps: {streakBoard.snaps}</Text>
          </View>
          <GoldButton
            title="Rescue Challenge"
            onPress={() => {
              const rescue = rescueChallenges[Math.floor(Math.random() * rescueChallenges.length)];
              const nextBoard = { ...streakBoard, goodMorning: streakBoard.goodMorning + 1 };
              setStreakBoard(nextBoard);
              saveRitualsState({ streakBoard: nextBoard }).catch(() => {});
              Alert.alert('Rescue challenge', rescue);
            }}
            style={{ marginTop: 8 }}
          />
          <Text style={[styles.meta, { color: colors.gold }]}>Milestones unlock at 7, 30, 100 days.</Text>
        </SoftCard>
      </ScrollView>
      <FloatingBackButton />
    </>
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 32, gap: 14 },
  meta: { marginTop: 8, fontSize: 12, fontWeight: '700', lineHeight: 18 },
  board: { marginTop: 6, gap: 2 },
});
