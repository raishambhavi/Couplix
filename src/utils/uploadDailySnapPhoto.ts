import { ref, getDownloadURL, uploadBytes } from 'firebase/storage';
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

async function resolveReadableFileUri(uri: string): Promise<string> {
  if (needsContentCopy(uri)) {
    const dest = new ExpoFile(Paths.cache, `couplix_daily_snap_${Date.now()}.jpg`);
    await copyAsync({ from: uri, to: dest.uri });
    return dest.uri;
  }
  return uri;
}

/**
 * Upload a daily snap to shared couple storage so the partner device can load an HTTPS URL
 * (local file:// URIs are not visible on the other phone).
 */
export async function uploadDailySnapPhoto(params: { coupleCode: string; dateKey: string; fileUri: string }) {
  const { coupleCode, dateKey, fileUri } = params;
  const user = firebaseAuth.currentUser;
  if (!user) {
    throw new Error('You must be signed in to send a snap.');
  }

  const bucket = firebaseApp.options.storageBucket as string | undefined;
  if (!bucket || !String(bucket).trim()) {
    throw new Error('Firebase storageBucket is not configured.');
  }

  const objectPath = `couples/${coupleCode}/daily_snaps/${dateKey}_${user.uid}_${Date.now()}.jpg`;

  if (Platform.OS === 'web') {
    const objectRef = ref(firebaseStorage, objectPath);
    const res = await fetch(fileUri);
    const blob = await res.blob();
    await uploadBytes(objectRef, blob as Blob, { contentType: 'image/jpeg' });
    return getDownloadURL(objectRef);
  }

  const readUri = await resolveReadableFileUri(fileUri);
  const uploadUrl =
    `https://firebasestorage.googleapis.com/v0/b/${encodeURIComponent(bucket)}/o?` +
    new URLSearchParams({ name: objectPath, uploadType: 'media' }).toString();

  const idToken = await user.getIdToken();
  const result = await uploadAsync(uploadUrl, readUri, {
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
