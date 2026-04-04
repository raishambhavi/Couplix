import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';

import { firebaseDb } from '../config/firebase';
import { FIRESTORE_SYNC_FLAGS } from '../config/firestoreSyncFlags';
import { daySeedIndex, getTaskList, taskKey } from '../data/coupleTasks';
import { useAuth } from './AuthContext';
import { usePairing } from './PairingContext';

const ENABLE_TASK_FIRESTORE_SYNC = FIRESTORE_SYNC_FLAGS.task;

export type TaskCompletion = { me: boolean; partner: boolean };

type ModeBucket = {
  focusDate: string;
  activeIndex: number;
};

type TaskContextValue = {
  list: readonly string[];
  activeIndex: number;
  currentTaskText: string;
  currentTaskId: string;
  completion: TaskCompletion;
  coupleScorePercent: number;
  dualCompleteCount: number; // mode-aware score count
  toggleMyComplete: () => void;
  togglePartnerComplete: () => void;
  nextTask: () => void;
  ensureCalendarDay: () => void;
};

const TaskContext = createContext<TaskContextValue | null>(null);

function dateKey(d = new Date()) {
  return d.toISOString().slice(0, 10);
}

export function TaskProvider({ children }: { children: React.ReactNode }) {
  const { coupleCode, coupleMode, coupleMembershipReady } = usePairing();
  const { user } = useAuth();
  const [hydrated, setHydrated] = useState(false);
  const [modeState, setModeState] = useState<{ together: ModeBucket; longDistance: ModeBucket }>({
    together: { focusDate: '', activeIndex: 0 },
    longDistance: { focusDate: '', activeIndex: 0 },
  });
  const [completions, setCompletions] = useState<Record<string, TaskCompletion>>({});
  const lastRemoteSnapshotRef = useRef<string>('');
  const modeStateRef = useRef(modeState);
  const completionsRef = useRef(completions);

  const storageKey = coupleCode ? `tasks:${coupleCode}` : 'tasks:local';
  const taskDocRef = useMemo(
    () => (coupleCode ? doc(firebaseDb, 'couples', coupleCode, 'state', 'tasks') : null),
    [coupleCode]
  );

  const list = useMemo(() => getTaskList(coupleMode), [coupleMode]);

  useEffect(() => {
    modeStateRef.current = modeState;
    completionsRef.current = completions;
  }, [modeState, completions]);

  useEffect(() => {
    if (ENABLE_TASK_FIRESTORE_SYNC && coupleCode && user && taskDocRef) return;
    let cancelled = false;
    setHydrated(false);
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(storageKey);
        if (cancelled) return;
        if (raw) {
          const parsed = JSON.parse(raw) as {
            modeState?: { together: ModeBucket; longDistance: ModeBucket };
            completions?: Record<string, TaskCompletion>;
          };
          if (parsed.modeState) setModeState(parsed.modeState);
          if (parsed.completions) setCompletions(parsed.completions);
        }
      } catch {
        // ignore
      } finally {
        if (!cancelled) setHydrated(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [storageKey]);

  useEffect(() => {
    if (!ENABLE_TASK_FIRESTORE_SYNC) return;
    if (!coupleCode || !user || !taskDocRef || !coupleMembershipReady) return;
    setHydrated(false);
    const unsub = onSnapshot(
      taskDocRef,
      (snap) => {
        const x = snap.data() as any;
        const nextModeState = x?.modeState ?? modeStateRef.current;
        const nextCompletions = x?.completions ?? completionsRef.current;
        const remoteSig = JSON.stringify({ modeState: nextModeState, completions: nextCompletions });
        if (remoteSig === lastRemoteSnapshotRef.current) {
          setHydrated(true);
          return;
        }
        lastRemoteSnapshotRef.current = remoteSig;
        setModeState(nextModeState);
        setCompletions(nextCompletions);
        setHydrated(true);
      },
      () => setHydrated(true)
    );
    return () => unsub();
  }, [coupleCode, user, taskDocRef, coupleMembershipReady]);

  useEffect(() => {
    if (!hydrated) return;
    if (ENABLE_TASK_FIRESTORE_SYNC && coupleCode && user && taskDocRef && coupleMembershipReady) {
      const localSig = JSON.stringify({ modeState, completions });
      if (localSig === lastRemoteSnapshotRef.current) return;
      lastRemoteSnapshotRef.current = localSig;
      setDoc(taskDocRef, { modeState, completions }, { merge: true }).catch(() => {});
      return;
    }
    AsyncStorage.setItem(storageKey, JSON.stringify({ modeState, completions })).catch(() => {});
  }, [hydrated, storageKey, modeState, completions, coupleCode, user, taskDocRef, coupleMembershipReady]);

  const ensureCalendarDay = useCallback(() => {
    const tk = dateKey();
    setModeState((prev) => {
      const lenT = getTaskList('together').length;
      const lenL = getTaskList('longDistance').length;
      let next = { ...prev };
      if (prev.together.focusDate !== tk) {
        next = {
          ...next,
          together: { focusDate: tk, activeIndex: daySeedIndex(tk, lenT) },
        };
      }
      if (prev.longDistance.focusDate !== tk) {
        next = {
          ...next,
          longDistance: { focusDate: tk, activeIndex: daySeedIndex(tk, lenL) },
        };
      }
      return next;
    });
  }, []);

  const activeIndex =
    coupleMode === 'together' ? modeState.together.activeIndex : modeState.longDistance.activeIndex;

  const safeIndex = list.length ? Math.min(Math.max(0, activeIndex), list.length - 1) : 0;
  const currentTaskId = taskKey(coupleMode, safeIndex);
  const currentTaskText = list.length ? list[safeIndex]! : '';

  const completion = useMemo(() => {
    const c = completions[currentTaskId];
    const me = c?.me ?? false;
    const partner = c?.partner ?? false;
    return { me, partner };
  }, [completions, currentTaskId]);

  const dualCompleteCount = useMemo(() => {
    let n = 0;
    for (let i = 0; i < list.length; i++) {
      const id = taskKey(coupleMode, i);
      const co = completions[id];
      if (coupleMode === 'together') {
        if (co?.me) n++;
      } else {
        if (co?.me && co?.partner) n++;
      }
    }
    return n;
  }, [list, coupleMode, completions]);

  const coupleScorePercent = useMemo(() => {
    if (!list.length) return 0;
    return Math.round((dualCompleteCount / list.length) * 100);
  }, [dualCompleteCount, list.length]);

  const toggleMyComplete = useCallback(() => {
    setCompletions((prev) => {
      const cur = prev[currentTaskId] ?? { me: false, partner: false };
      return {
        ...prev,
        [currentTaskId]: { ...cur, me: !cur.me },
      };
    });
  }, [currentTaskId]);

  const togglePartnerComplete = useCallback(() => {
    setCompletions((prev) => {
      const cur = prev[currentTaskId] ?? { me: false, partner: false };
      return {
        ...prev,
        [currentTaskId]: { ...cur, partner: !cur.partner },
      };
    });
  }, [currentTaskId]);

  const nextTask = useCallback(() => {
    if (!list.length) return;
    setModeState((prev) => {
      const m = coupleMode;
      const cur = prev[m];
      const nextIdx = (cur.activeIndex + 1) % list.length;
      return { ...prev, [m]: { ...cur, activeIndex: nextIdx } };
    });
  }, [coupleMode, list.length]);

  const value = useMemo<TaskContextValue>(
    () => ({
      list,
      activeIndex: safeIndex,
      currentTaskText,
      currentTaskId,
      completion,
      coupleScorePercent,
      dualCompleteCount,
      toggleMyComplete,
      togglePartnerComplete,
      nextTask,
      ensureCalendarDay,
    }),
    [
      list,
      safeIndex,
      currentTaskText,
      currentTaskId,
      completion,
      coupleScorePercent,
      dualCompleteCount,
      toggleMyComplete,
      togglePartnerComplete,
      nextTask,
      ensureCalendarDay,
    ]
  );

  return <TaskContext.Provider value={value}>{children}</TaskContext.Provider>;
}

export function useTasks() {
  const ctx = useContext(TaskContext);
  if (!ctx) throw new Error('useTasks must be used within TaskProvider');
  return ctx;
}
