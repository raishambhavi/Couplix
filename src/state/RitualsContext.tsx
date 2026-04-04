import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';

import { firebaseDb } from '../config/firebase';
import { FIRESTORE_SYNC_FLAGS } from '../config/firestoreSyncFlags';
import type { CoupleMode, DareTierKind } from '../data/dailyDares';
import { randomDare } from '../data/dailyDares';
import { randomQotd } from '../data/qotdQuestions';
import { omitUndefinedDeep } from '../utils/sanitizeFirestore';
import { useAuth } from './AuthContext';
import { usePairing } from './PairingContext';

const ENABLE_RITUALS_FIRESTORE_SYNC = FIRESTORE_SYNC_FLAGS.rituals;

export type NoteFormat = 'text' | 'voice' | 'photo';

export type StreakBoardState = {
  goodMorning: number;
  daresCompleted: number;
  calls: number;
  notesSent: number;
  snaps: number;
};

export type RitualsPersist = {
  dareStreak: number;
  streakBoard: StreakBoardState;
  partnerQ: string;
  nightNote: string;
  nightSaved: boolean;
  nightNoteFormat: NoteFormat;
  nightMediaUrl: string | null;
  updatedAt: number;
};

function scrubNightMediaForRemote(url: string | null): string | null {
  return url && /^https?:\/\//i.test(url) ? url : null;
}

function ritualsSig(p: Omit<RitualsPersist, 'updatedAt'>) {
  return JSON.stringify({
    dareStreak: p.dareStreak,
    streakBoard: p.streakBoard,
    partnerQ: p.partnerQ,
    nightNote: p.nightNote,
    nightSaved: p.nightSaved,
    nightNoteFormat: p.nightNoteFormat,
    nightMediaUrl: scrubNightMediaForRemote(p.nightMediaUrl),
  });
}

function parseNoteFormat(v: unknown): NoteFormat {
  /** Legacy `sketch` pins: treat as photo so existing image URLs still display. */
  if (v === 'sketch') return 'photo';
  return v === 'voice' || v === 'photo' || v === 'text' ? v : 'text';
}

type SaveRitualsPatch = Partial<{
  dareStreak: number;
  streakBoard: StreakBoardState;
  partnerQ: string;
  nightNote: string;
  nightSaved: boolean;
  nightNoteFormat: NoteFormat;
  nightMediaUrl: string | null;
}>;

type RitualsContextValue = {
  partnerName: string;
  coupleMode: CoupleMode;
  setCoupleMode: (m: CoupleMode) => void;
  dareTier: DareTierKind;
  setDareTier: (t: DareTierKind) => void;
  currentDare: string;
  setCurrentDare: (s: string) => void;
  nextDare: () => void;
  currentQotd: string;
  setCurrentQotd: (s: string) => void;
  nextQotd: () => void;
  dareDone: boolean;
  setDareDone: (v: boolean) => void;
  dareStreak: number;
  setDareStreak: React.Dispatch<React.SetStateAction<number>>;
  myQ: string;
  setMyQ: (s: string) => void;
  partnerQ: string;
  setPartnerQ: (s: string) => void;
  noteFormat: NoteFormat;
  setNoteFormat: (f: NoteFormat) => void;
  nightNote: string;
  setNightNote: (s: string) => void;
  nightSaved: boolean;
  setNightSaved: (v: boolean) => void;
  nightMediaUri: string | null;
  setNightMediaUri: (u: string | null) => void;
  nightMediaUrl: string | null;
  setNightMediaUrl: (u: string | null) => void;
  streakBoard: StreakBoardState;
  setStreakBoard: React.Dispatch<React.SetStateAction<StreakBoardState>>;
  saveRitualsState: (next?: SaveRitualsPatch) => Promise<void>;
};

const defaultBoard: StreakBoardState = {
  goodMorning: 0,
  daresCompleted: 0,
  calls: 0,
  notesSent: 0,
  snaps: 0,
};

const RitualsContext = createContext<RitualsContextValue | null>(null);

