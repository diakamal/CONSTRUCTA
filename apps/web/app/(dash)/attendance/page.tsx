'use client';
import { useState } from 'react';
import { useDash } from '@/components/project-context';
import { Badge, Button, Card, Empty, ErrorText, Field, Input } from '@/components/ui';
import { errorMessage, fmtDate, fmtHours, fmtTime, rpc, todayKey } from '@/lib/api';
import { useLoad } from '@/lib/hooks';

const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000).toLocaleDateString('en-CA', { timeZone: 'Asia/Jerusalem' });
// The form edits site time (Israel), whatever time zone the manager's computer is set to.
const TZ = 'Asia/Jerusalem';
/** ISO → "YYYY-MM-DDTHH:mm" in Israel time, for <input type="datetime-local">. */
const toLocalInput = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString('sv-SE', { timeZone: TZ }).replace(' ', 'T').slice(0, 16) : '';
/** "YYYY-MM-DDTHH:mm" in Israel time → ISO (UTC). */
const fromLocalInput = (value: string) => {
  const asUtc = new Date(`${value}:00Z`);
  const israelWall = new Date(asUtc.toLocaleString('sv-SE', { timeZone: TZ }).replace(' ', 'T') + 'Z');
  return new Date(asUtc.getTime() - (israelWall.getTime() - asUtc.getTime())).toISOString();
};

export default function AttendancePage() {
  const { project } = useDash();
  const pid = project!.id;
  const [range, setRange] = useState({ from: daysAgo(6), to: todayKey() });
  const rows = useLoad(() => rpc('attendanceReport', pid, range.from, range.to), [pid, range.from, range.to], 15000);
  const [edit, setEdit] = useState<{ id: string; name: string; in: string; out: string; reason: string } | null>(null);
  const [error, setError] = useState('');

  function exportCsv() {
    if (!rows.data) return;
    const header = ['עובד', 'תאריך', 'כניסה', 'יציאה', 'שעות', 'מקור', 'תיקונים'];
    const lines = rows.data.map((r) => [
      r.full_name, fmtDate(r.check_in_at), fmtTime(r.check_in_at), fmtTime(r.check_out_at), r.hours.toFixed(2),
      r.source === 'manual' ? 'תיקון מנהל' : 'אפליקציה', r.edits.map((e) => e.reason).join(' | '),
    ]);
    const csv = [header, ...lines].map((l) => l.map((c) => `"${String(c).replaceAll('"', '""')}"`).join(',')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }));
    a.download = `attendance_${range.from}_${range.to}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  const total = rows.data?.reduce((s, r) => s + r.hours, 0) ?? 0;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">נוכחות</h1>
        <Button variant="secondary" onClick={exportCsv} disabled={!rows.data?.length}>ייצוא CSV</Button>
      </div>
      <Card>
        <div className="flex flex-wrap items-end gap-3">
          <Field label="מתאריך"><Input type="date" value={range.from} onChange={(e) => setRange({ ...range, from: e.target.value })} /></Field>
          <Field label="עד תאריך"><Input type="date" value={range.to} onChange={(e) => setRange({ ...range, to: e.target.value })} /></Field>
          <div className="ms-auto text-sm text-slate-600">סה״כ: <b>{fmtHours(total)}</b> שעות</div>
        </div>
      </Card>

      {edit && (
        <Card title={`תיקון נוכחות – ${edit.name}`}>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="כניסה (שעון ישראל)"><Input type="datetime-local" value={edit.in} onChange={(e) => setEdit({ ...edit, in: e.target.value })} /></Field>
            <Field label="יציאה" hint="ריק = עדיין באתר"><Input type="datetime-local" value={edit.out} onChange={(e) => setEdit({ ...edit, out: e.target.value })} /></Field>
            <Field label="סיבת התיקון (חובה)"><Input value={edit.reason} placeholder="למשל: שכח לבצע יציאה" onChange={(e) => setEdit({ ...edit, reason: e.target.value })} /></Field>
          </div>
          <div className="mt-4 space-y-3">
            <ErrorText>{error}</ErrorText>
            <div className="flex gap-2">
              <Button onClick={async () => {
                setError('');
                try {
                  await rpc('editAttendance', edit.id, fromLocalInput(edit.in), edit.out ? fromLocalInput(edit.out) : null, edit.reason);
                  setEdit(null); rows.reload();
                } catch (e) { setError(errorMessage(e)); }
              }}>שמירת תיקון</Button>
              <Button variant="secondary" onClick={() => setEdit(null)}>ביטול</Button>
            </div>
            <p className="text-xs text-slate-500">כל תיקון נשמר ביומן ביקורת עם הערך הקודם, הסיבה ומי ביצע אותו.</p>
          </div>
        </Card>
      )}

      <Card>
        <ErrorText>{rows.error}</ErrorText>
        {!rows.data ? <p className="text-slate-500">טוען…</p> : rows.data.length === 0 ? <Empty>אין רשומות נוכחות בטווח הזה</Empty> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="text-xs text-slate-500">
                <tr className="border-b border-stone-200">
                  <th className="py-2 text-start font-medium">עובד</th><th className="py-2 text-start font-medium">תאריך</th>
                  <th className="py-2 text-start font-medium">כניסה</th><th className="py-2 text-start font-medium">יציאה</th>
                  <th className="py-2 text-start font-medium">שעות</th><th className="py-2 text-start font-medium">מקור</th><th />
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {rows.data.map((r) => (
                  <tr key={r.id}>
                    <td className="py-2.5 font-medium">{r.full_name}</td>
                    <td className="py-2.5">{fmtDate(r.check_in_at)}</td>
                    <td className="py-2.5 tabular-nums">{fmtTime(r.check_in_at)}</td>
                    <td className="py-2.5 tabular-nums">{r.check_out_at ? fmtTime(r.check_out_at) : <Badge tone="green">באתר</Badge>}</td>
                    <td className="py-2.5 tabular-nums">{fmtHours(r.hours)}</td>
                    <td className="py-2.5">
                      {r.source === 'manual'
                        ? <span title={r.edits.map((e) => e.reason).join('\n')}><Badge tone="blue">תוקן ע״י מנהל ({r.edits.length})</Badge></span>
                        : <Badge>אפליקציה</Badge>}
                    </td>
                    <td className="py-2.5 text-end">
                      <Button variant="ghost" className="px-2 text-xs" onClick={() => {
                        setError('');
                        setEdit({ id: r.id, name: r.full_name, in: toLocalInput(r.check_in_at), out: toLocalInput(r.check_out_at), reason: '' });
                      }}>תיקון</Button>
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
