import React, { useMemo, useState } from 'react';
import { Image, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';

import { AmbientBackground } from '../../components/AmbientBackground';
import { GoldButton } from '../../components/GoldButton';
import { ScreenHeading } from '../../components/ScreenHeading';
import { SoftCard } from '../../components/SoftCard';
import { useAuth } from '../../state/AuthContext';
import { useTheme } from '../../state/ThemeContext';
import { uploadProfilePhoto } from '../../utils/uploadProfilePhoto';

export function ProfileSetupScreen({ navigation }: { navigation: any }) {
  const { colors } = useTheme();
  const auth = useAuth();
  const [name, setName] = useState(auth.profile?.displayName ?? '');
  const [localPhotoUri, setLocalPhotoUri] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const canContinue = useMemo(() => name.trim().length >= 2 && !busy, [name, busy]);

  return (
    <KeyboardAvoidingView behavior={Platform.select({ ios: 'padding', android: undefined })} style={styles.root}>
      <AmbientBackground />
      <View style={styles.container}>
        <ScreenHeading title="Profile" subtitle="A small signature of you." />

        <SoftCard>
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
            {localPhotoUri || auth.profile?.photoURL ? (
              <Image
                source={{ uri: localPhotoUri ?? auth.profile?.photoURL ?? undefined }}
                style={styles.avatar}
              />
            ) : (
              <Text style={[styles.avatarPlaceholder, { color: colors.text }]}>Add photo</Text>
            )}
          </Pressable>

          <Text style={[styles.label, { color: colors.muted }]}>Display name</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="e.g., Shambhavi"
            placeholderTextColor={colors.muted}
            style={[styles.input, { color: colors.text, borderColor: colors.border }]}
          />

          {error ? <Text style={[styles.error, { color: colors.danger }]}>{error}</Text> : null}

          <GoldButton
            title={busy ? 'Saving…' : 'Continue'}
            disabled={!canContinue}
            onPress={async () => {
              const u = auth.user;
              if (!u) return;
              setBusy(true);
              setError(null);
              try {
                await auth.setDisplayName(name.trim());
                if (localPhotoUri) {
                  const url = await uploadProfilePhoto({ uid: u.uid, uri: localPhotoUri });
                  await auth.setPhotoURL(url);
                }
                navigation.replace('MainTabs');
              } catch (e: any) {
                setError(e?.message ?? 'Could not save profile.');
              } finally {
                setBusy(false);
              }
            }}
            style={{ marginTop: 12 }}
          />
        </SoftCard>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  container: { flex: 1, paddingHorizontal: 20, paddingTop: 18, gap: 14 },
  avatarWrap: {
    height: 120,
    width: 120,
    borderRadius: 999,
    borderWidth: 1,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatar: { width: 120, height: 120 },
  avatarPlaceholder: { fontWeight: '900' },
  label: { fontSize: 12, fontWeight: '900', letterSpacing: 0.35, marginTop: 12 },
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
});

