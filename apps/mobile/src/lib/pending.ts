// Completions that failed to send (no signal). The photo is kept on the device and sent again
// with "Try again". This is the MVP answer to weak reception; full offline sync comes later.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api, ApiError } from './api';

const KEY = 'constructa.pending';
export interface PendingCompletion { taskId: string; base64: string; mime: string; takenAt: string; photoPath?: string }

export async function listPending(): Promise<PendingCompletion[]> {
  try { return JSON.parse((await AsyncStorage.getItem(KEY)) ?? '[]'); } catch { return []; }
}
async function write(list: PendingCompletion[]) {
  try { await AsyncStorage.setItem(KEY, JSON.stringify(list)); } catch {}
}
export async function addPending(p: PendingCompletion) {
  await write([...(await listPending()).filter((x) => x.taskId !== p.taskId), p]);
}
async function removePending(taskId: string) {
  await write((await listPending()).filter((x) => x.taskId !== taskId));
}

/**
 * Upload + complete. Upload is skipped if a previous attempt already uploaded the photo,
 * and complete is idempotent on the server, so retrying is always safe.
 */
export async function sendCompletion(p: PendingCompletion) {
  try {
    const photoPath = p.photoPath ?? (await api.uploadPhoto(p.taskId, p.base64, p.mime)).path;
    p.photoPath = photoPath;
    const task = await api.completeTask(p.taskId, photoPath);
    await removePending(p.taskId);
    return task;
  } catch (e) {
    // Only keep it for retry when it's a connectivity problem; real rejections are shown to the user.
    if (e instanceof ApiError && e.code === 'network_error') await addPending(p);
    else await removePending(p.taskId);
    throw e;
  }
}

export async function retryAll() {
  const results = { sent: 0, failed: 0 };
  for (const p of await listPending()) {
    try { await sendCompletion(p); results.sent++; } catch { results.failed++; }
  }
  return results;
}
