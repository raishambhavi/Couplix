import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { Audio, InterruptionModeAndroid, InterruptionModeIOS } from 'expo-av';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AmbientBackground } from '../../components/AmbientBackground';
import { FloatingBackButton } from '../../components/FloatingBackButton';
import { SoftCard } from '../../components/SoftCard';
import { useAuth } from '../../state/AuthContext';
import { usePairing } from '../../state/PairingContext';
import type { SnapEntry } from '../../state/SnapContext';
import { useSnap } from '../../state/SnapContext';
import { useTheme } from '../../state/ThemeContext';

const SLIDE_MS = 3200;
const AMBIENT_VOLUME = 0.2;

/** Up to this many photos: the film uses all of them. Above this, pick a random 10–15 each time you open this screen. */
const MEMORY_FILM_SHOW_ALL_MAX = 15;
const MEMORY_FILM_PICK_MIN = 10;
const MEMORY_FILM_PICK_MAX = 15;
/** Safety cap when building the quarter pool before sampling (chronological, newest first). */
const MEMORY_FILM_POOL_CAP = 400;

// Bundled loop: light pentatonic “music box” feel (soothing / playful). Swap the WAV for your own licensed track anytime.
const AMBIENT_SOURCE = require('../../../assets/audio/memory-reel-ambient.wav');

type Slide = { uri: string; at: number; dateKey: string; label: string; detail?: string };

function pickMemoryFilmSlides(pool: Slide[]): Slide[] {
  if (pool.length <= MEMORY_FILM_SHOW_ALL_MAX) {
    return [...pool];
  }
  const want =
    MEMORY_FILM_PICK_MIN +
    Math.floor(Math.random() * (MEMORY_FILM_PICK_MAX - MEMORY_FILM_PICK_MIN + 1));
  const n = Math.min(want, pool.length);
  const shuffled = [...pool];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const t = shuffled[i]!;
    shuffled[i] = shuffled[j]!;
    shuffled[j] = t;
  }
  return shuffled.slice(0, n).sort((a, b) => a.at - b.at || a.dateKey.localeCompare(b.dateKey));
}

function currentQuarterDateKeys(): string[] {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const q = Math.floor(m / 3);
  const startMonth = q * 3;
  const start = new Date(y, startMonth, 1);
  const end = new Date(y, startMonth + 3, 0);
  const keys: string[] = [];
  const d = new Date(start);
  while (d <= end) {
    keys.push(d.toISOString().slice(0, 10));
    d.setDate(d.getDate() + 1);
  }
  return keys;
}

function nextQuarterEnd() {
  const now = new Date();
  const m = now.getMonth();
  const q = Math.floor(m / 3);
  const endMonth = (q + 1) * 3;
  return new Date(now.getFullYear(), endMonth, 0);
}

function FilmCanvas({
  cur,
  fade,
  idx,
  total,
  datePretty,
  frameStyle,
  topInset = 0,
  captionBottom = 36,
}: {
  cur: Slide | undefined;
  fade: Animated.Value;
  idx: number;
  total: number;
  datePretty: string;
  frameStyle: StyleProp<ViewStyle>;
  topInset?: number;
  captionBottom?: number;
}) {
  return (
    <View style={frameStyle}>
      <Animated.View style={[StyleSheet.absoluteFillObject, { opacity: fade }]}>
        {cur ? <Image source={{ uri: cur.uri }} style={styles.filmImg} resizeMode="cover" /> : null}
      </Animated.View>
      <LinearGradient colors={['transparent', 'rgba(0,0,0,0.55)']} style={styles.scrim} />
      {cur ? (
        <View style={[styles.captionBlock, { bottom: captionBottom }]}>
          <Text style={styles.captionDate}>{datePretty}</Text>
          <Text style={styles.captionWho}>{cur.label}</Text>
          {cur.detail ? <Text style={styles.captionDetail}>{cur.detail}</Text> : null}
        </View>
      ) : null}
      <Text style={[styles.slideCount, topInset ? { top: 10 + topInset } : null]}>
        {idx + 1} / {total}
      </Text>
    </View>
  );
}

