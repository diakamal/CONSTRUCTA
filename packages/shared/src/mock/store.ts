// In-memory backend used while there is no database.
// Every rule here mirrors supabase/migrations/*_rpc.sql and *_rls.sql, and the
// error codes are identical, so the apps behave the same when we switch to Supabase.
import { distanceMeters } from '../geo';
import type { Language, LocationKind, Role, TaskStatus } from '../types';

// ---------- State ----------
export interface MProfile {
  id: string; org_id: string; role: Role; full_name: string;
  phone: string | null; email: string | null; password: string | null;
  language: Language; team_id: string | null;
}
export interface MTeam { id: string; org_id: string; name: string; subcontractor_name: string | null }
export interface MInvitation {
  id: string; org_id: string; phone: string; full_name: string; role: Role; language: Language;
  team_id: string | null; project_ids: string[]; accepted_at: string | null; created_at: string;
}
export interface MProject {
  id: string; org_id: string; name: string; address: string | null;
  lat: number; lng: number; radius_m: number; status: 'active' | 'archived';
}
export interface MLocation {
  id: string; project_id: string; parent_id: string | null; kind: LocationKind; name: string; sort: number;
}
export interface MTask {
  id: string; project_id: string; location_id: string | null; title: string; instructions: string | null;
  video_url: string | null; assignee_id: string | null; team_id: string | null; scheduled_date: string;
  status: TaskStatus; completed_at: string | null; completed_by: string | null; created_at: string;
}
export interface MPhoto { id: string; task_id: string; storage_path: string; taken_at: string; uploaded_by: string }
export interface MAttendance {
  id: string; profile_id: string; project_id: string;
  check_in_at: string; check_in_lat: number | null; check_in_lng: number | null; check_in_accuracy: number | null;
  check_out_at: string | null; check_out_lat: number | null; check_out_lng: number | null;
  source: 'app' | 'manual';
}
export interface MAttendanceEdit {
  id: string; attendance_id: string; old_check_in: string; old_check_out: string | null;
  new_check_in: string; new_check_out: string | null; reason: string; edited_by: string; edited_at: string;
}
/** Uploaded but not yet attached photos ("storage.objects"). */
export interface MObject { path: string; owner: string; created_at: string }

export interface MockState {
  version: 1;
  organizations: { id: string; name: string }[];
  teams: MTeam[];
  profiles: MProfile[];
  invitations: MInvitation[];
  projects: MProject[];
  project_members: { project_id: string; profile_id: string }[];
  locations: MLocation[];
  tasks: MTask[];
  task_photos: MPhoto[];
  attendance: MAttendance[];
  attendance_edits: MAttendanceEdit[];
  objects: MObject[];
}

// ---------- Errors ----------
export class AppError extends Error {
  constructor(public code: string, public detail?: string) { super(code); }
}
const fail = (code: string, detail?: string): never => { throw new AppError(code, detail); };

// ---------- Helpers ----------
export const TZ = 'Asia/Jerusalem';
export const dateKey = (d: Date = new Date()) => d.toLocaleDateString('en-CA', { timeZone: TZ });
export const normalizePhone = (p: string) => p.replace(/\D/g, '');
const uid = () =>
  (globalThis.crypto?.randomUUID?.() ?? 'id-' + Math.random().toString(36).slice(2) + Date.now().toString(36));
const hoursBetween = (a: string, b: string | null, now: Date) =>
  ((b ? new Date(b) : now).getTime() - new Date(a).getTime()) / 3_600_000;

export const DEMO_OTP = '123456';
export const GPS_SLACK_CAP_M = 50;

export type PublicProfile = Omit<MProfile, 'password'>;
const publicProfile = ({ password: _p, ...rest }: MProfile): PublicProfile => rest;

export interface TaskView extends MTask {
  location_path: string[];       // ["בניין A", "קומה 3", "דירה 32", "חדר רחצה"]
  photos: MPhoto[];
  completed_by_name: string | null;
  overdue: boolean;
}

export interface LocationProgress extends MLocation {
  total_tasks: number; done_tasks: number; percent_done: number;
}

