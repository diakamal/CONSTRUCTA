'use client';
// Browser-side client for the mock API. When Supabase is connected, these calls map 1:1 to
// supabase.rpc(...) / table queries; screens only depend on this module.
import type { MockStore, PublicProfile } from '@constructa/shared';

const SESSION_KEY = 'constructa.web.session';

export function getSession(): PublicProfile | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as PublicProfile) : null;
  } catch {
    return null;
  }
}
export function setSession(p: PublicProfile | null) {
  try {
    if (p) localStorage.setItem(SESSION_KEY, JSON.stringify(p));
    else localStorage.removeItem(SESSION_KEY);
  } catch {}
}

export class ApiError extends Error {
  constructor(public code: string, public detail: string | null) { super(code); }
}

type Store = MockStore;
type Fn<K extends keyof Store> = Store[K] extends (...a: infer A) => infer R ? { args: A; ret: R } : never;
type DropUser<A> = A extends [unknown, ...infer Rest] ? Rest : never;

async function call(method: string, args: unknown[]) {
  const session = getSession();
  let res: Response;
  try {
    res = await fetch(`/api/rpc/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(session ? { Authorization: `Bearer mock-${session.id}` } : {}) },
      body: JSON.stringify({ args }),
    });
  } catch {
    throw new ApiError('network_error', null);
  }
  const body = await res.json().catch(() => ({ error: { code: 'server_error', detail: null } }));
  if (body.error) throw new ApiError(body.error.code, body.error.detail);
  return body.data;
}

/** Calls a method that runs as the signed-in user (userId is added by the server from the session). */
export function rpc<K extends keyof Store>(method: K, ...args: DropUser<Fn<K>['args']>): Promise<Fn<K>['ret']> {
  return call(method as string, args);
}

/** Calls a public method (login etc.), passing all arguments. */
export function rpcPublic<K extends 'loginManager' | 'requestOtp' | 'verifyOtp'>(
  method: K, ...args: Fn<K>['args']): Promise<Fn<K>['ret']> {
  return call(method, args);
}

export const photoUrl = (storagePath: string) => `/api/photos/${storagePath}`;

const MESSAGES: Record<string, string> = {
  invalid_credentials: 'אימייל או סיסמה שגויים',
  not_authenticated: 'יש להתחבר מחדש',
  forbidden: 'אין הרשאה לפעולה זו',
  name_required: 'יש להזין שם',
  title_required: 'יש להזין כותרת',
  assignee_required: 'יש לבחור עובד או צוות',
  invalid_coordinates: 'קואורדינטות לא תקינות',
  invalid_radius: 'רדיוס חייב להיות בין 20 ל-5000 מטר',
  invalid_video_url: 'קישור הווידאו חייב להתחיל ב-http',
  invalid_phone: 'מספר טלפון לא תקין',
  phone_exists: 'המספר כבר רשום או הוזמן',
  reason_required: 'חובה לציין סיבה לתיקון',
  check_out_before_check_in: 'שעת היציאה חייבת להיות אחרי שעת הכניסה',
  invalid_time: 'שעה לא תקינה',
  network_error: 'אין חיבור לשרת. בדוק שהשרת רץ ונסה שוב.',
};
export const errorMessage = (e: unknown) =>
  e instanceof ApiError ? MESSAGES[e.code] ?? `שגיאה: ${e.code}` : 'שגיאה לא צפויה';

export const fmtTime = (iso: string | null) =>
  iso ? new Date(iso).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jerusalem' }) : '—';
export const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', timeZone: 'Asia/Jerusalem' });
export const fmtHours = (h: number) => `${Math.floor(h)}:${String(Math.round((h % 1) * 60)).padStart(2, '0')}`;
export const todayKey = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jerusalem' });
