// "My day": attendance card with one big button + today's tasks.
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import type { TaskView } from '@constructa/shared';
import { Banner, BigButton, C, Card, Screen, s } from '@/components/ui';
import { api, ApiError, errorKey, saveSession, type MyDay } from '@/lib/api';
import { currentFix, LocationDeniedError } from '@/lib/location';
import { listPending, retryAll } from '@/lib/pending';

// Site time (Israel), same as the manager dashboard, regardless of the phone's time zone setting.
const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jerusalem' });
const fmtHours = (h: number) => `${Math.floor(h)}:${String(Math.round((h % 1) * 60)).padStart(2, '0')}`;

export default function TodayScreen() {
  const { t } = useTranslation();
  const [day, setDay] = useState<MyDay | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState<'' | 'locating' | 'sending'>('');
  const [pending, setPending] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const showError = (e: unknown) => {
    if (e instanceof LocationDeniedError) return setError(t('locationDenied'));
    const k = errorKey(e);
    setError(t(k.key, k.params));
  };

  const load = useCallback(async () => {
    try {
      setDay(await api.myDay());
      setPending((await listPending()).length);
    } catch (e) {
      if (e instanceof ApiError && e.code === 'not_authenticated') { await saveSession(null); router.replace('/login'); return; }
      showError(e);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const project = day?.projects[0]; // MVP: a worker is on one site per day
  const shift = day?.openShift;

  async function toggleShift() {
    if (!project) return;
    setError('');
    try {
      setBusy('locating');
      const fix = await currentFix(project);
      setBusy('sending');
      if (shift) await api.checkOut(fix.lat, fix.lng);
      else await api.checkIn(project.id, fix.lat, fix.lng, fix.accuracy);
      await load();
    } catch (e) { showError(e); } finally { setBusy(''); }
  }

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={{ padding: 18, gap: 16, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ flexShrink: 1 }}>
            <Text style={s.h1}>{t('today')}</Text>
            {day && <Text style={s.muted}>{day.profile.full_name}{project ? ` · ${project.name}` : ''}</Text>}
          </View>
          <Pressable accessibilityLabel={t('settings')} onPress={() => router.push('/settings')} style={{ padding: 12 }} hitSlop={12}>
            <Text style={{ fontSize: 30 }}>⚙️</Text>
          </Pressable>
        </View>

        {!!error && <Banner text={error} />}
        {pending > 0 && (
          <Banner tone="amber" text={t('pendingUploads', { count: pending })}
            action={<BigButton label={t('retry')} tone="dark" onPress={async () => { await retryAll(); await load(); }} />} />
        )}

        {day && !project && <Banner tone="amber" text={t('noProject')} />}

        {project && (
          <Card style={{ borderWidth: 3, borderColor: shift ? C.green : C.line }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={{ width: 16, height: 16, borderRadius: 8, backgroundColor: shift ? C.green : '#B9B3A8' }} />
              <Text style={s.h2}>{shift ? t('onSiteSince', { time: fmtTime(shift.check_in_at) }) : t('notAtWork')}</Text>
            </View>
            <Text style={s.muted}>{t('hoursToday', { hours: fmtHours(day!.hoursToday) })}</Text>
            <BigButton
              testID="shift-button"
              label={busy === 'locating' ? t('gettingLocation') : shift ? t('checkOut') : t('checkIn')}
              icon={shift ? '⏹' : '▶'}
              tone={shift ? 'dark' : 'green'}
              busy={busy === 'sending'}
              disabled={busy === 'locating'}
              onPress={toggleShift}
            />
          </Card>
        )}

        {day && project && (
          <>
            <Text style={[s.h2, { marginTop: 6 }]}>{t('myTasks')} ({day.tasks.filter((x) => x.status === 'done').length}/{day.tasks.length})</Text>
            {day.tasks.length === 0 ? <Text style={s.muted}>{t('noTasks')}</Text> : day.tasks.map((task) => (
              <TaskRow key={task.id} task={task} />
            ))}
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

function TaskRow({ task }: { task: TaskView }) {
  const { t } = useTranslation();
  const done = task.status === 'done';
  return (
    <Pressable
      testID={`task-${task.id}`}
      accessibilityRole="button"
      onPress={() => router.push({ pathname: '/task/[id]', params: { id: task.id } })}
      style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1 })}>
      <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 14, opacity: done ? 0.7 : 1 }}>
        <View style={{
          width: 48, height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center',
          backgroundColor: done ? C.green : '#fff', borderWidth: 3, borderColor: done ? C.green : C.line,
        }}>
          {done && <Text style={{ color: '#fff', fontSize: 28, fontWeight: '900' }}>✓</Text>}
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={[s.body, { fontWeight: '700', textDecorationLine: done ? 'line-through' : 'none' }]}>{task.title}</Text>
          <Text style={s.muted}>📍 {task.location_path.join(' › ')}</Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {task.video_url && <Text style={{ color: '#1767A6', fontWeight: '600' }}>▶ {t('watchVideo')}</Text>}
            {task.overdue && <Text style={{ color: C.red, fontWeight: '700' }}>{t('overdue')}</Text>}
            {done && <Text style={{ color: C.green, fontWeight: '700' }}>{t('statusDone')}</Text>}
          </View>
        </View>
        {/* '›' is a bidi-mirrored character: it renders as '‹' in RTL text automatically */}
        <Text style={{ fontSize: 26, color: C.muted }}>›</Text>
      </Card>
    </Pressable>
  );
}
