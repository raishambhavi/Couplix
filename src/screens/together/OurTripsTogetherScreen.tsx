import React, { useMemo } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

import { AmbientBackground } from '../../components/AmbientBackground';
import { FloatingBackButton } from '../../components/FloatingBackButton';
import { GoldButton } from '../../components/GoldButton';
import { SoftCard } from '../../components/SoftCard';
import type { TogetherStackParamList } from '../../navigation/TogetherStack';
import { useAuth } from '../../state/AuthContext';
import { useTogether } from '../../state/TogetherContext';
import { useTheme } from '../../state/ThemeContext';
import { cityLabelForTripStats, countryLabelForTripStats } from '../../utils/tripPlaceLabels';

function isRemotePhoto(uri: string | undefined) {
  return !!uri && /^https?:\/\//i.test(uri.trim());
}

export function OurTripsTogetherScreen() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const { trips } = useTogether();
  const navigation = useNavigation<NativeStackNavigationProp<TogetherStackParamList>>();

  const stats = useMemo(() => {
    const countries = new Set<string>();
    const cities = new Set<string>();
    for (const t of trips) {
      const co = countryLabelForTripStats(t);
      if (co) countries.add(co);
      const ci = cityLabelForTripStats(t);
      if (ci) cities.add(ci);
    }
    return {
      trips: trips.length,
      countries: countries.size,
      cities: cities.size,
    };
  }, [trips]);

  return (
    <>
      <AmbientBackground />
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <LinearGradient
          colors={['rgba(236,72,153,0.38)', 'rgba(168,85,247,0.1)', 'transparent']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.hero}
        >
          <Text style={[styles.heroEyebrow, { color: colors.muted }]}>Together</Text>
          <Text style={[styles.heroTitle, { color: colors.text }]}>Our Trips Together</Text>
          <Text style={[styles.heroSub, { color: colors.muted }]}>
            Search for cities, parks, or landmarks — drop a pin for every adventure. Your map fills in as you go.
          </Text>
        </LinearGradient>

        <View style={styles.statRow}>
          <View style={[styles.statPill, { borderColor: colors.border, backgroundColor: colors.cardGlow }]}>
            <Text style={[styles.statNum, { color: colors.text }]}>{stats.countries}</Text>
            <Text style={[styles.statLabel, { color: colors.muted }]}>countries</Text>
          </View>
          <View style={[styles.statPill, { borderColor: colors.border, backgroundColor: colors.cardGlow }]}>
            <Text style={[styles.statNum, { color: colors.text }]}>{stats.cities}</Text>
            <Text style={[styles.statLabel, { color: colors.muted }]}>cities</Text>
          </View>
          <View style={[styles.statPill, { borderColor: colors.border, backgroundColor: colors.cardGlow }]}>
            <Text style={[styles.statNum, { color: colors.text }]}>{stats.trips}</Text>
            <Text style={[styles.statLabel, { color: colors.muted }]}>pins</Text>
          </View>
        </View>

        <SoftCard>
          <GoldButton
            title="Update your trip"
            onPress={() => navigation.navigate('UpdateTrip')}
            style={styles.btn}
          />
          <GoldButton title="View your travel map" onPress={() => navigation.navigate('TravelMap')} style={styles.btnGap} />
          <Text style={[styles.hint, { color: colors.muted }]}>
            Add a stop with photos and dates — opens like a familiar map, powered by OpenStreetMap search.
          </Text>
        </SoftCard>

        {trips.length > 0 ? (
          <SoftCard>
            <Text style={[styles.recentTitle, { color: colors.text }]}>Latest pins</Text>
            {trips.slice(0, 5).map((t) => {
              const by =
                t.addedByUid && user?.uid && t.addedByUid === user.uid
                  ? 'You'
                  : t.addedByName?.trim() || null;
              return (
                <Pressable
                  key={t.id}
                  onPress={() => navigation.navigate('TravelMap')}
                  style={({ pressed }) => [
                    styles.row,
                    {
                      borderBottomColor: colors.border,
                      opacity: pressed ? 0.85 : 1,
                    },
                  ]}
                >
                  <View style={styles.rowIcon}>
                    {isRemotePhoto(t.photoUri) ? (
                      <Image source={{ uri: t.photoUri }} style={styles.rowThumb} resizeMode="cover" />
                    ) : (
                      <Ionicons name="location" size={18} color="#EC4899" />
                    )}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.rowTitle, { color: colors.text }]} numberOfLines={1}>
                      {t.title}
                    </Text>
                    <Text style={[styles.rowSub, { color: colors.muted }]} numberOfLines={2}>
                      {t.placeLabel}
                    </Text>
                    {by ? (
                      <Text style={[styles.rowBy, { color: colors.muted }]} numberOfLines={1}>
                        Added by {by}
                      </Text>
                    ) : null}
                  </View>
                  <Ionicons name="map-outline" size={18} color={colors.muted} />
                </Pressable>
              );
            })}
          </SoftCard>
        ) : null}
      </ScrollView>
      <FloatingBackButton />
    </>
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 40, gap: 14 },
  hero: {
    borderRadius: 22,
    padding: 20,
    marginBottom: 4,
    borderWidth: 1,
    borderColor: 'rgba(244,114,182,0.28)',
  },
  heroEyebrow: { fontSize: 11, fontWeight: '800', letterSpacing: 1.4, textTransform: 'uppercase' },
  heroTitle: { fontSize: 24, fontWeight: '900', marginTop: 6 },
  heroSub: { fontSize: 13, fontWeight: '700', lineHeight: 19, marginTop: 10 },
  statRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  statPill: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    paddingVertical: 12,
    alignItems: 'center',
  },
  statNum: { fontSize: 20, fontWeight: '900' },
  statLabel: { fontSize: 11, fontWeight: '800', marginTop: 4, textTransform: 'uppercase', letterSpacing: 0.6 },
  btn: { width: '100%' },
  btnGap: { width: '100%', marginTop: 10 },
  hint: { fontSize: 12, fontWeight: '700', marginTop: 14, lineHeight: 17, textAlign: 'center' },
  recentTitle: { fontSize: 15, fontWeight: '900', marginBottom: 10 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(236,72,153,0.12)', overflow: 'hidden' },
  rowThumb: { width: 36, height: 36, borderRadius: 10 },
  rowTitle: { fontSize: 15, fontWeight: '900' },
  rowSub: { fontSize: 12, fontWeight: '700', marginTop: 2 },
  rowBy: { fontSize: 10, fontWeight: '700', marginTop: 2, fontStyle: 'italic' },
});
