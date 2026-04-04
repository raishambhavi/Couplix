import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import { Audio } from 'expo-av';
import * as Notifications from 'expo-notifications';
import * as Haptics from 'expo-haptics';
import { useNavigation } from '@react-navigation/native';

import { Ionicons } from '@expo/vector-icons';
import { AmbientBackground } from '../components/AmbientBackground';
import { ScreenHeading } from '../components/ScreenHeading';
import { SoftCard } from '../components/SoftCard';
import { usePairing } from '../state/PairingContext';
import { useSettings } from '../state/SettingsContext';
import { useTheme } from '../state/ThemeContext';
import { GoldButton } from '../components/GoldButton';
import { useAuth } from '../state/AuthContext';
import { uploadProfilePhoto } from '../utils/uploadProfilePhoto';
import { elapsedSinceMet, MONTH_LABELS, daysInMonth, pad2 } from '../utils/relationshipTime';

export function SettingsScreen() {
  const { mode, setMode, colors, applyTheme } = useTheme();
  const navigation = useNavigation<any>();
  const settings = useSettings();
  const auth = useAuth();
  const {
    coupleCode,
    regenerateCoupleCode,
    partnerName,
    setPartnerName,
    setPresenceStatus,
    coupleMode,
    setCoupleMode,
    beginRePairing,
    partnerBirthMonth,
    partnerBirthDay,
    setPartnerBirthMonth,
    setPartnerBirthDay,
    metAtMs,
    setMetAtMs,
  } = usePairing();

  const [quietStartDraft, setQuietStartDraft] = useState(settings.quietStart);
  const [quietEndDraft, setQuietEndDraft] = useState(settings.quietEnd);
  const [notificationsEnabledDraft, setNotificationsEnabledDraft] = useState(settings.notificationsEnabled);
  const [soundEnabledDraft, setSoundEnabledDraft] = useState(settings.soundEnabled);
  const [vibrationEnabledDraft, setVibrationEnabledDraft] = useState(settings.vibrationEnabled);
  const [notificationToneDraft, setNotificationToneDraft] = useState(settings.notificationTone);
  const [quietHoursEnabledDraft, setQuietHoursEnabledDraft] = useState(settings.quietHoursEnabled);
  const [appearanceModeDraft, setAppearanceModeDraft] = useState(mode);
  const [statusOpen, setStatusOpen] = useState(false);
  const [displayNameDraft, setDisplayNameDraft] = useState(auth.profile?.displayName ?? '');
  const [emailDraft, setEmailDraft] = useState(auth.profile?.email ?? '');
  const [photoDraft, setPhotoDraft] = useState(auth.profile?.photoURL ?? '');
  const [phoneDraft, setPhoneDraft] = useState(auth.profile?.phoneNumber ?? '');

  useEffect(() => {
    setPhotoDraft(auth.profile?.photoURL ?? '');
  }, [auth.profile?.photoURL]);
  useEffect(() => {
    setDisplayNameDraft(auth.profile?.displayName ?? '');
    setEmailDraft(auth.profile?.email ?? '');
    setPhoneDraft(auth.profile?.phoneNumber ?? '');
  }, [auth.profile?.displayName, auth.profile?.email, auth.profile?.phoneNumber]);
  useEffect(() => {
    setAppearanceModeDraft(mode);
  }, [mode]);
  useEffect(() => {
    setNotificationsEnabledDraft(settings.notificationsEnabled);
    setSoundEnabledDraft(settings.soundEnabled);
    setVibrationEnabledDraft(settings.vibrationEnabled);
    setNotificationToneDraft(settings.notificationTone);
    setQuietHoursEnabledDraft(settings.quietHoursEnabled);
    setQuietStartDraft(settings.quietStart);
    setQuietEndDraft(settings.quietEnd);
  }, [
    settings.notificationsEnabled,
    settings.soundEnabled,
    settings.vibrationEnabled,
    settings.notificationTone,
    settings.quietHoursEnabled,
    settings.quietStart,
    settings.quietEnd,
  ]);
  const [favActivity, setFavActivity] = useState('');
  const [hobbies, setHobbies] = useState('');
  const [favDestination, setFavDestination] = useState('');
  const [passTimeBy, setPassTimeBy] = useState('');
  const [profession, setProfession] = useState('');
  const [selectedCuisines, setSelectedCuisines] = useState<string[]>([]);
  const [drinking, setDrinking] = useState<'Yes' | 'No'>('No');
  const [smoking, setSmoking] = useState<'Yes' | 'No'>('No');
  const [partnerNameDraft, setPartnerNameDraft] = useState('');
  const [partnerBirthMonthDraft, setPartnerBirthMonthDraft] = useState<number | null>(null);
  const [partnerBirthDayDraft, setPartnerBirthDayDraft] = useState<number | null>(null);
  const [metDraftMs, setMetDraftMs] = useState<number | null>(null);
  const partnerFieldsTouchedRef = useRef(false);
  const [partnerSaving, setPartnerSaving] = useState(false);
  const [partnerSavedNote, setPartnerSavedNote] = useState('');
  const [monthModalOpen, setMonthModalOpen] = useState(false);
  const [dayModalOpen, setDayModalOpen] = useState(false);
  const [metPickerShow, setMetPickerShow] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileSavedNote, setProfileSavedNote] = useState('');
  const [personalSaving, setPersonalSaving] = useState(false);
  const [personalSavedNote, setPersonalSavedNote] = useState('');
  const [appearanceSaving, setAppearanceSaving] = useState(false);
  const [appearanceSavedNote, setAppearanceSavedNote] = useState('');
  const [notificationsSaving, setNotificationsSaving] = useState(false);
  const [notificationsSavedNote, setNotificationsSavedNote] = useState('');
  const [appearanceSavedMode, setAppearanceSavedMode] = useState(mode);
  const appearanceSavedModeRef = useRef(mode);
  const appearanceDraftModeRef = useRef(appearanceModeDraft);
  const themeLabel = useMemo(
    () => (appearanceModeDraft === 'dark' ? 'Dark mode' : 'Light mode'),
    [appearanceModeDraft]
  );
  const tones = [
    'iPhone Original (System)',
    'Tri-tone',
    'Glass',
    'Chord',
    'Bell',
    'Pulse',
    'Sparkle',
    'Aurora',
    'Ripple',
    'Echo',
    'Starlight',
  ];
  const cuisines = ['Italian', 'Indian', 'Japanese', 'Thai', 'Mexican', 'Mediterranean', 'French', 'Korean'];
  const previewSoundRef = useRef<Audio.Sound | null>(null);
  const previewStopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const vibrationIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const vibrationStopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tonePreviewUrls: Record<string, string> = {
    'Tri-tone': 'https://actions.google.com/sounds/v1/alarms/beep_short.ogg',
    Glass: 'https://actions.google.com/sounds/v1/alarms/dinner_bell_triangle.ogg',
    Chord: 'https://actions.google.com/sounds/v1/alarms/medium_bell_ringing_near.ogg',
    Bell: 'https://actions.google.com/sounds/v1/alarms/alarm_clock.ogg',
    Pulse: 'https://actions.google.com/sounds/v1/alarms/dosimeter_alarm.ogg',
    Sparkle: 'https://actions.google.com/sounds/v1/alarms/setting_alarm_clock.ogg',
    Aurora: 'https://actions.google.com/sounds/v1/alarms/winding_alarm_clock.ogg',
    Ripple: 'https://actions.google.com/sounds/v1/alarms/assorted_computer_sounds.ogg',
    Echo: 'https://actions.google.com/sounds/v1/alarms/radiation_meter.ogg',
    Starlight: 'https://actions.google.com/sounds/v1/alarms/digital_watch_alarm_long.ogg',
  };

  const profileKey = `settings:profileExtras:${auth.user?.uid ?? 'local'}`;

  useEffect(() => {
    if (partnerFieldsTouchedRef.current) return;
    setPartnerNameDraft(partnerName);
    setPartnerBirthMonthDraft(partnerBirthMonth);
    setPartnerBirthDayDraft(partnerBirthDay);
    setMetDraftMs(metAtMs);
  }, [partnerName, partnerBirthMonth, partnerBirthDay, metAtMs]);

  const partnerTabIsDirty = useMemo(() => {
    const nameA = partnerNameDraft.trim();
    const nameB = partnerName.trim();
    const metA = metDraftMs ?? null;
    const metB = metAtMs ?? null;
    return (
      nameA !== nameB ||
      partnerBirthMonthDraft !== partnerBirthMonth ||
      partnerBirthDayDraft !== partnerBirthDay ||
      metA !== metB
    );
  }, [
    partnerNameDraft,
    partnerName,
    partnerBirthMonthDraft,
    partnerBirthMonth,
    partnerBirthDayDraft,
    partnerBirthDay,
    metDraftMs,
    metAtMs,
  ]);

  const [togetherNow, setTogetherNow] = useState(Date.now());
  useEffect(() => {
    if (metDraftMs == null) return;
    const id = setInterval(() => setTogetherNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [metDraftMs]);

  const togetherElapsed = useMemo(
    () => elapsedSinceMet(metDraftMs, togetherNow),
    [metDraftMs, togetherNow]
  );

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(profileKey);
        if (!raw || !mounted) return;
        const p = JSON.parse(raw);
        setFavActivity(p.favActivity ?? '');
        setHobbies(p.hobbies ?? '');
        setFavDestination(p.favDestination ?? '');
        setPassTimeBy(p.passTimeBy ?? '');
        setProfession(p.profession ?? '');
        setSelectedCuisines(Array.isArray(p.selectedCuisines) ? p.selectedCuisines : []);
        setDrinking(p.drinking === 'Yes' ? 'Yes' : 'No');
        setSmoking(p.smoking === 'Yes' ? 'Yes' : 'No');
      } catch {
        // ignore
      }
    })();
    return () => {
      mounted = false;
    };
  }, [profileKey]);

  useEffect(() => {
    return () => {
      if (previewStopTimerRef.current) {
        clearTimeout(previewStopTimerRef.current);
      }
      if (vibrationIntervalRef.current) {
        clearInterval(vibrationIntervalRef.current);
      }
      if (vibrationStopTimerRef.current) {
        clearTimeout(vibrationStopTimerRef.current);
      }
      previewSoundRef.current?.unloadAsync().catch(() => {});
      previewSoundRef.current = null;
    };
  }, []);

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
        setPhotoDraft(downloadUrl);
        setProfileSavedNote('');
      } catch (e) {
        const detail = e instanceof Error ? e.message : String(e);
        Alert.alert(
          'Could not upload photo',
          `${detail}\n\nTips: deploy Storage rules (npm run deploy:storage-rules), enable Storage in Firebase Console, stay signed in, and use the same bucket as EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET.`
        );
      }
    }
  };

  const toggleCuisine = (c: string) => {
    setSelectedCuisines((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]));
  };

  const playTonePreview = async (tone: string) => {
    if (!soundEnabledDraft) return;
    if (tone === 'iPhone Original (System)') {
      try {
        const ok = await settings.requestNotificationPermission();
        if (!ok) return;
        await Notifications.scheduleNotificationAsync({
          content: {
            title: 'Couplix',
            body: 'iPhone Original tone preview',
            sound: 'default',
          },
          trigger: { seconds: 1, type: 'timeInterval' } as any,
        });
      } catch {
        // ignore preview failures
      }
      return;
    }
    const uri = tonePreviewUrls[tone];
    if (!uri) return;
    try {
      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        allowsRecordingIOS: false,
      });
      if (previewSoundRef.current) {
        await previewSoundRef.current.unloadAsync();
        previewSoundRef.current = null;
      }
      if (previewStopTimerRef.current) {
        clearTimeout(previewStopTimerRef.current);
        previewStopTimerRef.current = null;
      }
      const { sound } = await Audio.Sound.createAsync({ uri }, { shouldPlay: true, volume: 0.9 });
      previewSoundRef.current = sound;
      previewStopTimerRef.current = setTimeout(() => {
        sound.stopAsync().catch(() => {});
        sound.unloadAsync().catch(() => {});
        if (previewSoundRef.current === sound) {
          previewSoundRef.current = null;
        }
      }, 1800);
      sound.setOnPlaybackStatusUpdate((status) => {
        if (!status.isLoaded) return;
        if (status.didJustFinish) {
          if (previewStopTimerRef.current) {
            clearTimeout(previewStopTimerRef.current);
            previewStopTimerRef.current = null;
          }
          sound.unloadAsync().catch(() => {});
          if (previewSoundRef.current === sound) {
            previewSoundRef.current = null;
          }
        }
      });
    } catch {
      // ignore preview failures
    }
  };

  const playVibrationPreview = async () => {
    try {
      if (vibrationIntervalRef.current) {
        clearInterval(vibrationIntervalRef.current);
      }
      if (vibrationStopTimerRef.current) {
        clearTimeout(vibrationStopTimerRef.current);
      }

      // Run repeated haptics for about 2 seconds as a preview.
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      vibrationIntervalRef.current = setInterval(() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      }, 260);

      vibrationStopTimerRef.current = setTimeout(() => {
        if (vibrationIntervalRef.current) {
          clearInterval(vibrationIntervalRef.current);
          vibrationIntervalRef.current = null;
        }
      }, 2000);
    } catch {
      // ignore preview failures
    }
  };

  const profileDirty =
    displayNameDraft.trim() !== (auth.profile?.displayName ?? '').trim() ||
    emailDraft.trim() !== (auth.profile?.email ?? '').trim() ||
    phoneDraft.trim() !== (auth.profile?.phoneNumber ?? '').trim() ||
    photoDraft.trim() !== (auth.profile?.photoURL ?? '').trim();
  const appearanceDirty = appearanceModeDraft !== appearanceSavedMode;
  const notificationsDirty =
    notificationsEnabledDraft !== settings.notificationsEnabled ||
    soundEnabledDraft !== settings.soundEnabled ||
    vibrationEnabledDraft !== settings.vibrationEnabled ||
    notificationToneDraft !== settings.notificationTone ||
    quietHoursEnabledDraft !== settings.quietHoursEnabled ||
    quietStartDraft !== settings.quietStart ||
    quietEndDraft !== settings.quietEnd;

  const saveProfileChanges = async () => {
    if (!profileDirty || profileSaving) return;
    setProfileSaving(true);
    try {
      const nextName = displayNameDraft.trim();
      const nextEmail = emailDraft.trim();
      const nextPhone = phoneDraft.trim();
      const nextPhoto = photoDraft.trim();
      if (nextName && nextName !== (auth.profile?.displayName ?? '').trim()) await auth.setDisplayName(nextName);
      if (nextEmail && nextEmail !== (auth.profile?.email ?? '').trim()) await auth.updateEmail(nextEmail);
      if (nextPhone && nextPhone !== (auth.profile?.phoneNumber ?? '').trim()) await auth.setPhoneNumber(nextPhone);
      if (nextPhoto && nextPhoto !== (auth.profile?.photoURL ?? '').trim()) await auth.setPhotoURL(nextPhoto);
      setProfileSavedNote('Changes saved');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      Alert.alert('Could not save profile', msg || 'Please try again.');
    } finally {
      setProfileSaving(false);
    }
  };

  const savePersonalInfo = async () => {
    if (personalSaving) return;
    setPersonalSaving(true);
    try {
      await AsyncStorage.setItem(
        profileKey,
        JSON.stringify({
          favActivity,
          hobbies,
          favDestination,
          passTimeBy,
          profession,
          selectedCuisines,
          drinking,
          smoking,
        })
      );
      setPersonalSavedNote('Changes saved');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } catch {
      Alert.alert('Could not save personal info', 'Please try again.');
    } finally {
      setPersonalSaving(false);
    }
  };

  const saveAppearance = async () => {
    if (appearanceSaving) return;
    setAppearanceSaving(true);
    try {
      applyTheme(appearanceModeDraft);
      setAppearanceSavedMode(appearanceModeDraft);
      appearanceSavedModeRef.current = appearanceModeDraft;
      setAppearanceSavedNote('Changes saved');
      Haptics.selectionAsync().catch(() => {});
    } finally {
      setAppearanceSaving(false);
    }
  };

  useEffect(() => {
    appearanceDraftModeRef.current = appearanceModeDraft;
  }, [appearanceModeDraft]);

  useEffect(() => {
    return () => {
      if (appearanceDraftModeRef.current !== appearanceSavedModeRef.current) {
        setMode(appearanceSavedModeRef.current);
      }
    };
  }, [setMode]);

  const savePartnerTab = async () => {
    if (!partnerTabIsDirty || partnerSaving) return;
    setPartnerSaving(true);
    try {
      setPartnerName(partnerNameDraft.trim());
      setPartnerBirthMonth(partnerBirthMonthDraft);
      setPartnerBirthDay(partnerBirthDayDraft);
      setMetAtMs(metDraftMs);
      partnerFieldsTouchedRef.current = false;
      setPartnerSavedNote('Changes saved');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } finally {
      setPartnerSaving(false);
    }
  };

  const saveNotifications = async () => {
    if (!notificationsDirty || notificationsSaving) return;
    setNotificationsSaving(true);
    try {
      settings.setNotificationsEnabled(notificationsEnabledDraft);
      settings.setSoundEnabled(soundEnabledDraft);
      settings.setVibrationEnabled(vibrationEnabledDraft);
      settings.setNotificationTone(notificationToneDraft);
      settings.setQuietHoursEnabled(quietHoursEnabledDraft);
      settings.setQuietStart(quietStartDraft);
      settings.setQuietEnd(quietEndDraft);
      if (notificationsEnabledDraft) await settings.requestNotificationPermission();
      setNotificationsSavedNote('Changes saved');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } finally {
      setNotificationsSaving(false);
    }
  };

  return (
    <>
      <AmbientBackground />
      <View style={styles.screenRoot}>
        <ScrollView contentContainerStyle={styles.container} style={styles.root}>
          <ScreenHeading title="Settings" subtitle="Everything that keeps Couplix effortless." />

        <SoftCard>
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="person" size={18} color={colors.gold} />
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Manage Profile</Text>
            </View>

            <View style={styles.profileRow}>
              <Text style={[styles.rowLabel, { color: colors.text }]}>Name</Text>
              <View style={styles.profileActionRow}>
                <TextInput
                  value={displayNameDraft}
                  onChangeText={setDisplayNameDraft}
                  placeholder="Your name"
                  placeholderTextColor={colors.muted}
                  style={[styles.inlineInput, { color: colors.text, borderColor: colors.border }]}
                />
                <Pressable onPress={() => setDisplayNameDraft(auth.profile?.displayName ?? '')} style={styles.iconBtn}>
                  <Ionicons name="create-outline" size={18} color={colors.gold} />
                </Pressable>
              </View>
            </View>

            <View style={styles.profileRow}>
              <Text style={[styles.rowLabel, { color: colors.text }]}>Email</Text>
              <View style={styles.profileActionRow}>
                <TextInput
                  value={emailDraft}
                  onChangeText={setEmailDraft}
                  placeholder="you@email.com"
                  placeholderTextColor={colors.muted}
                  style={[styles.inlineInput, { color: colors.text, borderColor: colors.border }]}
                  autoCapitalize="none"
                />
                <Pressable onPress={() => setEmailDraft(auth.profile?.email ?? '')} style={styles.iconBtn}>
                  <Ionicons name="create-outline" size={18} color={colors.gold} />
                </Pressable>
              </View>
            </View>

            <View style={styles.profileRow}>
              <Text style={[styles.rowLabel, { color: colors.text }]}>Photo</Text>
              <View style={styles.profileActionRow}>
                {photoDraft ? (
                  <Image key={photoDraft} source={{ uri: photoDraft }} style={styles.avatar} />
                ) : (
                  <View style={styles.avatar} />
                )}
                <Pressable onPress={pickPhoto} style={styles.iconBtn}>
                  <Ionicons name="create-outline" size={18} color={colors.gold} />
                </Pressable>
              </View>
            </View>

            <View style={styles.profileRow}>
              <Text style={[styles.rowLabel, { color: colors.text }]}>Phone</Text>
              <View style={styles.profileActionRow}>
                <TextInput
                  value={phoneDraft}
                  onChangeText={setPhoneDraft}
                  placeholder="+1 0000000000"
                  placeholderTextColor={colors.muted}
                  style={[styles.inlineInput, { color: colors.text, borderColor: colors.border }]}
                  keyboardType="phone-pad"
                />
                <Pressable onPress={() => setPhoneDraft(auth.profile?.phoneNumber ?? '')} style={styles.iconBtn}>
                  <Ionicons name="create-outline" size={18} color={colors.gold} />
                </Pressable>
              </View>
            </View>
            <View style={styles.saveRow}>
              <GoldButton
                title={profileSaving ? 'Saving…' : 'Save Changes'}
                onPress={saveProfileChanges}
                disabled={!profileDirty || profileSaving}
                style={styles.smallAction}
              />
              {profileSavedNote ? <Text style={[styles.savedNote, { color: colors.gold }]}>{profileSavedNote}</Text> : null}
            </View>
          </View>
        </SoftCard>

        <SoftCard>
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="heart" size={18} color="#EC4899" />
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Partner</Text>
            </View>
            <Text style={[styles.pairHint, { color: colors.muted }]}>
              Works in both living-together and long-distance modes. Saved to your couple space.
            </Text>
            <Text style={[styles.rowLabel, { color: colors.text, marginTop: 10 }]}>Partner name</Text>
            <TextInput
              value={partnerNameDraft}
              onChangeText={(t) => {
                partnerFieldsTouchedRef.current = true;
                setPartnerNameDraft(t);
                setPartnerSavedNote('');
              }}
              placeholder="Their name"
              placeholderTextColor={colors.muted}
              style={[styles.input, { color: colors.text, borderColor: colors.border }]}
            />
            <Text style={[styles.rowLabel, { color: colors.text }]}>Birthday (month & day)</Text>
            <View style={styles.partnerPickRow}>
              <Pressable
                onPress={() => setMonthModalOpen(true)}
                style={[styles.partnerPick, { borderColor: colors.border }]}
              >
                <Text style={[styles.partnerPickText, { color: colors.text }]}>
                  {partnerBirthMonthDraft != null ? MONTH_LABELS[partnerBirthMonthDraft - 1] : 'Month'}
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setDayModalOpen(true)}
                style={[styles.partnerPick, { borderColor: colors.border }]}
              >
                <Text style={[styles.partnerPickText, { color: colors.text }]}>
                  {partnerBirthDayDraft != null ? String(partnerBirthDayDraft) : 'Day'}
                </Text>
              </Pressable>
            </View>
            <Text style={[styles.rowLabel, { color: colors.text }]}>When you first met</Text>
            <Pressable
              onPress={() => setMetPickerShow(true)}
              style={[styles.partnerPick, { borderColor: colors.border, alignSelf: 'stretch' }]}
            >
              <Text style={[styles.partnerPickText, { color: colors.text }]}>
                {metDraftMs != null
                  ? new Date(metDraftMs).toLocaleDateString(undefined, {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                    })
                  : 'Choose date'}
              </Text>
            </Pressable>
            {metPickerShow ? (
              <DateTimePicker
                value={metDraftMs != null ? new Date(metDraftMs) : new Date(2018, 5, 1)}
                mode="date"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                themeVariant={mode === 'dark' ? 'dark' : 'light'}
                maximumDate={new Date()}
                onChange={(ev, date) => {
                  if (Platform.OS === 'android') setMetPickerShow(false);
                  if (ev.type === 'dismissed' && Platform.OS === 'android') return;
                  if (date) {
                    partnerFieldsTouchedRef.current = true;
                    const normalized = new Date(date.getFullYear(), date.getMonth(), date.getDate());
                    setMetDraftMs(normalized.getTime());
                    setPartnerSavedNote('');
                  }
                }}
              />
            ) : null}
            {Platform.OS === 'ios' && metPickerShow ? (
              <GoldButton title="Done" onPress={() => setMetPickerShow(false)} style={{ marginTop: 8 }} />
            ) : null}

            <LinearGradient
              colors={['rgba(236,72,153,0.45)', 'rgba(15,10,20,0.92)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.togetherBanner}
            >
              <Text style={styles.togetherBannerEyebrow}>Together for</Text>
              {togetherElapsed ? (
                <>
                  <Text style={styles.togetherBannerNumber}>{togetherElapsed.totalDays}</Text>
                  <Text style={styles.togetherBannerUnit}>days</Text>
                  <View style={styles.togetherClockRow}>
                    <Text style={styles.togetherClockPiece}>{pad2(togetherElapsed.hours)}</Text>
                    <Text style={styles.togetherClockSep}>:</Text>
                    <Text style={styles.togetherClockPiece}>{pad2(togetherElapsed.minutes)}</Text>
                    <Text style={styles.togetherClockSep}>:</Text>
                    <Text style={styles.togetherClockPiece}>{pad2(togetherElapsed.seconds)}</Text>
                  </View>
                  <Text style={styles.togetherClockHint}>hours · min · sec (live)</Text>
                </>
              ) : (
                <>
                  <Text style={styles.togetherBannerNumber}>—</Text>
                  <Text style={styles.togetherBannerUnit}>set your first-met date</Text>
                </>
              )}
            </LinearGradient>

            <View style={styles.saveRow}>
              <GoldButton
                title={partnerSaving ? 'Saving…' : 'Save Changes'}
                onPress={savePartnerTab}
                disabled={!partnerTabIsDirty || partnerSaving}
                style={styles.smallAction}
              />
              {partnerSavedNote ? (
                <Text style={[styles.savedNote, { color: colors.gold }]}>{partnerSavedNote}</Text>
              ) : null}
            </View>
          </View>
        </SoftCard>

        <Modal visible={monthModalOpen} transparent animationType="fade" onRequestClose={() => setMonthModalOpen(false)}>
          <Pressable style={styles.modalBackdrop} onPress={() => setMonthModalOpen(false)}>
            <Pressable style={[styles.modalCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Month</Text>
              <ScrollView style={{ maxHeight: 360 }}>
                {MONTH_LABELS.map((label, idx) => (
                  <Pressable
                    key={label}
                    onPress={() => {
                      partnerFieldsTouchedRef.current = true;
                      setPartnerBirthMonthDraft(idx + 1);
                      setMonthModalOpen(false);
                      setPartnerSavedNote('');
                    }}
                    style={styles.modalLine}
                  >
                    <Text style={[styles.modalLineText, { color: colors.text }]}>{label}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            </Pressable>
          </Pressable>
        </Modal>

        <Modal visible={dayModalOpen} transparent animationType="fade" onRequestClose={() => setDayModalOpen(false)}>
          <Pressable style={styles.modalBackdrop} onPress={() => setDayModalOpen(false)}>
            <Pressable style={[styles.modalCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Day</Text>
              <ScrollView style={{ maxHeight: 360 }}>
                {Array.from(
                  {
                    length: daysInMonth(
                      partnerBirthMonthDraft ?? 1,
                      new Date().getFullYear()
                    ),
                  },
                  (_, i) => i + 1
                ).map((d) => (
                  <Pressable
                    key={d}
                    onPress={() => {
                      partnerFieldsTouchedRef.current = true;
                      setPartnerBirthDayDraft(d);
                      setDayModalOpen(false);
                      setPartnerSavedNote('');
                    }}
                    style={styles.modalLine}
                  >
                    <Text style={[styles.modalLineText, { color: colors.text }]}>{d}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            </Pressable>
          </Pressable>
        </Modal>

        <SoftCard>
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="document-text" size={18} color={colors.gold} />
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Personal Information</Text>
            </View>
            <TextInput value={favActivity} onChangeText={setFavActivity} placeholder="Favourite activity" placeholderTextColor={colors.muted} style={[styles.input, { color: colors.text, borderColor: colors.border }]} />
            <TextInput value={hobbies} onChangeText={setHobbies} placeholder="Interests and hobbies" placeholderTextColor={colors.muted} style={[styles.input, { color: colors.text, borderColor: colors.border }]} />
            <TextInput value={favDestination} onChangeText={setFavDestination} placeholder="Favourite destination" placeholderTextColor={colors.muted} style={[styles.input, { color: colors.text, borderColor: colors.border }]} />
            <TextInput value={passTimeBy} onChangeText={setPassTimeBy} placeholder="I pass my time by..." placeholderTextColor={colors.muted} style={[styles.input, { color: colors.text, borderColor: colors.border }]} />
            <TextInput value={profession} onChangeText={setProfession} placeholder="Profession" placeholderTextColor={colors.muted} style={[styles.input, { color: colors.text, borderColor: colors.border }]} />

            <Text style={[styles.pairHint, { color: colors.muted }]}>Cuisine I like (multiple)</Text>
            <View style={styles.cuisineGrid}>
              {cuisines.map((c) => (
                <Pressable
                  key={c}
                  onPress={() => toggleCuisine(c)}
                  style={[
                    styles.cuisineChip,
                    {
                      borderColor: selectedCuisines.includes(c) ? colors.gold : colors.border,
                      backgroundColor: selectedCuisines.includes(c)
                        ? 'rgba(231,199,125,0.2)'
                        : 'rgba(231,199,125,0.06)',
                    },
                  ]}
                >
                  <Text style={[styles.cuisineChipText, { color: colors.text }]}>{c}</Text>
                </Pressable>
              ))}
            </View>

            <Text style={[styles.pairHint, { color: colors.muted }]}>Lifestyle</Text>
            <View style={styles.row}>
              <Text style={[styles.rowLabel, { color: colors.text }]}>Like drinking</Text>
              <View style={styles.modeRow}>
                {(['Yes', 'No'] as const).map((v) => (
                  <Pressable
                    key={v}
                    onPress={() => setDrinking(v)}
                    style={[
                      styles.modeChip,
                      {
                        borderColor: drinking === v ? colors.gold : colors.border,
                        backgroundColor: drinking === v ? 'rgba(231,199,125,0.2)' : 'rgba(231,199,125,0.06)',
                      },
                    ]}
                  >
                    <Text style={[styles.modeChipText, { color: colors.text }]}>{v}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
            <View style={styles.row}>
              <Text style={[styles.rowLabel, { color: colors.text }]}>Smoking</Text>
              <View style={styles.modeRow}>
                {(['Yes', 'No'] as const).map((v) => (
                  <Pressable
                    key={v}
                    onPress={() => setSmoking(v)}
                    style={[
                      styles.modeChip,
                      {
                        borderColor: smoking === v ? colors.gold : colors.border,
                        backgroundColor: smoking === v ? 'rgba(231,199,125,0.2)' : 'rgba(231,199,125,0.06)',
                      },
                    ]}
                  >
                    <Text style={[styles.modeChipText, { color: colors.text }]}>{v}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
            <View style={styles.saveRow}>
              <GoldButton
                title={personalSaving ? 'Saving…' : 'Save Changes'}
                onPress={savePersonalInfo}
                disabled={personalSaving}
                style={styles.smallAction}
              />
              {personalSavedNote ? <Text style={[styles.savedNote, { color: colors.gold }]}>{personalSavedNote}</Text> : null}
            </View>
          </View>
        </SoftCard>

        <SoftCard>
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="color-palette" size={18} color={colors.gold} />
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Appearance</Text>
            </View>
            <View style={styles.row}>
              <Text style={[styles.rowLabel, { color: colors.text }]}>{themeLabel}</Text>
              <Switch
                value={appearanceModeDraft === 'light'}
                onValueChange={(v) => {
                  const next = v ? 'light' : 'dark';
                  setAppearanceModeDraft(next);
                  setMode(next);
                  setAppearanceSavedNote('');
                }}
              />
            </View>
            <Text style={[styles.pairHint, { color: colors.muted }]}>
              Rose Light look is always on — choose light or dark below, then save.
            </Text>
            <View style={styles.actionRow}>
              <GoldButton
                title={appearanceSaving ? 'Saving…' : 'Save Changes'}
                onPress={saveAppearance}
                disabled={!appearanceDirty || appearanceSaving}
                style={styles.smallAction}
              />
            </View>
            {appearanceSavedNote ? <Text style={[styles.savedNote, { color: colors.gold }]}>{appearanceSavedNote}</Text> : null}
          </View>
        </SoftCard>

        <SoftCard>
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="notifications" size={18} color={colors.gold} />
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Notifications</Text>
            </View>

            <View style={styles.row}>
              <Text style={[styles.rowLabel, { color: colors.text }]}>Enable notifications</Text>
              <Switch
                value={notificationsEnabledDraft}
                onValueChange={async (v) => {
                  setNotificationsEnabledDraft(v);
                  setNotificationsSavedNote('');
                }}
              />
            </View>

            <View style={styles.row}>
              <Text style={[styles.rowLabel, { color: colors.text }]}>Sound</Text>
              <Switch
                value={soundEnabledDraft}
                onValueChange={(v) => {
                  setSoundEnabledDraft(v);
                  setNotificationsSavedNote('');
                }}
                disabled={!notificationsEnabledDraft}
              />
            </View>

            <Text style={[styles.pairHint, { color: colors.muted }]}>Notification sound</Text>
            <View style={{ opacity: soundEnabledDraft ? 1 : 0.45 }}>
              {soundEnabledDraft ? (
                <View style={styles.modeRow}>
                  {tones.map((tone) => (
                    <Pressable
                      key={tone}
                      onPress={async () => {
                        setNotificationToneDraft(tone);
                        setNotificationsSavedNote('');
                        await playTonePreview(tone);
                      }}
                      style={[
                        styles.modeChip,
                        {
                          borderColor: notificationToneDraft === tone ? colors.gold : colors.border,
                          backgroundColor:
                            notificationToneDraft === tone
                              ? 'rgba(231,199,125,0.2)'
                              : 'rgba(231,199,125,0.06)',
                        },
                      ]}
                    >
                      <Text style={[styles.modeChipText, { color: colors.text }]}>{tone}</Text>
                    </Pressable>
                  ))}
                </View>
              ) : (
                <Text style={[styles.quietLabel, { color: colors.muted }]}>
                  Turn Sound on to choose and preview tones.
                </Text>
              )}
            </View>

            <View style={styles.row}>
              <Text style={[styles.rowLabel, { color: colors.text }]}>Vibration</Text>
              <Switch
                value={vibrationEnabledDraft}
                onValueChange={async (v) => {
                  setVibrationEnabledDraft(v);
                  setNotificationsSavedNote('');
                  if (v) {
                    await playVibrationPreview();
                  } else if (vibrationIntervalRef.current) {
                    clearInterval(vibrationIntervalRef.current);
                    vibrationIntervalRef.current = null;
                  }
                }}
                disabled={!notificationsEnabledDraft}
              />
            </View>

            <View style={[styles.divider, { backgroundColor: 'rgba(231, 199, 125, 0.14)' }]} />

            <View style={styles.row}>
              <Text style={[styles.rowLabel, { color: colors.text }]}>Quiet hours</Text>
              <Switch
                value={quietHoursEnabledDraft}
                onValueChange={(v) => {
                  setQuietHoursEnabledDraft(v);
                  setNotificationsSavedNote('');
                }}
              />
            </View>

            {quietHoursEnabledDraft ? (
              <View style={styles.quietGrid}>
                <View style={styles.quietField}>
                  <Text style={[styles.quietLabel, { color: colors.muted }]}>From</Text>
                  <TextInput
                    value={quietStartDraft}
                    onChangeText={(v) => {
                      setQuietStartDraft(v);
                      setNotificationsSavedNote('');
                    }}
                    placeholder="21:00"
                    placeholderTextColor={colors.muted}
                    style={[styles.input, { color: colors.text, borderColor: colors.border }]}
                    keyboardType="numbers-and-punctuation"
                    maxLength={5}
                  />
                </View>
                <View style={styles.quietField}>
                  <Text style={[styles.quietLabel, { color: colors.muted }]}>To</Text>
                  <TextInput
                    value={quietEndDraft}
                    onChangeText={(v) => {
                      setQuietEndDraft(v);
                      setNotificationsSavedNote('');
                    }}
                    placeholder="07:00"
                    placeholderTextColor={colors.muted}
                    style={[styles.input, { color: colors.text, borderColor: colors.border }]}
                    keyboardType="numbers-and-punctuation"
                    maxLength={5}
                  />
                </View>
              </View>
            ) : null}
            <View style={styles.saveRow}>
              <GoldButton
                title={notificationsSaving ? 'Saving…' : 'Save Changes'}
                onPress={saveNotifications}
                disabled={!notificationsDirty || notificationsSaving}
                style={styles.smallAction}
              />
              {notificationsSavedNote ? (
                <Text style={[styles.savedNote, { color: colors.gold }]}>{notificationsSavedNote}</Text>
              ) : null}
            </View>

            <GoldButton
              title="Send test notification"
              onPress={async () => {
                const ok = await settings.requestNotificationPermission();
                if (!ok) return;
                settings.sendTestNotification();
              }}
              style={{ marginTop: 12, alignSelf: 'center' }}
              disabled={!notificationsEnabledDraft}
            />
          </View>
        </SoftCard>

        <SoftCard>
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="heart" size={18} color={colors.gold} />
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Relationship</Text>
            </View>
            <Text style={[styles.pairHint, { color: colors.muted }]}>
              Keep your relationship mode in sync so both partners see the right experience.
            </Text>
            <Text style={[styles.rowLabel, { color: colors.text }]}>
              Status of Living: {coupleMode === 'together' ? 'Living together' : 'Long distance'}
            </Text>
            <GoldButton title="Change status of living" onPress={() => setStatusOpen(true)} />
          </View>
        </SoftCard>

        <SoftCard>
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="link" size={18} color={colors.gold} />
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Pairing</Text>
            </View>

            <Text style={[styles.pairHint, { color: colors.muted }]}>
              Share this code so your partner joins the same couple in the app. Profile photos sync after both use the
              same code and upload a photo in Settings.
            </Text>
            <Text style={[styles.pairCode, { color: colors.text }]}>{coupleCode ?? 'Not set'}</Text>

            <GoldButton
              title="Pair again (new code or different partner)"
              onPress={async () => {
                await beginRePairing();
                const parent = navigation.getParent();
                if (parent && 'navigate' in parent) {
                  (parent as { navigate: (n: string) => void }).navigate('Onboarding');
                } else {
                  navigation.navigate('Onboarding' as never);
                }
              }}
              style={{ alignSelf: 'center' }}
            />

            <Text style={[styles.pairHint, { color: colors.muted, marginTop: 10 }]}>
              Keeps your account — clears partner name, creates a new couple code, and opens the pairing steps.
            </Text>

            <Pressable
              onPress={() => {
                setPartnerName('');
                setPresenceStatus('free');
                regenerateCoupleCode();
              }}
              style={({ pressed }) => [
                styles.resetBtn,
                { opacity: pressed ? 0.75 : 1 },
              ]}
            >
              <Text style={[styles.resetBtnText, { color: colors.danger }]}>New code only (same device)</Text>
            </Pressable>
          </View>
        </SoftCard>

        <SoftCard>
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="person" size={18} color={colors.gold} />
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Account</Text>
            </View>

            <GoldButton
              title={signingOut ? 'Signing out…' : 'Sign out'}
              disabled={signingOut}
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
              style={{ marginTop: 4, alignSelf: 'center' }}
            />
            <Text style={[styles.accountHint, { color: colors.muted }]}>
              After signing out, you’ll briefly see a blank screen, then the welcome screen with Sign in and your email
              field.
            </Text>
          </View>
        </SoftCard>
        </ScrollView>
        <Pressable
          onPress={() => {
            if (navigation.canGoBack()) navigation.goBack();
            else (globalThis as any).__couplixOpenIndex?.();
          }}
          style={({ pressed }) => [
            styles.backFab,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
              opacity: pressed ? 0.75 : 1,
            },
          ]}
        >
          <Ionicons name="arrow-back" size={20} color={colors.gold} />
        </Pressable>
      </View>

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
  screenRoot: {
    flex: 1,
    paddingTop: 96,
    paddingBottom: 0,
  },
  root: {
    flex: 1,
  },
  container: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 12,
    gap: 14,
  },
  section: {
    gap: 14,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '900',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
  },
  saveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 4,
  },
  savedNote: {
    fontSize: 12,
    fontWeight: '800',
  },
  smallAction: {
    minWidth: 140,
  },
  modeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  modeChip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  modeChipText: {
    fontSize: 12,
    fontWeight: '800',
  },
  cuisineGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  cuisineChip: {
    borderWidth: 1,
    borderRadius: 12,
    minWidth: '30%',
    paddingHorizontal: 12,
    paddingVertical: 10,
    alignItems: 'center',
  },
  cuisineChipText: {
    fontSize: 13,
    fontWeight: '800',
  },
  rowLabel: {
    fontSize: 14,
    fontWeight: '800',
  },
  divider: {
    height: 1,
  },
  quietGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  quietField: {
    flex: 1,
    gap: 8,
  },
  quietLabel: {
    fontSize: 12,
    fontWeight: '800',
  },
  input: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: 'rgba(231, 199, 125, 0.05)',
    fontWeight: '800',
  },
  inlineInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: 'rgba(231, 199, 125, 0.05)',
    fontWeight: '700',
  },
  profileRow: {
    gap: 8,
  },
  profileActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: 'rgba(231,199,125,0.12)',
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(231,199,125,0.35)',
    backgroundColor: 'rgba(231,199,125,0.08)',
  },
  pairHint: {
    fontSize: 12,
    fontWeight: '800',
  },
  accountHint: {
    marginTop: 12,
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 17,
    textAlign: 'center',
    paddingHorizontal: 4,
  },
  pairCode: {
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: 8,
    textAlign: 'center',
    marginTop: -4,
    marginBottom: 6,
  },
  resetBtn: {
    marginTop: 8,
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  resetBtnText: {
    fontWeight: '900',
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
  backFab: {
    position: 'absolute',
    right: 16,
    bottom: 92,
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  partnerPickRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  partnerPick: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(231, 199, 125, 0.05)',
  },
  partnerPickText: {
    fontSize: 14,
    fontWeight: '800',
    textAlign: 'center',
  },
  togetherBanner: {
    marginTop: 14,
    borderRadius: 16,
    paddingVertical: 18,
    paddingHorizontal: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(244,114,182,0.35)',
  },
  togetherBannerEyebrow: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  togetherBannerNumber: {
    color: '#FFF',
    fontSize: 44,
    fontWeight: '900',
    marginTop: 6,
  },
  togetherBannerUnit: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 13,
    fontWeight: '800',
    marginTop: 2,
  },
  togetherClockRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    gap: 4,
  },
  togetherClockPiece: {
    color: '#FFF',
    fontSize: 22,
    fontWeight: '900',
  },
  togetherClockSep: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 20,
    fontWeight: '800',
  },
  togetherClockHint: {
    color: 'rgba(255,255,255,0.65)',
    fontSize: 10,
    fontWeight: '800',
    marginTop: 8,
    letterSpacing: 0.6,
  },
  modalLine: {
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  modalLineText: {
    fontSize: 16,
    fontWeight: '800',
  },
});

