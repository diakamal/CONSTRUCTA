import 'server-only';
import { AppError } from '@constructa/shared';

// The mobile app (Expo, another origin/device) calls this API too. Dev-only mock → permissive CORS.
export const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export const json = (body: unknown, status = 200) => Response.json(body, { status, headers: CORS });

export function errorResponse(e: unknown) {
  if (e instanceof AppError) return json({ error: { code: e.code, detail: e.detail ?? null } }, 400);
  console.error(e);
  return json({ error: { code: 'server_error', detail: e instanceof Error ? e.message : String(e) } }, 500);
}

/** Mock session: the bearer token is "mock-<userId>". NOT secure – a stand-in for Supabase Auth JWTs. */
export function userIdFrom(req: Request): string | null {
  const m = req.headers.get('authorization')?.match(/^Bearer mock-(.+)$/);
  return m?.[1] ?? null;
}

export const preflight = () => new Response(null, { status: 204, headers: CORS });
