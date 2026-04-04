# Firestore Rollout Plan (Safe Enablement)

This app already has a global Firestore kill switch and module-level rollout flags.

Use this plan whenever you want to re-enable backend sync without causing quota spikes or runtime instability.

## 1) Current Control Points

- Global switch: `.env`
  - `EXPO_PUBLIC_FIRESTORE_SYNC="false"` -> Firestore disabled everywhere
  - `EXPO_PUBLIC_FIRESTORE_SYNC="true"` -> module flags are respected
- Module flags: `src/config/firestoreSyncFlags.ts`
  - `MODULE_ROLLOUT` controls which modules are active
  - Keep all modules `false` by default

## 2) Enable Order (One Module at a Time)

Use this exact order:

1. `pairing`
2. `together`
3. `rituals`
4. `snap`
5. `chat`
6. `task`
7. `mood`
8. `sharedSky`
9. `softLocation`
10. `nudge`
11. `heartbeat`

Reason: low-risk state docs first, then higher-frequency/event-driven features last.

## 3) Rollout Procedure (Per Module)

1. Set in `.env`:
   - `EXPO_PUBLIC_FIRESTORE_SYNC="true"`
2. Turn on exactly one module in `MODULE_ROLLOUT`.
3. Restart Expo with fresh cache:
   - `npx expo start -c`
4. Test on iPhone for 10-15 minutes in active use.
5. Keep module enabled only if all checks pass.

## 4) Validation Checklist (Must Pass)

- No red screens in Expo Go.
- No recurring `resource-exhausted` or Firestore backoff spam.
- No "Maximum update depth exceeded" errors.
- UI remains responsive while typing, scrolling, and navigating.
- Data survives app restart for that module.
- No duplicate data writes or message/task duplication.

If any check fails:

- turn that module back to `false`
- restart with `npx expo start -c`
- keep previous stable modules unchanged

## 5) Rollback (Emergency)

If instability appears at any point:

1. Set `.env` -> `EXPO_PUBLIC_FIRESTORE_SYNC="false"`
2. Restart with `npx expo start -c`

This immediately returns the app to local-safe behavior.

## 6) Notes for Production

- Keep per-module flags as a permanent safety mechanism.
- Prefer debounce/guard patterns for any frequent writes.
- Only enable high-frequency modules after quota headroom is confirmed.

## 7) Two-device QA pass (release gate)

Run with **two physical devices** (or two installs), **same couple code**, production-like config:

**Environment (both devices)**

- [ ] `.env`: `EXPO_PUBLIC_FIRESTORE_SYNC=true` (or equivalent env)
- [ ] Firebase env vars set (`EXPO_PUBLIC_FIREBASE_*`)
- [ ] `EXPO_PUBLIC_EAS_PROJECT_ID` set (push token registration)
- [ ] **Development / preview build** for push (Expo Go is limited for remote push; prefer EAS dev build)

**Pair flow**

- [ ] User A: sign up / sign in, create or join couple code
- [ ] User B: sign in, enter same couple code
- [ ] Both see paired state; restart app — pairing persists

**Chat**

- [ ] A sends text → B receives in real time
- [ ] B sends text → A receives
- [ ] Photo message: image loads on partner device (Storage URL)
- [ ] Voice message: plays on partner device (Storage URL)
- [ ] Airplane mode on one device → toggle off → messages catch up without duplicate rows

**Push notifications**

- [ ] Notifications allowed in OS settings on both devices
- [ ] A sends chat → B gets push (foreground/background as expected)
- [ ] A sends nudge → B gets push
- [ ] (Optional backlog) Heartbeat / Daily Snap — not required for this gate unless you add Cloud Functions for them

**Tasks**

- [ ] Complete a task on A → visible / synced for B per your task UX
- [ ] Daily or session reset behaves as designed

**Rituals**

- [ ] Streak / QOTD / dare state syncs or matches expectations after restart

**Together (mode / journal / countdown)**

- [ ] Switch **together** vs **long distance** on one device — partner sees update
- [ ] Journal / wish jar / countdown updates sync both ways

**Snap (if used)**

- [ ] Daily snap or shared snap state syncs; no rule/permission errors in logs

**Mood / Sky / Soft location (if used)**

- [ ] Updates appear on partner within expected latency

**Settings**

- [ ] Toggle notifications, quiet hours, sound — survives app kill and relaunch
- [ ] Theme preference persists

**Account / edge cases**

- [ ] Sign out on one device — no crash on other; re-sign-in works
- [ ] Deny notification permission — app still usable; token absent is OK

**Backend**

- [ ] `firebase deploy` for rules + functions + storage is current after any rule changes

Record **date**, **build type** (Expo Go vs EAS), and **OS versions** when you sign off this section.

