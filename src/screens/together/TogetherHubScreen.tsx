import React, { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

import { AmbientBackground } from '../../components/AmbientBackground';
import { FloatingBackButton } from '../../components/FloatingBackButton';
import { SoftCard } from '../../components/SoftCard';
import type { TogetherStackParamList } from '../../navigation/TogetherStack';
import { useAuth } from '../../state/AuthContext';
import { usePairing } from '../../state/PairingContext';
import { useTogether } from '../../state/TogetherContext';
import { useTheme } from '../../state/ThemeContext';
import { formatRelativeTime } from '../../utils/formatRelativeTime';

const allFeatures = [
  {
    key: 'OurTripsTogether' as const,
    title: 'Our Trips Together',
    icon: 'globe-outline' as const,
    subtitle: 'Travel map — pin adventures, cities, parks, and memories',
  },
  { key: 'WishJar' as const, title: 'Wish Jar', icon: 'gift' as const, subtitle: 'Drop wishes and date-lock reveals' },
  {
    key: 'SharedJournal' as const,
    title: 'Our Journal',
    icon: 'book' as const,
    subtitle: 'Gratitude, feelings, travel photos, milestones',
  },
  {
    key: 'CoupleGoals' as const,
    title: 'Couple Goals',
    icon: 'heart' as const,
    subtitle: 'Yearly goals — complete together, celebrate together',
  },
  {
    key: 'CountdownTogether' as const,
    title: 'Countdown Together',
    icon: 'hourglass' as const,
    subtitle: 'Shared countdown and arrival celebration',
  },
] as const;

export function TogetherHubScreen() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const { coupleMode } = usePairing();
  const { togetherLastEdit } = useTogether();
  const isLongDistance = coupleMode === 'longDistance';
  const navigation = useNavigation<NativeStackNavigationProp<TogetherStackParamList>>();
  const visibleFeatures = isLongDistance ? allFeatures : allFeatures.filter((f) => f.key !== 'CountdownTogether');

  const syncAttributionLine = useMemo(() => {
    const at = togetherLastEdit?.at;
    const name = togetherLastEdit?.byName?.trim();
    if (at == null || !name) return null;
    const rel = formatRelativeTime(at);
    const who =
      togetherLastEdit.byUid && user?.uid && togetherLastEdit.byUid === user.uid ? 'You' : name;
    return `${who} last updated shared Together · ${rel}`;
  }, [togetherLastEdit, user?.uid]);

  return (
    <>
      <AmbientBackground />
      <ScrollView contentContainerStyle={styles.container}>
        <LinearGradient
          colors={['rgba(236,72,153,0.42)', 'rgba(244,114,182,0.12)', 'transparent']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.hero}
        >
          <Text style={[styles.heroEyebrow, { color: colors.muted }]}>Together</Text>
          <Text style={[styles.heroTitle, { color: colors.text }]}>Your shared space</Text>
          <Text style={[styles.heroSub, { color: colors.muted }]}>
            {isLongDistance
              ? 'Long distance: journal, wishes, goals, and countdown — all in sync.'
              : 'Living together: wishes, journal, and goals — warm, private, and yours.'}
          </Text>
          {syncAttributionLine ? (
            <Text style={[styles.syncLine, { color: colors.muted }]} accessibilityRole="text">
              {syncAttributionLine}
            </Text>
          ) : null}
        </LinearGradient>

        <SoftCard>
          <View style={styles.list}>
            {visibleFeatures.map((f) => (
              <Pressable
                key={f.key}
                onPress={() => navigation.navigate(f.key)}
                style={({ pressed }) => [
                  styles.item,
                  {
                    borderColor: 'rgba(236,72,153,0.35)',
                    backgroundColor: colors.cardGlow,
                    opacity: pressed ? 0.88 : 1,
                  },
                ]}
              >
                <View style={styles.iconBubble}>
                  <Ionicons name={f.icon} size={22} color="#F472B6" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.itemTitle, { color: colors.text }]}>{f.title}</Text>
                  <Text style={[styles.itemSubtitle, { color: colors.muted }]}>{f.subtitle}</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.muted} />
              </Pressable>
            ))}
          </View>
        </SoftCard>
      </ScrollView>
      <FloatingBackButton />
    </>
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 32, gap: 14 },
  hero: {
    borderRadius: 22,
    padding: 20,
    marginBottom: 4,
    borderWidth: 1,
    borderColor: 'rgba(244,114,182,0.3)',
  },
  heroEyebrow: { fontSize: 11, fontWeight: '800', letterSpacing: 1.4, textTransform: 'uppercase' },
  heroTitle: { fontSize: 26, fontWeight: '900', marginTop: 6 },
  heroSub: { fontSize: 13, fontWeight: '700', lineHeight: 19, marginTop: 10 },
  syncLine: { fontSize: 12, fontWeight: '700', lineHeight: 17, marginTop: 10, fontStyle: 'italic' },
  list: { gap: 10 },
  item: {
    borderWidth: 1,
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconBubble: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(236,72,153,0.12)',
  },
  itemTitle: { fontSize: 15, fontWeight: '900' },
  itemSubtitle: { fontSize: 12, fontWeight: '700', marginTop: 2, lineHeight: 17 },
});
