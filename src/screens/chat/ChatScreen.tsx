import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useHeaderHeight } from '@react-navigation/elements';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Audio } from 'expo-av';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';

import { AmbientBackground } from '../../components/AmbientBackground';
import { GoldButton } from '../../components/GoldButton';
import { SoftCard } from '../../components/SoftCard';
import { useChat, type ChatMessage } from '../../state/ChatContext';
import { useSnap } from '../../state/SnapContext';
import { useTheme } from '../../state/ThemeContext';
import { pickRawPhoto } from '../../utils/snapPickImage';
import type { ChatStackParamList } from '../../navigation/ChatStack';

const REACTIONS = ['❤️', '😂', '🔥', '🥹'] as const;
type GifItem = { id: string; url: string; preview: string };
const RECENT_SEARCHES_KEY = 'chat:gifs:recentSearches';
const FAVORITE_GIFS_KEY = 'chat:gifs:favorites';

function formatMessageTime(ts: number) {
  if (ts == null || Number.isNaN(Number(ts))) return '';
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function ChatScreen() {
  const headerHeight = useHeaderHeight();
  const insets = useSafeAreaInsets();
  const route = useRoute<RouteProp<ChatStackParamList, 'ChatMain'>>();
  const navigation = useNavigation<NativeStackNavigationProp<ChatStackParamList, 'ChatMain'>>();
  const { colors } = useTheme();
  const listRef = useRef<FlatList<ChatMessage>>(null);
  const {
    messages,
    partnerTyping,
    sendText,
    sendVoice,
    sendPhoto,
    toggleReaction,
    togglePin,
  } = useChat();
  const { setPhotoDrop } = useSnap();
  const [draft, setDraft] = useState('');
  const [activeMsgId, setActiveMsgId] = useState<string | null>(null);
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [voiceDraft, setVoiceDraft] = useState<{ uri: string; durationMs: number } | null>(null);
  const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null);
  const [actionsOpen, setActionsOpen] = useState(false);
  const [gifQuery, setGifQuery] = useState('love');
  const [gifLoading, setGifLoading] = useState(false);
  const [gifResults, setGifResults] = useState<GifItem[]>([]);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [favoriteGifs, setFavoriteGifs] = useState<GifItem[]>([]);
  const beat = useRef(new Animated.Value(1)).current;
  const playbackRef = useRef<Audio.Sound | null>(null);
  const canSendText = draft.trim().length > 0;

  const pinned = useMemo(() => messages.find((m) => m.pinned), [messages]);
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(beat, { toValue: 1.18, duration: 420, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(beat, { toValue: 1, duration: 420, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [beat]);
  useEffect(() => {
    return () => {
      playbackRef.current?.unloadAsync().catch(() => {});
      playbackRef.current = null;
    };
  }, []);
  useEffect(() => {
    if (!actionsOpen) return;
    loadGifs(gifQuery).catch(() => {});
  }, [actionsOpen]);
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const [rawRecent, rawFav] = await Promise.all([
          AsyncStorage.getItem(RECENT_SEARCHES_KEY),
          AsyncStorage.getItem(FAVORITE_GIFS_KEY),
        ]);
        if (!mounted) return;
        const recent = rawRecent ? (JSON.parse(rawRecent) as string[]) : [];
        const fav = rawFav ? (JSON.parse(rawFav) as GifItem[]) : [];
        setRecentSearches(Array.isArray(recent) ? recent : []);
        setFavoriteGifs(Array.isArray(fav) ? fav : []);
      } catch {
        // ignore
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  /** Open Chat from a push notification with `messageId` — scroll to that message. */
  useEffect(() => {
    const id = route.params?.messageId?.trim();
    if (!id) return;
    const idx = messages.findIndex((m) => m.id === id);
    if (idx < 0) {
      if (messages.length > 0) {
        navigation.setParams({ messageId: undefined });
      }
      return;
    }
    const timer = setTimeout(() => {
      listRef.current?.scrollToIndex({ index: idx, animated: true, viewPosition: 0.4 });
      setActiveMsgId(id);
      setTimeout(() => setActiveMsgId((cur) => (cur === id ? null : cur)), 2600);
      navigation.setParams({ messageId: undefined });
    }, 450);
    return () => clearTimeout(timer);
  }, [route.params?.messageId, messages, navigation]);

  const onSendText = () => {
    if (!canSendText) return;
    sendText(draft);
    setDraft('');
    Haptics.selectionAsync().catch(() => {});
  };

  const onSendPhoto = async () => {
    const r = await pickRawPhoto('library');
    if (!r.ok) return;
    sendPhoto(r.uri);
    setPhotoDrop(`chat-${Date.now()}`, { uri: r.uri, at: Date.now(), caption: 'Sent in chat' });
  };
  const onTakePhoto = async () => {
    const r = await pickRawPhoto('camera');
    if (!r.ok) return;
    sendPhoto(r.uri);
    setPhotoDrop(`chat-${Date.now()}`, { uri: r.uri, at: Date.now(), caption: 'Shot in chat' });
    setActionsOpen(false);
  };
  const onSendGif = (gifUri: string) => {
    sendPhoto(gifUri);
    setActionsOpen(false);
  };
  const toggleFavoriteGif = async (gif: GifItem) => {
    setFavoriteGifs((prev) => {
      const exists = prev.some((x) => x.url === gif.url);
      const next = exists ? prev.filter((x) => x.url !== gif.url) : [gif, ...prev].slice(0, 40);
      AsyncStorage.setItem(FAVORITE_GIFS_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  };
  const pushRecentSearch = async (query: string) => {
    const q = query.trim().toLowerCase();
    if (!q) return;
    setRecentSearches((prev) => {
      const next = [q, ...prev.filter((x) => x !== q)].slice(0, 12);
      AsyncStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  };
  const loadGifs = async (query: string) => {
    setGifLoading(true);
    try {
      const normalized = query.trim() || 'love';
      const q = encodeURIComponent(normalized);
      // Public test key provided by Tenor docs for demo apps.
      const url = `https://api.tenor.com/v1/search?q=${q}&key=LIVDSRZULELA&limit=100&media_filter=minimal&contentfilter=medium`;
      const res = await fetch(url);
      const json = await res.json();
      const next: GifItem[] = (json?.results ?? [])
        .map((it: any) => {
          const media = it?.media?.[0];
          const gifUrl = media?.gif?.url ?? media?.tinygif?.url;
          const preview = media?.tinygif?.url ?? gifUrl;
          if (!gifUrl) return null;
          return { id: String(it?.id ?? Math.random()), url: gifUrl, preview };
        })
        .filter(Boolean);
      setGifResults(next);
      await pushRecentSearch(normalized);
    } catch {
      setGifResults([]);
    } finally {
      setGifLoading(false);
    }
  };

  const startRecording = async () => {
    try {
      const perm = await Audio.requestPermissionsAsync();
      if (!perm.granted) return;
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const rec = new Audio.Recording();
      await rec.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      await rec.startAsync();
      setRecording(rec);
    } catch {
      // ignore
    }
  };

  const stopRecording = async () => {
    if (!recording) return;
    try {
      await recording.stopAndUnloadAsync();
      const status = await recording.getStatusAsync();
      const uri = recording.getURI();
      if (uri) {
        setVoiceDraft({
          uri,
          durationMs: (status as any).durationMillis ?? 0,
        });
      }
    } catch {
      // ignore
    } finally {
      setRecording(null);
    }
  };
  const sendVoiceDraft = () => {
    if (!voiceDraft) return;
    sendVoice(voiceDraft.uri, voiceDraft.durationMs);
    setVoiceDraft(null);
    setActionsOpen(false);
  };
  const playOrStopVoice = async (item: ChatMessage) => {
    if (!item.audioUri) return;
    try {
      if (playingVoiceId === item.id && playbackRef.current) {
        await playbackRef.current.stopAsync();
        await playbackRef.current.unloadAsync();
        playbackRef.current = null;
        setPlayingVoiceId(null);
        return;
      }

      if (playbackRef.current) {
        await playbackRef.current.unloadAsync();
        playbackRef.current = null;
      }
      const { sound } = await Audio.Sound.createAsync({ uri: item.audioUri }, { shouldPlay: true });
      playbackRef.current = sound;
      setPlayingVoiceId(item.id);
      sound.setOnPlaybackStatusUpdate((status) => {
        if (!status.isLoaded) return;
        if (status.didJustFinish) {
          sound.unloadAsync().catch(() => {});
          if (playbackRef.current === sound) playbackRef.current = null;
          setPlayingVoiceId(null);
        }
      });
    } catch {
      setPlayingVoiceId(null);
    }
  };
  const voiceActionLabel = recording ? 'Mic' : voiceDraft ? 'Send' : 'Voice note';
  const onVoiceAction = () => {
    if (recording) {
      stopRecording().catch(() => {});
      return;
    }
    if (voiceDraft) {
      sendVoiceDraft();
      return;
    }
    startRecording().catch(() => {});
  };
  const sendHeartbeat = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
    setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}), 170);
    sendText('💓 Heartbeat sent');
    setActionsOpen(false);
  };

  const renderMessage = ({ item }: { item: ChatMessage }) => {
    const mine = item.sender === 'me';
    const active = activeMsgId === item.id;
    return (
      <Pressable
        onLongPress={() => setActiveMsgId((x) => (x === item.id ? null : item.id))}
        style={[
          styles.msgWrap,
          { alignSelf: mine ? 'flex-end' : 'flex-start' },
        ]}
      >
        <View
          style={[
            styles.msgBubble,
            {
              backgroundColor: mine ? colors.cardGlow : 'rgba(255,255,255,0.06)',
              borderColor: colors.border,
            },
            item.kind === 'task' ? styles.taskBubble : null,
          ]}
        >
          {item.kind === 'text' || item.kind === 'task' ? (
            <Text style={[styles.msgText, { color: colors.text }]}>
              {item.text != null && String(item.text).length > 0 ? item.text : '…'}
            </Text>
          ) : null}
          {item.kind === 'voice' ? (
            <View style={styles.voiceRow}>
              <Text style={[styles.msgText, { color: colors.text }]}>
                Voice note ({Math.max(1, Math.round((item.durationMs ?? 0) / 1000))}s)
              </Text>
              <Pressable
                onPress={() => playOrStopVoice(item)}
                style={({ pressed }) => [
                  styles.voicePlayBtn,
                  { borderColor: colors.border, opacity: pressed ? 0.8 : 1 },
                ]}
              >
                <Ionicons
                  name={playingVoiceId === item.id ? 'stop' : 'play'}
                  size={14}
                  color={colors.gold}
                />
                <Text style={[styles.voicePlayTxt, { color: colors.gold }]}>
                  {playingVoiceId === item.id ? 'Stop' : 'Play'}
                </Text>
              </Pressable>
            </View>
          ) : null}
          {item.kind === 'photo' ? (
            <>
              {item.photoUri ? <Image source={{ uri: item.photoUri }} style={styles.photoBubble} /> : null}
              <Text style={[styles.msgText, { color: colors.text }]}>{item.photoUri?.includes('.gif') ? 'GIF sent' : 'Photo sent'}</Text>
            </>
          ) : null}
          {!!item.reactions?.length ? (
            <Text style={[styles.reactions, { color: colors.gold }]}>{item.reactions.join(' ')}</Text>
          ) : null}
        </View>
        <Text style={[styles.receipt, { color: colors.muted }]}>
          {mine ? `${item.readByPartner ? 'Read' : 'Sent'} • ${formatMessageTime(item.createdAt)}` : formatMessageTime(item.createdAt)}
        </Text>

        {active ? (
          <View style={[styles.actions, { borderColor: colors.border, backgroundColor: colors.surface }]}>
            <View style={styles.row}>
              {REACTIONS.map((e) => (
                <Pressable
                  key={e}
                  onPress={async () => {
                    toggleReaction(item.id, e);
                    await Haptics.selectionAsync();
                  }}
                  style={styles.reactionBtn}
                >
                  <Text style={styles.reactionTxt}>{e}</Text>
                </Pressable>
              ))}
            </View>
            <Pressable onPress={() => togglePin(item.id)} style={styles.pinBtn}>
              <Ionicons name={item.pinned ? 'pin' : 'pin-outline'} size={14} color={colors.gold} />
              <Text style={[styles.pinTxt, { color: colors.gold }]}>{item.pinned ? 'Unpin' : 'Pin moment'}</Text>
            </Pressable>
          </View>
        ) : null}
      </Pressable>
    );
  };

  return (
    <View style={styles.root}>
      <AmbientBackground />
      <KeyboardAvoidingView
        style={styles.screenSafeArea}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? headerHeight : 0}
      >
      <View
        style={[
          styles.container,
          {
            paddingBottom: 8,
          },
        ]}
      >
        {pinned ? (
          <SoftCard>
            <Text style={[styles.pinHeader, { color: colors.gold }]}>Pinned moment</Text>
            <Text style={[styles.msgText, { color: colors.text }]} numberOfLines={2}>
              {pinned.text ?? (pinned.kind === 'photo' ? 'Pinned photo' : 'Pinned voice note')}
            </Text>
          </SoftCard>
        ) : null}

        {partnerTyping ? (
          <Text style={[styles.typing, { color: colors.muted }]}>Partner is typing...</Text>
        ) : null}

        <FlatList
          ref={listRef}
          data={messages}
          extraData={messages}
          keyExtractor={(m) => m.id}
          renderItem={renderMessage}
          contentContainerStyle={[styles.list, { paddingBottom: Math.max(8, insets.bottom) }]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
          inverted
          onScrollToIndexFailed={(info) => {
            setTimeout(() => {
              listRef.current?.scrollToIndex({
                index: info.index,
                animated: true,
                viewPosition: 0.4,
              });
            }, 300);
          }}
          ListEmptyComponent={
            <SoftCard style={styles.emptyWrap}>
              <Text style={[styles.emptyTitle, { color: colors.text }]}>Start your first message</Text>
              <Text style={[styles.emptySubtitle, { color: colors.muted }]}>
                Send a text, photo, GIF, voice note, or heartbeat.
              </Text>
            </SoftCard>
          }
        />

        <View style={styles.toolsRow}>
          <Text style={[styles.tip, { color: colors.muted }]}>Tap + for camera, GIF, voice, heartbeat</Text>
        </View>

        <View style={styles.inputRow}>
          <Pressable
            onPress={() => setActionsOpen(true)}
            style={({ pressed }) => [
              styles.plusBtn,
              { borderColor: colors.border, backgroundColor: colors.surface, opacity: pressed ? 0.8 : 1 },
            ]}
          >
            <Ionicons name="add" size={22} color={colors.gold} />
          </Pressable>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder="Message..."
            placeholderTextColor={colors.muted}
            style={[styles.input, { color: colors.text, borderColor: colors.border }]}
            multiline
            textAlignVertical="top"
            blurOnSubmit={false}
            scrollEnabled
          />
          <GoldButton title="Send" onPress={onSendText} disabled={!canSendText} />
        </View>
      </View>
      </KeyboardAvoidingView>

      <Modal visible={actionsOpen} transparent animationType="fade" onRequestClose={() => setActionsOpen(false)}>
        <Pressable style={styles.actionBackdrop} onPress={() => setActionsOpen(false)}>
          <Pressable style={[styles.actionCard, { backgroundColor: colors.surface, borderColor: colors.border }]} onPress={() => {}}>
            <Text style={[styles.actionTitle, { color: colors.text }]}>Quick send</Text>
            <View style={styles.quickRow}>
              <GoldButton title="Gallery" onPress={async () => { await onSendPhoto(); setActionsOpen(false); }} style={{ flex: 1 }} />
              <GoldButton title="Photo" onPress={onTakePhoto} style={{ flex: 1 }} />
            </View>
            <View style={styles.quickRow}>
              <Pressable
                onPress={onVoiceAction}
                style={({ pressed }) => [
                  styles.voiceActionBtn,
                  {
                    backgroundColor: recording ? '#B91C1C' : colors.gold,
                    opacity: pressed ? 0.85 : 1,
                  },
                ]}
              >
                {recording ? <Ionicons name="mic" size={18} color="#FFF" /> : null}
                <Text style={[styles.voiceActionTxt, { color: recording ? '#FFF' : '#1A1510' }]}>
                  {voiceActionLabel}
                </Text>
              </Pressable>
              <Pressable onPress={sendHeartbeat} style={[styles.heartbeatBtn, { borderColor: colors.border }]}>
                <Animated.View style={{ transform: [{ scale: beat }] }}>
                  <Ionicons name="heart" size={22} color={colors.gold} />
                </Animated.View>
                <Text style={[styles.heartbeatTxt, { color: colors.text }]}>Heartbeat</Text>
              </Pressable>
            </View>
            <Text style={[styles.packTitle, { color: colors.muted }]}>GIF pack</Text>
            <View style={styles.gifSearchRow}>
              <TextInput
                value={gifQuery}
                onChangeText={setGifQuery}
                placeholder="Search GIFs (love, hug, kiss...)"
                placeholderTextColor={colors.muted}
                style={[styles.gifSearchInput, { color: colors.text, borderColor: colors.border }]}
                autoCapitalize="none"
              />
              <GoldButton title="Search" onPress={() => loadGifs(gifQuery)} />
            </View>
            <Text style={[styles.smallInfo, { color: colors.muted }]}>
              {gifLoading ? 'Loading GIFs...' : `${gifResults.length} GIFs found`}
            </Text>
            {!!recentSearches.length ? (
              <>
                <Text style={[styles.packSubTitle, { color: colors.muted }]}>Recent searches</Text>
                <View style={styles.chipsRow}>
                  {recentSearches.map((q) => (
                    <Pressable
                      key={q}
                      onPress={() => {
                        setGifQuery(q);
                        loadGifs(q).catch(() => {});
                      }}
                      style={[styles.chip, { borderColor: colors.border }]}
                    >
                      <Text style={[styles.chipTxt, { color: colors.text }]}>{q}</Text>
                    </Pressable>
                  ))}
                </View>
              </>
            ) : null}
            {!!favoriteGifs.length ? (
              <>
                <Text style={[styles.packSubTitle, { color: colors.muted }]}>Favorites</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.favRow}>
                  {favoriteGifs.map((g) => (
                    <Pressable key={`fav-${g.id}-${g.url}`} onPress={() => onSendGif(g.url)} style={[styles.favTile, { borderColor: colors.border }]}>
                      <Image source={{ uri: g.preview || g.url }} style={styles.favImage} />
                    </Pressable>
                  ))}
                </ScrollView>
              </>
            ) : null}
            <ScrollView style={styles.gifScroller} contentContainerStyle={styles.gifGrid}>
              {gifResults.map((g) => (
                <View key={g.id} style={[styles.gifTile, { borderColor: colors.border }]}>
                  <Pressable onPress={() => onSendGif(g.url)} style={styles.gifTapArea}>
                    <Image source={{ uri: g.preview || g.url }} style={styles.gifImage} />
                  </Pressable>
                  <Pressable
                    onPress={() => toggleFavoriteGif(g)}
                    style={[styles.favBtn, { backgroundColor: 'rgba(0,0,0,0.45)' }]}
                  >
                    <Ionicons
                      name={favoriteGifs.some((x) => x.url === g.url) ? 'heart' : 'heart-outline'}
                      size={14}
                      color={colors.gold}
                    />
                  </Pressable>
                </View>
              ))}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  screenSafeArea: {
    flex: 1,
    paddingTop: 8,
  },
  container: { flex: 1, paddingHorizontal: 14, paddingTop: 8, gap: 8 },
  list: { gap: 8, paddingBottom: 4, flexGrow: 1 },
  msgWrap: { maxWidth: '86%' },
  msgBubble: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 10, paddingVertical: 8 },
  taskBubble: { borderStyle: 'dashed' },
  msgText: { fontSize: 13, fontWeight: '700', lineHeight: 18 },
  voiceRow: { gap: 8 },
  voicePlayBtn: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  voicePlayTxt: { fontSize: 11, fontWeight: '800' },
  reactions: { marginTop: 6, fontSize: 13, fontWeight: '700' },
  receipt: { marginTop: 4, fontSize: 10, fontWeight: '700', alignSelf: 'flex-end', opacity: 0.9 },
  actions: { marginTop: 6, borderWidth: 1, borderRadius: 10, padding: 8, gap: 6 },
  row: { flexDirection: 'row', gap: 8 },
  reactionBtn: { paddingHorizontal: 4, paddingVertical: 2 },
  reactionTxt: { fontSize: 18 },
  pinBtn: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  pinTxt: { fontSize: 12, fontWeight: '800' },
  pinHeader: { fontSize: 11, fontWeight: '900', marginBottom: 4, letterSpacing: 0.5 },
  typing: { fontSize: 11, fontWeight: '700', marginLeft: 4 },
  toolsRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  tip: { fontSize: 11, fontWeight: '700', flex: 1 },
  inputRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  plusBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 10,
    minHeight: 42,
    maxHeight: 110,
    backgroundColor: 'rgba(231,199,125,0.05)',
    fontWeight: '700',
  },
  emptyWrap: {
    marginTop: 20,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '900',
    textAlign: 'center',
  },
  emptySubtitle: {
    marginTop: 6,
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 17,
  },
  photoBubble: {
    width: 180,
    height: 180,
    borderRadius: 12,
    marginBottom: 6,
  },
  actionBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
    padding: 14,
  },
  actionCard: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 12,
    gap: 10,
  },
  actionTitle: { fontSize: 15, fontWeight: '900' },
  quickRow: { flexDirection: 'row', gap: 8 },
  heartbeatBtn: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 999,
    minHeight: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  heartbeatTxt: { fontSize: 13, fontWeight: '800' },
  voiceActionBtn: {
    flex: 1,
    minHeight: 50,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
  },
  voiceActionTxt: {
    fontSize: 16,
    fontWeight: '800',
  },
  packTitle: { marginTop: 2, fontSize: 12, fontWeight: '800' },
  gifSearchRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  gifSearchInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 10,
    backgroundColor: 'rgba(231,199,125,0.05)',
    fontWeight: '700',
  },
  smallInfo: { fontSize: 11, fontWeight: '700' },
  packSubTitle: { fontSize: 11, fontWeight: '800', marginTop: 2 },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  chipTxt: { fontSize: 11, fontWeight: '800' },
  favRow: { gap: 8 },
  favTile: {
    width: 74,
    height: 74,
    borderWidth: 1,
    borderRadius: 10,
    overflow: 'hidden',
  },
  favImage: { width: '100%', height: '100%' },
  gifScroller: { maxHeight: 220 },
  gifGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingBottom: 4 },
  gifTile: {
    position: 'relative',
    width: '31%',
    aspectRatio: 1,
    borderWidth: 1,
    borderRadius: 10,
    overflow: 'hidden',
  },
  gifTapArea: { width: '100%', height: '100%' },
  gifImage: { width: '100%', height: '100%' },
  favBtn: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