export function QuarterlyVideoScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const auth = useAuth();
  const myUid = auth.user?.uid ?? null;
  const { partnerName } = usePairing();
  const { dailyByDate, memoryPins } = useSnap();
  const next = useMemo(() => nextQuarterEnd(), []);

  const slidePool = useMemo(() => {
    if (!myUid) return [];
    const keys = currentQuarterDateKeys();
    const keySet = new Set(keys);
    const flat: Slide[] = [];

    for (const pin of memoryPins) {
      if (!pin.photoUri?.trim()) continue;
      const dk = new Date(pin.at).toISOString().slice(0, 10);
      if (!keySet.has(dk)) continue;
      flat.push({
        uri: pin.photoUri.trim(),
        at: pin.at,
        dateKey: dk,
        label: 'Memory map',
        detail: pin.title.trim() || 'Pinned place',
      });
    }

    for (const dk of keys) {
      const dm = dailyByDate[dk] ?? {};
      const uids = Object.keys(dm).filter((k) => k !== '_legacy');
      if (uids.length === 0 && dm['_legacy']) {
        const e = dm['_legacy'] as SnapEntry;
        if (e?.uri) {
          const label =
            e.senderUid === myUid
              ? 'You'
              : (e.senderName?.trim() || partnerName?.trim() || 'Partner');
          flat.push({ uri: e.uri, at: e.at ?? 0, dateKey: dk, label });
        }
        continue;
      }
      const entries = uids
        .map((uid) => ({ uid, e: dm[uid] as SnapEntry }))
        .sort((a, b) => (a.e.at ?? 0) - (b.e.at ?? 0));
      for (const { uid, e } of entries) {
        if (!e?.uri) continue;
        const label =
          uid === myUid ? 'You' : (e.senderName?.trim() || partnerName?.trim() || 'Partner');
        flat.push({ uri: e.uri, at: e.at ?? 0, dateKey: dk, label });
      }
    }
    flat.sort((a, b) => a.at - b.at || a.dateKey.localeCompare(b.dateKey));
    if (flat.length > MEMORY_FILM_POOL_CAP) {
      return flat.slice(-MEMORY_FILM_POOL_CAP);
    }
    return flat;
  }, [dailyByDate, memoryPins, myUid, partnerName]);

  const firstScreenFocus = useRef(true);
  const [reshuffleKey, setReshuffleKey] = useState(0);

  useFocusEffect(
    useCallback(() => {
      if (firstScreenFocus.current) {
        firstScreenFocus.current = false;
        return;
      }
      setReshuffleKey((k) => k + 1);
    }, []),
  );

  const slides = useMemo(
    () => pickMemoryFilmSlides(slidePool),
    [slidePool, reshuffleKey],
  );

  const poolIsSampled = slidePool.length > MEMORY_FILM_SHOW_ALL_MAX;

  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [immersive, setImmersive] = useState(false);
  const fade = useRef(new Animated.Value(1)).current;
  const ambientRef = useRef<Audio.Sound | null>(null);

  useEffect(() => {
    setIdx(0);
    setPlaying(false);
    setImmersive(false);
  }, [slides]);

  useEffect(() => {
    if (!playing || slides.length === 0) {
      void ambientRef.current?.pauseAsync();
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        await Audio.setAudioModeAsync({
          playsInSilentModeIOS: true,
          allowsRecordingIOS: false,
          interruptionModeIOS: InterruptionModeIOS.DuckOthers,
          interruptionModeAndroid: InterruptionModeAndroid.DuckOthers,
          shouldDuckAndroid: true,
        });
        if (!ambientRef.current) {
          const { sound } = await Audio.Sound.createAsync(AMBIENT_SOURCE, {
            shouldPlay: false,
            isLooping: true,
            volume: AMBIENT_VOLUME,
          });
          ambientRef.current = sound;
        }
        if (cancelled) return;
        await ambientRef.current?.setVolumeAsync(AMBIENT_VOLUME);
        await ambientRef.current?.playAsync();
      } catch {
        // ignore ambient failures (missing asset, etc.)
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [playing, slides.length]);

  useEffect(() => {
    return () => {
      void ambientRef.current?.unloadAsync();
      ambientRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!playing || slides.length === 0) return;
    const id = setInterval(() => {
      setIdx((i) => (i + 1) % slides.length);
    }, SLIDE_MS);
    return () => clearInterval(id);
  }, [playing, slides.length]);

  useEffect(() => {
    fade.setValue(0.15);
    Animated.timing(fade, {
      toValue: 1,
      duration: 520,
      useNativeDriver: true,
    }).start();
  }, [idx, fade, slides.length]);

  const cur = slides[idx];
  const datePretty = cur
    ? new Date(cur.dateKey + 'T12:00:00').toLocaleDateString(undefined, {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      })
    : '';

  const closeImmersive = useCallback(() => {
    setImmersive(false);
    setPlaying(false);
  }, []);

  const startImmersivePlayback = useCallback(() => {
    setImmersive(true);
    setPlaying(true);
  }, []);

  return (
    <>
      <StatusBar style="light" hidden={immersive} />
      <AmbientBackground />
      <ScrollView contentContainerStyle={styles.container}>
        <SoftCard>
          <Text style={[styles.sub, { color: colors.muted }]}>
            A gentle reel for this quarter: daily snaps and memory map photos, in order — soft fades, a sweet little
            instrumental loop, and full-screen when you press play. If you collect more than {MEMORY_FILM_SHOW_ALL_MAX}{' '}
            moments, each visit picks a fresh random set of {MEMORY_FILM_PICK_MIN}–{MEMORY_FILM_PICK_MAX} for the film.
          </Text>
          <Text style={[styles.h, { color: colors.text }]}>Next compilation window</Text>
          <Text style={[styles.date, { color: colors.gold }]}>
            {next.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}
          </Text>
        </SoftCard>

        <SoftCard>
          <Text style={[styles.h, { color: colors.text }]}>Memory film (this quarter)</Text>
          {slides.length === 0 ? (
            <Text style={[styles.sub, { color: colors.muted }]}>
              Nothing in this quarter yet. Daily snaps and memory map pins with a photo appear here automatically once
              you add them.
            </Text>
          ) : (
            <>
              <Pressable
                onPress={startImmersivePlayback}
                style={({ pressed }) => [{ opacity: pressed ? 0.92 : 1 }]}
              >
                <FilmCanvas
                  cur={cur}
                  fade={fade}
                  idx={idx}
                  total={slides.length}
                  datePretty={datePretty}
                  frameStyle={[styles.film, { borderColor: colors.border }]}
                />
              </Pressable>
              <Text style={[styles.hint, { color: colors.muted }]}>
                Tap the preview or play to go full screen
                {poolIsSampled
                  ? ` · Showing ${slides.length} of ${slidePool.length} moments (reshuffle by leaving and opening this screen)`
                  : ''}
              </Text>
              <View style={styles.controls}>
                <Pressable
                  onPress={startImmersivePlayback}
                  style={({ pressed }) => [
                    styles.playBtn,
                    { borderColor: colors.gold, opacity: pressed ? 0.85 : 1 },
                  ]}
                >
                  <Ionicons name="play" size={26} color={colors.gold} />
                  <Text style={[styles.playLabel, { color: colors.text }]}>Play memory</Text>
                </Pressable>
              </View>
            </>
          )}
        </SoftCard>

        <SoftCard>
          <Text style={[styles.h, { color: colors.text }]}>Later on</Text>
          <Text style={[styles.sub, { color: colors.muted }]}>
            Export to a single shareable video file can ship in a future update — for now the film plays in the app
            with synced photos and a light ambient bed.
          </Text>
        </SoftCard>
      </ScrollView>
      <FloatingBackButton />

      <Modal
        visible={immersive}
        animationType="fade"
        presentationStyle="fullScreen"
        statusBarTranslucent
        onRequestClose={closeImmersive}
      >
        <View style={styles.modalRoot}>
          <LinearGradient
            colors={['rgba(0,0,0,0.65)', 'transparent']}
            style={[styles.modalTopFade, { height: 56 + insets.top }]}
          />
          <Pressable
            onPress={closeImmersive}
            hitSlop={14}
            style={[styles.modalCloseBtn, { top: insets.top + 8 }]}
            accessibilityRole="button"
            accessibilityLabel="Close memory film"
          >
            <Ionicons name="chevron-down" size={28} color="rgba(255,255,255,0.95)" />
          </Pressable>

          <FilmCanvas
            cur={cur}
            fade={fade}
            idx={idx}
            total={slides.length}
            datePretty={datePretty}
            frameStyle={styles.modalFilm}
            topInset={insets.top}
            captionBottom={Math.max(36, 100 + insets.bottom)}
          />

          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.75)']}
            style={[styles.modalBottomFade, { paddingBottom: 18 + insets.bottom }]}
          >
            <Pressable
              onPress={() => setPlaying((p) => !p)}
              style={({ pressed }) => [styles.modalPlayBtn, { opacity: pressed ? 0.88 : 1 }]}
            >
              <Ionicons name={playing ? 'pause' : 'play'} size={32} color="#fff" />
              <Text style={styles.modalPlayLabel}>{playing ? 'Pause' : 'Play'}</Text>
            </Pressable>
          </LinearGradient>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 32, gap: 14 },
  h: { fontSize: 15, fontWeight: '900', marginTop: 6 },
  sub: { marginTop: 4, fontSize: 12, fontWeight: '700', lineHeight: 18 },
  date: { fontSize: 18, fontWeight: '900', marginTop: 8 },
  hint: { marginTop: 8, fontSize: 11, fontWeight: '700', textAlign: 'center' },
  film: {
    width: '100%',
    aspectRatio: 16 / 9,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    marginTop: 10,
    backgroundColor: '#0a0a0c',
  },
  filmImg: { width: '100%', height: '100%' },
  scrim: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '38%',
  },
  captionBlock: { position: 'absolute', left: 14, right: 14, gap: 2 },
  captionDate: { color: 'rgba(255,255,255,0.92)', fontSize: 13, fontWeight: '800' },
  captionWho: { color: '#fff', fontSize: 18, fontWeight: '900' },
  captionDetail: { color: 'rgba(255,255,255,0.88)', fontSize: 14, fontWeight: '700', marginTop: 2 },
  slideCount: {
    position: 'absolute',
    top: 10,
    right: 12,
    fontSize: 12,
    fontWeight: '800',
    color: 'rgba(255,255,255,0.85)',
  },
  controls: { marginTop: 14, alignItems: 'center' },
  playBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: 12,
    paddingHorizontal: 22,
  },
  playLabel: { fontSize: 15, fontWeight: '900' },
  modalRoot: { flex: 1, backgroundColor: '#000' },
  modalFilm: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#0a0a0c',
  },
  modalTopFade: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 2,
  },
  modalCloseBtn: {
    position: 'absolute',
    left: 16,
    zIndex: 3,
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  modalBottomFade: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 2,
    paddingTop: 28,
    alignItems: 'center',
  },
  modalPlayBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  modalPlayLabel: { color: '#fff', fontSize: 17, fontWeight: '900' },
});