// ---------- Store ----------
export class MockStore {
  constructor(public state: MockState, private now: () => Date = () => new Date()) {}

  // ----- access helpers (mirror RLS) -----
  private profile(userId: string | null | undefined): MProfile {
    const p = this.state.profiles.find((x) => x.id === userId);
    return p ?? fail('not_authenticated');
  }
  private manager(userId: string | null | undefined): MProfile {
    const p = this.profile(userId);
    return p.role === 'worker' ? fail('forbidden') : p;
  }
  private isMember(projectId: string, userId: string) {
    return this.state.project_members.some((m) => m.project_id === projectId && m.profile_id === userId);
  }
  private orgProject(user: MProfile, projectId: string): MProject {
    const prj = this.state.projects.find((p) => p.id === projectId);
    if (!prj || prj.org_id !== user.org_id) fail('project_not_found');
    if (user.role === 'worker' && !this.isMember(projectId, user.id)) fail('project_not_found');
    return prj!;
  }
  private canSeeTask(user: MProfile, t: MTask) {
    const prj = this.state.projects.find((p) => p.id === t.project_id);
    if (!prj || prj.org_id !== user.org_id) return false;
    if (user.role !== 'worker') return true;
    return this.isMember(t.project_id, user.id) &&
      (t.assignee_id === user.id || (user.team_id !== null && t.team_id === user.team_id));
  }
  private locationPath(id: string | null): string[] {
    const out: string[] = [];
    let cur = this.state.locations.find((l) => l.id === id);
    while (cur) {
      out.unshift(cur.name);
      cur = this.state.locations.find((l) => l.id === cur!.parent_id);
    }
    return out;
  }
  private taskView(t: MTask): TaskView {
    return {
      ...t,
      location_path: this.locationPath(t.location_id),
      photos: this.state.task_photos.filter((p) => p.task_id === t.id),
      completed_by_name: this.state.profiles.find((p) => p.id === t.completed_by)?.full_name ?? null,
      overdue: t.status === 'open' && t.scheduled_date < dateKey(this.now()),
    };
  }
  private subtreeIds(rootId: string): Set<string> {
    const ids = new Set([rootId]);
    let grew = true;
    while (grew) {
      grew = false;
      for (const l of this.state.locations) {
        if (l.parent_id && ids.has(l.parent_id) && !ids.has(l.id)) { ids.add(l.id); grew = true; }
      }
    }
    return ids;
  }

  // ===================== Auth =====================
  loginManager(email: string, password: string): PublicProfile {
    const p = this.state.profiles.find((x) => x.email?.toLowerCase() === email.trim().toLowerCase());
    if (!p || p.password !== password || p.role === 'worker') fail('invalid_credentials');
    return publicProfile(p!);
  }

  /** Mirrors signInWithOtp + the "only invited numbers" rule. */
  requestOtp(phone: string): { sent: true } {
    const n = normalizePhone(phone);
    const known = this.state.profiles.some((p) => p.phone === n) ||
      this.state.invitations.some((i) => i.phone === n && !i.accepted_at);
    if (!known) fail('not_invited');
    return { sent: true };
  }

  /** Mirrors verifyOtp + handle_new_auth_user() trigger. */
  verifyOtp(phone: string, code: string): PublicProfile {
    const n = normalizePhone(phone);
    if (code !== DEMO_OTP) fail('invalid_code');
    const existing = this.state.profiles.find((p) => p.phone === n);
    if (existing) return publicProfile(existing);

    const inv = [...this.state.invitations]
      .filter((i) => i.phone === n && !i.accepted_at)
      .sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
    if (!inv) fail('not_invited');
    const p: MProfile = {
      id: uid(), org_id: inv!.org_id, role: inv!.role, full_name: inv!.full_name, phone: n,
      email: null, password: null, language: inv!.language, team_id: inv!.team_id,
    };
    this.state.profiles.push(p);
    for (const project_id of inv!.project_ids) this.state.project_members.push({ project_id, profile_id: p.id });
    inv!.accepted_at = this.now().toISOString();
    return publicProfile(p);
  }

