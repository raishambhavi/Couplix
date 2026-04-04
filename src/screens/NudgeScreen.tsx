import React, { useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { addDoc, collection, limit, onSnapshot, orderBy, query, serverTimestamp } from 'firebase/firestore';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';

import { AmbientBackground } from '../components/AmbientBackground';
import { FloatingBackButton } from '../components/FloatingBackButton';
import { GoldButton } from '../components/GoldButton';
import { ScreenHeading } from '../components/ScreenHeading';
import { SoftCard } from '../components/SoftCard';
import { FIRESTORE_SYNC_FLAGS } from '../config/firestoreSyncFlags';
import { firebaseDb } from '../config/firebase';
import { useAuth } from '../state/AuthContext';
import { usePairing } from '../state/PairingContext';
import { useTheme } from '../state/ThemeContext';

const ENABLE_NUDGE_FIRESTORE_SYNC = FIRESTORE_SYNC_FLAGS.nudge;

type Pattern = { id: 'soft' | 'double' | 'long_short'; label: string; hint: string };
type NudgeEvent = { id: string; senderUid: string; senderName: string; patternId: Pattern['id']; createdAtMs: number };

const patterns: Pattern[] = [
  { id: 'soft', label: 'Soft Pulse', hint: 'One gentle tap' },
  { id: 'double', label: 'Double Tap', hint: 'Your signature nudge' },
  { id: 'long_short', label: 'Long + Short', hint: 'Warm and playful' },
];

function formatTime(ts: number) {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

async function playPattern(id: Pattern['id']) {
  if (id === 'soft') {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    return;
  }
  if (id === 'double') {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Rigid).catch(() => {}), 140);
    return;
  }
  await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
  setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {}), 220);
}

export function NudgeScreen() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { coupleCode, partnerName, coupleMembershipReady } = usePairing();
  const auth = useAuth();
  const uid = auth.user?.uid ?? 'anonymous';
  const me = auth.profile?.displayName ?? 'You';
  const [patternId, setPatternId] = useState<Pattern['id']>('double');
  const [history, setHistory] = useState<NudgeEvent[]>([]);
  const [sending, setSending] = useState(false);
  const canUse = !!coupleCode && !!auth.user;
  const prefKey = `nudgePattern:${uid}`;
  const [lastIncomingAt, setLastIncomingAt] = useState<number | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const saved = await AsyncStorage.getItem(prefKey);
        if (!mounted) return;
        if (saved === 'soft' || saved === 'double' || saved === 'long_short') setPatternId(saved);
      } catch {}
    })();
    return () => {
      mounted = false;
    };
  }, [prefKey]);

  useEffect(() => {
    AsyncStorage.setItem(prefKey, patternId).catch(() => {});
  }, [patternId, prefKey]);

  useEffect(() => {
    if (!ENABLE_NUDGE_FIRESTORE_SYNC) return;
    if (!coupleCode || !coupleMembershipReady) return;
    const q = query(
      collection(firebaseDb, 'couples', coupleCode, 'nudges'),
      orderBy('createdAtMs', 'desc'),
      limit(40)
    );
    let isFirstSnapshot = true;
    let lastHandledMs = 0;
    const unsub = onSnapshot(q, (snap) => {
      const rows: NudgeEvent[] = snap.docs.map((d) => {
        const x = d.data() as any;
        return {
          id: d.id,
          senderUid: x.senderUid ?? '',
          senderName: x.senderName ?? 'Unknown',
          patternId: (x.patternId ?? 'double') as Pattern['id'],
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
        setLastIncomingAt(createdAtMs);
        playPattern((x.patternId ?? 'double') as Pattern['id']).catch(() => {});
      }
    });
    return () => unsub();
  }, [coupleCode, uid, coupleMembershipReady]);

  const sendNudge = async () => {
    if (!ENABLE_NUDGE_FIRESTORE_SYNC) {
      await playPattern(patternId).catch(() => {});
      return;
    }
    if (!coupleCode || !auth.user || !coupleMembershipReady) return;
    setSending(true);
    const now = Date.now();
    try {
      await addDoc(collection(firebaseDb, 'couples', coupleCode, 'nudges'), {
        senderUid: uid,
        senderName: me,
        patternId,
        createdAtMs: now,
        createdAt: serverTimestamp(),
      });
      await playPattern(patternId);
    } finally {
      setSending(false);
    }
  };

  const incomingNote = useMemo(() => {
    if (!lastIncomingAt) return 'No nudge received yet';
    return `Last nudge from ${partnerName || 'partner'} at ${formatTime(lastIncomingAt)}`;
  }, [lastIncomingAt, partnerName]);

  return (
    <>
      <AmbientBackground />
      <ScrollView
        contentContainerStyle={[styles.container, { paddingBottom: Math.max(insets.bottom, 16) + 24 }]}
      >
        <ScreenHeading title="Nudge" subtitle="Custom vibration signals, zero words." />

        <SoftCard>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Choose your nudge pattern</Text>
          <View style={styles.patternWrap}>
            {patterns.map((p) => (
              <Pressable
                key={p.id}
                onPress={() => setPatternId(p.id)}
                style={({ pressed }) => [
                  styles.patternItem,
                  {
                    borderColor: patternId === p.id ? colors.gold : colors.border,
                    backgroundColor: patternId === p.id ? 'rgba(231,199,125,0.2)' : 'rgba(231,199,125,0.06)',
                    opacity: pressed ? 0.8 : 1,
                  },
                ]}
              >
                <Text style={[styles.patternLabel, { color: colors.text }]}>{p.label}</Text>
                <Text style={[styles.patternHint, { color: colors.muted }]}>{p.hint}</Text>
              </Pressable>
            ))}
          </View>

          <GoldButton
            title={sending ? 'Sending...' : 'Send Nudge'}
            onPress={() => sendNudge()}
            disabled={!canUse || sending}
            style={{ marginTop: 14 }}
          />

          <Text style={[styles.note, { color: colors.muted }]}>{incomingNote}</Text>
        </SoftCard>

        <SoftCard>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Nudge timeline</Text>
          <FlatList
            data={history}
            scrollEnabled={false}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <View style={styles.row}>
                <Ionicons
                  name={item.senderUid === uid ? 'sparkles' : 'sparkles-outline'}
                  size={16}
                  color={colors.gold}
                />
                <Text style={[styles.rowText, { color: colors.text }]}>
                  {item.senderUid === uid ? 'You' : item.senderName} • {formatTime(item.createdAtMs)}
                </Text>
              </View>
            )}
            ListEmptyComponent={<Text style={[styles.empty, { color: colors.muted }]}>No nudges yet.</Text>}
          />
        </SoftCard>
      </ScrollView>
      <FloatingBackButton />
    </>
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: 20, paddingTop: 108, paddingBottom: 32, gap: 14 },
  sectionTitle: { fontSize: 15, fontWeight: '900', marginBottom: 10 },
  patternWrap: { gap: 10 },
  patternItem: { borderWidth: 1, borderRadius: 14, paddingVertical: 10, paddingHorizontal: 12 },
  patternLabel: { fontSize: 14, fontWeight: '900' },
  patternHint: { fontSize: 12, fontWeight: '700', marginTop: 3 },
  note: { marginTop: 12, fontSize: 13, fontWeight: '700', textAlign: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  rowText: { fontSize: 14, fontWeight: '700' },
  empty: { fontSize: 13, fontWeight: '700', marginTop: 8 },
});

