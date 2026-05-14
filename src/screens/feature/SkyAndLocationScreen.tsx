import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import * as Location from 'expo-location';
import { collection, doc, onSnapshot, setDoc } from 'firebase/firestore';
import { Ionicons } from '@expo/vector-icons';

import { AmbientBackground } from '../../components/AmbientBackground';
import { FloatingBackButton } from '../../components/FloatingBackButton';
import { GoldButton } from '../../components/GoldButton';
import { ScreenHeading } from '../../components/ScreenHeading';
import { SoftCard } from '../../components/SoftCard';
import { deferFirestoreUnsubscribe } from '../../config/deferFirestoreUnsubscribe';
import { FIRESTORE_SYNC_FLAGS } from '../../config/firestoreSyncFlags';
import { firebaseDb } from '../../config/firebase';
import { useAuth } from '../../state/AuthContext';
import { usePairing } from '../../state/PairingContext';
import { useTheme } from '../../state/ThemeContext';

const ENABLE_SKY = FIRESTORE_SYNC_FLAGS.sharedSky;
const ENABLE_SOFT = FIRESTORE_SYNC_FLAGS.softLocation;

const baseZones = ['At work', 'At the gym', 'Heading home', 'Out', 'At home'];

type LocationState = {
  uid: string;
  userName: string;
  currentZone: string;
  customZones: string[];
  updatedAtMs: number;
};

type SkyState = {
  uid: string;
  userName: string;
  lat: number;
  lon: number;
  updatedAtMs: number;
};

type SkyCardColors = {
  text: string;
  muted: string;
  border: string;
  cardGlow: string;
};

type WeatherView = { emoji: string; label: string; isDay: boolean };

function weatherToView(code: number, isDay: number): WeatherView {
  const day = isDay === 1;
  if ([61, 63, 65, 80, 81, 82].includes(code)) return { emoji: '🌧️', label: 'Rain', isDay: day };
  if ([71, 73, 75, 77, 85, 86].includes(code)) return { emoji: '❄️', label: 'Snow', isDay: day };
  if ([1, 2, 3, 45, 48].includes(code)) return { emoji: day ? '⛅' : '☁️', label: 'Cloudy', isDay: day };
  return { emoji: day ? '☀️' : '🌙', label: day ? 'Sunny' : 'Night', isDay: day };
}

async function fetchWeather(lat: number, lon: number): Promise<WeatherView> {
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
    `&current=weather_code,is_day&timezone=auto`;
  const res = await fetch(url);
  const json = await res.json();
  const code = json?.current?.weather_code ?? 0;
  const isDay = json?.current?.is_day ?? 1;
  return weatherToView(code, isDay);
}

function SkyCard({
  title,
  weather,
  muted,
  colors,
}: {
  title: string;
  weather: WeatherView | null;
  muted: string;
  colors: SkyCardColors;
}) {
  return (
    <View style={[styles.skyCard, { borderColor: colors.border, backgroundColor: colors.cardGlow }]}>
      <Text style={[styles.skyTitle, { color: colors.text }]}>{title}</Text>
      <Text style={styles.skyEmoji}>{weather?.emoji ?? '⛅'}</Text>
      <Text style={[styles.skyLabel, { color: colors.text }]}>{weather?.label ?? 'Loading...'}</Text>
      <Text style={[styles.skyHint, { color: colors.muted }]}>
        {weather ? (weather.isDay ? 'Daylight' : 'Nighttime') : muted}
      </Text>
    </View>
  );
}

