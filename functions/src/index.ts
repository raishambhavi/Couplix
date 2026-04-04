import { Expo } from 'expo-server-sdk';
import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions/v1';

/** Gen1 Firestore triggers avoid Gen2/Eventarc IAM issues on first deploy. */
const region = functions.region('us-central1');

admin.initializeApp();
const expo = new Expo();

async function getPartnerUid(coupleCode: string, senderUid: string): Promise<string | null> {
  const snap = await admin
    .firestore()
    .collection('couples')
    .doc(coupleCode)
    .collection('members')
    .get();
  const others = snap.docs.map((d) => d.id).filter((id) => id !== senderUid);
  return others[0] ?? null;
}

async function getExpoTokenForUser(uid: string): Promise<string | null> {
  const u = await admin.firestore().doc(`users/${uid}`).get();
  const d = u.data();
  const t = d?.expoPushToken;
  if (typeof t !== 'string' || !Expo.isExpoPushToken(t)) return null;
  return t;
}

async function getUserDisplayName(uid: string): Promise<string> {
  const u = await admin.firestore().doc(`users/${uid}`).get();
  const d = u.data();
  const n = d?.displayName;
  if (typeof n === 'string' && n.trim().length > 0) return n.trim();
  return 'Partner';
}

async function sendPartnerPush(params: {
  coupleCode: string;
  senderUid: string;
  title: string;
  body: string;
  data: Record<string, string>;
}): Promise<void> {
  const { coupleCode, senderUid, title, body, data } = params;
  const partnerUid = await getPartnerUid(coupleCode, senderUid);
  if (!partnerUid) return;
  const token = await getExpoTokenForUser(partnerUid);
  if (!token) return;

  const stringData: Record<string, string> = {};
  for (const [k, v] of Object.entries({ ...data, coupleCode })) {
    stringData[k] = typeof v === 'string' ? v : String(v);
  }

  const messages = [
    {
      to: token,
      sound: 'default' as const,
      title,
      body,
      data: stringData,
      priority: 'high' as const,
      channelId: 'default',
    },
  ];
  const chunks = expo.chunkPushNotifications(messages);
  for (const chunk of chunks) {
    try {
      await expo.sendPushNotificationsAsync(chunk);
    } catch (e) {
      console.error('[push] send failed', e);
    }
  }
}

export const onChatMessageCreated = region.firestore
  .document('couples/{coupleCode}/chat_messages/{messageId}')
  .onCreate(async (snap, context) => {
    const coupleCode = context.params.coupleCode as string;
    const messageId = context.params.messageId as string;
    const data = snap.data();
    const senderUid = data.senderUid as string | undefined;
    if (!senderUid) return;
    const kind = String(data.kind ?? 'text');
    const senderName = (data.senderName as string) || 'Partner';

    let body = 'New message';
    if (kind === 'text' || kind === 'task') {
      const t = data.text as string | undefined;
      body = t && t.length > 0 ? (t.length > 120 ? `${t.slice(0, 117)}…` : t) : body;
    } else if (kind === 'voice') body = `${senderName} sent a voice message`;
    else if (kind === 'photo') body = `${senderName} sent a photo`;

    await sendPartnerPush({
      coupleCode,
      senderUid,
      title: 'Couplix',
      body,
      data: { type: 'chat', kind, messageId },
    });
  });

export const onNudgeCreated = region.firestore
  .document('couples/{coupleCode}/nudges/{docId}')
  .onCreate(async (snap, context) => {
    const coupleCode = context.params.coupleCode as string;
    const data = snap.data();
    const senderUid = data.senderUid as string | undefined;
    if (!senderUid) return;
    const senderName = (data.senderName as string) || 'Partner';

    await sendPartnerPush({
      coupleCode,
      senderUid,
      title: 'Couplix',
      body: `${senderName} nudged you`,
      data: { type: 'nudge' },
    });
  });

export const onHeartbeatCreated = region.firestore
  .document('couples/{coupleCode}/heartbeat_events/{docId}')
  .onCreate(async (snap, context) => {
    const coupleCode = context.params.coupleCode as string;
    const data = snap.data();
    const senderUid = data.senderUid as string | undefined;
    if (!senderUid) return;
    const senderName = (data.senderName as string) || 'Partner';

    await sendPartnerPush({
      coupleCode,
      senderUid,
      title: 'Couplix',
      body: `${senderName} sent you a heartbeat`,
      data: { type: 'heartbeat' },
    });
  });

/**
 * Shared Sky writes are merged into couples/{code}/sky_state/{uid}.
 * Notify partner only when this write actually changes location/update timestamp.
 */
