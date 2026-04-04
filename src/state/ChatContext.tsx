import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  collection,
  doc,
  getDoc,
  limit,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  updateDoc,
} from 'firebase/firestore';

import { firebaseAuth, firebaseDb } from '../config/firebase';
import { uploadChatMedia } from '../utils/uploadChatMedia';
import { FIRESTORE_SYNC_FLAGS } from '../config/firestoreSyncFlags';
import { useAuth } from './AuthContext';
import { usePairing } from './PairingContext';

const ENABLE_CHAT_FIRESTORE_SYNC = FIRESTORE_SYNC_FLAGS.chat;

export type ChatMessage = {
  id: string;
  kind: 'text' | 'voice' | 'photo' | 'task';
  sender: 'me' | 'partner';
  text?: string;
  audioUri?: string;
  durationMs?: number;
  photoUri?: string;
  createdAt: number;
  readByPartner?: boolean;
  reactions?: string[];
  pinned?: boolean;
};

type ChatContextValue = {
  messages: ChatMessage[];
  partnerTyping: boolean;
  setPartnerTyping: (v: boolean) => void;
  sendText: (text: string) => void;
  sendVoice: (uri: string, durationMs?: number) => void;
  sendPhoto: (uri: string) => void;
  addTaskLinkedMessage: (taskText: string) => void;
  toggleReaction: (messageId: string, emoji: string) => void;
  togglePin: (messageId: string) => void;
};

const ChatContext = createContext<ChatContextValue | null>(null);

function keyFor(coupleCode: string | null) {
  return coupleCode ? `chat:v1:${coupleCode}` : 'chat:v1:local';
}

/** Rules require this doc before chat_messages read/write; PairingContext writes it async — race with first send/listen otherwise. */
function memberDocRef(coupleCode: string, uid: string) {
  return doc(firebaseDb, 'couples', coupleCode, 'members', uid);
}

async function ensureCoupleMembership(coupleCode: string, uid: string) {
  await setDoc(memberDocRef(coupleCode, uid), { uid, joinedAt: Date.now() }, { merge: true });
}

/** Writes membership then verifies it exists — Firestore rules require this doc for chat. */
async function ensureMemberDocForChat(coupleCode: string, uid: string) {
  await ensureCoupleMembership(coupleCode, uid);
  let snap = await getDoc(memberDocRef(coupleCode, uid));
  if (!snap.exists()) {
    await setDoc(memberDocRef(coupleCode, uid), { uid, joinedAt: Date.now() }, { merge: true });
    snap = await getDoc(memberDocRef(coupleCode, uid));
  }
  if (!snap.exists()) {
    throw new Error(
      'Couple membership document was not created. Check Firestore rules for couples/{code}/members/{uid} and redeploy rules.'
    );
  }
}

function readCreatedAtMs(raw: unknown): number {
  if (raw == null) return 0;
  if (typeof raw === 'number' && !Number.isNaN(raw)) return raw;
  if (typeof raw === 'object' && raw !== null && typeof (raw as { toMillis?: () => number }).toMillis === 'function') {
    return (raw as { toMillis: () => number }).toMillis();
  }
  return 0;
}

function coerceOptionalString(v: unknown): string | undefined {
  if (v == null) return undefined;
  if (typeof v === 'string') return v;
  return String(v);
}

function mapChatDoc(d: { id: string; data: () => Record<string, unknown> }, uid: string): ChatMessage {
  const x = d.data() as Record<string, unknown>;
  const createdAt = readCreatedAtMs(x.createdAt);
  const suid = x.senderUid != null ? String(x.senderUid) : '';
  const kindRaw = x.kind;
  const kind =
    kindRaw === 'voice' || kindRaw === 'photo' || kindRaw === 'task' || kindRaw === 'text'
      ? kindRaw
      : 'text';
  return {
    id: d.id,
    kind,
    sender: suid === String(uid) ? 'me' : 'partner',
    text: coerceOptionalString(x.text),
    audioUri: coerceOptionalString(x.audioUri),
    durationMs: typeof x.durationMs === 'number' ? x.durationMs : undefined,
    photoUri: coerceOptionalString(x.photoUri),
    createdAt,
    readByPartner: !!x.readByPartner,
    reactions: Array.isArray(x.reactions) ? (x.reactions as string[]) : [],
    pinned: !!x.pinned,
  };
}

