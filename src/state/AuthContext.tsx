import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  updateEmail,
  updateProfile,
  type User,
} from 'firebase/auth';
import { deleteField, getDoc, setDoc, updateDoc } from 'firebase/firestore';

import { firebaseAuth } from '../config/firebase';
import { profileDoc } from '../utils/profileDoc';

/** One-shot “Welcome back, {name}” on Home after email sign-in (cleared when consumed or on sign-out). */
export const WELCOME_BACK_STORAGE_KEY = 'auth:welcomeBack';

export type UserProfile = {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  phoneNumber: string | null;
  createdAt: number;
  updatedAt: number;
  /** Expo push token for partner notifications (Cloud Functions). */
  expoPushToken?: string | null;
  expoPushTokenUpdatedAt?: number | null;
};

function nonEmpty(s: string | null | undefined): string | null {
  const t = typeof s === 'string' ? s.trim() : '';
  return t.length > 0 ? t : null;
}

/**
 * Prefer Firebase Auth name/photo when set. Firestore can still hold an older photoURL after an
 * update (failed sync or race); preferring Firestore first made the UI revert to the first upload.
 */
function mergeAuthIntoProfile(u: User, p: UserProfile): UserProfile {
  return {
    ...p,
    uid: p.uid || u.uid,
    email: p.email ?? u.email ?? null,
    displayName: nonEmpty(u.displayName) ?? nonEmpty(p.displayName),
    photoURL: nonEmpty(u.photoURL) ?? nonEmpty(p.photoURL),
  };
}

function coerceProfileFromFirestore(data: Record<string, unknown> | undefined, u: User, fallbackNow: number): UserProfile {
  const d = data ?? {};
  return {
    uid: typeof d.uid === 'string' ? d.uid : u.uid,
    email: typeof d.email === 'string' ? d.email : u.email ?? null,
    displayName: typeof d.displayName === 'string' ? d.displayName : null,
    photoURL: typeof d.photoURL === 'string' ? d.photoURL : null,
    phoneNumber: typeof d.phoneNumber === 'string' ? d.phoneNumber : null,
    createdAt: typeof d.createdAt === 'number' ? d.createdAt : fallbackNow,
    updatedAt: typeof d.updatedAt === 'number' ? d.updatedAt : fallbackNow,
    expoPushToken: typeof d.expoPushToken === 'string' ? d.expoPushToken : undefined,
    expoPushTokenUpdatedAt: typeof d.expoPushTokenUpdatedAt === 'number' ? d.expoPushTokenUpdatedAt : undefined,
  };
}

/** Full users/{uid} payload for setDoc(merge) — satisfies strict hasOnlyKeys after merge. */
function profilePayloadForFirestore(u: User, p: UserProfile): Record<string, unknown> {
  const o: Record<string, unknown> = {
    uid: u.uid,
    email: p.email ?? u.email ?? null,
    displayName: p.displayName ?? null,
    photoURL: p.photoURL ?? null,
    phoneNumber: p.phoneNumber ?? null,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  };
  if (p.expoPushToken != null && String(p.expoPushToken).length > 0) {
    o.expoPushToken = p.expoPushToken;
    if (p.expoPushTokenUpdatedAt != null) o.expoPushTokenUpdatedAt = p.expoPushTokenUpdatedAt;
  }
  return o;
}

async function persistUserProfileDoc(u: User, p: UserProfile): Promise<void> {
  await setDoc(profileDoc(u.uid), profilePayloadForFirestore(u, p), { merge: true });
}

