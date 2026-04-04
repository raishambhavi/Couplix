import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Image, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

import { AmbientBackground } from '../components/AmbientBackground';
import { TogetherForBanner } from '../components/TogetherForBanner';
import { GoldButton } from '../components/GoldButton';
import { ScreenHeading } from '../components/ScreenHeading';
import { SoftCard } from '../components/SoftCard';
import { useAuth, WELCOME_BACK_STORAGE_KEY } from '../state/AuthContext';
import { usePairing } from '../state/PairingContext';
import { useTheme } from '../state/ThemeContext';

function FloatingHearts() {
  const a = useRef(new Animated.Value(0)).current;
  const heartRed = '#FF3B57';

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(a, {
        toValue: 1,
        duration: 2400,
        easing: Easing.inOut(Easing.quad),
        useNativeDriver: true,
      })
    );
    loop.start();
    return () => loop.stop();
  }, [a]);

  const floatY = a.interpolate({ inputRange: [0, 1], outputRange: [0, -10] });
  const fade = a.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.65, 1, 0.65] });

  const heart = (style: any, size: number, opacity: number) => (
    <Animated.View style={[styles.heart, style, { transform: [{ translateY: floatY }], opacity: fade }]}>
      <Ionicons name="heart" size={size} color={heartRed} style={{ opacity }} />
    </Animated.View>
  );

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {heart({ left: 10, top: 8 }, 14, 0.85)}
      {heart({ right: 16, top: 18 }, 12, 0.7)}
      {heart({ left: 36, bottom: 18 }, 12, 0.65)}
      {heart({ right: 40, bottom: 10 }, 14, 0.8)}
      {heart({ left: '46%', top: -6 }, 10, 0.55)}
    </View>
  );
}

function InitialAvatar({
  label,
  size = 110,
}: {
  label: string;
  size?: number;
}) {
  const { colors } = useTheme();
  const initial = (label?.trim()[0] ?? '?').toUpperCase();
  return (
    <View
      style={[
        styles.initialWrap,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          borderColor: colors.border,
          backgroundColor: colors.cardGlow,
        },
      ]}
    >
      <Text style={[styles.initialText, { color: colors.text }]}>{initial}</Text>
    </View>
  );
}

