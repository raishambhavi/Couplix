import React, { useMemo, useState } from 'react';
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
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';

import { AmbientBackground } from '../../components/AmbientBackground';
import { FloatingBackButton } from '../../components/FloatingBackButton';
import { GoldButton } from '../../components/GoldButton';
import { SoftCard } from '../../components/SoftCard';
import { FIRESTORE_SYNC_FLAGS } from '../../config/firestoreSyncFlags';
import { useAuth } from '../../state/AuthContext';
import { usePairing } from '../../state/PairingContext';
import { useTogether } from '../../state/TogetherContext';
import { useTheme } from '../../state/ThemeContext';
import { pickRawPhoto } from '../../utils/snapPickImage';
import { uploadJournalPhoto } from '../../utils/uploadChatMedia';

const ENABLE = FIRESTORE_SYNC_FLAGS.together;

/** Inspired by popular couple journals: gratitude, feelings, travel, milestones, prompts. */
const CATEGORIES = [
  { id: 'gratitude', label: 'Gratitude', hint: 'Something good today' },
  { id: 'feelings', label: 'Feelings', hint: 'Honest check-in' },
  { id: 'travel', label: 'Travel & trips', hint: 'Photos & places' },
  { id: 'milestone', label: 'Milestones', hint: 'Anniversaries & firsts' },
  { id: 'letters', label: 'Love note', hint: 'Letter-style message' },
  { id: 'future', label: 'Dreams', hint: 'Plans you’re excited about' },
] as const;

const MOODS = ['Calm', 'Happy', 'Miss you', 'Excited', 'Grateful', 'Hopeful'] as const;

