import * as ImagePicker from 'expo-image-picker';

/** Raw capture — no crop UI, full quality. */
export async function pickRawPhoto(source: 'camera' | 'library') {
  if (source === 'camera') {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) return { ok: false as const, reason: 'camera' };
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      quality: 1,
    });
    if (result.canceled || !result.assets[0]) return { ok: false as const, reason: 'cancel' };
    return { ok: true as const, uri: result.assets[0].uri };
  }
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) return { ok: false as const, reason: 'library' };
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    allowsEditing: false,
    quality: 1,
  });
  if (result.canceled || !result.assets[0]) return { ok: false as const, reason: 'cancel' };
  return { ok: true as const, uri: result.assets[0].uri };
}
