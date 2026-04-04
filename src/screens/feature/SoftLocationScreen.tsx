import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { collection, doc, onSnapshot, setDoc } from 'firebase/firestore';
import { Ionicons } from '@expo/vector-icons';

import { AmbientBackground } from '../../components/AmbientBackground';
import { FloatingBackButton } from '../../components/FloatingBackButton';
import { GoldButton } from '../../components/GoldButton';
import { ScreenHeading } from '../../components/ScreenHeading';
import { SoftCard } from '../../components/SoftCard';
import { FIRESTORE_SYNC_FLAGS } from '../../config/firestoreSyncFlags';
import { firebaseDb } from '../../config/firebase';
import { useAuth } from '../../state/AuthContext';
import { usePairing } from '../../state/PairingContext';
import { useTheme } from '../../state/ThemeContext';

const ENABLE_SOFT_LOCATION_FIRESTORE_SYNC = FIRESTORE_SYNC_FLAGS.softLocation;

const baseZones = ['At work', 'At the gym', 'Heading home', 'Out', 'At home'];

type LocationState = {
  uid: string;
  userName: string;
  currentZone: string;
  customZones: string[];
  updatedAtMs: number;
};

export function SoftLocationScreen() {
  const { colors } = useTheme();
  const auth = useAuth();
  const { coupleCode, partnerName, coupleMembershipReady } = usePairing();
  const uid = auth.user?.uid ?? 'anonymous';
  const myName = auth.profile?.displayName ?? 'You';
  const [myState, setMyState] = useState<LocationState | null>(null);
  const [partnerState, setPartnerState] = useState<LocationState | null>(null);
  const [customDraft, setCustomDraft] = useState('');

  const allZones = useMemo(() => {
    const c = myState?.customZones ?? [];
    return [...new Set([...baseZones, ...c])];
  }, [myState?.customZones]);

  useEffect(() => {
    if (!ENABLE_SOFT_LOCATION_FIRESTORE_SYNC) return;
    if (!coupleCode || !auth.user || !coupleMembershipReady) return;
    const myRef = doc(firebaseDb, 'couples', coupleCode, 'soft_location_state', uid);
    const unsubMy = onSnapshot(myRef, (snap) => {
      if (!snap.exists()) return;
      setMyState(snap.data() as LocationState);
    });

    // Initialize once if missing.
    setDoc(myRef, {
      uid,
      userName: myName,
      currentZone: 'Out',
      customZones: [],
      updatedAtMs: Date.now(),
    }, { merge: true }).catch(() => {});

    return () => unsubMy();
  }, [coupleCode, auth.user, uid, myName, coupleMembershipReady]);

  useEffect(() => {
    if (!ENABLE_SOFT_LOCATION_FIRESTORE_SYNC) return;
    if (!coupleCode || !auth.user || !coupleMembershipReady) return;
    const unsubPartner = onSnapshot(collection(firebaseDb, 'couples', coupleCode, 'soft_location_state'), (snap) => {
      const docs = snap.docs
        .map((d) => d.data() as LocationState)
        .filter((x) => x.uid && x.uid !== uid)
        .sort((a, b) => (b.updatedAtMs ?? 0) - (a.updatedAtMs ?? 0));
      setPartnerState(docs[0] ?? null);
    });
    return () => unsubPartner();
  }, [coupleCode, auth.user, uid, coupleMembershipReady]);

  const saveMine = async (next: Partial<LocationState>) => {
    if (!ENABLE_SOFT_LOCATION_FIRESTORE_SYNC) {
      setMyState((prev) => ({
        uid,
        userName: myName,
        currentZone: next.currentZone ?? prev?.currentZone ?? 'Out',
        customZones: next.customZones ?? prev?.customZones ?? [],
        updatedAtMs: Date.now(),
      }));
      return;
    }
    if (!coupleCode || !auth.user || !coupleMembershipReady) return;
    const payload: LocationState = {
      uid,
      userName: myName,
      currentZone: next.currentZone ?? myState?.currentZone ?? 'Out',
      customZones: next.customZones ?? myState?.customZones ?? [],
      updatedAtMs: Date.now(),
    };
    // User-specific doc
    await setDoc(doc(firebaseDb, 'couples', coupleCode, 'soft_location_state', uid), payload, { merge: true });
  };

  return (
    <>
      <AmbientBackground />
      <View style={styles.container}>
        <ScreenHeading title="Soft Location" subtitle="Your vibe, never exact coordinates." />

        <SoftCard>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Your current zone</Text>
          <View style={styles.chips}>
            {allZones.map((z) => (
              <Pressable
                key={z}
                onPress={() => saveMine({ currentZone: z })}
                style={({ pressed }) => [
                  styles.chip,
                  {
                    borderColor: myState?.currentZone === z ? colors.gold : colors.border,
                    backgroundColor: myState?.currentZone === z ? 'rgba(231,199,125,0.2)' : 'rgba(231,199,125,0.06)',
                    opacity: pressed ? 0.8 : 1,
                  },
                ]}
              >
                <Text style={[styles.chipText, { color: colors.text }]}>{z}</Text>
              </Pressable>
            ))}
          </View>

          <Text style={[styles.sub, { color: colors.muted }]}>Create a custom meaningful zone</Text>
          <View style={styles.row}>
            <TextInput
              value={customDraft}
              onChangeText={setCustomDraft}
              placeholder="Date night spot"
              placeholderTextColor={colors.muted}
              style={[styles.input, { color: colors.text, borderColor: colors.border }]}
            />
            <GoldButton
              title="Add"
              onPress={() => {
                const x = customDraft.trim();
                if (!x) return;
                const next = [...new Set([...(myState?.customZones ?? []), x])];
                saveMine({ customZones: next }).catch(() => {});
                setCustomDraft('');
              }}
              style={{ minWidth: 84 }}
            />
          </View>
        </SoftCard>

        <SoftCard>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>{partnerName || 'Partner'} is</Text>
          <View style={styles.partnerCard}>
            <Ionicons name="location" size={18} color={colors.gold} />
            <Text style={[styles.partnerZone, { color: colors.text }]}>
              {partnerState?.currentZone ?? 'No zone shared yet'}
            </Text>
          </View>
          <Text style={[styles.privacy, { color: colors.muted }]}>
            Privacy-first: only broad zones are shown, never exact coordinates.
          </Text>
        </SoftCard>
      </View>
      <FloatingBackButton />
    </>
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: 20, paddingTop: 108, paddingBottom: 32, gap: 14 },
  sectionTitle: { fontSize: 15, fontWeight: '900', marginBottom: 10 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderWidth: 1, borderRadius: 999, paddingVertical: 8, paddingHorizontal: 12 },
  chipText: { fontSize: 13, fontWeight: '800' },
  sub: { marginTop: 14, marginBottom: 8, fontSize: 12, fontWeight: '800' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  input: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 10,
    backgroundColor: 'rgba(231,199,125,0.05)',
    fontWeight: '800',
  },
  partnerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: 'rgba(231,199,125,0.25)',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(231,199,125,0.05)',
  },
  partnerZone: { fontSize: 15, fontWeight: '900' },
  privacy: { marginTop: 10, fontSize: 12, fontWeight: '700' },
});