  me(userId: string): PublicProfile { return publicProfile(this.profile(userId)); }

  setMyLanguage(userId: string, language: Language) {
    this.profile(userId).language = language;
    return { ok: true };
  }

  // ===================== Worker =====================
  myDay(userId: string) {
    const me = this.profile(userId);
    const today = dateKey(this.now());
    const projects = this.state.projects.filter(
      (p) => p.org_id === me.org_id && p.status === 'active' && (me.role !== 'worker' || this.isMember(p.id, me.id)));
    const openShift = this.state.attendance.find((a) => a.profile_id === me.id && !a.check_out_at) ?? null;
    const hoursToday = this.state.attendance
      .filter((a) => a.profile_id === me.id && dateKey(new Date(a.check_in_at)) === today)
      .reduce((sum, a) => sum + hoursBetween(a.check_in_at, a.check_out_at, this.now()), 0);
    // Today's tasks, plus earlier tasks that are still open (shown as overdue).
    const tasks = this.state.tasks
      .filter((t) => (me.role === 'worker' ? this.canSeeTask(me, t) && (t.assignee_id === me.id || t.team_id === me.team_id) : false))
      .filter((t) => t.scheduled_date === today || (t.status === 'open' && t.scheduled_date < today))
      .map((t) => this.taskView(t))
      .sort((a, b) => Number(a.status === 'done') - Number(b.status === 'done') ||
        a.location_path.join('/').localeCompare(b.location_path.join('/'), 'he'));
    return { profile: publicProfile(me), projects, openShift, hoursToday, tasks, today };
  }

  getTask(userId: string, taskId: string): TaskView {
    const me = this.profile(userId);
    const t = this.state.tasks.find((x) => x.id === taskId);
    if (!t || !this.canSeeTask(me, t)) fail('task_not_found');
    return this.taskView(t!);
  }

  checkIn(userId: string, projectId: string, lat: number, lng: number, accuracy?: number | null): MAttendance {
    const me = this.profile(userId);
    const prj = this.state.projects.find((p) => p.id === projectId);
    if (!prj || prj.org_id !== me.org_id) fail('project_not_found');
    if (prj!.status !== 'active') fail('project_inactive');
    if (me.role === 'worker' && !this.isMember(projectId, me.id)) fail('not_project_member');
    if (this.state.attendance.some((a) => a.profile_id === me.id && !a.check_out_at)) fail('already_checked_in');

    const dist = distanceMeters({ lat, lng }, prj!);
    const slack = Math.min(accuracy ?? 0, GPS_SLACK_CAP_M);
    if (dist > prj!.radius_m + slack) fail('outside_geofence', String(Math.round(dist)));

    const rec: MAttendance = {
      id: uid(), profile_id: me.id, project_id: projectId, check_in_at: this.now().toISOString(),
      check_in_lat: lat, check_in_lng: lng, check_in_accuracy: accuracy ?? null,
      check_out_at: null, check_out_lat: null, check_out_lng: null, source: 'app',
    };
    this.state.attendance.push(rec);
    return rec;
  }

  checkOut(userId: string, lat?: number | null, lng?: number | null): MAttendance {
    const me = this.profile(userId);
    const rec = this.state.attendance.find((a) => a.profile_id === me.id && !a.check_out_at);
    if (!rec) fail('not_checked_in');
    rec!.check_out_at = this.now().toISOString();
    rec!.check_out_lat = lat ?? null;
    rec!.check_out_lng = lng ?? null;
    return rec!;
  }

  /** Mirrors a Storage upload to task-photos/{org}/{task}/{file}. Returns the object path. */
  registerUpload(userId: string, taskId: string, ext = 'jpg'): string {
    const me = this.profile(userId);
    const t = this.state.tasks.find((x) => x.id === taskId);
    if (!t || !this.canSeeTask(me, t)) fail('task_not_found');
    const path = `${me.org_id}/${taskId}/${uid()}.${ext}`;
    this.state.objects.push({ path, owner: me.id, created_at: this.now().toISOString() });
    return path;
  }