type AuthContextValue = {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  signUp: (email: string, password: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  setDisplayName: (name: string) => Promise<void>;
  setPhotoURL: (url: string) => Promise<void>;
  updateEmail: (email: string) => Promise<void>;
  setPhoneNumber: (phone: string) => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  /** Ignore late Firestore profile results if the user signed out while getDoc was in flight. */
  const authSessionUidRef = useRef<string | null>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(firebaseAuth, async (u) => {
      const uid = u?.uid ?? null;
      authSessionUidRef.current = uid;
      setUser(u);
      setProfile(null);
      if (!u) {
        setLoading(false);
        return;
      }

      try {
        let authUser: User = u;
        try {
          await u.reload();
          const next = firebaseAuth.currentUser;
          if (next && next.uid === u.uid) {
            authUser = next;
            setUser(next);
          }
        } catch {
          // offline / transient — keep pre-reload user
        }

        const snap = await getDoc(profileDoc(authUser.uid));
        if (authSessionUidRef.current !== authUser.uid) return;
        const now = Date.now();
        let p: UserProfile;
        if (!snap.exists()) {
          p = {
            uid: authUser.uid,
            email: authUser.email ?? null,
            displayName: authUser.displayName ?? null,
            photoURL: authUser.photoURL ?? null,
            phoneNumber: null,
            createdAt: now,
            updatedAt: now,
          };
          await persistUserProfileDoc(authUser, p);
        } else {
          const raw = coerceProfileFromFirestore(snap.data() as Record<string, unknown>, authUser, now);
          p = mergeAuthIntoProfile(authUser, raw);
          try {
            await persistUserProfileDoc(authUser, { ...p, updatedAt: now });
          } catch (e) {
            if (__DEV__) console.warn('[Auth] Firestore profile sync on login failed:', e);
          }
        }
        if (authSessionUidRef.current !== authUser.uid) return;
        setProfile(p);
      } catch {
        if (authSessionUidRef.current !== u.uid) return;
        setProfile({
          uid: u.uid,
          email: u.email ?? null,
          displayName: u.displayName ?? null,
          photoURL: u.photoURL ?? null,
          phoneNumber: null,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      } finally {
        if (authSessionUidRef.current === u.uid) setLoading(false);
      }
    });
    return () => unsub();
  }, []);

  const signUp = async (email: string, password: string) => {
    await createUserWithEmailAndPassword(firebaseAuth, email, password);
  };

  const signIn = async (email: string, password: string) => {
    await signInWithEmailAndPassword(firebaseAuth, email, password);
  };

  const doSignOut = async () => {
    setLoading(true);
    try {
      await AsyncStorage.removeItem(WELCOME_BACK_STORAGE_KEY).catch(() => {});
      const u = firebaseAuth.currentUser;
      if (u) {
        try {
          await updateDoc(profileDoc(u.uid), {
            expoPushToken: deleteField(),
            expoPushTokenUpdatedAt: deleteField(),
            updatedAt: Date.now(),
          });
        } catch {
          // ignore
        }
      }
      await signOut(firebaseAuth);
    } catch (e) {
      setLoading(false);
      throw e;
    }
  };

  const setDisplayNameFn = async (name: string) => {
    const u = firebaseAuth.currentUser;
    if (!u) return;
    await updateProfile(u, { displayName: name });
    const now = Date.now();
    setProfile((prev) => {
      const base =
        prev ??
        ({
          uid: u.uid,
          email: u.email ?? null,
          displayName: null,
          photoURL: null,
          phoneNumber: null,
          createdAt: now,
          updatedAt: now,
        } as UserProfile);
      return { ...base, displayName: name, updatedAt: now };
    });
    try {
      const snap = await getDoc(profileDoc(u.uid));
      const raw = snap.exists()
        ? coerceProfileFromFirestore(snap.data() as Record<string, unknown>, u, now)
        : ({
            uid: u.uid,
            email: u.email ?? null,
            displayName: null,
            photoURL: null,
            phoneNumber: null,
            createdAt: now,
            updatedAt: now,
          } as UserProfile);
      const next: UserProfile = mergeAuthIntoProfile(u, { ...raw, displayName: name, updatedAt: now });
      await persistUserProfileDoc(u, next);
    } catch (e) {
      if (__DEV__) console.warn('[Auth] Firestore users/{uid} displayName sync failed:', e);
    }
  };

  const setPhotoURLFn = async (url: string) => {
    const u = firebaseAuth.currentUser;
    if (!u) return;
    await updateProfile(u, { photoURL: url });
    const now = Date.now();
    setProfile((prev) => {
      const base =
        prev ??
        ({
          uid: u.uid,
          email: u.email ?? null,
          displayName: null,
          photoURL: null,
          phoneNumber: null,
          createdAt: now,
          updatedAt: now,
        } as UserProfile);
      return { ...base, photoURL: url, updatedAt: now };
    });
    try {
      const snap = await getDoc(profileDoc(u.uid));
      const raw = snap.exists()
        ? coerceProfileFromFirestore(snap.data() as Record<string, unknown>, u, now)
        : ({
            uid: u.uid,
            email: u.email ?? null,
            displayName: null,
            photoURL: null,
            phoneNumber: null,
            createdAt: now,
            updatedAt: now,
          } as UserProfile);
      const next: UserProfile = mergeAuthIntoProfile(u, { ...raw, photoURL: url, updatedAt: now });
      await persistUserProfileDoc(u, next);
    } catch (e) {
      if (__DEV__) console.warn('[Auth] Firestore users/{uid} photoURL sync failed:', e);
    }
  };

  const updateEmailFn = async (email: string) => {
    const u = firebaseAuth.currentUser;
    if (!u) return;
    await updateEmail(u, email);
    try {
      const snap = await getDoc(profileDoc(u.uid));
      const now = Date.now();
      const raw = snap.exists()
        ? coerceProfileFromFirestore(snap.data() as Record<string, unknown>, u, now)
        : ({
            uid: u.uid,
            email: null,
            displayName: null,
            photoURL: null,
            phoneNumber: null,
            createdAt: now,
            updatedAt: now,
          } as UserProfile);
      await persistUserProfileDoc(u, mergeAuthIntoProfile(u, { ...raw, email, updatedAt: now }));
    } catch (e) {
      if (__DEV__) console.warn('[Auth] Firestore email sync failed:', e);
    }
  };

  const setPhoneNumberFn = async (phoneNumber: string) => {
    const u = firebaseAuth.currentUser;
    if (!u) return;
    const now = Date.now();
    setProfile((prev) => (prev ? { ...prev, phoneNumber, updatedAt: now } : prev));
    try {
      const snap = await getDoc(profileDoc(u.uid));
      const raw = snap.exists()
        ? coerceProfileFromFirestore(snap.data() as Record<string, unknown>, u, now)
        : ({
            uid: u.uid,
            email: u.email ?? null,
            displayName: null,
            photoURL: null,
            phoneNumber: null,
            createdAt: now,
            updatedAt: now,
          } as UserProfile);
      await persistUserProfileDoc(u, mergeAuthIntoProfile(u, { ...raw, phoneNumber, updatedAt: now }));
    } catch (e) {
      if (__DEV__) console.warn('[Auth] Firestore phone sync failed:', e);
    }
  };

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      profile,
      loading,
      signUp,
      signIn,
      signOut: doSignOut,
      setDisplayName: setDisplayNameFn,
      setPhotoURL: setPhotoURLFn,
      updateEmail: updateEmailFn,
      setPhoneNumber: setPhoneNumberFn,
    }),
    [user, profile, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
