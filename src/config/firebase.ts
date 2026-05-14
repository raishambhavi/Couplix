import AsyncStorage from '@react-native-async-storage/async-storage';
import { initializeApp, getApps } from 'firebase/app';
import {
  getAuth,
  initializeAuth,
  // Metro resolves RN auth; web typings omit this.
  // @ts-expect-error RN bundle exports getReactNativePersistence
  getReactNativePersistence,
} from 'firebase/auth';
import { getFirestore, initializeFirestore, memoryLocalCache } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

// Keep resilient defaults for release builds. EXPO_PUBLIC_* values are replaced at build time,
// but if a cloud build misses env injection we still boot using these public Firebase identifiers.
const FALLBACK_FIREBASE_CONFIG = {
  apiKey: 'AIzaSyAwlkuTeD8TfCmwu3pqrvt4kyMqLGV3nDs',
  authDomain: 'yonder-d9ff2.firebaseapp.com',
  projectId: 'yonder-d9ff2',
  storageBucket: 'yonder-d9ff2.firebasestorage.app',
  messagingSenderId: '881324802867',
  appId: '1:881324802867:web:216e67b8af3f335f33b446',
} as const;

function envOrFallback(key: string, fallback: string): string {
  const raw = (process.env as Record<string, string | undefined>)[key];
  const trimmed = typeof raw === 'string' ? raw.trim() : '';
  return trimmed.length > 0 ? trimmed : fallback;
}

const firebaseConfig = {
  apiKey: envOrFallback('EXPO_PUBLIC_FIREBASE_API_KEY', FALLBACK_FIREBASE_CONFIG.apiKey),
  authDomain: envOrFallback('EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN', FALLBACK_FIREBASE_CONFIG.authDomain),
  projectId: envOrFallback('EXPO_PUBLIC_FIREBASE_PROJECT_ID', FALLBACK_FIREBASE_CONFIG.projectId),
  storageBucket: envOrFallback('EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET', FALLBACK_FIREBASE_CONFIG.storageBucket),
  messagingSenderId: envOrFallback(
    'EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID',
    FALLBACK_FIREBASE_CONFIG.messagingSenderId
  ),
  appId: envOrFallback('EXPO_PUBLIC_FIREBASE_APP_ID', FALLBACK_FIREBASE_CONFIG.appId),
};

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

function createFirestore() {
  try {
    return initializeFirestore(firebaseApp, {
      localCache: memoryLocalCache(),
      experimentalForceLongPolling: true,
    });
  } catch (e: unknown) {
    const code = e && typeof e === 'object' && 'code' in e ? String((e as { code: string }).code) : '';
    const message = e instanceof Error ? e.message : '';
    if (
      code === 'failed-precondition' ||
      /Firestore has already been started|already initialized/i.test(message)
    ) {
      return getFirestore(firebaseApp);
    }
    throw e;
  }
}

export const firebaseDb = createFirestore();
export const firebaseStorage = getStorage(firebaseApp);

