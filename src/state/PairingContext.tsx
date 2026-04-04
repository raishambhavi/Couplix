import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  Timestamp,
  collection,
  doc,
  getDoc,
  getDocFromServer,
  onSnapshot,
  setDoc,
  updateDoc,
  type FirestoreError,
} from 'firebase/firestore';

import { firebaseAuth, firebaseDb } from '../config/firebase';
import { FIRESTORE_SYNC_FLAGS } from '../config/firestoreSyncFlags';
import type { CoupleMode } from '../data/dailyDares';
import { parseCoupleCodeInput } from '../utils/coupleCode';
import { useAuth } from './AuthContext';

const ENABLE_PAIRING_FIRESTORE_SYNC = FIRESTORE_SYNC_FLAGS.pairing;

/** Per-account AsyncStorage keys — pairing survives sign-out/sign-in; another account won’t inherit the same couple. */
function pairKeys(uid: string) {
  const p = `pairing:v2:${uid}`;
  return {
    partnerName: `${p}:partnerName`,
    coupleCode: `${p}:coupleCode`,
    presenceStatus: `${p}:presenceStatus`,
    coupleMode: `${p}:coupleMode`,
    partnerBirthMonth: `${p}:partnerBirthMonth`,
    partnerBirthDay: `${p}:partnerBirthDay`,
    metAtMs: `${p}:metAtMs`,
  };
}

const LEGACY_PAIRING_KEYS = [
  'pairing:partnerName',
  'pairing:coupleCode',
  'pairing:presenceStatus',
  'pairing:coupleMode',
  'pairing:partnerBirthMonth',
  'pairing:partnerBirthDay',
  'pairing:metAtMs',
] as const;

/** One-time copy from pre-v2 global keys into `pairing:v2:{uid}:*`, then delete legacy (first signed-in uid wins). */
async function migrateLegacyPairingToV2(uid: string): Promise<void> {
  const k = pairKeys(uid);
  if (await AsyncStorage.getItem(k.coupleCode)) return;
  const legacyCode = await AsyncStorage.getItem('pairing:coupleCode');
  if (!legacyCode) return;
  const rows = await AsyncStorage.multiGet([...LEGACY_PAIRING_KEYS]);
  const legacy: Record<string, string> = {};
  for (const [key, val] of rows) {
    if (val != null && val !== '') legacy[key] = val;
  }
  const sets: [string, string][] = [];
  if (legacy['pairing:partnerName']) sets.push([k.partnerName, legacy['pairing:partnerName']]);
  if (legacy['pairing:coupleCode']) sets.push([k.coupleCode, legacy['pairing:coupleCode']]);
  if (legacy['pairing:presenceStatus']) sets.push([k.presenceStatus, legacy['pairing:presenceStatus']]);
  if (legacy['pairing:coupleMode']) sets.push([k.coupleMode, legacy['pairing:coupleMode']]);
  if (legacy['pairing:partnerBirthMonth']) sets.push([k.partnerBirthMonth, legacy['pairing:partnerBirthMonth']]);
  if (legacy['pairing:partnerBirthDay']) sets.push([k.partnerBirthDay, legacy['pairing:partnerBirthDay']]);
  if (legacy['pairing:metAtMs']) sets.push([k.metAtMs, legacy['pairing:metAtMs']]);
  if (sets.length) await AsyncStorage.multiSet(sets);
  await AsyncStorage.multiRemove([...LEGACY_PAIRING_KEYS]);
}

/** 6-digit code (100000–999999) for easy numeric keypad entry. */
function generateCoupleCode(): string {
  try {
    const c = globalThis.crypto;
    // Must only read the buffer after getRandomValues runs; otherwise Uint32Array stays 0 and we'd
    // always emit 100000 when crypto is missing (user would see only two codes when regenerating).
    if (c != null && typeof c.getRandomValues === 'function') {
      const buf = new Uint32Array(1);
      c.getRandomValues(buf);
      return String(100000 + (buf[0] % 900000));
    }
  } catch {
    // ignore
  }
  return String(100000 + Math.floor(Math.random() * 900000));
}

