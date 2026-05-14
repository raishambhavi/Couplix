import * as Notifications from 'expo-notifications';

const WISH_PARTNER_ID = 'couplix-birthday-wish-partner';
const SELF_BIRTHDAY_ID = 'couplix-birthday-self';

async function cancelByIds(ids: string[]) {
  for (const id of ids) {
    try {
      await Notifications.cancelScheduledNotificationAsync(id);
    } catch {
      // ignore
    }
  }
}

/**
 * Yearly local reminders: (1) on partner's saved month/day — prompt to wish them;
 * (2) on your profile date of birth — gentle birthday note (optional).
 */
export async function syncBirthdayLocalReminders(params: {
  enabled: boolean;
  partnerName: string;
  partnerBirthMonth: number | null;
  partnerBirthDay: number | null;
  selfBirthDateMs: number | null;
}): Promise<void> {
  await cancelByIds([WISH_PARTNER_ID, SELF_BIRTHDAY_ID]);

  if (!params.enabled) return;

  const pn = params.partnerName.trim() || 'your partner';
  const m = params.partnerBirthMonth;
  const d = params.partnerBirthDay;
  if (
    typeof m === 'number' &&
    m >= 1 &&
    m <= 12 &&
    typeof d === 'number' &&
    d >= 1 &&
    d <= 31
  ) {
    await Notifications.scheduleNotificationAsync({
      identifier: WISH_PARTNER_ID,
      content: {
        title: 'Couplix',
        body: `Today is ${pn}'s birthday — wish them a happy birthday!`,
        data: { type: 'partnerBirthdayReminder' },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.YEARLY,
        month: m - 1,
        day: d,
        hour: 9,
        minute: 0,
      },
    });
  }

  if (params.selfBirthDateMs != null && Number.isFinite(params.selfBirthDateMs)) {
    const dt = new Date(params.selfBirthDateMs);
    if (!Number.isNaN(dt.getTime())) {
      const sm = dt.getMonth();
      const sd = dt.getDate();
      await Notifications.scheduleNotificationAsync({
        identifier: SELF_BIRTHDAY_ID,
        content: {
          title: 'Couplix',
          body: 'Happy birthday! Your partner may want to celebrate with you today.',
          data: { type: 'selfBirthdayReminder' },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.YEARLY,
          month: sm,
          day: sd,
          hour: 9,
          minute: 0,
        },
      });
    }
  }
}