export function HomeScreen({ navigation }: { navigation: any }) {
  const { colors } = useTheme();
  const auth = useAuth();
  const {
    partnerName,
    coupleMode,
    setCoupleMode,
    partnerPhotoURL,
    partnerPublicProfileUpdatedAt,
    partnerProfileDisplayName,
  } = usePairing();
  const [statusOpen, setStatusOpen] = React.useState(false);
  const [welcomeLine, setWelcomeLine] = useState<string | null>(null);

  useEffect(() => {
    if (!auth.user?.uid || auth.loading) return;
    let mounted = true;
    (async () => {
      const raw = await AsyncStorage.getItem(WELCOME_BACK_STORAGE_KEY);
      if (!raw || !mounted) return;
      try {
        const parsed = JSON.parse(raw) as { name?: string; at?: number };
        const { name, at } = parsed;
        if (typeof at !== 'number' || Date.now() - at > 10 * 60 * 1000) {
          await AsyncStorage.removeItem(WELCOME_BACK_STORAGE_KEY);
          return;
        }
        await AsyncStorage.removeItem(WELCOME_BACK_STORAGE_KEY);
        const fromProfile = auth.profile?.displayName?.trim();
        const finalName = fromProfile || (typeof name === 'string' ? name : '') || 'there';
        setWelcomeLine(`Welcome back, ${finalName}`);
      } catch {
        await AsyncStorage.removeItem(WELCOME_BACK_STORAGE_KEY);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [auth.user?.uid, auth.loading]);

  const myName = auth.profile?.displayName ?? 'You';
  const myPhoto = auth.profile?.photoURL ?? null;
  const partnerLabel = partnerProfileDisplayName?.trim() || partnerName || 'Partner';

  return (
    <>
      <AmbientBackground />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <ScreenHeading title="Home" subtitle="Your daily couple connection." />

        <LinearGradient
          colors={['rgba(236,72,153,0.4)', 'rgba(244,114,182,0.12)', 'transparent']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.loveHero}
        >
          <Text style={styles.loveHeroEyebrow}>Couplix</Text>
          <Text style={[styles.loveHeroTitle, { color: colors.text }]}>Made for two hearts</Text>
          <Text style={[styles.loveHeroSub, { color: colors.muted }]}>
            Warm, private, and in sync — wherever you are.
          </Text>
        </LinearGradient>

        <TogetherForBanner onPressEditDate={() => navigation.navigate('Settings')} />

        {welcomeLine ? (
          <View
            style={[
              styles.welcomeBanner,
              { backgroundColor: colors.cardGlow, borderColor: colors.border },
            ]}
          >
            <Text style={[styles.welcomeBannerText, { color: colors.text }]}>{welcomeLine}</Text>
            <Pressable onPress={() => setWelcomeLine(null)} hitSlop={12} accessibilityRole="button">
              <Ionicons name="close-circle" size={22} color={colors.muted} />
            </Pressable>
          </View>
        ) : null}

        <SoftCard style={[styles.matchCard, { borderColor: 'rgba(236,72,153,0.45)', borderWidth: 1 }]}>
          <Text style={styles.matchLabelPink}>IT'S A PERFECT MATCH!</Text>
          <Text style={[styles.matchTitle, { color: colors.text }]}>You + {partnerLabel}</Text>
          <Text style={[styles.matchSubtitle, { color: colors.muted }]}>
            Stay close with mood features, rituals, snaps, and more.
          </Text>

          <Text style={[styles.modeLabel, { color: colors.muted }]}>
            Current: {coupleMode === 'together' ? 'Living together' : 'Long distance'}
          </Text>
          <GoldButton title="Status of Living" onPress={() => setStatusOpen(true)} style={{ marginTop: 10, width: '100%' }} />
          <Text style={[styles.modeHint, { color: colors.muted }]}>Switch anytime — all tabs adapt instantly.</Text>

          <View style={styles.avatarStage}>
            <View style={styles.avatarRow}>
              <View style={[styles.avatarRing, styles.avatarLeft, { borderColor: colors.gold }]}>
                {myPhoto ? (
                  <Image key={myPhoto} source={{ uri: myPhoto }} style={styles.avatarImage} />
                ) : (
                  <InitialAvatar label={myName} />
                )}
              </View>

              <View style={[styles.avatarRing, styles.avatarRight, { borderColor: colors.gold2 }]}>
                {partnerPhotoURL ? (
                  <Image
                    key={`partner-avatar-${partnerPublicProfileUpdatedAt ?? 0}-${partnerPhotoURL}`}
                    source={{ uri: partnerPhotoURL }}
                    style={styles.avatarImage}
                  />
                ) : (
                  <InitialAvatar label={partnerLabel} />
                )}
              </View>
            </View>
            <FloatingHearts />
          </View>

          <GoldButton
            title="Explore Together"
            onPress={() => (globalThis as any).__couplixOpenIndex?.()}
            style={styles.cta}
          />

          <Pressable
            onPress={() => navigation.navigate('Snap')}
            style={({ pressed }) => [styles.secondaryLink, pressed ? { opacity: 0.7 } : null]}
          >
            <Ionicons name="camera" size={15} color="#EC4899" />
            <Text style={[styles.secondaryLinkText, { color: '#F472B6' }]}>
              Photo & memory
            </Text>
          </Pressable>
          <Pressable
            onPress={() => navigation.navigate('Together')}
            style={({ pressed }) => [styles.secondaryLink, pressed ? { opacity: 0.7 } : null]}
          >
            <Ionicons name="people" size={15} color="#EC4899" />
            <Text style={[styles.secondaryLinkText, { color: '#F472B6' }]}>
              Together space
            </Text>
          </Pressable>
          <Pressable
            onPress={() => {
              const parent = navigation.getParent();
              if (parent && 'navigate' in parent) {
                (parent as { navigate: (n: string) => void }).navigate('Onboarding');
              } else {
                navigation.navigate('Onboarding' as never);
              }
            }}
            style={({ pressed }) => [styles.secondaryLink, pressed ? { opacity: 0.7 } : null]}
          >
            <Ionicons name="heart-outline" size={15} color="#EC4899" />
            <Text style={[styles.secondaryLinkText, { color: '#F472B6' }]}>
              Pair with your partner
            </Text>
          </Pressable>
        </SoftCard>

      </ScrollView>

      <Modal visible={statusOpen} transparent animationType="fade" onRequestClose={() => setStatusOpen(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setStatusOpen(false)}>
          <Pressable style={[styles.modalCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Choose Status of Living</Text>
            <View style={styles.modalGrid}>
              <Pressable
                onPress={() => {
                  setCoupleMode('together');
                  setStatusOpen(false);
                }}
                style={[
                  styles.modeSquare,
                  {
                    borderColor: coupleMode === 'together' ? colors.gold : colors.border,
                    backgroundColor:
                      coupleMode === 'together' ? 'rgba(231,199,125,0.2)' : 'rgba(231,199,125,0.06)',
                  },
                ]}
              >
                <Ionicons name="home" size={30} color={colors.gold} />
                <Text style={[styles.modeSquareTitle, { color: colors.text }]}>Living Together</Text>
              </Pressable>

              <Pressable
                onPress={() => {
                  setCoupleMode('longDistance');
                  setStatusOpen(false);
                }}
                style={[
                  styles.modeSquare,
                  {
                    borderColor: coupleMode === 'longDistance' ? colors.gold : colors.border,
                    backgroundColor:
                      coupleMode === 'longDistance' ? 'rgba(231,199,125,0.2)' : 'rgba(231,199,125,0.06)',
                  },
                ]}
              >
                <Ionicons name="airplane" size={30} color={colors.gold} />
                <Text style={[styles.modeSquareTitle, { color: colors.text }]}>Long Distance</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
  },
  container: {
    paddingHorizontal: 20,
    paddingTop: 108,
    paddingBottom: 40,
    gap: 14,
  },
  welcomeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  welcomeBannerText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '900',
    lineHeight: 20,
  },
  matchCard: {
    marginTop: 2,
    alignItems: 'center',
  },
  loveHero: {
    borderRadius: 20,
    padding: 16,
    marginBottom: 4,
    borderWidth: 1,
    borderColor: 'rgba(244,114,182,0.35)',
  },
  loveHeroEyebrow: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 2,
    color: '#EC4899',
    textTransform: 'uppercase',
  },
  loveHeroTitle: {
    fontSize: 22,
    fontWeight: '900',
    marginTop: 6,
  },
  loveHeroSub: {
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 18,
    marginTop: 8,
  },
  matchLabelPink: {
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1.2,
    color: '#EC4899',
  },
  matchTitle: {
    fontSize: 30,
    fontWeight: '900',
    marginTop: 8,
  },
  matchSubtitle: {
    marginTop: 8,
    textAlign: 'center',
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '700',
  },
  modeLabel: {
    marginTop: 14,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.4,
    alignSelf: 'stretch',
    textAlign: 'center',
  },
  modeHint: {
    marginTop: 8,
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 16,
    paddingHorizontal: 8,
  },
  avatarStage: {
    marginTop: 24,
    width: '100%',
    alignItems: 'center',
    minHeight: 150,
    justifyContent: 'center',
  },
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarRing: {
    width: 122,
    height: 122,
    borderRadius: 999,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.02)',
  },
  avatarLeft: {
    marginRight: -22,
  },
  avatarRight: {
    marginLeft: -22,
  },
  avatarImage: {
    width: 110,
    height: 110,
    borderRadius: 999,
  },
  initialWrap: {
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initialText: {
    fontSize: 38,
    fontWeight: '900',
  },
  cta: {
    marginTop: 18,
    width: '100%',
  },
  secondaryLink: {
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  secondaryLinkText: {
    fontWeight: '900',
  },
  heart: {
    position: 'absolute',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 440,
    borderRadius: 20,
    borderWidth: 1,
    padding: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '900',
    textAlign: 'center',
  },
  modalGrid: {
    marginTop: 14,
    flexDirection: 'row',
    gap: 12,
  },
  modeSquare: {
    flex: 1,
    minHeight: 150,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: 8,
  },
  modeSquareTitle: {
    fontSize: 15,
    fontWeight: '900',
    textAlign: 'center',
  },
});

