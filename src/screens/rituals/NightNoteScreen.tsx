import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Audio } from 'expo-av';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';

import { AmbientBackground } from '../../components/AmbientBackground';
import { FloatingBackButton } from '../../components/FloatingBackButton';
import { GoldButton } from '../../components/GoldButton';
import { SoftCard } from '../../components/SoftCard';
import { FIRESTORE_SYNC_FLAGS } from '../../config/firestoreSyncFlags';
import type { NoteFormat } from '../../state/RitualsContext';
import { useAuth } from '../../state/AuthContext';
import { usePairing } from '../../state/PairingContext';
import { useRituals } from '../../state/RitualsContext';
import { useTheme } from '../../state/ThemeContext';
import { uploadNightNoteFile } from '../../utils/uploadNightNoteFile';

const ENABLE_RITUALS_FIRESTORE_SYNC = FIRESTORE_SYNC_FLAGS.rituals;

export function NightNoteScreen() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const { coupleCode } = usePairing();
  const {
    noteFormat,
    setNoteFormat,
    nightNote,
    setNightNote,
    nightSaved,
    setNightSaved,
    nightMediaUri,
    setNightMediaUri,
    nightMediaUrl,
    setNightMediaUrl,
    streakBoard,
    setStreakBoard,
    saveRitualsState,
  } = useRituals();

  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [locking, setLocking] = useState(false);
  const [playingVoice, setPlayingVoice] = useState(false);
  const playbackRef = useRef<Audio.Sound | null>(null);

  useEffect(
    () => () => {
      playbackRef.current?.unloadAsync().catch(() => {});
      playbackRef.current = null;
    },
    []
  );

  const displayMediaUri = nightMediaUri ?? nightMediaUrl ?? '';

  const canLock = useMemo(() => {
    if (nightSaved || recording) return false;
    if (noteFormat === 'text') return nightNote.trim().length > 0;
    return !!(nightMediaUri || (nightMediaUrl && nightMediaUrl.length > 0));
  }, [nightSaved, recording, noteFormat, nightNote, nightMediaUri, nightMediaUrl]);

  const selectFormat = useCallback(
    (f: NoteFormat) => {
      if (nightSaved) return;
      setNoteFormat(f);
      setNightMediaUri(null);
      setNightMediaUrl(null);
    },
    [nightSaved, setNoteFormat, setNightMediaUri, setNightMediaUrl]
  );

  const startRecording = useCallback(async () => {
    try {
      const perm = await Audio.requestPermissionsAsync();
      if (!perm.granted) return;
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const rec = new Audio.Recording();
      await rec.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      await rec.startAsync();
      setRecording(rec);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    } catch {
      // ignore
    }
  }, []);

  const stopRecording = useCallback(async () => {
    if (!recording) return;
    try {
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      if (uri) {
        setNightMediaUri(uri);
        setNightMediaUrl(null);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      }
    } catch {
      // ignore
    } finally {
      setRecording(null);
    }
  }, [recording, setNightMediaUri, setNightMediaUrl]);

  const pickPhoto = useCallback(async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.88,
    });
    if (!res.canceled && res.assets[0]?.uri) {
      setNightMediaUri(res.assets[0].uri);
      setNightMediaUrl(null);
      Haptics.selectionAsync().catch(() => {});
    }
  }, [setNightMediaUri, setNightMediaUrl]);

  const playVoicePreview = useCallback(async () => {
    const uri = displayMediaUri;
    if (!uri) return;
    try {
      if (playingVoice && playbackRef.current) {
        await playbackRef.current.stopAsync();
        await playbackRef.current.unloadAsync();
        playbackRef.current = null;
        setPlayingVoice(false);
        return;
      }
      if (playbackRef.current) {
        await playbackRef.current.unloadAsync();
        playbackRef.current = null;
      }
      const { sound } = await Audio.Sound.createAsync({ uri }, { shouldPlay: true });
      playbackRef.current = sound;
      setPlayingVoice(true);
      sound.setOnPlaybackStatusUpdate((status) => {
        if (!status.isLoaded) return;
        if (status.didJustFinish) {
          sound.unloadAsync().catch(() => {});
          if (playbackRef.current === sound) playbackRef.current = null;
          setPlayingVoice(false);
        }
      });
    } catch {
      setPlayingVoice(false);
    }
  }, [displayMediaUri, playingVoice]);

  const onLock = useCallback(async () => {
    if (!canLock || locking) return;
    setLocking(true);
    try {
      let finalMediaUrl: string | null = null;
      if (noteFormat === 'text') {
        finalMediaUrl = null;
      } else if (nightMediaUri) {
        if (ENABLE_RITUALS_FIRESTORE_SYNC) {
          if (!coupleCode || !user?.uid) {
            Alert.alert('Cannot attach media', 'Pair with your partner to sync voice or photo.');
            return;
          }
          const kind = noteFormat === 'voice' ? 'voice' : 'image';
          finalMediaUrl = await uploadNightNoteFile({
            coupleCode,
            uid: user.uid,
            uri: nightMediaUri,
            kind,
          });
        } else {
          finalMediaUrl = nightMediaUri;
        }
      } else if (nightMediaUrl) {
        finalMediaUrl = nightMediaUrl;
      }

      const nextBoard = { ...streakBoard, notesSent: streakBoard.notesSent + 1 };
      setNightSaved(true);
      setStreakBoard(nextBoard);
      setNightMediaUri(null);
      setNightMediaUrl(finalMediaUrl);
      await saveRitualsState({
        streakBoard: nextBoard,
        nightSaved: true,
        nightNoteFormat: noteFormat,
        nightMediaUrl: finalMediaUrl,
        nightNote: nightNote.trim(),
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } catch {
      Alert.alert('Could not lock note', 'Check your connection and try again.');
    } finally {
      setLocking(false);
    }
  }, [
    canLock,
    locking,
    noteFormat,
    nightMediaUri,
    nightMediaUrl,
    nightNote,
    coupleCode,
    user?.uid,
    streakBoard,
    setNightSaved,
    setStreakBoard,
    setNightMediaUri,
    setNightMediaUrl,
    saveRitualsState,
  ]);

  const showImagePreview = noteFormat === 'photo' && !!displayMediaUri;

  return (
    <>
      <AmbientBackground />
      <ScrollView contentContainerStyle={styles.container}>
        <SoftCard>
          <Text style={[styles.sub, { color: colors.muted }]}>Time-locked delivery for morning magic.</Text>
          <View style={styles.row}>
            {(['text', 'voice', 'photo'] as NoteFormat[]).map((f) => (
              <Pressable
                key={f}
                disabled={nightSaved}
                onPress={() => selectFormat(f)}
                style={({ pressed }) => [
                  styles.tierChip,
                  {
                    borderColor: noteFormat === f ? colors.gold : colors.border,
                    backgroundColor: noteFormat === f ? 'rgba(231,199,125,0.2)' : 'rgba(231,199,125,0.06)',
                    opacity: pressed ? 0.8 : nightSaved ? 0.65 : 1,
                  },
                ]}
              >
                <Text style={[styles.tierText, { color: colors.text }]}>{f}</Text>
              </Pressable>
            ))}
          </View>

          {noteFormat === 'text' ? (
            <TextInput
              editable={!nightSaved}
              value={nightNote}
              onChangeText={setNightNote}
              placeholder="Write your note for tomorrow morning..."
              placeholderTextColor={colors.muted}
              style={[styles.input, { color: colors.text, borderColor: colors.border, minHeight: 88 }]}
              multiline
            />
          ) : null}

          {noteFormat === 'voice' && !nightSaved ? (
            <View style={styles.block}>
              <Text style={[styles.hint, { color: colors.muted }]}>
                {recording ? 'Recording… tap Stop when done.' : 'Tap Record, then Stop. Add an optional caption below.'}
              </Text>
              <View style={styles.row}>
                <Pressable
                  onPress={recording ? stopRecording : startRecording}
                  style={({ pressed }) => [
                    styles.actionChip,
                    { borderColor: colors.border, opacity: pressed ? 0.85 : 1 },
                  ]}
                >
                  <Text style={[styles.actionChipText, { color: colors.text }]}>
                    {recording ? 'Stop' : 'Record'}
                  </Text>
                </Pressable>
                {(nightMediaUri || nightMediaUrl) && !recording ? (
                  <Pressable
                    onPress={playVoicePreview}
                    style={({ pressed }) => [
                      styles.actionChip,
                      { borderColor: colors.gold, opacity: pressed ? 0.85 : 1 },
                    ]}
                  >
                    <Text style={[styles.actionChipText, { color: colors.text }]}>
                      {playingVoice ? 'Stop playback' : 'Play'}
                    </Text>
                  </Pressable>
                ) : null}
              </View>
              <TextInput
                value={nightNote}
                onChangeText={setNightNote}
                placeholder="Optional short caption…"
                placeholderTextColor={colors.muted}
                style={[styles.input, { color: colors.text, borderColor: colors.border, minHeight: 56 }]}
                multiline
              />
            </View>
          ) : null}

          {noteFormat === 'voice' && nightSaved && displayMediaUri ? (
            <Pressable
              onPress={playVoicePreview}
              style={[styles.voiceLocked, { borderColor: colors.border }]}
            >
              <Text style={[styles.voiceLockedText, { color: colors.text }]}>
                {playingVoice ? 'Playing…' : 'Tap to play voice note'}
              </Text>
            </Pressable>
          ) : null}

          {noteFormat === 'photo' && !nightSaved ? (
            <View style={styles.block}>
              <Pressable
                onPress={pickPhoto}
                style={({ pressed }) => [
                  styles.actionChip,
                  { borderColor: colors.gold, alignSelf: 'center', opacity: pressed ? 0.85 : 1 },
                ]}
              >
                <Text style={[styles.actionChipText, { color: colors.text }]}>Choose photo</Text>
              </Pressable>
              {showImagePreview ? (
                <Image source={{ uri: displayMediaUri }} style={styles.preview} resizeMode="cover" />
              ) : null}
              <TextInput
                value={nightNote}
                onChangeText={setNightNote}
                placeholder="Optional caption…"
                placeholderTextColor={colors.muted}
                style={[styles.input, { color: colors.text, borderColor: colors.border, minHeight: 56 }]}
                multiline
              />
            </View>
          ) : null}

          {noteFormat === 'photo' && nightSaved && displayMediaUri ? (
            <Image source={{ uri: displayMediaUri }} style={styles.preview} resizeMode="cover" />
          ) : null}

          {(noteFormat === 'photo' || noteFormat === 'voice') && nightSaved && nightNote.trim() ? (
            <Text style={[styles.lockedCaption, { color: colors.muted }]}>{nightNote.trim()}</Text>
          ) : null}

          {noteFormat === 'text' && nightSaved && nightNote.trim() ? (
            <Text style={[styles.lockedText, { color: colors.text, borderColor: colors.border }]}>
              {nightNote.trim()}
            </Text>
          ) : null}

          <View style={styles.lockRow}>
            {locking ? <ActivityIndicator color={colors.gold} style={styles.spinner} /> : null}
            <GoldButton
              title={nightSaved ? 'Locked for Morning' : locking ? 'Locking…' : 'Lock Night Note'}
              disabled={!canLock || locking || nightSaved}
              onPress={() => {
                onLock().catch(() => {});
              }}
              style={{ marginTop: 8, flex: 1 }}
            />
          </View>
          <Text style={[styles.meta, { color: colors.muted }]}>
            Cannot be opened early — lock is part of the magic.
          </Text>
        </SoftCard>
      </ScrollView>
      <FloatingBackButton />
    </>
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 32, gap: 14 },
  sub: { marginTop: 4, fontSize: 12, fontWeight: '700' },
  row: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginTop: 10, justifyContent: 'center' },
  tierChip: { borderWidth: 1, borderRadius: 999, paddingVertical: 7, paddingHorizontal: 11 },
  tierText: { fontSize: 12, fontWeight: '900' },
  meta: { marginTop: 8, fontSize: 12, fontWeight: '700', lineHeight: 18 },
  input: {
    marginTop: 10,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 10,
    backgroundColor: 'rgba(231,199,125,0.05)',
    fontWeight: '700',
  },
  block: { marginTop: 8, gap: 4 },
  hint: { fontSize: 11, fontWeight: '700', textAlign: 'center' },
  actionChip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(231,199,125,0.08)',
  },
  actionChipText: { fontSize: 13, fontWeight: '900' },
  preview: {
    width: '100%',
    maxWidth: 280,
    height: 200,
    alignSelf: 'center',
    borderRadius: 14,
    marginTop: 10,
  },
  voiceLocked: {
    marginTop: 12,
    paddingVertical: 16,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    backgroundColor: 'rgba(231,199,125,0.06)',
  },
  voiceLockedText: { fontSize: 14, fontWeight: '800', textAlign: 'center' },
  lockedText: {
    marginTop: 10,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 22,
  },
  lockedCaption: { marginTop: 8, fontSize: 13, fontWeight: '700', lineHeight: 18 },
  lockRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8 },
  spinner: { marginTop: 8 },
});
