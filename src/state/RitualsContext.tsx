import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { doc, onSnapshot, setDoc, updateDoc } from 'firebase/firestore';

import { deferFirestoreUnsubscribe } from '../config/deferFirestoreUnsubscribe';
import { firebaseDb } from '../config/firebase';
import { FIRESTORE_SYNC_FLAGS } from '../config/firestoreSyncFlags';
import type { CoupleMode, WeekBand } from '../data/dailyDares';
import { syncedDailyDareText } from '../data/dailyDares';
import { isValidQotdTopicId, syncedTopicQuestion, topicPoolLength } from '../data/qotdTopics';
import { omitUndefinedDeep } from '../utils/sanitizeFirestore';
import { utcCalendarDateKey } from '../utils/ritualDeterminism';
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
  /** @deprecated Legacy single field; synced answers use `qotdAnswers`. */
  partnerQ: string;
  qotdAnswers: Record<string, string>;
  qotdDateKey: string | null;
  /** Topic chosen for the current UTC question day (shared couple lock). */
  qotdActiveTopicId: string | null;
  qotdTopicLockDayKey: string | null;
  /** Times you completed a QOTD answer for that topic (first save of a UTC day). */
  qotdTopicProgress: Record<string, number>;
  /** Per-user topic for `qotdTopicLockDayKey` (UTC day). */
  qotdTopicByUid: Record<string, string>;
  /** Per-user answer on partner’s topic when you picked different topics. */
  qotdMirrorAnswers: Record<string, string>;
  dareDoneByUid: Record<string, boolean>;
  dareDoneDayKey: string | null;
  nightNote: string;
  nightSaved: boolean;
  nightNoteFormat: NoteFormat;
  nightMediaUrl: string | null;
  updatedAt: number;
};

function scrubNightMediaForRemote(url: string | null): string | null {
  return url && /^https?:\/\//i.test(url) ? url : null;
}

function parseStringMap(v: unknown): Record<string, string> {
  if (!v || typeof v !== 'object') return {};
  const out: Record<string, string> = {};
  for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
    if (typeof val === 'string' && val.length <= 8000) out[k] = val;
  }
  return out;
}

function parseBoolMap(v: unknown): Record<string, boolean> {
  if (!v || typeof v !== 'object') return {};
  const out: Record<string, boolean> = {};
  for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
    if (val === true || val === 1 || val === '1' || val === 'true') out[k] = true;
  }
  return out;
}

function parseNumberMap(v: unknown): Record<string, number> {
  if (!v || typeof v !== 'object') return {};
  const out: Record<string, number> = {};
  for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
    if (typeof k !== 'string' || k.length > 64) continue;
    if (typeof val === 'number' && Number.isFinite(val)) out[k] = Math.max(0, Math.floor(val));
    else if (typeof val === 'string' && /^\d+$/.test(val)) out[k] = Math.max(0, parseInt(val, 10));
  }
  return out;
}

/** uid → QOTD topic id for the day keyed by `qotdTopicLockDayKey`. */
function parseQotdTopicByUidMap(v: unknown): Record<string, string> {
  if (!v || typeof v !== 'object') return {};
  const out: Record<string, string> = {};
  for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
    if (typeof k !== 'string' || k.length < 8 || k.length > 128) continue;
    if (typeof val === 'string' && val.length <= 48 && isValidQotdTopicId(val)) out[k] = val;
  }
  return out;
}

function ritualsSig(p: Omit<RitualsPersist, 'updatedAt'>) {
  const sortedQ = Object.keys(p.qotdAnswers)
    .sort()
    .map((k) => [k, p.qotdAnswers[k]])
    .flat()
    .join('\u0001');
  const sortedD = Object.keys(p.dareDoneByUid)
    .sort()
    .map((k) => [k, p.dareDoneByUid[k] ? '1' : '0'])
    .join('\u0001');
  const sortedTp = Object.keys(p.qotdTopicProgress)
    .sort()
    .map((k) => [k, p.qotdTopicProgress[k]])
    .flat()
    .join('\u0001');
  const sortedTbu = Object.keys(p.qotdTopicByUid)
    .sort()
    .map((k) => [k, p.qotdTopicByUid[k]])
    .flat()
    .join('\u0001');
  const sortedMir = Object.keys(p.qotdMirrorAnswers)
    .sort()
    .map((k) => [k, p.qotdMirrorAnswers[k]])
    .flat()
    .join('\u0001');
  return JSON.stringify({
    dareStreak: p.dareStreak,
    streakBoard: p.streakBoard,
    partnerQ: p.partnerQ,
    sortedQ,
    qotdDateKey: p.qotdDateKey,
    qotdActiveTopicId: p.qotdActiveTopicId,
    qotdTopicLockDayKey: p.qotdTopicLockDayKey,
    sortedTp,
    sortedTbu,
    sortedMir,
    sortedD,
    dareDoneDayKey: p.dareDoneDayKey,
    nightNote: p.nightNote,
    nightSaved: p.nightSaved,
    nightNoteFormat: p.nightNoteFormat,
    nightMediaUrl: scrubNightMediaForRemote(p.nightMediaUrl),
  });
}

function parseNoteFormat(v: unknown): NoteFormat {
  if (v === 'sketch') return 'photo';
  return v === 'voice' || v === 'photo' || v === 'text' ? v : 'text';
}

type SaveRitualsPatch = Partial<{
  dareStreak: number;
  streakBoard: StreakBoardState;
  partnerQ: string;
  qotdAnswers: Record<string, string>;
  qotdDateKey: string | null;
  qotdActiveTopicId: string | null;
  qotdTopicLockDayKey: string | null;
  qotdTopicProgress: Record<string, number>;
  qotdTopicByUid: Record<string, string>;
  qotdMirrorAnswers: Record<string, string>;
  dareDoneByUid: Record<string, boolean>;
  dareDoneDayKey: string | null;
  nightNote: string;
  nightSaved: boolean;
  nightNoteFormat: NoteFormat;
  nightMediaUrl: string | null;
}>;

