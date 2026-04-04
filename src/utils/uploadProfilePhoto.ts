import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { Platform } from 'react-native';
import { File as ExpoFile, Paths } from 'expo-file-system';
import { copyAsync, uploadAsync, FileSystemUploadType } from 'expo-file-system/legacy';

import { firebaseApp, firebaseAuth, firebaseStorage } from '../config/firebase';

function needsContentCopy(uri: string): boolean {
  const u = uri.toLowerCase();
  return (
    u.startsWith('content://') ||
    u.startsWith('ph://') ||
    u.startsWith('assets-library://') ||
    u.startsWith('ipod-library://') ||
    (Platform.OS === 'android' && !u.startsWith('file://'))
  );
}

/** Stable `file://` path for reading (ImagePicker often returns `content://` on Android). */
async function resolveReadableFileUri(uri: string): Promise<string> {
  if (needsContentCopy(uri)) {
    const dest = new ExpoFile(Paths.cache, `couplix_profile_${Date.now()}.jpg`);
    await copyAsync({ from: uri, to: dest.uri });
    return dest.uri;
  }
  return uri;
}

/**
 * iOS/Android: Firebase `uploadBytes` / `uploadString` build a Blob from binary data; React Native's
 * Blob only allows string or Blob parts, so it throws "Creating blobs from 'ArrayBuffer'...".
 * Upload the file natively via Expo, then resolve the public URL with the Storage SDK (metadata GET only).
 */
async function uploadLocalFileToProfileStorage(params: { uid: string; fileUri: string }): Promise<string> {
  const { uid, fileUri } = params;
  const user = firebaseAuth.currentUser;
  if (!user || user.uid !== uid) {
    throw new Error('You must be signed in to upload a photo.');
  }

  const bucket = firebaseApp.options.storageBucket as string | undefined;
  if (!bucket || !String(bucket).trim()) {
    throw new Error('Firebase storageBucket is not configured.');
  }

  const objectPath = `users/${uid}/profile_${Date.now()}.jpg`;
  const uploadUrl =
    `https://firebasestorage.googleapis.com/v0/b/${encodeURIComponent(bucket)}/o?` +
    new URLSearchParams({ name: objectPath, uploadType: 'media' }).toString();

  const idToken = await user.getIdToken();
  const result = await uploadAsync(uploadUrl, fileUri, {
    httpMethod: 'POST',
    uploadType: FileSystemUploadType.BINARY_CONTENT,
    headers: {
      Authorization: `Bearer ${idToken}`,
      'Content-Type': 'image/jpeg',
    },
  });

  if (result.status < 200 || result.status >= 300) {
    const snippet = result.body?.slice(0, 280) ?? '';
    throw new Error(`Storage upload failed (${result.status}): ${snippet}`);
  }

  return getDownloadURL(ref(firebaseStorage, objectPath));
}

export async function uploadProfilePhoto(params: { uid: string; uri: string }) {
  const { uid, uri } = params;

  if (Platform.OS === 'web') {
    const objectRef = ref(firebaseStorage, `users/${uid}/profile_${Date.now()}.jpg`);
    const res = await fetch(uri);
    const blob = await res.blob();
    await uploadBytes(objectRef, blob as Blob, { contentType: 'image/jpeg' });
    return getDownloadURL(objectRef);
  }

  const readUri = await resolveReadableFileUri(uri);
  return uploadLocalFileToProfileStorage({ uid, fileUri: readUri });
}
