import { promises as fs } from 'node:fs';
import path from 'node:path';
import { PHOTO_DIR, withStore } from '@/lib/mock-db';
import { errorResponse, json, preflight, userIdFrom } from '@/lib/mock-http';

export const OPTIONS = preflight;
const MAX_BYTES = 5 * 1024 * 1024; // same limit as the Supabase bucket
const EXT: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

// POST /api/upload  body: { taskId, base64, mime }  → { data: { path } }
// Stand-in for supabase.storage.from('task-photos').upload(...)
export async function POST(req: Request) {
  try {
    const { taskId, base64, mime = 'image/jpeg' } = (await req.json()) as { taskId: string; base64: string; mime?: string };
    const ext = EXT[mime];
    if (!ext) return json({ error: { code: 'invalid_mime', detail: mime } }, 400);
    const bytes = Buffer.from((base64 ?? '').replace(/^data:[^,]+,/, ''), 'base64');
    if (!bytes.length) return json({ error: { code: 'photo_required', detail: null } }, 400);
    if (bytes.length > MAX_BYTES) return json({ error: { code: 'photo_too_large', detail: String(bytes.length) } }, 400);

    const objectPath = await withStore(async (s) => {
      const p = s.registerUpload(userIdFrom(req)!, taskId, ext);
      const file = path.join(PHOTO_DIR, ...p.split('/'));
      await fs.mkdir(path.dirname(file), { recursive: true });
      await fs.writeFile(file, bytes);
      return p;
    });
    return json({ data: { path: objectPath } });
  } catch (e) {
    return errorResponse(e);
  }
}
