import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';

import { firebaseDb } from '../config/firebase';
import { FIRESTORE_SYNC_FLAGS } from '../config/firestoreSyncFlags';
import { useAuth } from './AuthContext';
import { usePairing } from './PairingContext';

const ENABLE_SNAP_FIRESTORE_SYNC = FIRESTORE_SYNC_FLAGS.snap;

export type CollageLayout = 'grid' | 'polaroid' | 'mosaic';

export type SnapEntry = {
  uri: string;
  caption?: string;
  at: number;
  senderUid?: string;
  senderName?: string;
};

export type MemoryPin = {
  id: string;
  title: string;
  note: string;
  photoUri?: string;
  lat?: number;
  lng?: number;
  at: number;
};

/** dateKey -> senderUid -> snap (HTTPS URLs after upload; local file:// only offline). */
export type DailySnapsByDate = Record<string, Record<string, SnapEntry>>;

type SnapState = {
  dailyByDate: DailySnapsByDate;
  /** MVP: mark days your partner sent their snap (or sync later). */
  partnerSentByDate: Record<string, boolean>;
  dropsByDate: Record<string, SnapEntry & { prompt?: string }>;
  collageLayout: CollageLayout;
  memoryPins: MemoryPin[];
};

const defaultSnapState = (): SnapState => ({
  dailyByDate: {},
  partnerSentByDate: {},
  dropsByDate: {},
  collageLayout: 'grid',
  memoryPins: [],
});

/** Migrate legacy single-entry days to per-sender map. */
function migrateDailyByDate(raw: unknown): DailySnapsByDate {
  if (raw == null || typeof raw !== 'object') return {};
  const out: DailySnapsByDate = {};
  for (const [dateKey, val] of Object.entries(raw as Record<string, unknown>)) {
    if (val == null) continue;
    if (typeof val === 'object' && val !== null && 'uri' in val && typeof (val as SnapEntry).uri === 'string') {
      const e = val as SnapEntry;
      const uid = e.senderUid && e.senderUid.length > 0 ? e.senderUid : '_legacy';
      out[dateKey] = { [uid]: { ...e, senderUid: uid === '_legacy' ? e.senderUid : e.senderUid } };
      continue;
    }
    const day: Record<string, SnapEntry> = {};
    if (typeof val === 'object' && val !== null) {
      for (const [uid, v] of Object.entries(val as Record<string, unknown>)) {
        if (v && typeof v === 'object' && 'uri' in (v as object) && 'at' in (v as object)) {
          day[uid] = v as SnapEntry;
        }
      }
    }
    if (Object.keys(day).length > 0) out[dateKey] = day;
  }
  return out;
}

function sanitizeSnapStateForFirestore(state: SnapState) {
  const dailyByDate = Object.fromEntries(
    Object.entries(state.dailyByDate).map(([dateKey, dayMap]) => [
      dateKey,
      Object.fromEntries(
        Object.entries(dayMap).map(([uid, v]) => [
          uid,
          {
            uri: v.uri,
            at: v.at,
            ...(v.caption == null ? {} : { caption: v.caption }),
            ...(v.senderUid == null ? {} : { senderUid: v.senderUid }),
            ...(v.senderName == null ? {} : { senderName: v.senderName }),
          },
        ])
      ),
    ])
  );
  const dropsByDate = Object.fromEntries(
    Object.entries(state.dropsByDate).map(([k, v]) => {
      const base: { uri: string; at: number; caption?: string; prompt?: string } = {
        uri: v.uri,
        at: v.at,
      };
      if (v.caption != null) base.caption = v.caption;
      if (v.prompt != null) base.prompt = v.prompt;
      return [k, base];
    })
  );
  const memoryPins = state.memoryPins.map((pin) => {
    const base: {
      id: string;
      title: string;
      note: string;
      at: number;
      photoUri?: string;
      lat?: number;
      lng?: number;
    } = {
      id: pin.id,
      title: pin.title,
      note: pin.note,
      at: pin.at,
    };
    if (pin.photoUri != null) base.photoUri = pin.photoUri;
    if (pin.lat != null) base.lat = pin.lat;
    if (pin.lng != null) base.lng = pin.lng;
    return base;
  });
  return {
    dailyByDate,
    partnerSentByDate: state.partnerSentByDate,
    dropsByDate,
    collageLayout: state.collageLayout,
    memoryPins,
    updatedAt: Date.now(),
  };
}

