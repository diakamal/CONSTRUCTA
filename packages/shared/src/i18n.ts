import he from '../locales/he.json';
import ar from '../locales/ar.json';
import th from '../locales/th.json';
import en from '../locales/en.json';
import type { Language } from './types';

export const resources = { he, ar, th, en } as const;
export type TranslationKey = keyof typeof he;
export const SUPPORTED_LANGUAGES: { code: Language; label: string }[] = [
  { code: 'he', label: 'עברית' },
  { code: 'ar', label: 'العربية' },
  { code: 'th', label: 'ไทย' },
];
