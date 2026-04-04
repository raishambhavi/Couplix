import React, { useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { sendPasswordResetEmail } from 'firebase/auth';

import { AmbientBackground } from '../../components/AmbientBackground';
import { GoldButton } from '../../components/GoldButton';
import { ScreenHeading } from '../../components/ScreenHeading';
import { SoftCard } from '../../components/SoftCard';
import { firebaseAuth } from '../../config/firebase';
import { useAuth, WELCOME_BACK_STORAGE_KEY } from '../../state/AuthContext';
import { useTheme } from '../../state/ThemeContext';

export function SignInScreen({ navigation }: { navigation: any }) {
  const { colors } = useTheme();
  const auth = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotBusy, setForgotBusy] = useState(false);
  const [forgotError, setForgotError] = useState<string | null>(null);
  const [forgotSent, setForgotSent] = useState(false);

  const canSubmit = useMemo(() => email.includes('@') && password.length >= 6 && !busy, [email, password, busy]);
  const canSendReset = useMemo(
    () => forgotEmail.trim().includes('@') && !forgotBusy,
    [forgotEmail, forgotBusy]
  );

  return (
    <KeyboardAvoidingView behavior={Platform.select({ ios: 'padding', android: undefined })} style={styles.root}>
      <AmbientBackground />
      <View style={styles.container}>
        <ScreenHeading title="Welcome back" subtitle="Sign in with your email and password to continue." />

        <SoftCard>
          <Text style={[styles.signInHint, { color: colors.muted }]}>
            Sign in below — or create an account if you’re new.
          </Text>
          <Text style={[styles.label, { color: colors.muted }]}>Email</Text>
          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            placeholderTextColor={colors.muted}
            autoCapitalize="none"
            keyboardType="email-address"
            style={[styles.input, { color: colors.text, borderColor: colors.border }]}
          />

          <Text style={[styles.label, { color: colors.muted }]}>Password</Text>
          <TextInput
            value={password}
            onChangeText={setPassword}
            placeholder="••••••••"
            placeholderTextColor={colors.muted}
            secureTextEntry
            style={[styles.input, { color: colors.text, borderColor: colors.border }]}
          />

          <Pressable
            onPress={() => {
              setForgotEmail(email.trim());
              setForgotError(null);
              setForgotSent(false);
              setForgotOpen(true);
            }}
            style={({ pressed }) => [styles.forgotRow, { opacity: pressed ? 0.75 : 1 }]}
          >
            <Text style={[styles.forgotText, { color: colors.gold }]}>Forgot password?</Text>
          </Pressable>

          {error ? <Text style={[styles.error, { color: colors.danger }]}>{error}</Text> : null}

          <GoldButton
            title={busy ? 'Signing in…' : 'Sign in'}
            disabled={!canSubmit}
            onPress={async () => {
              setError(null);
              setBusy(true);
              try {
                const trimmed = email.trim();
                await auth.signIn(trimmed, password);
                try {
                  await firebaseAuth.currentUser?.reload?.();
                } catch {
                  // ignore
                }
                const u = firebaseAuth.currentUser;
                const name =
                  (u?.displayName && u.displayName.trim()) ||
                  (trimmed.includes('@') ? trimmed.split('@')[0] : '') ||
                  'there';
                await AsyncStorage.setItem(
                  WELCOME_BACK_STORAGE_KEY,
                  JSON.stringify({ name, at: Date.now() })
                );
              } catch (e: any) {
                setError(e?.message ?? 'Unable to sign in.');
              } finally {
                setBusy(false);
              }
            }}
            style={{ marginTop: 12 }}
          />

          <Pressable
            onPress={() => navigation.replace('SignUp')}
            style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }, styles.link]}
          >
            <Text style={[styles.linkText, { color: colors.gold }]}>New here? Create an account</Text>
          </Pressable>
        </SoftCard>
      </View>

      <Modal visible={forgotOpen} transparent animationType="fade" onRequestClose={() => setForgotOpen(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setForgotOpen(false)}>
          <Pressable
            style={[styles.modalCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={(e) => e.stopPropagation()}
          >
            <Text style={[styles.modalTitle, { color: colors.text }]}>Reset password</Text>
            <Text style={[styles.modalBody, { color: colors.muted }]}>
              {forgotSent
                ? 'Check your email for a link to choose a new password. If you don’t see it, look in spam or try again in a minute.'
                : 'Enter the email for your account. We’ll send you a reset link.'}
            </Text>
            {!forgotSent ? (
              <>
                <Text style={[styles.label, { color: colors.muted }]}>Email</Text>
                <TextInput
                  value={forgotEmail}
                  onChangeText={setForgotEmail}
                  placeholder="you@example.com"
                  placeholderTextColor={colors.muted}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  style={[styles.input, { color: colors.text, borderColor: colors.border }]}
                />
                {forgotError ? (
                  <Text style={[styles.error, { color: colors.danger }]}>{forgotError}</Text>
                ) : null}
                <GoldButton
                  title={forgotBusy ? 'Sending…' : 'Send reset link'}
                  disabled={!canSendReset}
                  onPress={async () => {
                    const trimmed = forgotEmail.trim();
                    if (!trimmed.includes('@')) {
                      setForgotError('Enter a valid email address.');
                      return;
                    }
                    setForgotBusy(true);
                    setForgotError(null);
                    try {
                      await sendPasswordResetEmail(firebaseAuth, trimmed);
                      setForgotSent(true);
                    } catch (e: any) {
                      setForgotError(e?.message ?? 'Could not send reset email. Try again.');
                    } finally {
                      setForgotBusy(false);
                    }
                  }}
                  style={{ marginTop: 12 }}
                />
                <Pressable
                  onPress={() => setForgotOpen(false)}
                  style={({ pressed }) => [styles.modalCancel, { opacity: pressed ? 0.7 : 1 }]}
                >
                  <Text style={[styles.modalCancelText, { color: colors.muted }]}>Cancel</Text>
                </Pressable>
              </>
            ) : (
              <GoldButton title="Done" onPress={() => setForgotOpen(false)} style={{ marginTop: 8 }} />
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  container: { flex: 1, paddingHorizontal: 20, paddingTop: 18, gap: 14 },
  signInHint: { fontSize: 13, fontWeight: '700', lineHeight: 18, marginBottom: 4 },
  label: { fontSize: 12, fontWeight: '900', letterSpacing: 0.35, marginTop: 2 },
  input: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: 'rgba(231, 199, 125, 0.05)',
    fontWeight: '800',
    marginTop: 8,
  },
  error: { marginTop: 10, fontWeight: '800' },
  forgotRow: {
    alignSelf: 'flex-end',
    marginTop: 8,
    paddingVertical: 4,
  },
  forgotText: {
    fontSize: 13,
    fontWeight: '900',
  },
  link: { marginTop: 14, alignItems: 'center' },
  linkText: { fontWeight: '900' },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    padding: 22,
  },
  modalCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 18,
    gap: 8,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '900',
    textAlign: 'center',
  },
  modalBody: {
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 19,
    textAlign: 'center',
    marginBottom: 6,
  },
  modalCancel: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  modalCancelText: {
    fontSize: 14,
    fontWeight: '900',
  },
});

