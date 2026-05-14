import React, { useMemo } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AmbientBackground } from '../../components/AmbientBackground';
import { FloatingBackButton } from '../../components/FloatingBackButton';
import { GoldButton } from '../../components/GoldButton';
import { SoftCard } from '../../components/SoftCard';
import { useAuth } from '../../state/AuthContext';
import { usePairing } from '../../state/PairingContext';
import type { CollageLayout } from '../../state/SnapContext';
import { useSnap } from '../../state/SnapContext';
import { useSettings } from '../../state/SettingsContext';
import { useTheme } from '../../state/ThemeContext';

function weekSundayKeys() {
  const d = new Date();
  const day = d.getDay();
  const sun = new Date(d);
  sun.setDate(d.getDate() - day);
  const keys: string[] = [];
  for (let i = 0; i < 7; i++) {
    const t = new Date(sun);
    t.setDate(sun.getDate() + i);
    keys.push(t.toISOString().slice(0, 10));
  }
  return keys;
}

function partnerWeekTitle(name: string | undefined) {
  const p = name?.trim() || 'Partner';
  return p.endsWith('s') ? `${p}' week` : `${p}'s week`;
}

export function WeeklyCollageScreen() {
  const { colors } = useTheme();
  const auth = useAuth();
  const myUid = auth.user?.uid ?? null;
  const { coupleMode, partnerName } = usePairing();
  const ld = coupleMode === 'longDistance';
  const { sendNotification } = useSettings();
  const { dailyByDate, collageLayout, setCollageLayout } = useSnap();
  const weekKeys = useMemo(() => weekSundayKeys(), []);

  const cells = useMemo(() => {
    return weekKeys.map((k) => {
      const dm = dailyByDate[k] ?? {};
      const mineUri = myUid ? dm[myUid]?.uri : undefined;
      const partnerKey = Object.keys(dm).find((uid) => uid !== myUid && uid !== '_legacy');
      const legacy = dm['_legacy'];
      const partnerUri =
        (partnerKey ? dm[partnerKey]?.uri : undefined) ??
        (legacy && legacy.senderUid && legacy.senderUid !== myUid ? legacy.uri : undefined);
      return { key: k, mineUri, partnerUri };
    });
  }, [weekKeys, dailyByDate, myUid]);

  const onSimulateSunday = async () => {
    await sendNotification('Your weekly collage is ready — open Snap to see this week in one grid.');
  };

  const gridExtras =
    collageLayout === 'polaroid' ? { gap: 10, padding: 8 } : collageLayout === 'mosaic' ? { gap: 4 } : {};

  const renderWeekRow = (uris: (string | undefined)[], showDateWhenEmpty: boolean) => (
    <View style={[styles.weekRow, gridExtras]}>
      {cells.map((day, i) => {
        const uri = uris[i];
        return (
          <View key={day.key} style={[styles.dayCell, { borderColor: colors.border }]}>
            {uri ? (
              <Image source={{ uri }} style={styles.cellImg} resizeMode="cover" />
            ) : (
              <Text style={{ color: colors.muted, fontSize: 10, fontWeight: '700', textAlign: 'center' }}>
                {showDateWhenEmpty ? day.key.slice(5) : '—'}
              </Text>
            )}
          </View>
        );
      })}
    </View>
  );

  const mineRow = cells.map((d) => d.mineUri);
  const partnerRow = cells.map((d) => d.partnerUri);

  return (
    <>
      <AmbientBackground />
      <ScrollView contentContainerStyle={styles.container}>
        <SoftCard>
          <Text style={[styles.sub, { color: colors.muted }]}>
            {ld
              ? 'Two strips — your week and your partner’s — same Sunday-to-Saturday window (push in full build).'
              : 'Two strips — your week and your partner’s — same Sunday-to-Saturday window together.'}
          </Text>
          <Text style={[styles.h, { color: colors.text }]}>Layout</Text>
          <View style={styles.chips}>
            {(['grid', 'polaroid', 'mosaic'] as CollageLayout[]).map((l) => (
              <Pressable
                key={l}
                onPress={() => setCollageLayout(l)}
                style={({ pressed }) => [
                  styles.chip,
                  {
                    borderColor: collageLayout === l ? colors.gold : colors.border,
                    backgroundColor: collageLayout === l ? 'rgba(231,199,125,0.15)' : 'transparent',
                    opacity: pressed ? 0.85 : 1,
                  },
                ]}
              >
                <Text style={{ color: colors.text, fontWeight: '800', fontSize: 13 }}>
                  {l.charAt(0).toUpperCase() + l.slice(1)}
                </Text>
              </Pressable>
            ))}
          </View>
        </SoftCard>

        <SoftCard>
          <Text style={[styles.h, { color: colors.text }]}>Your snaps this week</Text>
          {renderWeekRow(mineRow, true)}
          <Text style={[styles.micro, { color: colors.muted }]}>
            Sun → Sat · your daily snap for each day (empty slot if none yet).
          </Text>
        </SoftCard>

        <SoftCard>
          <Text style={[styles.h, { color: colors.text }]}>{partnerWeekTitle(partnerName)}</Text>
          {renderWeekRow(partnerRow, false)}
          <Text style={[styles.micro, { color: colors.muted }]}>
            {partnerName?.trim()
              ? `${partnerName.trim()}'s snaps when they’ve sent for that day.`
              : 'Partner snaps when they’ve sent for that day.'}
          </Text>
        </SoftCard>

        <SoftCard>
          <Text style={[styles.h, { color: colors.text }]}>Shared gallery</Text>
          <Text style={[styles.sub, { color: colors.muted }]}>
            Weekly collages are stored here for both of you (persisted gallery in a future update).
          </Text>
          <GoldButton title="Simulate Sunday push" onPress={onSimulateSunday} />
        </SoftCard>
      </ScrollView>
      <FloatingBackButton />
    </>
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 32, gap: 14 },
  h: { fontSize: 15, fontWeight: '900', marginTop: 6 },
  sub: { marginTop: 4, fontSize: 12, fontWeight: '700', lineHeight: 18 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  chip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 14,
    overflow: 'hidden',
  },
  weekRow: {
    flexDirection: 'row',
    flexWrap: 'nowrap',
    gap: 6,
    marginTop: 10,
    justifyContent: 'space-between',
  },
  dayCell: {
    flex: 1,
    minWidth: 0,
    aspectRatio: 1,
    borderWidth: 1,
    borderRadius: 8,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cellImg: { width: '100%', height: '100%' },
  micro: { fontSize: 11, fontWeight: '600', marginTop: 10 },
});
