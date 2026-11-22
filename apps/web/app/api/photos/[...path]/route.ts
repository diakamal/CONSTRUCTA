import { promises as fs } from 'node:fs';
import path from 'node:path';
import { PHOTO_DIR } from '@/lib/mock-db';
import { CORS } from '@/lib/mock-http';

const TYPES: Record<string, string> = { jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };

const PLACEHOLDER = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300" viewBox="0 0 400 300">
<rect width="400" height="300" fill="#d6d3cd"/><rect x="40" y="170" width="320" height="90" fill="#a8a29e"/>
<rect x="70" y="80" width="90" height="90" fill="#78716c"/><rect x="190" y="110" width="140" height="60" fill="#8a837d"/>
<text x="200" y="45" font-family="sans-serif" font-size="22" text-anchor="middle" fill="#44403c">demo photo</text></svg>`;

// GET /api/photos/{org}/{task}/{file}. Mock only: no auth check (Supabase will use signed URLs).
export async function GET(_req: Request, ctx: RouteContext<'/api/photos/[...path]'>) {
  const { path: parts } = await ctx.params;
  if (parts.some((p) => p.includes('..') || p.includes('\\'))) return new Response('bad path', { status: 400 });
  try {
    const file = path.join(PHOTO_DIR, ...parts);
    const bytes = await fs.readFile(file);
    const ext = file.split('.').pop()!.toLowerCase();
    return new Response(bytes, { headers: { ...CORS, 'Content-Type': TYPES[ext] ?? 'application/octet-stream' } });
  } catch {
    // Demo seed photos have no file on disk: return a placeholder image.
    return new Response(PLACEHOLDER, { headers: { ...CORS, 'Content-Type': 'image/svg+xml' } });
  }
}
