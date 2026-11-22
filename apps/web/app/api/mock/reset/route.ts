import { resetStore } from '@/lib/mock-db';
import { json, preflight } from '@/lib/mock-http';

export const OPTIONS = preflight;

// POST /api/mock/reset → restores the demo data (dates regenerated relative to today).
export async function POST() {
  return json({ data: await resetStore() });
}