export function RitualsProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { coupleCode, partnerName, coupleMode, setCoupleMode, coupleMembershipReady } = usePairing();
  const [dareTier, setDareTier] = useState<DareTierKind>('rotation');
  const [currentDare, setCurrentDare] = useState<string>(() => randomDare('together', 'rotation') ?? '');
  const [currentQotd, setCurrentQotd] = useState<string>(() => randomQotd('together') ?? '');
  const [dareDone, setDareDone] = useState(false);
  const [dareStreak, setDareStreak] = useState(0);
  const [myQ, setMyQ] = useState('');
  const [partnerQ, setPartnerQ] = useState('');
  const [noteFormat, setNoteFormat] = useState<NoteFormat>('text');
  const [nightNote, setNightNote] = useState('');
  const [nightSaved, setNightSaved] = useState(false);
  const [nightMediaUri, setNightMediaUri] = useState<string | null>(null);
  const [nightMediaUrl, setNightMediaUrl] = useState<string | null>(null);
  const [streakBoard, setStreakBoard] = useState<StreakBoardState>(defaultBoard);
  const [hydrated, setHydrated] = useState(false);
  const lastRemoteSigRef = useRef('');
  const ritualsDocRef = useMemo(
    () => (coupleCode ? doc(firebaseDb, 'couples', coupleCode, 'state', 'rituals') : null),
    [coupleCode]
  );

  useEffect(() => {
    setCurrentDare(randomDare(coupleMode, dareTier) ?? '');
  }, [coupleMode, dareTier]);

  useEffect(() => {
    setCurrentQotd(randomQotd(coupleMode) ?? '');
  }, [coupleMode]);

  const buildPersist = useCallback(
    (overrides?: Partial<RitualsPersist>): RitualsPersist => ({
      dareStreak: overrides?.dareStreak ?? dareStreak,
      streakBoard: overrides?.streakBoard ?? streakBoard,
      partnerQ: overrides?.partnerQ ?? partnerQ,
      nightNote: overrides?.nightNote ?? nightNote,
      nightSaved: overrides?.nightSaved ?? nightSaved,
      nightNoteFormat: overrides?.nightNoteFormat ?? noteFormat,
      nightMediaUrl: overrides?.nightMediaUrl !== undefined ? overrides.nightMediaUrl : nightMediaUrl,
      updatedAt: overrides?.updatedAt ?? Date.now(),
    }),
    [dareStreak, streakBoard, partnerQ, nightNote, nightSaved, noteFormat, nightMediaUrl]
  );

  const persistRitualsData = useCallback(
    async (data: RitualsPersist) => {
      if (!coupleCode) return;
      const forRemote = {
        dareStreak: data.dareStreak,
        streakBoard: data.streakBoard,
        partnerQ: data.partnerQ,
        nightNote: data.nightNote,
        nightSaved: data.nightSaved,
        nightNoteFormat: data.nightNoteFormat,
        nightMediaUrl: scrubNightMediaForRemote(data.nightMediaUrl),
        updatedAt: data.updatedAt,
      };
      lastRemoteSigRef.current = ritualsSig({
        dareStreak: data.dareStreak,
        streakBoard: data.streakBoard,
        partnerQ: data.partnerQ,
        nightNote: data.nightNote,
        nightSaved: data.nightSaved,
        nightNoteFormat: data.nightNoteFormat,
        nightMediaUrl: forRemote.nightMediaUrl,
      });
      if (ENABLE_RITUALS_FIRESTORE_SYNC && ritualsDocRef && user) {
        await setDoc(ritualsDocRef, omitUndefinedDeep(forRemote), { merge: true });
      } else {
        await AsyncStorage.setItem(`rituals:${coupleCode}`, JSON.stringify(data));
      }
    },
    [coupleCode, ritualsDocRef, user]
  );

  const saveRitualsState = useCallback(
    async (next?: SaveRitualsPatch) => {
      const data = buildPersist({
        dareStreak: next?.dareStreak,
        streakBoard: next?.streakBoard,
        partnerQ: next?.partnerQ,
        nightNote: next?.nightNote,
        nightSaved: next?.nightSaved,
        nightNoteFormat: next?.nightNoteFormat,
        nightMediaUrl: next?.nightMediaUrl !== undefined ? next.nightMediaUrl : undefined,
        updatedAt: Date.now(),
      });
      await persistRitualsData(data);
    },
    [buildPersist, persistRitualsData]
  );

  useEffect(() => {
    if (!coupleCode) return;
    if (ENABLE_RITUALS_FIRESTORE_SYNC && coupleCode && user && ritualsDocRef) return;
    let cancelled = false;
    (async () => {
      const raw = await AsyncStorage.getItem(`rituals:${coupleCode}`);
      if (!raw || cancelled) return;
      const parsed = JSON.parse(raw);
      setDareStreak(parsed.dareStreak ?? 0);
      setStreakBoard(parsed.streakBoard ?? defaultBoard);
      setPartnerQ(parsed.partnerQ ?? '');
      setNightNote(parsed.nightNote ?? '');
      setNightSaved(!!parsed.nightSaved);
      setNoteFormat(parseNoteFormat(parsed.nightNoteFormat));
      setNightMediaUrl(typeof parsed.nightMediaUrl === 'string' ? parsed.nightMediaUrl : null);
      setHydrated(true);
    })().catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [coupleCode, user, ritualsDocRef]);

  useEffect(() => {
    if (!ENABLE_RITUALS_FIRESTORE_SYNC) return;
    if (!coupleCode || !user || !ritualsDocRef || !coupleMembershipReady) return;
    setHydrated(false);
    const unsub = onSnapshot(
      ritualsDocRef,
      (snap) => {
        const x = snap.data() as Record<string, unknown> | undefined;
        if (!x) {
          setHydrated(true);
          return;
        }
        const remotePayload = {
          dareStreak: (x.dareStreak as number) ?? 0,
          streakBoard: (x.streakBoard as StreakBoardState) ?? defaultBoard,
          partnerQ: (x.partnerQ as string) ?? '',
          nightNote: (x.nightNote as string) ?? '',
          nightSaved: !!x.nightSaved,
          nightNoteFormat: parseNoteFormat(x.nightNoteFormat),
          nightMediaUrl:
            typeof x.nightMediaUrl === 'string' && /^https?:\/\//i.test(x.nightMediaUrl)
              ? x.nightMediaUrl
              : null,
        };
        lastRemoteSigRef.current = ritualsSig({
          dareStreak: remotePayload.dareStreak,
          streakBoard: remotePayload.streakBoard,
          partnerQ: remotePayload.partnerQ,
          nightNote: remotePayload.nightNote,
          nightSaved: remotePayload.nightSaved,
          nightNoteFormat: remotePayload.nightNoteFormat,
          nightMediaUrl: remotePayload.nightMediaUrl,
        });
        setDareStreak((prev) => (prev === remotePayload.dareStreak ? prev : remotePayload.dareStreak));
        setStreakBoard((prev) =>
          JSON.stringify(prev) === JSON.stringify(remotePayload.streakBoard) ? prev : remotePayload.streakBoard
        );
        setPartnerQ((prev) => (prev === remotePayload.partnerQ ? prev : remotePayload.partnerQ));
        setNightNote((prev) => (prev === remotePayload.nightNote ? prev : remotePayload.nightNote));
        setNightSaved((prev) => (prev === remotePayload.nightSaved ? prev : remotePayload.nightSaved));
        setNoteFormat((prev) =>
          prev === remotePayload.nightNoteFormat ? prev : remotePayload.nightNoteFormat
        );
        setNightMediaUrl((prev) =>
          prev === remotePayload.nightMediaUrl ? prev : remotePayload.nightMediaUrl
        );
        setNightMediaUri(null);
        setHydrated(true);
      },
      () => setHydrated(true)
    );
    return () => unsub();
  }, [coupleCode, user, ritualsDocRef, coupleMembershipReady]);

  useEffect(() => {
    if (!coupleCode || !hydrated) return;
    const data = buildPersist({ updatedAt: Date.now() });
    if (ENABLE_RITUALS_FIRESTORE_SYNC && coupleCode && user && ritualsDocRef && coupleMembershipReady) {
      const sig = ritualsSig({
        dareStreak: data.dareStreak,
        streakBoard: data.streakBoard,
        partnerQ: data.partnerQ,
        nightNote: data.nightNote,
        nightSaved: data.nightSaved,
        nightNoteFormat: data.nightNoteFormat,
        nightMediaUrl: scrubNightMediaForRemote(data.nightMediaUrl),
      });
      if (sig === lastRemoteSigRef.current) return;
      const timer = setTimeout(() => {
        lastRemoteSigRef.current = sig;
        const forRemote = {
          dareStreak: data.dareStreak,
          streakBoard: data.streakBoard,
          partnerQ: data.partnerQ,
          nightNote: data.nightNote,
          nightSaved: data.nightSaved,
          nightNoteFormat: data.nightNoteFormat,
          nightMediaUrl: scrubNightMediaForRemote(data.nightMediaUrl),
          updatedAt: Date.now(),
        };
        setDoc(ritualsDocRef, omitUndefinedDeep(forRemote), { merge: true }).catch(() => {});
      }, 900);
      return () => clearTimeout(timer);
    }
    AsyncStorage.setItem(`rituals:${coupleCode}`, JSON.stringify(data)).catch(() => {});
  }, [
    coupleCode,
    hydrated,
    dareStreak,
    streakBoard,
    partnerQ,
    nightNote,
    nightSaved,
    noteFormat,
    nightMediaUrl,
    user,
    ritualsDocRef,
    coupleMembershipReady,
    buildPersist,
  ]);

  const nextDare = useCallback(() => {
    setCurrentDare((prev) => randomDare(coupleMode, dareTier, prev) ?? '');
  }, [coupleMode, dareTier]);

  const nextQotd = useCallback(() => {
    setCurrentQotd((prev) => randomQotd(coupleMode, prev) ?? '');
  }, [coupleMode]);

  const value = useMemo<RitualsContextValue>(
    () => ({
      partnerName,
      coupleMode,
      setCoupleMode,
      dareTier,
      setDareTier,
      currentDare,
      setCurrentDare,
      nextDare,
      currentQotd,
      setCurrentQotd,
      nextQotd,
      dareDone,
      setDareDone,
      dareStreak,
      setDareStreak,
      myQ,
      setMyQ,
      partnerQ,
      setPartnerQ,
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
    }),
    [
      partnerName,
      coupleMode,
      setCoupleMode,
      dareTier,
      currentDare,
      nextDare,
      currentQotd,
      nextQotd,
      dareDone,
      dareStreak,
      myQ,
      partnerQ,
      noteFormat,
      nightNote,
      nightSaved,
      nightMediaUri,
      nightMediaUrl,
      streakBoard,
      saveRitualsState,
    ]
  );

  return <RitualsContext.Provider value={value}>{children}</RitualsContext.Provider>;
}

export function useRituals() {
  const ctx = useContext(RitualsContext);
  if (!ctx) throw new Error('useRituals must be used within RitualsProvider');
  return ctx;
}
