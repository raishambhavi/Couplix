import React, { useLayoutEffect, useMemo, useState } from 'react';
import {
  Alert,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import QRCode from 'react-native-qrcode-svg';

import { AmbientBackground } from '../../components/AmbientBackground';
import { useAuth } from '../../state/AuthContext';
import { usePairing } from '../../state/PairingContext';
import { useTheme } from '../../state/ThemeContext';
import { uploadProfilePhoto } from '../../utils/uploadProfilePhoto';
import type { SettingsPanelId, SettingsStackParamList } from './settingsNavPrimitives';
import { SettingsGroupCard, SettingsNavRow } from './settingsNavPrimitives';

export function SettingsHomeScreen() {
  const { colors } = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<SettingsStackParamList>>();
  const auth = useAuth();
  const { coupleCode, partnerName, coupleMode } = usePairing();
  const [qrOpen, setQrOpen] = useState(false);

  const go = (panel: SettingsPanelId) => {
    navigation.navigate('SettingsDetail', { panel });
  };

  const pickPhoto = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.9,
    });
    if (!result.canceled && result.assets[0]?.uri && auth.user?.uid) {
      const localUri = result.assets[0].uri;
      try {
        const downloadUrl = await uploadProfilePhoto({ uid: auth.user.uid, uri: localUri });
        await auth.setPhotoURL(downloadUrl);
      } catch (e) {
        const detail = e instanceof Error ? e.message : String(e);
        Alert.alert(
          'Could not upload photo',
          `${detail}\n\nStay signed in and check Storage rules if this keeps failing.`
        );
      }
    }
  };

  const displayName = auth.profile?.displayName?.trim() || 'You';
  const email = auth.profile?.email?.trim() || 'Couplix profile';
  const photoUri = auth.profile?.photoURL?.trim();

  const pairPayload = useMemo(
    () =>
      coupleCode && coupleCode.length > 0
        ? `couplix://pair?code=${encodeURIComponent(coupleCode)}`
        : 'couplix://pair',
    [coupleCode]
  );

  useLayoutEffect(() => {
    /** Opaque quiet-zone — `transparent` here often paints as a solid black tile on iOS SVG. */
    const qrQuietZone = colors.mode === 'dark' ? 'rgba(255,255,255,0.96)' : '#FFFFFF';
    const qrForeground = colors.mode === 'dark' ? '#111111' : '#0A0A0A';

    navigation.setOptions({
      headerRight: () => (
        <Pressable
          onPress={() => setQrOpen(true)}
          hitSlop={10}
          style={({ pressed }) => [{ opacity: pressed ? 0.75 : 1, paddingHorizontal: 6 }]}
        >
          <View style={[styles.headerQrTile, { borderColor: 'rgba(10,10,10,0.1)', backgroundColor: qrQuietZone }]}>
            <QRCode value={pairPayload} size={34} backgroundColor={qrQuietZone} color={qrForeground} quietZone={2} />
          </View>
        </Pressable>
      ),
    });
  }, [navigation, colors.mode, pairPayload]);

  return (
    <>
      <AmbientBackground />
      <ScrollView contentContainerStyle={styles.container} style={styles.root}>
        <View style={[styles.profileHero, { paddingTop: 4 }]}>
          <Pressable onPress={pickPhoto} style={styles.avatarWrap}>
            {photoUri ? (
              <Image source={{ uri: photoUri }} style={[styles.profileHeroAvatar, { borderColor: colors.border }]} />
            ) : (
              <View style={[styles.profileHeroAvatar, { backgroundColor: colors.cardGlow, borderColor: colors.border }]}>
                <Ionicons name="person" size={40} color={colors.gold} />
              </View>
            )}
            <View style={[styles.penFab, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Ionicons name="create-outline" size={15} color={colors.gold} />
            </View>
          </Pressable>
          <Text style={[styles.profileHeroName, { color: colors.text }]}>{displayName}</Text>
          <Text style={[styles.profileHeroSub, { color: colors.muted }]} numberOfLines={1}>
            {email}
          </Text>
          {partnerName?.trim() ? (
            <Text style={[styles.profileHeroPartner, { color: colors.muted }]} numberOfLines={1}>
              with {partnerName.trim()}
            </Text>
          ) : null}
        </View>

        <SettingsGroupCard colors={colors}>
          <SettingsNavRow
            icon="person-outline"
            title="Account & profile"
            subtitle="Full name, email, phone, date of birth"
            showDivider={false}
            colors={colors}
            onPress={() => go('profile')}
          />
          <SettingsNavRow
            icon="document-text-outline"
            title="Personal information"
            subtitle="Hobbies, how you pass time, destination, cuisines"
            showDivider
            colors={colors}
            onPress={() => go('personal')}
          />
          <SettingsNavRow
            icon="heart-outline"
            title="Partner & dates"
            subtitle="Name, birthday, first met, together-for"
            showDivider
            colors={colors}
            onPress={() => go('partner')}
          />
          <SettingsNavRow
            icon="color-palette-outline"
            title="Appearance"
            subtitle="Light or dark theme"
            showDivider
            colors={colors}
            onPress={() => go('appearance')}
          />
          <SettingsNavRow
            icon="notifications-outline"
            title="Notifications"
            subtitle="Sounds, quiet hours, test ping"
            showDivider
            colors={colors}
            onPress={() => go('notifications')}
          />
        </SettingsGroupCard>

        <SettingsGroupCard colors={colors}>
          <SettingsNavRow
            icon="home-outline"
            title="Living situation"
            subtitle={coupleMode === 'together' ? 'Living together' : 'Long distance'}
            showDivider={false}
            colors={colors}
            onPress={() => go('relationship')}
          />
          <SettingsNavRow
            icon="link-outline"
            title="Pairing & couple code"
            subtitle={coupleCode ? `Code ${coupleCode}` : 'Not paired yet'}
            showDivider
            colors={colors}
            onPress={() => go('pairing')}
          />
          <SettingsNavRow
            icon="log-out-outline"
            title="Account & sign out"
            subtitle="Password, leave this device"
            showDivider
            colors={colors}
            onPress={() => go('account')}
          />
        </SettingsGroupCard>
      </ScrollView>

      <Modal visible={qrOpen} transparent animationType="fade" onRequestClose={() => setQrOpen(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setQrOpen(false)}>
          <Pressable style={[styles.modalCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Pair with your partner</Text>
            <Text style={[styles.modalSub, { color: colors.muted }]}>
              They scan this in Couplix or enter the couple code manually.
            </Text>
            <View style={styles.qrBox}>
              <QRCode value={pairPayload} size={200} backgroundColor={colors.surface} color={colors.text} />
            </View>
            {coupleCode ? (
              <Text style={[styles.codeText, { color: colors.text }]} selectable>
                {coupleCode}
              </Text>
            ) : (
              <Text style={[styles.modalSub, { color: colors.muted }]}>Generate a couple code from Pairing first.</Text>
            )}
            <Pressable onPress={() => setQrOpen(false)} style={styles.modalClose}>
              <Text style={{ color: colors.gold, fontWeight: '800' }}>Done</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  /** Light square behind mini QR only — avoids SVG transparent fill bug (black blob) without a dark “button”. */
  headerQrTile: {
    borderRadius: 6,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 2,
    overflow: 'hidden',
  },
  root: { flex: 1 },
  container: {
    paddingHorizontal: 16,
    paddingBottom: 28,
  },
  profileHero: {
    alignItems: 'center',
    marginBottom: 18,
  },
  avatarWrap: {
    position: 'relative',
    marginBottom: 10,
  },
  profileHeroAvatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: StyleSheet.hairlineWidth * 2,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  penFab: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: StyleSheet.hairlineWidth * 2,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.12,
    shadowRadius: 2,
    elevation: 2,
  },
  profileHeroName: {
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
  },
  profileHeroSub: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 4,
    textAlign: 'center',
  },
  profileHeroPartner: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 4,
    textAlign: 'center',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    maxWidth: 340,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 20,
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
  },
  modalSub: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
  },
  qrBox: {
    marginTop: 16,
    padding: 12,
    borderRadius: 12,
  },
  codeText: {
    marginTop: 12,
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: 2,
  },
  modalClose: {
    marginTop: 18,
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
});