const PENDING_PREFIX = 'pending_';

/** Firestore snapshots often arrive before addDoc finishes; replacing state would drop the row. */
function serverCoversPending(server: ChatMessage, pending: ChatMessage): boolean {
  if (!pending.id.startsWith(PENDING_PREFIX)) return false;
  if (server.sender !== 'me' || pending.sender !== 'me') return false;
  if (server.kind !== pending.kind) return false;
  if (Math.abs(server.createdAt - pending.createdAt) > 180_000) return false;
  if (server.kind === 'text' || server.kind === 'task') return server.text === pending.text;
  if (server.kind === 'voice')
    return Math.abs((server.durationMs ?? 0) - (pending.durationMs ?? 0)) < 2000;
  if (server.kind === 'photo') return true;
  return false;
}

function mergeServerWithPending(server: ChatMessage[], prev: ChatMessage[]): ChatMessage[] {
  const pending = prev.filter((m) => m.id.startsWith(PENDING_PREFIX));
  const stillPending = pending.filter((p) => !server.some((s) => serverCoversPending(s, p)));
  return [...server, ...stillPending].sort((a, b) => b.createdAt - a.createdAt);
}

export function ChatProvider({ children }: { children: React.ReactNode }) {
  const { coupleCode, coupleMembershipReady } = usePairing();
  const { user, profile } = useAuth();
  const storageKey = keyFor(coupleCode);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [partnerTyping, setPartnerTyping] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const uid = user?.uid ?? null;

  useEffect(() => {
    if (ENABLE_CHAT_FIRESTORE_SYNC && coupleCode && uid) return;
    let cancelled = false;
    setHydrated(false);
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(storageKey);
        if (!raw || cancelled) return;
        const parsed = JSON.parse(raw) as { messages?: ChatMessage[] };
        if (!cancelled) setMessages(parsed.messages ?? []);
      } catch {
        // ignore
      } finally {
        if (!cancelled) setHydrated(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [storageKey, coupleCode, uid]);

  useEffect(() => {
    if (!ENABLE_CHAT_FIRESTORE_SYNC) return;
    if (!coupleCode || !uid || !coupleMembershipReady) return;
    setHydrated(false);
    let cancelled = false;
    let unsub: (() => void) | undefined;

    (async () => {
      try {
        await firebaseAuth.authStateReady();
        const authUid = firebaseAuth.currentUser?.uid;
        if (!authUid) {
          if (__DEV__) console.warn('[Chat] Firestore listener skipped: no auth uid');
          setHydrated(true);
          return;
        }
        await ensureMemberDocForChat(coupleCode, authUid);
      } catch (e) {
        if (__DEV__) console.warn('[Chat] ensureMemberDocForChat failed', e);
      }
      if (cancelled) return;
      const q = query(
        collection(firebaseDb, 'couples', coupleCode, 'chat_messages'),
        orderBy('createdAt', 'desc'),
        limit(250)
      );
      unsub = onSnapshot(
        q,
        (snap) => {
          // Must match Firestore rules: senderUid == request.auth.uid (use token user, not stale React state).
          const uidNow = firebaseAuth.currentUser?.uid ?? uid;
          if (!uidNow) {
            setHydrated(true);
            return;
          }
          const server: ChatMessage[] = snap.docs.map((d) => mapChatDoc(d, uidNow));
          setMessages((prev) => mergeServerWithPending(server, prev));
          setHydrated(true);
        },
        (err) => {
          if (__DEV__) console.warn('[Chat] messages listener', err);
          setHydrated(true);
        }
      );
    })();

    return () => {
      cancelled = true;
      unsub?.();
    };
  }, [coupleCode, uid, coupleMembershipReady]);

  useEffect(() => {
    if (!hydrated) return;
    AsyncStorage.setItem(storageKey, JSON.stringify({ messages })).catch(() => {});
  }, [hydrated, storageKey, messages]);

  const pushLocal = (m: ChatMessage) => {
    setMessages((prev) => [m, ...prev]);
    if (m.sender === 'me') {
      setTimeout(() => {
        setMessages((prev) =>
          prev.map((x) => (x.id === m.id ? { ...x, readByPartner: true } : x))
        );
      }, 1800);
    }
  };

  const sendText = (text: string) => {
    const t = text.trim();
    if (!t) return;
    if (ENABLE_CHAT_FIRESTORE_SYNC && coupleCode && uid) {
      const messageRef = doc(collection(firebaseDb, 'couples', coupleCode, 'chat_messages'));
      const messageId = messageRef.id;
      const now = Date.now();
      setMessages((prev) => [
        {
          id: messageId,
          kind: 'text',
          sender: 'me',
          text: t,
          createdAt: now,
          readByPartner: false,
          reactions: [],
        },
        ...prev,
      ]);
      void (async () => {
        try {
          await firebaseAuth.authStateReady();
          const authUid = firebaseAuth.currentUser?.uid;
          if (!authUid) {
            if (__DEV__) console.warn('[Chat] sendText: signed out (no uid)');
            return;
          }
          await ensureMemberDocForChat(coupleCode, authUid);
          await setDoc(messageRef, {
            kind: 'text',
            senderUid: authUid,
            senderName: profile?.displayName ?? 'You',
            text: t,
            createdAt: Math.floor(Date.now()),
            readByPartner: false,
            reactions: [],
            pinned: false,
          });
        } catch (e) {
          if (__DEV__) console.warn('[Chat] sendText', e);
          // Keep optimistic row so the UI does not go blank; merge will dedupe when server succeeds.
        }
      })();
      return;
    }
    pushLocal({
      id: `msg_${Date.now()}`,
      kind: 'text',
      sender: 'me',
      text: t,
      createdAt: Date.now(),
      readByPartner: false,
      reactions: [],
    });
  };

  const sendVoice = (uri: string, durationMs?: number) => {
    if (ENABLE_CHAT_FIRESTORE_SYNC && coupleCode && uid) {
      const messageRef = doc(collection(firebaseDb, 'couples', coupleCode, 'chat_messages'));
      const messageId = messageRef.id;
      const now = Date.now();
      const dm = durationMs ?? 0;
      setMessages((prev) => [
        {
          id: messageId,
          kind: 'voice',
          sender: 'me',
          audioUri: uri,
          durationMs: dm,
          createdAt: now,
          readByPartner: false,
          reactions: [],
        },
        ...prev,
      ]);
      void (async () => {
        try {
          await firebaseAuth.authStateReady();
          const authUid = firebaseAuth.currentUser?.uid;
          if (!authUid) {
            if (__DEV__) console.warn('[Chat] sendVoice: signed out (no uid)');
            return;
          }
          await ensureMemberDocForChat(coupleCode, authUid);
          const audioUrl = await uploadChatMedia({
            coupleCode,
            messageId,
            uri,
            kind: 'voice',
          });
          await setDoc(messageRef, {
            kind: 'voice',
            senderUid: authUid,
            senderName: profile?.displayName ?? 'You',
            audioUri: audioUrl,
            durationMs: dm,
            createdAt: Math.floor(Date.now()),
            readByPartner: false,
            reactions: [],
            pinned: false,
          });
        } catch (e) {
          if (__DEV__) console.warn('[Chat] sendVoice', e);
        }
      })();
      return;
    }
    pushLocal({
      id: `voice_${Date.now()}`,
      kind: 'voice',
      sender: 'me',
      audioUri: uri,
      durationMs,
      createdAt: Date.now(),
      readByPartner: false,
      reactions: [],
    });
  };

  const sendPhoto = (uri: string) => {
    if (ENABLE_CHAT_FIRESTORE_SYNC && coupleCode && uid) {
      const messageRef = doc(collection(firebaseDb, 'couples', coupleCode, 'chat_messages'));
      const messageId = messageRef.id;
      const now = Date.now();
      setMessages((prev) => [
        {
          id: messageId,
          kind: 'photo',
          sender: 'me',
          photoUri: uri,
          createdAt: now,
          readByPartner: false,
          reactions: [],
        },
        ...prev,
      ]);
      void (async () => {
        try {
          await firebaseAuth.authStateReady();
          const authUid = firebaseAuth.currentUser?.uid;
          if (!authUid) {
            if (__DEV__) console.warn('[Chat] sendPhoto: signed out (no uid)');
            return;
          }
          await ensureMemberDocForChat(coupleCode, authUid);
          const photoUrl = await uploadChatMedia({
            coupleCode,
            messageId,
            uri,
            kind: 'photo',
          });
          await setDoc(messageRef, {
            kind: 'photo',
            senderUid: authUid,
            senderName: profile?.displayName ?? 'You',
            photoUri: photoUrl,
            createdAt: Math.floor(Date.now()),
            readByPartner: false,
            reactions: [],
            pinned: false,
          });
        } catch (e) {
          if (__DEV__) console.warn('[Chat] sendPhoto', e);
        }
      })();
      return;
    }
    pushLocal({
      id: `photo_${Date.now()}`,
      kind: 'photo',
      sender: 'me',
      photoUri: uri,
      createdAt: Date.now(),
      readByPartner: false,
      reactions: [],
    });
  };

  const addTaskLinkedMessage = (taskText: string) => {
    if (!taskText.trim()) return;
    const text = `You just checked off: ${taskText}`;
    if (ENABLE_CHAT_FIRESTORE_SYNC && coupleCode && uid) {
      const messageRef = doc(collection(firebaseDb, 'couples', coupleCode, 'chat_messages'));
      const messageId = messageRef.id;
      const now = Date.now();
      setMessages((prev) => [
        {
          id: messageId,
          kind: 'task',
          sender: 'me',
          text,
          createdAt: now,
          readByPartner: false,
          reactions: [],
        },
        ...prev,
      ]);
      void (async () => {
        try {
          await firebaseAuth.authStateReady();
          const authUid = firebaseAuth.currentUser?.uid;
          if (!authUid) {
            if (__DEV__) console.warn('[Chat] addTaskLinkedMessage: signed out (no uid)');
            return;
          }
          await ensureMemberDocForChat(coupleCode, authUid);
          await setDoc(messageRef, {
            kind: 'task',
            senderUid: authUid,
            senderName: profile?.displayName ?? 'You',
            text,
            createdAt: Math.floor(Date.now()),
            readByPartner: false,
            reactions: [],
            pinned: false,
          });
        } catch (e) {
          if (__DEV__) console.warn('[Chat] addTaskLinkedMessage', e);
        }
      })();
      return;
    }
    pushLocal({
      id: `task_${Date.now()}`,
      kind: 'task',
      sender: 'me',
      text,
      createdAt: Date.now(),
      readByPartner: false,
      reactions: [],
    });
  };

  const toggleReaction = (messageId: string, emoji: string) => {
    const target = messages.find((m) => m.id === messageId);
    if (ENABLE_CHAT_FIRESTORE_SYNC && coupleCode && uid && target) {
      const set = new Set(target.reactions ?? []);
      if (set.has(emoji)) set.delete(emoji);
      else set.add(emoji);
      updateDoc(doc(firebaseDb, 'couples', coupleCode, 'chat_messages', messageId), {
        reactions: Array.from(set),
      }).catch(() => {});
      return;
    }
    setMessages((prev) =>
      prev.map((m) => {
        if (m.id !== messageId) return m;
        const set = new Set(m.reactions ?? []);
        if (set.has(emoji)) set.delete(emoji);
        else set.add(emoji);
        return { ...m, reactions: Array.from(set) };
      })
    );
  };

  const togglePin = (messageId: string) => {
    const target = messages.find((m) => m.id === messageId);
    if (ENABLE_CHAT_FIRESTORE_SYNC && coupleCode && uid && target) {
      updateDoc(doc(firebaseDb, 'couples', coupleCode, 'chat_messages', messageId), {
        pinned: !target.pinned,
      }).catch(() => {});
      return;
    }
    setMessages((prev) => prev.map((m) => ({ ...m, pinned: m.id === messageId ? !m.pinned : m.pinned })));
  };

  const value = useMemo<ChatContextValue>(
    () => ({
      messages,
      partnerTyping,
      setPartnerTyping,
      sendText,
      sendVoice,
      sendPhoto,
      addTaskLinkedMessage,
      toggleReaction,
      togglePin,
    }),
    // uid/coupleCode/profile must be included: otherwise send* keep a stale closure from
    // before auth/pairing hydrate while messages/partnerTyping are unchanged — Firestore
    // then overwrites local optimistic rows and messages "vanish".
    [messages, partnerTyping, uid, coupleCode, profile]
  );

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}

export function useChat() {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error('useChat must be used within ChatProvider');
  return ctx;
}

