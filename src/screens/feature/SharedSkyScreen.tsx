import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import * as Location from 'expo-location';
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
const ENABLE_SHARED_SKY_FIRESTORE_SYNC = FIRESTORE_SYNC_FLAGS.sharedSky;

type SkyCardColors = {
  text: string;
  muted: string;
  border: string;
  cardGlow: string;
};

type SkyState = {
  uid: string;
  userName: string;
  lat: number;
  lon: number;
  updatedAtMs: number;
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

export function SharedSkyScreen() {
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
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!ENABLE_SHARED_SKY_FIRESTORE_SYNC) return;
    if (!coupleCode || !auth.user || !coupleMembershipReady) return;
    const unsub = onSnapshot(collection(firebaseDb, 'couples', coupleCode, 'sky_state'), (snap) => {
      const docs = snap.docs.map((d) => d.data() as SkyState);
      const me = docs.find((x) => x.uid === uid) ?? null;
      const other = docs
        .filter((x) => x.uid !== uid)
        .sort((a, b) => (b.updatedAtMs ?? 0) - (a.updatedAtMs ?? 0))[0] ?? null;
      setMySky(me);
      setPartnerSky(other);
    });
    return () => unsub();
  }, [coupleCode, auth.user, uid, coupleMembershipReady]);

  useEffect(() => {
    if (!mySky) return;
    fetchWeather(mySky.lat, mySky.lon).then(setMyWeather).catch(() => {});
  }, [mySky?.lat, mySky?.lon]);

  useEffect(() => {
    if (!partnerSky) return;
    fetchWeather(partnerSky.lat, partnerSky.lon).then(setPartnerWeather).catch(() => {});
  }, [partnerSky?.lat, partnerSky?.lon]);

  const shareMySky = async () => {
    if (!ENABLE_SHARED_SKY_FIRESTORE_SYNC) return;
    if (!coupleCode || !auth.user || !coupleMembershipReady) return;
    setBusy(true);
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (!perm.granted) return;
      const loc = await Location.getCurrentPositionAsync({});
      const lat = Number(loc.coords.latitude.toFixed(1));
      const lon = Number(loc.coords.longitude.toFixed(1));
      await setDoc(
        doc(firebaseDb, 'couples', coupleCode, 'sky_state', uid),
        { uid, userName: myName, lat, lon, updatedAtMs: Date.now() },
        { merge: true }
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <AmbientBackground />
      <View style={styles.container}>
        <ScreenHeading title="Shared Sky" subtitle="Side-by-side weather-aware ambient sky." />

        <SoftCard>
          <View style={styles.row}>
            <SkyCard title="You" weather={myWeather} muted="Share your sky to start." colors={skyColors} />
            <SkyCard
              title={partnerName || 'Partner'}
              weather={partnerWeather}
              muted="Waiting for partner sky."
              colors={skyColors}
            />
          </View>
          <GoldButton
            title={busy ? 'Updating...' : 'Share My Sky'}
            onPress={shareMySky}
            disabled={busy}
            style={{ marginTop: 14 }}
          />
          <Text style={[styles.privacy, { color: colors.muted }]}>
            Privacy-safe: coordinates are rounded and only weather/day-night art is shown.
          </Text>
        </SoftCard>
      </View>
      <FloatingBackButton />
    </>
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: 20, paddingTop: 108, paddingBottom: 32, gap: 14 },
  row: { flexDirection: 'row', gap: 10 },
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
});

