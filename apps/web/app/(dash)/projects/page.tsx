'use client';
import { useState } from 'react';
import type { MProject } from '@constructa/shared';
import { useDash } from '@/components/project-context';
import { SiteMap } from '@/components/site-map';
import { Badge, Button, Card, ErrorText, Field, Input } from '@/components/ui';
import { errorMessage, rpc } from '@/lib/api';

type Draft = { id?: string; name: string; address: string; lat: string; lng: string; radius_m: number };
const fromProject = (p: MProject): Draft => ({ id: p.id, name: p.name, address: p.address ?? '', lat: String(p.lat), lng: String(p.lng), radius_m: p.radius_m });

/** Valid coordinates typed in the draft, or null while empty/invalid. */
function draftPoint(d: Draft) {
  if (d.lat.trim() === '' || d.lng.trim() === '') return null;
  const lat = Number(d.lat), lng = Number(d.lng);
  return Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 ? { lat, lng } : null;
}
const ISRAEL_CENTER = { lat: 32.08, lng: 34.78 }; // first view when there are no projects yet

export default function ProjectsPage() {
  const { projects, reloadProjects, setProjectId } = useDash();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState('');

  async function save() {
    if (!draft) return;
    setError('');
    try {
      const p = await rpc('saveProject', { id: draft.id, name: draft.name, address: draft.address || null,
        lat: Number(draft.lat), lng: Number(draft.lng), radius_m: draft.radius_m });
      await reloadProjects();
      setProjectId(p.id);
      setDraft(null);
    } catch (e) { setError(errorMessage(e)); }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">פרויקטים</h1>
        <Button onClick={() => { setError(''); setDraft({ name: '', address: '', lat: '', lng: '', radius_m: 150 }); }}>+ פרויקט חדש</Button>
      </div>

      {draft && (
        <Card title={draft.id ? 'עריכת פרויקט' : 'פרויקט חדש'}>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="שם הפרויקט"><Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} /></Field>
            <Field label="כתובת"><Input value={draft.address} onChange={(e) => setDraft({ ...draft, address: e.target.value })} /></Field>
            <Field label="קו רוחב (lat)"><Input dir="ltr" inputMode="decimal" value={draft.lat} onChange={(e) => setDraft({ ...draft, lat: e.target.value })} /></Field>
            <Field label="קו אורך (lng)"><Input dir="ltr" inputMode="decimal" value={draft.lng} onChange={(e) => setDraft({ ...draft, lng: e.target.value })} /></Field>
            <Field label={`רדיוס דיווח נוכחות: ${draft.radius_m} מ׳`} hint="עובד יכול לבצע כניסה רק בתוך הרדיוס הזה ממרכז האתר">
              <input type="range" min={20} max={1000} step={10} value={draft.radius_m}
                onChange={(e) => setDraft({ ...draft, radius_m: Number(e.target.value) })} className="accent-amber-500" />
            </Field>
            <div className="flex items-end">
              <Button variant="secondary" onClick={() => {
                navigator.geolocation?.getCurrentPosition(
                  (pos) => setDraft((d) => d && { ...d, lat: pos.coords.latitude.toFixed(6), lng: pos.coords.longitude.toFixed(6) }),
                  () => setError('לא ניתן לקבל מיקום מהדפדפן'));
              }}>📍 המיקום הנוכחי שלי</Button>
            </div>
          </div>
          <div className="mt-4 space-y-2">
            <p className="text-sm text-slate-600">
              {draftPoint(draft)
                ? 'העיגול הכתום הוא אזור הנוכחות. לחיצה על המפה מזיזה את מרכז האתר.'
                : 'לחצו על המפה כדי לסמן את מרכז האתר.'}
            </p>
            <SiteMap
              {...(draftPoint(draft) ?? (projects[0] ? { lat: projects[0].lat, lng: projects[0].lng } : ISRAEL_CENTER))}
              radius={draft.radius_m}
              showSite={draftPoint(draft) !== null}
              onPick={(lat, lng) => setDraft((d) => d && { ...d, lat: lat.toFixed(6), lng: lng.toFixed(6) })}
            />
          </div>
          <div className="mt-4 space-y-3">
            <ErrorText>{error}</ErrorText>
            <div className="flex gap-2">
              <Button onClick={save}>שמירה</Button>
              <Button variant="secondary" onClick={() => setDraft(null)}>ביטול</Button>
            </div>
          </div>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {projects.map((p) => (
          <Card key={p.id} title={p.name} action={<Badge tone={p.status === 'active' ? 'green' : 'stone'}>{p.status === 'active' ? 'פעיל' : 'בארכיון'}</Badge>}>
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
              <dt className="text-slate-500">כתובת</dt><dd>{p.address ?? '—'}</dd>
              <dt className="text-slate-500">מרכז</dt><dd dir="ltr" className="text-end">{p.lat.toFixed(5)}, {p.lng.toFixed(5)}</dd>
              <dt className="text-slate-500">רדיוס</dt><dd>{p.radius_m} מ׳</dd>
            </dl>
            <div className="mt-3">
              <SiteMap lat={p.lat} lng={p.lng} radius={p.radius_m} height={180} readOnly />
            </div>
            <div className="mt-4 flex gap-2">
              <Button variant="secondary" onClick={() => { setError(''); setDraft(fromProject(p)); }}>עריכה</Button>
              <Button variant="ghost" onClick={() => setProjectId(p.id)}>בחר כפרויקט פעיל</Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
