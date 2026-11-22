'use client';
import { createContext, useContext } from 'react';
import type { MProject, PublicProfile } from '@constructa/shared';

export interface DashContext {
  me: PublicProfile;
  projects: MProject[];
  project: MProject | null;
  setProjectId: (id: string) => void;
  reloadProjects: () => Promise<void>;
}

export const ProjectCtx = createContext<DashContext | null>(null);

export function useDash() {
  const ctx = useContext(ProjectCtx);
  if (!ctx) throw new Error('useDash outside dashboard layout');
  return ctx;
}
