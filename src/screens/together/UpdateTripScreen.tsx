import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';

import { AmbientBackground } from '../../components/AmbientBackground';
import { FloatingBackButton } from '../../components/FloatingBackButton';
import { GoldButton } from '../../components/GoldButton';
import { SoftCard } from '../../components/SoftCard';
import { useNavigation } from '@react-navigation/native';
import { FIRESTORE_SYNC_FLAGS } from '../../config/firestoreSyncFlags';
import { useAuth } from '../../state/AuthContext';
import { usePairing } from '../../state/PairingContext';
import { useTogether, type TripPin } from '../../state/TogetherContext';
import { useTheme } from '../../state/ThemeContext';
import { displayNameFromProfile } from '../../utils/displayName';
import { uploadTripPhoto } from '../../utils/uploadChatMedia';
import {
  deriveCityFromHit,
  deriveCountryFromHit,
  labelFromHit,
  pickCity,
  searchPlaces,
  type NominatimHit,
} from '../../utils/nominatimGeocode';
import { inferCityFromPlaceLabel, inferCountryFromPlaceLabel } from '../../utils/tripPlaceLabels';

const TRIP_DATE_MIN = new Date(1920, 0, 1);
const TRIP_DATE_MAX = new Date(new Date().getFullYear() + 1, 11, 31);

let MapView: React.ComponentType<any> | null = null;
let Marker: React.ComponentType<any> | null = null;
if (Platform.OS !== 'web') {
  const maps = require('react-native-maps');
  MapView = maps.default;
  Marker = maps.Marker;
}

function addressBits(hit: NominatimHit) {
  const a = hit.address;
  const city = pickCity(a) || deriveCityFromHit(hit);
  const country = a?.country?.trim() || deriveCountryFromHit(hit);
  const stateOrRegion = a?.state || a?.county;
  let placeKind: string | undefined;
  if (a?.national_park) placeKind = 'National park';
  else if (a?.tourism === 'national_park') placeKind = 'National park';
  else if (hit.class === 'boundary' && hit.type === 'national_park') placeKind = 'National park';
  return { country, stateOrRegion, city, placeKind };
}

const ENABLE_TRIP_SYNC = FIRESTORE_SYNC_FLAGS.together;

