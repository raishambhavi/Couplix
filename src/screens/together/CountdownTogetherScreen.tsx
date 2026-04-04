import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AmbientBackground } from '../../components/AmbientBackground';
import { FloatingBackButton } from '../../components/FloatingBackButton';
import { GoldButton } from '../../components/GoldButton';
import { SoftCard } from '../../components/SoftCard';
import { useTogether } from '../../state/TogetherContext';
import { useTheme } from '../../state/ThemeContext';

export function CountdownTogetherScreen() {
  const { colors } = useTheme();
  const { targetAt, setTargetAt, countMode, setCountMode } = useTogether();

  const now = Date.now();
  const remainMs = Math.max(0, targetAt - now);
  const remainDays = Math.ceil(remainMs / (24 * 60 * 60 * 1000));
  const remainHours = Math.ceil(remainMs / (60 * 60 * 1000));
  const remainMinutes = Math.ceil(remainMs / (60 * 1000));
  const totalWindowMs = 14 * 24 * 60 * 60 * 1000;
  const percent = Math.min(100, Math.max(0, Math.round((1 - remainMs / totalWindowMs) * 100)));
  const countText =
    countMode === 'days'
      ? `${remainDays} day(s)`
      : countMode === 'hours'
      ? `${remainHours} hour(s)`
      : countMode === 'minutes'
      ? `${remainMinutes} minute(s)`
      : `${percent}%`;

  const setCountdownDays = (days: number) => setTargetAt(Date.now() + days * 24 * 60 * 60 * 1000);

  return (
    <>
      <AmbientBackground />
      <ScrollView contentContainerStyle={styles.container}>
        <SoftCard>
          <Text style={[styles.h, { color: colors.text }]}>Countdown Together</Text>
          <Text style={[styles.count, { color: colors.gold }]}>{countText}</Text>
          <Text style={[styles.sub, { color: colors.muted }]}>
            Synced home widget and simultaneous celebration animation are ready to wire in realtime phase.
          </Text>
          <View style={styles.row}>
            {(['days', 'hours', 'minutes', 'percent'] as const).map((m) => (
              <Pressable
                key={m}
                onPress={() => setCountMode(m)}
                style={[
                  styles.chip,
                  {
                    borderColor: countMode === m ? colors.gold : colors.border,
                    backgroundColor: countMode === m ? 'rgba(231,199,125,0.2)' : 'rgba(231,199,125,0.06)',
                  },
                ]}
              >
                <Text style={[styles.chipText, { color: colors.text }]}>{m}</Text>
              </Pressable>
            ))}
          </View>
          <View style={[styles.row, { marginTop: 10 }]}>
            <GoldButton title="+ 3 days" onPress={() => setCountdownDays(3)} style={{ flex: 1 }} />
            <GoldButton title="+ 7 days" onPress={() => setCountdownDays(7)} style={{ flex: 1 }} />
            <GoldButton title="+ 30 days" onPress={() => setCountdownDays(30)} style={{ flex: 1 }} />
          </View>
        </SoftCard>
      </ScrollView>
      <FloatingBackButton />
    </>
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 32, gap: 14 },
  h: { fontSize: 16, fontWeight: '900' },
  sub: { marginTop: 4, fontSize: 12, fontWeight: '700', lineHeight: 18 },
  count: { marginTop: 8, fontSize: 28, fontWeight: '900' },
  row: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginTop: 8 },
  chip: { borderWidth: 1, borderRadius: 999, paddingVertical: 8, paddingHorizontal: 12 },
  chipText: { fontSize: 12, fontWeight: '900' },
});

