import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { AmbientBackground } from '../../components/AmbientBackground';
import { GoldButton } from '../../components/GoldButton';
import { ScreenHeading } from '../../components/ScreenHeading';
import { SoftCard } from '../../components/SoftCard';
import { usePairing } from '../../state/PairingContext';
import { useTheme } from '../../state/ThemeContext';
import { pickRawPhoto } from '../../utils/snapPickImage';

type WishItem = {
  id: string;
  text: string;
  lockDate?: string;
  at: number;
};

type JournalItem = {
  id: string;
  text: string;
  mood: string;
  location: string;
  photoUri?: string;
  shared: boolean;
  at: number;
};

function storageKey(coupleCode: string | null) {
  return coupleCode ? `together:v1:${coupleCode}` : 'together:v1:local';
}

function pad(n: number) {
  return String(n).padStart(2, '0');
}

function dateISO(d = new Date()) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function TogetherScreen() {
  const { colors } = useTheme();
  const { coupleCode } = usePairing();
  const key = storageKey(coupleCode);

  const [wishes, setWishes] = useState<WishItem[]>([]);
  const [wishDraft, setWishDraft] = useState('');
  const [wishLockDate, setWishLockDate] = useState('');

  const [targetAt, setTargetAt] = useState<number>(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const [countMode, setCountMode] = useState<'days' | 'hours' | 'minutes' | 'percent'>('days');

  const [entryDraft, setEntryDraft] = useState('');
  const [entryMood, setEntryMood] = useState('Calm');
  const [entryLocation, setEntryLocation] = useState('');
  const [entryShared, setEntryShared] = useState(true);
  const [entryPhoto, setEntryPhoto] = useState<string | undefined>();
  const [journal, setJournal] = useState<JournalItem[]>([]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(key);
        if (!raw || !mounted) return;
        const parsed = JSON.parse(raw);
        setWishes(parsed.wishes ?? []);
        setTargetAt(parsed.targetAt ?? targetAt);
        setCountMode(parsed.countMode ?? 'days');
        setJournal(parsed.journal ?? []);
      } catch {
        // ignore
      }
    })();
    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  useEffect(() => {
    AsyncStorage.setItem(
      key,
      JSON.stringify({
        wishes,
        targetAt,
        countMode,
        journal,
      })
    ).catch(() => {});
  }, [key, wishes, targetAt, countMode, journal]);

  const now = Date.now();
  const remainMs = Math.max(0, targetAt - now);
  const remainDays = Math.ceil(remainMs / (24 * 60 * 60 * 1000));
  const remainHours = Math.ceil(remainMs / (60 * 60 * 1000));
  const remainMinutes = Math.ceil(remainMs / (60 * 1000));
  const totalWindowMs = 14 * 24 * 60 * 60 * 1000;
  const percent = Math.min(100, Math.max(0, Math.round((1 - remainMs / totalWindowMs) * 100)));
  const countText =
    countMode === 'days'
      ? `${remainDays} day(s)`
      : countMode === 'hours'
      ? `${remainHours} hour(s)`
      : countMode === 'minutes'
      ? `${remainMinutes} minute(s)`
      : `${percent}%`;

  useEffect(() => {
    if (remainMs === 0) {
      // Celebration placeholder (simultaneous animation in full sync build)
      // Keep this lightweight for MVP.
    }
  }, [remainMs]);

  const addWish = () => {
    if (!wishDraft.trim()) return;
    setWishes((prev) => [
      {
        id: `wish_${Date.now()}`,
        text: wishDraft.trim(),
        lockDate: wishLockDate.trim() || undefined,
        at: Date.now(),
      },
      ...prev,
    ]);
    setWishDraft('');
    setWishLockDate('');
  };

  const wishSuggestions = useMemo(() => {
    const src = wishes.map((w) => w.text.toLowerCase()).join(' ');
    const out: string[] = [];
    if (src.includes('travel') || src.includes('trip') || src.includes('holiday')) out.push('Weekend getaway package');
    if (src.includes('dinner') || src.includes('restaurant') || src.includes('food')) out.push('Chef tasting date night');
    if (src.includes('gift') || src.includes('flowers')) out.push('Surprise gift bundle');
    if (src.includes('class') || src.includes('learn')) out.push('Pottery / painting workshop');
    if (out.length === 0) out.push('Sunset picnic experience', 'Live music date tickets');
    return out.slice(0, 3);
  }, [wishes]);

  const addEntry = () => {
    if (!entryDraft.trim()) return;
    setJournal((prev) => [
      {
        id: `jr_${Date.now()}`,
        text: entryDraft.trim(),
        mood: entryMood,
        location: entryLocation.trim(),
        photoUri: entryPhoto,
        shared: entryShared,
        at: Date.now(),
      },
      ...prev,
    ]);
    setEntryDraft('');
    setEntryLocation('');
    setEntryShared(true);
    setEntryPhoto(undefined);
  };

  const yearInReview = () => {
    const year = new Date().getFullYear();
    const all = journal.filter((j) => new Date(j.at).getFullYear() === year && j.shared);
    const moods = Array.from(new Set(all.map((e) => e.mood))).slice(0, 4).join(', ') || 'No mood tags yet';
    Alert.alert(
      `Year in review ${year}`,
      `Shared entries: ${all.length}\nMood range: ${moods}\nBooklet auto-generation can be exported in a future update.`
    );
  };

  const pickJournalPhoto = async () => {
    const r = await pickRawPhoto('library');
    if (r.ok) setEntryPhoto(r.uri);
  };

  const setCountdownDays = (days: number) => setTargetAt(Date.now() + days * 24 * 60 * 60 * 1000);

  return (
    <>
      <AmbientBackground />
      <ScrollView contentContainerStyle={styles.container}>
        <ScreenHeading title="Together" subtitle="Wish Jar, Countdown Together, Shared Journal" />

        <SoftCard>
          <Text style={[styles.h, { color: colors.text }]}>1) Wish Jar</Text>
          <TextInput
            value={wishDraft}
            onChangeText={setWishDraft}
            placeholder="Drop a wish..."
            placeholderTextColor={colors.muted}
            style={[styles.input, { color: colors.text, borderColor: colors.border }]}
          />
          <TextInput
            value={wishLockDate}
            onChangeText={setWishLockDate}
            placeholder={`Lock until date (YYYY-MM-DD), e.g. ${dateISO()}`}
            placeholderTextColor={colors.muted}
            style={[styles.input, { color: colors.text, borderColor: colors.border }]}
          />
          <GoldButton title="Add wish" onPress={addWish} style={{ marginTop: 8 }} />
          <Text style={[styles.sub, { color: colors.muted, marginTop: 10 }]}>AI suggestions:</Text>
          {wishSuggestions.map((s) => (
            <Text key={s} style={[styles.meta, { color: colors.gold }]}>
              • {s}
            </Text>
          ))}
          <View style={{ marginTop: 10, gap: 8 }}>
            {wishes.slice(0, 6).map((w) => {
              const locked = !!w.lockDate && w.lockDate > dateISO();
              return (
                <View key={w.id} style={[styles.rowCard, { borderColor: colors.border }]}>
                  <Text style={[styles.meta, { color: colors.text, flex: 1 }]} numberOfLines={2}>
                    {locked ? 'Locked wish' : w.text}
                  </Text>
                  <Text style={[styles.meta, { color: colors.muted }]}>
                    {w.lockDate ? `until ${w.lockDate}` : 'open'}
                  </Text>
                </View>
              );
            })}
          </View>
        </SoftCard>

        <SoftCard>
          <Text style={[styles.h, { color: colors.text }]}>2) Countdown Together</Text>
          <Text style={[styles.count, { color: colors.gold }]}>{countText}</Text>
          <Text style={[styles.sub, { color: colors.muted }]}>
            Synced countdown widget + arrival celebration animation can be live-synced in the networked phase.
          </Text>
          <View style={styles.row}>
            {(['days', 'hours', 'minutes', 'percent'] as const).map((m) => (
              <Pressable
                key={m}
                onPress={() => setCountMode(m)}
                style={[
                  styles.chip,
                  {
                    borderColor: countMode === m ? colors.gold : colors.border,
                    backgroundColor: countMode === m ? 'rgba(231,199,125,0.2)' : 'rgba(231,199,125,0.06)',
                  },
                ]}
              >
                <Text style={[styles.chipText, { color: colors.text }]}>{m}</Text>
              </Pressable>
            ))}
          </View>
          <View style={[styles.row, { marginTop: 10 }]}>
            <GoldButton title="+ 3 days" onPress={() => setCountdownDays(3)} style={{ flex: 1 }} />
            <GoldButton title="+ 7 days" onPress={() => setCountdownDays(7)} style={{ flex: 1 }} />
            <GoldButton title="+ 30 days" onPress={() => setCountdownDays(30)} style={{ flex: 1 }} />
          </View>
        </SoftCard>

        <SoftCard>
          <Text style={[styles.h, { color: colors.text }]}>3) Shared Journal</Text>
          <TextInput
            value={entryDraft}
            onChangeText={setEntryDraft}
            placeholder="Write an entry..."
            placeholderTextColor={colors.muted}
            style={[styles.input, { color: colors.text, borderColor: colors.border, minHeight: 92 }]}
            multiline
          />
          <View style={styles.row}>
            {['Calm', 'Happy', 'Miss you', 'Excited'].map((m) => (
              <Pressable
                key={m}
                onPress={() => setEntryMood(m)}
                style={[
                  styles.chip,
                  {
                    borderColor: entryMood === m ? colors.gold : colors.border,
                    backgroundColor: entryMood === m ? 'rgba(231,199,125,0.2)' : 'rgba(231,199,125,0.06)',
                  },
                ]}
              >
                <Text style={[styles.chipText, { color: colors.text }]}>{m}</Text>
              </Pressable>
            ))}
          </View>
          <TextInput
            value={entryLocation}
            onChangeText={setEntryLocation}
            placeholder="Location (optional)"
            placeholderTextColor={colors.muted}
            style={[styles.input, { color: colors.text, borderColor: colors.border }]}
          />
          {entryPhoto ? <Image source={{ uri: entryPhoto }} style={styles.photo} resizeMode="cover" /> : null}
          <View style={[styles.row, { marginTop: 8 }]}>
            <Pressable
              onPress={() => setEntryShared((v) => !v)}
              style={[
                styles.chip,
                {
                  borderColor: entryShared ? colors.gold : colors.border,
                  backgroundColor: entryShared ? 'rgba(231,199,125,0.2)' : 'rgba(231,199,125,0.06)',
                },
              ]}
            >
              <Text style={[styles.chipText, { color: colors.text }]}>
                {entryShared ? 'Shared entry' : 'Private entry'}
              </Text>
            </Pressable>
            <GoldButton title="Add photo" onPress={pickJournalPhoto} style={{ flex: 1 }} />
          </View>
          <View style={[styles.row, { marginTop: 8 }]}>
            <GoldButton title="Save entry" onPress={addEntry} style={{ flex: 1 }} />
            <GoldButton title="Year in review" onPress={yearInReview} style={{ flex: 1 }} />
          </View>
          <View style={{ marginTop: 10, gap: 8 }}>
            {journal.slice(0, 5).map((j) => (
              <View key={j.id} style={[styles.rowCard, { borderColor: colors.border }]}>
                <Text style={[styles.meta, { color: colors.text, flex: 1 }]} numberOfLines={2}>
                  {j.text}
                </Text>
                <Text style={[styles.meta, { color: j.shared ? colors.gold : colors.muted }]}>
                  {j.shared ? 'Shared' : 'Private'}
                </Text>
              </View>
            ))}
          </View>
        </SoftCard>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 32, gap: 14 },
  h: { fontSize: 16, fontWeight: '900' },
  sub: { marginTop: 4, fontSize: 12, fontWeight: '700', lineHeight: 18 },
  meta: { fontSize: 12, fontWeight: '700' },
  count: { marginTop: 8, fontSize: 28, fontWeight: '900' },
  input: {
    marginTop: 10,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 10,
    backgroundColor: 'rgba(231,199,125,0.05)',
    fontWeight: '700',
  },
  row: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginTop: 8 },
  chip: { borderWidth: 1, borderRadius: 999, paddingVertical: 8, paddingHorizontal: 12 },
  chipText: { fontSize: 12, fontWeight: '900' },
  rowCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  photo: { width: '100%', height: 140, borderRadius: 10, marginTop: 8 },
});
