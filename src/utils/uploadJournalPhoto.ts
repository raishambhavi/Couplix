import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';

import { firebaseStorage } from '../config/firebase';

function photoMeta(uri: string): { fileName: string; contentType: string } {
  const u = uri.toLowerCase();
  if (u.includes('.png')) return { fileName: 'photo.png', contentType: 'image/png' };
  if (u.includes('.webp')) return { fileName: 'photo.webp', contentType: 'image/webp' };
  return { fileName: 'photo.jpg', contentType: 'image/jpeg' };
}

export async function uploadJournalPhoto(params: { coupleCode: string; entryId: string; uri: string }): Promise<string> {
  const { coupleCode, entryId, uri } = params;
  const res = await fetch(uri);
  const blob = await res.blob();
  const meta = photoMeta(uri);
  const contentType = blob.type && blob.type !== 'application/octet-stream' ? blob.type : meta.contentType;
  const path = `couples/${coupleCode}/journal/${entryId}/${meta.fileName}`;
  const objectRef = ref(firebaseStorage, path);
  await uploadBytes(objectRef, blob as any, { contentType } as any);
  return getDownloadURL(objectRef);
}
