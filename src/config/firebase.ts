import AsyncStorage from '@react-native-async-storage/async-storage';
import { initializeApp, getApps } from 'firebase/app';
import {
  getAuth,
  initializeAuth,
  // Metro resolves RN auth; web typings omit this.
  // @ts-expect-error RN bundle exports getReactNativePersistence
  getReactNativePersistence,
} from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

// Fill these in via Expo env vars (recommended) or replace with literal strings.
// In Expo, set in your shell before `npx expo start`:
// EXPO_PUBLIC_FIREBASE_API_KEY=...
// EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=...
// EXPO_PUBLIC_FIREBASE_PROJECT_ID=...
// EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=...
// EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
// EXPO_PUBLIC_FIREBASE_APP_ID=...
const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

const missing = Object.entries(firebaseConfig)
  .filter(([, v]) => !v || String(v).trim().length === 0)
  .map(([k]) => k);

if (missing.length) {
  throw new Error(
    `Firebase config missing: ${missing.join(
      ', '
    )}. Set EXPO_PUBLIC_FIREBASE_* env vars and restart Expo with -c.`
  );
}

export const firebaseApp = getApps().length ? getApps()[0] : initializeApp(firebaseConfig as any);

function createAuth() {
  try {
    return initializeAuth(firebaseApp, {
      persistence: getReactNativePersistence(AsyncStorage),
    });
  } catch (e: unknown) {
    const code = e && typeof e === 'object' && 'code' in e ? String((e as { code: string }).code) : '';
    if (code === 'auth/already-initialized') {
      return getAuth(firebaseApp);
    }
    throw e;
  }
}

export const firebaseAuth = createAuth();
export const firebaseDb = getFirestore(firebaseApp);
export const firebaseStorage = getStorage(firebaseApp);

