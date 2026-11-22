'use client';
import { useMemo, useState } from 'react';
import { useDash } from '@/components/project-context';
import { Card, Empty, ErrorText, Field, Input, Select } from '@/components/ui';
import { fmtDate, fmtTime, photoUrl, rpc } from '@/lib/api';
import { useLoad } from '@/lib/hooks';
import { locationOptions } from '@/lib/locations';

export default function GalleryPage() {
  const { project } = useDash();
  const pid = project!.id;
  const [f, setF] = useState({ locationId: '', workerId: '', date: '' });
  const photos = useLoad(() => rpc('gallery', pid, {
    locationId: f.locationId || undefined, workerId: f.workerId || undefined, date: f.date || undefined,
  }), [pid, f.locationId, f.workerId, f.date], 10000);
  const locs = useLoad(() => rpc('listLocations', pid), [pid]);
  const people = useLoad(() => rpc('listWorkers'), []);
  const options = useMemo(() => locationOptions(locs.data ?? []).filter((o) => o.depth <= 2), [locs.data]);
  const [open, setOpen] = useState<string | null>(null);
  const current = photos.data?.find((p) => p.id === open);

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold">גלריית תיעוד</h1>
      <Card>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="מיקום">
            <Select value={f.locationId} onChange={(e) => setF({ ...f, locationId: e.target.value })}>
              <option value="">הכל</option>
              {options.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
            </Select>
          </Field>
          <Field label="עובד">
            <Select value={f.workerId} onChange={(e) => setF({ ...f, workerId: e.target.value })}>
              <option value="">כולם</option>
              {people.data?.workers.filter((w) => w.role === 'worker').map((w) => <option key={w.id} value={w.id}>{w.full_name}</option>)}
            </Select>
          </Field>
          <Field label="תאריך"><Input type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></Field>
        </div>
      </Card>
      <ErrorText>{photos.error}</ErrorText>
      {!photos.data ? <p className="text-slate-500">טוען…</p> : photos.data.length === 0 ? <Card><Empty>אין תמונות לסינון הזה</Empty></Card> : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {photos.data.map((p) => (
            <button key={p.id} onClick={() => setOpen(p.id)} className="overflow-hidden rounded-xl border border-stone-200 bg-white text-start shadow-sm hover:ring-2 hover:ring-amber-400">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photoUrl(p.storage_path)} alt={p.task_title} className="aspect-[4/3] w-full bg-stone-200 object-cover" />
              <div className="p-2.5 text-xs">
                <div className="truncate font-semibold">{p.task_title}</div>
                <div className="truncate text-slate-500">{p.location_path.join(' ← ')}</div>
                <div className="text-slate-500">{p.uploaded_by_name} · {fmtDate(p.taken_at)} {fmtTime(p.taken_at)}</div>
              </div>
            </button>
          ))}
        </div>
      )}
      {current && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={() => setOpen(null)} role="dialog">
          <div className="max-h-full w-full max-w-3xl overflow-auto rounded-xl bg-white" onClick={(e) => e.stopPropagation()}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photoUrl(current.storage_path)} alt={current.task_title} className="max-h-[70vh] w-full bg-stone-900 object-contain" />
            <div className="flex items-start justify-between gap-3 p-4">
              <div>
                <div className="font-bold">{current.task_title}</div>
                <div className="text-sm text-slate-600">{current.location_path.join(' ← ')}</div>
                <div className="text-sm text-slate-500">צולם ע״י {current.uploaded_by_name} · {fmtDate(current.taken_at)} {fmtTime(current.taken_at)}</div>
              </div>
              <button className="rounded px-3 py-1 text-slate-500 hover:bg-stone-100" onClick={() => setOpen(null)}>סגירה</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
