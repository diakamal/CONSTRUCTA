'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import type { MProject, PublicProfile } from '@constructa/shared';
import { ProjectCtx } from '@/components/project-context';
import { Button, Select } from '@/components/ui';
import { getSession, rpc, setSession } from '@/lib/api';

const NAV = [
  { href: '/dashboard', label: 'דשבורד חי' },
  { href: '/tasks', label: 'משימות' },
  { href: '/locations', label: 'מבנה הפרויקט' },
  { href: '/workers', label: 'עובדים וצוותים' },
  { href: '/gallery', label: 'גלריית תיעוד' },
  { href: '/attendance', label: 'נוכחות' },
  { href: '/projects', label: 'פרויקטים' },
];
const PROJECT_KEY = 'constructa.web.project';

export default function DashLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [me, setMe] = useState<PublicProfile | null>(null);
  const [projects, setProjects] = useState<MProject[]>([]);
  const [projectId, setProjectIdState] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  const reloadProjects = useCallback(async () => {
    const list = await rpc('listProjects');
    setProjects(list);
    setProjectIdState((cur) => {
      let saved: string | null = null;
      try { saved = localStorage.getItem(PROJECT_KEY); } catch {}
      const want = cur ?? saved;
      return list.some((p) => p.id === want) ? want : list[0]?.id ?? null;
    });
  }, []);

  useEffect(() => {
    const s = getSession();
    if (!s) { router.replace('/login'); return; }
    setMe(s);
    reloadProjects().catch(() => { setSession(null); router.replace('/login'); });
  }, [router, reloadProjects]);

  useEffect(() => setMenuOpen(false), [pathname]);

  const setProjectId = (id: string) => {
    setProjectIdState(id);
    try { localStorage.setItem(PROJECT_KEY, id); } catch {}
  };

  if (!me) return <div className="p-10 text-center text-slate-500">טוען…</div>;
  const project = projects.find((p) => p.id === projectId) ?? null;

  return (
    <ProjectCtx.Provider value={{ me, projects, project, setProjectId, reloadProjects }}>
      <div className="flex min-h-full flex-1 flex-col md:flex-row">
        <aside className="bg-slate-900 text-stone-100 md:w-60 md:shrink-0">
          <div className="flex items-center justify-between px-5 py-4">
            <div>
              <div className="text-lg font-extrabold tracking-[0.2em] text-amber-400">CONSTRUCTA</div>
              <div className="text-xs text-stone-400">{me.full_name}</div>
            </div>
            <button className="rounded p-2 md:hidden" onClick={() => setMenuOpen((v) => !v)} aria-label="תפריט">☰</button>
          </div>
          <nav className={`${menuOpen ? 'block' : 'hidden'} px-3 pb-4 md:block`}>
            {NAV.map((n) => (
              <Link key={n.href} href={n.href}
                className={`block rounded-lg px-3 py-2 text-sm ${pathname.startsWith(n.href) ? 'bg-amber-500 font-semibold text-slate-950' : 'text-stone-300 hover:bg-slate-800'}`}>
                {n.label}
              </Link>
            ))}
            <button
              className="mt-4 block w-full rounded-lg px-3 py-2 text-start text-sm text-stone-400 hover:bg-slate-800"
              onClick={() => { setSession(null); router.replace('/login'); }}>
              התנתקות
            </button>
          </nav>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex flex-wrap items-center gap-3 border-b border-stone-200 bg-white px-4 py-3 md:px-6">
            <span className="text-sm text-slate-500">פרויקט:</span>
            <Select value={projectId ?? ''} onChange={(e) => setProjectId(e.target.value)} className="min-w-0 max-w-xs flex-1">
              {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </Select>
            <div className="ms-auto flex items-center gap-2">
              <span className="hidden rounded bg-amber-100 px-2 py-1 text-xs text-amber-900 sm:inline">מצב דמו – ללא מסד נתונים</span>
              <Button variant="ghost" className="text-xs" title="מחזיר את נתוני הדמו למצב ההתחלתי"
                onClick={async () => {
                  if (!confirm('לאפס את כל נתוני הדמו? כל השינויים יימחקו.')) return;
                  await fetch('/api/mock/reset', { method: 'POST' });
                  location.reload();
                }}>
                איפוס דמו
              </Button>
            </div>
          </header>
          <main className="flex-1 p-4 md:p-6">
            {project || pathname.startsWith('/projects') ? children : (
              <div className="text-slate-500">אין פרויקטים עדיין. <Link className="text-amber-700 underline" href="/projects">צור פרויקט</Link></div>
            )}
          </main>
        </div>
      </div>
    </ProjectCtx.Provider>
  );
}
