import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { AmbientBackground } from '../../components/AmbientBackground';
import { FloatingBackButton } from '../../components/FloatingBackButton';
import { GoldButton } from '../../components/GoldButton';
import { SoftCard } from '../../components/SoftCard';
import { useTheme } from '../../state/ThemeContext';

function nextQuarterEnd() {
  const now = new Date();
  const m = now.getMonth();
  const q = Math.floor(m / 3);
  const endMonth = (q + 1) * 3;
  const end = new Date(now.getFullYear(), endMonth, 0);
  return end;
}

export function QuarterlyVideoScreen() {
  const { colors } = useTheme();
  const next = useMemo(() => nextQuarterEnd(), []);

  return (
    <>
      <AmbientBackground />
      <ScrollView contentContainerStyle={styles.container}>
        <SoftCard>
          <Text style={[styles.sub, { color: colors.muted }]}>
            At the end of each quarter, Couplix compiles your daily snaps into a 60–90s memory film — same moment for
            both of you.
          </Text>
          <Text style={[styles.h, { color: colors.text }]}>Next compilation window</Text>
          <Text style={[styles.date, { color: colors.gold }]}>
            {next.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}
          </Text>
        </SoftCard>

        <SoftCard>
          <Text style={[styles.h, { color: colors.text }]}>Planned experience</Text>
          <Bullet text="AI-assisted picks — brightness & faces to spotlight the best days" />
          <Bullet text="Crossfades — fade, slide, zoom (editable before send)" />
          <Bullet text="Soundtrack from your Song of Us playlist" />
          <Bullet text="Reorder clips, change music, title card — then deliver together" />
          <Bullet text="Full-quality download to camera roll" />
          <GoldButton
            title="Editor preview (coming soon)"
            onPress={() => {}}
            style={{ marginTop: 12, opacity: 0.7 }}
          />
        </SoftCard>
      </ScrollView>
      <FloatingBackButton />
    </>
  );
}

function Bullet({ text }: { text: string }) {
  const { colors } = useTheme();
  return (
    <View style={styles.bulletRow}>
      <Text style={{ color: colors.gold, fontWeight: '900', marginRight: 8 }}>·</Text>
      <Text style={[styles.bullet, { color: colors.muted }]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 32, gap: 14 },
  h: { fontSize: 15, fontWeight: '900', marginTop: 6 },
  sub: { marginTop: 4, fontSize: 12, fontWeight: '700', lineHeight: 18 },
  date: { fontSize: 18, fontWeight: '900', marginTop: 8 },
  bulletRow: { flexDirection: 'row', marginTop: 8, alignItems: 'flex-start' },
  bullet: { flex: 1, fontSize: 13, fontWeight: '600', lineHeight: 19 },
});
