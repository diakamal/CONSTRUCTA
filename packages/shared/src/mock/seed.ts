// Demo data. Same organization, people and building as supabase/seed.sql, plus
// a little history (yesterday's shifts, a few finished tasks) so the dashboard has something to show.
// TEST DATA ONLY. Manager: manager@constructa.test / Test1234!  Workers: OTP 123456.
import { dateKey, type MockState, type MLocation, type MTask } from './store';

export const DEMO_IDS = {
  org: 'org-demo',
  manager: 'u-manager',
  ahmad: 'u-ahmad',
  somchai: 'u-somchai',
  team: 'team-plumbing',
  project: 'prj-sea-towers',
} as const;

export const DEMO_SITE = { lat: 32.0853, lng: 34.7818 }; // Tel Aviv

export function createSeed(now: Date = new Date()): MockState {
  const today = dateKey(now);
  const yesterdayDate = new Date(now.getTime() - 86_400_000);
  const yesterday = dateKey(yesterdayDate);
  const at = (d: Date, h: number, m = 0) => {
    // h:m Israel time on the given day (approximation good enough for demo data: UTC+2/+3)
    const x = new Date(`${dateKey(d)}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00+02:00`);
    return x.toISOString();
  };
  const { org, manager, ahmad, somchai, team, project } = DEMO_IDS;

  const locations: MLocation[] = [{ id: 'loc-bA', project_id: project, parent_id: null, kind: 'building', name: 'בניין A', sort: 1 }];
  const rooms: { id: string; unit: string }[] = [];
  for (let f = 1; f <= 3; f++) {
    locations.push({ id: `loc-f${f}`, project_id: project, parent_id: 'loc-bA', kind: 'floor', name: `קומה ${f}`, sort: f });
    for (let u = 1; u <= 2; u++) {
      const unit = `דירה ${f * 10 + u}`;
      locations.push({ id: `loc-u${f}${u}`, project_id: project, parent_id: `loc-f${f}`, kind: 'unit', name: unit, sort: u });
      locations.push({ id: `loc-r${f}${u}`, project_id: project, parent_id: `loc-u${f}${u}`, kind: 'room', name: 'חדר רחצה', sort: 1 });
      rooms.push({ id: `loc-r${f}${u}`, unit });
    }
  }

  const base = { project_id: project, video_url: null, completed_at: null, completed_by: null, created_at: now.toISOString() };
  const tasks: MTask[] = [
    ...rooms.map((r, i): MTask => ({
      ...base, id: `t-drain-${i}`, location_id: r.id, title: `התקנת ניקוז מקלחת – ${r.unit}`,
      instructions: 'לוודא שיפוע 2% לכיוון הניקוז. לצלם את הניקוז לפני סגירת הריצוף.',
      assignee_id: null, team_id: team, scheduled_date: today, status: 'open',
    })),
    ...[1, 2, 3].map((f): MTask => ({
      ...base, id: `t-clean-${f}`, location_id: `loc-f${f}`, title: `ניקוי ופינוי פסולת – קומה ${f}`,
      instructions: 'לפנות פסולת למכולה בחניה. להשאיר מעבר פנוי במדרגות.',
      assignee_id: somchai, team_id: null, scheduled_date: today, status: 'open',
    })),
    // Yesterday: two finished tasks with photos (floor 1), one left open → shows as overdue
    { ...base, id: 't-y-1', location_id: 'loc-u11', title: 'סימון נקודות חשמל – דירה 11', instructions: 'לפי תוכנית חשמל גיליון E-01.',
      assignee_id: ahmad, team_id: null, scheduled_date: yesterday, status: 'done',
      completed_at: at(yesterdayDate, 11, 20), completed_by: ahmad },
    { ...base, id: 't-y-2', location_id: 'loc-u12', title: 'סימון נקודות חשמל – דירה 12', instructions: 'לפי תוכנית חשמל גיליון E-01.',
      assignee_id: ahmad, team_id: null, scheduled_date: yesterday, status: 'done',
      completed_at: at(yesterdayDate, 14, 5), completed_by: ahmad },
    { ...base, id: 't-y-3', location_id: 'loc-f2', title: 'הובלת בלוקים לקומה 2', instructions: 'עם המנוף, עד 10:00.',
      assignee_id: somchai, team_id: null, scheduled_date: yesterday, status: 'open' },
  ];

  return {
    version: 1,
    organizations: [{ id: org, name: 'קבלן דמו בע"מ' }],
    teams: [{ id: team, org_id: org, name: 'צוות אינסטלציה', subcontractor_name: 'אינסטלציה כהן' }],
    profiles: [
      { id: manager, org_id: org, role: 'manager', full_name: 'יוסי מנהל עבודה', phone: null,
        email: 'manager@constructa.test', password: 'Test1234!', language: 'he', team_id: null },
      { id: ahmad, org_id: org, role: 'worker', full_name: 'אחמד', phone: '972500000001',
        email: null, password: null, language: 'ar', team_id: team },
      { id: somchai, org_id: org, role: 'worker', full_name: 'Somchai', phone: '972500000002',
        email: null, password: null, language: 'th', team_id: null },
    ],
    invitations: [
      // Not signed in yet: demonstrates the invitation flow (sign in with this number + 123456)
      { id: 'inv-david', org_id: org, phone: '972500000003', full_name: 'דוד', role: 'worker', language: 'he',
        team_id: team, project_ids: [project], accepted_at: null, created_at: now.toISOString() },
    ],
    projects: [{ id: project, org_id: org, name: 'מגדלי הים – בניין A', address: 'רחוב הדוגמה 1, תל אביב',
      ...DEMO_SITE, radius_m: 150, status: 'active' }],
    project_members: [manager, ahmad, somchai].map((profile_id) => ({ project_id: project, profile_id })),
    locations,
    tasks,
    task_photos: [
      { id: 'ph-1', task_id: 't-y-1', storage_path: `${org}/t-y-1/demo-1.jpg`, taken_at: at(yesterdayDate, 11, 20), uploaded_by: ahmad },
      { id: 'ph-2', task_id: 't-y-2', storage_path: `${org}/t-y-2/demo-2.jpg`, taken_at: at(yesterdayDate, 14, 5), uploaded_by: ahmad },
    ],
    attendance: [
      { id: 'att-y-a', profile_id: ahmad, project_id: project, check_in_at: at(yesterdayDate, 7, 2), check_in_lat: 32.0855,
        check_in_lng: 34.7816, check_in_accuracy: 12, check_out_at: at(yesterdayDate, 16, 10), check_out_lat: 32.0854,
        check_out_lng: 34.7819, source: 'app' },
      { id: 'att-y-s', profile_id: somchai, project_id: project, check_in_at: at(yesterdayDate, 7, 15), check_in_lat: 32.0851,
        check_in_lng: 34.7820, check_in_accuracy: 20, check_out_at: at(yesterdayDate, 15, 45), check_out_lat: 32.0852,
        check_out_lng: 34.7817, source: 'app' },
    ],
    attendance_edits: [],
    objects: [
      { path: `${org}/t-y-1/demo-1.jpg`, owner: ahmad, created_at: at(yesterdayDate, 11, 20) },
      { path: `${org}/t-y-2/demo-2.jpg`, owner: ahmad, created_at: at(yesterdayDate, 14, 5) },
    ],
  };
}
