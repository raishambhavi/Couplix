/**
 * Firestore `onSnapshot` teardown during React commit/unmount can trigger
 * INTERNAL ASSERTION FAILED (ca9 / b815). Defer unsubscribe to the next macrotask.
 * @see https://github.com/firebase/firebase-js-sdk/issues/8856
 * @see https://github.com/firebase/firebase-js-sdk/issues/9267
 */
export function deferFirestoreUnsubscribe(unsub?: () => void): void {
  if (!unsub) return;
  const u = unsub;
  setTimeout(() => {
    try {
      u();
    } catch {
      // Ignore teardown races; SDK can throw during broken internal state.
    }
  }, 0);
}
