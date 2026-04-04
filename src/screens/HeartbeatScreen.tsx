import React, { useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { addDoc, collection, onSnapshot, orderBy, query, serverTimestamp, limit } from 'firebase/firestore';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';

import { AmbientBackground } from '../components/AmbientBackground';
import { FloatingBackButton } from '../components/FloatingBackButton';
import { ScreenHeading } from '../components/ScreenHeading';
import { SoftCard } from '../components/SoftCard';
import { FIRESTORE_SYNC_FLAGS } from '../config/firestoreSyncFlags';
import { useAuth } from '../state/AuthContext';
import { usePairing } from '../state/PairingContext';
import { useTheme } from '../state/ThemeContext';
import { firebaseDb } from '../config/firebase';

const ENABLE_HEARTBEAT_FIRESTORE_SYNC = FIRESTORE_SYNC_FLAGS.heartbeat;

type HeartbeatEvent = {
  id: string;
  senderUid: string;
  senderName: string;
  createdAtMs: number;
};

function formatTime(ts: number) {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function HeartbeatScreen() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const auth = useAuth();
  const { coupleCode, partnerName, coupleMembershipReady } = usePairing();
  const uid = auth.user?.uid ?? 'anonymous';
  const me = auth.profile?.displayName ?? 'You';
  const [isHolding, setIsHolding] = useState(false);
  const [history, setHistory] = useState<HeartbeatEvent[]>([]);
  const [lastReceivedAt, setLastReceivedAt] = useState<number | null>(null);
  const holdTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const isHoldingRef = useRef(false);

  const canUse = !!coupleCode && !!auth.user && (!ENABLE_HEARTBEAT_FIRESTORE_SYNC || coupleMembershipReady);

  useEffect(() => {
    return () => {
      isHoldingRef.current = false;
      if (holdTimer.current) {
        clearInterval(holdTimer.current);
        holdTimer.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!ENABLE_HEARTBEAT_FIRESTORE_SYNC) return;
    if (!coupleCode || !coupleMembershipReady) return;
    const q = query(
      collection(firebaseDb, 'couples', coupleCode, 'heartbeat_events'),
      orderBy('createdAtMs', 'desc'),
      limit(30)
    );
    let isFirstSnapshot = true;
    let lastHandledMs = 0;
    const unsub = onSnapshot(q, (snap) => {
      const rows: HeartbeatEvent[] = snap.docs.map((d) => {
        const x = d.data() as any;
        return {
          id: d.id,
          senderUid: x.senderUid ?? '',
          senderName: x.senderName ?? 'Unknown',
          createdAtMs: x.createdAtMs ?? 0,
        };
      });
      setHistory(rows);

      if (isFirstSnapshot) {
        isFirstSnapshot = false;
        lastHandledMs = rows[0]?.createdAtMs ?? 0;
        return;
      }

      for (const change of snap.docChanges()) {
        if (change.type !== 'added') continue;
        const x = change.doc.data() as any;
        const createdAtMs = x.createdAtMs ?? 0;
        const senderUidDoc = x.senderUid ?? '';
        if (senderUidDoc === uid) continue;
        if (createdAtMs <= lastHandledMs) continue;
        lastHandledMs = createdAtMs;
        setLastReceivedAt(createdAtMs);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
        setTimeout(() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Rigid).catch(() => {});
        }, 140);
        setTimeout(() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
        }, 280);
      }
    });
    return () => unsub();
  }, [coupleCode, uid, coupleMembershipReady]);

  const sendBeat = async () => {
    if (!ENABLE_HEARTBEAT_FIRESTORE_SYNC) return;
    if (!coupleCode || !auth.user || !coupleMembershipReady) return;
    const now = Date.now();
    await addDoc(collection(firebaseDb, 'couples', coupleCode, 'heartbeat_events'), {
      senderUid: uid,
      senderName: me,
      createdAtMs: now,
      createdAt: serverTimestamp(),
    });
  };

  const startHold = async () => {
    if (!canUse) return;
    if (holdTimer.current) clearInterval(holdTimer.current);
    isHoldingRef.current = true;
    setIsHolding(true);
    await sendBeat();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
    holdTimer.current = setInterval(() => {
      if (!isHoldingRef.current) {
        if (holdTimer.current) clearInterval(holdTimer.current);
        holdTimer.current = null;
        return;
      }
      sendBeat().catch(() => {});
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Rigid).catch(() => {});
    }, 900);
  };

  const stopHold = () => {
    isHoldingRef.current = false;
    setIsHolding(false);
    if (holdTimer.current) {
      clearInterval(holdTimer.current);
      holdTimer.current = null;
    }
  };

  const recentReceived = useMemo(() => {
    if (!lastReceivedAt) return `No heartbeat received yet`;
    return `Last heartbeat from ${partnerName || 'partner'} at ${formatTime(lastReceivedAt)}`;
  }, [lastReceivedAt, partnerName]);

  return (
    <>
      <AmbientBackground />
      <ScrollView
        scrollEnabled={!isHolding}
        contentContainerStyle={[styles.container, { paddingBottom: Math.max(insets.bottom, 16) + 24 }]}
      >
        <ScreenHeading
          title="Heartbeat Share"
          subtitle="Tap and hold to send your heartbeat pulse."
        />

        <SoftCard>
          <Pressable
            onPressIn={startHold}
            onPressOut={stopHold}
            onTouchEnd={stopHold}
            onTouchCancel={stopHold}
            style={({ pressed }) => [
              styles.heartbeatPad,
              {
                backgroundColor: isHolding || pressed ? 'rgba(231, 199, 125, 0.2)' : 'rgba(231, 199, 125, 0.08)',
                borderColor: colors.border,
              },
            ]}
          >
            <Ionicons name="heart" size={44} color={colors.gold} />
            <Text style={[styles.padTitle, { color: colors.text }]}>
              {isHolding ? 'Sending heartbeat...' : 'Tap & Hold'}
            </Text>
            <Text style={[styles.padHint, { color: colors.muted }]}>
              Live haptic sync to {partnerName || 'your partner'}
            </Text>
          </Pressable>

          <Text style={[styles.note, { color: colors.muted }]}>
            {recentReceived}
          </Text>
        </SoftCard>

        <SoftCard>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Heartbeat timeline</Text>
          <FlatList
            data={history}
            scrollEnabled={false}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <View style={styles.row}>
                <Ionicons
                  name={item.senderUid === uid ? 'heart' : 'heart-outline'}
                  size={16}
                  color={colors.gold}
                />
                <Text style={[styles.rowText, { color: colors.text }]}>
                  {item.senderUid === uid ? 'You' : item.senderName} • {formatTime(item.createdAtMs)}
                </Text>
              </View>
            )}
            ListEmptyComponent={
              <Text style={[styles.empty, { color: colors.muted }]}>No heartbeat events yet.</Text>
            }
          />
        </SoftCard>
      </ScrollView>
      <FloatingBackButton />
    </>
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: 20, paddingTop: 108, paddingBottom: 32, gap: 14 },
  heartbeatPad: {
    borderWidth: 1,
    borderRadius: 20,
    paddingVertical: 28,
    alignItems: 'center',
    gap: 8,
  },
  padTitle: { fontSize: 20, fontWeight: '900' },
  padHint: { fontSize: 13, fontWeight: '700' },
  note: { marginTop: 12, fontSize: 13, fontWeight: '700', textAlign: 'center' },
  sectionTitle: { fontSize: 15, fontWeight: '900', marginBottom: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  rowText: { fontSize: 14, fontWeight: '700' },
  empty: { fontSize: 13, fontWeight: '700', marginTop: 8 },
});

