'use client';
import { useState } from 'react';
import type { Language } from '@constructa/shared';
import { useDash } from '@/components/project-context';
import { Badge, Button, Card, Empty, ErrorText, Field, Input, Select } from '@/components/ui';
import { errorMessage, rpc } from '@/lib/api';
import { useLoad } from '@/lib/hooks';

const LANG: Record<Language, string> = { he: 'עברית', ar: 'ערבית', th: 'תאילנדית', en: 'אנגלית' };
const ROLE = { owner: 'בעלים', manager: 'מנהל', worker: 'עובד' } as const;

export default function WorkersPage() {
  const { project, projects } = useDash();
  const data = useLoad(() => rpc('listWorkers'), []);
  const [form, setForm] = useState({ full_name: '', phone: '', language: 'he' as Language, team_id: '', project_ids: [project!.id] });
  const [team, setTeam] = useState({ name: '', sub: '' });
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');

  const teamName = (id: string | null) => data.data?.teams.find((t) => t.id === id)?.name ?? '—';

  async function invite(e: React.FormEvent) {
    e.preventDefault();
    setError(''); setOk('');
    try {
      const inv = await rpc('inviteWorker', { ...form, team_id: form.team_id || null });
      setOk(`${inv.full_name} הוזמן. כשיתחבר באפליקציה עם המספר ${inv.phone} הוא יצורף אוטומטית.`);
      setForm({ ...form, full_name: '', phone: '' });
      data.reload();
    } catch (err) { setError(errorMessage(err)); }
  }

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold">עובדים וצוותים</h1>

      <div className="grid gap-5 lg:grid-cols-3">
        <Card title="הזמנת עובד" className="lg:col-span-2">
          <form onSubmit={invite} className="grid gap-3 sm:grid-cols-2">
            <Field label="שם מלא"><Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} required /></Field>
            <Field label="טלפון" hint="העובד מתחבר עם קוד SMS למספר הזה">
              <Input dir="ltr" placeholder="+972 50 000 0000" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} required />
            </Field>
            <Field label="שפת הממשק">
              <Select value={form.language} onChange={(e) => setForm({ ...form, language: e.target.value as Language })}>
                {(['he', 'ar', 'th'] as Language[]).map((l) => <option key={l} value={l}>{LANG[l]}</option>)}
              </Select>
            </Field>
            <Field label="צוות">
              <Select value={form.team_id} onChange={(e) => setForm({ ...form, team_id: e.target.value })}>
                <option value="">ללא צוות</option>
                {data.data?.teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </Select>
            </Field>
            <Field label="פרויקטים">
              <div className="space-y-1 rounded-lg border border-stone-200 p-2 text-sm">
                {projects.map((p) => (
                  <label key={p.id} className="flex items-center gap-2">
                    <input type="checkbox" checked={form.project_ids.includes(p.id)} onChange={(e) => setForm({
                      ...form, project_ids: e.target.checked ? [...form.project_ids, p.id] : form.project_ids.filter((x) => x !== p.id),
                    })} />{p.name}
                  </label>
                ))}
              </div>
            </Field>
            <div className="flex flex-col justify-end gap-2 sm:col-span-2">
              <ErrorText>{error}</ErrorText>
              {ok && <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{ok}</p>}
              <Button type="submit" className="self-start">שליחת הזמנה</Button>
            </div>
          </form>
        </Card>

        <Card title="צוות חדש">
          <form className="space-y-3" onSubmit={async (e) => {
            e.preventDefault();
            try { await rpc('saveTeam', team.name, team.sub || null); setTeam({ name: '', sub: '' }); data.reload(); }
            catch (err) { setError(errorMessage(err)); }
          }}>
            <Field label="שם הצוות"><Input value={team.name} onChange={(e) => setTeam({ ...team, name: e.target.value })} required /></Field>
            <Field label="קבלן משנה (אופציונלי)"><Input value={team.sub} onChange={(e) => setTeam({ ...team, sub: e.target.value })} /></Field>
            <Button type="submit" variant="secondary">הוספת צוות</Button>
          </form>
          {data.data && data.data.teams.length > 0 && (
            <ul className="mt-4 space-y-1 border-t border-stone-100 pt-3 text-sm">
              {data.data.teams.map((t) => <li key={t.id}><b>{t.name}</b>{t.subcontractor_name && <span className="text-slate-500"> · {t.subcontractor_name}</span>}</li>)}
            </ul>
          )}
        </Card>
      </div>

      <Card title="אנשים בארגון">
        {!data.data ? <p className="text-slate-500">טוען…</p> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead className="text-xs text-slate-500">
                <tr className="border-b border-stone-200">
                  <th className="py-2 text-start font-medium">שם</th><th className="py-2 text-start font-medium">תפקיד</th>
                  <th className="py-2 text-start font-medium">צוות</th><th className="py-2 text-start font-medium">שפה</th>
                  <th className="py-2 text-start font-medium">טלפון</th><th className="py-2 text-start font-medium">סטטוס</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {data.data.workers.map((w) => (
                  <tr key={w.id}>
                    <td className="py-2.5 font-medium">{w.full_name}</td>
                    <td className="py-2.5">{ROLE[w.role]}</td>
                    <td className="py-2.5">{teamName(w.team_id)}</td>
                    <td className="py-2.5">{LANG[w.language]}</td>
                    <td className="py-2.5" dir="ltr">{w.phone ? `+${w.phone}` : w.email}</td>
                    <td className="py-2.5">{w.on_site ? <Badge tone="green">באתר</Badge> : <Badge>לא באתר</Badge>}</td>
                  </tr>
                ))}
                {data.data.invitations.map((i) => (
                  <tr key={i.id} className="text-slate-500">
                    <td className="py-2.5">{i.full_name}</td><td className="py-2.5">{ROLE[i.role]}</td>
                    <td className="py-2.5">{teamName(i.team_id)}</td><td className="py-2.5">{LANG[i.language]}</td>
                    <td className="py-2.5" dir="ltr">+{i.phone}</td><td className="py-2.5"><Badge tone="blue">הוזמן, טרם התחבר</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {data.data.workers.length === 0 && <Empty>אין עובדים</Empty>}
          </div>
        )}
      </Card>
    </div>
  );
}
