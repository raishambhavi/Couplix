import { doc } from 'firebase/firestore';

import { firebaseDb } from '../config/firebase';

export function profileDoc(uid: string) {
  return doc(firebaseDb, 'users', uid);
}
