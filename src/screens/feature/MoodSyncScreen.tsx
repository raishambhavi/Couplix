import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { collection, doc, onSnapshot, setDoc } from 'firebase/firestore';
import * as Haptics from 'expo-haptics';
import * as Notifications from 'expo-notifications';
import { Ionicons } from '@expo/vector-icons';

import { AmbientBackground } from '../../components/AmbientBackground';
import { FloatingBackButton } from '../../components/FloatingBackButton';
import { GoldButton } from '../../components/GoldButton';
import { MoodDial } from '../../components/MoodDial';
import { ScreenHeading } from '../../components/ScreenHeading';
import { SoftCard } from '../../components/SoftCard';
import { FIRESTORE_SYNC_FLAGS } from '../../config/firestoreSyncFlags';
import { firebaseDb } from '../../config/firebase';
import { useAuth } from '../../state/AuthContext';
import { usePairing } from '../../state/PairingContext';
import { useTheme } from '../../state/ThemeContext';

const ENABLE_MOOD_FIRESTORE_SYNC = FIRESTORE_SYNC_FLAGS.mood;

type MoodState = {
  uid: string;
  userName: string;
  value: number; // 0..7
  emoji: string;
  label: string;
  updatedAtMs: number;
};

const moodScale = [
  { value: 0, emoji: '😞', label: 'Depressed' },
  { value: 1, emoji: '😔', label: 'I need you' },
  { value: 2, emoji: '😕', label: 'Low energy' },
  { value: 3, emoji: '😌', label: 'Steady' },
  { value: 4, emoji: '🙂', label: 'Good' },
  { value: 5, emoji: '🤩', label: 'Excited' },
  { value: 6, emoji: '🥰', label: 'Feeling loved' },
  { value: 7, emoji: '😈', label: 'Feeling naughty' },
];

