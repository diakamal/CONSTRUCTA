// Task details → watch guide → "Done ✓" → camera opens → confirm → closed immediately (no manager approval).
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, Text, View } from 'react-native';
import type { TaskView } from '@constructa/shared';
import { Banner, BigButton, C, Card, Screen, s } from '@/components/ui';
import { api, ApiError, API_URL, errorKey } from '@/lib/api';
import { sendCompletion } from '@/lib/pending';
import { CameraDeniedError, takeWorkPhoto, type Photo } from '@/lib/photo';

export default function TaskScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const [task, setTask] = useState<TaskView | null>(null);
  const [photo, setPhoto] = useState<Photo | null>(null);
  const [state, setState] = useState<'idle' | 'sending' | 'failed' | 'done'>('idle');
  const [error, setError] = useState('');

  useEffect(() => {
    api.getTask(id).then(setTask).catch((e) => { const k = errorKey(e); setError(t(k.key, k.params)); });
  }, [id, t]);

  async function capture() {
    setError('');
    try {
      const p = await takeWorkPhoto();
      if (p) setPhoto(p);
    } catch (e) {
      setError(e instanceof CameraDeniedError ? t('cameraDenied') : t('errorGeneric'));
    }
  }

  async function send() {
    if (!photo || !task) return;
    setState('sending'); setError('');
    try {
      setTask(await sendCompletion({ taskId: task.id, base64: photo.base64, mime: photo.mime, takenAt: new Date().toISOString() }));
      setState('done');
    } catch (e) {
      if (e instanceof ApiError && e.code === 'network_error') { setState('failed'); return; }
      const k = errorKey(e); setError(t(k.key, k.params)); setState('idle');
    }
  }

  const done = task?.status === 'done';

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ padding: 18, gap: 16, paddingBottom: 40 }}>
        <Pressable onPress={() => router.back()} style={{ paddingVertical: 8 }} hitSlop={12} accessibilityRole="button">
          <Text style={[s.body, { fontWeight: '700' }]}>‹ {t('back')}</Text>
        </Pressable>

        {!!error && <Banner text={error} />}
        {!task ? null : (
          <>
            <View style={{ gap: 6 }}>
              <Text style={s.muted}>📍 {task.location_path.join(' › ')}</Text>
              <Text style={s.h1}>{task.title}</Text>
            </View>

            {task.instructions && (
              <Card>
                <Text style={[s.h2, { fontSize: 17 }]}>{t('instructions')}</Text>
                <Text style={[s.body, { lineHeight: 26 }]}>{task.instructions}</Text>
              </Card>
            )}

            {task.video_url && (
              <Card>
                <BigButton label={t('watchVideo')} icon="▶" tone="dark" onPress={() => WebBrowser.openBrowserAsync(task.video_url!)} />
                <Text style={s.muted}>{t('videoDisclaimer')}</Text>
              </Card>
            )}

            {done ? (
              <Card style={{ borderColor: C.green, borderWidth: 3, alignItems: 'center' }}>
                <Text style={{ fontSize: 56 }}>✅</Text>
                <Text style={[s.h2, { color: C.green }]}>{t('taskDone')}</Text>
                {task.photos[0] && (
                  <Image source={{ uri: photo?.uri ?? `${API_URL}/api/photos/${task.photos[0].storage_path}` }}
                    style={{ width: '100%', aspectRatio: 4 / 3, borderRadius: 12, backgroundColor: C.line }} contentFit="cover" />
                )}
                {state === 'done' && <BigButton label={t('back')} onPress={() => router.back()} />}
              </Card>
            ) : photo ? (
              <Card>
                <Image source={{ uri: photo.uri }} style={{ width: '100%', aspectRatio: 4 / 3, borderRadius: 12 }} contentFit="cover" />
                {state === 'failed' && <Banner tone="amber" text={t('sendFailed')} />}
                <BigButton testID="confirm-photo" label={state === 'sending' ? t('uploading') : state === 'failed' ? t('retry') : t('confirm')}
                  tone="green" busy={state === 'sending'} onPress={send} />
                <BigButton label={t('retake')} tone="light" disabled={state === 'sending'} onPress={capture} />
              </Card>
            ) : (
              <View style={{ gap: 8 }}>
                <BigButton testID="mark-done" label={t('markDone')} tone="green" onPress={capture} />
                <Text style={[s.muted, { textAlign: 'center' }]}>📷 {t('takePhoto')}</Text>
              </View>
            )}
          </>
        )}
      </ScrollView>
    </Screen>
  );
}
