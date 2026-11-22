'use client';
import Link from 'next/link';
import { useDash } from '@/components/project-context';
import { Badge, Card, Empty, ErrorText, Progress } from '@/components/ui';
import { fmtHours, fmtTime, photoUrl, rpc } from '@/lib/api';
import { useLoad } from '@/lib/hooks';

export default function DashboardPage() {
  const { project } = useDash();
  const { data, error } = useLoad(() => rpc('dashboard', project!.id), [project?.id], 5000);

  if (error) return <ErrorText>{error}</ErrorText>;
  if (!data) return <p className="text-slate-500">טוען…</p>;

  const floors = data.progress.filter((l) => l.kind === 'floor' || l.kind === 'building');
  const tasksPct = data.tasksToday.total ? Math.round((100 * data.tasksToday.done) / data.tasksToday.total) : 0;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-baseline gap-3">
        <h1 className="text-2xl font-bold">{project!.name}</h1>
        <span className="text-sm text-slate-500">מתעדכן אוטומטית כל 5 שניות</span>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="באתר עכשיו" value={String(data.onSite.length)} />
        <Stat label="משימות היום" value={`${data.tasksToday.done}/${data.tasksToday.total}`} sub={`${tasksPct}% הושלמו`} />
        <Stat label="נסגרו עם תמונה בזמן" value={`${data.kpi.percent}%`} sub={`יעד ${data.kpi.target}%`}
          tone={data.kpi.percent >= data.kpi.target ? 'good' : 'warn'} />
        <Stat label="שעות עבודה היום" value={fmtHours(data.hoursToday.reduce((s, w) => s + w.hours, 0))} />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card title="מי באתר עכשיו">
          {data.onSite.length === 0 ? <Empty>אף עובד לא ביצע כניסה כרגע</Empty> : (
            <ul className="divide-y divide-stone-100">
              {data.onSite.map((w) => (
                <li key={w.attendance_id} className="flex items-center justify-between py-2.5">
                  <span className="flex items-center gap-2 font-medium">
                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" aria-hidden /> {w.full_name}
                  </span>
                  <span className="text-sm text-slate-500">מאז {fmtTime(w.check_in_at)} · {fmtHours(w.hours_so_far)} ש׳</span>
                </li>
              ))}
            </ul>
          )}
          {data.hoursToday.some((w) => !w.on_site) && (
            <div className="mt-3 border-t border-stone-100 pt-3 text-sm text-slate-500">
              יצאו היום: {data.hoursToday.filter((w) => !w.on_site).map((w) => `${w.full_name} (${fmtHours(w.hours)})`).join(', ')}
            </div>
          )}
        </Card>

        <Card title="התקדמות לפי קומות">
          {floors.length === 0 ? <Empty>עדיין לא הוגדר מבנה לפרויקט</Empty> : (
            <ul className="space-y-3">
              {floors.map((l) => (
                <li key={l.id} className={l.kind === 'building' ? 'border-b border-stone-100 pb-3' : ''}>
                  <div className="mb-1 flex justify-between text-sm">
                    <span className={l.kind === 'building' ? 'font-bold' : 'font-medium'}>{l.name}</span>
                    <span className="text-slate-500">{l.percent_done}% · {l.done_tasks}/{l.total_tasks}</span>
                  </div>
                  <Progress value={l.percent_done} />
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card title="תיעוד אחרון מהשטח" action={<Link href="/gallery" className="text-sm text-amber-700 hover:underline">לכל הגלריה ←</Link>}>
        {data.recentPhotos.length === 0 ? <Empty>עדיין לא הועלו תמונות</Empty> : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {data.recentPhotos.map((p) => (
              <figure key={p.id} className="overflow-hidden rounded-lg border border-stone-200">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photoUrl(p.storage_path)} alt={p.task_title} className="aspect-[4/3] w-full bg-stone-200 object-cover" />
                <figcaption className="p-2 text-xs">
                  <div className="truncate font-medium">{p.task_title}</div>
                  <div className="text-slate-500">{p.uploaded_by_name} · {fmtTime(p.taken_at)}</div>
                </figcaption>
              </figure>
            ))}
          </div>
        )}
      </Card>
      <p className="text-xs text-slate-500">
        <Badge>הערה</Badge> סימון השלמה ותמונה אינם מהווים אישור מקצועי לאיכות העבודה או תחליף לפיקוח בטיחות.
      </p>
    </div>
  );
}

function Stat({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: 'good' | 'warn' }) {
  return (
    <div className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
      <div className="text-xs font-medium text-slate-500">{label}</div>
      <div className={`mt-1 text-3xl font-extrabold tabular-nums ${tone === 'good' ? 'text-emerald-600' : tone === 'warn' ? 'text-amber-600' : 'text-slate-900'}`}>{value}</div>
      {sub && <div className="text-xs text-slate-500">{sub}</div>}
    </div>
  );
}
