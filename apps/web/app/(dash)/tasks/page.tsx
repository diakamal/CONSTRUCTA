'use client';
import { useMemo, useState } from 'react';
import type { TaskView } from '@constructa/shared';
import { useDash } from '@/components/project-context';
import { Badge, Button, Card, Empty, ErrorText, Field, Input, Select, Textarea } from '@/components/ui';
import { errorMessage, fmtTime, rpc, todayKey } from '@/lib/api';
import { useLoad } from '@/lib/hooks';
import { locationOptions } from '@/lib/locations';

type Draft = Partial<TaskView> & { assignTo?: string };
const EMPTY: Draft = { title: '', instructions: '', video_url: '', location_id: null, scheduled_date: '', assignTo: '' };

export default function TasksPage() {
  const { project } = useDash();
  const pid = project!.id;
  const [filters, setFilters] = useState({ date: todayKey(), status: '', locationId: '' });
  const [draft, setDraft] = useState<Draft | null>(null);
  const [dup, setDup] = useState<TaskView | null>(null);
  const [formError, setFormError] = useState('');

  const tasks = useLoad(() => rpc('listTasks', pid, {
    date: filters.date || undefined, status: (filters.status || undefined) as 'open' | 'done' | undefined,
    locationId: filters.locationId || undefined,
  }), [pid, filters.date, filters.status, filters.locationId]);
  const locs = useLoad(() => rpc('listLocations', pid), [pid]);
  const people = useLoad(() => rpc('listWorkers'), [pid]);
  const options = useMemo(() => locationOptions(locs.data ?? []), [locs.data]);

  const assigneeLabel = (t: TaskView) =>
    t.assignee_id ? people.data?.workers.find((w) => w.id === t.assignee_id)?.full_name ?? '—'
      : people.data?.teams.find((x) => x.id === t.team_id)?.name ?? '—';

  async function save() {
    if (!draft) return;
    setFormError('');
    const [kind, id] = (draft.assignTo ?? '').split(':');
    try {
      await rpc('saveTask', {
        id: draft.id, project_id: pid, title: draft.title ?? '', instructions: draft.instructions || null,
        video_url: draft.video_url || null, location_id: draft.location_id || null,
        scheduled_date: draft.scheduled_date || todayKey(),
        assignee_id: kind === 'w' ? id : null, team_id: kind === 't' ? id : null,
      });
      setDraft(null);
      tasks.reload();
    } catch (e) {
      setFormError(errorMessage(e));
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">משימות</h1>
        <Button onClick={() => { setFormError(''); setDraft({ ...EMPTY, scheduled_date: filters.date || todayKey() }); }}>+ משימה חדשה</Button>
      </div>

      <Card>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="תאריך">
            <Input type="date" value={filters.date} onChange={(e) => setFilters({ ...filters, date: e.target.value })} />
          </Field>
          <Field label="סטטוס">
            <Select value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}>
              <option value="">הכל</option><option value="open">פתוחה</option><option value="done">הושלמה</option>
            </Select>
          </Field>
          <Field label="מיקום">
            <Select value={filters.locationId} onChange={(e) => setFilters({ ...filters, locationId: e.target.value })}>
              <option value="">כל הפרויקט</option>
              {options.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
            </Select>
          </Field>
        </div>
      </Card>

      {draft && (
        <Card title={draft.id ? 'עריכת משימה' : 'משימה חדשה'}>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="כותרת"><Input value={draft.title ?? ''} onChange={(e) => setDraft({ ...draft, title: e.target.value })} /></Field>
            <Field label="מיקום">
              <Select value={draft.location_id ?? ''} onChange={(e) => setDraft({ ...draft, location_id: e.target.value || null })}>
                <option value="">ללא מיקום</option>
                {options.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
              </Select>
            </Field>
            <Field label="משויך ל">
              <Select value={draft.assignTo ?? ''} onChange={(e) => setDraft({ ...draft, assignTo: e.target.value })}>
                <option value="">בחר…</option>
                <optgroup label="צוותים">
                  {people.data?.teams.map((t) => <option key={t.id} value={`t:${t.id}`}>{t.name}</option>)}
                </optgroup>
                <optgroup label="עובדים">
                  {people.data?.workers.filter((w) => w.role === 'worker').map((w) => <option key={w.id} value={`w:${w.id}`}>{w.full_name}</option>)}
                </optgroup>
              </Select>
            </Field>
            <Field label="תאריך ביצוע">
              <Input type="date" value={draft.scheduled_date ?? ''} onChange={(e) => setDraft({ ...draft, scheduled_date: e.target.value })} />
            </Field>
            <Field label="קישור לסרטון הדרכה" hint="YouTube או קישור לקובץ וידאו. הסרטון אינו מחליף הכשרה נדרשת.">
              <Input dir="ltr" placeholder="https://…" value={draft.video_url ?? ''} onChange={(e) => setDraft({ ...draft, video_url: e.target.value })} />
            </Field>
            <Field label="הנחיות ביצוע">
              <Textarea rows={3} value={draft.instructions ?? ''} onChange={(e) => setDraft({ ...draft, instructions: e.target.value })} />
            </Field>
          </div>
          <div className="mt-4 space-y-3">
            <ErrorText>{formError}</ErrorText>
            <div className="flex gap-2">
              <Button onClick={save}>שמירה</Button>
              <Button variant="secondary" onClick={() => setDraft(null)}>ביטול</Button>
            </div>
          </div>
        </Card>
      )}

      {dup && <DuplicateTask task={dup} options={options} onClose={(changed) => { setDup(null); if (changed) tasks.reload(); }} />}

      <Card title={tasks.data ? `${tasks.data.length} משימות` : undefined}>
        <ErrorText>{tasks.error}</ErrorText>
        {!tasks.data ? <p className="text-slate-500">טוען…</p> : tasks.data.length === 0 ? <Empty>אין משימות לסינון הזה</Empty> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="text-start text-xs text-slate-500">
                <tr className="border-b border-stone-200">
                  <th className="py-2 text-start font-medium">משימה</th>
                  <th className="py-2 text-start font-medium">מיקום</th>
                  <th className="py-2 text-start font-medium">משויך</th>
                  <th className="py-2 text-start font-medium">סטטוס</th>
                  <th />
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {tasks.data.map((t) => (
                  <tr key={t.id}>
                    <td className="py-2.5 font-medium">
                      {t.title}
                      {t.video_url && <span className="ms-2 text-xs text-sky-700">▶ וידאו</span>}
                    </td>
                    <td className="py-2.5 text-slate-600">{t.location_path.join(' ← ') || '—'}</td>
                    <td className="py-2.5 text-slate-600">{assigneeLabel(t)}</td>
                    <td className="py-2.5">
                      {t.status === 'done'
                        ? <Badge tone="green">הושלמה {fmtTime(t.completed_at)} · {t.completed_by_name}</Badge>
                        : t.overdue ? <Badge tone="red">באיחור</Badge> : <Badge tone="amber">פתוחה</Badge>}
                    </td>
                    <td className="py-2.5 text-end whitespace-nowrap">
                      <Button variant="ghost" className="px-2 text-xs" onClick={() => {
                        setFormError('');
                        setDraft({ ...t, assignTo: t.assignee_id ? `w:${t.assignee_id}` : t.team_id ? `t:${t.team_id}` : '' });
                      }}>עריכה</Button>
                      <Button variant="ghost" className="px-2 text-xs" onClick={() => setDup(t)}>שכפול</Button>
                      <Button variant="ghost" className="px-2 text-xs text-red-700" onClick={async () => {
                        if (!confirm(`למחוק את "${t.title}"?`)) return;
                        await rpc('deleteTask', t.id); tasks.reload();
                      }}>מחיקה</Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

function DuplicateTask({ task, options, onClose }:
  { task: TaskView; options: { id: string; label: string; depth: number }[]; onClose: (changed: boolean) => void }) {
  const [locIds, setLocIds] = useState<string[]>([]);
  const [days, setDays] = useState(1);
  const [start, setStart] = useState(task.scheduled_date);
  const [error, setError] = useState('');
  const sameKind = options.filter((o) => o.depth === (options.find((x) => x.id === task.location_id)?.depth ?? -1));

  const dates = Array.from({ length: days }, (_, i) => {
    const d = new Date(`${start}T12:00:00`); d.setDate(d.getDate() + i); return d.toLocaleDateString('en-CA');
  });

  return (
    <Card title={`שכפול: ${task.title}`}>
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="למיקומים (באותה רמה)" hint="לא נבחר דבר = אותו מיקום">
          <div className="max-h-48 space-y-1 overflow-y-auto rounded-lg border border-stone-200 p-2">
            {sameKind.map((o) => (
              <label key={o.id} className="flex items-center gap-2">
                <input type="checkbox" checked={locIds.includes(o.id)}
                  onChange={(e) => setLocIds(e.target.checked ? [...locIds, o.id] : locIds.filter((x) => x !== o.id))} />
                {o.label}
              </label>
            ))}
          </div>
        </Field>
        <div className="space-y-3">
          <Field label="החל מתאריך"><Input type="date" value={start} onChange={(e) => setStart(e.target.value)} /></Field>
          <Field label="מספר ימים"><Input type="number" min={1} max={30} value={days} onChange={(e) => setDays(Math.max(1, Math.min(30, Number(e.target.value))))} /></Field>
          <p className="text-sm text-slate-600">ייווצרו {(locIds.length || 1) * days} משימות.</p>
        </div>
      </div>
      <div className="mt-4 space-y-3">
        <ErrorText>{error}</ErrorText>
        <div className="flex gap-2">
          <Button onClick={async () => {
            try { await rpc('duplicateTask', task.id, locIds, dates); onClose(true); } catch (e) { setError(errorMessage(e)); }
          }}>שכפל</Button>
          <Button variant="secondary" onClick={() => onClose(false)}>ביטול</Button>
        </div>
      </div>
    </Card>
  );
}
