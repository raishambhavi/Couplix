import React, { useMemo, useState } from 'react';
import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';

import { AmbientBackground } from '../../components/AmbientBackground';
import { GoldButton } from '../../components/GoldButton';
import { ScreenHeading } from '../../components/ScreenHeading';
import { SoftCard } from '../../components/SoftCard';
import { useAuth } from '../../state/AuthContext';
import { useTheme } from '../../state/ThemeContext';
import { uploadProfilePhoto } from '../../utils/uploadProfilePhoto';

export function AccountScreen({ navigation }: { navigation: any }) {
  const { colors } = useTheme();
  const auth = useAuth();

  const [name, setName] = useState(auth.profile?.displayName ?? '');
  const [email, setEmail] = useState(auth.profile?.email ?? auth.user?.email ?? '');
  const [phone, setPhone] = useState(auth.profile?.phoneNumber ?? '');
  const [localPhotoUri, setLocalPhotoUri] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  const canSave = useMemo(() => {
    if (busy) return false;
    if (!name.trim()) return false;
    if (!email.trim() || !email.includes('@')) return false;
    return true;
  }, [name, email, busy]);

  const currentPhoto = localPhotoUri ?? auth.profile?.photoURL ?? null;

  return (
    <>
      <AmbientBackground />
      <ScrollView contentContainerStyle={styles.container}>
        <ScreenHeading title="Account" subtitle="Your profile and contact details." />

        <SoftCard>
          <View style={styles.sectionHeader}>
            <Ionicons name="image" size={18} color={colors.gold} />
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Profile picture</Text>
          </View>

          <Pressable
            onPress={async () => {
              setError(null);
              const res = await ImagePicker.requestMediaLibraryPermissionsAsync();
              if (!res.granted) {
                setError('Please allow Photos permission to pick a picture.');
                return;
              }
              const picked = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                quality: 0.9,
                allowsEditing: true,
                aspect: [1, 1],
              });
              if (picked.canceled) return;
              const uri = picked.assets[0]?.uri;
              if (uri) setLocalPhotoUri(uri);
            }}
            style={({ pressed }) => [
              styles.avatarWrap,
              { borderColor: colors.border, backgroundColor: colors.cardGlow, opacity: pressed ? 0.8 : 1 },
            ]}
          >
            {currentPhoto ? (
              <Image source={{ uri: currentPhoto }} style={styles.avatar} />
            ) : (
              <Text style={[styles.avatarPlaceholder, { color: colors.text }]}>Add photo</Text>
            )}
          </Pressable>

          <Text style={[styles.hint, { color: colors.muted }]}>
            Tap to change your profile photo.
          </Text>
        </SoftCard>

        <SoftCard>
          <View style={styles.sectionHeader}>
            <Ionicons name="person" size={18} color={colors.gold} />
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Details</Text>
          </View>

          <Text style={[styles.label, { color: colors.muted }]}>Display name</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Your name"
            placeholderTextColor={colors.muted}
            style={[styles.input, { color: colors.text, borderColor: colors.border }]}
          />

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

          <Text style={[styles.label, { color: colors.muted }]}>Phone number</Text>
          <TextInput
            value={phone}
            onChangeText={setPhone}
            placeholder="+1 555 555 5555"
            placeholderTextColor={colors.muted}
            keyboardType="phone-pad"
            style={[styles.input, { color: colors.text, borderColor: colors.border }]}
          />

          {error ? <Text style={[styles.error, { color: colors.danger }]}>{error}</Text> : null}
          {saved ? <Text style={[styles.saved, { color: colors.gold }]}>{saved}</Text> : null}

          <GoldButton
            title={busy ? 'Saving…' : 'Save changes'}
            disabled={!canSave}
            onPress={async () => {
              setBusy(true);
              setError(null);
              setSaved(null);
              try {
                if (!auth.user) throw new Error('Not signed in.');

                if (name.trim() !== (auth.profile?.displayName ?? '')) {
                  await auth.setDisplayName(name.trim());
                }

                const nextEmail = email.trim();
                if (nextEmail && nextEmail !== (auth.user.email ?? '')) {
                  await auth.updateEmail(nextEmail);
                }

                await auth.setPhoneNumber(phone.trim());

                if (localPhotoUri) {
                  const url = await uploadProfilePhoto({ uid: auth.user.uid, uri: localPhotoUri });
                  await auth.setPhotoURL(url);
                  setLocalPhotoUri(null);
                }

                setSaved('Saved');
                setTimeout(() => setSaved(null), 1500);
              } catch (e: any) {
                const msg = e?.message ?? 'Could not save changes.';
                // Firebase often requires re-auth for sensitive actions like email change.
                setError(
                  msg.includes('requires-recent-login')
                    ? 'For security, please sign out and sign in again, then try changing email.'
                    : msg
                );
              } finally {
                setBusy(false);
              }
            }}
            style={{ marginTop: 14 }}
          />

          <GoldButton
            title={signingOut ? 'Signing out…' : 'Sign out'}
            disabled={signingOut || busy}
            onPress={async () => {
              setSigningOut(true);
              try {
                await auth.signOut();
              } catch (e: unknown) {
                const msg = e && typeof e === 'object' && 'message' in e ? String((e as { message: string }).message) : String(e);
                Alert.alert('Couldn’t sign out', msg || 'Please try again.');
              } finally {
                setSigningOut(false);
              }
            }}
            style={{ marginTop: 10, alignSelf: 'center' }}
          />

          <Pressable
            onPress={() => navigation.goBack()}
            style={({ pressed }) => [styles.backLink, pressed ? { opacity: 0.7 } : null]}
          >
            <Text style={[styles.backLinkText, { color: colors.muted }]}>Back to Settings</Text>
          </Pressable>
        </SoftCard>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 32,
    gap: 14,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '900',
  },
  avatarWrap: {
    height: 120,
    width: 120,
    borderRadius: 999,
    borderWidth: 1,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    marginTop: 6,
  },
  avatar: { width: 120, height: 120 },
  avatarPlaceholder: { fontWeight: '900' },
  hint: {
    marginTop: 10,
    textAlign: 'center',
    fontWeight: '700',
  },
  label: {
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.35,
    marginTop: 10,
  },
  input: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: 'rgba(231, 199, 125, 0.05)',
    fontWeight: '800',
    marginTop: 8,
  },
  error: { marginTop: 12, fontWeight: '800' },
  saved: { marginTop: 12, fontWeight: '900', textAlign: 'center' },
  backLink: { marginTop: 14, alignItems: 'center' },
  backLinkText: { fontWeight: '800' },
});

