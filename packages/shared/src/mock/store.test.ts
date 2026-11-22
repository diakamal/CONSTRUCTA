import { beforeEach, describe, expect, it } from 'vitest';
import { AppError, DEMO_IDS, DEMO_SITE, MockStore, createSeed } from '.';

const { manager, ahmad, somchai, project } = DEMO_IDS;
let s: MockStore;
beforeEach(() => { s = new MockStore(createSeed()); });

const code = (fn: () => unknown) => {
  try { fn(); } catch (e) { return (e as AppError).code; }
  return 'no_error';
};

describe('auth', () => {
  it('manager login checks password', () => {
    expect(s.loginManager('manager@constructa.test', 'Test1234!').id).toBe(manager);
    expect(code(() => s.loginManager('manager@constructa.test', 'wrong'))).toBe('invalid_credentials');
  });
  it('only invited phones can request an OTP', () => {
    expect(s.requestOtp('+972-50-000-0001')).toEqual({ sent: true });
    expect(code(() => s.requestOtp('+972599999999'))).toBe('not_invited');
  });
  it('first OTP sign-in accepts the invitation and joins the project', () => {
    const p = s.verifyOtp('+972500000003', '123456');
    expect(p.full_name).toBe('דוד');
    expect(s.myDay(p.id).projects.map((x) => x.id)).toEqual([project]);
    expect(code(() => s.verifyOtp('+972500000003', '000000'))).toBe('invalid_code');
  });
});

describe('attendance', () => {
  it('rejects check-in outside the radius with the distance', () => {
    try { s.checkIn(ahmad, project, DEMO_SITE.lat + 0.01, DEMO_SITE.lng, 5); expect.fail(); }
    catch (e) { expect((e as AppError).code).toBe('outside_geofence'); expect(Number((e as AppError).detail)).toBeGreaterThan(1000); }
  });
  it('GPS accuracy slack is capped at 50 m', () => {
    // ~190 m away, radius 150: allowed with accuracy 45, rejected even with accuracy 500 if > 200
    expect(code(() => s.checkIn(ahmad, project, DEMO_SITE.lat + 0.0017, DEMO_SITE.lng, 45))).toBe('no_error');
    expect(code(() => s.checkIn(somchai, project, DEMO_SITE.lat + 0.0022, DEMO_SITE.lng, 500))).toBe('outside_geofence');
  });
  it('one open shift at a time, then check-out', () => {
    s.checkIn(ahmad, project, DEMO_SITE.lat, DEMO_SITE.lng);
    expect(code(() => s.checkIn(ahmad, project, DEMO_SITE.lat, DEMO_SITE.lng))).toBe('already_checked_in');
    expect(s.checkOut(ahmad).check_out_at).not.toBeNull();
    expect(code(() => s.checkOut(ahmad))).toBe('not_checked_in');
  });
  it('manager edit requires a reason and is audited; workers cannot edit', () => {
    const a = s.checkIn(ahmad, project, DEMO_SITE.lat, DEMO_SITE.lng);
    const out = new Date(Date.parse(a.check_in_at) + 3_600_000).toISOString();
    expect(code(() => s.editAttendance(manager, a.id, a.check_in_at, out, ' '))).toBe('reason_required');
    expect(code(() => s.editAttendance(ahmad, a.id, a.check_in_at, out, 'x'))).toBe('forbidden');
    s.editAttendance(manager, a.id, a.check_in_at, out, 'שכח לצאת');
    expect(s.state.attendance_edits).toHaveLength(1);
  });
});

describe('tasks', () => {
  it('workers see only their own / team tasks', () => {
    const titles = (id: string) => s.myDay(id).tasks.map((t) => t.id);
    expect(titles(ahmad).every((id) => id.startsWith('t-drain'))).toBe(true); // team tasks
    expect(titles(somchai).some((id) => id.startsWith('t-clean'))).toBe(true);
    expect(titles(somchai)).toContain('t-y-3'); // overdue from yesterday
    expect(code(() => s.getTask(somchai, 't-drain-0'))).toBe('task_not_found');
  });
  it('completion requires an uploaded photo, closes immediately, and is idempotent', () => {
    expect(code(() => s.completeTask(ahmad, 't-drain-0', null))).toBe('photo_required');
    expect(code(() => s.completeTask(ahmad, 't-drain-0', 'org-demo/t-drain-0/fake.jpg'))).toBe('photo_not_uploaded');
    const path = s.registerUpload(ahmad, 't-drain-0');
    expect(s.completeTask(ahmad, 't-drain-0', path).status).toBe('done');
    expect(s.completeTask(ahmad, 't-drain-0', path).photos).toHaveLength(1);
  });
  it('progress counts the whole subtree', () => {
    const f1 = () => s.progress(project).find((l) => l.id === 'loc-f1')!;
    const before = f1().done_tasks;
    s.completeTask(ahmad, 't-drain-0', s.registerUpload(ahmad, 't-drain-0')); // a bathroom on floor 1
    expect(f1().done_tasks).toBe(before + 1);
  });
  it('duplicate floor copies the whole subtree', () => {
    const before = s.listLocations(manager, project).length;
    const copy = s.duplicateLocation(manager, 'loc-f3', 'קומה 4');
    expect(copy.name).toBe('קומה 4');
    expect(s.listLocations(manager, project).length).toBe(before + 5); // floor + 2 units + 2 rooms
  });
  it('workers cannot call manager methods', () => {
    expect(code(() => s.listProjects(ahmad))).toBe('forbidden');
  });
});
