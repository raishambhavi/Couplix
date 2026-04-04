import React, { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';

import { useAuth } from '../state/AuthContext';
import { useSettings } from '../state/SettingsContext';
import { syncExpoPushTokenToProfile } from '../utils/syncExpoPushToken';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

let androidChannelReady = false;
async function ensureAndroidDefaultChannel() {
  if (Platform.OS !== 'android' || androidChannelReady) return;
  await Notifications.setNotificationChannelAsync('default', {
    name: 'Couplix',
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 280, 120, 280],
    sound: 'default',
    enableVibrate: true,
    showBadge: true,
  });
  androidChannelReady = true;
}

/**
 * Registers the device Expo push token on the signed-in user profile so Cloud Functions
 * can notify the partner. Re-runs when notification preference toggles on.
 */
export function ExpoPushRegistration() {
  const { user } = useAuth();
  const { notificationsEnabled } = useSettings();
  const lastUid = useRef<string | null>(null);

  useEffect(() => {
    ensureAndroidDefaultChannel().catch(() => {});
  }, []);

  useEffect(() => {
    if (!user?.uid) {
      lastUid.current = null;
      return;
    }
    if (!notificationsEnabled) return;

    let cancelled = false;
    (async () => {
      try {
        await syncExpoPushTokenToProfile();
        if (!cancelled) lastUid.current = user.uid;
      } catch (e) {
        if (__DEV__) console.warn('[Push] syncExpoPushTokenToProfile', e);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user?.uid, notificationsEnabled]);

  return null;
}