export function UpdateTripScreen() {
  const insets = useSafeAreaInsets();
  const { colors, mode } = useTheme();
  const { user, profile } = useAuth();
  const { coupleCode, coupleMembershipReady } = usePairing();
  const { addTrip } = useTogether();
  const navigation = useNavigation();

  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<NominatimHit[]>([]);
  const [selected, setSelected] = useState<NominatimHit | null>(null);
  const [title, setTitle] = useState('');
  const [visitedAt, setVisitedAt] = useState(new Date());
  const [showDate, setShowDate] = useState(false);
  /** iOS spinner must not live inside ScrollView (wheels won’t scroll past ~epoch / get stuck). */
  const [dateDraft, setDateDraft] = useState(() => new Date());
  const [photoUri, setPhotoUri] = useState<string | undefined>();
  const [locLoading, setLocLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (selected) {
      const base = labelFromHit(selected).split(',')[0]?.trim() ?? 'Our trip';
      setTitle((t) => (t.trim() ? t : base));
    }
  }, [selected]);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      return;
    }
    const t = setTimeout(() => {
      setLoading(true);
      searchPlaces(q)
        .then(setResults)
        .catch(() => setResults([]))
        .finally(() => setLoading(false));
    }, 500);
    return () => clearTimeout(t);
  }, [query]);

  const region = useMemo(() => {
    if (!selected) {
      return { latitude: 25, longitude: 10, latitudeDelta: 50, longitudeDelta: 50 };
    }
    const lat = parseFloat(selected.lat);
    const lon = parseFloat(selected.lon);
    return { latitude: lat, longitude: lon, latitudeDelta: 0.35, longitudeDelta: 0.35 };
  }, [selected]);

  const useCurrentLocation = useCallback(async () => {
    setLocLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const { latitude, longitude } = pos.coords;
      const geo = await Location.reverseGeocodeAsync({ latitude, longitude });
      const g = geo[0];
      const placeLabel = [g?.name, g?.city, g?.region, g?.country].filter(Boolean).join(', ') || `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
      const bits = {
        country: g?.country ?? undefined,
        stateOrRegion: g?.region ?? undefined,
        city: g?.city ?? g?.subregion ?? undefined,
        placeKind: undefined as string | undefined,
      };
      const synthetic: NominatimHit = {
        lat: String(latitude),
        lon: String(longitude),
        display_name: placeLabel,
        address: {},
      };
      setSelected(synthetic);
      setQuery(placeLabel);
      setTitle(g?.city || g?.name || 'Our trip');
      // store structured bits by adding to a ref - we'll merge on save from reverse geocode only
      (synthetic as any)._extra = bits;
    } finally {
      setLocLoading(false);
    }
  }, []);

  const save = useCallback(async () => {
    if (!selected) return;
    const lat = parseFloat(selected.lat);
    const lon = parseFloat(selected.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;
    setSaving(true);
    try {
      const tripId = `trip_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
      let finalPhoto = photoUri?.trim() || undefined;
      if (
        finalPhoto &&
        !/^https?:\/\//i.test(finalPhoto) &&
        ENABLE_TRIP_SYNC &&
        coupleCode &&
        user?.uid
      ) {
        if (!coupleMembershipReady) {
          Alert.alert('Sync still connecting', 'Please wait 2-3 seconds, then try saving again.');
          return;
        }
        try {
          finalPhoto = await uploadTripPhoto({ coupleCode, tripId, uri: finalPhoto });
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          Alert.alert('Photo upload failed', msg);
          return;
        }
      }

      const bits = addressBits(selected);
      const extra = (selected as any)._extra as Partial<typeof bits> | undefined;
      const label = labelFromHit(selected);
      const cityResolved =
        extra?.city?.trim() ||
        bits.city?.trim() ||
        inferCityFromPlaceLabel(label) ||
        undefined;
      const countryResolved =
        extra?.country?.trim() ||
        bits.country?.trim() ||
        inferCountryFromPlaceLabel(label) ||
        undefined;
      const trip: Omit<TripPin, 'id'> = {
        title: title.trim() || labelFromHit(selected).slice(0, 80),
        latitude: lat,
        longitude: lon,
        placeLabel: labelFromHit(selected),
        visitedAt: visitedAt.getTime(),
        photoUri: finalPhoto,
        country: countryResolved,
        stateOrRegion: extra?.stateOrRegion ?? bits.stateOrRegion,
        city: cityResolved,
        placeKind: bits.placeKind,
        ...(user
          ? {
              addedByUid: user.uid,
              addedByName: displayNameFromProfile(profile, user),
            }
          : {}),
      };
      addTrip(trip, { tripId });
      navigation.goBack();
    } finally {
      setSaving(false);
    }
  }, [selected, title, visitedAt, photoUri, addTrip, navigation, coupleCode, coupleMembershipReady, user, profile]);

  const pickPhoto = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.85 });
    if (!res.canceled && res.assets[0]?.uri) setPhotoUri(res.assets[0].uri);
  };

  return (
    <>
      <AmbientBackground />
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Text style={[styles.screenTitle, { color: colors.text }]}>Update your trip</Text>
        <Text style={[styles.screenSub, { color: colors.muted }]}>
          Search for a city, state, national park, or landmark — we resolve it like a maps app.
        </Text>

        <SoftCard>
          <Text style={[styles.label, { color: colors.muted }]}>Where did you go?</Text>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Try: Yosemite, Paris, Tokyo Skytree…"
            placeholderTextColor={colors.muted}
            style={[styles.input, { color: colors.text, borderColor: colors.border }]}
          />
          {loading ? <ActivityIndicator color={colors.gold} style={{ marginTop: 8 }} /> : null}
          {results.length > 0 ? (
            <FlatList
              scrollEnabled={false}
              data={results}
              keyExtractor={(item, i) => `${item.lat}-${item.lon}-${i}`}
              renderItem={({ item }) => {
                const isPick =
                  selected != null && selected.lat === item.lat && selected.lon === item.lon;
                return (
                <Pressable
                  onPress={() => {
                    setSelected(item);
                    setQuery(labelFromHit(item));
                  }}
                  style={[
                    styles.hitRow,
                    {
                      borderColor: isPick ? '#EC4899' : colors.border,
                      backgroundColor: isPick ? 'rgba(236,72,153,0.1)' : 'transparent',
                    },
                  ]}
                >
                  <Ionicons name="location-outline" size={18} color="#EC4899" />
                  <Text style={[styles.hitText, { color: colors.text }]} numberOfLines={3}>
                    {labelFromHit(item)}
                  </Text>
                </Pressable>
                );
              }}
            />
          ) : null}

          <Pressable
            onPress={useCurrentLocation}
            disabled={locLoading}
            style={({ pressed }) => [styles.locBtn, { borderColor: colors.border, opacity: pressed ? 0.85 : 1 }]}
          >
            <Ionicons name="navigate" size={18} color="#EC4899" />
            <Text style={[styles.locBtnText, { color: colors.text }]}>
              {locLoading ? 'Locating…' : 'Use my current location'}
            </Text>
          </Pressable>
        </SoftCard>

        {selected && MapView && Marker ? (
          <View style={[styles.mapWrap, { borderColor: colors.border }]}>
            <MapView
              key={`${selected.lat}-${selected.lon}`}
              style={styles.map}
              region={region}
              scrollEnabled={false}
            >
              <Marker
                coordinate={{ latitude: parseFloat(selected.lat), longitude: parseFloat(selected.lon) }}
                title={title || 'Trip'}
                tracksViewChanges={false}
              >
                <View style={styles.markerPin}>
                  <Ionicons name="heart" size={16} color="#fff" />
                </View>
              </Marker>
            </MapView>
          </View>
        ) : selected && Platform.OS === 'web' ? (
          <SoftCard>
            <Text style={{ color: colors.muted, fontWeight: '700' }}>Map preview on iOS / Android.</Text>
          </SoftCard>
        ) : null}

        <SoftCard>
          <Text style={[styles.label, { color: colors.muted }]}>Trip name</Text>
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="e.g. Summer in Lisbon"
            placeholderTextColor={colors.muted}
            style={[styles.input, { color: colors.text, borderColor: colors.border }]}
          />
          <Text style={[styles.label, { color: colors.muted, marginTop: 12 }]}>When were you there?</Text>
          <Pressable
            onPress={() => {
              setDateDraft(visitedAt);
              setShowDate(true);
            }}
            style={[styles.dateBtn, { borderColor: colors.border }]}
          >
            <Text style={[styles.dateTxt, { color: colors.text }]}>
              {visitedAt.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
            </Text>
            <Ionicons name="calendar-outline" size={20} color={colors.gold} />
          </Pressable>
          {Platform.OS === 'ios' ? (
            <Modal visible={showDate} animationType="slide" transparent onRequestClose={() => setShowDate(false)}>
              <View style={styles.dateModalRoot} pointerEvents="box-none">
                <Pressable style={styles.dateModalBackdrop} onPress={() => setShowDate(false)} />
                <View
                  style={[
                    styles.dateModalSheet,
                    {
                      backgroundColor: mode === 'dark' ? '#1a1520' : '#fff',
                      paddingBottom: Math.max(insets.bottom, 12),
                    },
                  ]}
                >
                  <View style={styles.dateModalHeader}>
                    <Pressable onPress={() => setShowDate(false)} hitSlop={12}>
                      <Text style={[styles.dateModalAction, { color: colors.muted }]}>Cancel</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => {
                        setVisitedAt(dateDraft);
                        setShowDate(false);
                      }}
                      hitSlop={12}
                    >
                      <Text style={[styles.dateModalAction, { color: colors.gold }]}>Done</Text>
                    </Pressable>
                  </View>
                  <DateTimePicker
                    value={dateDraft}
                    mode="date"
                    display="spinner"
                    themeVariant={mode === 'dark' ? 'dark' : 'light'}
                    minimumDate={TRIP_DATE_MIN}
                    maximumDate={TRIP_DATE_MAX}
                    onChange={(_, d) => {
                      if (d) setDateDraft(d);
                    }}
                  />
                </View>
              </View>
            </Modal>
          ) : (
            showDate && (
              <DateTimePicker
                value={visitedAt}
                mode="date"
                display="default"
                themeVariant={mode === 'dark' ? 'dark' : 'light'}
                minimumDate={TRIP_DATE_MIN}
                maximumDate={TRIP_DATE_MAX}
                onChange={(_, d) => {
                  setShowDate(false);
                  if (d) setVisitedAt(d);
                }}
              />
            )
          )}
          <Text style={[styles.label, { color: colors.muted, marginTop: 12 }]}>Photo (optional)</Text>
          <Pressable onPress={pickPhoto} style={[styles.photoBtn, { borderColor: colors.border }]}>
            {photoUri ? (
              <Image source={{ uri: photoUri }} style={styles.photoPreview} />
            ) : (
              <Text style={{ color: colors.muted, fontWeight: '800' }}>Add a memory photo</Text>
            )}
          </Pressable>
        </SoftCard>

        <GoldButton title={saving ? 'Saving…' : 'Save trip pin'} onPress={save} disabled={!selected || saving} />
      </ScrollView>
      <FloatingBackButton />
    </>
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 48, gap: 14 },
  screenTitle: { fontSize: 22, fontWeight: '900' },
  screenSub: { fontSize: 13, fontWeight: '700', lineHeight: 19, marginBottom: 4 },
  label: { fontSize: 11, fontWeight: '900', letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontWeight: '700',
  },
  hitRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 8,
  },
  hitText: { flex: 1, fontSize: 13, fontWeight: '700', lineHeight: 18 },
  locBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 14,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  locBtnText: { fontSize: 14, fontWeight: '900' },
  mapWrap: { height: 200, borderRadius: 16, overflow: 'hidden', borderWidth: 1 },
  map: { flex: 1 },
  markerPin: {
    backgroundColor: '#EC4899',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: '#fff',
  },
  dateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  dateTxt: { fontSize: 15, fontWeight: '800' },
  photoBtn: {
    minHeight: 100,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  photoPreview: { width: '100%', height: 160, resizeMode: 'cover' },
  dateModalRoot: { flex: 1, justifyContent: 'flex-end' },
  dateModalBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.45)' },
  dateModalSheet: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingTop: 8,
    overflow: 'hidden',
  },
  dateModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  dateModalAction: { fontSize: 16, fontWeight: '800' },
});