  completeTask(userId: string, taskId: string, photoPath: string | null): TaskView {
    const me = this.profile(userId);
    const t = this.state.tasks.find((x) => x.id === taskId);
    if (!t) fail('task_not_found');
    const prj = this.state.projects.find((p) => p.id === t!.project_id);
    if (!prj || prj.org_id !== me.org_id) fail('task_not_found');
    if (me.role === 'worker' && !this.canSeeTask(me, t!)) fail('task_not_assigned');
    if (t!.status === 'done') return this.taskView(t!); // idempotent retry

    if (!photoPath || !photoPath.startsWith(`${me.org_id}/${taskId}/`)) fail('photo_required');
    if (!this.state.objects.some((o) => o.path === photoPath && o.owner === me.id)) fail('photo_not_uploaded');

    if (!this.state.task_photos.some((p) => p.storage_path === photoPath)) {
      this.state.task_photos.push({
        id: uid(), task_id: taskId, storage_path: photoPath!, taken_at: this.now().toISOString(), uploaded_by: me.id,
      });
    }
    t!.status = 'done';
    t!.completed_at = this.now().toISOString();
    t!.completed_by = me.id;
    return this.taskView(t!);
  }

  // ===================== Manager: setup =====================
  listProjects(userId: string) {
    const me = this.manager(userId);
    return this.state.projects.filter((p) => p.org_id === me.org_id);
  }

  saveProject(userId: string, input: Partial<MProject> & { name: string; lat: number; lng: number }) {
    const me = this.manager(userId);
    if (!input.name?.trim()) fail('name_required');
    if (!(input.lat >= -90 && input.lat <= 90 && input.lng >= -180 && input.lng <= 180)) fail('invalid_coordinates');
    const radius = Math.round(input.radius_m ?? 150);
    if (radius < 20 || radius > 5000) fail('invalid_radius');
    if (input.id) {
      const prj = this.orgProject(me, input.id);
      Object.assign(prj, {
        name: input.name.trim(), address: input.address ?? null, lat: input.lat, lng: input.lng,
        radius_m: radius, status: input.status ?? prj.status,
      });
      return prj;
    }
    const prj: MProject = {
      id: uid(), org_id: me.org_id, name: input.name.trim(), address: input.address ?? null,
      lat: input.lat, lng: input.lng, radius_m: radius, status: 'active',
    };
    this.state.projects.push(prj);
    this.state.project_members.push({ project_id: prj.id, profile_id: me.id });
    return prj;
  }

  listLocations(userId: string, projectId: string) {
    this.orgProject(this.profile(userId), projectId);
    return this.state.locations.filter((l) => l.project_id === projectId).sort((a, b) => a.sort - b.sort);
  }

  addLocation(userId: string, projectId: string, parentId: string | null, kind: LocationKind, name: string) {
    this.orgProject(this.manager(userId), projectId);
    if (!name.trim()) fail('name_required');
    if (parentId && !this.state.locations.some((l) => l.id === parentId && l.project_id === projectId)) fail('location_not_found');
    const siblings = this.state.locations.filter((l) => l.project_id === projectId && l.parent_id === parentId);
    const loc: MLocation = { id: uid(), project_id: projectId, parent_id: parentId, kind, name: name.trim(), sort: siblings.length + 1 };
    this.state.locations.push(loc);
    return loc;
  }

  renameLocation(userId: string, locationId: string, name: string) {
    const loc = this.state.locations.find((l) => l.id === locationId) ?? fail('location_not_found');
    this.orgProject(this.manager(userId), loc.project_id);
    if (!name.trim()) fail('name_required');
    loc.name = name.trim();
    return loc;
  }

  deleteLocation(userId: string, locationId: string) {
    const loc = this.state.locations.find((l) => l.id === locationId) ?? fail('location_not_found');
    this.orgProject(this.manager(userId), loc.project_id);
    const ids = this.subtreeIds(locationId);
    this.state.locations = this.state.locations.filter((l) => !ids.has(l.id));
    for (const t of this.state.tasks) if (t.location_id && ids.has(t.location_id)) t.location_id = null; // on delete set null
    return { deleted: ids.size };
  }

