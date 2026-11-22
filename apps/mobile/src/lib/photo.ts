import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';

export class CameraDeniedError extends Error {}

export interface Photo { uri: string; base64: string; mime: 'image/jpeg' }

const MAX_WIDTH = 1600; // keeps uploads ~200–400 KB on weak site connections

/** Opens the camera directly (no gallery: the photo must be taken now) and compresses the result. */
export async function takeWorkPhoto(): Promise<Photo | null> {
  const perm = await ImagePicker.requestCameraPermissionsAsync();
  if (!perm.granted) throw new CameraDeniedError();
  const res = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.8, exif: false });
  if (res.canceled || !res.assets[0]) return null;
  const asset = res.assets[0];

  const ctx = ImageManipulator.manipulate(asset.uri);
  if (asset.width > MAX_WIDTH) ctx.resize({ width: MAX_WIDTH });
  const ref = await ctx.renderAsync();
  const out = await ref.saveAsync({ compress: 0.7, format: SaveFormat.JPEG, base64: true });
  if (!out.base64) throw new Error('compression_failed');
  return { uri: out.uri, base64: out.base64, mime: 'image/jpeg' };
}
