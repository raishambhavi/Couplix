import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { useFocusEffect } from '@react-navigation/native';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { useHeaderHeight } from '@react-navigation/elements';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AmbientBackground } from '../../components/AmbientBackground';
import { FilteredCameraModal } from '../../components/FilteredCameraModal';
import { FloatingBackButton } from '../../components/FloatingBackButton';
import { GoldButton } from '../../components/GoldButton';
import { SoftCard } from '../../components/SoftCard';
import { usePairing } from '../../state/PairingContext';
import { useAuth } from '../../state/AuthContext';
import { useSnap, useSnapStreak } from '../../state/SnapContext';
import { useTheme } from '../../state/ThemeContext';
import { pickRawPhoto } from '../../utils/snapPickImage';
import { uploadDailySnapPhoto } from '../../utils/uploadDailySnapPhoto';
import { Ionicons } from '@expo/vector-icons';

const { width: W } = Dimensions.get('window');

function lastNDaysKeys(n: number) {
  const out: string[] = [];
  const d = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const t = new Date(d);
    t.setDate(t.getDate() - i);
    out.push(t.toISOString().slice(0, 10));
  }
  return out;
}

function formatSentTime(ts: number) {
  if (!Number.isFinite(ts)) return '';
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function DailySnapScreen() {
  const { colors } = useTheme();
  const auth = useAuth();
  const tabBarHeight = useBottomTabBarHeight();
  const headerHeight = useHeaderHeight();
  const insets = useSafeAreaInsets();
  const { coupleMode, coupleCode } = usePairing();
  const ld = coupleMode === 'longDistance';
  const { todayKey, dailyByDate, partnerSentByDate, setDailySnap } = useSnap();
  /** Picked from camera/library but not yet committed with Send */
  const [pendingUri, setPendingUri] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [caption, setCaption] = useState('');
  const [filterCameraOpen, setFilterCameraOpen] = useState(false);
  /** After send, hide today's sent image until a new capture (Snapchat-style blank canvas). */
  const [hideLastSentPreview, setHideLastSentPreview] = useState(false);
  const myUid = auth.user?.uid ?? null;
  const streak = useSnapStreak(dailyByDate, partnerSentByDate, myUid);
  const weekKeys = useMemo(() => lastNDaysKeys(7), []);

  const dayMapToday = dailyByDate[todayKey] ?? {};
  const mine = myUid ? (dayMapToday[myUid] ?? dayMapToday['_legacy'] ?? null) : null;
  useFocusEffect(
    useCallback(() => {
      if (Platform.OS === 'web') return undefined;
      const id = setTimeout(() => setFilterCameraOpen(true), 280);
      return () => {
        clearTimeout(id);
        setFilterCameraOpen(false);
      };
    }, [])
  );

  React.useEffect(() => {
    setPendingUri(null);
    setHideLastSentPreview(false);
  }, [todayKey]);

  React.useEffect(() => {
    if (!pendingUri) {
      setCaption(mine?.caption ?? '');
    }
  }, [todayKey, pendingUri, mine?.caption, mine?.uri]);

  const previewUri = pendingUri ?? (hideLastSentPreview ? null : mine?.uri ?? null);
  const hasUnsentDraft = !!pendingUri;

  const pickPhoto = async (source: 'camera' | 'library') => {
    const r = await pickRawPhoto(source);
    if (!r.ok) {
      if (r.reason !== 'cancel') {
        Alert.alert('Permission needed', 'Allow camera or photo library access to send a snap.');
      }
      return;
    }
    setPendingUri(r.uri);
    setHideLastSentPreview(false);
    await Haptics.selectionAsync().catch(() => {});
  };

  const onSendSnap = async () => {
    if (pendingUri) {
      if (!myUid) {
        Alert.alert('Sign in required', 'Sign in to send a daily snap.');
        return;
      }
      const isRemote = /^https?:\/\//i.test(pendingUri);
      if (!isRemote && !coupleCode) {
        Alert.alert(
          'Pairing required',
          'Pair with your partner so your snap can upload to the cloud for them to see.'
        );
        return;
      }
      setUploading(true);
      try {
        let publicUri = pendingUri;
        if (!isRemote) {
          publicUri = await uploadDailySnapPhoto({
            coupleCode: coupleCode!,
            dateKey: todayKey,
            fileUri: pendingUri,
          });
        }
        setDailySnap(todayKey, {
          uri: publicUri,
          caption: caption.trim() || undefined,
          at: Date.now(),
          senderUid: myUid,
          senderName: auth.profile?.displayName ?? undefined,
        });
        setPendingUri(null);
        setCaption('');
        setHideLastSentPreview(true);
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert(
          'Snap sent!',
          'Your moment is on its way. Ready for another frame?',
          [
            {
              text: 'Continue',
              onPress: () => {
                if (Platform.OS !== 'web') setFilterCameraOpen(true);
              },
            },
          ]
        );
        // Partner push is sent by Cloud Function onSnapStateWritten (deploy functions).
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        Alert.alert(
          'Could not send snap',
          `${msg}\n\nDeploy Storage rules if needed: npm run deploy:storage-rules`
        );
      } finally {
        setUploading(false);
      }
      return;
    }
    if (mine?.uri && myUid) {
      setDailySnap(todayKey, {
        ...mine,
        caption: caption.trim() || undefined,
        at: mine.at,
        senderUid: myUid,
      });
      await Haptics.selectionAsync().catch(() => {});
    }
  };

  const canSend =
    (!!pendingUri || (!!mine?.uri && !hideLastSentPreview)) && !uploading;

  return (
    <>
      <AmbientBackground />
      <KeyboardAvoidingView
        style={styles.keyboardRoot}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={headerHeight}
      >
        <View style={styles.viewport}>
          <ScrollView
            style={styles.scroll}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={[
              styles.container,
              { paddingBottom: tabBarHeight + Math.max(insets.bottom, 12) + 24 },
            ]}
          >
            <SoftCard>
              <Text style={[styles.sub, { color: colors.muted }]}>
                {ld
                  ? 'Camera opens for you — swipe filters, capture, then send. One snap per day (you can replace yours until you’re happy).'
                  : 'Camera opens for you — pick a filter, snap, send. One per day at home — replace anytime before midnight.'}
              </Text>

              <Text style={[styles.h, { color: colors.text }]}>Your snap today</Text>
              {previewUri ? (
                <Image key={previewUri} source={{ uri: previewUri }} style={styles.bleed} resizeMode="cover" />
              ) : (
                <Pressable
                  onPress={() => !uploading && (Platform.OS === 'web' ? void pickPhoto('camera') : setFilterCameraOpen(true))}
                  disabled={uploading}
                  style={({ pressed }) => [
                    styles.bleed,
                    styles.placeholder,
                    { borderColor: colors.border, opacity: pressed ? 0.85 : 1 },
                  ]}
                >
                  <Ionicons name="camera-outline" size={40} color={colors.muted} />
                  <Text style={{ color: colors.muted, fontWeight: '700', marginTop: 8, textAlign: 'center' }}>
                    Tap to open camera
                  </Text>
                </Pressable>
              )}
              {hasUnsentDraft ? (
                <View style={styles.draftBanner}>
                  <Text style={[styles.draftText, { color: colors.gold }]}>Ready to send</Text>
                  <Text style={[styles.draftSub, { color: colors.muted }]}>
                    Preview above — tap Send to share with your partner.
                  </Text>
                </View>
              ) : mine?.uri ? (
                <Text style={[styles.sentHint, { color: colors.muted }]}>
                  Sent at {formatSentTime(mine.at)} — pick a new photo to replace.
                </Text>
              ) : null}

              <TextInput
                value={caption}
                onChangeText={setCaption}
                onBlur={() => {
                  if (!pendingUri && mine?.uri && myUid) {
                    setDailySnap(todayKey, {
                      ...mine,
                      caption: caption.trim() || undefined,
                      at: mine.at,
                      senderUid: myUid,
                    });
                  }
                }}
                placeholder="Optional caption — the photo speaks for itself"
                placeholderTextColor={colors.muted}
                style={[styles.input, { color: colors.text, borderColor: colors.border }]}
              />
              <View style={styles.captionRow}>
                <Pressable
                  onPress={() => pickPhoto('library')}
                  disabled={uploading}
                  style={({ pressed }) => [
                    styles.plusBtn,
                    {
                      borderColor: colors.border,
                      backgroundColor: colors.background,
                      opacity: pressed ? 0.8 : 1,
                    },
                  ]}
                >
                  <Ionicons name="add" size={22} color={colors.gold} />
                </Pressable>
                <View style={styles.sendRow}>
                  <GoldButton
                    title={uploading ? 'Sending…' : 'Send'}
                    onPress={() => onSendSnap()}
                    disabled={!canSend}
                    style={{ minWidth: 110 }}
                  />
                  {uploading ? <ActivityIndicator color={colors.gold} /> : null}
                </View>
              </View>
              <GoldButton
                title="Open camera & filters"
                onPress={() => {
                  if (Platform.OS === 'web') {
                    void pickPhoto('camera');
                    return;
                  }
                  setFilterCameraOpen(true);
                }}
                style={{ marginTop: 10 }}
                disabled={uploading}
              />
              {hasUnsentDraft ? (
                <Pressable onPress={() => setPendingUri(null)} style={styles.discardBtn}>
                  <Text style={[styles.discardTxt, { color: colors.muted }]}>Discard draft</Text>
                </Pressable>
              ) : null}
            </SoftCard>

        <SoftCard>
          <Text style={[styles.h, { color: colors.text }]}>Dual streak</Text>
          <Text style={[styles.streakNum, { color: colors.gold }]}>{streak} day(s) both sent</Text>
          <View style={styles.dotRow}>
            {weekKeys.map((k) => {
              const dm = dailyByDate[k] ?? {};
              const meDot = !!(myUid && dm[myUid]);
              const themDot =
                !!partnerSentByDate[k] || Object.keys(dm).some((uid) => uid !== myUid);
              const filled = meDot && themDot;
              return (
                <View
                  key={k}
                  style={[
                    styles.dot,
                    {
                      backgroundColor: filled ? colors.gold : 'transparent',
                      borderColor: meDot || themDot ? colors.gold : colors.border,
                    },
                  ]}
                />
              );
            })}
          </View>
          <Text style={[styles.micro, { color: colors.muted }]}>
            Dots = last 7 days · gold fill when both of you sent
          </Text>
        </SoftCard>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
      <FloatingBackButton />
      <FilteredCameraModal
        visible={filterCameraOpen}
        onClose={() => setFilterCameraOpen(false)}
        onPhotoTaken={(uri) => {
          setPendingUri(uri);
          setHideLastSentPreview(false);
          void Haptics.selectionAsync().catch(() => {});
        }}
      />
    </>
  );
}

const bleed = W - 32;
const styles = StyleSheet.create({
  keyboardRoot: { flex: 1 },
  viewport: { flex: 1 },
  scroll: { flex: 1 },
  container: { paddingHorizontal: 20, paddingTop: 18, gap: 14 },
  h: { fontSize: 15, fontWeight: '900', marginTop: 6 },
  sub: { marginTop: 4, fontSize: 12, fontWeight: '700', lineHeight: 18 },
  bleed: { width: bleed, height: bleed * 1.05, borderRadius: 8, marginTop: 8, alignSelf: 'center' },
  placeholder: {
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderStyle: 'dashed',
  },
  input: {
    marginTop: 10,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 10,
    backgroundColor: 'rgba(231,199,125,0.05)',
    fontWeight: '700',
  },
  draftBanner: { marginTop: 10, gap: 4 },
  draftText: { fontSize: 13, fontWeight: '900' },
  draftSub: { fontSize: 11, fontWeight: '700', lineHeight: 16 },
  sentHint: { marginTop: 8, fontSize: 11, fontWeight: '700' },
  discardBtn: { marginTop: 10, alignSelf: 'center', paddingVertical: 6 },
  discardTxt: { fontSize: 12, fontWeight: '800' },
  captionRow: { flexDirection: 'row', gap: 8, marginTop: 10, justifyContent: 'center', alignItems: 'center' },
  sendRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  plusBtn: {
    width: 46,
    height: 46,
    borderRadius: 23,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  streakNum: { fontSize: 22, fontWeight: '900', marginTop: 6 },
  dotRow: { flexDirection: 'row', gap: 8, marginTop: 10, justifyContent: 'center' },
  dot: { width: 14, height: 14, borderRadius: 7, borderWidth: 2 },
  micro: { fontSize: 11, fontWeight: '600', marginTop: 8 },
});
