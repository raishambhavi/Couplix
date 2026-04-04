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

export function WeeklyCollageScreen() {
  const { colors } = useTheme();
  const auth = useAuth();
  const myUid = auth.user?.uid ?? null;
  const { coupleMode } = usePairing();
  const ld = coupleMode === 'longDistance';
  const { sendNotification } = useSettings();
  const { dailyByDate, partnerSentByDate, collageLayout, setCollageLayout } = useSnap();
  const weekKeys = useMemo(() => weekSundayKeys(), []);

  const cells = useMemo(() => {
    return weekKeys.map((k) => {
      const dm = dailyByDate[k] ?? {};
      const mineUri = myUid ? dm[myUid]?.uri : undefined;
      const partnerKey = Object.keys(dm).find((uid) => uid !== myUid);
      const partnerUri = partnerKey ? dm[partnerKey]?.uri : undefined;
      const partnerSent = !!partnerSentByDate[k] || !!partnerKey;
      const both = !!mineUri && (!!partnerUri || !!partnerSentByDate[k]);
      return {
        key: k,
        mineUri,
        partnerUri,
        partnerSent,
        both,
      };
    });
  }, [weekKeys, dailyByDate, partnerSentByDate, myUid]);

  const onSimulateSunday = async () => {
    await sendNotification('Your weekly collage is ready — open Snap to see this week in one grid.');
  };

  return (
    <>
      <AmbientBackground />
      <ScrollView contentContainerStyle={styles.container}>
        <SoftCard>
          <Text style={[styles.sub, { color: colors.muted }]}>
            {ld
              ? 'Every Sunday, a 3×3 reunion of your far-apart week (push in full build). Layout is for how you share it.'
              : 'Every Sunday, a 3×3 look back at your week together (push in full build). Layout is for how you share it.'}
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
          <Text style={[styles.h, { color: colors.text }]}>This week (live preview)</Text>
          <View
            style={[
              styles.grid,
              collageLayout === 'polaroid' && { gap: 10, padding: 8 },
              collageLayout === 'mosaic' && { gap: 4 },
            ]}
          >
            {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => {
              if (i >= 7) {
                return (
                  <View key={`pad-${i}`} style={[styles.cell, { borderColor: colors.border, opacity: 0.35 }]}>
                    <Text style={{ color: colors.muted, fontSize: 10 }}>—</Text>
                  </View>
                );
              }
              const day = cells[i]!;
              const split = day.both && day.mineUri && day.partnerUri;
              return (
                <View key={day.key} style={[styles.cell, { borderColor: colors.border }]}>
                  {split ? (
                    <View style={styles.split}>
                      <Image source={{ uri: day.mineUri! }} style={styles.half} resizeMode="cover" />
                      {day.partnerUri ? (
                        <Image
                          source={{ uri: day.partnerUri }}
                          style={styles.half}
                          resizeMode="cover"
                        />
                      ) : (
                        <View style={[styles.half, styles.ph, { borderLeftWidth: 1, borderColor: 'rgba(255,255,255,0.2)' }]}>
                          <Text style={{ color: colors.muted, fontSize: 9, textAlign: 'center', padding: 4 }}>
                            Partner snap
                          </Text>
                        </View>
                      )}
                    </View>
                  ) : day.mineUri ? (
                    <Image source={{ uri: day.mineUri }} style={styles.full} resizeMode="cover" />
                  ) : (
                    <Text style={{ color: colors.muted, fontSize: 10 }}>{day.key.slice(5)}</Text>
                  )}
                </View>
              );
            })}
          </View>
          <Text style={[styles.micro, { color: colors.muted }]}>
            Split cells when both partners snapped the same day. Empty slots pad the 3×3.
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
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 10,
    justifyContent: 'center',
  },
  cell: {
    width: '30%',
    aspectRatio: 1,
    borderWidth: 1,
    borderRadius: 8,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  split: { flex: 1, flexDirection: 'row', width: '100%', height: '100%' },
  half: { flex: 1, height: '100%' },
  full: { width: '100%', height: '100%' },
  ph: {
    backgroundColor: 'rgba(231,199,125,0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  micro: { fontSize: 11, fontWeight: '600', marginTop: 10 },
});
