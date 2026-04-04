import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import * as Haptics from 'expo-haptics';
import ViewShot from 'react-native-view-shot';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { useTheme } from '../state/ThemeContext';
import { SNAP_FILTERS, SnapFilterId, SnapFilterPhotoComposite } from '../utils/snapFilterDefinitions';

const { height: SCREEN_H } = Dimensions.get('window');

async function resizeToMaxEdge(uri: string, width: number, height: number, maxEdge: number) {
  const scale = Math.min(1, maxEdge / Math.max(width, height));
  if (scale >= 1) {
    return { uri, width, height };
  }
  const w = Math.round(width * scale);
  const h = Math.round(height * scale);
  const out = await manipulateAsync(uri, [{ resize: { width: w, height: h } }], {
    compress: 0.92,
    format: SaveFormat.JPEG,
  });
  return { uri: out.uri, width: out.width, height: out.height };
}

type PendingExport = {
  uri: string;
  width: number;
  height: number;
  filterId: Exclude<SnapFilterId, 'original'>;
};

function FilterExportPipeline({
  pending,
  onDone,
}: {
  pending: PendingExport | null;
  onDone: (uri: string) => void;
}) {
  const shotRef = useRef<ViewShot | null>(null);
  const doneRef = useRef(false);
  const loadOnceRef = useRef(false);

  useEffect(() => {
    doneRef.current = false;
    loadOnceRef.current = false;
  }, [pending?.uri, pending?.filterId]);

  const finish = useCallback(
    (uri: string) => {
      if (doneRef.current) return;
      doneRef.current = true;
      onDone(uri);
    },
    [onDone]
  );

  const onImageLoad = useCallback(() => {
    if (loadOnceRef.current) return;
    loadOnceRef.current = true;
    requestAnimationFrame(() => {
      setTimeout(() => {
        const ref = shotRef.current;
        if (!ref?.capture) {
          finish(pending?.uri ?? '');
          return;
        }
        ref
          .capture()
          .then((uri) => finish(uri))
          .catch(() => finish(pending?.uri ?? ''));
      }, 120);
    });
  }, [finish, pending?.uri]);

  if (!pending) return null;

  return (
    <View style={styles.hiddenExport} collapsable={false} pointerEvents="none">
      <ViewShot
        ref={shotRef as React.RefObject<ViewShot>}
        style={{ width: pending.width, height: pending.height }}
        options={{ format: 'jpg', quality: 0.92, result: 'tmpfile' }}
      >
        <SnapFilterPhotoComposite
          uri={pending.uri}
          width={pending.width}
          height={pending.height}
          filterId={pending.filterId}
          onLoad={onImageLoad}
        />
      </ViewShot>
    </View>
  );
}

type Props = {
  visible: boolean;
  onClose: () => void;
  /** Local file URI (JPEG), filter baked in when not Original. */
  onPhotoTaken: (uri: string) => void;
};