  /** "Duplicate floor": deep-copies a location subtree next to the original. */
  duplicateLocation(userId: string, locationId: string, newName: string) {
    const root = this.state.locations.find((l) => l.id === locationId) ?? fail('location_not_found');
    this.orgProject(this.manager(userId), root.project_id);
    const map = new Map<string, string>();
    const ids = this.subtreeIds(locationId);
    const ordered = this.state.locations.filter((l) => ids.has(l.id));
    // parents before children
    ordered.sort((a, b) => this.locationPath(a.id).length - this.locationPath(b.id).length);
    for (const l of ordered) {
      const id = uid();
      map.set(l.id, id);
      this.state.locations.push({
        ...l, id,
        parent_id: l.id === locationId ? l.parent_id : map.get(l.parent_id!)!,
        name: l.id === locationId ? newName.trim() || l.name + ' (עותק)' : l.name,
        sort: l.id === locationId ? l.sort + 0.5 : l.sort,
      });
    }
    return this.state.locations.find((l) => l.id === map.get(locationId))!;
  }

  listTeams(userId: string) {
    const me = this.manager(userId);
    return this.state.teams.filter((t) => t.org_id === me.org_id);
  }

  saveTeam(userId: string, name: string, subcontractor_name: string | null) {
    const me = this.manager(userId);
    if (!name.trim()) fail('name_required');
    const team: MTeam = { id: uid(), org_id: me.org_id, name: name.trim(), subcontractor_name };
    this.state.teams.push(team);
    return team;
  }

  listWorkers(userId: string) {
    const me = this.manager(userId);
    const workers = this.state.profiles.filter((p) => p.org_id === me.org_id).map(publicProfile).map((p) => ({
      ...p,
      project_ids: this.state.project_members.filter((m) => m.profile_id === p.id).map((m) => m.project_id),
      on_site: this.state.attendance.some((a) => a.profile_id === p.id && !a.check_out_at),
    }));
    const invitations = this.state.invitations.filter((i) => i.org_id === me.org_id && !i.accepted_at);
    return { workers, invitations, teams: this.listTeams(userId) };
  }

  inviteWorker(userId: string, input: {
    phone: string; full_name: string; language: Language; team_id: string | null; project_ids: string[]; role?: Role;
  }) {
    const me = this.manager(userId);
    const phone = normalizePhone(input.phone);
    if (phone.length < 9) fail('invalid_phone');
    if (!input.full_name.trim()) fail('name_required');
    if (this.state.profiles.some((p) => p.phone === phone) ||
        this.state.invitations.some((i) => i.org_id === me.org_id && i.phone === phone)) fail('phone_exists');
    for (const pid of input.project_ids) this.orgProject(me, pid);
    const inv: MInvitation = {
      id: uid(), org_id: me.org_id, phone, full_name: input.full_name.trim(), role: input.role ?? 'worker',
      language: input.language, team_id: input.team_id, project_ids: input.project_ids,
      accepted_at: null, created_at: this.now().toISOString(),
    };
    this.state.invitations.push(inv);
    return inv;
  }

  listTasks(userId: string, projectId: string, f: { date?: string; status?: TaskStatus; locationId?: string; assignee?: string } = {}) {
    const me = this.manager(userId);
    this.orgProject(me, projectId);
    const locIds = f.locationId ? this.subtreeIds(f.locationId) : null;
    return this.state.tasks
      .filter((t) => t.project_id === projectId)
      .filter((t) => !f.date || t.scheduled_date === f.date)
      .filter((t) => !f.status || t.status === f.status)
      .filter((t) => !locIds || (t.location_id !== null && locIds.has(t.location_id)))
      .filter((t) => !f.assignee || t.assignee_id === f.assignee || t.team_id === f.assignee)
      .map((t) => this.taskView(t))
      .sort((a, b) => b.scheduled_date.localeCompare(a.scheduled_date) ||
        a.location_path.join('/').localeCompare(b.location_path.join('/'), 'he'));
  }

