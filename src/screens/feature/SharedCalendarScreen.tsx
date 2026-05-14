import React, { useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import {
  Alert,
  AppState,
  Linking,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import {
  addDoc,
  collection,
  doc,
  getDocs,
  updateDoc,
} from 'firebase/firestore';

import { firebaseDb } from '../../config/firebase';
import { FIRESTORE_SYNC_FLAGS } from '../../config/firestoreSyncFlags';
import { AmbientBackground } from '../../components/AmbientBackground';
import { FloatingBackButton } from '../../components/FloatingBackButton';
import { GoldButton } from '../../components/GoldButton';
import { ScreenHeading } from '../../components/ScreenHeading';
import { SoftCard } from '../../components/SoftCard';
import { useAuth } from '../../state/AuthContext';
import { usePairing } from '../../state/PairingContext';
import { useTheme } from '../../state/ThemeContext';
import { generateDemoBusy } from './sharedCalendar/calendarUtils';
import {
  CoupleCalendarView,
  type CalendarViewMode,
  type TogetherSlot,
} from './sharedCalendar/CoupleCalendarView';

const STORAGE_KEY = 'couplix:sharedCalendar:v1';
const JOINT_EVENTS_COL = 'shared_calendar_joint_events';

type JointEventStatus = 'pending' | 'accepted' | 'declined' | 'cancelled';

type JointEvent = {
  id: string;
  title: string;
  startMs: number;
  endMs: number;
  createdAtMs: number;
  proposedBy: 'me' | 'partner';
  status: JointEventStatus;
};

type CalStoreV2 = {
  version: 2;
  myCalendarEmail: string;
  partnerCalendarEmail: string;
  partnerInviteSentAt: number | null;
  partnerCalendarConnected: boolean;
  calendarView: CalendarViewMode;
  focusedDateMs: number;
  jointEvents: JointEvent[];
};

type CalendarShareInviteStatus = 'pending' | 'accepted' | 'declined' | 'cancelled';

type CalendarShareInviteRow = {
  id: string;
  fromUid: string;
  fromName: string;
  fromCalendarEmail: string;
  toPartnerUid: string;
  toCalendarEmail: string;
  status: CalendarShareInviteStatus;
  createdAtMs: number;
};

function defaultStore(): CalStoreV2 {
  return {
    version: 2,
    myCalendarEmail: '',
    partnerCalendarEmail: '',
    partnerInviteSentAt: null,
    partnerCalendarConnected: false,
    calendarView: 'month',
    focusedDateMs: Date.now(),
    jointEvents: [],
  };
}

function parseStore(raw: string | null): CalStoreV2 {
  if (!raw) return defaultStore();
  try {
    const j = JSON.parse(raw) as Record<string, unknown>;
    if (j.version === 2) {
      const d = defaultStore();
      return {
        ...d,
        myCalendarEmail: typeof j.myCalendarEmail === 'string' ? j.myCalendarEmail : '',
        partnerCalendarEmail:
          typeof j.partnerCalendarEmail === 'string' ? j.partnerCalendarEmail : '',
        partnerInviteSentAt:
          typeof j.partnerInviteSentAt === 'number' ? j.partnerInviteSentAt : null,
        partnerCalendarConnected: !!j.partnerCalendarConnected,
        calendarView: (['year', 'month', 'week', 'day'] as const).includes(
          j.calendarView as CalendarViewMode
        )
          ? (j.calendarView as CalendarViewMode)
          : 'month',
        focusedDateMs: typeof j.focusedDateMs === 'number' ? j.focusedDateMs : Date.now(),
        jointEvents: Array.isArray(j.jointEvents) ? (j.jointEvents as JointEvent[]) : [],
      };
    }
    const my = typeof j.myCalendarEmail === 'string' ? j.myCalendarEmail : '';
    const partner = typeof j.partnerCalendarEmail === 'string' ? j.partnerCalendarEmail : '';
    const both =
      !!(j as { myAccessGranted?: boolean }).myAccessGranted &&
      !!(j as { partnerAccessGranted?: boolean }).partnerAccessGranted;
    return {
      ...defaultStore(),
      myCalendarEmail: my,
      partnerCalendarEmail: partner,
      partnerCalendarConnected: both && !!partner.trim(),
      partnerInviteSentAt:
        typeof (j as { invitesSentAt?: number }).invitesSentAt === 'number'
          ? (j as { invitesSentAt: number }).invitesSentAt
          : null,
      jointEvents: Array.isArray(j.jointEvents) ? (j.jointEvents as JointEvent[]) : [],
    };
  } catch {
    return defaultStore();
  }
}

function isNonEmptyEmail(s: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim());
}

function formatRange(startMs: number, endMs: number) {
  const a = new Date(startMs);
  const b = new Date(endMs);
  const dateStr = a.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
  const t1 = a.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  const t2 = b.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  return `${dateStr} · ${t1} – ${t2}`;
}

export function SharedCalendarScreen() {
  const navigation = useNavigation();
  const { colors, mode } = useTheme();
  const insets = useSafeAreaInsets();
  const { user, profile } = useAuth();
  const { partnerName, coupleCode, coupleMembershipReady, partnerUid } = usePairing();
  const [store, setStore] = useState<CalStoreV2>(defaultStore);
  const [loaded, setLoaded] = useState(false);
  const [emailModalOpen, setEmailModalOpen] = useState(false);
  const [emailDraft, setEmailDraft] = useState('');
  const [partnerModalOpen, setPartnerModalOpen] = useState(false);
  const [partnerDraft, setPartnerDraft] = useState('');
  const [cloudInvites, setCloudInvites] = useState<CalendarShareInviteRow[]>([]);
  const [inviteListenerError, setInviteListenerError] = useState<string | null>(null);

  const [draftTitle, setDraftTitle] = useState('');
  const [startMs, setStartMs] = useState(() => Date.now() + 3600000);
  const [endMs, setEndMs] = useState(() => Date.now() + 7200000);
  const [pickerTarget, setPickerTarget] = useState<'start' | 'end' | null>(null);
  const [inviteRefreshBusy, setInviteRefreshBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (!alive) return;
        const next = parseStore(raw);
        setStore(next);
        setEmailDraft(next.myCalendarEmail);
        setPartnerDraft(next.partnerCalendarEmail);
      } finally {
        if (alive) setLoaded(true);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!loaded) return;
    const id = setTimeout(() => {
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ ...store, version: 2 })).catch(() => {});
    }, 400);
    return () => clearTimeout(id);
  }, [store, loaded]);

  useEffect(() => {
    if (!loaded) return;
    if (!isNonEmptyEmail(store.myCalendarEmail)) setEmailModalOpen(true);
  }, [loaded, store.myCalendarEmail]);

  const loadCalendarInvites = useCallback(async () => {
    if (!loaded) return;
    if (!FIRESTORE_SYNC_FLAGS.sharedCalendar || !coupleCode || !user || !coupleMembershipReady) {
      setCloudInvites([]);
      setInviteListenerError(null);
      return;
    }
    try {
      const col = collection(firebaseDb, 'couples', coupleCode, 'shared_calendar_invites');
      const snap = await getDocs(col);
      setInviteListenerError(null);
      const rows: CalendarShareInviteRow[] = snap.docs.map((d) => {
        const x = d.data() as Record<string, unknown>;
        const st = String(x.status ?? 'pending');
        const status = (
          ['pending', 'accepted', 'declined', 'cancelled'].includes(st) ? st : 'pending'
        ) as CalendarShareInviteStatus;
        return {
          id: d.id,
          fromUid: String(x.fromUid ?? ''),
          fromName: String(x.fromName ?? ''),
          fromCalendarEmail: String(x.fromCalendarEmail ?? ''),
          toPartnerUid: String(x.toPartnerUid ?? ''),
          toCalendarEmail: String(x.toCalendarEmail ?? ''),
          status,
          createdAtMs: typeof x.createdAtMs === 'number' ? x.createdAtMs : 0,
        };
      });
      rows.sort((a, b) => b.createdAtMs - a.createdAtMs);
      setCloudInvites(rows);
    } catch (err: unknown) {
      const fe = err as { code?: string; message?: string };
      const msg = fe.code ? `${fe.code}: ${fe.message ?? ''}` : String(err);
      if (__DEV__) console.warn('[SharedCalendar] invites fetch', msg);
      // Defer: Firestore can throw internal assertions on the same stack; updating React immediately
      // sometimes surfaces as Render Error on RN.
      setTimeout(() => {
        setInviteListenerError(msg);
        setCloudInvites([]);
      }, 0);
    }
  }, [coupleCode, user, coupleMembershipReady, loaded]);

  const loadJointEvents = useCallback(async () => {
    if (!loaded) return;
    if (!FIRESTORE_SYNC_FLAGS.sharedCalendar || !coupleCode || !user || !coupleMembershipReady) {
      return;
    }
    try {
      const snap = await getDocs(collection(firebaseDb, 'couples', coupleCode, JOINT_EVENTS_COL));
      const list: JointEvent[] = snap.docs.map((d) => {
        const x = d.data() as Record<string, unknown>;
        const st = String(x.status ?? 'pending');
        const status = (
          ['pending', 'accepted', 'declined', 'cancelled'].includes(st) ? st : 'pending'
        ) as JointEventStatus;
        const proposer = String(x.proposedByUid ?? '');
        return {
          id: d.id,
          title: String(x.title ?? ''),
          startMs: typeof x.startMs === 'number' ? x.startMs : 0,
          endMs: typeof x.endMs === 'number' ? x.endMs : 0,
          createdAtMs: typeof x.createdAtMs === 'number' ? x.createdAtMs : 0,
          proposedBy: proposer === user.uid ? 'me' : 'partner',
          status,
        };
      });
      list.sort((a, b) => b.createdAtMs - a.createdAtMs);
      setStore((s) => ({ ...s, jointEvents: list }));
    } catch (e) {
      if (__DEV__) console.warn('[SharedCalendar] joint events fetch', e);
    }
  }, [coupleCode, user, coupleMembershipReady, loaded]);

  const refreshCalendarCloud = useCallback(() => {
    setInviteRefreshBusy(true);
    void Promise.all([loadCalendarInvites(), loadJointEvents()]).finally(() => setInviteRefreshBusy(false));
  }, [loadCalendarInvites, loadJointEvents]);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      const tick = () => {
        if (!cancelled) {
          void loadCalendarInvites();
          void loadJointEvents();
        }
      };
      const first = setTimeout(tick, 400);
      const id = setInterval(tick, 10_000);
      return () => {
        cancelled = true;
        clearTimeout(first);
        clearInterval(id);
      };
    }, [loadCalendarInvites, loadJointEvents])
  );

  useEffect(() => {
    if (!loaded) return;
    if (!FIRESTORE_SYNC_FLAGS.sharedCalendar || !coupleCode || !user || !coupleMembershipReady) return;
    void loadCalendarInvites();
    void loadJointEvents();
  }, [loaded, coupleCode, user, coupleMembershipReady, loadCalendarInvites, loadJointEvents]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        void loadCalendarInvites();
        void loadJointEvents();
      }
    });
    return () => sub.remove();
  }, [loadCalendarInvites, loadJointEvents]);

  const timeStrongColor = useMemo(() => (mode === 'dark' ? '#FAFAFA' : '#0f172a'), [mode]);
  const timeRowFill = useMemo(() => (mode === 'dark' ? 'rgba(255,255,255,0.1)' : '#E8EEF5'), [mode]);
  const pickerChrome = useMemo(() => (mode === 'dark' ? '#1a1620' : '#F1F5F9'), [mode]);

  const incomingInvites = useMemo(() => {
    const uid = user?.uid;
    if (!uid) return [];
    // Show any pending invite not sent by me. Do not require toPartnerUid === uid: that hid invites
    // when partnerUid on the sender device was wrong or stale (still a two-person couple).
    return cloudInvites.filter(
      (i) => i.status === 'pending' && !!i.fromUid && i.fromUid !== uid
    );
  }, [cloudInvites, user?.uid]);

  const outgoingInvites = useMemo(() => {
    const uid = user?.uid;
    if (!uid) return [];
    return cloudInvites.filter((i) => i.fromUid === uid && i.status === 'pending');
  }, [cloudInvites, user?.uid]);

  const openPartnerModal = useCallback(() => {
    setPartnerDraft(store.partnerCalendarEmail);
    setPartnerModalOpen(true);
  }, [store.partnerCalendarEmail]);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <Pressable
          onPress={openPartnerModal}
          hitSlop={12}
          style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1, paddingRight: 14 }]}
        >
          <Text style={styles.headerPartner}>Partner</Text>
        </Pressable>
      ),
    });
  }, [navigation, openPartnerModal]);

  const focusedDate = useMemo(() => new Date(store.focusedDateMs), [store.focusedDateMs]);

  const { my: myBusy, partner: partnerBusy } = useMemo(
    () =>
      generateDemoBusy(
        store.myCalendarEmail || 'local@preview.dev',
        store.partnerCalendarConnected ? store.partnerCalendarEmail || null : null,
        focusedDate
      ),
    [store.myCalendarEmail, store.partnerCalendarEmail, store.partnerCalendarConnected, focusedDate]
  );

  const togetherSlots = useMemo<TogetherSlot[]>(() => {
    return store.jointEvents
      .filter((e) => e.status === 'pending' || e.status === 'accepted')
      .map((e) => ({
        startMs: e.startMs,
        endMs: e.endMs,
        title: e.title?.trim() ? e.title.trim() : 'Time together',
      }));
  }, [store.jointEvents]);

  const saveMyEmail = () => {
    if (!isNonEmptyEmail(emailDraft)) {
      Alert.alert('Email', 'Enter the email for the calendar you want to see (often work or personal).');
      return;
    }
    setStore((s) => ({ ...s, myCalendarEmail: emailDraft.trim() }));
    setEmailModalOpen(false);
  };

  const sendPartnerMailInvite = async () => {
    if (!isNonEmptyEmail(partnerDraft)) {
      Alert.alert('Partner email', 'Enter your partner’s calendar email so we can address the invite.');
      return;
    }
    const me = store.myCalendarEmail.trim();
    const them = partnerDraft.trim();

    if (!FIRESTORE_SYNC_FLAGS.sharedCalendar) {
      Alert.alert('Cloud invites', 'Calendar cloud sync is off for this build.');
      return;
    }
    if (!user) {
      Alert.alert('Sign in', 'Sign in to save an invite in CoupliX.');
      return;
    }
    if (!coupleCode || !coupleMembershipReady) {
      Alert.alert(
        'Pairing required',
        'The in-app invite is saved only after both phones are paired with the same couple code and membership is ready. Finish pairing, wait a few seconds, then open Partner again and send.'
      );
      return;
    }

    try {
      await addDoc(collection(firebaseDb, 'couples', coupleCode, 'shared_calendar_invites'), {
        fromUid: user.uid,
        fromName: profile?.displayName?.trim() || 'You',
        fromCalendarEmail: me,
        toPartnerUid: partnerUid ?? '',
        toCalendarEmail: them,
        status: 'pending',
        createdAtMs: Date.now(),
      });
      void loadCalendarInvites();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (__DEV__) console.warn('[SharedCalendar] add invite', msg);
      Alert.alert(
        'Invite not saved to CoupliX',
        msg.includes('permission') || msg.includes('PERMISSION_DENIED')
          ? 'Deploy the latest firestore.rules (shared_calendar_invites) with firebase deploy --only firestore:rules.'
          : msg
      );
      return;
    }

    const subject = encodeURIComponent('Accept CoupliX shared calendar');
    const body = encodeURIComponent(
      `Hi,\n\n${me} invited you to share calendar availability in CoupliX so you can see mutual free time and plan together.\n\nOpen CoupliX → Mood → Shared Calendar and accept the invite at the top, or reply when you’re ready.\n\n— Sent from CoupliX`
    );
    const url = `mailto:${encodeURIComponent(them)}?subject=${subject}&body=${body}`;
    try {
      const ok = await Linking.canOpenURL(url);
      if (ok) await Linking.openURL(url);
      else Alert.alert('Mail', 'No mail app found. Your partner can still accept the invite in CoupliX under Shared Calendar.');
    } catch {
      Alert.alert('Mail', 'Could not open the mail app.');
    }
    setStore((s) => ({
      ...s,
      partnerCalendarEmail: them,
      partnerInviteSentAt: Date.now(),
    }));
    Alert.alert(
      'Invite sent',
      partnerUid
        ? 'Your partner will see Accept / Decline under Shared Calendar → Invites on their phone. Ask them to open that screen or pull down to refresh.'
        : 'Invite is saved for your couple. Your partner will see it when CoupliX loads their account (Shared Calendar → pull to refresh).'
    );
  };

  const acceptPartnerInvite = async (inv: CalendarShareInviteRow) => {
    if (!coupleCode || !user) return;
    try {
      await updateDoc(doc(firebaseDb, 'couples', coupleCode, 'shared_calendar_invites', inv.id), {
        status: 'accepted',
      });
      void loadCalendarInvites();
      setStore((s) => ({
        ...s,
        partnerCalendarConnected: true,
        partnerCalendarEmail: inv.fromCalendarEmail.trim() || s.partnerCalendarEmail,
      }));
      Alert.alert(
        'Accepted',
        'You are now linked for shared busy times in CoupliX. Full calendar OAuth sync comes in a later update.'
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      Alert.alert('Could not accept', msg);
    }
  };

  const declinePartnerInvite = async (inv: CalendarShareInviteRow) => {
    if (!coupleCode) return;
    try {
      await updateDoc(doc(firebaseDb, 'couples', coupleCode, 'shared_calendar_invites', inv.id), {
        status: 'declined',
      });
      void loadCalendarInvites();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      Alert.alert('Could not decline', msg);
    }
  };

  const cancelOutgoingInvite = async (inv: CalendarShareInviteRow) => {
    if (!coupleCode) return;
    try {
      await updateDoc(doc(firebaseDb, 'couples', coupleCode, 'shared_calendar_invites', inv.id), {
        status: 'cancelled',
      });
      void loadCalendarInvites();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      Alert.alert('Could not cancel', msg);
    }
  };

  const onPickerChange = (event: { type?: string }, date?: Date) => {
    if (Platform.OS === 'android') {
      setPickerTarget(null);
      if (event.type !== 'set' || !date) return;
    }
    if (!date) return;
    if (pickerTarget === 'start') {
      setStartMs(date.getTime());
      setEndMs((e) => (e <= date.getTime() ? date.getTime() + 3600000 : e));
    } else if (pickerTarget === 'end') {
      setEndMs(date.getTime());
    }
  };

  const proposeJointEvent = async () => {
    const title = draftTitle.trim();
    if (!title) {
      Alert.alert('Title', 'Name this time together.');
      return;
    }
    if (endMs <= startMs) {
      Alert.alert('Time', 'End must be after start.');
      return;
    }
    if (FIRESTORE_SYNC_FLAGS.sharedCalendar && coupleCode && coupleMembershipReady && user) {
      try {
        await addDoc(collection(firebaseDb, 'couples', coupleCode, JOINT_EVENTS_COL), {
          title,
          startMs,
          endMs,
          proposedByUid: user.uid,
          proposedByName: profile?.displayName?.trim() || 'Partner',
          status: 'pending',
          createdAtMs: Date.now(),
        });
        await loadJointEvents();
        setDraftTitle('');
        Alert.alert(
          'Invite sent',
          `${partnerName || 'Your partner'} can open Mood → Shared Calendar, pull down to refresh, and accept under Invites.`
        );
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        Alert.alert(
          'Could not send invite',
          msg.includes('permission') || msg.includes('PERMISSION_DENIED')
            ? 'Deploy the latest firestore.rules (shared_calendar_joint_events) for this project.'
            : msg
        );
      }
      return;
    }
    const ev: JointEvent = {
      id: `je_${Date.now()}`,
      title,
      startMs,
      endMs,
      createdAtMs: Date.now(),
      proposedBy: 'me',
      status: 'pending',
    };
    setStore((s) => ({ ...s, jointEvents: [ev, ...s.jointEvents] }));
    setDraftTitle('');
    Alert.alert(
      'Saved on this phone only',
      'Finish pairing to sync “Block time together” invites to your partner in CoupliX.'
    );
  };

  const patchJointLocal = (id: string, patch: Partial<JointEvent>) => {
    setStore((s) => ({
      ...s,
      jointEvents: s.jointEvents.map((e) => (e.id === id ? { ...e, ...patch } : e)),
    }));
  };

  const applyJointStatus = async (id: string, next: JointEventStatus) => {
    if (FIRESTORE_SYNC_FLAGS.sharedCalendar && coupleCode && coupleMembershipReady && user) {
      try {
        await updateDoc(doc(firebaseDb, 'couples', coupleCode, JOINT_EVENTS_COL, id), { status: next });
        await loadJointEvents();
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        Alert.alert('Could not update invite', msg);
      }
      return;
    }
    patchJointLocal(id, { status: next });
  };

  const inputStyle = [
    styles.input,
    { borderColor: colors.border, backgroundColor: colors.surface, color: colors.text },
  ];

  if (!loaded) {
    return (
      <>
        <AmbientBackground />
        <View style={styles.loading} />
        <FloatingBackButton />
      </>
    );
  }

  return (
    <>
      <AmbientBackground />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.container,
          { paddingBottom: Math.max(insets.bottom, 24) + 88, flexGrow: 1 },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        alwaysBounceVertical
        bounces
        overScrollMode={Platform.OS === 'android' ? 'always' : undefined}
        refreshControl={
          <RefreshControl
            refreshing={inviteRefreshBusy}
            onRefresh={refreshCalendarCloud}
            tintColor="#EC4899"
            colors={['#EC4899', '#BE185D']}
            progressBackgroundColor="#FFFFFF"
            title="Refreshing…"
            titleColor={colors.muted}
          />
        }
      >
        <ScreenHeading
          title="Shared Calendar"
          subtitle="Your calendar first — add your partner when you’re ready."
        />

        <SoftCard>
          <View style={styles.emailRow}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.labelSm, { color: colors.muted }]}>Your calendar email</Text>
              <Text style={[styles.emailValue, { color: colors.text }]} numberOfLines={1}>
                {store.myCalendarEmail || 'Not set'}
              </Text>
            </View>
            <Pressable
              onPress={() => {
                setEmailDraft(store.myCalendarEmail);
                setEmailModalOpen(true);
              }}
              style={[styles.editChip, { borderColor: colors.border }]}
            >
              <Text style={[styles.editChipText, { color: '#EC4899' }]}>Update</Text>
            </Pressable>
          </View>
          <Text style={[styles.syncHint, { color: colors.muted }]}>
            {store.partnerCalendarConnected
              ? `Synced with ${store.partnerCalendarEmail.trim()} — external events show as Busy only.`
              : 'Partner calendar not linked yet — tap Partner (top right) to send an email invite.'}
          </Text>
        </SoftCard>

        {FIRESTORE_SYNC_FLAGS.sharedCalendar && coupleCode && coupleMembershipReady ? (
          <SoftCard>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Invites in CoupliX</Text>
            <Text style={[styles.sectionHint, { color: colors.muted }]}>
              Invites you send show here as "Waiting on …" with Cancel only.{'\n'}
              <Text style={{ fontWeight: '700', color: colors.text }}>Accept and Decline</Text> show on{' '}
              {partnerName ? `${partnerName}'s` : "your partner's"} phone on this same screen — not on the
              sender's. If they see "permission denied", the latest{' '}
              <Text style={{ fontWeight: '700' }}>firestore.rules</Text> must be deployed to Firebase.
            </Text>
            {inviteListenerError ? (
              <Text style={[styles.inviteError, { color: colors.danger }]}>
                Could not load invites: {inviteListenerError}
                {'\n'}
                If you see permission denied, deploy the latest firestore.rules for this project.
              </Text>
            ) : null}
            {incomingInvites.length === 0 && outgoingInvites.length === 0 && !inviteListenerError ? (
              <Text style={[styles.emptyInvites, { color: colors.muted }]}>
                No pending invites. Tap Partner (top right) to send one.
              </Text>
            ) : null}
            {incomingInvites.map((inv) => (
              <View key={inv.id} style={[styles.inviteCard, { borderColor: colors.border }]}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.inviteTitle, { color: colors.text }]}>Share calendar</Text>
                  <Text style={[styles.inviteMeta, { color: colors.muted }]}>
                    From {inv.fromName || 'Partner'} · {inv.fromCalendarEmail}
                  </Text>
                  <Text style={[styles.inviteMeta, { color: colors.muted }]}>
                    For your mailbox: {inv.toCalendarEmail}
                  </Text>
                </View>
                <View style={styles.inviteActions}>
                  <Pressable
                    onPress={() => void acceptPartnerInvite(inv)}
                    style={[styles.invitePrimary, { backgroundColor: colors.gold }]}
                  >
                    <Text style={styles.invitePrimaryText}>Accept</Text>
                  </Pressable>
                  <Pressable onPress={() => void declinePartnerInvite(inv)}>
                    <Text style={{ color: colors.muted, fontWeight: '800', fontSize: 13 }}>Decline</Text>
                  </Pressable>
                </View>
              </View>
            ))}
            {outgoingInvites.map((inv) => (
              <View key={inv.id} style={[styles.inviteCard, { borderColor: colors.border }]}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.inviteTitle, { color: colors.text }]}>Waiting on {partnerName || 'partner'}</Text>
                  <Text style={[styles.inviteMeta, { color: colors.muted }]}>
                    Sent to {inv.toCalendarEmail}
                  </Text>
                </View>
                <Pressable onPress={() => void cancelOutgoingInvite(inv)}>
                  <Text style={{ color: '#EC4899', fontWeight: '900', fontSize: 13 }}>Cancel</Text>
                </Pressable>
              </View>
            ))}
          </SoftCard>
        ) : FIRESTORE_SYNC_FLAGS.sharedCalendar ? (
          <SoftCard>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Invites in CoupliX</Text>
            <Text style={[styles.sectionHint, { color: colors.muted }]}>
              Finish pairing (same couple code on both phones) to see calendar invites here.
            </Text>
          </SoftCard>
        ) : null}

        <SoftCard>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Privacy</Text>
          <Text style={[styles.sectionHint, { color: colors.muted }]}>
            CoupliX does not read the titles of your real calendar events yet. Busy shading on the
            calendar below is a <Text style={{ fontWeight: '900', color: colors.text }}>preview</Text>{' '}
            only (not your Google / Outlook / Apple meetings). Linking your provider for real busy
            times needs a future update. Events you create together in CoupliX can sync after acceptance.
          </Text>
        </SoftCard>

        <Text style={[styles.busyDisclaimer, { color: colors.muted }]}>
          Calendar grid: busy blocks are sample data from CoupliX, not live meetings from the emails
          above.
        </Text>

        <CoupleCalendarView
          colors={colors}
          view={store.calendarView}
          onViewChange={(calendarView) => setStore((s) => ({ ...s, calendarView }))}
          focusedDate={focusedDate}
          onFocusedDateChange={(d) => setStore((s) => ({ ...s, focusedDateMs: d.getTime() }))}
          myBusy={myBusy}
          partnerBusy={partnerBusy}
          partnerEnabled={store.partnerCalendarConnected}
          togetherSlots={togetherSlots}
        />

        <SoftCard>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Block time together</Text>
          <Text style={[styles.sectionHint, { color: colors.muted }]}>
            Propose a time here. When you are paired, the invite is saved for both phones — your
            partner sees it under Invites below and can accept or decline. (Writing to Google /
            Outlook calendars is not connected yet.)
          </Text>
          <TextInput
            value={draftTitle}
            onChangeText={setDraftTitle}
            placeholder="Title"
            placeholderTextColor={colors.muted}
            style={inputStyle}
          />
          <Pressable
            onPress={() => setPickerTarget('start')}
            style={[
              styles.timeRow,
              { borderColor: colors.border, backgroundColor: timeRowFill },
            ]}
          >
            <Text style={[styles.timeLabel, { color: colors.muted }]}>Starts</Text>
            <Text style={[styles.timeValue, { color: timeStrongColor }]}>
              {new Date(startMs).toLocaleString([], {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
                hour: 'numeric',
                minute: '2-digit',
              })}
            </Text>
            <Ionicons name="chevron-forward" size={18} color={timeStrongColor} />
          </Pressable>
          <Pressable
            onPress={() => setPickerTarget('end')}
            style={[
              styles.timeRow,
              { borderColor: colors.border, backgroundColor: timeRowFill, marginTop: 8 },
            ]}
          >
            <Text style={[styles.timeLabel, { color: colors.muted }]}>Ends</Text>
            <Text style={[styles.timeValue, { color: timeStrongColor }]}>
              {new Date(endMs).toLocaleString([], {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
                hour: 'numeric',
                minute: '2-digit',
              })}
            </Text>
            <Ionicons name="chevron-forward" size={18} color={timeStrongColor} />
          </Pressable>
          {pickerTarget ? (
            <View
              style={{
                marginTop: 10,
                backgroundColor: pickerChrome,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: colors.border,
                paddingVertical: 6,
                overflow: 'hidden',
              }}
            >
              <DateTimePicker
                value={new Date(pickerTarget === 'start' ? startMs : endMs)}
                mode="datetime"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={onPickerChange}
                themeVariant={mode === 'dark' ? 'dark' : 'light'}
                textColor={timeStrongColor}
              />
            </View>
          ) : null}
          {Platform.OS === 'ios' && pickerTarget ? (
            <GoldButton title="Done" onPress={() => setPickerTarget(null)} style={{ marginTop: 8 }} />
          ) : null}
          <GoldButton
            title="Send invite to partner"
            onPress={() => void proposeJointEvent()}
            style={{ marginTop: 12, width: '100%' }}
          />
        </SoftCard>

        {store.jointEvents.length ? (
          <SoftCard>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Time together</Text>
            <Text style={[styles.sectionHint, { color: colors.muted, marginBottom: 6 }]}>
              Time together proposals. Pull down on this screen to refresh.
            </Text>
            {store.jointEvents.map((ev) => (
              <View key={ev.id} style={[styles.eventRow, { borderColor: colors.border }]}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.eventTitle, { color: colors.text }]}>{ev.title}</Text>
                  <Text style={[styles.eventMeta, { color: colors.muted }]}>{formatRange(ev.startMs, ev.endMs)}</Text>
                  <Text style={[styles.eventMeta, { color: colors.muted }]}>
                    {ev.status === 'pending'
                      ? ev.proposedBy === 'me'
                        ? 'Waiting for partner'
                        : 'From partner'
                      : ev.status === 'accepted'
                        ? 'Accepted'
                        : ev.status === 'declined'
                          ? 'Declined'
                          : 'Cancelled'}
                  </Text>
                </View>
                {ev.status === 'pending' && ev.proposedBy === 'partner' ? (
                  <View style={{ gap: 6, alignItems: 'flex-end' }}>
                    <Pressable
                      onPress={() => void applyJointStatus(ev.id, 'accepted')}
                      style={[styles.miniBtn, { backgroundColor: colors.gold }]}
                    >
                      <Text style={styles.miniBtnText}>Accept</Text>
                    </Pressable>
                    <Pressable onPress={() => void applyJointStatus(ev.id, 'declined')}>
                      <Text style={{ color: colors.muted, fontWeight: '800', fontSize: 12 }}>Decline</Text>
                    </Pressable>
                  </View>
                ) : null}
                {ev.status === 'pending' && ev.proposedBy === 'me' ? (
                  <Pressable onPress={() => void applyJointStatus(ev.id, 'cancelled')}>
                    <Text style={{ color: '#EC4899', fontWeight: '900', fontSize: 13 }}>Cancel</Text>
                  </Pressable>
                ) : null}
              </View>
            ))}
          </SoftCard>
        ) : null}
      </ScrollView>

      <Modal
        visible={emailModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (isNonEmptyEmail(store.myCalendarEmail)) setEmailModalOpen(false);
        }}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Your calendar email</Text>
            <Text style={[styles.modalBody, { color: colors.muted }]}>
              Enter the email tied to the calendar you want to see here (Google, Outlook, or Apple).
              You can update it anytime.
            </Text>
            <TextInput
              value={emailDraft}
              onChangeText={setEmailDraft}
              placeholder="you@email.com"
              placeholderTextColor={colors.muted}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              style={[...inputStyle, { marginTop: 12 }]}
            />
            <GoldButton title="Show my calendar" onPress={saveMyEmail} style={{ marginTop: 16, width: '100%' }} />
            {isNonEmptyEmail(store.myCalendarEmail) ? (
              <Pressable onPress={() => setEmailModalOpen(false)} style={{ marginTop: 12 }}>
                <Text style={{ color: colors.muted, fontWeight: '800', textAlign: 'center' }}>Cancel</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      </Modal>

      <Modal
        visible={partnerModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setPartnerModalOpen(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setPartnerModalOpen(false)}>
          <Pressable
            style={[styles.modalCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={(e) => e.stopPropagation()}
          >
            <Text style={[styles.modalTitle, { color: colors.text }]}>Partner’s calendar</Text>
            <Text style={[styles.modalBody, { color: colors.muted }]}>
              Add their calendar email. We save an invite to CoupliX (both phones) and open email if you
              want a mail copy. When they accept here, busy times sync in this screen.
            </Text>
            <TextInput
              value={partnerDraft}
              onChangeText={setPartnerDraft}
              placeholder="partner@email.com"
              placeholderTextColor={colors.muted}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              style={[...inputStyle, { marginTop: 12 }]}
            />
            <GoldButton
              title="Send mail invite"
              onPress={sendPartnerMailInvite}
              style={{ marginTop: 14, width: '100%' }}
            />
            <Pressable
              onPress={() =>
                setStore((s) => ({
                  ...s,
                  partnerCalendarConnected: !s.partnerCalendarConnected,
                  partnerCalendarEmail: partnerDraft.trim() || s.partnerCalendarEmail,
                }))
              }
              style={{ marginTop: 12, alignItems: 'center' }}
            >
              <Text style={{ color: '#EC4899', fontWeight: '900', fontSize: 14 }}>
                {store.partnerCalendarConnected ? 'Unlink partner preview' : 'Partner linked (preview)'}
              </Text>
            </Pressable>
            <Pressable onPress={() => setPartnerModalOpen(false)} style={{ marginTop: 14 }}>
              <Text style={{ color: colors.muted, fontWeight: '800', textAlign: 'center' }}>Close</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      <FloatingBackButton />
    </>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  loading: { flex: 1 },
  container: { paddingHorizontal: 20, paddingTop: 12, gap: 14 },
  busyDisclaimer: { fontSize: 12, fontWeight: '700', lineHeight: 17, paddingHorizontal: 4, marginTop: -6 },
  headerPartner: { fontSize: 16, fontWeight: '900', color: '#EC4899' },
  emailRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  labelSm: { fontSize: 12, fontWeight: '800', marginBottom: 4 },
  emailValue: { fontSize: 16, fontWeight: '900' },
  editChip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  editChipText: { fontSize: 14, fontWeight: '900' },
  syncHint: { fontSize: 12, fontWeight: '700', lineHeight: 17, marginTop: 10 },
  sectionTitle: { fontSize: 15, fontWeight: '900', marginBottom: 4 },
  sectionHint: { fontSize: 12, fontWeight: '700', lineHeight: 17 },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    fontSize: 15,
    fontWeight: '600',
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
    marginTop: 10,
  },
  timeLabel: { width: 48, fontSize: 13, fontWeight: '800' },
  timeValue: { flex: 1, fontSize: 15, fontWeight: '800' },
  eventRow: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginTop: 10,
    flexDirection: 'row',
    gap: 10,
  },
  eventTitle: { fontSize: 16, fontWeight: '900' },
  eventMeta: { fontSize: 12, fontWeight: '700', marginTop: 4 },
  miniBtn: { borderRadius: 10, paddingVertical: 8, paddingHorizontal: 10, alignItems: 'center' },
  miniBtnText: { fontSize: 12, fontWeight: '900', color: '#17131A' },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 22,
  },
  modalCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 18,
  },
  modalTitle: { fontSize: 18, fontWeight: '900', textAlign: 'center' },
  modalBody: { fontSize: 13, fontWeight: '700', lineHeight: 19, marginTop: 10, textAlign: 'center' },
  emptyInvites: { fontSize: 13, fontWeight: '700', textAlign: 'center', marginTop: 8 },
  inviteError: { fontSize: 12, fontWeight: '700', lineHeight: 18, marginTop: 10 },
  inviteCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  inviteTitle: { fontSize: 16, fontWeight: '900' },
  inviteMeta: { fontSize: 12, fontWeight: '700', marginTop: 4, lineHeight: 17 },
  inviteActions: { gap: 8, alignItems: 'flex-end' },
  invitePrimary: { borderRadius: 10, paddingVertical: 8, paddingHorizontal: 14 },
  invitePrimaryText: { fontSize: 13, fontWeight: '900', color: '#17131A' },
});
