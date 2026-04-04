import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

import { firebaseStorage } from '../config/firebase';

function photoFileName(uri: string): { fileName: string; contentType: string } {
  const u = uri.toLowerCase();
  if (u.includes('.png')) return { fileName: 'photo.png', contentType: 'image/png' };
  if (u.includes('.webp')) return { fileName: 'photo.webp', contentType: 'image/webp' };
  return { fileName: 'photo.jpg', contentType: 'image/jpeg' };
}

/** Uploads chat photo or voice file to Storage; returns HTTPS download URL for Firestore. */
export async function uploadChatMedia(params: {
  coupleCode: string;
  messageId: string;
  uri: string;
  kind: 'photo' | 'voice';
}): Promise<string> {
  const { coupleCode, messageId, kind } = params;
  const meta =
    kind === 'photo'
      ? photoFileName(params.uri)
      : { fileName: 'voice.m4a', contentType: 'audio/mp4' };

  // Normalize large originals before upload so Storage size rules pass reliably on iPhone photos.
  let sourceUri = params.uri;
  if (kind === 'photo' && !/^https?:\/\//i.test(sourceUri)) {
    try {
      const out = await ImageManipulator.manipulate(sourceUri).renderAsync();
      const saved = await out.saveAsync({
        compress: 0.72,
        format: SaveFormat.JPEG,
      });
      if (saved?.uri) sourceUri = saved.uri;
    } catch {
      // Fall back to original URI if manipulation fails.
    }
  }

  const res = await fetch(sourceUri);
  const blob = await res.blob();
  const contentType =
    blob.type && blob.type !== 'application/octet-stream' ? blob.type : meta.contentType;
  const path = `couples/${coupleCode}/chat_media/${messageId}/${meta.fileName}`;
  const objectRef = ref(firebaseStorage, path);
  await uploadBytes(objectRef, blob as any, { contentType } as any);
  return getDownloadURL(objectRef);
}

/** Journal photo stored under couple scope for Shared Journal sync. */
export async function uploadJournalPhoto(params: {
  coupleCode: string;
  entryId: string;
  uri: string;
}): Promise<string> {
  return uploadChatMedia({
    coupleCode: params.coupleCode,
    messageId: `journal_${params.entryId}`,
    uri: params.uri,
    kind: 'photo',
  });
}

/** Trip pin photo — same security rules as chat_media; partners read via HTTPS URL in Firestore. */
export async function uploadTripPhoto(params: {
  coupleCode: string;
  tripId: string;
  uri: string;
}): Promise<string> {
  return uploadChatMedia({
    coupleCode: params.coupleCode,
    messageId: `trip_pin_${params.tripId}`,
    uri: params.uri,
    kind: 'photo',
  });
}