function dateKey(d = new Date()) {
  return d.toISOString().slice(0, 10);
}

function streakBothDays(
  dailyByDate: DailySnapsByDate,
  partnerSentByDate: Record<string, boolean>,
  myUid: string | null,
  maxDays = 120
) {
  let streak = 0;
  const today = new Date();
  for (let i = 0; i < maxDays; i++) {
    const t = new Date(today);
    t.setDate(t.getDate() - i);
    const k = dateKey(t);
    const day = dailyByDate[k];
    const me = !!(myUid && day?.[myUid]);
    const partnerSnap = day && Object.keys(day).some((uid) => uid !== myUid);
    const them = !!partnerSentByDate[k] || partnerSnap;
    if (me && them) streak++;
    else break;
  }
  return streak;
}

type SnapContextValue = SnapState & {
  todayKey: string;
  setCollageLayout: (l: CollageLayout) => void;
  setDailySnap: (key: string, entry: SnapEntry | null) => void;
  setPartnerSent: (key: string, sent: boolean) => void;
  setPhotoDrop: (key: string, entry: (SnapEntry & { prompt?: string }) | null) => void;
  addMemoryPin: (pin: Omit<MemoryPin, 'id' | 'at'> & { id?: string }) => void;
  removeMemoryPin: (id: string) => void;
  persist: () => Promise<void>;
};

const SnapContext = createContext<SnapContextValue | null>(null);