/** Used when regenerating: React skips re-renders if the new state equals the old (same 6-digit string). */
function nextDistinctCoupleCode(prev: string | null): string {
  let candidate = generateCoupleCode();
  if (prev == null) return candidate;
  let guard = 0;
  while (candidate === prev && guard < 64) {
    candidate = generateCoupleCode();
    guard += 1;
  }
  if (candidate === prev) {
    const n = Number(prev);
    const base = Number.isFinite(n) && n >= 100000 && n <= 999999 ? Math.floor(n) : 100000;
    candidate = String(100000 + ((base - 100000 + 1) % 900000));
  }
  return candidate;
}

function logPairingSnapshotError(endpoint: string) {
  return (err: FirestoreError) => {
    if (__DEV__) console.warn(`[Pairing] snapshot ${endpoint}:`, err.code, err.message);
  };
}

/** Stable string for comparing nickname maps (Firestore merge would otherwise fight key order). */
function stableNicknameMapSig(m: Record<string, string>): string {
  return Object.keys(m)
    .sort()
    .map((k) => `${k}\n${m[k] ?? ''}`)
    .join('\0');
}

function readPartnerNicknameMap(raw: unknown): Record<string, string> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof v === 'string') out[k] = v;
  }
  return out;
}

function pairingStateSigParts(x: {
  partnerNicknames: Record<string, string>;
  presenceStatus: string;
  coupleMode: CoupleMode;
  partnerBirthMonth: number | null;
  partnerBirthDay: number | null;
  metAtMs: number | null;
}) {
  return JSON.stringify({
    nn: stableNicknameMapSig(x.partnerNicknames),
    ps: x.presenceStatus,
    cm: x.coupleMode,
    pbm: x.partnerBirthMonth,
    pbd: x.partnerBirthDay,
    met: x.metAtMs,
  });
}

function publicProfileUpdatedAtMs(data: Record<string, unknown>): number | null {
  const v = data.updatedAt;
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (v instanceof Timestamp) {
    const ms = v.toMillis();
    return Number.isFinite(ms) ? ms : null;
  }
  return null;
}

export type PresenceStatus = 'awake' | 'busy' | 'free' | 'winding_down';

export type { CoupleMode };

type PairingContextValue = {
  partnerName: string;
  setPartnerName: (name: string) => void;
  coupleCode: string | null;
  /** Bumps on each regenerate so UIs can depend on a changing value even if digits collide. */
  coupleCodeRevision: number;
  setCoupleCode: (code: string | null) => void;
  regenerateCoupleCode: () => string;
  isPaired: boolean;
  /**
   * True after `couples/{code}/members/{uid}` exists in Firestore (required by security rules
   * before any couple-scoped read). Prevents permission-denied races on snapshot listeners.
   */
  coupleMembershipReady: boolean;
  presenceStatus: PresenceStatus;
  setPresenceStatus: (status: PresenceStatus) => void;
  /** Living together vs long distance — drives rituals, prompts, and copy across the app. */
  coupleMode: CoupleMode;
  setCoupleMode: (mode: CoupleMode) => void;
  /** Partner birthday (month 1–12, day 1–31) — optional, for reminders / UI. */
  partnerBirthMonth: number | null;
  partnerBirthDay: number | null;
  setPartnerBirthMonth: (m: number | null) => void;
  setPartnerBirthDay: (d: number | null) => void;
  /** Calendar date (ms at local midnight) when the couple first met — drives “days together”. */
  metAtMs: number | null;
  setMetAtMs: (ms: number | null) => void;
  /** Partner's synced display name (from `public_profiles`), if any. */
  partnerProfileDisplayName: string | null;
  /** Partner's profile photo URL (HTTPS), if they synced from Settings. */
  partnerPhotoURL: string | null;
  /** Firestore `updatedAt` on partner's `public_profiles` doc — use to bust image cache when the URL is unchanged. */
  partnerPublicProfileUpdatedAt: number | null;
  /** Reset local pairing, issue a new couple code, then open onboarding to name partner / join again. */
  beginRePairing: () => Promise<void>;
};

const PairingContext = createContext<PairingContextValue | null>(null);

