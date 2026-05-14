import React, { useEffect } from 'react';

import { useAuth } from '../state/AuthContext';
import { usePairing } from '../state/PairingContext';
import { useSettings } from '../state/SettingsContext';
import { syncBirthdayLocalReminders } from '../utils/partnerBirthdayNotifications';

/** Schedules yearly local notifications from shared partner birthday + profile DOB. */
export function PartnerBirthdayReminderSync() {
  const { partnerName, partnerBirthMonth, partnerBirthDay } = usePairing();
  const { profile } = useAuth();
  const { notificationsEnabled } = useSettings();

  useEffect(() => {
    void syncBirthdayLocalReminders({
      enabled: notificationsEnabled,
      partnerName,
      partnerBirthMonth,
      partnerBirthDay,
      selfBirthDateMs: profile?.dateOfBirthMs ?? null,
    });
  }, [
    notificationsEnabled,
    partnerName,
    partnerBirthMonth,
    partnerBirthDay,
    profile?.dateOfBirthMs,
  ]);

  return null;
}