export function MoodSyncScreen() {
  const { colors } = useTheme();
  const auth = useAuth();
  const { coupleCode, partnerName, coupleMembershipReady } = usePairing();
  const uid = auth.user?.uid ?? 'anonymous';
  const myName = auth.profile?.displayName ?? 'You';
  const [myMood, setMyMood] = useState<MoodState | null>(null);
  const [partnerMood, setPartnerMood] = useState<MoodState | null>(null);
  const [pendingIndex, setPendingIndex] = useState(3);
  const [sending, setSending] = useState(false);
  const partnerLastRef = useRef<number>(0);

  useEffect(() => {
    if (myMood?.value == null) return;
    const c = Math.max(0, Math.min(7, Math.round(Number(myMood.value))));
    setPendingIndex(c);
  }, [myMood?.value, myMood?.updatedAtMs]);

  useEffect(() => {
    if (!ENABLE_MOOD_FIRESTORE_SYNC) return;
    if (!coupleCode || !auth.user || !coupleMembershipReady) return;
    const unsub = onSnapshot(collection(firebaseDb, 'couples', coupleCode, 'moods'), (snap) => {
      const docs = snap.docs.map((d) => d.data() as MoodState);
      const mine = docs.find((x) => x.uid === uid) ?? null;
      const other = docs
        .filter((x) => x.uid !== uid)
        .sort((a, b) => (b.updatedAtMs ?? 0) - (a.updatedAtMs ?? 0))[0] ?? null;
      setMyMood(mine);
      setPartnerMood(other);

      if (other && other.updatedAtMs > partnerLastRef.current) {
        partnerLastRef.current = other.updatedAtMs;
        // Low mood gentle private alert.
        if (other.value <= 1) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
          Notifications.scheduleNotificationAsync({
            content: {
              title: 'Mood Sync',
              body: `${partnerName || 'Your partner'} might need you right now.`,
              sound: 'default',
            },
            trigger: { seconds: 1, type: 'timeInterval' } as any,
          }).catch(() => {});
        }
      }
    });
    return () => unsub();
  }, [coupleCode, auth.user, uid, partnerName, coupleMembershipReady]);

  const sendMoodToPartner = useCallback(async () => {
    const value = pendingIndex;
    const m = moodScale.find((x) => x.value === Math.round(value)) ?? moodScale[3];
    if (!ENABLE_MOOD_FIRESTORE_SYNC) {
      setMyMood({
        uid,
        userName: myName,
        value: m.value,
        emoji: m.emoji,
        label: m.label,
        updatedAtMs: Date.now(),
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      return;
    }
    if (!coupleCode || !auth.user || !coupleMembershipReady) return;
    setSending(true);
    try {
      const payload: MoodState = {
        uid,
        userName: myName,
        value: m.value,
        emoji: m.emoji,
        label: m.label,
        updatedAtMs: Date.now(),
      };
      await setDoc(doc(firebaseDb, 'couples', coupleCode, 'moods', uid), payload, { merge: true });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (__DEV__) console.warn('[MoodSync] save failed', msg);
      Alert.alert(
        'Could not send mood',
        msg.includes('permission') || msg.includes('PERMISSION_DENIED')
          ? 'Cloud rules may be out of date. Deploy the latest firestore.rules (mood values 0–7) or try again.'
          : msg
      );
    } finally {
      setSending(false);
    }
  }, [pendingIndex, uid, myName, coupleCode, auth.user, coupleMembershipReady]);

  const canSend =
    ENABLE_MOOD_FIRESTORE_SYNC && coupleCode && auth.user && coupleMembershipReady;
  const sendBlockedNote = useMemo(() => {
    if (ENABLE_MOOD_FIRESTORE_SYNC && (!coupleCode || !coupleMembershipReady)) {
      return 'Pair with your partner to sync moods to the cloud.';
    }
    return null;
  }, [coupleCode, coupleMembershipReady]);

  return (
    <>
      <AmbientBackground />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <ScreenHeading
          title="Mood Sync"
          subtitle="Turn the dial or tap a feeling, then send it to your partner."
        />

        <SoftCard>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Your mood dial</Text>
          <MoodDial
            moods={moodScale}
            value={pendingIndex}
            onChange={setPendingIndex}
            accentColor="#EC4899"
            ringColor={colors.border}
            centerBg={colors.surface}
            textColor={colors.text}
            mutedColor={colors.muted}
          />
          <GoldButton
            title={sending ? 'Sending…' : 'Send mood to partner'}
            onPress={sendMoodToPartner}
            disabled={sending || (ENABLE_MOOD_FIRESTORE_SYNC && !canSend)}
            style={{ marginTop: 6, width: '100%' }}
          />
          {!ENABLE_MOOD_FIRESTORE_SYNC ? (
            <Text style={[styles.sendNote, { color: colors.muted }]}>
              Moods stay on this device until cloud sync is enabled.
            </Text>
          ) : sendBlockedNote ? (
            <Text style={[styles.sendNote, { color: colors.muted }]}>{sendBlockedNote}</Text>
          ) : (
            <Text style={[styles.sendNote, { color: colors.muted }]}>
              Your partner sees this in Mood Sync as soon as it is sent.
            </Text>
          )}
        </SoftCard>

        <SoftCard>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Partner mood widget</Text>
          <View style={styles.partnerWidget}>
            <Ionicons name="heart" size={18} color={colors.gold} />
            <Text style={[styles.partnerText, { color: colors.text }]}>
              {partnerName || 'Partner'}: {partnerMood ? `${partnerMood.emoji} ${partnerMood.label}` : 'No mood shared yet'}
            </Text>
          </View>
          <Text style={[styles.note, { color: colors.muted }]}>
            Low mood alerts are sent privately and gently.
          </Text>
        </SoftCard>
      </ScrollView>
      <FloatingBackButton />
    </>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  container: { paddingHorizontal: 20, paddingTop: 108, paddingBottom: 32, gap: 14 },
  sectionTitle: { fontSize: 15, fontWeight: '900', marginBottom: 4 },
  sendNote: { fontSize: 12, fontWeight: '700', marginTop: 10, textAlign: 'center', lineHeight: 17 },
  partnerWidget: {
    borderWidth: 1,
    borderColor: 'rgba(231,199,125,0.25)',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(231,199,125,0.06)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  partnerText: { fontSize: 15, fontWeight: '800', flex: 1 },
  note: { marginTop: 10, fontSize: 12, fontWeight: '700' },
});

