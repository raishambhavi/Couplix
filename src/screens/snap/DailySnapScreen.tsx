import React, { useMemo, useState } from 'react';
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
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as Haptics from 'expo-haptics';
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
  const {
    todayKey,
    dailyByDate,
    partnerSentByDate,
    setDailySnap,
    setPartnerSent,
  } = useSnap();
  /** Picked from camera/library but not yet committed with Send */
  const [pendingUri, setPendingUri] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [caption, setCaption] = useState('');
  const [filterCameraOpen, setFilterCameraOpen] = useState(false);
  const myUid = auth.user?.uid ?? null;
  const streak = useSnapStreak(dailyByDate, partnerSentByDate, myUid);
  const weekKeys = useMemo(() => lastNDaysKeys(7), []);

  const dayMapToday = dailyByDate[todayKey] ?? {};
  const mine = myUid ? (dayMapToday[myUid] ?? dayMapToday['_legacy'] ?? null) : null;
  const partnerUid = Object.keys(dayMapToday).find((uid) => uid !== myUid && uid !== '_legacy');
  const partnerSnap = partnerUid ? dayMapToday[partnerUid] ?? null : null;
  const partnerToday = partnerSentByDate[todayKey];

  React.useEffect(() => {
    setPendingUri(null);
  }, [todayKey]);

  React.useEffect(() => {
    if (!pendingUri) {
      setCaption(mine?.caption ?? '');
    }
  }, [todayKey, pendingUri, mine?.caption, mine?.uri]);

  const previewUri = pendingUri ?? mine?.uri ?? null;
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
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert('', 'Great! Send a snap tomorrow to maintain the streak.');
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

  const canSend = (!!pendingUri || !!mine?.uri) && !uploading;

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
                  ? 'One photo per day each — open the camera, swipe filters like your favorite stories app, then send.'
                  : 'One photo per day each — open the camera, swipe filters, then send. Still no heavy editing.'}
              </Text>

              <Text style={[styles.h, { color: colors.text }]}>Your snap today</Text>
              {previewUri ? (
                <Image key={previewUri} source={{ uri: previewUri }} style={styles.bleed} resizeMode="cover" />
              ) : (
                <View style={[styles.bleed, styles.placeholder, { borderColor: colors.border }]}>
                  <Text style={{ color: colors.muted, fontWeight: '600' }}>No snap yet today</Text>
                </View>
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
                title="Click photo"
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
          <Text style={[styles.h, { color: colors.text }]}>Partner&apos;s snap</Text>
          <Text style={[styles.sub, { color: colors.muted }]}>
            {ld
              ? 'Their snap lands full-bleed when it arrives — built for long-distance surprise.'
              : 'Their snap lands full-bleed — a quiet window into their day at home.'}
          </Text>
          {partnerSnap?.uri ? (
            <Image key={partnerSnap.uri} source={{ uri: partnerSnap.uri }} style={styles.bleed} resizeMode="cover" />
          ) : (
            <View style={[styles.bleed, styles.placeholder, { borderColor: colors.border }]}>
              <Text style={{ color: colors.muted, fontWeight: '600', textAlign: 'center' }}>
                {partnerToday ? 'Partner sent today — sync in progress.' : 'Waiting for their daily snap.'}
              </Text>
            </View>
          )}
          {partnerSnap?.uri ? (
            <Text style={[styles.sentHint, { color: colors.muted }]}>
              {partnerSnap.senderName || 'Partner'} sent at {formatSentTime(partnerSnap.at)}
            </Text>
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
          <View style={styles.simRow}>
            <Text style={[styles.micro, { color: colors.text, flex: 1 }]}>
              Simulate partner sent today (MVP)
            </Text>
            <Switch
              value={!!partnerSentByDate[todayKey]}
              onValueChange={(v) => setPartnerSent(todayKey, v)}
            />
          </View>
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
  simRow: { flexDirection: 'row', alignItems: 'center', marginTop: 12, gap: 8 },
});
