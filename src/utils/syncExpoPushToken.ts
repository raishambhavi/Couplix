import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import { updateDoc } from 'firebase/firestore';

import { firebaseAuth } from '../config/firebase';
import { profileDoc } from './profileDoc';

export async function syncExpoPushTokenToProfile(): Promise<void> {
  const user = firebaseAuth.currentUser;
  if (!user) return;

  if (!Device.isDevice) {
    if (__DEV__) console.warn('[Push] Simulator / Expo Go: push token skipped');
    return;
  }

  const { status: existing } = await Notifications.getPermissionsAsync();
  let granted = existing === 'granted';
  if (!granted) {
    const req = await Notifications.requestPermissionsAsync();
    granted = !!req.granted;
  }
  if (!granted) return;

  const projectId =
    (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)?.eas?.projectId ??
    process.env.EXPO_PUBLIC_EAS_PROJECT_ID;
  if (!projectId || String(projectId).trim() === '') {
    if (__DEV__) console.warn('[Push] Set EAS project id in app.json extra.eas.projectId or EXPO_PUBLIC_EAS_PROJECT_ID');
    return;
  }

  const tokenData = await Notifications.getExpoPushTokenAsync({ projectId: String(projectId) });
  const token = tokenData.data;
  if (!token) return;

  const now = Date.now();
  await updateDoc(profileDoc(user.uid), {
    expoPushToken: token,
    expoPushTokenUpdatedAt: now,
    updatedAt: now,
  });
}
