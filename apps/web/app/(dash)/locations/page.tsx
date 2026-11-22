'use client';
import { useMemo, useState } from 'react';
import type { LocationKind } from '@constructa/shared';
import { useDash } from '@/components/project-context';
import { Button, Card, Empty, ErrorText, Input, Select } from '@/components/ui';
import { errorMessage, rpc } from '@/lib/api';
import { useLoad } from '@/lib/hooks';
import { CHILD_KIND, KIND_LABEL, locationOptions } from '@/lib/locations';

export default function LocationsPage() {
  const { project } = useDash();
  const pid = project!.id;
  const locs = useLoad(() => rpc('listLocations', pid), [pid]);
  const progress = useLoad(() => rpc('dashboard', pid).then((d) => d.progress), [pid]);
  const rows = useMemo(() => locationOptions(locs.data ?? []), [locs.data]);
  const [error, setError] = useState('');
  const [adding, setAdding] = useState<{ parent: string | null; kind: LocationKind; name: string } | null>(null);

  const act = async (fn: () => Promise<unknown>) => {
    setError('');
    try { await fn(); await Promise.all([locs.reload(), progress.reload()]); } catch (e) { setError(errorMessage(e)); }
  };
  const pct = (id: string) => progress.data?.find((p) => p.id === id);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">מבנה הפרויקט</h1>
          <p className="text-sm text-slate-500">בניין ← קומה ← דירה ← חדר. לכל משימה משויך מיקום מהעץ הזה.</p>
        </div>
        <Button onClick={() => setAdding({ parent: null, kind: 'building', name: '' })}>+ בניין</Button>
      </div>
      <ErrorText>{error}</ErrorText>

      {adding && (
        <Card title={`הוספת ${KIND_LABEL[adding.kind]}`}>
          <form className="flex flex-wrap gap-2" onSubmit={(e) => {
            e.preventDefault();
            act(() => rpc('addLocation', pid, adding.parent, adding.kind, adding.name)).then(() => setAdding(null));
          }}>
            <Select value={adding.kind} onChange={(e) => setAdding({ ...adding, kind: e.target.value as LocationKind })}>
              {(Object.keys(KIND_LABEL) as LocationKind[]).map((k) => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}
            </Select>
            <Input autoFocus placeholder="שם (למשל: קומה 4)" value={adding.name} onChange={(e) => setAdding({ ...adding, name: e.target.value })} className="min-w-0 flex-1" />
            <Button type="submit">הוספה</Button>
            <Button type="button" variant="secondary" onClick={() => setAdding(null)}>ביטול</Button>
          </form>
        </Card>
      )}

      <Card>
        {!locs.data ? <p className="text-slate-500">טוען…</p> : rows.length === 0 ? <Empty>אין עדיין מיקומים. התחל בהוספת בניין.</Empty> : (
          <ul className="divide-y divide-stone-100">
            {rows.map(({ id, loc, depth }) => {
              const p = pct(id);
              const child = CHILD_KIND[loc.kind];
              return (
                <li key={id} className="flex flex-wrap items-center gap-2 py-2" style={{ paddingInlineStart: depth * 24 }}>
                  <span className="rounded bg-stone-100 px-1.5 py-0.5 text-[11px] text-stone-600">{KIND_LABEL[loc.kind]}</span>
                  <span className="font-medium">{loc.name}</span>
                  {p && p.total_tasks > 0 && <span className="text-xs text-slate-500">{p.percent_done}% ({p.done_tasks}/{p.total_tasks})</span>}
                  <span className="ms-auto flex flex-wrap gap-1">
                    {child && (
                      <Button variant="ghost" className="px-2 py-1 text-xs"
                        onClick={() => setAdding({ parent: id, kind: child, name: '' })}>+ {KIND_LABEL[child]}</Button>
                    )}
                    {(loc.kind === 'floor' || loc.kind === 'unit') && (
                      <Button variant="ghost" className="px-2 py-1 text-xs" onClick={() => {
                        const name = prompt('שם לעותק (כולל כל מה שבתוכו):', `${loc.name} (עותק)`);
                        if (name) act(() => rpc('duplicateLocation', id, name));
                      }}>שכפול</Button>
                    )}
                    <Button variant="ghost" className="px-2 py-1 text-xs" onClick={() => {
                      const name = prompt('שם חדש:', loc.name);
                      if (name) act(() => rpc('renameLocation', id, name));
                    }}>שינוי שם</Button>
                    <Button variant="ghost" className="px-2 py-1 text-xs text-red-700" onClick={() => {
                      if (confirm(`למחוק את "${loc.name}" וכל מה שבתוכו? משימות במיקומים אלה יישארו ללא מיקום.`)) act(() => rpc('deleteLocation', id));
                    }}>מחיקה</Button>
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
