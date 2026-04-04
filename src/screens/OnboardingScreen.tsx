import React, { useCallback, useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GoldButton } from '../components/GoldButton';
import { AmbientBackground } from '../components/AmbientBackground';
import { SoftCard } from '../components/SoftCard';
import { ScreenHeading } from '../components/ScreenHeading';
import { FIRESTORE_SYNC_FLAGS } from '../config/firestoreSyncFlags';
import { usePairing } from '../state/PairingContext';
import { useTheme } from '../state/ThemeContext';
import { parseCoupleCodeInput } from '../utils/coupleCode';

export function OnboardingScreen({ navigation }: { navigation: any }) {
  const { setPartnerName, coupleCode, coupleCodeRevision, setCoupleCode, regenerateCoupleCode } = usePairing();
  const [partnerNameDraft, setPartnerNameDraft] = useState('');
  const [joinCodeDraft, setJoinCodeDraft] = useState('');
  const [joinedTip, setJoinedTip] = useState(false);
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  const goToHome = useCallback(() => {
    const finalName = partnerNameDraft.trim();
    if (finalName.length >= 2) setPartnerName(finalName);
    navigation.replace('MainTabs');
  }, [navigation, partnerNameDraft, setPartnerName]);

  const canContinue = useMemo(() => partnerNameDraft.trim().length >= 2, [partnerNameDraft]);
  const parsedJoinCode = useMemo(() => parseCoupleCodeInput(joinCodeDraft), [joinCodeDraft]);
  const canJoin = parsedJoinCode != null;
  const pairingSyncOn = FIRESTORE_SYNC_FLAGS.pairing;

  const codeDisplay = useMemo(
    () => (coupleCode ? coupleCode.split('').join(' ') : '------'),
    [coupleCode, coupleCodeRevision]
  );

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.select({ ios: 'padding', android: undefined })}
    >
      <AmbientBackground />
      <View style={[styles.container, { paddingTop: Math.max(insets.top, 12) + 8 }]}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <ScreenHeading
            title="Couplix"
            subtitle="Feel your partner throughout the day—no conversation required."
            style={{ paddingTop: 0 }}
          />

          {!pairingSyncOn ? (
            <Text style={[styles.syncWarning, { color: colors.danger }]}>
              Cloud pairing is off (set EXPO_PUBLIC_FIRESTORE_SYNC=true in your build). Two phones will not share a couple
              until this is enabled and the app is rebuilt on both devices.
            </Text>
          ) : (
            <Text style={[styles.syncOk, { color: colors.muted }]}>
              Tip: Phone A copies “Your code.” Phone B enters that exact code, taps Join couple, then both add a name
              and tap Continue. Use the same Firebase project on both phones.
            </Text>
          )}

          <SoftCard style={styles.card}>
          <Text style={styles.sectionLabel}>Choose your partner name</Text>
          <TextInput
            value={partnerNameDraft}
            onChangeText={setPartnerNameDraft}
            placeholder="e.g., Maya"
            placeholderTextColor={colors.muted}
            style={[styles.input, { backgroundColor: colors.background }]}
            autoCapitalize="words"
            returnKeyType="done"
          />

          <View style={styles.divider} />

          <Text style={styles.sectionLabel}>Pair with your couple code</Text>

          <View style={styles.codeBox}>
            <Text style={[styles.codeLabel, { color: colors.gold }]}>Your code</Text>
            <Text style={[styles.codeValue, { color: colors.text }]}>{codeDisplay}</Text>
            <View style={styles.codeActions}>
              <GoldButton
                title="Copy"
                onPress={() => {
                  if (!coupleCode) return;
                  Clipboard.setStringAsync(coupleCode).catch(() => {});
                }}
                style={styles.codeActionBtn}
              />
              <GoldButton
                title="Regenerate code"
                onPress={() => regenerateCoupleCode()}
                style={styles.codeActionBtn}
              />
            </View>
            <Text style={[styles.codeHint, { color: colors.muted }]}>
              Send this code to your partner. They enter it below and tap Join couple (same 6 digits or legacy
              letters).
            </Text>
          </View>

          <View style={styles.divider} />

          <Text style={styles.sectionLabel}>If you received a code</Text>
          <TextInput
            value={joinCodeDraft}
            onChangeText={(t) => {
              setJoinCodeDraft(t);
              setJoinedTip(false);
            }}
            placeholder="6-digit or legacy 6-letter code"
            placeholderTextColor={colors.muted}
            keyboardType="default"
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={14}
            style={[styles.input, { backgroundColor: colors.background }]}
          />

          <GoldButton
            title={canJoin ? 'Join couple' : 'Join couple (enter valid code)'}
            disabled={!canJoin}
            onPress={() => {
              setCoupleCode(joinCodeDraft);
              if (parsedJoinCode) setJoinedTip(true);
            }}
            style={styles.primaryButton}
          />
          {joinedTip ? (
            <Text style={[styles.joinedTip, { color: colors.gold }]}>
              You’re on this couple code — add your partner’s name above, then tap Continue.
            </Text>
          ) : null}

          <GoldButton
            title="Continue"
            disabled={!canContinue}
            onPress={() => {
              const finalName = partnerNameDraft.trim();
              setPartnerName(finalName);
              navigation.replace('MainTabs');
            }}
            style={{ marginTop: 10 }}
          />

          <Pressable
            onPress={goToHome}
            style={({ pressed }) => [styles.homeLink, { opacity: pressed ? 0.75 : 1 }]}
          >
            <Text style={[styles.homeLinkText, { color: colors.gold }]}>Take me to home screen</Text>
          </Pressable>
        </SoftCard>
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  container: {
    flex: 1,
    paddingHorizontal: 20,
    alignItems: 'stretch',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 28,
    flexGrow: 1,
  },
  syncWarning: {
    fontSize: 12,
    fontWeight: '800',
    lineHeight: 17,
    marginBottom: 8,
  },
  syncOk: {
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 17,
    marginBottom: 8,
  },
  input: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
  },
  card: {
    marginTop: 10,
  },
  sectionLabel: {
    color: '#A79F9B',
    fontSize: 12,
    letterSpacing: 0.35,
    fontWeight: '900',
    marginBottom: 10,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(231, 199, 125, 0.14)',
    marginVertical: 16,
  },
  codeBox: {
    borderWidth: 1,
    borderColor: 'rgba(231, 199, 125, 0.30)',
    borderRadius: 16,
    padding: 14,
    backgroundColor: 'rgba(231, 199, 125, 0.05)',
  },
  codeLabel: {
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.35,
    color: '#E7C77D',
    marginBottom: 8,
  },
  codeValue: {
    fontSize: 36,
    fontWeight: '900',
    letterSpacing: 2,
    textAlign: 'center',
    marginBottom: 10,
  },
  codeActions: {
    marginTop: 8,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 10,
  },
  codeActionBtn: {
    minWidth: 140,
    flexGrow: 1,
    maxWidth: 200,
  },
  codeHint: {
    marginTop: 10,
    color: '#A79F9B',
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
    fontWeight: '700',
  },
  primaryButton: {
    marginTop: 14,
  },
  joinedTip: {
    marginTop: 10,
    fontSize: 12,
    fontWeight: '800',
    textAlign: 'center',
    lineHeight: 17,
  },
  homeLink: {
    marginTop: 16,
    alignItems: 'center',
    paddingVertical: 10,
  },
  homeLinkText: {
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 0.2,
    textDecorationLine: 'underline',
  },
});

