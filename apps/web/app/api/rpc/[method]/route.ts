import { MANAGER_METHODS, PUBLIC_METHODS, WORKER_METHODS } from '@constructa/shared';
import { withStore } from '@/lib/mock-db';
import { errorResponse, json, preflight, userIdFrom } from '@/lib/mock-http';

const PUBLIC = new Set<string>(PUBLIC_METHODS);
const ALLOWED = new Set<string>([...PUBLIC_METHODS, ...WORKER_METHODS, ...MANAGER_METHODS]);

export const OPTIONS = preflight;

// POST /api/rpc/{method}   body: { "args": [...] }
export async function POST(req: Request, ctx: RouteContext<'/api/rpc/[method]'>) {
  const { method } = await ctx.params;
  if (!ALLOWED.has(method)) return json({ error: { code: 'unknown_method', detail: method } }, 404);
  try {
    const { args = [] } = (await req.json().catch(() => ({}))) as { args?: unknown[] };
    const data = await withStore((s) => {
      const fn = (s as unknown as Record<string, (...a: unknown[]) => unknown>)[method].bind(s);
      // Public methods take no user; all others get the caller's id first (like auth.uid() in SQL).
      return PUBLIC.has(method) ? fn(...args) : fn(userIdFrom(req), ...args);
    });
    return json({ data });
  } catch (e) {
    return errorResponse(e);
  }
}