export function SkyAndLocationScreen() {
  const { colors } = useTheme();
  const skyColors: SkyCardColors = {
    text: colors.text,
    muted: colors.muted,
    border: colors.border,
    cardGlow: colors.cardGlow,
  };
  const auth = useAuth();
  const { coupleCode, partnerName, coupleMembershipReady } = usePairing();
  const uid = auth.user?.uid ?? 'anonymous';
  const myName = auth.profile?.displayName ?? 'You';

  const [mySky, setMySky] = useState<SkyState | null>(null);
  const [partnerSky, setPartnerSky] = useState<SkyState | null>(null);
  const [myWeather, setMyWeather] = useState<WeatherView | null>(null);
  const [partnerWeather, setPartnerWeather] = useState<WeatherView | null>(null);

  const [myState, setMyState] = useState<LocationState | null>(null);
  const [partnerState, setPartnerState] = useState<LocationState | null>(null);
  const [pendingZone, setPendingZone] = useState('Out');
  const [pendingCustomAdds, setPendingCustomAdds] = useState<string[]>([]);
  const [customDraft, setCustomDraft] = useState('');
  const zoneSyncedFromServer = useRef(false);

  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!ENABLE_SOFT) return;
    if (!coupleCode || !auth.user || !coupleMembershipReady) return;
    const myRef = doc(firebaseDb, 'couples', coupleCode, 'soft_location_state', uid);
    const unsubMy = onSnapshot(myRef, (snap) => {
      if (!snap.exists()) return;
      setMyState(snap.data() as LocationState);
    });
    setDoc(
      myRef,
      {
        uid,
        userName: myName,
        currentZone: 'Out',
        customZones: [],
        updatedAtMs: Date.now(),
      },
      { merge: true }
    ).catch(() => {});
    return () => deferFirestoreUnsubscribe(unsubMy);
  }, [coupleCode, auth.user, uid, myName, coupleMembershipReady]);

  useEffect(() => {
    if (!ENABLE_SOFT) return;
    if (!coupleCode || !auth.user || !coupleMembershipReady) return;
    const unsubPartner = onSnapshot(collection(firebaseDb, 'couples', coupleCode, 'soft_location_state'), (snap) => {
      const docs = snap.docs
        .map((d) => d.data() as LocationState)
        .filter((x) => x.uid && x.uid !== uid)
        .sort((a, b) => (b.updatedAtMs ?? 0) - (a.updatedAtMs ?? 0));
      setPartnerState(docs[0] ?? null);
    });
    return () => deferFirestoreUnsubscribe(unsubPartner);
  }, [coupleCode, auth.user, uid, coupleMembershipReady]);

  useEffect(() => {
    if (myState?.currentZone && !zoneSyncedFromServer.current) {
      setPendingZone(myState.currentZone);
      zoneSyncedFromServer.current = true;
    }
  }, [myState?.currentZone]);

  useEffect(() => {
    if (!ENABLE_SKY) return;
    if (!coupleCode || !auth.user || !coupleMembershipReady) return;
    const unsub = onSnapshot(collection(firebaseDb, 'couples', coupleCode, 'sky_state'), (snap) => {
      const docs = snap.docs.map((d) => d.data() as SkyState);
      const me = docs.find((x) => x.uid === uid) ?? null;
      const other =
        docs
          .filter((x) => x.uid !== uid)
          .sort((a, b) => (b.updatedAtMs ?? 0) - (a.updatedAtMs ?? 0))[0] ?? null;
      setMySky(me);
      setPartnerSky(other);
    });
    return () => deferFirestoreUnsubscribe(unsub);
  }, [coupleCode, auth.user, uid, coupleMembershipReady]);

  useEffect(() => {
    if (!mySky) return;
    fetchWeather(mySky.lat, mySky.lon).then(setMyWeather).catch(() => {});
  }, [mySky?.lat, mySky?.lon]);

  useEffect(() => {
    if (!partnerSky) return;
    fetchWeather(partnerSky.lat, partnerSky.lon).then(setPartnerWeather).catch(() => {});
  }, [partnerSky?.lat, partnerSky?.lon]);

  const allZones = useMemo(() => {
    const c = [...(myState?.customZones ?? []), ...pendingCustomAdds];
    return [...new Set([...baseZones, ...c])];
  }, [myState?.customZones, pendingCustomAdds]);

  const sendSkyAndLocation = async () => {
    setBusy(true);
    let skyWritten = false;
    let softWritten = false;
    let localUpdated = false;
    try {
      if (ENABLE_SKY && coupleCode && auth.user && coupleMembershipReady) {
        const perm = await Location.requestForegroundPermissionsAsync();
        if (perm.granted) {
          const loc = await Location.getCurrentPositionAsync({});
          const lat = Number(loc.coords.latitude.toFixed(1));
          const lon = Number(loc.coords.longitude.toFixed(1));
          await setDoc(
            doc(firebaseDb, 'couples', coupleCode, 'sky_state', uid),
            { uid, userName: myName, lat, lon, updatedAtMs: Date.now() },
            { merge: true }
          );
          skyWritten = true;
        } else {
          Alert.alert(
            'Location',
            'Sky sharing needs location permission. Your soft zone will still be sent if cloud sync is on.'
          );
        }
      }

      const mergedCustom = [...new Set([...(myState?.customZones ?? []), ...pendingCustomAdds])];
      const payload: LocationState = {
        uid,
        userName: myName,
        currentZone: pendingZone,
        customZones: mergedCustom,
        updatedAtMs: Date.now(),
      };

      if (ENABLE_SOFT && coupleCode && auth.user && coupleMembershipReady) {
        await setDoc(doc(firebaseDb, 'couples', coupleCode, 'soft_location_state', uid), payload, { merge: true });
        softWritten = true;
      } else if (!ENABLE_SOFT) {
        setMyState(payload);
        localUpdated = true;
      }

      setPendingCustomAdds([]);
      setCustomDraft('');

      if (skyWritten || softWritten || localUpdated) {
        Alert.alert(
          '💕 Sent with love',
          'Your sky and soft zone are on their way to your partner — they’ll see your little update soon.'
        );
      }
    } catch (e) {
      Alert.alert('Could not send', e instanceof Error ? e.message : 'Try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <AmbientBackground />
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <ScreenHeading
          title="Location & sky"
          subtitle="Share your sky and soft zone together — one tap to your partner."
        />

        <SoftCard>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Share your sky</Text>
          <Text style={[styles.sectionHint, { color: colors.muted }]}>
            We use your approximate position only to show weather and day vs night — sent when you tap the button
            below.
          </Text>
          <View style={styles.skyRow}>
            <SkyCard title="You" weather={myWeather} muted="Included when you send below." colors={skyColors} />
            <SkyCard
              title={partnerName || 'Partner'}
              weather={partnerWeather}
              muted="Waiting for their sky."
              colors={skyColors}
            />
          </View>
          <Text style={[styles.privacy, { color: colors.muted }]}>
            Coordinates are rounded; only weather and daylight hints are shown.
          </Text>
        </SoftCard>

        <SoftCard>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Your soft zone</Text>
          <Text style={[styles.sectionHint, { color: colors.muted }]}>
            Pick a fuzzy zone — no exact GPS. Sent together with your sky.
          </Text>
          <View style={styles.chips}>
            {allZones.map((z) => (
              <Pressable
                key={z}
                onPress={() => setPendingZone(z)}
                style={({ pressed }) => [
                  styles.chip,
                  {
                    borderColor: pendingZone === z ? colors.gold : colors.border,
                    backgroundColor: pendingZone === z ? 'rgba(231,199,125,0.2)' : 'rgba(231,199,125,0.06)',
                    opacity: pressed ? 0.8 : 1,
                  },
                ]}
              >
                <Text style={[styles.chipText, { color: colors.text }]}>{z}</Text>
              </Pressable>
            ))}
          </View>

          <Text style={[styles.sub, { color: colors.muted }]}>Add a custom zone</Text>
          <View style={styles.inputRow}>
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
                setPendingCustomAdds((prev) => [...new Set([...prev, x])]);
                setCustomDraft('');
              }}
              style={{ minWidth: 84 }}
            />
          </View>

          <Text style={[styles.sectionTitle, { color: colors.text, marginTop: 16 }]}>
            {partnerName || 'Partner'} is
          </Text>
          <View style={styles.partnerCard}>
            <Ionicons name="location" size={18} color={colors.gold} />
            <Text style={[styles.partnerZone, { color: colors.text }]}>
              {partnerState?.currentZone ?? 'No zone shared yet'}
            </Text>
          </View>
        </SoftCard>

        <GoldButton
          title={busy ? 'Sending…' : 'Send sky & location to partner'}
          onPress={() => void sendSkyAndLocation()}
          disabled={busy}
          style={{ marginTop: 4 }}
        />
      </ScrollView>
      <FloatingBackButton />
    </>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 40, gap: 14 },
  sectionTitle: { fontSize: 15, fontWeight: '900', marginBottom: 6 },
  sectionHint: { fontSize: 12, fontWeight: '700', lineHeight: 17, marginBottom: 12 },
  skyRow: { flexDirection: 'row', gap: 10 },
  skyCard: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 10,
    alignItems: 'center',
  },
  skyTitle: { fontSize: 13, fontWeight: '900' },
  skyEmoji: { fontSize: 38, marginTop: 4 },
  skyLabel: { fontSize: 14, fontWeight: '900', marginTop: 2 },
  skyHint: { fontSize: 12, fontWeight: '700', marginTop: 2, textAlign: 'center' },
  privacy: { marginTop: 10, fontSize: 12, fontWeight: '700' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderWidth: 1, borderRadius: 999, paddingVertical: 8, paddingHorizontal: 12 },
  chipText: { fontSize: 13, fontWeight: '800' },
  sub: { marginTop: 14, marginBottom: 8, fontSize: 12, fontWeight: '800' },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
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
});
