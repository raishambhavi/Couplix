import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';

import { firebaseDb } from '../config/firebase';
import { FIRESTORE_SYNC_FLAGS } from '../config/firestoreSyncFlags';
import { displayNameFromProfile } from '../utils/displayName';
import { omitUndefinedDeep } from '../utils/sanitizeFirestore';
import { useAuth } from './AuthContext';
import { usePairing } from './PairingContext';

const ENABLE_TOGETHER_FIRESTORE_SYNC = FIRESTORE_SYNC_FLAGS.together;

export type TogetherLastEdit = {
  byUid?: string;
  byName?: string;
  at?: number;
};

export type WishItem = {
  id: string;
  text: string;
  lockDate?: string;
  at: number;
  createdByUid?: string;
  createdByName?: string;
};
export type JournalItem = {
  id: string;
  text: string;
  mood: string;
  location: string;
  photoUri?: string;
  shared: boolean;
  at: number;
  category?: string;
  title?: string;
  authorUid?: string;
  authorName?: string;
};

export type CoupleGoalItem = {
  id: string;
  text: string;
  year: number;
  completed: boolean;
  completedAt?: number | null;
  completedByUid?: string | null;
};

/** Shared travel pin — same doc as other Together state. */
export type TripPin = {
  id: string;
  title: string;
  latitude: number;
  longitude: number;
  placeLabel: string;
  visitedAt: number;
  photoUri?: string;
  country?: string;
  stateOrRegion?: string;
  city?: string;
  /** e.g. national_park from geocoder */
  placeKind?: string;
  addedByUid?: string;
  addedByName?: string;
};

type TogetherContextValue = {
  wishes: WishItem[];
  addWish: (text: string, lockDate?: string) => void;
  targetAt: number;
  setTargetAt: (v: number) => void;
  countMode: 'days' | 'hours' | 'minutes' | 'percent';
  setCountMode: (m: 'days' | 'hours' | 'minutes' | 'percent') => void;
  journal: JournalItem[];
  addJournalEntry: (entry: Omit<JournalItem, 'id' | 'at'>) => void;
  coupleGoals: CoupleGoalItem[];
  addCoupleGoal: (text: string, year: number) => void;
  toggleCoupleGoalComplete: (id: string, uid: string) => void;
  trips: TripPin[];
  addTrip: (trip: Omit<TripPin, 'id'>, options?: { tripId?: string }) => void;
  removeTrip: (id: string) => void;
  /** Who last changed shared Together data (from Firestore when synced). */
  togetherLastEdit: TogetherLastEdit;
};

const TogetherContext = createContext<TogetherContextValue | null>(null);

function storageKey(coupleCode: string | null) {
  return coupleCode ? `together:v1:${coupleCode}` : 'together:v1:local';
}

