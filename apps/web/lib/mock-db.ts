// Server-only: the temporary mock backend's storage (a JSON file + a photos folder).
// Replaced by Supabase (Postgres + Storage) once a database is available.
import 'server-only';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { MockStore, createSeed, type MockState } from '@constructa/shared';

const DIR = path.join(process.cwd(), '.mock-data');
const DB_FILE = path.join(DIR, 'db.json');
export const PHOTO_DIR = path.join(DIR, 'photos');

// Serialize all access so concurrent requests can't overwrite each other's writes.
let queue: Promise<unknown> = Promise.resolve();

async function load(): Promise<MockState> {
  try {
    return JSON.parse(await fs.readFile(DB_FILE, 'utf8')) as MockState;
  } catch {
    const seed = createSeed();
    await save(seed);
    return seed;
  }
}

async function save(state: MockState) {
  await fs.mkdir(DIR, { recursive: true });
  const tmp = DB_FILE + '.tmp';
  await fs.writeFile(tmp, JSON.stringify(state, null, 1));
  await fs.rename(tmp, DB_FILE);
}

/** Run fn against the store; persists if the state changed and fn didn't throw. */
export function withStore<T>(fn: (s: MockStore) => T | Promise<T>): Promise<T> {
  const run = queue.then(async () => {
    const store = new MockStore(await load());
    const before = JSON.stringify(store.state);
    const result = await fn(store);
    if (JSON.stringify(store.state) !== before) await save(store.state);
    return result;
  });
  queue = run.catch(() => undefined);
  return run;
}

export function resetStore() {
  return withStore(async (s) => {
    s.state = createSeed();
    await fs.rm(PHOTO_DIR, { recursive: true, force: true });
    return { ok: true };
  });
}
