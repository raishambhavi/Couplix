import React, { useEffect, useMemo, useRef } from 'react';
import { Image, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { AmbientBackground } from '../../components/AmbientBackground';
import { FloatingBackButton } from '../../components/FloatingBackButton';
import { SoftCard } from '../../components/SoftCard';
import { useAuth } from '../../state/AuthContext';
import { useTogether } from '../../state/TogetherContext';
import { useTheme } from '../../state/ThemeContext';

let MapView: React.ComponentType<any> | null = null;
let Marker: React.ComponentType<any> | null = null;
if (Platform.OS !== 'web') {
  const maps = require('react-native-maps');
  MapView = maps.default;
  Marker = maps.Marker;
}

function isRemotePhotoUri(uri: string | undefined): boolean {
  return !!uri && /^https?:\/\//i.test(uri.trim());
}

export function TravelMapScreen() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const { trips } = useTogether();
  const mapRef = useRef<any>(null);

  const initialRegion = useMemo(() => {
    if (trips.length === 0) {
      return { latitude: 20, longitude: 0, latitudeDelta: 120, longitudeDelta: 120 };
    }
    const lats = trips.map((t) => t.latitude);
    const lons = trips.map((t) => t.longitude);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLon = Math.min(...lons);
    const maxLon = Math.max(...lons);
    const midLat = (minLat + maxLat) / 2;
    const midLon = (minLon + maxLon) / 2;
    const pad = 1.8;
    return {
      latitude: midLat,
      longitude: midLon,
      latitudeDelta: Math.max((maxLat - minLat) * pad, 3),
      longitudeDelta: Math.max((maxLon - minLon) * pad, 3),
    };
  }, [trips]);

  useEffect(() => {
    if (Platform.OS === 'web' || !mapRef.current || trips.length === 0 || !MapView) return;
    const coords = trips.map((t) => ({ latitude: t.latitude, longitude: t.longitude }));
    mapRef.current.fitToCoordinates(coords, {
      edgePadding: { top: 80, right: 60, bottom: 120, left: 60 },
      animated: true,
    });
  }, [trips]);

  return (
    <>
      <AmbientBackground />
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <Text style={[styles.title, { color: colors.text }]}>Your travel map</Text>
        <Text style={[styles.sub, { color: colors.muted }]}>
          Pins sync for both of you — zoom and explore like any map app.
        </Text>

        {Platform.OS === 'web' || !MapView || !Marker ? (
          <SoftCard>
            <Text style={[styles.webNote, { color: colors.muted }]}>
              Interactive maps run on the Couplix iOS and Android apps. You have {trips.length} trip
              {trips.length === 1 ? '' : 's'} saved.
            </Text>
          </SoftCard>
        ) : (
          <View style={[styles.mapWrap, { borderColor: colors.border }]}>
            <MapView
              ref={mapRef}
              style={styles.map}
              initialRegion={initialRegion}
              showsUserLocation
              showsCompass
              mapType="standard"
            >
              {trips.map((t) => (
                <Marker
                  key={t.id}
                  coordinate={{ latitude: t.latitude, longitude: t.longitude }}
                  title={t.title}
                  description={t.placeLabel}
                  tracksViewChanges={false}
                >
                  <View style={styles.markerBubble}>
                    <Ionicons name="heart" size={14} color="#fff" />
                  </View>
                </Marker>
              ))}
            </MapView>
          </View>
        )}

        <SoftCard>
          <Text style={[styles.listTitle, { color: colors.text }]}>All stops ({trips.length})</Text>
          {trips.length === 0 ? (
            <Text style={[styles.empty, { color: colors.muted }]}>
              No pins yet — use “Update your trip” to add your first place.
            </Text>
          ) : (
            trips.map((t) => {
              const remotePhoto = isRemotePhotoUri(t.photoUri);
              const addedBy =
                t.addedByUid && user?.uid && t.addedByUid === user.uid
                  ? 'you'
                  : t.addedByName?.trim() || (t.addedByUid ? 'Partner' : null);
              return (
                <View key={t.id} style={[styles.listRow, { borderBottomColor: colors.border }]}>
                  {remotePhoto ? (
                    <Image source={{ uri: t.photoUri! }} style={styles.thumb} />
                  ) : (
                    <View style={[styles.thumb, styles.thumbPlaceholder, { borderColor: colors.border }]}>
                      <Ionicons name="image-outline" size={20} color={colors.muted} />
                    </View>
                  )}
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.listName, { color: colors.text }]} numberOfLines={1}>
                      {t.title}
                    </Text>
                    <Text style={[styles.listPlace, { color: colors.muted }]} numberOfLines={2}>
                      {t.placeLabel}
                    </Text>
                    {addedBy ? (
                      <Text style={[styles.addedBy, { color: colors.muted }]}>
                        Added by {addedBy === 'you' ? 'You' : addedBy}
                      </Text>
                    ) : null}
                  </View>
                </View>
              );
            })
          )}
        </SoftCard>
      </ScrollView>
      <FloatingBackButton />
    </>
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 40, gap: 14 },
  title: { fontSize: 22, fontWeight: '900' },
  sub: { fontSize: 13, fontWeight: '700', lineHeight: 19, marginBottom: 4 },
  mapWrap: {
    height: 380,
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
    position: 'relative',
  },
  map: { ...StyleSheet.absoluteFillObject },
  markerBubble: {
    backgroundColor: '#EC4899',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: '#fff',
  },
  webNote: { fontSize: 14, fontWeight: '700', lineHeight: 20 },
  listTitle: { fontSize: 15, fontWeight: '900', marginBottom: 10 },
  empty: { fontSize: 13, fontWeight: '700' },
  listRow: {
    flexDirection: 'row',
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
  },
  thumb: { width: 48, height: 48, borderRadius: 12 },
  thumbPlaceholder: { alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  listName: { fontSize: 15, fontWeight: '900' },
  listPlace: { fontSize: 12, fontWeight: '700', marginTop: 2 },
  addedBy: { fontSize: 11, fontWeight: '700', marginTop: 4, fontStyle: 'italic' },
});
