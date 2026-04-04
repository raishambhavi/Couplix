import React, { useState } from 'react';
import {
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as Location from 'expo-location';

import { AmbientBackground } from '../../components/AmbientBackground';
import { FloatingBackButton } from '../../components/FloatingBackButton';
import { GoldButton } from '../../components/GoldButton';
import { SoftCard } from '../../components/SoftCard';
import { useSnap } from '../../state/SnapContext';
import { useTheme } from '../../state/ThemeContext';
import { pickRawPhoto } from '../../utils/snapPickImage';

export function MemoryMapScreen() {
  const { colors } = useTheme();
  const { memoryPins, addMemoryPin, removeMemoryPin } = useSnap();
  const [title, setTitle] = useState('');
  const [note, setNote] = useState('');
  const [photoUri, setPhotoUri] = useState<string | undefined>();

  const addPin = async () => {
    if (!title.trim()) {
      Alert.alert('Add a title', 'Give this memory a short name.');
      return;
    }
    let lat: number | undefined;
    let lng: number | undefined;
    const perm = await Location.requestForegroundPermissionsAsync();
    if (perm.granted) {
      const pos = await Location.getCurrentPositionAsync({});
      lat = pos.coords.latitude;
      lng = pos.coords.longitude;
    }
    addMemoryPin({ title: title.trim(), note: note.trim(), photoUri, lat, lng });
    setTitle('');
    setNote('');
    setPhotoUri(undefined);
    Alert.alert('Pinned', lat != null ? 'Saved with your current location.' : 'Saved without location.');
  };

  const onPick = async () => {
    const r = await pickRawPhoto('library');
    if (r.ok) setPhotoUri(r.uri);
  };

  return (
    <>
      <AmbientBackground />
      <ScrollView contentContainerStyle={styles.container}>
        <SoftCard>
          <Text style={[styles.sub, { color: colors.muted }]}>
            When you&apos;re together somewhere meaningful, pin it with a photo and note. Full map view and poster
            export ship in a later release — this MVP keeps your list here.
          </Text>
        </SoftCard>

        <SoftCard>
          <Text style={[styles.h, { color: colors.text }]}>New pin</Text>
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="Title (e.g. Our bench)"
            placeholderTextColor={colors.muted}
            style={[styles.input, { color: colors.text, borderColor: colors.border }]}
          />
          <TextInput
            value={note}
            onChangeText={setNote}
            placeholder="Memory note, inside joke, short story..."
            placeholderTextColor={colors.muted}
            style={[styles.input, { color: colors.text, borderColor: colors.border, minHeight: 72 }]}
            multiline
          />
          {photoUri ? (
            <Image source={{ uri: photoUri }} style={styles.thumb} resizeMode="cover" />
          ) : null}
          <View style={styles.row}>
            <GoldButton title="Attach photo" onPress={onPick} style={{ flex: 1 }} />
            <GoldButton title="Save pin" onPress={addPin} style={{ flex: 1 }} />
          </View>
        </SoftCard>

        <SoftCard>
          <Text style={[styles.h, { color: colors.text }]}>Your memory map</Text>
          {memoryPins.length === 0 ? (
            <Text style={[styles.sub, { color: colors.muted }]}>No pins yet.</Text>
          ) : (
            memoryPins.map((p) => (
              <View key={p.id} style={[styles.pinCard, { borderColor: colors.border }]}>
                {p.photoUri ? (
                  <Image source={{ uri: p.photoUri }} style={styles.pinImg} resizeMode="cover" />
                ) : null}
                <Text style={[styles.pinTitle, { color: colors.text }]}>{p.title}</Text>
                <Text style={[styles.sub, { color: colors.muted }]}>{p.note || '—'}</Text>
                <Text style={[styles.micro, { color: colors.gold }]}>
                  {p.lat != null && p.lng != null
                    ? `${p.lat.toFixed(3)}, ${p.lng.toFixed(3)}`
                    : 'No coordinates'}
                </Text>
                <Pressable onPress={() => removeMemoryPin(p.id)} style={styles.remove}>
                  <Text style={{ color: colors.danger, fontWeight: '800', fontSize: 12 }}>Remove</Text>
                </Pressable>
              </View>
            ))
          )}
          <GoldButton
            title="Export poster (coming soon)"
            onPress={() => Alert.alert('Export', 'Print-ready poster export will be available in a future update.')}
            style={{ marginTop: 10, opacity: 0.75 }}
          />
        </SoftCard>
      </ScrollView>
      <FloatingBackButton />
    </>
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 32, gap: 14 },
  h: { fontSize: 15, fontWeight: '900', marginTop: 6 },
  sub: { marginTop: 4, fontSize: 12, fontWeight: '700', lineHeight: 18 },
  input: {
    marginTop: 10,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 10,
    backgroundColor: 'rgba(231,199,125,0.05)',
    fontWeight: '700',
  },
  row: { flexDirection: 'row', gap: 8, marginTop: 10 },
  thumb: { width: '100%', height: 140, borderRadius: 10, marginTop: 10 },
  pinCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 10,
    marginTop: 10,
    gap: 4,
  },
  pinImg: { width: '100%', height: 120, borderRadius: 8, marginBottom: 6 },
  pinTitle: { fontSize: 15, fontWeight: '900' },
  micro: { fontSize: 11, fontWeight: '600' },
  remove: { marginTop: 6, alignSelf: 'flex-start' },
});
