import React from 'react';
import { Image, ImageLoadEventData, NativeSyntheticEvent, StyleSheet, View } from 'react-native';

/** Ten common “story”-style looks using soft overlays (works in Expo Go; no custom native matrix views). */
export type SnapFilterId =
  | 'original'
  | 'warm'
  | 'cool'
  | 'mono'
  | 'sepia'
  | 'vintage'
  | 'vivid'
  | 'soft'
  | 'dramatic'
  | 'polaroid';

export type SnapFilterDef = {
  id: SnapFilterId;
  label: string;
  /** Live camera tint (subtle — was too strong before). */
  previewOverlay: string;
  /** Baked export: multiply-style tint on top of the JPEG. */
  exportTint: { color: string; opacity: number } | null;
  swatchColor: string;
};

export const SNAP_FILTERS: SnapFilterDef[] = [
  { id: 'original', label: 'Original', previewOverlay: 'transparent', exportTint: null, swatchColor: '#2a2a32' },
  {
    id: 'warm',
    label: 'Warm',
    previewOverlay: 'rgba(255, 190, 130, 0.07)',
    exportTint: { color: '#ffc090', opacity: 0.1 },
    swatchColor: '#e8a878',
  },
  {
    id: 'cool',
    label: 'Cool',
    previewOverlay: 'rgba(140, 210, 255, 0.07)',
    exportTint: { color: '#9fd0ff', opacity: 0.09 },
    swatchColor: '#7eb8e8',
  },
  {
    id: 'mono',
    label: 'Mono',
    previewOverlay: 'rgba(60, 60, 65, 0.12)',
    exportTint: { color: '#6e6e78', opacity: 0.14 },
    swatchColor: '#8a8a90',
  },
  {
    id: 'sepia',
    label: 'Sepia',
    previewOverlay: 'rgba(230, 200, 150, 0.09)',
    exportTint: { color: '#d4b896', opacity: 0.11 },
    swatchColor: '#c9a574',
  },
  {
    id: 'vintage',
    label: 'Vintage',
    previewOverlay: 'rgba(255, 200, 150, 0.08)',
    exportTint: { color: '#e8c49a', opacity: 0.1 },
    swatchColor: '#d4a574',
  },
  {
    id: 'vivid',
    label: 'Vivid',
    previewOverlay: 'rgba(255, 100, 140, 0.04)',
    exportTint: { color: '#ff7090', opacity: 0.07 },
    swatchColor: '#e84868',
  },
  {
    id: 'soft',
    label: 'Soft',
    previewOverlay: 'rgba(255, 250, 245, 0.07)',
    exportTint: { color: '#fff8f2', opacity: 0.08 },
    swatchColor: '#f0e6dc',
  },
  {
    id: 'dramatic',
    label: 'Drama',
    previewOverlay: 'rgba(0, 0, 0, 0.1)',
    exportTint: { color: '#000000', opacity: 0.12 },
    swatchColor: '#3d3d44',
  },
  {
    id: 'polaroid',
    label: 'Instant',
    previewOverlay: 'rgba(255, 255, 250, 0.06)',
    exportTint: { color: '#f5f5f0', opacity: 0.09 },
    swatchColor: '#e8e4dc',
  },
];

export function getSnapFilter(filterId: SnapFilterId): SnapFilterDef | undefined {
  return SNAP_FILTERS.find((f) => f.id === filterId);
}

type CompositeProps = {
  uri: string;
  width: number;
  height: number;
  filterId: SnapFilterId;
  onLoad?: (e: NativeSyntheticEvent<ImageLoadEventData>) => void;
};

/** Photo + soft tint for ViewShot export (no native CMIF / matrix modules). */
export function SnapFilterPhotoComposite({ uri, width, height, filterId, onLoad }: CompositeProps) {
  const def = getSnapFilter(filterId);
  const tint = def?.exportTint ?? null;

  return (
    <View style={{ width, height }} collapsable={false}>
      <Image
        source={{ uri }}
        style={{ width, height }}
        resizeMode="cover"
        onLoad={onLoad}
      />
      {tint ? (
        <View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFillObject,
            { backgroundColor: tint.color, opacity: tint.opacity },
          ]}
        />
      ) : null}
    </View>
  );
}