  saveTask(userId: string, input: Partial<MTask> & { project_id: string; title: string }) {
    const me = this.manager(userId);
    this.orgProject(me, input.project_id);
    if (!input.title?.trim()) fail('title_required');
    if (input.video_url && !/^https?:\/\//i.test(input.video_url)) fail('invalid_video_url');
    if (!input.assignee_id && !input.team_id) fail('assignee_required');
    const fields = {
      location_id: input.location_id ?? null, title: input.title.trim(), instructions: input.instructions ?? null,
      video_url: input.video_url || null, assignee_id: input.assignee_id ?? null, team_id: input.team_id ?? null,
      scheduled_date: input.scheduled_date ?? dateKey(this.now()),
    };
    if (input.id) {
      const t = this.state.tasks.find((x) => x.id === input.id && x.project_id === input.project_id) ?? fail('task_not_found');
      Object.assign(t, fields);
      return this.taskView(t);
    }
    const t: MTask = {
      id: uid(), project_id: input.project_id, ...fields, status: 'open', completed_at: null, completed_by: null,
      created_at: this.now().toISOString(),
    };
    this.state.tasks.push(t);
    return this.taskView(t);
  }

  deleteTask(userId: string, taskId: string) {
    const t = this.state.tasks.find((x) => x.id === taskId) ?? fail('task_not_found');
    this.orgProject(this.manager(userId), t.project_id);
    this.state.tasks = this.state.tasks.filter((x) => x.id !== taskId);
    this.state.task_photos = this.state.task_photos.filter((p) => p.task_id !== taskId);
    return { ok: true };
  }

  /** Copy a task to more locations and/or more days (one copy per location × date). */
  duplicateTask(userId: string, taskId: string, locationIds: (string | null)[], dates: string[]) {
    const src = this.state.tasks.find((x) => x.id === taskId) ?? fail('task_not_found');
    this.orgProject(this.manager(userId), src.project_id);
    const locs = locationIds.length ? locationIds : [src.location_id];
    const ds = dates.length ? dates : [src.scheduled_date];
    const created: TaskView[] = [];
    for (const location_id of locs) for (const scheduled_date of ds) {
      created.push(this.saveTask(userId, { ...src, id: undefined, location_id, scheduled_date }));
    }
    return created;
  }

  // ===================== Manager: control =====================
  dashboard(userId: string, projectId: string) {
    const me = this.manager(userId);
    this.orgProject(me, projectId);
    const now = this.now();
    const today = dateKey(now);
    const name = (id: string | null) => this.state.profiles.find((p) => p.id === id)?.full_name ?? '—';

    const onSite = this.state.attendance
      .filter((a) => a.project_id === projectId && !a.check_out_at)
      .map((a) => ({ attendance_id: a.id, profile_id: a.profile_id, full_name: name(a.profile_id),
        check_in_at: a.check_in_at, hours_so_far: hoursBetween(a.check_in_at, null, now) }));

    const byWorker = new Map<string, { profile_id: string; full_name: string; hours: number; on_site: boolean }>();
    for (const a of this.state.attendance) {
      if (a.project_id !== projectId || dateKey(new Date(a.check_in_at)) !== today) continue;
      const row = byWorker.get(a.profile_id) ??
        { profile_id: a.profile_id, full_name: name(a.profile_id), hours: 0, on_site: false };
      row.hours += hoursBetween(a.check_in_at, a.check_out_at, now);
      row.on_site ||= !a.check_out_at;
      byWorker.set(a.profile_id, row);
    }

    const todays = this.state.tasks.filter((t) => t.project_id === projectId && t.scheduled_date === today);
    const kpi = this.kpi(projectId, today);
    const recentPhotos = this.gallery(userId, projectId, {}).slice(0, 8);
    return {
      today, onSite, hoursToday: [...byWorker.values()],
      tasksToday: { total: todays.length, done: todays.filter((t) => t.status === 'done').length },
      progress: this.progress(projectId), kpi, recentPhotos,
    };
  }

  /** Mirrors v_location_progress: counts every task in each location's subtree. */
  progress(projectId: string): LocationProgress[] {
    return this.state.locations.filter((l) => l.project_id === projectId).sort((a, b) => a.sort - b.sort).map((l) => {
      const ids = this.subtreeIds(l.id);
      const ts = this.state.tasks.filter((t) => t.location_id && ids.has(t.location_id));
      const done = ts.filter((t) => t.status === 'done').length;
      return { ...l, total_tasks: ts.length, done_tasks: done, percent_done: ts.length ? Math.round((100 * done) / ts.length) : 0 };
    });
  }

  /** Mirrors v_kpi_daily_closure. Target 85%. */
  kpi(projectId: string, date: string) {
    const ts = this.state.tasks.filter((t) => t.project_id === projectId && t.scheduled_date === date);
    const ok = ts.filter((t) => t.status === 'done' && t.completed_at && dateKey(new Date(t.completed_at)) <= date &&
      this.state.task_photos.some((p) => p.task_id === t.id)).length;
    return { date, total: ts.length, closed_on_time_with_photo: ok, percent: ts.length ? Math.round((100 * ok) / ts.length) : 0, target: 85 };
  }

  gallery(userId: string, projectId: string, f: { locationId?: string; workerId?: string; date?: string }) {
    const me = this.manager(userId);
    this.orgProject(me, projectId);
    const locIds = f.locationId ? this.subtreeIds(f.locationId) : null;
    return this.state.task_photos
      .map((ph) => ({ ph, t: this.state.tasks.find((t) => t.id === ph.task_id)! }))
      .filter(({ t }) => t && t.project_id === projectId)
      .filter(({ t }) => !locIds || (t.location_id !== null && locIds.has(t.location_id)))
      .filter(({ ph }) => !f.workerId || ph.uploaded_by === f.workerId)
      .filter(({ ph }) => !f.date || dateKey(new Date(ph.taken_at)) === f.date)
      .sort((a, b) => b.ph.taken_at.localeCompare(a.ph.taken_at))
      .map(({ ph, t }) => ({
        ...ph, task_title: t.title, location_path: this.locationPath(t.location_id),
        uploaded_by_name: this.state.profiles.find((p) => p.id === ph.uploaded_by)?.full_name ?? '—',
      }));
  }

  attendanceReport(userId: string, projectId: string, from: string, to: string) {
    const me = this.manager(userId);
    this.orgProject(me, projectId);
    const now = this.now();
    return this.state.attendance
      .filter((a) => a.project_id === projectId)
      .filter((a) => { const d = dateKey(new Date(a.check_in_at)); return d >= from && d <= to; })
      .sort((a, b) => b.check_in_at.localeCompare(a.check_in_at))
      .map((a) => ({
        ...a,
        full_name: this.state.profiles.find((p) => p.id === a.profile_id)?.full_name ?? '—',
        hours: hoursBetween(a.check_in_at, a.check_out_at, now),
        edits: this.state.attendance_edits.filter((e) => e.attendance_id === a.id),
      }));
  }

  editAttendance(userId: string, attendanceId: string, checkIn: string, checkOut: string | null, reason: string) {
    const me = this.manager(userId);
    if (!reason?.trim()) fail('reason_required');
    const rec = this.state.attendance.find((a) => a.id === attendanceId);
    if (!rec || this.state.projects.find((p) => p.id === rec.project_id)?.org_id !== me.org_id) fail('attendance_not_found');
    if (Number.isNaN(Date.parse(checkIn)) || (checkOut && Number.isNaN(Date.parse(checkOut)))) fail('invalid_time');
    if (checkOut && Date.parse(checkOut) <= Date.parse(checkIn)) fail('check_out_before_check_in');
    this.state.attendance_edits.push({
      id: uid(), attendance_id: rec!.id, old_check_in: rec!.check_in_at, old_check_out: rec!.check_out_at,
      new_check_in: new Date(checkIn).toISOString(), new_check_out: checkOut ? new Date(checkOut).toISOString() : null,
      reason: reason.trim(), edited_by: me.id, edited_at: this.now().toISOString(),
    });
    rec!.check_in_at = new Date(checkIn).toISOString();
    rec!.check_out_at = checkOut ? new Date(checkOut).toISOString() : null;
    rec!.source = 'manual';
    return rec!;
  }
}