type RitualsContextValue = {
  partnerName: string;
  partnerUid: string | null;
  coupleMode: CoupleMode;
  setCoupleMode: (m: CoupleMode) => void;
  /** UTC `YYYY-MM-DD` for the synced dare + question. */
  ritualDayKey: string;
  dareBand: WeekBand;
  currentDare: string;
  /** Your QOTD topic for today (per-user; falls back to legacy shared lock). */
  qotdLockedTopicId: string | null;
  /** Partner’s topic for today when set (may match yours). */
  partnerQotdTopicId: string | null;
  /** You each picked a different topic — answer both prompts to unlock the cross reveal. */
  qotdCrossTopic: boolean;
  currentQotd: string;
  confirmQotdTopic: (topicId: string) => Promise<'ok' | 'auth' | 'invalid'>;
  /** 0–100 for hub progress rings. */
  qotdTopicProgressPercent: (topicId: string) => number;
  /** You finished today's dare (same UTC day as `dareDoneDayKey`). */
  dareDone: boolean;
  partnerDareDone: boolean;
  markDareComplete: () => Promise<void>;
  dareStreak: number;
  setDareStreak: React.Dispatch<React.SetStateAction<number>>;
  myQ: string;
  setMyQ: (s: string) => void;
  /** Partner's saved answer on their own topic (when synced). */
  partnerAnswer: string;
  /** Partner’s answer on *your* topic (when topics differ). */
  partnerMirrorAnswer: string;
  /** Your last saved answer for today's UTC question day (empty until you save today). */
  mySavedQotd: string;
  /** Your saved answer on your partner’s topic (cross-topic). */
  myMirrorSavedQotd: string;
  qotdDateKey: string | null;
  saveMyQotdAnswer: (text: string, topicOverride?: string | null) => Promise<void>;
  saveMirrorQotdAnswer: (text: string) => Promise<void>;
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

const emptyQotd: Record<string, string> = {};
const emptyDareDone: Record<string, boolean> = {};
const emptyTopicProgress: Record<string, number> = {};
const emptyTopicByUid: Record<string, string> = {};
const emptyMirrorAnswers: Record<string, string> = {};

const RitualsContext = createContext<RitualsContextValue | null>(null);

export function RitualsProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const {
    coupleCode,
    partnerName,
    partnerUid,
    coupleMode,
    setCoupleMode,
    coupleMembershipReady,
  } = usePairing();
  const myUid = user?.uid ?? null;

  const [ritualUtcDayKey, setRitualUtcDayKey] = useState(() => utcCalendarDateKey());
  const [qotdAnswers, setQotdAnswers] = useState<Record<string, string>>(emptyQotd);
  const [qotdDateKey, setQotdDateKey] = useState<string | null>(null);
  const [qotdActiveTopicId, setQotdActiveTopicId] = useState<string | null>(null);
  const [qotdTopicLockDayKey, setQotdTopicLockDayKey] = useState<string | null>(null);
  const [qotdTopicProgress, setQotdTopicProgress] = useState<Record<string, number>>(emptyTopicProgress);
  const [qotdTopicByUid, setQotdTopicByUid] = useState<Record<string, string>>(emptyTopicByUid);
  const [qotdMirrorAnswers, setQotdMirrorAnswers] = useState<Record<string, string>>(emptyMirrorAnswers);
  const [dareDoneByUid, setDareDoneByUid] = useState<Record<string, boolean>>(emptyDareDone);
  const [dareDoneDayKey, setDareDoneDayKey] = useState<string | null>(null);
  const dareDoneByUidRef = useRef(dareDoneByUid);
  const dareDoneDayKeyRef = useRef(dareDoneDayKey);
  dareDoneByUidRef.current = dareDoneByUid;
  dareDoneDayKeyRef.current = dareDoneDayKey;
  const [dareStreak, setDareStreak] = useState(0);
  const [myQ, setMyQ] = useState('');
  const [legacyPartnerQ, setLegacyPartnerQ] = useState('');
  const [noteFormat, setNoteFormat] = useState<NoteFormat>('text');
  const [nightNote, setNightNote] = useState('');
  const [nightSaved, setNightSaved] = useState(false);
  const [nightMediaUri, setNightMediaUri] = useState<string | null>(null);
  const [nightMediaUrl, setNightMediaUrl] = useState<string | null>(null);
  const [streakBoard, setStreakBoard] = useState<StreakBoardState>(defaultBoard);
  const [hydrated, setHydrated] = useState(false);
  const lastRemoteSigRef = useRef('');
  /** Ignore Firestore snapshots older than our last outbound rituals write (stale cache / ordering). */
  const lastLocalRitualsWriteMsRef = useRef(0);
  const ritualUtcDayKeyRef = useRef(ritualUtcDayKey);
  const myUidRef = useRef(myUid);
  const qotdTopicLockDayKeyRef = useRef(qotdTopicLockDayKey);
  const qotdActiveTopicIdRef = useRef(qotdActiveTopicId);
  const qotdTopicByUidRef = useRef(qotdTopicByUid);
  ritualUtcDayKeyRef.current = ritualUtcDayKey;
  myUidRef.current = myUid;
  qotdTopicLockDayKeyRef.current = qotdTopicLockDayKey;
  qotdActiveTopicIdRef.current = qotdActiveTopicId;
  qotdTopicByUidRef.current = qotdTopicByUid;
  const ritualsDocRef = useMemo(
    () => (coupleCode ? doc(firebaseDb, 'couples', coupleCode, 'state', 'rituals') : null),
    [coupleCode],
  );

  useEffect(() => {
    const id = setInterval(() => {
      const k = utcCalendarDateKey();
      setRitualUtcDayKey((prev) => (prev !== k ? k : prev));
    }, 45_000);
    return () => clearInterval(id);
  }, []);

  const dareSync = useMemo(
    () => syncedDailyDareText(coupleMode, coupleCode, ritualUtcDayKey),
    [coupleMode, coupleCode, ritualUtcDayKey],
  );
  const currentDare = dareSync.text;
  const dareBand = dareSync.band;

  const qotdLockedTopicId = useMemo(() => {
    if (qotdTopicLockDayKey !== ritualUtcDayKey) return null;
    if (myUid) {
      const mine = qotdTopicByUid[myUid];
      if (mine && isValidQotdTopicId(mine)) return mine;
    }
    if (qotdActiveTopicId && isValidQotdTopicId(qotdActiveTopicId)) return qotdActiveTopicId;
    return null;
  }, [qotdTopicLockDayKey, ritualUtcDayKey, qotdActiveTopicId, qotdTopicByUid, myUid]);

  const partnerQotdTopicId = useMemo(() => {
    if (qotdTopicLockDayKey !== ritualUtcDayKey || !partnerUid) return null;
    const theirs = qotdTopicByUid[partnerUid];
    if (theirs && isValidQotdTopicId(theirs)) return theirs;
    if (qotdActiveTopicId && isValidQotdTopicId(qotdActiveTopicId)) return qotdActiveTopicId;
    return null;
  }, [qotdTopicLockDayKey, ritualUtcDayKey, partnerUid, qotdTopicByUid, qotdActiveTopicId]);

  const qotdCrossTopic = useMemo(
    () =>
      !!(
        partnerUid &&
        qotdLockedTopicId &&
        partnerQotdTopicId &&
        qotdLockedTopicId !== partnerQotdTopicId
      ),
    [partnerUid, qotdLockedTopicId, partnerQotdTopicId],
  );

  const currentQotd = useMemo(() => {
    const syncKey = coupleCode?.trim() || myUid || '';
    if (!syncKey) {
      return 'Sign in and (optionally) pair to sync the same question of the day.';
    }
    if (!qotdLockedTopicId) {
      return '';
    }
    return syncedTopicQuestion(qotdLockedTopicId, syncKey, ritualUtcDayKey);
  }, [coupleCode, myUid, qotdLockedTopicId, ritualUtcDayKey]);

  const qotdTopicProgressPercent = useCallback(
    (topicId: string) => {
      const n = topicPoolLength(topicId);
      if (n <= 0) return 0;
      const c = qotdTopicProgress[topicId] ?? 0;
      return Math.min(100, Math.round((c / n) * 100));
    },
    [qotdTopicProgress],
  );

  const partnerAnswer = useMemo(() => {
    if (qotdDateKey !== ritualUtcDayKey || !partnerUid) return '';
    return qotdAnswers[partnerUid]?.trim() ?? '';
  }, [qotdAnswers, partnerUid, qotdDateKey, ritualUtcDayKey]);

  const mySavedQotd = useMemo(() => {
    if (!myUid || qotdDateKey !== ritualUtcDayKey) return '';
    return (qotdAnswers[myUid] ?? '').trim();
  }, [myUid, qotdDateKey, ritualUtcDayKey, qotdAnswers]);

  const partnerMirrorAnswer = useMemo(() => {
    if (qotdDateKey !== ritualUtcDayKey || !partnerUid) return '';
    return qotdMirrorAnswers[partnerUid]?.trim() ?? '';
  }, [qotdMirrorAnswers, partnerUid, qotdDateKey, ritualUtcDayKey]);

  const myMirrorSavedQotd = useMemo(() => {
    if (!myUid || qotdDateKey !== ritualUtcDayKey) return '';
    return (qotdMirrorAnswers[myUid] ?? '').trim();
  }, [myUid, qotdDateKey, ritualUtcDayKey, qotdMirrorAnswers]);

  const dareDone = useMemo(() => {
    if (!myUid || dareDoneDayKey !== ritualUtcDayKey) return false;
    return !!dareDoneByUid[myUid];
  }, [myUid, dareDoneByUid, dareDoneDayKey, ritualUtcDayKey]);

  const partnerDareDone = useMemo(() => {
    if (!partnerUid || dareDoneDayKey !== ritualUtcDayKey) return false;
    return !!dareDoneByUid[partnerUid];
  }, [partnerUid, dareDoneByUid, dareDoneDayKey, ritualUtcDayKey]);

  useEffect(() => {
    if (!myUid) return;
    const mine = qotdDateKey === ritualUtcDayKey ? (qotdAnswers[myUid] ?? '') : '';
    setMyQ((prev) => (prev === mine ? prev : mine));
  }, [myUid, qotdAnswers, qotdDateKey, ritualUtcDayKey]);

  const buildPersist = useCallback(
    (overrides?: Partial<RitualsPersist>): RitualsPersist => ({
      dareStreak: overrides?.dareStreak ?? dareStreak,
      streakBoard: overrides?.streakBoard ?? streakBoard,
      partnerQ: overrides?.partnerQ ?? legacyPartnerQ,
      qotdAnswers: overrides?.qotdAnswers ?? qotdAnswers,
      qotdDateKey: overrides?.qotdDateKey !== undefined ? overrides.qotdDateKey : qotdDateKey,
      qotdActiveTopicId:
        overrides?.qotdActiveTopicId !== undefined ? overrides.qotdActiveTopicId : qotdActiveTopicId,
      qotdTopicLockDayKey:
        overrides?.qotdTopicLockDayKey !== undefined ? overrides.qotdTopicLockDayKey : qotdTopicLockDayKey,
      qotdTopicProgress: overrides?.qotdTopicProgress ?? qotdTopicProgress,
      qotdTopicByUid: overrides?.qotdTopicByUid ?? qotdTopicByUid,
      qotdMirrorAnswers: overrides?.qotdMirrorAnswers ?? qotdMirrorAnswers,
      dareDoneByUid: overrides?.dareDoneByUid ?? dareDoneByUid,
      dareDoneDayKey: overrides?.dareDoneDayKey !== undefined ? overrides.dareDoneDayKey : dareDoneDayKey,
      nightNote: overrides?.nightNote ?? nightNote,
      nightSaved: overrides?.nightSaved ?? nightSaved,
      nightNoteFormat: overrides?.nightNoteFormat ?? noteFormat,
      nightMediaUrl: overrides?.nightMediaUrl !== undefined ? overrides.nightMediaUrl : nightMediaUrl,
      updatedAt: overrides?.updatedAt ?? Date.now(),
    }),
    [
      dareStreak,
      streakBoard,
      legacyPartnerQ,
      qotdAnswers,
      qotdDateKey,
      qotdActiveTopicId,
      qotdTopicLockDayKey,
      qotdTopicProgress,
      qotdTopicByUid,
      qotdMirrorAnswers,
      dareDoneByUid,
      dareDoneDayKey,
      nightNote,
      nightSaved,
      noteFormat,
      nightMediaUrl,
    ],
  );

  const persistRitualsData = useCallback(
    async (data: RitualsPersist) => {
      lastLocalRitualsWriteMsRef.current = Date.now();
      if (!coupleCode?.trim()) {
        if (user?.uid) {
          await AsyncStorage.setItem(`rituals:local:${user.uid}`, JSON.stringify(data));
          lastRemoteSigRef.current = ritualsSig({
            dareStreak: data.dareStreak,
            streakBoard: data.streakBoard,
            partnerQ: data.partnerQ,
            qotdAnswers: data.qotdAnswers,
            qotdDateKey: data.qotdDateKey,
            qotdActiveTopicId: data.qotdActiveTopicId,
            qotdTopicLockDayKey: data.qotdTopicLockDayKey,
            qotdTopicProgress: data.qotdTopicProgress,
            qotdTopicByUid: data.qotdTopicByUid,
            qotdMirrorAnswers: data.qotdMirrorAnswers,
            dareDoneByUid: data.dareDoneByUid,
            dareDoneDayKey: data.dareDoneDayKey,
            nightNote: data.nightNote,
            nightSaved: data.nightSaved,
            nightNoteFormat: data.nightNoteFormat,
            nightMediaUrl: scrubNightMediaForRemote(data.nightMediaUrl),
          });
        }
        return;
      }
      const forRemote = {
        dareStreak: data.dareStreak,
        streakBoard: data.streakBoard,
        partnerQ: data.partnerQ,
        qotdAnswers: data.qotdAnswers,
        qotdDateKey: data.qotdDateKey,
        qotdActiveTopicId: data.qotdActiveTopicId,
        qotdTopicLockDayKey: data.qotdTopicLockDayKey,
        qotdTopicProgress: data.qotdTopicProgress,
        qotdTopicByUid: data.qotdTopicByUid,
        qotdMirrorAnswers: data.qotdMirrorAnswers,
        dareDoneByUid: data.dareDoneByUid,
        dareDoneDayKey: data.dareDoneDayKey,
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
        qotdAnswers: data.qotdAnswers,
        qotdDateKey: data.qotdDateKey,
        qotdActiveTopicId: data.qotdActiveTopicId,
        qotdTopicLockDayKey: data.qotdTopicLockDayKey,
        qotdTopicProgress: data.qotdTopicProgress,
        qotdTopicByUid: data.qotdTopicByUid,
        qotdMirrorAnswers: data.qotdMirrorAnswers,
        dareDoneByUid: data.dareDoneByUid,
        dareDoneDayKey: data.dareDoneDayKey,
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
    [coupleCode, ritualsDocRef, user],
  );

  const saveRitualsState = useCallback(
    async (next?: SaveRitualsPatch) => {
      const data = buildPersist({
        dareStreak: next?.dareStreak,
        streakBoard: next?.streakBoard,
        partnerQ: next?.partnerQ,
        qotdAnswers: next?.qotdAnswers,
        qotdDateKey: next?.qotdDateKey,
        qotdActiveTopicId: next?.qotdActiveTopicId,
        qotdTopicLockDayKey: next?.qotdTopicLockDayKey,
        qotdTopicProgress: next?.qotdTopicProgress,
        qotdTopicByUid: next?.qotdTopicByUid,
        qotdMirrorAnswers: next?.qotdMirrorAnswers,
        dareDoneByUid: next?.dareDoneByUid,
        dareDoneDayKey: next?.dareDoneDayKey,
        nightNote: next?.nightNote,
        nightSaved: next?.nightSaved,
        nightNoteFormat: next?.nightNoteFormat,
        nightMediaUrl: next?.nightMediaUrl !== undefined ? next.nightMediaUrl : undefined,
        updatedAt: Date.now(),
      });
      await persistRitualsData(data);
    },
    [buildPersist, persistRitualsData],
  );

  const confirmQotdTopic = useCallback(
    async (topicId: string) => {
      if (!isValidQotdTopicId(topicId)) return 'invalid' as const;
      if (!myUid) return 'auth' as const;
      const nextTopics = { ...qotdTopicByUid, [myUid]: topicId };
      qotdActiveTopicIdRef.current = topicId;
      qotdTopicLockDayKeyRef.current = ritualUtcDayKey;
      qotdTopicByUidRef.current = nextTopics;
      setQotdTopicByUid(nextTopics);
      setQotdActiveTopicId(topicId);
      setQotdTopicLockDayKey(ritualUtcDayKey);

      if (!(ENABLE_RITUALS_FIRESTORE_SYNC && ritualsDocRef && user && coupleCode?.trim())) {
        await saveRitualsState({
          qotdTopicByUid: nextTopics,
          qotdActiveTopicId: topicId,
          qotdTopicLockDayKey: ritualUtcDayKey,
        });
        return 'ok' as const;
      }

      const updatedAt = Date.now();
      try {
        await updateDoc(
          ritualsDocRef,
          omitUndefinedDeep({
            [`qotdTopicByUid.${myUid}`]: topicId,
            qotdTopicLockDayKey: ritualUtcDayKey,
            qotdActiveTopicId: topicId,
            updatedAt,
          }),
        );
      } catch (e: unknown) {
        const code = typeof e === 'object' && e && 'code' in e ? String((e as { code?: string }).code) : '';
        if (code === 'not-found') {
          await persistRitualsData(
            buildPersist({
              qotdTopicByUid: nextTopics,
              qotdActiveTopicId: topicId,
              qotdTopicLockDayKey: ritualUtcDayKey,
              updatedAt,
            }),
          );
        } else {
          await saveRitualsState({
            qotdTopicByUid: nextTopics,
            qotdActiveTopicId: topicId,
            qotdTopicLockDayKey: ritualUtcDayKey,
          });
        }
        return 'ok' as const;
      }
      const data = buildPersist({
        qotdTopicByUid: nextTopics,
        qotdActiveTopicId: topicId,
        qotdTopicLockDayKey: ritualUtcDayKey,
        updatedAt,
      });
      lastRemoteSigRef.current = ritualsSig({
        dareStreak: data.dareStreak,
        streakBoard: data.streakBoard,
        partnerQ: data.partnerQ,
        qotdAnswers: data.qotdAnswers,
        qotdDateKey: data.qotdDateKey,
        qotdActiveTopicId: data.qotdActiveTopicId,
        qotdTopicLockDayKey: data.qotdTopicLockDayKey,
        qotdTopicProgress: data.qotdTopicProgress,
        qotdTopicByUid: data.qotdTopicByUid,
        qotdMirrorAnswers: data.qotdMirrorAnswers,
        dareDoneByUid: data.dareDoneByUid,
        dareDoneDayKey: data.dareDoneDayKey,
        nightNote: data.nightNote,
        nightSaved: data.nightSaved,
        nightNoteFormat: data.nightNoteFormat,
        nightMediaUrl: scrubNightMediaForRemote(data.nightMediaUrl),
      });
      return 'ok' as const;
    },
    [
      myUid,
      qotdTopicByUid,
      ritualUtcDayKey,
      ritualsDocRef,
      user,
      coupleCode,
      buildPersist,
      persistRitualsData,
      saveRitualsState,
    ],
  );

  const markDareComplete = useCallback(async () => {
    if (!myUid || dareDone) return;
    lastLocalRitualsWriteMsRef.current = Date.now();
    const day = ritualUtcDayKey;
    const wasNewUtcDay = dareDoneDayKey !== day;
    let nextMap = { ...dareDoneByUid };
    let nextDayKey = dareDoneDayKey;
    if (wasNewUtcDay) {
      nextMap = {};
      nextDayKey = day;
    }
    nextMap[myUid] = true;
    dareDoneByUidRef.current = nextMap;
    dareDoneDayKeyRef.current = nextDayKey;
    const partnerAlready = partnerUid ? !!nextMap[partnerUid] : false;
    let nextStreak = dareStreak;
    let nextBoard = streakBoard;
    if (partnerUid && partnerAlready) {
      nextStreak = dareStreak + 1;
      nextBoard = { ...streakBoard, daresCompleted: nextStreak };
    } else if (!partnerUid) {
      nextStreak = dareStreak + 1;
      nextBoard = { ...streakBoard, daresCompleted: nextStreak };
    }
    setDareDoneByUid(nextMap);
    setDareDoneDayKey(nextDayKey);
    if (nextStreak !== dareStreak) {
      setDareStreak(nextStreak);
      setStreakBoard(nextBoard);
    }

    const patchPersist: SaveRitualsPatch = {
      dareDoneByUid: nextMap,
      dareDoneDayKey: nextDayKey,
      dareStreak: nextStreak,
      streakBoard: nextBoard,
    };

    if (ENABLE_RITUALS_FIRESTORE_SYNC && ritualsDocRef && user) {
      const updatedAt = Date.now();
      const streakPatch = {
        dareStreak: nextStreak,
        streakBoard: nextBoard,
        dareDoneDayKey: nextDayKey,
        updatedAt,
      };
      try {
        if (wasNewUtcDay) {
          await updateDoc(
            ritualsDocRef,
            omitUndefinedDeep({
              dareDoneByUid: nextMap,
              ...streakPatch,
            }),
          );
        } else {
          await updateDoc(
            ritualsDocRef,
            omitUndefinedDeep({
              [`dareDoneByUid.${myUid}`]: true,
              ...streakPatch,
            }),
          );
        }
      } catch (e: unknown) {
        const code = typeof e === 'object' && e && 'code' in e ? String((e as { code?: string }).code) : '';
        if (code === 'not-found') {
          await persistRitualsData(buildPersist({ ...patchPersist, updatedAt }));
        } else {
          await saveRitualsState(patchPersist);
        }
        return;
      }
      const data = buildPersist({ ...patchPersist, updatedAt });
      lastRemoteSigRef.current = ritualsSig({
        dareStreak: data.dareStreak,
        streakBoard: data.streakBoard,
        partnerQ: data.partnerQ,
        qotdAnswers: data.qotdAnswers,
        qotdDateKey: data.qotdDateKey,
        qotdActiveTopicId: data.qotdActiveTopicId,
        qotdTopicLockDayKey: data.qotdTopicLockDayKey,
        qotdTopicProgress: data.qotdTopicProgress,
        qotdTopicByUid: data.qotdTopicByUid,
        qotdMirrorAnswers: data.qotdMirrorAnswers,
        dareDoneByUid: data.dareDoneByUid,
        dareDoneDayKey: data.dareDoneDayKey,
        nightNote: data.nightNote,
        nightSaved: data.nightSaved,
        nightNoteFormat: data.nightNoteFormat,
        nightMediaUrl: scrubNightMediaForRemote(data.nightMediaUrl),
      });
      return;
    }

    await saveRitualsState(patchPersist);
  }, [
    myUid,
    dareDone,
    ritualUtcDayKey,
    dareDoneByUid,
    dareDoneDayKey,
    partnerUid,
    dareStreak,
    streakBoard,
    saveRitualsState,
    buildPersist,
    persistRitualsData,
    ritualsDocRef,
    user,
  ]);

  const saveMyQotdAnswer = useCallback(
    async (text: string, topicOverride?: string | null) => {
      if (!myUid) return;
      const trimmed = text.trim();
      const overrideTid =
        topicOverride && isValidQotdTopicId(topicOverride) ? topicOverride : null;
      const mineFromMap =
        qotdTopicLockDayKey === ritualUtcDayKey && qotdTopicByUid[myUid] && isValidQotdTopicId(qotdTopicByUid[myUid]!)
          ? qotdTopicByUid[myUid]!
          : null;
      const locked = qotdTopicLockDayKey === ritualUtcDayKey ? qotdActiveTopicId : null;
      const lockedValid = locked && isValidQotdTopicId(locked) ? locked : null;
      const tid = mineFromMap ?? lockedValid ?? overrideTid ?? null;
      if (trimmed && !tid) return;

      const hadMineToday = qotdDateKey === ritualUtcDayKey && !!(qotdAnswers[myUid]?.trim());

      const nextAnswers = { ...qotdAnswers };
      if (trimmed) nextAnswers[myUid] = trimmed;
      else delete nextAnswers[myUid];

      let nextTopicByUid = qotdTopicByUid;
      if (trimmed && tid) {
        nextTopicByUid = { ...qotdTopicByUid, [myUid]: tid };
        if (JSON.stringify(nextTopicByUid) !== JSON.stringify(qotdTopicByUid)) {
          qotdTopicByUidRef.current = nextTopicByUid;
          setQotdTopicByUid(nextTopicByUid);
        }
      }

      const shouldPersistLegacyLock =
        trimmed &&
        !!tid &&
        (qotdTopicLockDayKey !== ritualUtcDayKey || !qotdActiveTopicId || qotdActiveTopicId !== tid);
      if (shouldPersistLegacyLock && tid) {
        qotdActiveTopicIdRef.current = tid;
        qotdTopicLockDayKeyRef.current = ritualUtcDayKey;
        setQotdActiveTopicId(tid);
        setQotdTopicLockDayKey(ritualUtcDayKey);
      }

      let nextProgress = qotdTopicProgress;
      if (trimmed && tid && !hadMineToday) {
        nextProgress = { ...qotdTopicProgress, [tid]: (qotdTopicProgress[tid] ?? 0) + 1 };
        setQotdTopicProgress(nextProgress);
      }

      setQotdAnswers(nextAnswers);
      setQotdDateKey(ritualUtcDayKey);
      setMyQ(trimmed);
      await saveRitualsState({
        qotdAnswers: nextAnswers,
        qotdDateKey: ritualUtcDayKey,
        qotdTopicProgress: nextProgress,
        qotdTopicByUid: nextTopicByUid,
        ...(shouldPersistLegacyLock && tid
          ? { qotdActiveTopicId: tid, qotdTopicLockDayKey: ritualUtcDayKey }
          : {}),
      });
    },
    [
      myUid,
      qotdTopicLockDayKey,
      qotdActiveTopicId,
      ritualUtcDayKey,
      qotdDateKey,
      qotdAnswers,
      qotdTopicProgress,
      qotdTopicByUid,
      saveRitualsState,
    ],
  );

  const saveMirrorQotdAnswer = useCallback(
    async (text: string) => {
      if (!myUid || !partnerUid) return;
      if (qotdTopicLockDayKey !== ritualUtcDayKey) return;
      const myT =
        qotdTopicByUid[myUid] && isValidQotdTopicId(qotdTopicByUid[myUid]!) ? qotdTopicByUid[myUid]! : null;
      const partnerT =
        qotdTopicByUid[partnerUid] && isValidQotdTopicId(qotdTopicByUid[partnerUid]!)
          ? qotdTopicByUid[partnerUid]!
          : qotdActiveTopicId && isValidQotdTopicId(qotdActiveTopicId)
            ? qotdActiveTopicId
            : null;
      if (!myT || !partnerT || myT === partnerT) return;

      const trimmed = text.trim();
      const nextMirror = { ...qotdMirrorAnswers };
      if (trimmed) nextMirror[myUid] = trimmed;
      else delete nextMirror[myUid];
      setQotdMirrorAnswers(nextMirror);
      await saveRitualsState({
        qotdMirrorAnswers: nextMirror,
        qotdDateKey: ritualUtcDayKey,
      });
    },
    [
      myUid,
      partnerUid,
      qotdTopicLockDayKey,
      ritualUtcDayKey,
      qotdTopicByUid,
      qotdActiveTopicId,
      qotdMirrorAnswers,
      saveRitualsState,
    ],
  );

  const applyRemoteRitualsPayload = useCallback((x: Record<string, unknown>) => {
    const qa = parseStringMap(x.qotdAnswers);
    const qdk = typeof x.qotdDateKey === 'string' && x.qotdDateKey.length <= 16 ? x.qotdDateKey : null;
    let qtid =
      typeof x.qotdActiveTopicId === 'string' &&
      x.qotdActiveTopicId.length <= 48 &&
      isValidQotdTopicId(x.qotdActiveTopicId)
        ? x.qotdActiveTopicId
        : null;
    let qtlk =
      typeof x.qotdTopicLockDayKey === 'string' && x.qotdTopicLockDayKey.length <= 16 ? x.qotdTopicLockDayKey : null;
    const remoteUpdatedAt = typeof x.updatedAt === 'number' && Number.isFinite(x.updatedAt) ? x.updatedAt : 0;
    const snapshotStale =
      remoteUpdatedAt > 0 && remoteUpdatedAt < lastLocalRitualsWriteMsRef.current - 200;
    const todayK = ritualUtcDayKeyRef.current;
    if (
      snapshotStale &&
      qotdTopicLockDayKeyRef.current === todayK &&
      qotdActiveTopicIdRef.current &&
      isValidQotdTopicId(qotdActiveTopicIdRef.current) &&
      (qtlk !== todayK || !qtid)
    ) {
      qtid = qotdActiveTopicIdRef.current;
      qtlk = qotdTopicLockDayKeyRef.current;
    }
    const qtp = parseNumberMap(x.qotdTopicProgress);
    const dareFieldPresent = 'dareDoneByUid' in x && x.dareDoneByUid !== undefined;
    const dduParsed = dareFieldPresent ? parseBoolMap(x.dareDoneByUid) : null;
    const ddk = typeof x.dareDoneDayKey === 'string' && x.dareDoneDayKey.length <= 16 ? x.dareDoneDayKey : null;
    const uidMerge = myUidRef.current;
    const todayMerge = ritualUtcDayKeyRef.current;
    let mergedDdu = dareDoneByUidRef.current;
    let mergedDdk = dareDoneDayKeyRef.current;
    if (dduParsed !== null) {
      mergedDdu = dduParsed;
      if (uidMerge && ddk === todayMerge && dareDoneByUidRef.current[uidMerge] && !dduParsed[uidMerge]) {
        mergedDdu = { ...dduParsed, [uidMerge]: true };
      }
      mergedDdk = ddk;
    }
    let tbu = parseQotdTopicByUidMap(x.qotdTopicByUid);
    if (snapshotStale && qtlk === todayK) {
      const localT = qotdTopicByUidRef.current;
      for (const [k, v] of Object.entries(localT)) {
        if (!tbu[k] && isValidQotdTopicId(v)) tbu = { ...tbu, [k]: v };
      }
    }
    const qmir = parseStringMap(x.qotdMirrorAnswers);
    const remotePayload: RitualsPersist = {
      dareStreak: (x.dareStreak as number) ?? 0,
      streakBoard: (x.streakBoard as StreakBoardState) ?? defaultBoard,
      partnerQ: (x.partnerQ as string) ?? '',
      qotdAnswers: qa,
      qotdDateKey: qdk,
      qotdActiveTopicId: qtid,
      qotdTopicLockDayKey: qtlk,
      qotdTopicProgress: qtp,
      qotdTopicByUid: tbu,
      qotdMirrorAnswers: qmir,
      dareDoneByUid: mergedDdu,
      dareDoneDayKey: mergedDdk,
      nightNote: (x.nightNote as string) ?? '',
      nightSaved: !!x.nightSaved,
      nightNoteFormat: parseNoteFormat(x.nightNoteFormat),
      nightMediaUrl:
        typeof x.nightMediaUrl === 'string' && /^https?:\/\//i.test(x.nightMediaUrl) ? x.nightMediaUrl : null,
      updatedAt: (x.updatedAt as number) ?? Date.now(),
    };
    lastRemoteSigRef.current = ritualsSig({
      dareStreak: remotePayload.dareStreak,
      streakBoard: remotePayload.streakBoard,
      partnerQ: remotePayload.partnerQ,
      qotdAnswers: remotePayload.qotdAnswers,
      qotdDateKey: remotePayload.qotdDateKey,
      qotdActiveTopicId: remotePayload.qotdActiveTopicId,
      qotdTopicLockDayKey: remotePayload.qotdTopicLockDayKey,
      qotdTopicProgress: remotePayload.qotdTopicProgress,
      qotdTopicByUid: remotePayload.qotdTopicByUid,
      qotdMirrorAnswers: remotePayload.qotdMirrorAnswers,
      dareDoneByUid: remotePayload.dareDoneByUid,
      dareDoneDayKey: remotePayload.dareDoneDayKey,
      nightNote: remotePayload.nightNote,
      nightSaved: remotePayload.nightSaved,
      nightNoteFormat: remotePayload.nightNoteFormat,
      nightMediaUrl: remotePayload.nightMediaUrl,
    });
    setDareStreak((p) => (p === remotePayload.dareStreak ? p : remotePayload.dareStreak));
    setStreakBoard((p) =>
      JSON.stringify(p) === JSON.stringify(remotePayload.streakBoard) ? p : remotePayload.streakBoard,
    );
    setLegacyPartnerQ((p) => (p === remotePayload.partnerQ ? p : remotePayload.partnerQ));
    setQotdAnswers((p) => (JSON.stringify(p) === JSON.stringify(remotePayload.qotdAnswers) ? p : remotePayload.qotdAnswers));
    setQotdDateKey((p) => (p === remotePayload.qotdDateKey ? p : remotePayload.qotdDateKey));
    setQotdActiveTopicId((p) => (p === remotePayload.qotdActiveTopicId ? p : remotePayload.qotdActiveTopicId));
    setQotdTopicLockDayKey((p) => (p === remotePayload.qotdTopicLockDayKey ? p : remotePayload.qotdTopicLockDayKey));
    setQotdTopicProgress((p) =>
      JSON.stringify(p) === JSON.stringify(remotePayload.qotdTopicProgress) ? p : remotePayload.qotdTopicProgress,
    );
    setQotdTopicByUid((p) =>
      JSON.stringify(p) === JSON.stringify(remotePayload.qotdTopicByUid) ? p : remotePayload.qotdTopicByUid,
    );
    setQotdMirrorAnswers((p) =>
      JSON.stringify(p) === JSON.stringify(remotePayload.qotdMirrorAnswers) ? p : remotePayload.qotdMirrorAnswers,
    );
    setDareDoneByUid((p) => (JSON.stringify(p) === JSON.stringify(remotePayload.dareDoneByUid) ? p : remotePayload.dareDoneByUid));
    setDareDoneDayKey((p) => (p === remotePayload.dareDoneDayKey ? p : remotePayload.dareDoneDayKey));
    setNightNote((p) => (p === remotePayload.nightNote ? p : remotePayload.nightNote));
    setNightSaved((p) => (p === remotePayload.nightSaved ? p : remotePayload.nightSaved));
    setNoteFormat((p) => (p === remotePayload.nightNoteFormat ? p : remotePayload.nightNoteFormat));
    setNightMediaUrl((p) => (p === remotePayload.nightMediaUrl ? p : remotePayload.nightMediaUrl));
    setNightMediaUri(null);
  }, []);

  useEffect(() => {
    if (ENABLE_RITUALS_FIRESTORE_SYNC && coupleCode && user && ritualsDocRef) return;
    let cancelled = false;

    const finish = () => {
      if (!cancelled) setHydrated(true);
    };

    if (!coupleCode?.trim()) {
      if (user?.uid) {
        (async () => {
          const raw = await AsyncStorage.getItem(`rituals:local:${user.uid}`);
          if (!raw || cancelled) return;
          const parsed = JSON.parse(raw) as Record<string, unknown>;
          applyRemoteRitualsPayload({
            ...parsed,
            qotdAnswers: parsed.qotdAnswers ?? {},
            dareDoneByUid: parsed.dareDoneByUid ?? {},
          });
        })()
          .catch(() => {})
          .finally(finish);
        return () => {
          cancelled = true;
        };
      }
      finish();
      return () => {
        cancelled = true;
      };
    }

    (async () => {
      const raw = await AsyncStorage.getItem(`rituals:${coupleCode}`);
      if (!raw || cancelled) return;
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      applyRemoteRitualsPayload({
        ...parsed,
        qotdAnswers: parsed.qotdAnswers ?? {},
        dareDoneByUid: parsed.dareDoneByUid ?? {},
      });
    })()
      .catch(() => {})
      .finally(finish);
    return () => {
      cancelled = true;
    };
  }, [coupleCode, user, ritualsDocRef, applyRemoteRitualsPayload]);

  useEffect(() => {
    if (!ENABLE_RITUALS_FIRESTORE_SYNC) return;
    if (!coupleCode || !user || !ritualsDocRef || !coupleMembershipReady) return;
    setHydrated(false);
    const unsub = onSnapshot(
      ritualsDocRef,
      { includeMetadataChanges: true },
      (snap) => {
        const x = snap.data() as Record<string, unknown> | undefined;
        if (!x) {
          setHydrated(true);
          return;
        }
        applyRemoteRitualsPayload(x);
        setHydrated(true);
      },
      () => setHydrated(true),
    );
    return () => deferFirestoreUnsubscribe(unsub);
  }, [coupleCode, user, ritualsDocRef, coupleMembershipReady, applyRemoteRitualsPayload]);

  useEffect(() => {
    if (!hydrated) return;
    const data = buildPersist({ updatedAt: Date.now() });
    if (ENABLE_RITUALS_FIRESTORE_SYNC && coupleCode?.trim() && user && ritualsDocRef && coupleMembershipReady) {
      const sig = ritualsSig({
        dareStreak: data.dareStreak,
        streakBoard: data.streakBoard,
        partnerQ: data.partnerQ,
        qotdAnswers: data.qotdAnswers,
        qotdDateKey: data.qotdDateKey,
        qotdActiveTopicId: data.qotdActiveTopicId,
        qotdTopicLockDayKey: data.qotdTopicLockDayKey,
        qotdTopicProgress: data.qotdTopicProgress,
        qotdTopicByUid: data.qotdTopicByUid,
        qotdMirrorAnswers: data.qotdMirrorAnswers,
        dareDoneByUid: data.dareDoneByUid,
        dareDoneDayKey: data.dareDoneDayKey,
        nightNote: data.nightNote,
        nightSaved: data.nightSaved,
        nightNoteFormat: data.nightNoteFormat,
        nightMediaUrl: scrubNightMediaForRemote(data.nightMediaUrl),
      });
      if (sig === lastRemoteSigRef.current) return;
      const timer = setTimeout(() => {
        lastRemoteSigRef.current = sig;
        /** Do not merge these from the autosync timer — `setDoc` replaces nested maps and can wipe
         *  `dareDoneByUid` / QOTD fields written via `updateDoc` or explicit `saveRitualsState`. */
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
    if (coupleCode?.trim()) {
      AsyncStorage.setItem(`rituals:${coupleCode}`, JSON.stringify(data)).catch(() => {});
    } else if (user?.uid) {
      AsyncStorage.setItem(`rituals:local:${user.uid}`, JSON.stringify(data)).catch(() => {});
    }
  }, [
    coupleCode,
    hydrated,
    dareStreak,
    streakBoard,
    legacyPartnerQ,
    qotdAnswers,
    qotdDateKey,
    qotdActiveTopicId,
    qotdTopicLockDayKey,
    qotdTopicProgress,
    qotdTopicByUid,
    qotdMirrorAnswers,
    dareDoneByUid,
    dareDoneDayKey,
    nightNote,
    nightSaved,
    noteFormat,
    nightMediaUrl,
    user,
    ritualsDocRef,
    coupleMembershipReady,
    buildPersist,
  ]);

  const value = useMemo<RitualsContextValue>(
    () => ({
      partnerName,
      partnerUid: partnerUid ?? null,
      coupleMode,
      setCoupleMode,
      ritualDayKey: ritualUtcDayKey,
      dareBand,
      currentDare,
      qotdLockedTopicId,
      partnerQotdTopicId,
      qotdCrossTopic,
      currentQotd,
      confirmQotdTopic,
      qotdTopicProgressPercent,
      dareDone,
      partnerDareDone,
      markDareComplete,
      dareStreak,
      setDareStreak,
      myQ,
      setMyQ,
      partnerAnswer,
      partnerMirrorAnswer,
      mySavedQotd,
      myMirrorSavedQotd,
      qotdDateKey,
      saveMyQotdAnswer,
      saveMirrorQotdAnswer,
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
      partnerUid,
      coupleMode,
      setCoupleMode,
      ritualUtcDayKey,
      dareBand,
      currentDare,
      qotdLockedTopicId,
      partnerQotdTopicId,
      qotdCrossTopic,
      currentQotd,
      confirmQotdTopic,
      qotdTopicProgressPercent,
      dareDone,
      partnerDareDone,
      markDareComplete,
      dareStreak,
      myQ,
      partnerAnswer,
      partnerMirrorAnswer,
      mySavedQotd,
      myMirrorSavedQotd,
      qotdDateKey,
      saveMyQotdAnswer,
      saveMirrorQotdAnswer,
      noteFormat,
      nightNote,
      nightSaved,
      nightMediaUri,
      nightMediaUrl,
      streakBoard,
      saveRitualsState,
    ],
  );

  return <RitualsContext.Provider value={value}>{children}</RitualsContext.Provider>;
}

export function useRituals() {
  const ctx = useContext(RitualsContext);
  if (!ctx) throw new Error('useRituals must be used within RitualsProvider');
  return ctx;
}