export function PairingProvider({ children }: { children: React.ReactNode }) {
  const { user, profile } = useAuth();
  const [partnerName, setPartnerNameState] = useState<string>('');
  const [presenceStatus, setPresenceStatus] = useState<PresenceStatus>('free');
  const [coupleCode, setCoupleCodeState] = useState<string | null>(null);
  const [coupleCodeRevision, setCoupleCodeRevision] = useState(0);
  const [coupleMode, setCoupleModeState] = useState<CoupleMode>('together');
  const [partnerBirthMonth, setPartnerBirthMonthState] = useState<number | null>(null);
  const [partnerBirthDay, setPartnerBirthDayState] = useState<number | null>(null);
  const [metAtMs, setMetAtMsState] = useState<number | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [coupleMembershipReady, setCoupleMembershipReady] = useState(false);
  const [partnerUid, setPartnerUid] = useState<string | null>(null);
  const [partnerProfileDisplayName, setPartnerProfileDisplayName] = useState<string | null>(null);
  const [partnerPhotoURL, setPartnerPhotoURL] = useState<string | null>(null);
  const [partnerPublicProfileUpdatedAt, setPartnerPublicProfileUpdatedAt] = useState<number | null>(null);
  const lastPairingSigRef = useRef('');
  /** Latest `partnerNicknames` map from Firestore — used so debounced writes merge without wiping the partner’s key. */
  const partnerNicknamesRemoteRef = useRef<Record<string, string>>({});
  /**
   * AsyncStorage hydration can finish *after* regenerate / join and overwrite the new code.
   * Once the user sets the code, never apply a stale value from the hydration effect.
   */
  const userTouchedCoupleCodeRef = useRef(false);
  /** Only reset “touched” when a different user signs in — not on Strict Mode re-runs of the same user. */
  const lastStorageHydrateUidRef = useRef<string | undefined>(undefined);
  /** Ignore AsyncStorage reads that finish after a newer hydrate run (Strict Mode / fast remounts). */
  const storageHydrateGenerationRef = useRef(0);

  const isPaired = useMemo(() => partnerName.trim().length >= 2 && !!coupleCode, [partnerName, coupleCode]);

  useEffect(() => {
    if (!user) {
      setHydrated(false);
      lastStorageHydrateUidRef.current = undefined;
      setPartnerNameState('');
      setCoupleCodeState(null);
      setCoupleCodeRevision(0);
      setPresenceStatus('free');
      setCoupleModeState('together');
      setPartnerBirthMonthState(null);
      setPartnerBirthDayState(null);
      setMetAtMsState(null);
      setCoupleMembershipReady(false);
      setPartnerUid(null);
      setPartnerProfileDisplayName(null);
      setPartnerPhotoURL(null);
      setPartnerPublicProfileUpdatedAt(null);
      lastPairingSigRef.current = '';
      partnerNicknamesRemoteRef.current = {};
      return;
    }
    const uid = user.uid;
    if (lastStorageHydrateUidRef.current !== uid) {
      userTouchedCoupleCodeRef.current = false;
      lastStorageHydrateUidRef.current = uid;
    }
    const gen = ++storageHydrateGenerationRef.current;
    let mounted = true;
    (async () => {
      try {
        await migrateLegacyPairingToV2(uid);
        const k = pairKeys(uid);
        const [savedPartner, savedCode, savedPresence, savedMode, savedBM, savedBD, savedMet] = await Promise.all([
          AsyncStorage.getItem(k.partnerName),
          AsyncStorage.getItem(k.coupleCode),
          AsyncStorage.getItem(k.presenceStatus),
          AsyncStorage.getItem(k.coupleMode),
          AsyncStorage.getItem(k.partnerBirthMonth),
          AsyncStorage.getItem(k.partnerBirthDay),
          AsyncStorage.getItem(k.metAtMs),
        ]);

        if (!mounted) return;
        if (gen !== storageHydrateGenerationRef.current) return;

        if (savedPartner && savedPartner.trim().length > 0) setPartnerNameState(savedPartner);
        if (savedPresence) setPresenceStatus(savedPresence as PresenceStatus);
        if (savedMode === 'together' || savedMode === 'longDistance') setCoupleModeState(savedMode);

        if (savedBM != null) {
          const m = parseInt(savedBM, 10);
          if (m >= 1 && m <= 12) setPartnerBirthMonthState(m);
        }
        if (savedBD != null) {
          const d = parseInt(savedBD, 10);
          if (d >= 1 && d <= 31) setPartnerBirthDayState(d);
        }
        if (savedMet != null) {
          const t = parseInt(savedMet, 10);
          if (Number.isFinite(t)) setMetAtMsState(t);
        }

        if (userTouchedCoupleCodeRef.current) {
          // User already set/joined/regenerated while we were reading storage — don’t overwrite.
        } else if (savedCode) {
          const normalized = parseCoupleCodeInput(savedCode);
          if (normalized) {
            setCoupleCodeState(normalized);
          } else {
            const next = generateCoupleCode();
            setCoupleCodeState(next);
            AsyncStorage.setItem(k.coupleCode, next).catch(() => {});
          }
        } else {
          const next = generateCoupleCode();
          setCoupleCodeState(next);
          AsyncStorage.setItem(k.coupleCode, next).catch(() => {});
        }
      } catch {
        // ignore; keep defaults
      } finally {
        if (mounted) setHydrated(true);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [user?.uid]);

  const pairingDocRef = useMemo(
    () => (coupleCode ? doc(firebaseDb, 'couples', coupleCode, 'state', 'pairing') : null),
    [coupleCode]
  );

  useEffect(() => {
    if (!ENABLE_PAIRING_FIRESTORE_SYNC) {
      setCoupleMembershipReady(false);
      return;
    }
    if (!coupleCode || !user) {
      setCoupleMembershipReady(false);
      return;
    }
    let cancelled = false;
    setCoupleMembershipReady(false);
    (async () => {
      try {
        await firebaseAuth.authStateReady();
        const authUid = firebaseAuth.currentUser?.uid;
        if (!authUid || authUid !== user.uid) return;
        const memberRef = doc(firebaseDb, 'couples', coupleCode, 'members', authUid);
        await setDoc(memberRef, { uid: authUid, joinedAt: Date.now() }, { merge: true });
        let verifyExists = false;
        try {
          const verify = await getDocFromServer(memberRef);
          verifyExists = verify.exists();
        } catch {
          const verify = await getDoc(memberRef);
          verifyExists = verify.exists();
        }
        if (!verifyExists) throw new Error('member doc not visible after write');
        if (!cancelled) setCoupleMembershipReady(true);
      } catch (e) {
        if (__DEV__) console.warn('[Pairing] couple membership write failed', e);
        if (!cancelled) setCoupleMembershipReady(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [coupleCode, user]);

  useEffect(() => {
    if (!ENABLE_PAIRING_FIRESTORE_SYNC || !coupleCode || !user || !coupleMembershipReady) {
      setPartnerUid(null);
      return;
    }
    setPartnerUid(null);
    const col = collection(firebaseDb, 'couples', coupleCode, 'members');
    const unsub = onSnapshot(
      col,
      (snap) => {
        const mine = user.uid;
        const other = snap.docs.map((d) => d.id).find((id) => id !== mine);
        // Do not skip cache-only snapshots: waiting for fromCache=false often left partnerUid null
        // indefinitely (partner never “recognized”) when only persisted/local updates arrived.
        setPartnerUid(other ?? null);
      },
      logPairingSnapshotError('couples/.../members')
    );
    return () => unsub();
  }, [coupleCode, user, coupleMembershipReady]);

  useEffect(() => {
    if (!ENABLE_PAIRING_FIRESTORE_SYNC || !coupleCode || !partnerUid || !coupleMembershipReady) {
      setPartnerProfileDisplayName(null);
      setPartnerPhotoURL(null);
      setPartnerPublicProfileUpdatedAt(null);
      return;
    }
    const ref = doc(firebaseDb, 'couples', coupleCode, 'public_profiles', partnerUid);
    const unsub = onSnapshot(
      ref,
      (snap) => {
        if (!snap.exists()) {
          setPartnerProfileDisplayName(null);
          setPartnerPhotoURL(null);
          setPartnerPublicProfileUpdatedAt(null);
          return;
        }
        const d = snap.data() as Record<string, unknown>;
        const dn = d.displayName;
        const ph = d.photoURL;
        setPartnerProfileDisplayName(typeof dn === 'string' && dn.length > 0 ? dn : null);
        const url = typeof ph === 'string' && ph.length > 0 ? ph : null;
        setPartnerPhotoURL(url && (url.startsWith('http://') || url.startsWith('https://')) ? url : null);
        setPartnerPublicProfileUpdatedAt(publicProfileUpdatedAtMs(d));
      },
      logPairingSnapshotError('couples/.../public_profiles')
    );
    return () => unsub();
  }, [coupleCode, partnerUid, coupleMembershipReady]);

  useEffect(() => {
    if (!ENABLE_PAIRING_FIRESTORE_SYNC || !coupleCode || !user || !coupleMembershipReady || !profile) return;
    const photo =
      profile.photoURL &&
      (profile.photoURL.startsWith('http://') || profile.photoURL.startsWith('https://'))
        ? profile.photoURL
        : '';
    setDoc(
      doc(firebaseDb, 'couples', coupleCode, 'public_profiles', user.uid),
      {
        displayName: profile.displayName ?? '',
        photoURL: photo,
        updatedAt: Date.now(),
      },
      { merge: true }
    ).catch(() => {});
  }, [
    coupleCode,
    user?.uid,
    coupleMembershipReady,
    profile?.displayName,
    profile?.photoURL,
    profile?.updatedAt,
  ]);

  useEffect(() => {
    if (!ENABLE_PAIRING_FIRESTORE_SYNC) return;
    if (!coupleCode || !user || !pairingDocRef || !coupleMembershipReady) return;
    const unsub = onSnapshot(
      pairingDocRef,
      (snap) => {
        const x = snap.data() as any;
        if (!x) return;
        const nickMap = readPartnerNicknameMap(x.partnerNicknames);
        partnerNicknamesRemoteRef.current = nickMap;
        const mine = user.uid;
        if (Object.prototype.hasOwnProperty.call(nickMap, mine)) {
          const v = nickMap[mine];
          setPartnerNameState((prev) => (prev === v ? prev : v));
        }
        /**
         * Legacy single `partnerName` synced to both phones caused the joiner’s device to show the
         * creator’s partner string (e.g. both “Saurabh”). Only per-uid `partnerNicknames` may update
         * display from the server; keep local/AsyncStorage until our uid key exists.
         */
        const psNorm =
          x.presenceStatus === 'awake' ||
          x.presenceStatus === 'busy' ||
          x.presenceStatus === 'free' ||
          x.presenceStatus === 'winding_down'
            ? x.presenceStatus
            : 'free';
        const cmNorm = x.coupleMode === 'longDistance' ? 'longDistance' : 'together';
        let pbmNorm: number | null = null;
        if (x.partnerBirthMonth == null || (typeof x.partnerBirthMonth === 'number' && x.partnerBirthMonth >= 1 && x.partnerBirthMonth <= 12)) {
          pbmNorm = x.partnerBirthMonth == null ? null : x.partnerBirthMonth;
        }
        let pbdNorm: number | null = null;
        if (x.partnerBirthDay == null || (typeof x.partnerBirthDay === 'number' && x.partnerBirthDay >= 1 && x.partnerBirthDay <= 31)) {
          pbdNorm = x.partnerBirthDay == null ? null : x.partnerBirthDay;
        }
        let metNorm: number | null = null;
        if (x.metAtMs == null || typeof x.metAtMs === 'number') {
          metNorm = x.metAtMs == null ? null : x.metAtMs;
        }
        lastPairingSigRef.current = pairingStateSigParts({
          partnerNicknames: nickMap,
          presenceStatus: psNorm,
          coupleMode: cmNorm,
          partnerBirthMonth: pbmNorm,
          partnerBirthDay: pbdNorm,
          metAtMs: metNorm,
        });
        if (x.presenceStatus === 'awake' || x.presenceStatus === 'busy' || x.presenceStatus === 'free' || x.presenceStatus === 'winding_down') {
          setPresenceStatus((prev) => (prev === x.presenceStatus ? prev : x.presenceStatus));
        }
        if (x.coupleMode === 'together' || x.coupleMode === 'longDistance') {
          setCoupleModeState((prev) => (prev === x.coupleMode ? prev : x.coupleMode));
        }
        if (x.partnerBirthMonth == null || (typeof x.partnerBirthMonth === 'number' && x.partnerBirthMonth >= 1 && x.partnerBirthMonth <= 12)) {
          const pm = x.partnerBirthMonth == null ? null : x.partnerBirthMonth;
          setPartnerBirthMonthState((prev) => (prev === pm ? prev : pm));
        }
        if (x.partnerBirthDay == null || (typeof x.partnerBirthDay === 'number' && x.partnerBirthDay >= 1 && x.partnerBirthDay <= 31)) {
          const pd = x.partnerBirthDay == null ? null : x.partnerBirthDay;
          setPartnerBirthDayState((prev) => (prev === pd ? prev : pd));
        }
        if (x.metAtMs == null || typeof x.metAtMs === 'number') {
          const mt = x.metAtMs == null ? null : x.metAtMs;
          setMetAtMsState((prev) => (prev === mt ? prev : mt));
        }
      },
      logPairingSnapshotError('state/pairing')
    );
    return () => unsub();
  }, [coupleCode, user, pairingDocRef, coupleMembershipReady]);

  useEffect(() => {
    if (!hydrated) return;
    if (!ENABLE_PAIRING_FIRESTORE_SYNC) return;
    if (!coupleCode || !user || !pairingDocRef || !coupleMembershipReady) return;
    const uid = user.uid;
    const mergedNicknames = { ...partnerNicknamesRemoteRef.current, [uid]: partnerName };
    const localSig = pairingStateSigParts({
      partnerNicknames: mergedNicknames,
      presenceStatus,
      coupleMode,
      partnerBirthMonth,
      partnerBirthDay,
      metAtMs,
    });
    if (localSig === lastPairingSigRef.current) return;
    const timer = setTimeout(() => {
      lastPairingSigRef.current = localSig;
      partnerNicknamesRemoteRef.current = mergedNicknames;
      const updates: Record<string, unknown> = {
        [`partnerNicknames.${uid}`]: partnerName,
        presenceStatus,
        coupleMode,
        partnerBirthMonth,
        partnerBirthDay,
        metAtMs,
        updatedAt: Date.now(),
      };
      updateDoc(pairingDocRef, updates).catch((e: unknown) => {
        const code = typeof e === 'object' && e !== null && 'code' in e ? String((e as { code: string }).code) : '';
        if (code === 'not-found') {
          setDoc(
            pairingDocRef,
            {
              partnerNicknames: { [uid]: partnerName },
              presenceStatus,
              coupleMode,
              partnerBirthMonth,
              partnerBirthDay,
              metAtMs,
              updatedAt: Date.now(),
            },
            { merge: true }
          ).catch(() => {});
        }
      });
    }, 700);
    return () => clearTimeout(timer);
  }, [
    hydrated,
    coupleCode,
    user,
    pairingDocRef,
    coupleMembershipReady,
    partnerName,
    presenceStatus,
    coupleMode,
    partnerBirthMonth,
    partnerBirthDay,
    metAtMs,
  ]);

  const regenerateCoupleCode = useCallback((): string => {
    const uid = user?.uid;
    if (!uid) return '';
    userTouchedCoupleCodeRef.current = true;
    const k = pairKeys(uid);
    let out = '';
    setCoupleCodeState((prev) => {
      const next = nextDistinctCoupleCode(prev);
      out = next;
      void AsyncStorage.setItem(k.coupleCode, next);
      return next;
    });
    setCoupleCodeRevision((r) => r + 1);
    return out;
  }, [user?.uid]);

  const setCoupleCode = useCallback(
    (code: string | null) => {
      const uid = user?.uid;
      if (!uid) return;
      userTouchedCoupleCodeRef.current = true;
      const k = pairKeys(uid);
      const n = parseCoupleCodeInput(code);
      setCoupleCodeState(n);
      if (n) void AsyncStorage.setItem(k.coupleCode, n);
      else void AsyncStorage.removeItem(k.coupleCode);
    },
    [user?.uid]
  );

  const persistPartner = useCallback(
    (name: string) => {
      const uid = user?.uid;
      if (!uid) return;
      setPartnerNameState(name);
      void AsyncStorage.setItem(pairKeys(uid).partnerName, name);
    },
    [user?.uid]
  );

  const setPartnerBirthMonth = useCallback(
    (m: number | null) => {
      const uid = user?.uid;
      if (!uid) return;
      const k = pairKeys(uid);
      setPartnerBirthMonthState(m);
      if (m == null) void AsyncStorage.removeItem(k.partnerBirthMonth);
      else void AsyncStorage.setItem(k.partnerBirthMonth, String(m));
    },
    [user?.uid]
  );

  const setPartnerBirthDay = useCallback(
    (d: number | null) => {
      const uid = user?.uid;
      if (!uid) return;
      const k = pairKeys(uid);
      setPartnerBirthDayState(d);
      if (d == null) void AsyncStorage.removeItem(k.partnerBirthDay);
      else void AsyncStorage.setItem(k.partnerBirthDay, String(d));
    },
    [user?.uid]
  );

  const setMetAtMs = useCallback(
    (ms: number | null) => {
      const uid = user?.uid;
      if (!uid) return;
      const k = pairKeys(uid);
      setMetAtMsState(ms);
      if (ms == null) void AsyncStorage.removeItem(k.metAtMs);
      else void AsyncStorage.setItem(k.metAtMs, String(ms));
    },
    [user?.uid]
  );

  const persistPresence = useCallback(
    (status: PresenceStatus) => {
      const uid = user?.uid;
      if (!uid) return;
      setPresenceStatus(status);
      void AsyncStorage.setItem(pairKeys(uid).presenceStatus, status);
    },
    [user?.uid]
  );

  const setCoupleMode = useCallback(
    (mode: CoupleMode) => {
      const uid = user?.uid;
      if (!uid) return;
      setCoupleModeState(mode);
      AsyncStorage.setItem(pairKeys(uid).coupleMode, mode).catch(() => {});
    },
    [user?.uid]
  );

  const beginRePairing = useCallback(async () => {
    const uid = user?.uid;
    if (!uid) return;
    userTouchedCoupleCodeRef.current = true;
    lastPairingSigRef.current = '';
    partnerNicknamesRemoteRef.current = {};
    setPartnerUid(null);
    setPartnerProfileDisplayName(null);
    setPartnerPhotoURL(null);
    setPartnerPublicProfileUpdatedAt(null);
    setCoupleMembershipReady(false);
    const k = pairKeys(uid);
    await AsyncStorage.multiRemove([...Object.values(k), ...LEGACY_PAIRING_KEYS]).catch(() => {});
    setPartnerNameState('');
    setPartnerBirthMonthState(null);
    setPartnerBirthDayState(null);
    setMetAtMsState(null);
    await AsyncStorage.setItem(k.partnerName, '').catch(() => {});
    setPresenceStatus('free');
    await AsyncStorage.setItem(k.presenceStatus, 'free').catch(() => {});
    setCoupleModeState('together');
    await AsyncStorage.setItem(k.coupleMode, 'together').catch(() => {});
    const next = generateCoupleCode();
    setCoupleCodeState(next);
    setCoupleCodeRevision((r) => r + 1);
    await AsyncStorage.setItem(k.coupleCode, next).catch(() => {});
  }, [user?.uid]);

  const value = useMemo(
    () => ({
      partnerName,
      setPartnerName: persistPartner,
      coupleCode,
      coupleCodeRevision,
      setCoupleCode,
      regenerateCoupleCode,
      isPaired,
      coupleMembershipReady,
      presenceStatus,
      setPresenceStatus: persistPresence,
      coupleMode,
      setCoupleMode,
      partnerBirthMonth,
      partnerBirthDay,
      setPartnerBirthMonth,
      setPartnerBirthDay,
      metAtMs,
      setMetAtMs,
      partnerProfileDisplayName,
      partnerPhotoURL,
      partnerPublicProfileUpdatedAt,
      beginRePairing,
    }),
    [
      partnerName,
      persistPartner,
      coupleCode,
      coupleCodeRevision,
      setCoupleCode,
      regenerateCoupleCode,
      isPaired,
      coupleMembershipReady,
      presenceStatus,
      persistPresence,
      coupleMode,
      setCoupleMode,
      partnerBirthMonth,
      partnerBirthDay,
      setPartnerBirthMonth,
      setPartnerBirthDay,
      metAtMs,
      setMetAtMs,
      partnerProfileDisplayName,
      partnerPhotoURL,
      partnerPublicProfileUpdatedAt,
      beginRePairing,
    ]
  );

  return <PairingContext.Provider value={value}>{children}</PairingContext.Provider>;
}

export function usePairing() {
  const ctx = useContext(PairingContext);
  if (!ctx) throw new Error('usePairing must be used within PairingProvider');
  return ctx;
}

