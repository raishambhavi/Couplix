import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';

type SettingsState = {
  notificationsEnabled: boolean;
  soundEnabled: boolean;
  vibrationEnabled: boolean;
  notificationTone: string;
  quietHoursEnabled: boolean;
  quietStart: string; // HH:mm
  quietEnd: string; // HH:mm
};

type SettingsContextValue = SettingsState & {
  requestNotificationPermission: () => Promise<boolean>;
  sendTestNotification: () => Promise<void>;
  sendNotification: (body: string) => Promise<void>;
  isWithinQuietHours: () => boolean;
  setNotificationsEnabled: (v: boolean) => void;
  setSoundEnabled: (v: boolean) => void;
  setVibrationEnabled: (v: boolean) => void;
  setNotificationTone: (v: string) => void;
  setQuietHoursEnabled: (v: boolean) => void;
  setQuietStart: (v: string) => void;
  setQuietEnd: (v: string) => void;
};

const SettingsContext = createContext<SettingsContextValue | null>(null);

const STORAGE_KEY = 'settings:v1';

function defaultState(): SettingsState {
  return {
    notificationsEnabled: true,
    soundEnabled: true,
    vibrationEnabled: true,
    notificationTone: 'Tri-tone',
    quietHoursEnabled: false,
    quietStart: '21:00',
    quietEnd: '07:00',
  };
}

function parseHHMM(value: string) {
  const [hh, mm] = value.split(':').map((x) => Number(x));
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return null;
  return { hh, mm };
}

function nowMinutes() {
  const d = new Date();
  return d.getHours() * 60 + d.getMinutes();
}

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<SettingsState>(defaultState);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (!raw) return;
        const parsed = JSON.parse(raw) as Partial<SettingsState>;
        if (!mounted) return;
        setState((prev) => ({
          ...prev,
          ...parsed,
        }));
      } catch {
        // ignore
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const persist = (next: SettingsState) => {
    setState(next);
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
  };

  const isWithinQuietHours = useMemo(() => {
    return () => {
      if (!state.quietHoursEnabled) return false;
      const start = parseHHMM(state.quietStart);
      const end = parseHHMM(state.quietEnd);
      if (!start || !end) return false;
      const n = nowMinutes();
      const s = start.hh * 60 + start.mm;
      const e = end.hh * 60 + end.mm;

      // Handles overnight ranges (e.g., 21:00 -> 07:00).
      if (s <= e) return n >= s && n < e;
      return n >= s || n < e;
    };
  }, [state.quietHoursEnabled, state.quietEnd, state.quietStart]);

  const requestNotificationPermission = async () => {
    try {
      const res = await Notifications.requestPermissionsAsync();
      const granted = res.granted ?? false;
      return granted;
    } catch {
      return false;
    }
  };

  const sendTestNotification = async () => {
    await sendNotification('Test notification: you’re connected.');
  };

  const sendNotification = async (body: string) => {
    if (!state.notificationsEnabled) return;
    if (isWithinQuietHours()) return;

    try {
      const sound = state.soundEnabled ? 'default' : undefined;
      await Notifications.scheduleNotificationAsync({
        content: {
          title: 'Couplix',
          body: state.soundEnabled ? `${body} · ${state.notificationTone}` : body,
          sound,
        },
        trigger: { seconds: 1, type: 'timeInterval' } as any,
      });
    } catch {
      // ignore
    }
  };

  const value = useMemo<SettingsContextValue>(
    () => ({
      ...state,
      isWithinQuietHours,
      requestNotificationPermission,
      sendTestNotification,
      sendNotification,
      setNotificationsEnabled: (v) => persist({ ...state, notificationsEnabled: v }),
      setSoundEnabled: (v) => persist({ ...state, soundEnabled: v }),
      setVibrationEnabled: (v) => persist({ ...state, vibrationEnabled: v }),
      setNotificationTone: (v) => persist({ ...state, notificationTone: v }),
      setQuietHoursEnabled: (v) => persist({ ...state, quietHoursEnabled: v }),
      setQuietStart: (v) => persist({ ...state, quietStart: v }),
      setQuietEnd: (v) => persist({ ...state, quietEnd: v }),
    }),
    [isWithinQuietHours, state]
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used within SettingsProvider');
  return ctx;
}