export function SnapProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { coupleCode } = usePairing();
  const [state, setState] = useState<SnapState>(defaultSnapState);
  const [hydrated, setHydrated] = useState(false);
  const lastRemoteSigRef = useRef('');

  const storageKey = coupleCode ? `snap:${coupleCode}` : 'snap:local';
  const snapDocRef = useMemo(
    () => (coupleCode ? doc(firebaseDb, 'couples', coupleCode, 'state', 'snap') : null),
    [coupleCode]
  );

  useEffect(() => {
    if (ENABLE_SNAP_FIRESTORE_SYNC && coupleCode && user && snapDocRef) return;
    let cancelled = false;
    setHydrated(false);
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(storageKey);
        if (cancelled) return;
        if (raw) {
          const parsed = JSON.parse(raw) as Partial<SnapState>;
          setState({
            dailyByDate: migrateDailyByDate(parsed.dailyByDate),
            partnerSentByDate: parsed.partnerSentByDate ?? {},
            dropsByDate: parsed.dropsByDate ?? {},
            memoryPins: parsed.memoryPins ?? [],
            collageLayout: parsed.collageLayout ?? 'grid',
          });
        } else {
          setState(defaultSnapState());
        }
      } catch {
        setState(defaultSnapState());
      } finally {
        if (!cancelled) setHydrated(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [storageKey]);

  useEffect(() => {
    if (!ENABLE_SNAP_FIRESTORE_SYNC) return;
    // Do not wait for coupleMembershipReady: membership + rules already gate access; waiting here
    // could leave snap state never hydrated and the partner would never see shared snaps.
    if (!coupleCode || !user || !snapDocRef) return;
    setHydrated(false);
    const unsub = onSnapshot(
      snapDocRef,
      (snap) => {
        const x = snap.data() as any;
        const next = x
          ? {
              dailyByDate: migrateDailyByDate(x.dailyByDate),
              partnerSentByDate: x.partnerSentByDate ?? {},
              dropsByDate: x.dropsByDate ?? {},
              memoryPins: x.memoryPins ?? [],
              collageLayout: x.collageLayout ?? 'grid',
            }
          : defaultSnapState();
        lastRemoteSigRef.current = JSON.stringify(next);
        setState((prev) => (JSON.stringify(prev) === JSON.stringify(next) ? prev : next));
        setHydrated(true);
      },
      (err) => {
        if (__DEV__) console.warn('[Snap] Firestore listener failed (check rules + membership):', err?.code, err?.message);
        setHydrated(true);
      }
    );
    return () => unsub();
  }, [coupleCode, user, snapDocRef]);

  useEffect(() => {
    if (!hydrated) return;
    if (ENABLE_SNAP_FIRESTORE_SYNC && coupleCode && user && snapDocRef) {
      const payload = sanitizeSnapStateForFirestore(state);
      const localSig = JSON.stringify(payload);
      if (localSig === lastRemoteSigRef.current) return;
      const timer = setTimeout(() => {
        lastRemoteSigRef.current = localSig;
        setDoc(snapDocRef, payload, { merge: true }).catch((err) => {
          if (__DEV__) console.warn('[Snap] debounced setDoc failed:', err?.code, err?.message);
        });
      }, 400);
      return () => clearTimeout(timer);
    }
    AsyncStorage.setItem(storageKey, JSON.stringify(state)).catch(() => {});
  }, [hydrated, storageKey, state, coupleCode, user, snapDocRef]);

  const setCollageLayout = useCallback((collageLayout: CollageLayout) => {
    setState((s) => ({ ...s, collageLayout }));
  }, []);

  const setDailySnap = useCallback(
    (key: string, entry: SnapEntry | null) => {
      setState((s) => {
        const nextDaily: DailySnapsByDate = { ...s.dailyByDate };
        const day = { ...(nextDaily[key] ?? {}) };
        if (entry) {
          const uid = entry.senderUid;
          if (!uid) return s;
          day[uid] = entry;
          nextDaily[key] = day;
        }
        const nextState: SnapState = { ...s, dailyByDate: nextDaily };
        if (ENABLE_SNAP_FIRESTORE_SYNC && coupleCode && user && snapDocRef) {
          const payload = sanitizeSnapStateForFirestore(nextState);
          lastRemoteSigRef.current = JSON.stringify(payload);
          setDoc(snapDocRef, payload, { merge: true }).catch((err) => {
            if (__DEV__) console.warn('[Snap] immediate setDoc failed:', err?.code, err?.message);
          });
        }
        return nextState;
      });
    },
    [coupleCode, user, snapDocRef]
  );

  const setPartnerSent = useCallback((key: string, sent: boolean) => {
    setState((s) => ({
      ...s,
      partnerSentByDate: { ...s.partnerSentByDate, [key]: sent },
    }));
  }, []);

  const setPhotoDrop = useCallback((key: string, entry: (SnapEntry & { prompt?: string }) | null) => {
    setState((s) => {
      const next = { ...s.dropsByDate };
      if (entry) next[key] = entry;
      else delete next[key];
      return { ...s, dropsByDate: next };
    });
  }, []);

  const addMemoryPin = useCallback((pin: Omit<MemoryPin, 'id' | 'at'> & { id?: string }) => {
    const id = pin.id ?? `pin_${Date.now()}`;
    const full: MemoryPin = {
      ...pin,
      id,
      at: Date.now(),
    };
    setState((s) => ({ ...s, memoryPins: [full, ...s.memoryPins] }));
  }, []);

  const removeMemoryPin = useCallback((id: string) => {
    setState((s) => ({ ...s, memoryPins: s.memoryPins.filter((p) => p.id !== id) }));
  }, []);

  const persist = useCallback(async () => {
    if (!hydrated) return;
    if (ENABLE_SNAP_FIRESTORE_SYNC && coupleCode && user && snapDocRef) {
      const payload = sanitizeSnapStateForFirestore(state);
      lastRemoteSigRef.current = JSON.stringify(payload);
      await setDoc(snapDocRef, payload, { merge: true });
      return;
    }
    await AsyncStorage.setItem(storageKey, JSON.stringify(state));
  }, [hydrated, storageKey, state, coupleCode, user, snapDocRef]);

  const value = useMemo<SnapContextValue>(
    () => ({
      ...state,
      todayKey: dateKey(),
      setCollageLayout,
      setDailySnap,
      setPartnerSent,
      setPhotoDrop,
      addMemoryPin,
      removeMemoryPin,
      persist,
    }),
    [state, setCollageLayout, setDailySnap, setPartnerSent, setPhotoDrop, addMemoryPin, removeMemoryPin, persist]
  );

  return <SnapContext.Provider value={value}>{children}</SnapContext.Provider>;
}

export function useSnap() {
  const ctx = useContext(SnapContext);
  if (!ctx) throw new Error('useSnap must be used within SnapProvider');
  return ctx;
}

export function useSnapStreak(
  dailyByDate: DailySnapsByDate,
  partnerSentByDate: Record<string, boolean>,
  myUid: string | null
) {
  return useMemo(
    () => streakBothDays(dailyByDate, partnerSentByDate, myUid),
    [dailyByDate, partnerSentByDate, myUid]
  );
}
