import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

import { firebaseStorage } from '../config/firebase';

/** Upload voice or image for Night Note; partner can read via couple membership. */
export async function uploadNightNoteFile(params: {
  coupleCode: string;
  uid: string;
  uri: string;
  kind: 'voice' | 'image';
}): Promise<string> {
  const { coupleCode, uid, uri, kind } = params;
  let sourceUri = uri;
  if (kind === 'image' && !/^https?:\/\//i.test(uri)) {
    try {
      const out = await ImageManipulator.manipulate(uri).renderAsync();
      const saved = await out.saveAsync({ compress: 0.72, format: SaveFormat.JPEG });
      if (saved?.uri) sourceUri = saved.uri;
    } catch {
      // keep original
    }
  }
  const res = await fetch(sourceUri);
  const blob = await res.blob();
  const fileName =
    kind === 'voice' ? `voice_${Date.now()}.m4a` : `image_${Date.now()}.jpg`;
  const contentType =
    blob.type && blob.type !== 'application/octet-stream'
      ? blob.type
      : kind === 'voice'
        ? 'audio/mp4'
        : 'image/jpeg';
  const path = `couples/${coupleCode}/night_note/${uid}/${fileName}`;
  const objectRef = ref(firebaseStorage, path);
  await uploadBytes(objectRef, blob as any, { contentType } as any);
  return getDownloadURL(objectRef);
}
