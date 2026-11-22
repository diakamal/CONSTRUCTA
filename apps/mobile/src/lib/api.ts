// Client for the temporary mock API (served by apps/web at /api/*).
// When Supabase is connected these become supabase.rpc('check_in', ...) etc. (see ./supabase.ts);
// screens only use the functions exported here.
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import type { MAttendance, MockStore, PublicProfile, TaskView } from '@constructa/shared';

/** Dev default: same machine that serves the Expo bundle, port 3000 (the web app). */
function defaultBaseUrl() {
  const host = Constants.expoConfig?.hostUri?.split(':')[0];
  if (Platform.OS === 'web') return `http://${typeof location !== 'undefined' ? location.hostname : 'localhost'}:3000`;
  return `http://${host ?? 'localhost'}:3000`;
}
export const API_URL = (process.env.EXPO_PUBLIC_API_URL || defaultBaseUrl()).replace(/\/$/, '');

const SESSION_KEY = 'constructa.session';
let session: PublicProfile | null = null;

export async function loadSession() {
  try {
    const raw = await AsyncStorage.getItem(SESSION_KEY);
    session = raw ? JSON.parse(raw) : null;
  } catch { session = null; }
  return session;
}
export async function saveSession(p: PublicProfile | null) {
  session = p;
  try {
    if (p) await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(p));
    else await AsyncStorage.removeItem(SESSION_KEY);
  } catch {}
}

export class ApiError extends Error {
  constructor(public code: string, public detail: string | null) { super(code); }
}

async function post<T>(path: string, body: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(session ? { Authorization: `Bearer mock-${session.id}` } : {}) },
      body: JSON.stringify(body),
    });
  } catch {
    throw new ApiError('network_error', null);
  }
  const json = await res.json().catch(() => ({ error: { code: 'server_error', detail: null } }));
  if (json.error) throw new ApiError(json.error.code, json.error.detail);
  return json.data as T;
}
const rpc = <T>(method: keyof MockStore, ...args: unknown[]) => post<T>(`/api/rpc/${method}`, { args });

export type MyDay = ReturnType<MockStore['myDay']>;

export const api = {
  requestOtp: (phone: string) => rpc<{ sent: true }>('requestOtp', phone),
  verifyOtp: (phone: string, code: string) => rpc<PublicProfile>('verifyOtp', phone, code),
  me: () => rpc<PublicProfile>('me'),
  setMyLanguage: (lang: string) => rpc('setMyLanguage', lang),
  myDay: () => rpc<MyDay>('myDay'),
  getTask: (id: string) => rpc<TaskView>('getTask', id),
  checkIn: (projectId: string, lat: number, lng: number, accuracy: number | null) =>
    rpc<MAttendance>('checkIn', projectId, lat, lng, accuracy),
  checkOut: (lat: number | null, lng: number | null) => rpc<MAttendance>('checkOut', lat, lng),
  /** Stand-in for a Storage upload; returns the object path to pass to completeTask. */
  uploadPhoto: (taskId: string, base64: string, mime = 'image/jpeg') =>
    post<{ path: string }>('/api/upload', { taskId, base64, mime }),
  completeTask: (taskId: string, photoPath: string) => rpc<TaskView>('completeTask', taskId, photoPath),
};

/** Maps server error codes to translation keys. */
export function errorKey(e: unknown): { key: string; params: Record<string, string> } {
  if (!(e instanceof ApiError)) return { key: 'errorGeneric', params: {} };
  switch (e.code) {
    case 'network_error': return { key: 'serverUnreachable', params: {} };
    case 'not_invited': return { key: 'notInvited', params: {} };
    case 'invalid_code': return { key: 'invalidCode', params: {} };
    case 'outside_geofence': return { key: 'outsideSite', params: { distance: e.detail ?? '?' } };
    case 'already_checked_in': return { key: 'alreadyCheckedIn', params: {} };
    case 'not_project_member':
    case 'project_not_found': return { key: 'noProject', params: {} };
    case 'photo_required':
    case 'photo_not_uploaded': return { key: 'photoRequired', params: {} };
    default: return { key: 'errorGeneric', params: {} };
  }
}