export const onSharedSkyWritten = region.firestore
  .document('couples/{coupleCode}/sky_state/{docId}')
  .onWrite(async (change, context) => {
    if (!change.after.exists) return;
    const coupleCode = context.params.coupleCode as string;
    const after = change.after.data()!;
    const senderUid = (after.uid as string | undefined) ?? (context.params.docId as string | undefined);
    if (!senderUid) return;

    const before = change.before.exists ? change.before.data() : null;
    const sameLocation =
      !!before &&
      Number(before.lat) === Number(after.lat) &&
      Number(before.lon) === Number(after.lon) &&
      Number(before.updatedAtMs) === Number(after.updatedAtMs);
    if (sameLocation) return;

    const senderName = (after.userName as string) || 'Partner';
    await sendPartnerPush({
      coupleCode,
      senderUid,
      title: 'Couplix',
      body: `${senderName} shared sky`,
      data: { type: 'shared_sky' },
    });
  });

/**
 * Soft Location: couples/{code}/soft_location_state/{uid} — broad zones only.
 * Skip writes that only bump updatedAtMs / userName (e.g. screen reopen) so we do not spam.
 */
export const onSoftLocationWritten = region.firestore
  .document('couples/{coupleCode}/soft_location_state/{docId}')
  .onWrite(async (change, context) => {
    if (!change.after.exists) return;
    const coupleCode = context.params.coupleCode as string;
    const after = change.after.data()!;
    const senderUid = (after.uid as string | undefined) ?? (context.params.docId as string);
    if (!senderUid) return;

    const before = change.before.exists ? change.before.data() : null;
    const zoneBefore = before != null ? String(before.currentZone ?? '') : '';
    const zoneAfter = String(after.currentZone ?? '');
    const zonesJson = (z: unknown) =>
      JSON.stringify(Array.isArray(z) ? [...z].map(String).sort() : []);
    const customSame = zonesJson(before?.customZones) === zonesJson(after.customZones);
    const zoneSame = zoneBefore === zoneAfter;

    if (zoneSame && customSame) return;

    const senderName = (after.userName as string) || 'Partner';
    let body: string;
    if (!zoneSame) {
      body = zoneAfter.length > 0 ? `${senderName} is now: ${zoneAfter}` : `${senderName} updated soft location`;
    } else {
      body = `${senderName} updated their soft location`;
    }

    await sendPartnerPush({
      coupleCode,
      senderUid,
      title: 'Couplix',
      body,
      data: { type: 'soft_location' },
    });
  });

/** Mood docs use merge updates on the same uid doc — use onWrite so every dial change can notify. */
export const onMoodWritten = region.firestore
  .document('couples/{coupleCode}/moods/{docId}')
  .onWrite(async (change, context) => {
    const after = change.after.exists ? change.after.data() : null;
    if (!after) return;
    const senderUid = after.uid as string | undefined;
    if (!senderUid) return;
    const before = change.before.exists ? change.before.data() : null;
    if (
      before &&
      before.updatedAtMs === after.updatedAtMs &&
      before.value === after.value &&
      before.label === after.label
    ) {
      return;
    }
    const coupleCode = context.params.coupleCode as string;
    const userName = (after.userName as string) || 'Partner';

    await sendPartnerPush({
      coupleCode,
      senderUid,
      title: 'Couplix',
      body: `${userName} shared a mood`,
      data: { type: 'mood' },
    });
  });

/**
 * Daily Snap state lives in couples/{code}/state/snap with nested dailyByDate[date][senderUid].
 * Notify the partner when a new HTTPS photo URL is written (not caption-only edits).
 */
