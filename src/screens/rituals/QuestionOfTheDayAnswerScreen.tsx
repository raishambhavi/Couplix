import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';

import { AmbientBackground } from '../../components/AmbientBackground';
import { FloatingBackButton } from '../../components/FloatingBackButton';
import { GoldButton } from '../../components/GoldButton';
import { SoftCard } from '../../components/SoftCard';
import { isValidQotdTopicId, syncedTopicQuestion, topicRowById } from '../../data/qotdTopics';
import type { RitualsStackParamList } from '../../navigation/RitualsStack';
import { useAuth } from '../../state/AuthContext';
import { usePairing } from '../../state/PairingContext';
import { useRituals } from '../../state/RitualsContext';
import { useTheme } from '../../state/ThemeContext';

export function QuestionOfTheDayAnswerScreen() {
  const { colors, mode } = useTheme();
  const navigation = useNavigation();
  const route = useRoute<RouteProp<RitualsStackParamList, 'QuestionOfTheDayAnswer'>>();
  const { coupleCode } = usePairing();
  const { user } = useAuth();
  const myUid = user?.uid ?? null;
  const {
    partnerName,
    partnerUid,
    ritualDayKey,
    qotdLockedTopicId,
    partnerQotdTopicId,
    qotdCrossTopic,
    currentQotd,
    myQ,
    setMyQ,
    partnerAnswer,
    partnerMirrorAnswer,
    mySavedQotd,
    myMirrorSavedQotd,
    saveMyQotdAnswer,
    saveMirrorQotdAnswer,
  } = useRituals();

  const paramTopicId = route.params?.topicId;
  const topicIdForDisplay = useMemo(() => {
    const fromRoute = paramTopicId && isValidQotdTopicId(paramTopicId) ? paramTopicId : null;
    return qotdLockedTopicId ?? fromRoute;
  }, [qotdLockedTopicId, paramTopicId]);

  const qotdSyncKey = useMemo(() => coupleCode?.trim() || myUid || '', [coupleCode, myUid]);

  const displayQuestion = useMemo(() => {
    if (!topicIdForDisplay || !isValidQotdTopicId(topicIdForDisplay)) {
      return currentQotd;
    }
    if (!qotdSyncKey) {
      return 'Sign in to see your daily question for this topic.';
    }
    return syncedTopicQuestion(topicIdForDisplay, qotdSyncKey, ritualDayKey);
  }, [topicIdForDisplay, qotdSyncKey, ritualDayKey, currentQotd]);

  const partnerTopicQuestion = useMemo(() => {
    if (!partnerQotdTopicId || !isValidQotdTopicId(partnerQotdTopicId)) return '';
    if (!qotdSyncKey) return '';
    return syncedTopicQuestion(partnerQotdTopicId, qotdSyncKey, ritualDayKey);
  }, [partnerQotdTopicId, qotdSyncKey, ritualDayKey]);

  const [saving, setSaving] = useState(false);
  const [savingMirror, setSavingMirror] = useState(false);
  const [mirrorDraft, setMirrorDraft] = useState(myMirrorSavedQotd);

  useEffect(() => {
    setMirrorDraft(myMirrorSavedQotd);
  }, [myMirrorSavedQotd]);

  const topicMeta = useMemo(() => (topicIdForDisplay ? topicRowById(topicIdForDisplay) : undefined), [topicIdForDisplay]);
  const partnerTopicMeta = useMemo(
    () => (partnerQotdTopicId ? topicRowById(partnerQotdTopicId) : undefined),
    [partnerQotdTopicId],
  );

  const primaryDone = !!mySavedQotd;
  const mirrorDone = !qotdCrossTopic || !!myMirrorSavedQotd;
  const allAnswered = primaryDone && mirrorDone;

  const sameTopicReveal = !qotdCrossTopic && !!(mySavedQotd && partnerAnswer);
  const crossYourTopicReveal = qotdCrossTopic && !!(mySavedQotd && partnerMirrorAnswer);
  const crossTheirTopicReveal = qotdCrossTopic && !!(partnerAnswer && myMirrorSavedQotd);
  const crossFullReveal = qotdCrossTopic && crossYourTopicReveal && crossTheirTopicReveal;

  const gradientColors = useMemo(
    () =>
      mode === 'dark'
        ? (['rgba(216,113,151,0.45)', 'rgba(50,25,60,0.55)'] as const)
        : (['rgba(231,199,125,0.45)', 'rgba(255,240,246,0.95)'] as const),
    [mode],
  );

  const onSavePrimary = useCallback(() => {
    setSaving(true);
    saveMyQotdAnswer(myQ, topicIdForDisplay)
      .catch(() => {})
      .finally(() => setSaving(false));
  }, [myQ, saveMyQotdAnswer, topicIdForDisplay]);

  const onSaveMirror = useCallback(() => {
    setSavingMirror(true);
    saveMirrorQotdAnswer(mirrorDraft)
      .catch(() => {})
      .finally(() => setSavingMirror(false));
  }, [mirrorDraft, saveMirrorQotdAnswer]);

  if (!topicIdForDisplay) {
    return (
      <>
        <AmbientBackground />
        <View style={[styles.center, { padding: 24 }]}>
          <Text style={[styles.title, { color: colors.text }]}>Pick a topic first</Text>
          <Text style={[styles.sub, { color: colors.muted }]}>
            Choose a topic on the previous screen, then tap Continue so we know which prompt to show.
          </Text>
          <GoldButton title="Back to topics" onPress={() => navigation.goBack()} style={{ marginTop: 16 }} />
        </View>
        <FloatingBackButton />
      </>
    );
  }

  return (
    <>
      <AmbientBackground />
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.heroWrap}>
          <LinearGradient colors={gradientColors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.heroInner}>
            <Text style={styles.kicker}>Question of the day</Text>
            {topicMeta ? (
              <Text style={[styles.topicLine, { color: colors.muted }]}>
                {topicMeta.emoji} {topicMeta.title}
                {qotdCrossTopic ? ' · your topic' : ''}
              </Text>
            ) : null}
            <Text style={[styles.question, { color: colors.text }]}>{displayQuestion}</Text>
            <Text style={[styles.sync, { color: colors.muted }]}>
              {coupleCode?.trim() ? `Synced for your pair · ${ritualDayKey}` : ritualDayKey}
            </Text>
          </LinearGradient>
        </View>

        {allAnswered ? (
          <SoftCard>
            <Text style={[styles.doneTitle, { color: colors.gold }]}>You are all set for today</Text>
            <Text style={[styles.doneBody, { color: colors.text }]}>
              {qotdCrossTopic
                ? `You answered both prompts. When ${partnerName || 'your partner'} finishes, check the reveal below.`
                : `Come back after the next UTC midnight for a fresh topic. You can still read the reveal when ${partnerName || 'your partner'} saves.`}
            </Text>
            <Pressable onPress={() => navigation.goBack()} style={styles.textLinkWrap}>
              <Text style={[styles.textLink, { color: colors.gold }]}>Browse topics</Text>
            </Pressable>
          </SoftCard>
        ) : (
          <>
            {!primaryDone ? (
              <SoftCard>
                <Text style={[styles.label, { color: colors.muted }]}>Your answer</Text>
                <TextInput
                  value={myQ}
                  onChangeText={setMyQ}
                  placeholder="Share honestly — your partner unlocks the reveal after you both save."
                  placeholderTextColor={colors.muted}
                  style={[styles.input, { color: colors.text, borderColor: colors.border }]}
                  multiline
                />
                <GoldButton
                  title={saving ? 'Saving…' : 'Save my answer'}
                  disabled={saving || !myQ.trim()}
                  onPress={onSavePrimary}
                  style={{ marginTop: 12 }}
                />
              </SoftCard>
            ) : null}

            {qotdCrossTopic && primaryDone && !mirrorDone && partnerTopicMeta ? (
              <SoftCard>
                <Text style={[styles.label, { color: colors.muted }]}>
                  {partnerName ? `${partnerName}’s topic` : 'Your partner’s topic'}
                </Text>
                <Text style={[styles.partnerTopicLine, { color: colors.text }]}>
                  {partnerTopicMeta.emoji} {partnerTopicMeta.title}
                </Text>
                <Text style={[styles.partnerQuestion, { color: colors.text }]}>{partnerTopicQuestion}</Text>
                <Text style={[styles.hint, { color: colors.muted }]}>
                  Answer this too so you both see what the other thought on each prompt.
                </Text>
                <TextInput
                  value={mirrorDraft}
                  onChangeText={setMirrorDraft}
                  placeholder="Your answer on their topic…"
                  placeholderTextColor={colors.muted}
                  style={[styles.input, { color: colors.text, borderColor: colors.border }]}
                  multiline
                />
                <GoldButton
                  title={savingMirror ? 'Saving…' : 'Save answer on their topic'}
                  disabled={savingMirror || !mirrorDraft.trim()}
                  onPress={onSaveMirror}
                  style={{ marginTop: 12 }}
                />
              </SoftCard>
            ) : null}
          </>
        )}

        <SoftCard>
          <Text style={[styles.label, { color: colors.muted }]}>Reveal</Text>
          <View style={[styles.reveal, { borderColor: colors.border }]}>
            {!partnerUid ? (
              <Text style={[styles.meta, { color: colors.muted }]}>
                Pair with your partner to exchange answers and see both sides here.
              </Text>
            ) : !qotdCrossTopic ? (
              sameTopicReveal ? (
                <>
                  <Text style={[styles.revealHeading, { color: colors.gold }]}>Both answers</Text>
                  <Text style={[styles.meta, { color: colors.text }]}>
                    <Text style={{ fontWeight: '900' }}>You: </Text>
                    {mySavedQotd}
                  </Text>
                  <Text style={[styles.meta, { color: colors.text, marginTop: 12 }]}>
                    <Text style={{ fontWeight: '900' }}>{partnerName || 'Partner'}: </Text>
                    {partnerAnswer}
                  </Text>
                </>
              ) : (
                <Text style={[styles.meta, { color: colors.muted }]}>
                  When you and {partnerName || 'your partner'} have both saved for today, your answers appear here.
                </Text>
              )
            ) : (
              <>
                <Text style={[styles.revealHeading, { color: colors.gold }]}>Your topic</Text>
                {crossYourTopicReveal ? (
                  <>
                    <Text style={[styles.meta, { color: colors.text }]}>
                      <Text style={{ fontWeight: '900' }}>You: </Text>
                      {mySavedQotd}
                    </Text>
                    <Text style={[styles.meta, { color: colors.text, marginTop: 10 }]}>
                      <Text style={{ fontWeight: '900' }}>{partnerName || 'Partner'} on your prompt: </Text>
                      {partnerMirrorAnswer}
                    </Text>
                  </>
                ) : (
                  <Text style={[styles.meta, { color: colors.muted }]}>
                    Unlocks when you have saved and {partnerName || 'your partner'} answers your topic.
                  </Text>
                )}

                <Text style={[styles.revealHeading, { color: colors.gold, marginTop: 18 }]}>Their topic</Text>
                {crossTheirTopicReveal ? (
                  <>
                    <Text style={[styles.meta, { color: colors.text }]}>
                      <Text style={{ fontWeight: '900' }}>{partnerName || 'Partner'}: </Text>
                      {partnerAnswer}
                    </Text>
                    <Text style={[styles.meta, { color: colors.text, marginTop: 10 }]}>
                      <Text style={{ fontWeight: '900' }}>You on their prompt: </Text>
                      {myMirrorSavedQotd}
                    </Text>
                  </>
                ) : (
                  <Text style={[styles.meta, { color: colors.muted }]}>
                    Unlocks when they save and you answer their topic.
                  </Text>
                )}

                {crossFullReveal ? (
                  <Text style={[styles.meta, { color: colors.gold, marginTop: 16, fontWeight: '800' }]}>
                    Full reveal — you have both prompts covered.
                  </Text>
                ) : null}
              </>
            )}
          </View>
        </SoftCard>
      </ScrollView>
      <FloatingBackButton />
    </>
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 40, gap: 14 },
  center: { flex: 1, justifyContent: 'center' },
  title: { fontSize: 22, fontWeight: '900' },
  sub: { marginTop: 10, fontSize: 14, fontWeight: '600', lineHeight: 20 },
  heroWrap: {
    borderRadius: 22,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  heroInner: { paddingHorizontal: 20, paddingVertical: 22 },
  kicker: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 2,
    textTransform: 'uppercase',
    opacity: 0.85,
  },
  topicLine: { marginTop: 8, fontSize: 13, fontWeight: '800' },
  question: { marginTop: 10, fontSize: 18, fontWeight: '800', lineHeight: 26 },
  sync: { marginTop: 12, fontSize: 11, fontWeight: '700' },
  label: { fontSize: 11, fontWeight: '800', letterSpacing: 0.3 },
  partnerTopicLine: { marginTop: 8, fontSize: 15, fontWeight: '900' },
  partnerQuestion: { marginTop: 10, fontSize: 16, fontWeight: '800', lineHeight: 24 },
  hint: { marginTop: 8, fontSize: 12, fontWeight: '600', lineHeight: 18 },
  input: {
    marginTop: 10,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: 'rgba(231,199,125,0.05)',
    fontWeight: '700',
    minHeight: 110,
    textAlignVertical: 'top',
  },
  reveal: {
    marginTop: 10,
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    backgroundColor: 'rgba(231,199,125,0.06)',
  },
  revealHeading: { fontSize: 13, fontWeight: '900', marginBottom: 8 },
  meta: { fontSize: 13, fontWeight: '700', lineHeight: 20 },
  doneTitle: { fontSize: 16, fontWeight: '900' },
  doneBody: { marginTop: 8, fontSize: 14, fontWeight: '600', lineHeight: 21 },
  textLinkWrap: { marginTop: 12 },
  textLink: { fontSize: 14, fontWeight: '900' },
});