function formatJournalDate(at: number) {
  return new Date(at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export function SharedJournalScreen() {
  const { colors } = useTheme();
  const auth = useAuth();
  const { coupleCode } = usePairing();
  const { journal, addJournalEntry } = useTogether();
  const [entryDraft, setEntryDraft] = useState('');
  const [entryTitle, setEntryTitle] = useState('');
  const [entryMood, setEntryMood] = useState<string>('Calm');
  const [entryLocation, setEntryLocation] = useState('');
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]['id']>('gratitude');
  const [entryShared, setEntryShared] = useState(true);
  const [entryPhoto, setEntryPhoto] = useState<string | undefined>();
  const [saving, setSaving] = useState(false);

  const sorted = useMemo(() => [...journal].sort((a, b) => b.at - a.at), [journal]);

  /** Partner never sees your private entries; you always see your own. */
  const visibleJournal = useMemo(() => {
    const uid = auth.user?.uid;
    if (!uid) return sorted;
    return sorted.filter((j) => {
      if (j.authorUid == null || j.authorUid === '') return true;
      if (j.authorUid === uid) return true;
      return j.shared === true;
    });
  }, [sorted, auth.user?.uid]);

  const yearInReview = () => {
    const y = new Date().getFullYear();
    const all = visibleJournal.filter((j) => new Date(j.at).getFullYear() === y && j.shared);
    const moods = Array.from(new Set(all.map((e) => e.mood))).slice(0, 5).join(', ') || '—';
    Alert.alert(
      `Year in review ${y}`,
      `${all.length} shared entries\nMoods: ${moods}\n(Export coming in a future update.)`
    );
  };

  const pickJournalPhoto = async () => {
    const r = await pickRawPhoto('library');
    if (r.ok) setEntryPhoto(r.uri);
  };

  const saveEntry = async () => {
    const trimmed = entryDraft.trim();
    if (!trimmed || saving) return;
    setSaving(true);
    try {
      let photoUri = entryPhoto;
      if (photoUri && !/^https?:\/\//i.test(photoUri) && ENABLE && coupleCode && auth.user?.uid) {
        const entryId = `jr_${Date.now()}`;
        try {
          photoUri = await uploadJournalPhoto({ coupleCode, entryId, uri: photoUri });
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          Alert.alert('Photo upload failed', msg);
          setSaving(false);
          return;
        }
      }
      addJournalEntry({
        text: trimmed,
        title: entryTitle.trim() || undefined,
        mood: entryMood,
        location: entryLocation.trim(),
        photoUri,
        shared: entryShared,
        category,
      });
      setEntryDraft('');
      setEntryTitle('');
      setEntryLocation('');
      setEntryShared(true);
      setEntryPhoto(undefined);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } finally {
      setSaving(false);
    }
  };

  const catLabel = (id: string | undefined) => CATEGORIES.find((c) => c.id === id)?.label ?? 'Entry';

  return (
    <>
      <AmbientBackground />
      <ScrollView contentContainerStyle={styles.container}>
        <LinearGradient
          colors={['rgba(236,72,153,0.35)', 'rgba(251,113,133,0.1)', 'transparent']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.hero}
        >
          <Text style={[styles.heroEyebrow, { color: colors.muted }]}>Our journal</Text>
          <Text style={[styles.heroTitle, { color: colors.text }]}>Memories & heartbeats</Text>
          <Text style={[styles.heroSub, { color: colors.muted }]}>
            Gratitude, feelings, trips, milestones — plus photos. Entries can be shared or private.
          </Text>
        </LinearGradient>

        <SoftCard>
          <Text style={[styles.label, { color: colors.text }]}>Category</Text>
          <View style={styles.catWrap}>
            {CATEGORIES.map((c) => (
              <Pressable
                key={c.id}
                onPress={() => setCategory(c.id)}
                style={[
                  styles.catChip,
                  {
                    borderColor: category === c.id ? '#EC4899' : colors.border,
                    backgroundColor: category === c.id ? 'rgba(236,72,153,0.15)' : 'rgba(231,199,125,0.06)',
                  },
                ]}
              >
                <Text style={[styles.catChipText, { color: colors.text }]}>{c.label}</Text>
              </Pressable>
            ))}
          </View>
          <Text style={[styles.hint, { color: colors.muted }]}>
            {CATEGORIES.find((x) => x.id === category)?.hint}
          </Text>

          <TextInput
            value={entryTitle}
            onChangeText={setEntryTitle}
            placeholder="Title (optional)"
            placeholderTextColor={colors.muted}
            style={[styles.input, { color: colors.text, borderColor: colors.border }]}
          />
          <TextInput
            value={entryDraft}
            onChangeText={setEntryDraft}
            placeholder="Write your entry..."
            placeholderTextColor={colors.muted}
            style={[styles.input, { color: colors.text, borderColor: colors.border, minHeight: 100 }]}
            multiline
          />
          <Text style={[styles.label, { color: colors.text, marginTop: 10 }]}>Mood</Text>
          <View style={styles.row}>
            {MOODS.map((m) => (
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
            placeholder="Place (optional)"
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
                {entryShared ? 'Shared with partner' : 'Private'}
              </Text>
            </Pressable>
            <GoldButton title="Add photo" onPress={pickJournalPhoto} style={{ flex: 1 }} />
          </View>
          <View style={[styles.row, { marginTop: 10 }]}>
            <GoldButton
              title={saving ? 'Saving…' : 'Save entry'}
              onPress={saveEntry}
              disabled={saving || !entryDraft.trim()}
              style={{ flex: 1 }}
            />
            <GoldButton title="Year in review" onPress={yearInReview} style={{ flex: 1 }} />
          </View>
        </SoftCard>

        <Text style={[styles.timelineLabel, { color: colors.muted }]}>Timeline</Text>
        {visibleJournal.length === 0 ? (
          <SoftCard>
            <Text style={[styles.empty, { color: colors.muted }]}>
              {journal.length > 0
                ? 'Private entries from your partner stay on their phone. Shared entries appear here.'
                : 'Your story starts with one line.'}
            </Text>
          </SoftCard>
        ) : (
          visibleJournal.map((j) => {
            const who =
              j.authorUid && auth.user?.uid
                ? j.authorUid === auth.user.uid
                  ? 'You'
                  : j.authorName?.trim() || 'Partner'
                : null;
            const metaParts = [who, j.mood, j.location?.trim() || null, j.shared ? 'Shared' : 'Private'].filter(
              (x): x is string => typeof x === 'string' && x.length > 0
            );
            return (
              <View key={j.id} style={styles.timelineRow}>
                <Text style={[styles.dateRail, { color: colors.muted }]}>{formatJournalDate(j.at)}</Text>
                <View style={[styles.entryCard, { borderColor: colors.border, backgroundColor: colors.cardGlow }]}>
                  <Text style={[styles.entryCat, { color: '#EC4899' }]}>{catLabel(j.category)}</Text>
                  {j.title ? <Text style={[styles.entryTitle, { color: colors.text }]}>{j.title}</Text> : null}
                  {j.photoUri ? (
                    <Image source={{ uri: j.photoUri }} style={styles.entryPhoto} resizeMode="cover" />
                  ) : null}
                  <Text style={[styles.entryBody, { color: colors.text }]}>{j.text}</Text>
                  <Text style={[styles.entryMeta, { color: colors.muted }]}>{metaParts.join(' · ')}</Text>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>
      <FloatingBackButton />
    </>
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 120, gap: 12 },
  hero: {
    borderRadius: 20,
    padding: 18,
    marginBottom: 4,
    borderWidth: 1,
    borderColor: 'rgba(244,114,182,0.25)',
  },
  heroEyebrow: { fontSize: 11, fontWeight: '800', letterSpacing: 1.2, textTransform: 'uppercase' },
  heroTitle: { fontSize: 24, fontWeight: '900', marginTop: 6 },
  heroSub: { fontSize: 13, fontWeight: '700', lineHeight: 18, marginTop: 8 },
  label: { fontSize: 13, fontWeight: '900', marginBottom: 8 },
  hint: { fontSize: 12, fontWeight: '700', marginBottom: 10 },
  catWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  catChip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  catChipText: { fontSize: 12, fontWeight: '800' },
  input: {
    marginTop: 8,
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
  photo: { width: '100%', height: 160, borderRadius: 12, marginTop: 8 },
  timelineLabel: { fontSize: 12, fontWeight: '800', marginTop: 8, marginLeft: 4 },
  empty: { fontSize: 13, fontWeight: '700', textAlign: 'center', lineHeight: 18 },
  timelineRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  dateRail: { width: 72, fontSize: 10, fontWeight: '800', paddingTop: 6 },
  entryCard: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 16,
    padding: 12,
    gap: 6,
  },
  entryCat: { fontSize: 11, fontWeight: '900', letterSpacing: 0.4 },
  entryTitle: { fontSize: 16, fontWeight: '900' },
  entryPhoto: { width: '100%', height: 140, borderRadius: 12 },
  entryBody: { fontSize: 14, fontWeight: '700', lineHeight: 20 },
  entryMeta: { fontSize: 11, fontWeight: '700' },
});
