import React, { useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { AmbientBackground } from '../../components/AmbientBackground';
import { GoldButton } from '../../components/GoldButton';
import { ScreenHeading } from '../../components/ScreenHeading';
import { SoftCard } from '../../components/SoftCard';
import { useAuth } from '../../state/AuthContext';
import { useTheme } from '../../state/ThemeContext';

export function SignUpScreen({ navigation }: { navigation: any }) {
  const { colors } = useTheme();
  const auth = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const canSubmit = useMemo(() => {
    return email.includes('@') && password.length >= 6 && password === confirm && !busy;
  }, [email, password, confirm, busy]);

  return (
    <KeyboardAvoidingView behavior={Platform.select({ ios: 'padding', android: undefined })} style={styles.root}>
      <AmbientBackground />
      <View style={styles.container}>
        <ScreenHeading title="Create account" subtitle="A private space for the two of you." />

        <SoftCard>
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
            placeholder="At least 6 characters"
            placeholderTextColor={colors.muted}
            secureTextEntry
            style={[styles.input, { color: colors.text, borderColor: colors.border }]}
          />

          <Text style={[styles.label, { color: colors.muted }]}>Confirm password</Text>
          <TextInput
            value={confirm}
            onChangeText={setConfirm}
            placeholder="Repeat password"
            placeholderTextColor={colors.muted}
            secureTextEntry
            style={[styles.input, { color: colors.text, borderColor: colors.border }]}
          />

          {error ? <Text style={[styles.error, { color: colors.danger }]}>{error}</Text> : null}

          <GoldButton
            title={busy ? 'Creating…' : 'Sign up'}
            disabled={!canSubmit}
            onPress={async () => {
              setError(null);
              setBusy(true);
              try {
                await auth.signUp(email.trim(), password);
                navigation.replace('ProfileSetup');
              } catch (e: any) {
                setError(e?.message ?? 'Unable to sign up.');
              } finally {
                setBusy(false);
              }
            }}
            style={{ marginTop: 12 }}
          />

          <Pressable
            onPress={() => navigation.replace('SignIn')}
            style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }, styles.link]}
          >
            <Text style={[styles.linkText, { color: colors.gold }]}>Already have an account? Sign in</Text>
          </Pressable>
        </SoftCard>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  container: { flex: 1, paddingHorizontal: 20, paddingTop: 18, gap: 14 },
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
  link: { marginTop: 14, alignItems: 'center' },
  linkText: { fontWeight: '900' },
});

