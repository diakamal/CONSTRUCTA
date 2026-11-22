export * from './store';
export * from './seed';

/** Methods the mock API exposes over HTTP: POST /api/rpc/{method} with a JSON array of arguments (after userId). */
export const WORKER_METHODS = [
  'me', 'setMyLanguage', 'myDay', 'getTask', 'checkIn', 'checkOut', 'completeTask',
] as const;
export const MANAGER_METHODS = [
  'listProjects', 'saveProject', 'listLocations', 'addLocation', 'renameLocation', 'deleteLocation',
  'duplicateLocation', 'listTeams', 'saveTeam', 'listWorkers', 'inviteWorker', 'listTasks', 'saveTask',
  'deleteTask', 'duplicateTask', 'dashboard', 'gallery', 'attendanceReport', 'editAttendance',
] as const;
export const PUBLIC_METHODS = ['loginManager', 'requestOtp', 'verifyOtp'] as const;
export type RpcMethod =
  | (typeof WORKER_METHODS)[number] | (typeof MANAGER_METHODS)[number] | (typeof PUBLIC_METHODS)[number];
