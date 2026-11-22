export type Role = 'owner' | 'manager' | 'worker';
export type Language = 'he' | 'ar' | 'th' | 'en';
export type LocationKind = 'building' | 'floor' | 'unit' | 'room';
export type TaskStatus = 'open' | 'done';

export interface Profile {
  id: string;
  org_id: string;
  role: Role;
  full_name: string;
  phone: string | null;
  language: Language;
  team_id: string | null;
}

export interface Project {
  id: string;
  org_id: string;
  name: string;
  address: string | null;
  lat: number;
  lng: number;
  radius_m: number;
  status: 'active' | 'archived';
}

export interface SiteLocation {
  id: string;
  project_id: string;
  parent_id: string | null;
  kind: LocationKind;
  name: string;
  sort: number;
}

export interface Task {
  id: string;
  project_id: string;
  location_id: string | null;
  title: string;
  instructions: string | null;
  video_url: string | null;
  assignee_id: string | null;
  team_id: string | null;
  scheduled_date: string;
  status: TaskStatus;
  completed_at: string | null;
  completed_by: string | null;
}

export interface Attendance {
  id: string;
  profile_id: string;
  project_id: string;
  check_in_at: string;
  check_out_at: string | null;
  source: 'app' | 'manual';
}

export const RTL_LANGUAGES: Language[] = ['he', 'ar'];
export const isRtl = (lang: Language) => RTL_LANGUAGES.includes(lang);
