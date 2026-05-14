import React, { useCallback, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { AmbientBackground } from '../../components/AmbientBackground';
import { FloatingBackButton } from '../../components/FloatingBackButton';
import { GoldButton } from '../../components/GoldButton';
import { SoftCard } from '../../components/SoftCard';
import type { RitualsStackParamList } from '../../navigation/RitualsStack';
import {
  QOTD_TOPIC_SECTIONS,
  isValidQotdTopicId,
  topicRowById,
  type QotdTopicRow,
} from '../../data/qotdTopics';
import { useRituals } from '../../state/RitualsContext';
import { useTheme } from '../../state/ThemeContext';

export function QuestionOfTheDayScreen() {
  const { colors, mode } = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RitualsStackParamList>>();
  const { partnerUid, ritualDayKey, qotdLockedTopicId, confirmQotdTopic } = useRituals();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  /** Prefer explicit tap; fall back to today’s lock so Continue works after Firestore hydrates. */
  const effectiveTopicId = useMemo(() => {
    const sel = selectedId && isValidQotdTopicId(selectedId) ? selectedId : null;
    const lock = qotdLockedTopicId && isValidQotdTopicId(qotdLockedTopicId) ? qotdLockedTopicId : null;
    return sel ?? lock;
  }, [selectedId, qotdLockedTopicId]);

  React.useEffect(() => {
    if (!qotdLockedTopicId || !isValidQotdTopicId(qotdLockedTopicId)) return;
    setSelectedId((prev) => (prev == null ? qotdLockedTopicId : prev));
  }, [qotdLockedTopicId]);

  const onContinue = useCallback(() => {
    if (!effectiveTopicId || busy) return;
    setBusy(true);
    navigation.navigate('QuestionOfTheDayAnswer', { topicId: effectiveTopicId });
    confirmQotdTopic(effectiveTopicId)
      .then((r) => {
        if (r === 'auth') {
          Alert.alert('Sign in required', 'Sign in to save your topic and answer for today.');
        }
        if (r === 'invalid') {
          Alert.alert('Topic unavailable', 'Pick another topic from the list.');
        }
      })
      .catch(() => {})
      .finally(() => setBusy(false));
  }, [confirmQotdTopic, navigation, effectiveTopicId, busy]);

  const cardBg = mode === 'dark' ? 'rgba(35,18,40,0.92)' : 'rgba(255,248,252,0.94)';

  return (
    <>
      <AmbientBackground />
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.headerBlock}>
          <Text style={[styles.titleSmall, { color: colors.muted }]}>Answer</Text>
          <Text style={[styles.titleLarge, { color: colors.text }]}>Pick your topic</Text>
          <Text style={[styles.subtitle, { color: colors.muted }]}>
            Choose a topic, then tap Continue to see today’s question on the next screen.
          </Text>
          <Text style={[styles.dayPill, { color: colors.gold, borderColor: colors.border }]}>
            UTC day {ritualDayKey}
            {partnerUid ? '' : ' · pair to sync answers with your partner'}
          </Text>
        </View>

        {QOTD_TOPIC_SECTIONS.map((section) => (
          <View key={section.title} style={styles.sectionBlock}>
            <Text style={[styles.sectionLabel, { color: colors.text }]}>{section.title}</Text>
            <View style={{ gap: 10 }}>
              {section.topicIds.map((id) => {
                const row = topicRowById(id);
                if (!row) return null;
                return (
                  <TopicRowCard
                    key={id}
                    row={row}
                    selected={effectiveTopicId === row.id}
                    onPress={() => setSelectedId(row.id)}
                    cardBg={cardBg}
                    colors={{ text: colors.text, border: colors.border, gold: colors.gold }}
                  />
                );
              })}
            </View>
          </View>
        ))}

        {qotdLockedTopicId ? (
          <SoftCard>
            <Text style={[styles.lockNote, { color: colors.muted }]}>
              You already have a topic for today. Tap Continue to open the question, or pick a different topic to switch
              yours.
            </Text>
          </SoftCard>
        ) : null}

        <GoldButton title={busy ? 'Opening…' : 'Continue'} disabled={!effectiveTopicId || busy} onPress={onContinue} />
      </ScrollView>
      <FloatingBackButton />
    </>
  );
}

function TopicRowCard({
  row,
  selected,
  onPress,
  cardBg,
  colors,
}: {
  row: QotdTopicRow;
  selected: boolean;
  onPress: () => void;
  cardBg: string;
  colors: { text: string; border: string; gold: string };
}) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [{ opacity: pressed ? 0.9 : 1 }]}>
      <View
        style={[
          styles.topicCard,
          {
            backgroundColor: cardBg,
            borderColor: selected ? colors.gold : colors.border,
            borderWidth: selected ? 2 : 1,
          },
        ]}
      >
        <Text style={styles.topicEmoji}>{row.emoji}</Text>
        <View style={{ flex: 1, justifyContent: 'center' }}>
          <Text style={[styles.topicTitle, { color: colors.text }]}>{row.title}</Text>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 100, gap: 14 },
  headerBlock: { marginBottom: 4 },
  sectionBlock: { gap: 8 },
  titleSmall: { fontSize: 16, fontWeight: '800', letterSpacing: 0.2 },
  titleLarge: { marginTop: 4, fontSize: 28, fontWeight: '900', letterSpacing: -0.4 },
  subtitle: { marginTop: 8, fontSize: 14, fontWeight: '700', lineHeight: 20 },
  dayPill: {
    marginTop: 10,
    alignSelf: 'flex-start',
    fontSize: 11,
    fontWeight: '800',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    overflow: 'hidden',
  },
  sectionLabel: { fontSize: 13, fontWeight: '900', letterSpacing: 0.4, marginBottom: 8, marginLeft: 2, marginTop: 4 },
  topicCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 20,
    paddingVertical: 16,
    paddingHorizontal: 16,
    gap: 14,
    minHeight: 64,
  },
  topicEmoji: { fontSize: 30 },
  topicTitle: { fontSize: 17, fontWeight: '900' },
  lockNote: { fontSize: 13, fontWeight: '600', lineHeight: 19 },
});
