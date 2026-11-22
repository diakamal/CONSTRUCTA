// Location is read ONLY at the moment of check-in / check-out. There is no background tracking.
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';

const DEMO_KEY = 'constructa.demoLocation';

export async function getDemoLocation() {
  try { return (await AsyncStorage.getItem(DEMO_KEY)) === '1'; } catch { return false; }
}
export async function setDemoLocation(on: boolean) {
  try { await AsyncStorage.setItem(DEMO_KEY, on ? '1' : '0'); } catch {}
}

export class LocationDeniedError extends Error {}

export interface Fix { lat: number; lng: number; accuracy: number | null }

/**
 * One-off position fix. In demo mode returns the site center, so the flow can be shown
 * from anywhere (the server still runs the real radius check).
 */
export async function currentFix(siteCenter?: { lat: number; lng: number }): Promise<Fix> {
  if (siteCenter && (await getDemoLocation())) return { lat: siteCenter.lat + 0.0002, lng: siteCenter.lng, accuracy: 10 };
  const perm = await Location.requestForegroundPermissionsAsync();
  if (perm.status !== 'granted') throw new LocationDeniedError();
  const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
  return { lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy ?? null };
}
