// Global Firestore switch for safe demos/testing.
// Default is OFF unless EXPO_PUBLIC_FIRESTORE_SYNC is explicitly true/1/yes/on.
const firestoreGlobalEnabled = (() => {
  const raw = String(process.env.EXPO_PUBLIC_FIRESTORE_SYNC ?? '')
    .trim()
    .toLowerCase();
  return raw === 'true' || raw === '1' || raw === 'yes' || raw === 'on';
})();

// Per-module rollout switches.
// Staged sync: Stage 9 = all modules on (softLocation, nudge, heartbeat + prior stages).
const MODULE_ROLLOUT = {
  pairing: true,
  chat: true,
  task: true,
  together: true,
  rituals: true,
  snap: true,
  heartbeat: true,
  nudge: true,
  softLocation: true,
  sharedSky: true,
  mood: true,
} as const;

// Effective flags = global switch + per-module rollout.
export const FIRESTORE_SYNC_FLAGS = {
  pairing: firestoreGlobalEnabled && MODULE_ROLLOUT.pairing,
  chat: firestoreGlobalEnabled && MODULE_ROLLOUT.chat,
  task: firestoreGlobalEnabled && MODULE_ROLLOUT.task,
  together: firestoreGlobalEnabled && MODULE_ROLLOUT.together,
  rituals: firestoreGlobalEnabled && MODULE_ROLLOUT.rituals,
  snap: firestoreGlobalEnabled && MODULE_ROLLOUT.snap,
  heartbeat: firestoreGlobalEnabled && MODULE_ROLLOUT.heartbeat,
  nudge: firestoreGlobalEnabled && MODULE_ROLLOUT.nudge,
  softLocation: firestoreGlobalEnabled && MODULE_ROLLOUT.softLocation,
  sharedSky: firestoreGlobalEnabled && MODULE_ROLLOUT.sharedSky,
  mood: firestoreGlobalEnabled && MODULE_ROLLOUT.mood,
} as const;