export const onSnapStateWritten = region.firestore
  .document('couples/{coupleCode}/state/snap')
  .onWrite(async (change, context) => {
    const coupleCode = context.params.coupleCode as string;
    if (!change.after.exists) return;

    const beforeData = change.before.exists ? change.before.data() : undefined;
    const before = beforeData ?? {};
    const after = change.after.data()!;
    const beforeDaily = (before.dailyByDate ?? {}) as Record<string, Record<string, unknown>>;
    const afterDaily = (after.dailyByDate ?? {}) as Record<string, Record<string, unknown>>;

    for (const [dateKey, afterDay] of Object.entries(afterDaily)) {
      if (afterDay == null || typeof afterDay !== 'object') continue;
      const beforeDay = beforeDaily[dateKey] ?? {};
      for (const [senderUid, raw] of Object.entries(afterDay)) {
        if (raw == null || typeof raw !== 'object') continue;
        const entry = raw as { uri?: unknown; senderName?: unknown; at?: unknown };
        const uri = typeof entry.uri === 'string' ? entry.uri : '';
        if (!uri || !/^https?:\/\//i.test(uri)) continue;

        const prev = beforeDay[senderUid];
        const prevUri =
          prev != null && typeof prev === 'object' && typeof (prev as { uri?: unknown }).uri === 'string'
            ? (prev as { uri: string }).uri
            : '';
        if (prevUri === uri) continue;

        const senderName = typeof entry.senderName === 'string' && entry.senderName.length > 0 ? entry.senderName : 'Partner';

        await sendPartnerPush({
          coupleCode,
          senderUid,
          title: 'Couplix',
          body: `${senderName} sent a Daily Snap`,
          data: { type: 'daily_snap', dateKey },
        });
      }
    }
  });

function jsonStable(v: unknown): string {
  try {
    return JSON.stringify(v);
  } catch {
    return '';
  }
}

/** Together shared doc: notify partner on trips, wish jar, journal, goals, countdown — with editor name. */
export const onTogetherStateWritten = region.firestore
  .document('couples/{coupleCode}/state/together')
  .onWrite(async (change, context) => {
    if (!change.after.exists) return;
    const coupleCode = context.params.coupleCode as string;
    const before = change.before.exists ? change.before.data()! : {};
    const after = change.after.data()!;

    const editorUid = typeof after.lastEditedByUid === 'string' ? after.lastEditedByUid : '';
    if (!editorUid) return;

    const senderName =
      typeof after.lastEditedByName === 'string' && after.lastEditedByName.trim().length > 0
        ? after.lastEditedByName.trim()
        : await getUserDisplayName(editorUid);

    const tripsBefore = Array.isArray(before.trips) ? before.trips : [];
    const tripsAfter = Array.isArray(after.trips) ? after.trips : [];
    const wishesBefore = Array.isArray(before.wishes) ? before.wishes : [];
    const wishesAfter = Array.isArray(after.wishes) ? after.wishes : [];
    const journalBefore = Array.isArray(before.journal) ? before.journal : [];
    const journalAfter = Array.isArray(after.journal) ? after.journal : [];
    const goalsBefore = Array.isArray(before.coupleGoals) ? before.coupleGoals : [];
    const goalsAfter = Array.isArray(after.coupleGoals) ? after.coupleGoals : [];

    const tripsChanged = jsonStable(tripsBefore) !== jsonStable(tripsAfter);
    const wishesChanged = jsonStable(wishesBefore) !== jsonStable(wishesAfter);
    const journalChanged = jsonStable(journalBefore) !== jsonStable(journalAfter);
    const goalsChanged = jsonStable(goalsBefore) !== jsonStable(goalsAfter);
    const targetAtChanged = Number(before.targetAt) !== Number(after.targetAt);
    const countModeChanged = String(before.countMode ?? '') !== String(after.countMode ?? '');

    const dataChanged =
      tripsChanged ||
      wishesChanged ||
      journalChanged ||
      goalsChanged ||
      targetAtChanged ||
      countModeChanged;

    if (!dataChanged) return;

    let completionBody: string | null = null;
    for (const ag of goalsAfter) {
      if (!ag || typeof ag !== 'object') continue;
      const id = String((ag as { id?: unknown }).id ?? '');
      const completed = !!(ag as { completed?: unknown }).completed;
      if (!id || !completed) continue;
      const prev = goalsBefore.find((g: unknown) => {
        if (!g || typeof g !== 'object') return false;
        return String((g as { id?: unknown }).id) === id;
      }) as { completed?: unknown } | undefined;
      const wasCompleted = prev && !!(prev as { completed?: unknown }).completed;
      if (wasCompleted) continue;
      const completedBy = String((ag as { completedByUid?: unknown }).completedByUid ?? '');
      if (completedBy && completedBy === editorUid) {
        completionBody = `${senderName} checked off a couple goal — nice work together! 🎊`;
        break;
      }
    }

    let body: string;
    let togetherTarget: 'hub' | 'trips' | 'wishes' | 'journal' | 'goals' | 'countdown' = 'hub';
    if (completionBody) {
      body = completionBody;
      togetherTarget = 'goals';
    } else if (tripsChanged) {
      body = `${senderName} updated shared trips`;
      togetherTarget = 'trips';
    } else if (wishesChanged) {
      body = `${senderName} updated the Wish Jar`;
      togetherTarget = 'wishes';
    } else if (journalChanged) {
      body = `${senderName} updated the journal`;
      togetherTarget = 'journal';
    } else if (goalsChanged) {
      body = `${senderName} updated couple goals`;
      togetherTarget = 'goals';
    } else if (targetAtChanged || countModeChanged) {
      body = `${senderName} updated the countdown`;
      togetherTarget = 'countdown';
    } else {
      return;
    }

    await sendPartnerPush({
      coupleCode,
      senderUid: editorUid,
      title: 'Couplix · Together',
      body,
      data: { type: 'together_sync', togetherTarget },
    });
  });