export function dateISO(d = new Date()) {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function TogetherProvider({ children }: { children: React.ReactNode }) {
  const { user, profile } = useAuth();
  const { coupleCode, coupleMembershipReady } = usePairing();
  const key = storageKey(coupleCode);
  const [wishes, setWishes] = useState<WishItem[]>([]);
  const [targetAt, setTargetAtInternal] = useState<number>(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const [countMode, setCountModeInternal] = useState<'days' | 'hours' | 'minutes' | 'percent'>('days');
  const [journal, setJournal] = useState<JournalItem[]>([]);
  const [coupleGoals, setCoupleGoals] = useState<CoupleGoalItem[]>([]);
  const [trips, setTrips] = useState<TripPin[]>([]);
  const [togetherLastEdit, setTogetherLastEdit] = useState<TogetherLastEdit>({});
  const [hydrated, setHydrated] = useState(false);
  const lastRemoteSigRef = useRef('');

  const touchTogetherEdit = React.useCallback(() => {
    if (!user) return;
    setTogetherLastEdit({
      byUid: user.uid,
      byName: displayNameFromProfile(profile, user),
      at: Date.now(),
    });
  }, [user, profile]);

  const setTargetAt = React.useCallback(
    (v: number) => {
      touchTogetherEdit();
      setTargetAtInternal(v);
    },
    [touchTogetherEdit]
  );

  const setCountMode = React.useCallback(
    (m: 'days' | 'hours' | 'minutes' | 'percent') => {
      touchTogetherEdit();
      setCountModeInternal(m);
    },
    [touchTogetherEdit]
  );

  useEffect(() => {
    if (ENABLE_TOGETHER_FIRESTORE_SYNC && coupleCode && user) return;
    let mounted = true;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(key);
        if (!raw || !mounted) return;
        const parsed = JSON.parse(raw);
        setWishes(parsed.wishes ?? []);
        setTargetAtInternal(parsed.targetAt ?? Date.now() + 7 * 24 * 60 * 60 * 1000);
        setCountModeInternal(parsed.countMode ?? 'days');
        setJournal(parsed.journal ?? []);
        setCoupleGoals(parsed.coupleGoals ?? []);
        setTrips(Array.isArray(parsed.trips) ? parsed.trips : []);
      } catch {
        // ignore
      } finally {
        if (mounted) setHydrated(true);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [key]);

  const togetherDocRef = useMemo(
    () => (coupleCode ? doc(firebaseDb, 'couples', coupleCode, 'state', 'together') : null),
    [coupleCode]
  );

  useEffect(() => {
    if (!ENABLE_TOGETHER_FIRESTORE_SYNC) return;
    if (!coupleCode || !user || !togetherDocRef || !coupleMembershipReady) return;
    setHydrated(false);
    const unsub = onSnapshot(
      togetherDocRef,
      (snap) => {
        const x = snap.data() as any;
        const remotePayload = {
          wishes: x?.wishes ?? [],
          targetAt: typeof x?.targetAt === 'number' ? x.targetAt : targetAt,
          countMode:
            x?.countMode === 'days' || x?.countMode === 'hours' || x?.countMode === 'minutes' || x?.countMode === 'percent'
              ? x.countMode
              : countMode,
          journal: Array.isArray(x?.journal) ? x.journal : [],
          coupleGoals: Array.isArray(x?.coupleGoals) ? x.coupleGoals : [],
          trips: Array.isArray(x?.trips) ? x.trips : [],
          lastEditedByUid: typeof x?.lastEditedByUid === 'string' ? x.lastEditedByUid : undefined,
          lastEditedByName: typeof x?.lastEditedByName === 'string' ? x.lastEditedByName : undefined,
          lastEditedAt: typeof x?.lastEditedAt === 'number' ? x.lastEditedAt : undefined,
        };
        lastRemoteSigRef.current = JSON.stringify(remotePayload);
        setTogetherLastEdit({
          byUid: typeof x?.lastEditedByUid === 'string' ? x.lastEditedByUid : undefined,
          byName: typeof x?.lastEditedByName === 'string' ? x.lastEditedByName : undefined,
          at: typeof x?.lastEditedAt === 'number' ? x.lastEditedAt : undefined,
        });
        if (x?.wishes) {
          setWishes((prev) => (JSON.stringify(prev) === JSON.stringify(x.wishes) ? prev : x.wishes));
        }
        if (typeof x?.targetAt === 'number') {
          setTargetAtInternal((prev) => (prev === x.targetAt ? prev : x.targetAt));
        }
        if (x?.countMode === 'days' || x?.countMode === 'hours' || x?.countMode === 'minutes' || x?.countMode === 'percent') {
          setCountModeInternal((prev) => (prev === x.countMode ? prev : x.countMode));
        }
        if (Array.isArray(x?.journal)) {
          setJournal((prev) => (JSON.stringify(prev) === JSON.stringify(x.journal) ? prev : x.journal));
        }
        if (Array.isArray(x?.coupleGoals)) {
          setCoupleGoals((prev) => (JSON.stringify(prev) === JSON.stringify(x.coupleGoals) ? prev : x.coupleGoals));
        }
        if (Array.isArray(x?.trips)) {
          setTrips((prev) => (JSON.stringify(prev) === JSON.stringify(x.trips) ? prev : x.trips));
        }
        setHydrated(true);
      },
      () => setHydrated(true)
    );
    return () => unsub();
  }, [coupleCode, user, togetherDocRef, coupleMembershipReady]);

  useEffect(() => {
    if (!hydrated) return;
    if (ENABLE_TOGETHER_FIRESTORE_SYNC && coupleCode && user && togetherDocRef && coupleMembershipReady) {
      const editPayload =
        togetherLastEdit.byUid && togetherLastEdit.byName && typeof togetherLastEdit.at === 'number'
          ? {
              lastEditedByUid: togetherLastEdit.byUid,
              lastEditedByName: togetherLastEdit.byName,
              lastEditedAt: togetherLastEdit.at,
            }
          : {};
      const payload = {
        wishes,
        targetAt,
        countMode,
        journal,
        coupleGoals,
        trips,
        updatedAt: Date.now(),
        ...editPayload,
      };
      const localSig = JSON.stringify({
        wishes,
        targetAt,
        countMode,
        journal,
        coupleGoals,
        trips,
        lastEditedByUid: togetherLastEdit.byUid,
        lastEditedByName: togetherLastEdit.byName,
        lastEditedAt: togetherLastEdit.at,
      });
      if (localSig === lastRemoteSigRef.current) return;
      const timer = setTimeout(() => {
        lastRemoteSigRef.current = localSig;
        setDoc(togetherDocRef, omitUndefinedDeep(payload), { merge: true }).catch(() => {});
      }, 900);
      return () => clearTimeout(timer);
    }
    AsyncStorage.setItem(
      key,
      JSON.stringify({
        wishes,
        targetAt,
        countMode,
        journal,
        coupleGoals,
        trips,
      })
    ).catch(() => {});
  }, [
    hydrated,
    key,
    wishes,
    targetAt,
    countMode,
    journal,
    coupleGoals,
    trips,
    togetherLastEdit,
    coupleCode,
    user,
    togetherDocRef,
    coupleMembershipReady,
  ]);

  const value = useMemo<TogetherContextValue>(
    () => ({
      wishes,
      addWish: (text: string, lockDate?: string) => {
        const trimmed = text.trim();
        if (!trimmed) return;
        touchTogetherEdit();
        setWishes((prev) => {
          const ld = lockDate?.trim();
          const item: WishItem = {
            id: `wish_${Date.now()}`,
            text: trimmed,
            at: Date.now(),
            ...(ld ? { lockDate: ld } : {}),
            ...(user
              ? { createdByUid: user.uid, createdByName: displayNameFromProfile(profile, user) }
              : {}),
          };
          return [item, ...prev];
        });
      },
      targetAt,
      setTargetAt,
      countMode,
      setCountMode,
      journal,
      addJournalEntry: (entry) => {
        const trimmed = entry.text.trim();
        if (!trimmed) return;
        touchTogetherEdit();
        const id = `jr_${Date.now()}`;
        const author =
          user != null
            ? { authorUid: user.uid, authorName: displayNameFromProfile(profile, user) }
            : {};
        setJournal((prev) => [{ ...entry, text: trimmed, ...author, id, at: Date.now() }, ...prev]);
      },
      coupleGoals,
      addCoupleGoal: (text: string, year: number) => {
        const t = text.trim();
        if (!t) return;
        touchTogetherEdit();
        const y = Number.isFinite(year) ? year : new Date().getFullYear();
        setCoupleGoals((prev) => [
          { id: `goal_${Date.now()}`, text: t, year: y, completed: false },
          ...prev,
        ]);
      },
      toggleCoupleGoalComplete: (id: string, uid: string) => {
        touchTogetherEdit();
        setCoupleGoals((prev) =>
          prev.map((g) => {
            if (g.id !== id) return g;
            const nextCompleted = !g.completed;
            return {
              ...g,
              completed: nextCompleted,
              ...(nextCompleted
                ? { completedAt: Date.now(), completedByUid: uid }
                : { completedAt: null, completedByUid: null }),
            };
          })
        );
      },
      trips,
      addTrip: (trip, options) => {
        touchTogetherEdit();
        const id =
          options?.tripId ?? `trip_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
        setTrips((prev) => [{ ...trip, id }, ...prev]);
      },
      removeTrip: (id: string) => {
        touchTogetherEdit();
        setTrips((prev) => prev.filter((t) => t.id !== id));
      },
      togetherLastEdit,
    }),
    [
      wishes,
      targetAt,
      countMode,
      journal,
      coupleGoals,
      trips,
      togetherLastEdit,
      touchTogetherEdit,
      setTargetAt,
      setCountMode,
      user,
      profile,
    ]
  );

  return <TogetherContext.Provider value={value}>{children}</TogetherContext.Provider>;
}

export function useTogether() {
  const ctx = useContext(TogetherContext);
  if (!ctx) throw new Error('useTogether must be used within TogetherProvider');
  return ctx;
}