export function FilteredCameraModal({ visible, onClose, onPhotoTaken }: Props) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const cameraRef = useRef<CameraView | null>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [ready, setReady] = useState(false);
  const [facing, setFacing] = useState<'back' | 'front'>('back');
  const [filterId, setFilterId] = useState<SnapFilterId>('original');
  const [busy, setBusy] = useState(false);
  const [pendingExport, setPendingExport] = useState<PendingExport | null>(null);

  useEffect(() => {
    if (visible && permission && !permission.granted) {
      requestPermission();
    }
  }, [visible, permission, requestPermission]);

  const dismiss = useCallback(() => {
    setPendingExport(null);
    setBusy(false);
    onClose();
  }, [onClose]);

  useEffect(() => {
    if (!visible) {
      setReady(false);
      setFilterId('original');
      setPendingExport(null);
      setBusy(false);
    }
  }, [visible]);

  const previewTint = SNAP_FILTERS.find((f) => f.id === filterId)?.previewOverlay ?? 'transparent';

  const onExportDone = useCallback(
    (uri: string) => {
      setPendingExport(null);
      setBusy(false);
      onPhotoTaken(uri);
      onClose();
    },
    [onClose, onPhotoTaken]
  );

  const takePhoto = async () => {
    if (!cameraRef.current || !ready || busy || pendingExport) return;
    setBusy(true);
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.95 });
      if (!photo?.uri) {
        setBusy(false);
        return;
      }

      const resized = await resizeToMaxEdge(photo.uri, photo.width, photo.height, 1600);
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});

      if (filterId === 'original') {
        onPhotoTaken(resized.uri);
        dismiss();
        return;
      }

      setPendingExport({
        uri: resized.uri,
        width: resized.width,
        height: resized.height,
        filterId,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      Alert.alert('Camera', msg);
      setBusy(false);
    }
  };

  const grantHint =
    permission && !permission.granted ? (
      <Text style={[styles.hint, { color: colors.muted }]}>Camera access is required for filters.</Text>
    ) : null;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={dismiss} statusBarTranslucent>
      <View style={[styles.root, { backgroundColor: colors.background }]}>
        <FilterExportPipeline pending={pendingExport} onDone={onExportDone} />

        <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
          <Pressable
            onPress={dismiss}
            style={({ pressed }) => [styles.iconBtn, { opacity: pressed ? 0.7 : 1 }]}
            hitSlop={12}
          >
            <Ionicons name="close" size={28} color={colors.text} />
          </Pressable>
          <Text style={[styles.title, { color: colors.text }]}>Daily Snap</Text>
          <Pressable
            onPress={() => {
              setFacing((f) => (f === 'back' ? 'front' : 'back'));
              Haptics.selectionAsync().catch(() => {});
            }}
            style={({ pressed }) => [styles.iconBtn, { opacity: pressed ? 0.7 : 1 }]}
            hitSlop={12}
          >
            <Ionicons name="camera-reverse-outline" size={26} color={colors.text} />
          </Pressable>
        </View>

        {permission?.granted ? (
          <View style={styles.cameraWrap}>
            <CameraView
              ref={cameraRef}
              style={styles.camera}
              facing={facing}
              mode="picture"
              onCameraReady={() => setReady(true)}
            />
            <View
              style={[StyleSheet.absoluteFill, { backgroundColor: previewTint }]}
              pointerEvents="none"
            />
          </View>
        ) : (
          <View style={[styles.cameraWrap, styles.placeholderCam]}>
            {grantHint}
            <Pressable
              onPress={() => requestPermission()}
              style={[styles.permBtn, { borderColor: colors.gold }]}
            >
              <Text style={{ color: colors.gold, fontWeight: '800' }}>Allow camera</Text>
            </Pressable>
          </View>
        )}

        <View style={[styles.filtersSection, { paddingBottom: Math.max(insets.bottom, 12) + 8 }]}>
          <Text style={[styles.filtersLabel, { color: colors.muted }]}>Swipe filters</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterRow}
          >
            {SNAP_FILTERS.map((f) => {
              const selected = f.id === filterId;
              return (
                <Pressable
                  key={f.id}
                  onPress={() => {
                    setFilterId(f.id);
                    Haptics.selectionAsync().catch(() => {});
                  }}
                  style={[
                    styles.filterChip,
                    {
                      borderColor: selected ? colors.gold : colors.border,
                      backgroundColor: selected ? 'rgba(231,199,125,0.12)' : 'transparent',
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.filterSwatch,
                      {
                        backgroundColor: f.swatchColor,
                        borderColor: colors.border,
                      },
                    ]}
                  />
                  <Text style={[styles.filterName, { color: colors.text }]} numberOfLines={1}>
                    {f.label}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          <Pressable
            onPress={takePhoto}
            disabled={!permission?.granted || !ready || busy || !!pendingExport}
            style={({ pressed }) => [
              styles.shutter,
              {
                borderColor: colors.gold,
                opacity: pressed || busy || !ready || !!pendingExport ? 0.65 : 1,
              },
            ]}
          >
            {busy || pendingExport ? (
              <ActivityIndicator color={colors.gold} />
            ) : (
              <View style={[styles.shutterInner, { backgroundColor: colors.gold }]} />
            )}
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const CAM_HEIGHT = Math.min(SCREEN_H * 0.56, 520);

const styles = StyleSheet.create({
  root: { flex: 1 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingBottom: 8,
  },
  title: { fontSize: 16, fontWeight: '900' },
  iconBtn: { padding: 6, width: 44, alignItems: 'center' },
  cameraWrap: {
    width: '100%',
    height: CAM_HEIGHT,
    alignSelf: 'center',
    overflow: 'hidden',
    borderRadius: 14,
    marginHorizontal: 12,
  },
  camera: { flex: 1 },
  placeholderCam: {
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: 'rgba(255,255,255,0.2)',
  },
  hint: { fontSize: 13, fontWeight: '600', textAlign: 'center', paddingHorizontal: 24 },
  permBtn: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  filtersSection: { flex: 1, paddingTop: 12 },
  filtersLabel: {
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginLeft: 20,
    marginBottom: 8,
  },
  filterRow: { paddingHorizontal: 14, gap: 8, alignItems: 'center' },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    marginRight: 4,
    maxWidth: 200,
  },
  filterSwatch: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
  },
  filterName: { fontSize: 12, fontWeight: '800', maxWidth: 88 },
  shutter: {
    alignSelf: 'center',
    marginTop: 16,
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterInner: {
    width: 54,
    height: 54,
    borderRadius: 27,
  },
  hiddenExport: {
    position: 'absolute',
    left: -10000,
    top: 0,
    opacity: 0.02,
  },
});
